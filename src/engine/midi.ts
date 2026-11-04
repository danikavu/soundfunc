import { audibleTracks, isDrum, keyLabel, patternBeats, renderTrack, songBeats, songWindows, type Note, type Project, type Song, type Track, type Waveform } from './project';

const PPQ = 480;
/** the pitch-bend ranges we offer: the instrument receiving the file must be set to the same */
export const BEND_RANGES = [2, 5, 7, 12, 24, 48] as const;
export const MPE_BEND_RANGES = [24, 48, 96] as const;
/** a bend range in semitones, or the fallback if the setting is missing or nonsense */
const rangeOf = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 1 && v <= 96 ? v : fallback);

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
  supersaw: 81, // saw lead
  keys: 4, // electric piano 1
  brass: 61, // brass section
  acid: 39, // synth bass 2
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

/** how far a simplified curve may stray from the real one: pitch in semitones, expression in CC steps */
export const CURVE_TOLERANCE = { semis: 0.03, expr: 1.5 };

/**
 * The fewest points that redraw a curve when joined by straight lines (as DAWs draw
 * automation), never straying more than `tol` from it — Ramer–Douglas–Peucker, measuring
 * the vertical error at each sample. Corners always survive; straight runs collapse.
 */
export function simplifyCurve(xs: number[], ys: number[], tol: number): number[] {
  const n = xs.length;
  if (n <= 2) return xs.map((_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1, err = tol;
    for (let i = a + 1; i < b; i++) {
      const line = xs[b] === xs[a] ? ys[a] : ys[a] + ((ys[b] - ys[a]) * (xs[i] - xs[a])) / (xs[b] - xs[a]);
      const e = Math.abs(ys[i] - line);
      if (e > err) (err = e), (worst = i);
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

export interface CurveStats {
  /** curve points (pitch bend + expression) before and after simplifying */
  raw: number;
  kept: number;
}

function glideEvents(points: GlidePoint[], ch: number, total: number, simplify: boolean, stats: CurveStats, range: number): Ev[] {
  const cc = (t: number, c: number, v: number): Ev => ({ tick: t, order: 0.5, bytes: [0xb0 | ch, c, v] });
  // RPN 0 = pitch-bend sensitivity, then null the RPN so later CC6 can't change it
  const evs: Ev[] = [cc(0, 101, 0), cc(0, 100, 0), cc(0, 6, range), cc(0, 38, 0), cc(0, 101, 127), cc(0, 100, 127)];
  let base = -1;
  let lastBend = -1, lastExpr = -1;
  const bend = (t: number, semis: number) => {
    const v = bendCode(range)(semis);
    if (v === lastBend) return;
    lastBend = v;
    evs.push({ tick: t, order: 0.5, bytes: [0xe0 | ch, v & 0x7f, v >> 7] });
  };
  const off = (t: number) => {
    evs.push({ tick: t, order: 0, bytes: [0x80 | ch, base, 0] });
    base = -1;
  };
  // phrases: the stretches one note holds (between its note-on and note-off), each with its bend and expression samples
  const phrases: { t: number[]; semis: number[]; expr: number[]; base: number; end: number | null }[] = [];
  let cur: (typeof phrases)[number] | null = null;
  for (const p of points) {
    const t = tick(p.beat);
    if (p.velocity < 0.01) {
      if (cur) (cur.end = t), (cur = null);
      continue;
    }
    // retrigger when the slide wanders past the bend range
    // retrigger before the slide leaves the bend range (a new note starts within half a semitone of it)
    if (cur && Math.abs(p.midi - cur.base) > range - 0.5) (cur.end = t), (cur = null);
    if (!cur) phrases.push((cur = { t: [], semis: [], expr: [], base: Math.round(p.midi), end: null }));
    cur.t.push(t);
    cur.semis.push(p.midi - cur.base);
    cur.expr.push(p.velocity * 127);
  }
  for (const ph of phrases) {
    base = ph.base;
    const n = ph.t.length;
    stats.raw += 2 * n;
    // each curve keeps only the points that redraw it (or every sample, if asked)
    const bi = simplify ? simplifyCurve(ph.t, ph.semis, CURVE_TOLERANCE.semis) : ph.t.map((_, i) => i);
    const ei = simplify ? simplifyCurve(ph.t, ph.expr, CURVE_TOLERANCE.expr) : ph.t.map((_, i) => i);
    bend(ph.t[0], ph.semis[0]);
    evs.push({ tick: ph.t[0], order: 1, bytes: [0x90 | ch, base, 100] });
    let kept = 0;
    for (const i of bi) {
      const before = lastBend;
      bend(ph.t[i], ph.semis[i]);
      if (lastBend !== before) kept++;
    }
    for (const i of ei) {
      const expr = Math.round(ph.expr[i]);
      if (simplify ? expr !== lastExpr : Math.abs(expr - lastExpr) >= 2) {
        lastExpr = expr;
        evs.push(cc(ph.t[i], 11, expr));
        kept++;
      }
    }
    stats.kept += kept;
    off(ph.end ?? tick(total));
  }
  evs.push({ tick: tick(total), order: 0.5, bytes: [0xe0 | ch, 0, 64] }); // bend back to centre
  return evs;
}

// ---------- per-note expression ----------

const EXPR_TOLERANCE = { semis: CURVE_TOLERANCE.semis, unit: 1.5 / 127 };

/**
 * Write one curve as MIDI events at the given ticks: simplified to the points that redraw it
 * (or every sample), quantised by `encode`, and never repeating a value.
 */
function curveEvents(ticks: number[], values: number[], tol: number, simplify: boolean, encode: (v: number) => number, make: (tick: number, code: number) => Ev, stats: CurveStats, last = NaN): Ev[] {
  const out: Ev[] = [];
  stats.raw += ticks.length;
  const keep = simplify ? simplifyCurve(ticks, values, tol) : ticks.map((_, i) => i);
  for (const i of keep) {
    const code = encode(values[i]);
    if (code === last) continue;
    last = code;
    out.push(make(ticks[i], code));
  }
  stats.kept += out.length;
  return out;
}

const bendCode = (range: number) => (semis: number) => Math.max(0, Math.min(16383, Math.round(8192 + (semis / range) * 8192)));
const unit127 = (v: number) => Math.max(0, Math.min(127, Math.round(v * 127)));
const bendEv = (ch: number, order: number) => (tick: number, v: number): Ev => ({ tick, order, bytes: [0xe0 | ch, v & 0x7f, v >> 7] });
const pressEv = (ch: number, order: number) => (tick: number, v: number): Ev => ({ tick, order, bytes: [0xd0 | ch, v] });
const slideEv = (ch: number, order: number) => (tick: number, v: number): Ev => ({ tick, order, bytes: [0xb0 | ch, 74, v] });
const rpn = (ch: number, lsb: number, value: number): Ev[] =>
  [
    [101, 0],
    [100, lsb],
    [6, value],
    [38, 0],
    [101, 127],
    [100, 127],
  ].map(([c, v]) => ({ tick: 0, order: 0.4, bytes: [0xb0 | ch, c, v] }));

/** a note, or a glide phrase, with its expression over its life (ticks from its start) */
interface ExprNote {
  on: number;
  off: number;
  midi: number;
  vel: number;
  at: number[];
  bend: number[];
  pressure: number[];
  slide: number[];
}

/**
 * MPE (lower zone): channel 1 is the master, 2–16 are members, each bending ±48. Each note
 * takes the member channel that has been free longest, so overlapping notes and chords
 * bend, press and slide independently. Glides become one long note per phrase.
 */
function mpeEvents(program: number, notes: Note[], glide: GlidePoint[], total: number, simplify: boolean, stats: CurveStats, range: number): Ev[] {
  const evs: Ev[] = [...rpn(0, 6, 15)]; // MPE Configuration Message: 15 member channels
  for (let ch = 1; ch <= 15; ch++) evs.push(...rpn(ch, 0, range), { tick: 0, order: 0.45, bytes: [0xc0 | ch, program] });
  const list: ExprNote[] = [
    ...notes.map((n) => {
      const on = tick(n.beat), off = Math.max(on + 1, tick(n.beat + n.duration));
      const e = n.expr;
      return {
        on,
        off,
        midi: n.midi,
        vel: Math.max(1, Math.min(127, Math.round(n.velocity * 127))),
        at: e ? e.at.map((a) => tick(n.beat + a) - on) : [0],
        bend: e?.bend ?? [0],
        pressure: e?.pressure ?? [1],
        slide: e?.slide ?? [0.5],
      };
    }),
    ...gliding(glide, total, range - 0.5),
  ].sort((a, b) => a.on - b.on);
  const freeAt = new Array<number>(16).fill(-Infinity);
  for (const n of list) {
    // the member channel free the longest (or, if every one is busy, the one that frees first)
    let ch = 1;
    for (let c = 2; c <= 15; c++) if (freeAt[c] < freeAt[ch]) ch = c;
    freeAt[ch] = n.off;
    const ticks = n.at.map((a) => n.on + Math.min(a, n.off - n.on));
    // the note's state is set just before it sounds (order 0.7), then follows its curves
    evs.push(...curveEvents(ticks, n.bend, EXPR_TOLERANCE.semis, simplify, bendCode(range), (t, v) => bendEv(ch, t === n.on ? 0.7 : 0.5)(t, v), stats));
    evs.push(...curveEvents(ticks, n.pressure, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => pressEv(ch, t === n.on ? 0.7 : 0.5)(t, v), stats));
    evs.push(...curveEvents(ticks, n.slide, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => slideEv(ch, t === n.on ? 0.7 : 0.5)(t, v), stats));
    evs.push({ tick: n.on, order: 1, bytes: [0x90 | ch, n.midi, n.vel] }, { tick: n.off, order: 0, bytes: [0x80 | ch, n.midi, 0] });
  }
  return evs;
}

/** a glide's sounding stretches as notes: base note, bend away from it, pressure from its volume */
function gliding(points: GlidePoint[], total: number, reach: number): ExprNote[] {
  const out: ExprNote[] = [];
  let cur: ExprNote | null = null;
  const close = (t: number) => cur && ((cur.off = Math.max(cur.on + 1, t)), (cur = null));
  for (const p of points) {
    const t = tick(p.beat);
    if (p.velocity < 0.01) {
      close(t);
      continue;
    }
    if (cur && Math.abs(p.midi - cur.midi) > reach) close(t);
    if (!cur) out.push((cur = { on: t, off: tick(total), midi: Math.round(p.midi), vel: Math.max(1, Math.round(p.velocity * 127)), at: [], bend: [], pressure: [], slide: [] }));
    cur.at.push(t - cur.on);
    cur.bend.push(p.midi - cur.midi);
    cur.pressure.push(p.velocity);
    cur.slide.push(0.5);
  }
  return out;
}

/** without MPE: each note's bend / pressure / slide on the channel, the bend centred again as it ends */
function channelExpression(notes: Note[], ch: number, simplify: boolean, stats: CurveStats, range: number): Ev[] {
  const evs: Ev[] = [];
  const anyBend = notes.some((n) => n.expr?.bend.some((b) => b !== 0));
  if (anyBend) evs.push(...rpn(ch, 0, range));
  const seen = new Set<Note['expr']>();
  for (const n of notes) {
    const e = n.expr;
    if (!e || seen.has(e)) continue; // a chord's notes share one expression
    seen.add(e);
    const on = tick(n.beat);
    const ticks = e.at.map((a) => tick(n.beat + a));
    if (anyBend) {
      evs.push(...curveEvents(ticks, e.bend, EXPR_TOLERANCE.semis, simplify, bendCode(range), (t, v) => bendEv(ch, t === on ? 0.7 : 0.5)(t, v), stats));
      // centred as the note ends: after its own last bend (0.5), before the next note's first (0.7)
      evs.push(bendEv(ch, 0.65)(Math.max(on + 1, tick(n.beat + n.duration)), 8192));
    }
    if (e.pressure.some((p) => p !== 1)) evs.push(...curveEvents(ticks, e.pressure, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => pressEv(ch, 0.6)(t, v), stats));
    if (e.slide.some((s) => s !== 0.5)) evs.push(...curveEvents(ticks, e.slide, EXPR_TOLERANCE.unit, simplify, unit127, (t, v) => slideEv(ch, 0.6)(t, v), stats));
  }
  return evs;
}

/**
 * What a MIDI file carries:
 * - notes: notes only — glides become stepped notes, no bends or controllers
 * - standard: notes plus automation on one channel per SoundFunc channel (pitch bend, expression, pressure, CC74)
 * - mpe: notes plus per-note automation, each note on its own channel (MPE)
 */
export type MidiMode = 'notes' | 'standard' | 'mpe';

/** a glide as plain notes: a new note each time the slide reaches another semitone, or after a rest */
function glideAsNotes(points: GlidePoint[], total: number): Note[] {
  const out: Note[] = [];
  let cur: Note | null = null;
  const close = (beat: number) => {
    if (cur) cur.duration = Math.max(0.01, beat - cur.beat);
    cur = null;
  };
  for (const p of points) {
    if (p.velocity < 0.01) {
      close(p.beat);
      continue;
    }
    const midi = Math.round(p.midi);
    if (cur && midi === cur.midi) continue;
    close(p.beat);
    cur = { step: 0, loop: 0, beat: p.beat, duration: 0, midi, name: '', freq: 0, velocity: p.velocity, raw: 0, tune: 0, key: '', h: 0 };
    out.push(cur);
  }
  close(total);
  return out;
}

export function exportMidi(project: Project, stats: CurveStats = { raw: 0, kept: 0 }, mode: MidiMode = project.song.exportMidi ?? 'standard'): Uint8Array {
  return writeMidi(project.name, project.song, collectNotes(project), exportBeats(project), [{ beat: 0, bpm: project.song.bpm }], stats, mode);
}

/** a tempo from `beat` on — a jam can change tempo as it goes */
export interface TempoMark {
  beat: number;
  bpm: number;
}

/**
 * A type-1 MIDI file of `all` (notes and glides in absolute beats, 0 … total): a conductor track
 * with the name, tempo map, 4/4 and the key, then one track per channel.
 */
export function writeMidi(name: string, song: Song, all: ExportTrack[], total: number, tempos: TempoMark[], stats: CurveStats = { raw: 0, kept: 0 }, mode: MidiMode = 'standard'): Uint8Array {
  const minor = MINOR_SCALES.has(song.scale);
  const sf = MAJOR_SF[minor ? (song.root + 3) % 12 : song.root];
  const tempo = (beat: number, bpm: number) => {
    const us = Math.round(60_000_000 / bpm);
    return meta(tick(beat), 0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]);
  };
  const conductor = chunk([
    meta(0, 0x03, ascii(name || 'SoundFunc')),
    ...(tempos.length ? tempos : [{ beat: 0, bpm: song.bpm }]).map((t) => tempo(t.beat, t.bpm)),
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
    const simplify = song.exportCurves !== 'full';
    // notes only: no automation at all — a glide becomes the notes it passes through
    if (mode === 'notes') {
      if (!drum) evs.push({ tick: 0, order: 0, bytes: [0xc0 | ch, GM_PROGRAM[track.waveform] ?? 0] });
      for (const n of [...notes, ...glideAsNotes(glide, total)]) {
        const on = tick(n.beat);
        const off = Math.max(on + 1, tick(n.beat + n.duration));
        const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
        evs.push({ tick: on, order: 1, bytes: [0x90 | ch, n.midi, vel] }, { tick: off, order: 0, bytes: [0x80 | ch, n.midi, 0] });
      }
      return chunk(evs);
    }
    // MPE: every note on its own channel of a 15-channel zone, with its own bend, pressure and slide
    if (!drum && mode === 'mpe') {
      evs.push(...mpeEvents(GM_PROGRAM[track.waveform] ?? 0, notes, glide, total, simplify, stats, rangeOf(song.mpeBendRange, 48)));
      return chunk(evs);
    }
    if (!drum) evs.push({ tick: 0, order: 0, bytes: [0xc0 | ch, GM_PROGRAM[track.waveform] ?? 0] });
    if (glide.length) evs.push(...glideEvents(glide, ch, total, simplify, stats, rangeOf(song.bendRange, 24)));
    // without MPE, per-note expression goes out on the channel (exact for one note at a time)
    if (!drum && notes.some((n) => n.expr)) evs.push(...channelExpression(notes, ch, simplify, stats, rangeOf(song.bendRange, 24)));
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
