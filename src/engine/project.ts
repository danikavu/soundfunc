import { compileGraph, type Graph } from './graph';
import { tryCompile, type Compiled } from './expr';
import { chordTones, midiToDegree, midiToFreq, midiToName, NOTE_NAMES, SCALES, valueToMidi, valueToPitch, type PitchMode } from './music';

export type DrumVoice = 'kick' | 'snare' | 'hat' | 'openhat' | 'clap' | 'rim' | 'tom' | 'crash';
export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'bell' | 'pluck' | 'pad' | 'flute' | 'reese' | 'custom' | DrumVoice;

export const WAVEFORMS: Record<Exclude<Waveform, DrumVoice>, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  square: 'Square',
  sawtooth: 'Sawtooth',
  bell: 'Temple Bell',
  pluck: 'Koto Pluck',
  pad: 'Mist Pad',
  flute: 'Shakuhachi',
  reese: 'Reese Bass',
  custom: 'f(p) Custom',
};

/** Drum voices and their General MIDI percussion note. */
export const DRUMS: Record<DrumVoice, { label: string; gm: number }> = {
  kick: { label: 'Kick', gm: 36 },
  snare: { label: 'Snare', gm: 38 },
  hat: { label: 'Closed Hat', gm: 42 },
  openhat: { label: 'Open Hat', gm: 46 },
  clap: { label: 'Clap', gm: 39 },
  rim: { label: 'Rim', gm: 37 },
  tom: { label: 'Tom', gm: 45 },
  crash: { label: 'Crash', gm: 49 },
};

export const isDrum = (w: Waveform): w is DrumVoice => w in DRUMS;

export const voiceLabel = (w: Waveform) => (isDrum(w) ? DRUMS[w].label : WAVEFORMS[w]);

/** Waveforms that can hold one continuous, sliding voice. */
export const GLIDE_WAVEFORMS: Waveform[] = ['sine', 'triangle', 'square', 'sawtooth', 'pad', 'flute', 'reese', 'custom'];

export type PlayMode = 'notes' | 'glide';

export interface Track {
  id: string;
  name: string;
  color: string;
  graph: Graph;
  steps: number;
  /** step length in beats (0.25 = sixteenth) */
  stepBeats: number;
  octave: number;
  pitchMode: PitchMode;
  waveform: Waveform;
  /** custom waveform: one cycle as f(p), p = 0 → 1 */
  timbre: string;
  volume: number;
  pan: number;
  attack: number;
  release: number;
  /** reverb send 0..1 */
  send: number;
  /** delay every other step by this fraction of a step */
  swing: number;
  /** notes = discrete steps; glide = one continuous voice following the curve */
  playMode: PlayMode;
  /** glide: snap the continuous pitch to the scale */
  quantize: boolean;
  /** glide: portamento time in seconds */
  glide: number;
  muted: boolean;
  solo: boolean;
}

export const TRACK_DEFAULTS: Omit<Track, 'id' | 'name' | 'color' | 'graph'> = {
  steps: 16,
  stepBeats: 0.25,
  octave: 4,
  pitchMode: 'degree',
  waveform: 'sine',
  timbre: 'sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)',
  volume: 0.8,
  pan: 0,
  attack: 0.01,
  release: 0.4,
  send: 1,
  swing: 0,
  playMode: 'notes',
  quantize: true,
  glide: 0.03,
  muted: false,
  solo: false,
};

export interface Song {
  bpm: number;
  root: number;
  scale: string;
  reverb: number;
  /** how many times the longest pattern repeats on MIDI export */
  exportLoops: number;
  /** chord progression: the chord's scale degree as a function of `bar` (and `k`) */
  harmony: string;
  /** keep the progression when mutating the whole garden */
  harmonyLocked?: boolean;
}

export const SONG_DEFAULTS: Song = { bpm: 90, root: 0, scale: 'major', reverb: 0.3, exportLoops: 4, harmony: '0' };
export const BEATS_PER_BAR = 4;

