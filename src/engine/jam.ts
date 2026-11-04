/**
 * Jam recording: everything the engine actually plays while recording — every note, every glide,
 * every tempo change, through every mutation — plus the audio it makes. A take starts and ends on
 * a bar line, so the files drop straight onto a DAW's grid.
 *
 * The engine feeds a Take as it schedules (in its own beats); finishing a take gives a Jam, which
 * exports as MIDI (writeMidi, with the tempo map) or as a WAV of the mix.
 */
import { writeMidi, type CurveStats, type ExportTrack, type GlidePoint, type MidiMode, type TempoMark } from './midi';
import type { Note, Song, Track } from './project';

/** one channel's part of the jam, keyed by the channel's id; `track` is how it last sounded */
interface Part {
  track: Track;
  notes: Note[];
  glide: GlidePoint[];
}

export interface JamAudio {
  sampleRate: number;
  /** interleaved stereo, 16-bit */
  chunks: Int16Array[];
  frames: number;
}

export interface Jam {
  name: string;
  /** the song as the take began: its key and scale go in the MIDI file */
  song: Song;
  /** in beats, from the take's first bar line */
  beats: number;
  seconds: number;
  tempos: TempoMark[];
  parts: ExportTrack[];
  audio: JamAudio | null;
}

/** a take in progress: what the engine played from `start` (an engine beat on a bar line) up to `end` */
export class Take {
  readonly parts = new Map<string, Part>();
  readonly tempos: TempoMark[] = [];
  /** set when the take is asked to stop: the bar line it ends on */
  end = Infinity;
  /** the audio clock times of start and end, kept right as the tempo changes until each is reached */
  startTime = 0;
  endTime = Infinity;

  constructor(
    readonly start: number,
    readonly name: string,
    readonly song: Song,
  ) {
    this.tempos.push({ beat: 0, bpm: song.bpm });
  }

  private part(track: Track): Part {
    let p = this.parts.get(track.id);
    if (!p) this.parts.set(track.id, (p = { track, notes: [], glide: [] }));
    p.track = track;
    return p;
  }

  inside = (beat: number) => beat >= this.start - 1e-9 && beat < this.end - 1e-9;

  note(track: Track, beat: number, note: Note) {
    if (this.inside(beat)) this.part(track).notes.push({ ...note, beat: beat - this.start });
  }

  glide(track: Track, beat: number, midi: number, velocity: number) {
    if (this.inside(beat)) this.part(track).glide.push({ beat: beat - this.start, midi, velocity });
  }

  /** a glide voice fell silent (muted, removed, switched to notes) */
  hush(trackId: string, beat: number) {
    const p = this.parts.get(trackId);
    const last = p?.glide[p.glide.length - 1];
    if (p && last && last.velocity > 0 && this.inside(beat)) p.glide.push({ beat: Math.max(last.beat, beat - this.start), midi: last.midi, velocity: 0 });
  }

  tempo(beat: number, bpm: number) {
    const at = Math.max(0, beat - this.start);
    if (!this.inside(beat) && beat >= this.start) return;
    const last = this.tempos[this.tempos.length - 1];
    if (last.bpm === bpm) return;
    if (Math.abs(last.beat - at) < 1e-6) last.bpm = bpm;
    else this.tempos.push({ beat: at, bpm });
  }

  /** the take as a Jam, cut at `end` (in engine beats) */
  finish(end: number, seconds: number, audio: JamAudio | null): Jam {
    const beats = Math.max(0, end - this.start);
    const parts: ExportTrack[] = [...this.parts.values()]
      .map(({ track, notes, glide }) => ({
        track,
        notes: notes.filter((n) => n.beat < beats - 1e-9).map((n) => ({ ...n, duration: Math.min(n.duration, beats - n.beat) })),
        glide: glide.filter((g) => g.beat < beats - 1e-9).sort((a, b) => a.beat - b.beat),
      }))
      .filter((p) => p.notes.length || p.glide.some((g) => g.velocity > 0.01));
    return { name: this.name, song: this.song, beats, seconds, tempos: this.tempos.filter((t) => t.beat < beats || t.beat === 0), parts, audio };
  }
}

// ---------- exporting a jam ----------

export function jamMidi(jam: Jam, mode: MidiMode, stats?: CurveStats): Uint8Array {
  return writeMidi(jam.name, jam.song, jam.parts, jam.beats, jam.tempos, stats, mode);
}

/** a 16-bit stereo WAV of the jam's audio */
export function jamWav(audio: JamAudio): Uint8Array {
  const bytes = audio.frames * 4;
  const out = new Uint8Array(44 + bytes);
  const v = new DataView(out.buffer);
  const str = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + bytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 2, true);
  v.setUint32(24, audio.sampleRate, true);
  v.setUint32(28, audio.sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, bytes, true);
  let at = 44;
  for (const c of audio.chunks) {
    out.set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength), at);
    at += c.byteLength;
  }
  return out;
}

