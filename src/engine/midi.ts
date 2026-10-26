import { audibleTracks, isDrum, keyLabel, patternBeats, renderTrack, songBeats, songWindows, type Note, type Project, type Track, type Waveform } from './project';

export const PPQ = 480;
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

export interface Ev {
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
export function collectNotes(project: Project, from = 0, to = exportBeats(project), clipAtEnd = true): ExportTrack[] {
  const tracks = audibleTracks(project.tracks);
  const total = to;
  // the same song time playback uses: with "repeat exactly" each pass starts again
  const windows = songWindows(project.song, songBeats(tracks, project.song), from, to);
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
          // a file ends where it ends; a stretch of live playback lets notes ring on into the next
          notes.push({ ...n, beat: w.base + beat, duration: clipAtEnd ? Math.min(n.duration, total - w.base - beat) : n.duration });
        }
      }
    }
    return { track, notes, glide };
  });
}

export function exportBeats(project: Project): number {
  return songBeats(audibleTracks(project.tracks), project.song) * Math.max(1, project.song.exportLoops);
}

export const tick = (beat: number) => Math.round(beat * PPQ);

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

/**
 * How a curve becomes MIDI messages:
 * - lines: the fewest points that redraw it joined by straight lines — how a DAW draws an imported file's automation
 * - hold: a new value whenever it has moved more than a hair — how a synth hears MIDI live (each value holds until the next)
 * - full: every sample
 */
export type CurveStyle = 'lines' | 'hold' | 'full';

/** live, a value holds until the next: keep a point whenever the curve has moved `tol` from the last one kept */
export function holdCurve(ys: number[], tol: number): number[] {
  if (!ys.length) return [];
  const keep = [0];
  let last = ys[0];
  for (let i = 1; i < ys.length; i++) {
    if (Math.abs(ys[i] - last) >= tol) {
      keep.push(i);
      last = ys[i];
    }
  }
  if (keep[keep.length - 1] !== ys.length - 1) keep.push(ys.length - 1);
  return keep;
}

/**
 * Live, a steep stretch of a curve can move more between two samples than an ear forgives
 * (a "zipper"): fill in between, so no single step is bigger than `tol` — but never closer
 * together than 2 ticks, so a fast swoop can't flood the instrument.
 */
export function densify(ticks: number[], values: number[], tol: number): { ticks: number[]; values: number[] } {
  const t: number[] = [], v: number[] = [];
  for (let i = 0; i < ticks.length; i++) {
    if (i > 0) {
      const dt = ticks[i] - ticks[i - 1], dv = values[i] - values[i - 1];
      const n = Math.min(Math.floor(dt / 2), Math.ceil(Math.abs(dv) / tol) - 1);
      for (let j = 1; j <= n; j++) {
        t.push(ticks[i - 1] + Math.round((dt * j) / (n + 1)));
        v.push(values[i - 1] + (dv * j) / (n + 1));
      }
    }
    t.push(ticks[i]);
    v.push(values[i]);
  }
  return { ticks: t, values: v };
}

/** the points of a curve to send, in the given style (tolerances: `lines` the most it may stray, `hold` the smallest step) */
function keepPoints(xs: number[], ys: number[], tol: number, style: CurveStyle): number[] {
  if (style === 'lines') return simplifyCurve(xs, ys, tol);
  if (style === 'hold') return holdCurve(ys, tol * 0.6);
  return xs.map((_, i) => i);
}

export interface CurveStats {
  /** curve points (pitch bend + expression) before and after simplifying */
  raw: number;
  kept: number;
}