const harmonyCache = new Map<string, Compiled | null>();
function harmonyFn(src: string): Compiled | null {
  if (!harmonyCache.has(src)) {
    if (harmonyCache.size > 64) harmonyCache.clear();
    harmonyCache.set(src, tryCompile(src, ['bar', 'k', 'L']).fn);
  }
  return harmonyCache.get(src)!;
}

/** The chord (scale degree) sounding at an absolute beat of the song. */
export function harmonyAt(song: Song, beat: number): number {
  const fn = harmonyFn(song.harmony ?? '0');
  if (!fn) return 0;
  const v = fn({ bar: Math.floor(beat / BEATS_PER_BAR + 1e-9), k: 0, L: scaleLength(song) });
  return Number.isFinite(v) ? Math.round(v) : 0;
}

export const scaleLength = (song: Song) => (SCALES[song.scale] ?? SCALES.major).steps.length;

export interface Project {
  name: string;
  song: Song;
  tracks: Track[];
}

/** Fill in fields added since a project was saved. */
export function normalizeProject(p: Project): Project {
  return {
    name: p.name ?? 'Untitled',
    song: { ...SONG_DEFAULTS, ...(p.song as Partial<Song>) },
    tracks: p.tracks.map((t) => ({ ...TRACK_DEFAULTS, ...t })),
  };
}

/** A generated note — everything needed for playback, visuals and export. */
export interface Note {
  step: number;
  loop: number;
  /** start time in beats from the start of the loop pass */
  beat: number;
  /** duration in beats */
  duration: number;
  midi: number;
  name: string;
  freq: number;
  velocity: number;
  /** raw value fed into the pitch input before mapping */
  raw: number;
  /** drums: tuning in semitones (from the pitch input) */
  tune: number;
  key: string;
  /** the song's chord (scale degree) when this note starts */
  h: number;
}

/** A finely sampled view of the function — drives glide voices and the x/y plot. */
export interface Curve {
  /** samples per step */
  res: number;
  beat: number[];
  /** continuous MIDI pitch (snapped if the track quantizes) */
  midi: number[];
  velocity: number[];
  raw: number[];
}

export interface TrackRender {
  notes: Note[];
  /** raw per-step pitch value, including rests */
  pitchCurve: number[];
  velocityCurve: number[];
  curve: Curve;
  /** per-node sparkline values */
  traces: Map<string, number[]>;
  errors: Map<string, string>;
  hasOutput: boolean;
}