/** "8 bars", or "7.5 bars" for a take stopped mid-bar */
export const barsOf = (jam: Jam) => {
  const b = Math.round((jam.beats / 4) * 10) / 10;
  return `${b} bar${b === 1 ? '' : 's'}`;
};

/** "2:07" */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** how long a take may run before it ends by itself: the audio is kept in memory (about 11 MB a minute) */
export const MAX_TAKE_SECONDS = 20 * 60;

// ---------- capturing the audio ----------

/**
 * An AudioWorklet that, while on, sends the mix on in blocks of ~4096 frames, each with the audio
 * clock frame it starts at. It passes nothing through: it only listens.
 */
const WORKLET = `
class JamTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.l = new Float32Array(4096);
    this.r = new Float32Array(4096);
    this.n = 0;
    this.at = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'on') { this.on = true; this.n = 0; }
      if (e.data === 'off') { this.flush(); this.on = false; this.port.postMessage('done'); }
    };
  }
  flush() {
    if (!this.n) return;
    this.port.postMessage({ at: this.at, l: this.l.slice(0, this.n), r: this.r.slice(0, this.n) });
    this.n = 0;
  }
  process(inputs) {
    if (!this.on) return true;
    const input = inputs[0];
    const l = input[0], r = input[1] || input[0];
    const len = l ? l.length : 128;
    if (this.n === 0) this.at = currentFrame;
    for (let i = 0; i < len; i++) {
      this.l[this.n + i] = l ? l[i] : 0;
      this.r[this.n + i] = r ? r[i] : 0;
    }
    this.n += len;
    if (this.n + 128 > this.l.length) this.flush();
    return true;
  }
}
registerProcessor('jam-tap', JamTap);
`;

/**
 * float → 16-bit. The mix bus's compressor adds make-up gain, so a rare peak goes past full scale:
 * above 0.9 a soft knee bends it under 1 instead of clipping (everything below is untouched).
 */
const KNEE = 0.9;
const soft = (x: number) => {
  const a = Math.abs(x);
  return a <= KNEE ? x : Math.sign(x) * (KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE)));
};
const s16 = (x: number) => Math.max(-32767, Math.min(32767, Math.round(soft(x) * 32767)));

/** listens to `source` and keeps the frames between two audio clock times */
export class AudioTap {
  private node: AudioWorkletNode | null = null;
  /** interleaved 16-bit stereo, converted as it arrives (half the memory of floats) */
  private blocks: { at: number; frames: number; data: Int16Array }[] = [];
  private done: (() => void) | null = null;

  constructor(private ctx: AudioContext) {}

  async connect(source: AudioNode) {
    if (this.node) return;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
    try {
      await this.ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const node = new AudioWorkletNode(this.ctx, 'jam-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
    node.port.onmessage = (e) => {
      if (e.data === 'done') this.done?.();
      else {
        const { at, l, r } = e.data as { at: number; l: Float32Array; r: Float32Array };
        const data = new Int16Array(l.length * 2);
        for (let i = 0; i < l.length; i++) (data[2 * i] = s16(l[i])), (data[2 * i + 1] = s16(r[i]));
        this.blocks.push({ at, frames: l.length, data });
      }
    };
    source.connect(node);
    // a silent output keeps the node pulled by the graph in every browser
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    node.connect(mute).connect(this.ctx.destination);
    this.node = node;
  }

  start() {
    this.blocks = [];
    this.node?.port.postMessage('on');
  }

  /** stop listening and return the frames from `from` to `to` (audio clock seconds) as 16-bit stereo */
  async stop(from: number, to: number): Promise<JamAudio | null> {
    if (!this.node) return null;
    await new Promise<void>((resolve) => {
      this.done = resolve;
      this.node!.port.postMessage('off');
      // never hang a take on a message that doesn't come
      setTimeout(resolve, 500);
    });
    this.done = null;
    const sr = this.ctx.sampleRate;
    const a = Math.round(from * sr), b = Math.round(to * sr);
    const chunks: Int16Array[] = [];
    let frames = 0;
    // a gap (there shouldn't be one) is filled with silence, so the audio keeps its place on the grid
    let next = a;
    for (const blk of this.blocks) {
      const lo = Math.max(a, blk.at), hi = Math.min(b, blk.at + blk.frames);
      if (hi <= lo) continue;
      if (lo > next) {
        chunks.push(new Int16Array((lo - next) * 2));
        frames += lo - next;
      }
      chunks.push(blk.data.subarray((lo - blk.at) * 2, (hi - blk.at) * 2));
      frames += hi - lo;
      next = hi;
    }
    if (b > next) {
      chunks.push(new Int16Array((b - next) * 2));
      frames += b - next;
    }
    this.blocks = [];
    return { sampleRate: sr, chunks, frames };
  }
}
