import { audibleTracks, isDrum, keyLabel, patternBeats, renderTrack, songBeats, songWindows, type Note, type Project, type Track, type Waveform } from './project';

const PPQ = 480;
/** pitch-bend range we program into each glide channel, in semitones */
const BEND_RANGE = 24;

const GM_PROGRAM: Partial<Record<Waveform, number>> = {
  sine: 79, // ocarina
  triangle: 74, // recorder
  square: 80, // square lead
  sawtooth: 81, // saw lead
  bell: 14, // tubular bells
  pluck: 107, // koto
  pad: 89, // warm pad
  flute: 77, // shakuhachi
  reese: 38, // synth bass 1
  custom: 82, // calliope lead
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
  /** note-offs, then controllers/bends, then note-ons at the same tick */
  order: number;
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

export interface GlidePoint {
  beat: number;
  midi: number;
  velocity: number;
}

export interface ExportTrack {
  track: Track;
  notes: Note[];
  /** continuous pitch for glide tracks, empty otherwise */
  glide: GlidePoint[];
}

/** Every note (and glide point) of every audible track across the export length, in absolute beats. */
export function collectNotes(project: Project): ExportTrack[] {
  const tracks = audibleTracks(project.tracks);
  const total = exportBeats(project);
  // the same song time playback uses: with "repeat exactly" each pass starts again
  const windows = songWindows(project.song, songBeats(tracks, project.song), 0, total);
  return tracks.map((track) => {
    const len = patternBeats(track);
    const notes: Note[] = [];
    const glide: GlidePoint[] = [];
    const isGlide = track.playMode === 'glide' && !isDrum(track.waveform);
    if (len <= 0) return { track, notes, glide };
    for (const w of windows) {
      for (let k = Math.floor(w.from / len + 1e-9); k * len < w.to - 1e-9; k++) {
        const r = renderTrack(track, project.song, k, false);
        if (isGlide) {
          r.curve.beat.forEach((b, i) => {
            const beat = k * len + b;
            if (beat < w.to - 1e-9) glide.push({ beat: w.base + beat, midi: r.curve.midi[i], velocity: r.curve.velocity[i] });
          });
          continue;
        }
        for (const n of r.notes) {
          const beat = k * len + n.beat;
          if (beat >= w.to - 1e-9) continue;
          notes.push({ ...n, beat: w.base + beat, duration: Math.min(n.duration, total - w.base - beat) });
        }
      }
    }
    return { track, notes, glide };
  });
}

export function exportBeats(project: Project): number {
  return songBeats(audibleTracks(project.tracks), project.song) * Math.max(1, project.song.exportLoops);
}

const tick = (beat: number) => Math.round(beat * PPQ);

function glideEvents(points: GlidePoint[], ch: number, total: number): Ev[] {
  const cc = (t: number, c: number, v: number): Ev => ({ tick: t, order: 0.5, bytes: [0xb0 | ch, c, v] });
  // RPN 0 = pitch-bend sensitivity, then null the RPN so later CC6 can't change it
  const evs: Ev[] = [cc(0, 101, 0), cc(0, 100, 0), cc(0, 6, BEND_RANGE), cc(0, 38, 0), cc(0, 101, 127), cc(0, 100, 127)];
  let base = -1;
  let lastBend = -1, lastExpr = -1;
  const bend = (t: number, semis: number) => {
    const v = Math.max(0, Math.min(16383, Math.round(8192 + (semis / BEND_RANGE) * 8192)));
    if (v === lastBend) return;
    lastBend = v;
    evs.push({ tick: t, order: 0.5, bytes: [0xe0 | ch, v & 0x7f, v >> 7] });
  };
  const off = (t: number) => {
    evs.push({ tick: t, order: 0, bytes: [0x80 | ch, base, 0] });
    base = -1;
  };
  for (const p of points) {
    const t = tick(p.beat);
    if (p.velocity < 0.01) {
      if (base >= 0) off(t);
      continue;
    }
    // retrigger when the slide wanders past the bend range
    if (base >= 0 && Math.abs(p.midi - base) > BEND_RANGE - 1) off(t);
    if (base < 0) {
      base = Math.round(p.midi);
      bend(t, p.midi - base);
      evs.push({ tick: t, order: 1, bytes: [0x90 | ch, base, 100] });
    } else bend(t, p.midi - base);
    const expr = Math.round(p.velocity * 127);
    if (Math.abs(expr - lastExpr) >= 2) {
      lastExpr = expr;
      evs.push(cc(t, 11, expr));
    }
  }
  if (base >= 0) off(tick(total));
  evs.push({ tick: tick(total), order: 0.5, bytes: [0xe0 | ch, 0, 64] }); // bend back to centre
  return evs;
}

export function exportMidi(project: Project): Uint8Array {
  const { song } = project;
  const all = collectNotes(project);
  const total = exportBeats(project);

  const minor = MINOR_SCALES.has(song.scale);
  const sf = MAJOR_SF[minor ? (song.root + 3) % 12 : song.root];
  const usPerBeat = Math.round(60_000_000 / song.bpm);
  const conductor = chunk([
    meta(0, 0x03, ascii(project.name || 'SoundFunc')),
    meta(0, 0x51, [(usPerBeat >> 16) & 0xff, (usPerBeat >> 8) & 0xff, usPerBeat & 0xff]),
    meta(0, 0x58, [4, 2, 24, 8]),
    meta(0, 0x59, [sf & 0xff, minor ? 1 : 0]),
  ]);

  let melodic = 0;
  const trackChunks = all.map(({ track, notes, glide }) => {
    const drum = isDrum(track.waveform);
    let ch = 9; // GM percussion
    if (!drum) {
      ch = melodic++ % 15;
      if (ch >= 9) ch++;
    }
    const evs: Ev[] = [meta(0, 0x03, ascii(track.name))];
    if (!drum) evs.push({ tick: 0, order: 0, bytes: [0xc0 | ch, GM_PROGRAM[track.waveform] ?? 0] });
    if (glide.length) evs.push(...glideEvents(glide, ch, total));
    for (const n of notes) {
      const on = tick(n.beat);
      const off = Math.max(on + 1, tick(n.beat + n.duration));
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
  const rows = [['track', 'type', 'beat', 'duration_beats', 'midi', 'note', 'freq_hz', 'velocity', 'key', 'loop', 'step']];
  const key = keyLabel(project.song);
  for (const t of collectNotes(project)) {
    for (const n of t.notes) {
      rows.push([
        t.track.name,
        isDrum(t.track.waveform) ? 'drum' : 'note',
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
    // glide tracks: one row per sample, fractional midi = exact pitch
    for (const p of t.glide) {
      rows.push([t.track.name, 'glide', p.beat.toFixed(4), '', p.midi.toFixed(3), '', (440 * Math.pow(2, (p.midi - 69) / 12)).toFixed(2), p.velocity.toFixed(3), key, '', '']);
    }
  }
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}
