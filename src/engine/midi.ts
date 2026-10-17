import { audibleTracks, patternBeats, renderTrack, type Note, type Project, type Waveform } from './project';

const PPQ = 480;

const GM_PROGRAM: Record<Waveform, number> = {
  sine: 79, // ocarina
  triangle: 74, // recorder
  square: 80, // square lead
  sawtooth: 81, // saw lead
  bell: 14, // tubular bells
  pluck: 107, // koto
  pad: 89, // warm pad
  flute: 77, // shakuhachi
};

const MAJOR_SF: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
const MINOR_SCALES = new Set(['minor', 'minorPentatonic', 'harmonicMinor', 'dorian', 'hirajoshi', 'inSen', 'blues']);

function vlq(n: number): number[] {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0) & 0x7f);
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

interface Ev {
  tick: number;
  order: number; // note-offs before note-ons at the same tick
  bytes: number[];
}

function chunk(events: Ev[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data: number[] = [];
  let last = 0;
  for (const e of events) {
    data.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  data.push(0, 0xff, 0x2f, 0); // end of track
  return [...ascii('MTrk'), ...u32(data.length), ...data];
}

const meta = (tick: number, type: number, payload: number[]): Ev => ({
  tick,
  order: -1,
  bytes: [0xff, type, ...vlq(payload.length), ...payload],
});

/** Every note of every audible track across the export length, with absolute beats. */
export function collectNotes(project: Project): { trackName: string; waveform: Waveform; notes: Note[] }[] {
  const tracks = audibleTracks(project.tracks);
  const total = Math.max(0, ...tracks.map(patternBeats)) * Math.max(1, project.song.exportLoops);
  return tracks.map((track) => {
    const len = patternBeats(track);
    const loops = len > 0 ? Math.ceil(total / len - 1e-9) : 0;
    const notes: Note[] = [];
    for (let k = 0; k < loops; k++) {
      for (const n of renderTrack(track, project.song, k, false).notes) {
        const beat = k * len + n.beat;
        if (beat >= total - 1e-9) continue;
        notes.push({ ...n, beat, duration: Math.min(n.duration, total - beat) });
      }
    }
    return { trackName: track.name, waveform: track.waveform, notes };
  });
}

export function exportMidi(project: Project): Uint8Array {
  const { song } = project;
  const all = collectNotes(project);

  const minor = MINOR_SCALES.has(song.scale);
  const sf = MAJOR_SF[minor ? (song.root + 3) % 12 : song.root];
  const usPerBeat = Math.round(60_000_000 / song.bpm);
  const conductor = chunk([
    meta(0, 0x03, ascii(project.name || 'SoundFunc')),
    meta(0, 0x51, [(usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff]),
    meta(0, 0x58, [4, 2, 24, 8]),
    meta(0, 0x59, [sf & 0xff, minor ? 1 : 0]),
  ]);

  const trackChunks = all.map(({ trackName, waveform, notes }, i) => {
    let ch = i % 15;
    if (ch >= 9) ch++; // skip GM drum channel
    const evs: Ev[] = [meta(0, 0x03, ascii(trackName)), { tick: 0, order: 0, bytes: [0xc0 | ch, GM_PROGRAM[waveform]] }];
    for (const n of notes) {
      const on = Math.round(n.beat * PPQ);
      const off = Math.max(on + 1, Math.round((n.beat + n.duration) * PPQ));
      const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
      evs.push({ tick: on, order: 1, bytes: [0x90 | ch, n.midi, vel] });
      evs.push({ tick: off, order: 0, bytes: [0x80 | ch, n.midi, 0] });
    }
    return chunk(evs);
  });

  const header = [...ascii('MThd'), ...u32(6), 0, 1, 0, trackChunks.length + 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
  return new Uint8Array([...header, ...conductor, ...trackChunks.flat()]);
}

export function exportNotesCsv(project: Project): string {
  const rows = [['track', 'beat', 'duration_beats', 'midi', 'note', 'freq_hz', 'velocity', 'key', 'loop', 'step']];
  for (const t of collectNotes(project)) {
    for (const n of t.notes) {
      rows.push([
        t.trackName,
        n.beat.toFixed(4),
        n.duration.toFixed(4),
        String(n.midi),
        n.name,
        n.freq.toFixed(2),
        n.velocity.toFixed(3),
        n.key,
        String(n.loop),
        String(n.step),
      ]);
    }
  }
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}