export function keyLabel(song: Song): string {
  return `${NOTE_NAMES[song.root]} ${song.scale}`;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** samples per step: glide tracks are sampled finely enough for smooth bends */
export const curveRes = (track: Track) => (track.playMode === 'glide' ? 16 : Math.max(1, Math.min(16, Math.floor(1024 / track.steps))));

export function renderTrack(track: Track, song: Song, loop = 0, withTraces = true): TrackRender {
  const program = compileGraph(track.graph);
  const traces = withTraces ? new Map<string, number[]>() : undefined;
  const notes: Note[] = [];
  const pitchCurve: number[] = [];
  const velocityCurve: number[] = [];
  const key = keyLabel(song);
  const drum = isDrum(track.waveform) ? DRUMS[track.waveform] : null;
  const glide = track.playMode === 'glide' && !drum;
  let hasOutput = true;
  const L = scaleLength(song);
  const loopBeat = loop * patternBeats(track);
  /** clock for a (possibly fractional) step position u */
  const clock = (u: number) => {
    const t = u * track.stepBeats;
    return { n: Math.floor(u), x: u / track.steps, t, k: loop, steps: track.steps, h: harmonyAt(song, loopBeat + t), bar: Math.floor((loopBeat + t) / BEATS_PER_BAR + 1e-9), L };
  };

  for (let n = 0; n < track.steps; n++) {
    const ctx = clock(n);
    const out = program.run(ctx, traces);
    if (!out) {
      hasOutput = false;
      break;
    }
    pitchCurve.push(out.pitch);
    const vel = clamp(out.velocity, 0, 1);
    velocityCurve.push(vel);
    if (vel < 0.01 || glide) continue;

    const rootMidi = drum ? drum.gm : valueToMidi(out.pitch, track.pitchMode, song.root, song.scale, track.octave);
    // chords: stack scale degrees on top of the pitch
    const size = drum ? 1 : clamp(Math.round(out.chord), 1, 8);
    const scale = (SCALES[song.scale] ?? SCALES.major).steps;
    const tones =
      size > 1
        ? chordTones(midiToDegree(rootMidi, song.root, scale, track.octave), size, out.stack, out.inversion, song.root, song.scale, track.octave)
        : [rootMidi];
    const strum = clamp(out.strum, -0.5, 0.5);
    const tune = drum ? clamp(out.pitch, -24, 24) : 0;
    const ratchet = clamp(Math.round(out.ratchet), 1, 8);
    const shift = clamp(clamp(out.shift, 0, 0.95) + (n % 2 === 1 ? track.swing : 0), 0, 0.95);
    const len = clamp(out.length, 0.05, 64);
    for (let r = 0; r < ratchet; r++) {
      tones.forEach((midi, i) => {
        // negative strum rolls the chord downward
        const roll = (strum >= 0 ? i : tones.length - 1 - i) * Math.abs(strum);
        notes.push({
          step: n,
          loop,
          beat: (n + Math.min(0.97, shift + roll) + r / ratchet) * track.stepBeats,
          duration: ratchet > 1 ? (track.stepBeats / ratchet) * 0.9 : Math.max(0.05, len - roll) * track.stepBeats,
          midi,
          name: drum ? drum.label : midiToName(midi),
          freq: midiToFreq(midi),
          velocity: (ratchet > 1 && r > 0 ? vel * (0.7 + (0.3 * r) / ratchet) : vel) * (i === 0 ? 1 : 0.85),
          raw: out.pitch,
          tune,
          key,
          h: ctx.h,
        });
      });
    }
  }

  // continuous pass: n still ticks per step, but x and t flow between steps
  const res = hasOutput ? curveRes(track) : 1;
  const curve: Curve = { res, beat: [], midi: [], velocity: [], raw: [] };
  if (hasOutput) {
    for (let i = 0; i < track.steps * res; i++) {
      const u = i / res;
      const out = program.run(clock(u))!;
      curve.beat.push(u * track.stepBeats);
      curve.raw.push(out.pitch);
      curve.velocity.push(clamp(out.velocity, 0, 1));
      curve.midi.push(
        drum ? drum.gm + clamp(out.pitch, -24, 24) : valueToPitch(out.pitch, track.pitchMode, song.root, song.scale, track.octave, !glide || track.quantize),
      );
    }
  }

  return { notes, pitchCurve, velocityCurve, curve, traces: traces ?? new Map(), errors: program.errors, hasOutput };
}

/** Bars until the progression repeats (1 for a drone), found by comparing the first 32 bars. */
export function harmonyCycleBars(song: Song): number {
  const at = (bar: number) => harmonyAt(song, bar * BEATS_PER_BAR);
  for (const p of [1, 2, 3, 4, 6, 8, 12, 16]) {
    let ok = true;
    for (let b = 0; b < 32 && ok; b++) ok = at(b) === at(b + p);
    if (ok) return p;
  }
  return 16;
}

/** One full cycle of the song: the longest pattern, or the progression if that is longer. */
export function songBeats(tracks: Track[], song: Song): number {
  return Math.max(1, ...tracks.map(patternBeats), harmonyCycleBars(song) * BEATS_PER_BAR);
}

export function patternBeats(track: Track): number {
  return track.steps * track.stepBeats;
}

export function audibleTracks(tracks: Track[]): Track[] {
  const anySolo = tracks.some((t) => t.solo);
  return tracks.filter((t) => (anySolo ? t.solo : !t.muted));
}