function glideEvents(points: GlidePoint[], ch: number, total: number, style: CurveStyle, stats: CurveStats, range: number): Ev[] {
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
    if (style === 'hold') {
      // live: fill in the steep stretches first, so the bend glides instead of stepping
      const d = densify(ph.t, ph.semis, CURVE_TOLERANCE.semis * 0.6);
      const e = densify(ph.t, ph.expr, CURVE_TOLERANCE.expr);
      bend(ph.t[0], ph.semis[0]);
      evs.push({ tick: ph.t[0], order: 1, bytes: [0x90 | ch, base, 100] });
      let kept = 0;
      for (const i of holdCurve(d.values, CURVE_TOLERANCE.semis * 0.6)) {
        const before = lastBend;
        bend(d.ticks[i], d.values[i]);
        if (lastBend !== before) kept++;
      }
      for (const i of holdCurve(e.values, 1)) {
        const expr = Math.round(e.values[i]);
        if (expr !== lastExpr) {
          lastExpr = expr;
          evs.push(cc(e.ticks[i], 11, expr));
          kept++;
        }
      }
      stats.kept += kept;
      off(ph.end ?? tick(total));
      continue;
    }
    const bi = keepPoints(ph.t, ph.semis, CURVE_TOLERANCE.semis, style);
    const ei = keepPoints(ph.t, ph.expr, CURVE_TOLERANCE.expr, style);
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
      if (style !== 'full' ? expr !== lastExpr : Math.abs(expr - lastExpr) >= 2) {
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
function curveEvents(ticks: number[], values: number[], tol: number, style: CurveStyle, encode: (v: number) => number, make: (tick: number, code: number) => Ev, stats: CurveStats, last = NaN): Ev[] {
  const out: Ev[] = [];
  stats.raw += ticks.length;
  if (style === 'hold') ({ ticks, values } = densify(ticks, values, tol * 0.6));
  const keep = keepPoints(ticks, values, tol, style);
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
function mpeEvents(program: number, notes: Note[], glide: GlidePoint[], total: number, style: CurveStyle, stats: CurveStats, range: number): Ev[] {
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
    evs.push(...curveEvents(ticks, n.bend, EXPR_TOLERANCE.semis, style, bendCode(range), (t, v) => bendEv(ch, t === n.on ? 0.7 : 0.5)(t, v), stats));
    evs.push(...curveEvents(ticks, n.pressure, EXPR_TOLERANCE.unit, style, unit127, (t, v) => pressEv(ch, t === n.on ? 0.7 : 0.5)(t, v), stats));
    evs.push(...curveEvents(ticks, n.slide, EXPR_TOLERANCE.unit, style, unit127, (t, v) => slideEv(ch, t === n.on ? 0.7 : 0.5)(t, v), stats));
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
function channelExpression(notes: Note[], ch: number, style: CurveStyle, stats: CurveStats, range: number): Ev[] {
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
      evs.push(...curveEvents(ticks, e.bend, EXPR_TOLERANCE.semis, style, bendCode(range), (t, v) => bendEv(ch, t === on ? 0.7 : 0.5)(t, v), stats));
      // centred as the note ends: after its own last bend (0.5), before the next note's first (0.7)
      evs.push(bendEv(ch, 0.65)(Math.max(on + 1, tick(n.beat + n.duration)), 8192));
    }
    if (e.pressure.some((p) => p !== 1)) evs.push(...curveEvents(ticks, e.pressure, EXPR_TOLERANCE.unit, style, unit127, (t, v) => pressEv(ch, 0.6)(t, v), stats));
    if (e.slide.some((s) => s !== 0.5)) evs.push(...curveEvents(ticks, e.slide, EXPR_TOLERANCE.unit, style, unit127, (t, v) => slideEv(ch, 0.6)(t, v), stats));
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

/** one channel's MIDI events over a stretch of song time: absolute ticks, sorted the MIDI way */
export interface ChannelEvents {
  track: Track;
  /** the MIDI channel (0–15) its notes use (MPE spreads over a zone instead) */
  ch: number;
  events: Ev[];
}

/**
 * Every audible channel's MIDI events between `from` and `to` (beats of song time) — what a
 * MIDI file holds, and what the Max for Live device plays, in the given mode. Ticks are
 * absolute (480 per beat from the song's start). `clipAtEnd`: notes stop at `to` (a file),
 * or ring on into whatever comes next (live playback).
 */
export function windowEvents(
  project: Project,
  mode: MidiMode,
  from: number,
  to: number,
  stats: CurveStats = { raw: 0, kept: 0 },
  clipAtEnd = true,
  /** files: the song's Curves setting (lines, or every sample); the live device: hold */
  style: CurveStyle = project.song.exportCurves === 'full' ? 'full' : 'lines',
): ChannelEvents[] {
  const { song } = project;
  const all = collectNotes(project, from, to, clipAtEnd);
  const total = to;
  let melodic = 0;
  return all.map(({ track, notes, glide }) => {
    const drum = isDrum(track.waveform);
    let ch = 9; // GM percussion
    if (!drum) {
      ch = melodic++ % 15;
      if (ch >= 9) ch++;
    }
    const evs: Ev[] = [];
    const t0 = tick(from);
    // notes only: no automation at all — a glide becomes the notes it passes through
    if (mode === 'notes') {
      if (!drum) evs.push({ tick: t0, order: 0, bytes: [0xc0 | ch, GM_PROGRAM[track.waveform] ?? 0] });
      for (const n of [...notes, ...glideAsNotes(glide, total)]) {
        const on = tick(n.beat);
        const off = Math.max(on + 1, tick(n.beat + n.duration));
        const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
        evs.push({ tick: on, order: 1, bytes: [0x90 | ch, n.midi, vel] }, { tick: off, order: 0, bytes: [0x80 | ch, n.midi, 0] });
      }
      return { track, ch, events: evs };
    }
    // MPE: every note on its own channel of a 15-channel zone, with its own bend, pressure and slide
    if (!drum && mode === 'mpe') {
      evs.push(...mpeEvents(GM_PROGRAM[track.waveform] ?? 0, notes, glide, total, style, stats, rangeOf(song.mpeBendRange, 48)).map((e) => (e.tick === 0 ? { ...e, tick: t0 } : e)));
      return { track, ch, events: evs };
    }
    if (!drum) evs.push({ tick: t0, order: 0, bytes: [0xc0 | ch, GM_PROGRAM[track.waveform] ?? 0] });
    if (glide.length) evs.push(...glideEvents(glide, ch, total, style, stats, rangeOf(song.bendRange, 24)).map((e) => (e.tick === 0 ? { ...e, tick: t0 } : e)));
    // without MPE, per-note expression goes out on the channel (exact for one note at a time)
    if (!drum && notes.some((n) => n.expr)) evs.push(...channelExpression(notes, ch, style, stats, rangeOf(song.bendRange, 24)).map((e) => (e.tick === 0 ? { ...e, tick: t0 } : e)));
    for (const n of notes) {
      const on = tick(n.beat);
      const off = Math.max(on + 1, tick(n.beat + n.duration));
      const vel = Math.max(1, Math.min(127, Math.round(n.velocity * 127)));
      evs.push({ tick: on, order: 1, bytes: [0x90 | ch, n.midi, vel] });
      evs.push({ tick: off, order: 0, bytes: [0x80 | ch, n.midi, 0] });
    }
    return { track, ch, events: evs };
  });
}

export function exportMidi(project: Project, stats: CurveStats = { raw: 0, kept: 0 }, mode: MidiMode = project.song.exportMidi ?? 'standard'): Uint8Array {
  const { song } = project;
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
  const trackChunks = windowEvents(project, mode, 0, total, stats).map(({ track, events }) => chunk([meta(0, 0x03, ascii(track.name)), ...events]));
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
