/**
 * MIDI → functions. A Standard MIDI File is read, its structure found — the grid each part plays
 * on (and its swing), the key and the best-fitting mode, the chord of every bar — and every part
 * is written as a channel of formulas, as compact as the music allows:
 *
 *   rhythms   → bits(0x…, n) masks, with velocity levels as multipliers
 *   pitches   → scale degrees, or degrees above the chord (h + …) when that is simpler
 *               — a bass on the roots becomes just h
 *   loops     → each part cut to its own shortest repeating length (pick wraps around)
 *   chords    → stacked scale chords become one channel with chord / inversion / strum
 *   the feel  → each note's distance from the grid kept as shift (or the part's swing)
 *   drums     → GM drum notes onto the drum voices, toms and percussion tuned
 *
 * Pure: bytes in, a kit-shaped result out (tracks as templates, the song it needs, and a report).
 */
import { NODE_DEFS, type GEdge, type GNode, type NodeData } from './graph';
import { euclid } from './expr';
import { degreeToMidi, midiToDegree, SCALES, spellDegree } from './music';
import { BEATS_PER_BAR, type DrumVoice, type Song, type Track, type Waveform } from './project';
import type { SynthParams } from './synth';
import { WAVE_VOICES } from './timbre';
import { layoutGraph, voicedInversion, voicedPitch } from './presets';

// ---------- reading the file ----------

export interface MidiNote {
  /** start and end in beats */
  beat: number;
  end: number;
  midi: number;
  /** 1 … 127 */
  vel: number;
}
export interface MidiPart {
  name: string;
  /** 0 … 15 (9 = GM drums) */
  channel: number;
  /** GM program 0 … 127, if the part set one */
  program: number | null;
  notes: MidiNote[];
}
export interface MidiFileData {
  name: string;
  bpm: number;
  /** more than one tempo in the file (only the first is used) */
  tempoChanges: number;
  timeSig: [number, number];
  /** sharps (+) / flats (−), and minor */
  keySig: { sf: number; minor: boolean } | null;
  parts: MidiPart[];
}

export function parseMidi(bytes: Uint8Array): MidiFileData {
  let pos = 0;
  const u8 = () => {
    if (pos >= bytes.length) throw new Error('The MIDI file ends too early');
    return bytes[pos++];
  };
  const u16 = () => (u8() << 8) | u8();
  const u32 = () => ((u8() << 24) >>> 0) + (u8() << 16) + (u8() << 8) + u8();
  const str = (n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(u8());
    return s;
  };
  const vlq = () => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const b = u8();
      v = (v << 7) | (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    return v;
  };

  if (str(4) !== 'MThd') throw new Error('Not a MIDI file (no MThd header)');
  const hlen = u32();
  const format = u16();
  const ntrks = u16();
  const division = u16();
  pos += hlen - 6;
  if (division & 0x8000) throw new Error('This MIDI file counts time in SMPTE frames, which isn’t supported');
  const ppq = division || 480;
  if (format > 1) throw new Error('MIDI format 2 (independent sequences) isn’t supported');

  const tempos: { tick: number; bpm: number }[] = [];
  let timeSig: [number, number] = [4, 4];
  let keySig: MidiFileData['keySig'] = null;
  let fileName = '';
  // notes per track and channel; names and programs per track and channel
  const groups = new Map<string, MidiPart>();
  const partOf = (trk: number, ch: number, trackName: string) => {
    const key = `${trk}:${ch}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { name: trackName, channel: ch, program: null, notes: [] }));
    return g;
  };
  const raw: { trk: number; ch: number; tick: number; end: number; midi: number; vel: number }[] = [];
  const names: string[] = [];
  const programs = new Map<string, number>();

  for (let t = 0; t < ntrks && pos < bytes.length; t++) {
    const id = str(4);
    const len = u32();
    const stop = pos + len;
    if (id !== 'MTrk') {
      pos = stop;
      continue;
    }
    let tick = 0;
    let status = 0;
    const open = new Map<string, { tick: number; vel: number }[]>();
    names[t] = '';
    while (pos < stop) {
      tick += vlq();
      let b = u8();
      if (b === 0xff) {
        const type = u8();
        const n = vlq();
        const at = pos;
        if (type === 0x03 || type === 0x01) {
          const s = str(n).replace(/\0/g, '').trim();
          if (type === 0x03 && !names[t]) names[t] = s;
          if (type === 0x03 && t === 0 && !fileName) fileName = s;
        } else if (type === 0x51 && n === 3) {
          const us = (u8() << 16) | (u8() << 8) | u8();
          tempos.push({ tick, bpm: 60_000_000 / us });
        } else if (type === 0x58 && n >= 2) {
          timeSig = [u8(), 2 ** u8()];
        } else if (type === 0x59 && n === 2) {
          const sf = (u8() << 24) >> 24;
          keySig = { sf, minor: u8() === 1 };
        } else if (type === 0x2f) {
          pos = at + n;
          break;
        }
        pos = at + n;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        pos += vlq();
        continue;
      }
      if (b & 0x80) status = b;
      else pos--; // running status: this byte is data
      b = status;
      const kind = b & 0xf0, ch = b & 0x0f;
      if (kind === 0x80 || kind === 0x90) {
        const midi = u8(), vel = u8();
        const key = `${ch}:${midi}`;
        if (kind === 0x90 && vel > 0) {
          if (!open.has(key)) open.set(key, []);
          open.get(key)!.push({ tick, vel });
        } else {
          const on = open.get(key)?.shift();
          if (on) raw.push({ trk: t, ch, tick: on.tick, end: tick, midi, vel: on.vel });
        }
      } else if (kind === 0xc0) {
        const p = u8();
        if (!programs.has(`${t}:${ch}`)) programs.set(`${t}:${ch}`, p);
      } else if (kind === 0xd0) u8();
      else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
        u8();
        u8();
      }
    }
    // notes still held at the end of the track end there
    for (const [key, ons] of open) for (const on of ons) raw.push({ trk: t, ch: Number(key.split(':')[0]), tick: on.tick, end: tick, midi: Number(key.split(':')[1]), vel: on.vel });
    pos = stop;
  }

  for (const r of raw) {
    const g = partOf(r.trk, r.ch, names[r.trk] || '');
    g.notes.push({ beat: r.tick / ppq, end: Math.max(r.tick + 1, r.end) / ppq, midi: r.midi, vel: r.vel });
  }
  for (const [key, g] of groups) {
    if (programs.has(key)) g.program = programs.get(key)!;
    g.notes.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  }
  const parts = [...groups.values()].filter((g) => g.notes.length);
  // a part with no name of its own: its instrument's
  for (const g of parts) if (!g.name) g.name = g.channel === 9 ? 'Drums' : g.program !== null ? GM_NAMES[g.program >> 3] : 'Part';
  return {
    name: fileName,
    bpm: tempos.length ? Math.round(tempos[0].bpm * 10) / 10 : 120,
    tempoChanges: new Set(tempos.map((t) => Math.round(t.bpm))).size,
    timeSig,
    keySig,
    parts,
  };
}

const GM_NAMES = ['Piano', 'Mallets', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass', 'Reed', 'Pipe', 'Lead', 'Pad', 'Synth FX', 'Ethnic', 'Percussion', 'FX'];

// ---------- the key ----------

const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const MODES = ['major', 'minor', 'dorian', 'mixolydian', 'harmonicMinor', 'phrygian', 'lydian'] as const;

function corr(a: number[], b: number[]) {
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) (num += (a[i] - ma) * (b[i] - mb)), (da += (a[i] - ma) ** 2), (db += (b[i] - mb) ** 2);
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** the key: Krumhansl–Schmuckler for the tonic, then the mode that holds most of the notes */
export function findKey(notes: MidiNote[], keySig: MidiFileData['keySig']): { root: number; scale: string; outside: number } {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[n.midi % 12] += Math.min(4, n.end - n.beat) + 0.25;
  const total = hist.reduce((s, x) => s + x, 0) || 1;
  let best = { root: 0, minor: false, r: -2 };
  for (let root = 0; root < 12; root++)
    for (const minor of [false, true]) {
      const prof = minor ? KS_MINOR : KS_MAJOR;
      let r = corr(hist, prof.map((_, i) => prof[(i - root + 12) % 12]));
      // the file's own key signature, when it agrees, settles a close call
      if (keySig) {
        const sigRoot = (((keySig.sf * 7) % 12) + 12 + (keySig.minor ? 9 : 0)) % 12;
        if (sigRoot === root && keySig.minor === minor) r += 0.05;
      }
      if (r > best.r) best = { root, minor, r };
    }
  // a major key and its relative minor share every note: the lowest note of the opening bar decides
  const start = Math.min(...notes.map((x) => x.beat));
  const opening = notes.filter((n) => n.beat < start + BEATS_PER_BAR);
  const bass = opening.length ? opening.reduce((a, b) => (b.midi < a.midi ? b : a)).midi % 12 : -1;
  const relative = best.minor ? { root: (best.root + 3) % 12, minor: false } : { root: (best.root + 9) % 12, minor: true };
  if (bass === relative.root && bass !== best.root) best = { ...relative, r: best.r };
  const fit = (scale: string) => SCALES[scale].steps.reduce((s, st) => s + hist[(best.root + st) % 12], 0) / total;
  // a mode built on the tonic, preferring plain major / minor when another fits no better
  let scale: string = best.minor ? 'minor' : 'major';
  for (const m of MODES) if (fit(m) > fit(scale) + 0.015) scale = m;
  return { root: best.root, scale, outside: 1 - fit(scale) };
}

// ---------- the chords ----------

/** the chord of each bar: the diatonic triad that holds most of the bar's sound (the bass counts double) */
function findHarmony(notes: MidiNote[], bars: number, root: number, scale: string): number[] {
  const steps = SCALES[scale].steps;
  const out: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const a = bar * BEATS_PER_BAR, b = a + BEATS_PER_BAR;
    const w = new Array(12).fill(0);
    let lowest = Infinity, lowPc = -1;
    for (const n of notes) {
      const s = Math.max(a, n.beat), e = Math.min(b, n.end);
      if (e <= s) continue;
      w[n.midi % 12] += e - s;
      if (n.midi < lowest) (lowest = n.midi), (lowPc = n.midi % 12);
    }
    if (lowPc >= 0) w[lowPc] += 1;
    let bestD = out.length ? out[out.length - 1] : 0, bestS = -1;
    for (let d = 0; d < steps.length; d++) {
      const pcs = [0, 2, 4].map((k) => (root + steps[(d + k) % steps.length]) % 12);
      // the root counts most, then the fifth, then the third
      const s = w[pcs[0]] * 1.2 + w[pcs[1]] * 0.9 + w[pcs[2]] * 1.0 - 0.15 * w.reduce((t, x, pc) => t + (pcs.includes(pc) ? 0 : x), 0);
      if (s > bestS + 1e-9) (bestS = s), (bestD = d);
    }
    out.push(bestD);
  }
  return out;
}

// ---------- the grid ----------

const GRIDS = [0.25, 1 / 3, 0.125, 1 / 6, 1 / 12];
const GRID_LABEL = new Map<number, string>([[0.25, '1/16'], [1 / 3, '1/8 triplet'], [0.125, '1/32'], [1 / 6, '1/16 triplet'], [1 / 12, '1/32 triplet']]);

/** where a note sits on a grid: its step, how late it is (0 … 0.95 of a step) */
function place(beat: number, g: number) {
  const u = beat / g;
  // early by under a third of a step: that step; earlier: the step before, played late
  let step = Math.floor(u + 0.33);
  let shift = u - step;
  if (shift < 0) {
    step -= 1;
    shift += 1;
  }
  if (shift > 0.95) shift = 0.95;
  return { step, shift };
}

/**
 * Strikes: notes that start within a hair of each other are one strike — a chord, even a strummed
 * or slightly loose one. The grid and the steps are found from strikes, so a rolled chord stays a
 * chord on one step.
 */
const STRIKE = 0.06;
function strikes(notes: MidiNote[]): { beat: number; notes: MidiNote[] }[] {
  const out: { beat: number; notes: MidiNote[] }[] = [];
  for (const n of notes.slice().sort((a, b) => a.beat - b.beat)) {
    const last = out[out.length - 1];
    if (last && n.beat - last.beat < STRIKE && !last.notes.some((m) => m.midi === n.midi)) last.notes.push(n);
    else out.push({ beat: n.beat, notes: [n] });
  }
  return out;
}

/**
 * The coarsest grid the part sits on, and its swing. A note late of its step is feel (it is kept as
 * shift); what calls for a finer grid is notes that land a third or two thirds of the way between
 * steps — triplets, or a finer subdivision. Swung off-steps are measured from step + swing.
 */
function findGrid(all: MidiNote[], songSwing = 0): { g: number; swing: number } {
  const hits = strikes(all).map((s) => s.beat);
  let best = { g: GRIDS[GRIDS.length - 1], swing: 0, between: Infinity };
  for (const g of GRIDS) {
    // the first strike of each step only: more inside one step is a roll (a ratchet)
    const seen = new Set<number>();
    const res: { step: number; r: number }[] = [];
    for (const beat of hits) {
      const { step, shift } = place(beat, g);
      if (seen.has(step)) continue;
      seen.add(step);
      res.push({ step, r: shift });
    }
    const odd = res.filter((x) => x.step % 2 !== 0).map((x) => x.r).sort((a, b) => a - b);
    const med = odd.length >= 4 ? odd[Math.floor(odd.length / 2)] : 0;
    // too few off-steps of its own to tell: the swing the whole file plays with
    const own = odd.length >= 4 ? med : songSwing;
    const swing = g === 0.25 || g === 0.125 ? (own > 0.06 && own < 0.6 ? own : 0) : 0;
    const between = res.filter((x) => {
      const r = x.r - (x.step % 2 !== 0 ? swing : 0);
      return r > 0.3 && r < 0.72;
    }).length / Math.max(1, res.length);
    if (between <= 0.04) return { g, swing };
    if (between < best.between - 0.02) best = { g, swing, between };
  }
  return { g: best.g, swing: best.swing };
}

// ---------- writing lists as formulas ----------

const num = (x: number, d = 2) => {
  const s = (Math.round(x * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

/** the shortest period of a list (pick wraps around, so a period is all it needs) */
function period<T>(xs: T[], eq: (a: T, b: T) => boolean = (a, b) => a === b): number {
  for (let p = 1; p < xs.length; p++) {
    if (xs.length % p) continue;
    let ok = true;
    for (let i = p; i < xs.length && ok; i++) ok = eq(xs[i], xs[i - p]);
    if (ok) return p;
  }
  return xs.length;
}

/** a step list as a formula: a constant, or pick over blocks of steps — always the shortest it can be */
function listFormula(xs: number[], fmt: (x: number) => string = (x) => num(x)): string {
  const p = period(xs, (a, b) => Math.abs(a - b) < 1e-6);
  const v = xs.slice(0, p);
  if (v.every((x) => Math.abs(x - v[0]) < 1e-6)) return fmt(v[0]);
  // the largest block of steps that never changes inside: pick(floor(n / b), …)
  let block = 1;
  for (let b = p; b > 1; b--) {
    if (p % b) continue;
    let ok = true;
    for (let i = 0; i < p && ok; i++) ok = Math.abs(v[i] - v[i - (i % b)]) < 1e-6;
    if (ok) {
      block = b;
      break;
    }
  }
  const vals = v.filter((_, i) => i % block === 0).map(fmt).join(', ');
  return `pick(${block > 1 ? `floor(n / ${block})` : 'n'}, ${vals})`;
}

/** a hit pattern as bits() masks, 16 steps a mask */
function gateFormula(hits: boolean[]): string {
  const p = period(hits);
  const h = hits.slice(0, p);
  if (h.every(Boolean)) return '1';
  // a pulse every m steps: every(n, m, offset)
  const ons = h.flatMap((on, i) => (on ? [i] : []));
  if (ons.length > 1 || p > 1) {
    const m = ons.length > 1 ? ons[1] - ons[0] : p;
    if (p % m === 0 && ons.length === p / m && ons.every((x, i) => x === ons[0] + i * m)) return `every(n, ${m}${ons[0] ? `, ${ons[0]}` : ''})`;
  }
  // a Euclidean rhythm: k pulses spread as evenly as they go over p steps, turned by r
  if (p <= 32 && ons.length > 1) {
    for (let r = 0; r < p; r++) if (h.every((on, i) => (euclid(i, ons.length, p, r) === 1) === on)) return `euclid(n, ${ons.length}, ${p}${r ? `, ${r}` : ''})`;
  }
  if (p <= 16) {
    let m = 0;
    h.forEach((on, i) => on && (m += 2 ** (p - 1 - i)));
    return p === 16 ? `bits(0x${m.toString(16).toUpperCase().padStart(4, '0')}, n)` : `bits(0x${m.toString(16).toUpperCase()}, n, ${p})`;
  }
  if (p % 16 === 0) {
    const masks: string[] = [];
    for (let b = 0; b < p / 16; b++) {
      let m = 0;
      for (let i = 0; i < 16; i++) if (h[b * 16 + i]) m += 2 ** (15 - i);
      masks.push(`0x${m.toString(16).toUpperCase().padStart(4, '0')}`);
    }
    // repeated bars collapse: pick wraps around
    const mp = period(masks);
    return mp === 1 ? `bits(${masks[0]}, n)` : `bits(pick(floor(n / 16), ${masks.slice(0, mp).join(', ')}), n)`;
  }
  return listFormula(h.map((x) => (x ? 1 : 0)), (x) => String(x));
}

/** velocities as levels × hit masks when there are a few levels, else as a list */
function velocityFormula(vel: number[]): string {
  const levels = [...new Set(vel.filter((v) => v > 0).map((v) => Math.round(v * 100) / 100))].sort((a, b) => b - a);
  if (!levels.length) return '0';
  if (levels.length <= 3) {
    return levels
      .map((lv) => {
        const g = gateFormula(vel.map((v) => Math.abs(Math.round(v * 100) / 100 - lv) < 1e-9));
        return lv === 1 ? g : g === '1' ? num(lv) : `${num(lv)} * ${g}`;
      })
      .join(' + ');
  }
  return listFormula(vel);
}

/** without the feel, the dynamics are tidied too: velocities within a step of each other become one level */
function tidy(vel: number[]) {
  const lv = [...new Set(vel.filter((v) => v > 0))].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of lv) (groups.length && v - groups[groups.length - 1][0] <= 0.1 ? groups[groups.length - 1].push(v) : groups.push([v]));
  const to = new Map(groups.flatMap((gr) => gr.map((v) => [v, Math.round((gr.reduce((a, b) => a + b, 0) / gr.length) * 100) / 100] as const)));
  for (let s = 0; s < vel.length; s++) if (vel[s] > 0) vel[s] = to.get(vel[s]) ?? vel[s];
}

/** how many bars a file runs */
export function barsOf(file: MidiFileData): number {
  let last = 0;
  for (const p of file.parts) for (const n of p.notes) last = Math.max(last, n.beat + 0.01);
  return Math.max(1, Math.ceil(last / BEATS_PER_BAR - 1e-6));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/**
 * Levels by position as a function: a constant, or a level plus up to two accents on every m-th
 * step (every(n, m, o)) — each within `tol` of what was played; else the list itself.
 */
function fitLevels(vals: number[], at: boolean[], tol: number): string {
  const p = vals.length;
  const pts = vals.flatMap((_, i) => (at[i] ? [i] : []));
  if (!pts.length) return '0';
  const m0 = mean(pts.map((i) => vals[i]));
  if (pts.every((i) => Math.abs(vals[i] - m0) <= tol)) return num(m0);
  const terms: { m: number; o: number }[] = [];
  for (let m = 2; m <= p; m++) if (p % m === 0) for (let o = 0; o < m; o++) terms.push({ m, o });
  const on = (i: number, t: { m: number; o: number }) => i % t.m === t.o;
  type Fit = { a: number; parts: { t: { m: number; o: number }; d: number }[]; err: number };
  const fit = (ts: { m: number; o: number }[]): Fit => {
    // least squares: a + Σ d_k·[on_k], solved for one or two terms by their group means
    const a = mean(pts.filter((i) => !ts.some((t) => on(i, t))).map((i) => vals[i]));
    const parts = ts.map((t) => ({ t, d: mean(pts.filter((i) => on(i, t) && !ts.some((u) => u !== t && on(i, u))).map((i) => vals[i])) - a }));
    const err = Math.max(...pts.map((i) => Math.abs(vals[i] - (a + parts.reduce((s, q) => s + (on(i, q.t) ? q.d : 0), 0)))));
    return { a, parts, err };
  };
  let best: Fit | null = null;
  for (const t of terms) {
    if (!pts.some((i) => !on(i, t)) || !pts.some((i) => on(i, t))) continue;
    const f = fit([t]);
    if (Number.isFinite(f.err) && f.err <= tol && (!best || f.err < best.err)) best = f;
  }
  if (!best)
    for (let i = 0; i < terms.length && !best; i++)
      for (let j = i + 1; j < terms.length; j++) {
        const f = fit([terms[i], terms[j]]);
        if (f.parts.every((q) => Number.isFinite(q.d)) && Number.isFinite(f.a) && f.err <= tol) {
          best = f;
          break;
        }
      }
  if (best) {
    const a = Math.abs(best.a) < tol / 2 ? 0 : best.a;
    const acc = best.parts.map((q) => `${Math.abs(Math.abs(q.d) - 1) < 1e-9 ? '' : `${num(Math.abs(q.d))} * `}every(n, ${q.t.m}${q.t.o ? `, ${q.t.o}` : ''})`);
    return best.parts.reduce((s, q, k) => (s ? `${s} ${q.d < 0 ? '-' : '+'} ${acc[k]}` : q.d < 0 ? `-${acc[k]}` : acc[k]), a ? num(a) : '');
  }
  // the list itself, rests holding the level before them
  const filled = vals.slice();
  let last = NaN;
  for (let i = p - 1; i >= 0 && Number.isNaN(last); i--) if (at[i]) last = vals[i];
  for (let i = 0; i < p; i++) if (!at[i]) filled[i] = i ? filled[i - 1] : last;
  return listFormula(filled.map((x) => Math.round(x * 50) / 50));
}

/**
 * The feel as functions: which steps play (exact), how loud each position is on average (fitted
 * to accents where they fit), how much a hand varies around that (a seeded rand of the same
 * spread), and how late each position sits, with its jitter. Every pass differs, as played.
 */
function modelFeel(vel: number[], shifts: number[], p: number, seed: number, gateOverride?: string): { velocity: string; shift: string | null } {
  const byPos: number[][] = Array.from({ length: p }, () => []);
  const lateByPos: number[][] = Array.from({ length: p }, () => []);
  vel.forEach((v, s) => {
    if (v <= 0) return;
    byPos[s % p].push(v);
    lateByPos[s % p].push(shifts[s] ?? 0);
  });
  const at = byPos.map((xs) => xs.length > 0);
  const levels = byPos.map((xs) => (xs.length ? mean(xs) : NaN));
  // the hand: how far each hit strays from its position's level, as a share of it
  const rel = byPos.flatMap((xs, i) => xs.map((v) => (v - levels[i]) / Math.max(0.01, levels[i])));
  const spread = Math.round(Math.sqrt(3) * Math.sqrt(mean(rel.map((x) => x * x))) * 100) / 100;
  const gate = gateOverride ?? gateFormula(at);
  const lv = fitLevels(levels, at, 0.06);
  const k = `rand(n + ${p}k, ${seed})`;
  const hand = spread >= 0.04 ? `(${num(1 - spread)} + ${num(2 * spread)} * ${k})` : '';
  const wrap = (x: string) => (/[+-] /.test(x) ? `(${x})` : x);
  const velocity = [lv === '1' ? '' : wrap(lv), gate === '1' ? '' : gate, hand].filter(Boolean).join(' * ') || '1';

  // lateness: each position's own, plus a jitter
  const lates = lateByPos.map((xs) => (xs.length ? mean(xs) : 0));
  const jitterSd = Math.sqrt(mean(lateByPos.flatMap((xs, i) => xs.map((x) => (x - lates[i]) ** 2))));
  const jitter = Math.round(Math.sqrt(12) * jitterSd * 100) / 100;
  if (Math.max(...lates) < 0.02 && jitter < 0.02) return { velocity, shift: null };
  // the jitter is late-only (0 … jitter): the positions' own lateness gives up half of it
  const centred = lates.map((x) => Math.max(0, x - jitter / 2));
  const lf = fitLevels(centred, at, 0.03);
  const shift = [lf === '0' ? '' : lf, jitter >= 0.02 ? `${num(jitter)} * rand(n + ${p}k, ${seed + 50})` : ''].filter(Boolean).join(' + ') || null;
  return { velocity, shift };
}

// ---------- the parts ----------

/** GM drum notes onto the drum voices: which voice, a tuning, and a touch of sound design */
const GM_DRUMS: Record<number, { voice: DrumVoice; name: string; tune?: number; synth?: Partial<Record<'tone' | 'decay' | 'drive', number>> }> = {
  35: { voice: 'kick', name: 'Kick' }, 36: { voice: 'kick', name: 'Kick' },
  37: { voice: 'rim', name: 'Rim' }, 38: { voice: 'snare', name: 'Snare' }, 40: { voice: 'snare', name: 'Snare' },
  39: { voice: 'clap', name: 'Clap' },
  42: { voice: 'hat', name: 'Hats' }, 44: { voice: 'hat', name: 'Hats' }, 46: { voice: 'openhat', name: 'Open hat' },
  41: { voice: 'tom', name: 'Toms', tune: -6 }, 43: { voice: 'tom', name: 'Toms', tune: -3 }, 45: { voice: 'tom', name: 'Toms', tune: 0 },
  47: { voice: 'tom', name: 'Toms', tune: 2 }, 48: { voice: 'tom', name: 'Toms', tune: 5 }, 50: { voice: 'tom', name: 'Toms', tune: 8 },
  49: { voice: 'crash', name: 'Crash' }, 52: { voice: 'crash', name: 'Crash' }, 55: { voice: 'crash', name: 'Crash' }, 57: { voice: 'crash', name: 'Crash' },
  51: { voice: 'hat', name: 'Ride', synth: { tone: 0.4, decay: 2.2 } }, 53: { voice: 'hat', name: 'Ride', synth: { tone: 0.4, decay: 2.2 } }, 59: { voice: 'hat', name: 'Ride', synth: { tone: 0.4, decay: 2.2 } },
  54: { voice: 'hat', name: 'Tambourine', synth: { tone: 0.6, decay: 1.4 } },
  56: { voice: 'tom', name: 'Cowbell', tune: 24, synth: { tone: 0.8, decay: 0.35 } },
  69: { voice: 'hat', name: 'Shaker', synth: { tone: 0.35, decay: 0.7 } }, 70: { voice: 'hat', name: 'Shaker', synth: { tone: 0.35, decay: 0.7 } }, 82: { voice: 'hat', name: 'Shaker', synth: { tone: 0.35, decay: 0.7 } },
  75: { voice: 'rim', name: 'Claves', synth: { tone: 0.5 } }, 76: { voice: 'rim', name: 'Wood block', synth: { tone: 0.3 } }, 77: { voice: 'rim', name: 'Wood block', synth: { tone: 0.1 } },
  60: { voice: 'tom', name: 'Bongos', tune: 14 }, 61: { voice: 'tom', name: 'Bongos', tune: 10 },
  62: { voice: 'tom', name: 'Congas', tune: 9 }, 63: { voice: 'tom', name: 'Congas', tune: 7 }, 64: { voice: 'tom', name: 'Congas', tune: 3 },
};
const drumOf = (midi: number) => GM_DRUMS[midi] ?? { voice: (midi < 41 ? 'kick' : midi < 60 ? 'hat' : 'tom') as DrumVoice, name: 'Percussion', tune: midi < 60 ? 0 : (midi - 60) / 2 };

/** a GM program onto a voice */
function voiceFor(program: number | null, median: number): Partial<Track> & { waveform: Waveform } {
  const bass = (cutoff = 0.36): Partial<Track> & { waveform: Waveform } => ({
    waveform: 'custom',
    timbre: 'sin(tau*p) + 0.28*sin(2*tau*p) + 0.1*sin(3*tau*p)',
    attack: 0.005,
    release: 0.14,
    synth: { filter: 'lowpass', cutoff, resonance: 0.15, envAmount: 0.3, envDecay: 0.12, keyTrack: 0.3, decay: 0.6, sustain: 0.7, drive: 0.2, sub: 0.25 } as Partial<SynthParams>,
  });
  const wear = (id: string): Partial<Track> & { waveform: Waveform } => {
    const v = WAVE_VOICES.find((w) => w.id === id)!;
    return { waveform: 'custom', timbre: v.timbre, attack: v.attack, release: v.release, synth: { ...v.synth } };
  };
  const fam = program === null ? -1 : program >> 3;
  // a line down in the bass register is a bass, whatever lead or unknown sound the file named for it
  if (median < 48 && (program === null || fam === 10 || fam === 12 || fam === 15)) return bass();
  if (program === null) return { waveform: 'keys' };
  switch (fam) {
    case 0: return { waveform: 'keys' };
    case 1: return { waveform: 'bell' };
    case 2: return { waveform: 'custom', timbre: 'sin(tau*p) + 0.5*sin(2*tau*p) + 0.3*sin(3*tau*p) + 0.15*sin(4*tau*p) + 0.1*sin(6*tau*p)', attack: 0.01, release: 0.12 };
    case 3: return { waveform: 'pluck' };
    case 4: return program >= 38 ? { waveform: 'acid' } : bass();
    case 5: return program <= 43 ? wear('bowstorm') : { waveform: 'pad', attack: 0.3, release: 1 };
    case 6: return program === 52 || program === 53 || program === 54 ? wear('prismchoir') : { waveform: 'pad', attack: 0.3, release: 1 };
    case 7: return { waveform: 'brass' };
    case 8: return program >= 64 && program <= 67 ? wear('moonreed') : { waveform: 'flute' };
    case 9: return { waveform: 'flute' };
    case 10: return { waveform: program === 80 ? 'square' : program === 81 ? 'sawtooth' : 'supersaw' };
    case 11: return { waveform: 'pad', attack: 0.4, release: 1.2 };
    case 13: return { waveform: 'pluck' };
    default: return { waveform: 'bell' };
  }
}

/**
 * How the feel is written: `exact` keeps every velocity and every note's distance from the grid as
 * lists (note for note); `functions` models them — each position's level and lateness, plus a
 * measured humanising rand() — so the loop is as short as the rhythm; `grid` puts everything on
 * the grid with tidied dynamics.
 */
export type Feel = 'exact' | 'functions' | 'grid';
export interface ImportOptions {
  feel: Feel;
  /** only these bars of the file (from inclusive, to exclusive; whole file when left out) */
  from?: number;
  to?: number;
  /** write melodic parts against the bar's chord (h + …) when that is simpler */
  harmony: boolean;
  /** every note exactly: when notes fall outside the key, the song uses every semitone */
  exact: boolean;
}
export const IMPORT_DEFAULTS: ImportOptions = { feel: 'functions', harmony: true, exact: true };

export interface ImportedChannel {
  template: Partial<Track> & { name: string; graph: { nodes: GNode[]; edges: GEdge[] } };
  /** what the preview says about it */
  kind: 'drums' | 'melody' | 'chords' | 'voice';
  grid: string;
  steps: number;
  notes: number;
  formulas: Record<string, string>;
}
export interface ImportResult {
  name: string;
  song: Partial<Song>;
  channels: ImportedChannel[];
  report: { fileBars: number; from: number; bars: number; truncatedBars: number; outside: number; snapped: number; tempoChanges: number; timeSig: [number, number]; keyName: string; dropped: number };
}

/** the longest an imported part may be: the app's step limit */
const MAX_STEPS = 1024;

function template(name: string, base: Partial<Track>, formulas: Record<string, string>): ImportedChannel['template'] {
  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const out: GNode = { id: 'out', type: 'output', position: { x: 520, y: 0 }, data: { ...NODE_DEFS.output.defaults } };
  let y = 0;
  for (const [port, formula] of Object.entries(formulas)) {
    const id = port;
    const isNum = /^-?\d+(\.\d+)?$/.test(formula);
    const data: NodeData = isNum ? { ...NODE_DEFS.number.defaults, value: Number(formula), min: Math.min(0, Number(formula)), max: Math.max(16, Number(formula)) } : { ...NODE_DEFS.expr.defaults, formula };
    nodes.push({ id, type: isNum ? 'number' : 'expr', position: { x: 0, y }, data });
    edges.push({ id: `${id}.out-out.${port}`, source: id, sourceHandle: 'out', target: 'out', targetHandle: port });
    y += 150;
  }
  nodes.push({ ...out, position: { x: 520, y: Math.max(0, y / 2 - 150) } });
  return { name, ...base, graph: layoutGraph({ nodes, edges }) } as ImportedChannel['template'];
}

/**
 * Turn a parsed MIDI file into channels of formulas. Every part is placed on its own grid,
 * cut to its own loop, and written as compactly as its music allows.
 */
export function midiToFunctions(whole: MidiFileData, opts: ImportOptions = IMPORT_DEFAULTS, fileName = ''): ImportResult {
  const fileBars = barsOf(whole);
  const from = Math.max(0, Math.min(fileBars - 1, Math.floor(opts.from ?? 0)));
  const to = Math.max(from + 1, Math.min(fileBars, Math.floor(opts.to ?? fileBars)));
  const ranged = opts.from !== undefined || opts.to !== undefined;
  // only the chosen bars, moved to the start (a note held past the end is cut there)
  const a = from * BEATS_PER_BAR, z = to * BEATS_PER_BAR;
  const file: MidiFileData = {
    ...whole,
    parts: whole.parts
      .map((p) => ({ ...p, notes: p.notes.filter((n) => n.beat >= a - 1e-6 && n.beat < z - 1e-6).map((n) => ({ ...n, beat: n.beat - a, end: Math.min(n.end, z) - a })) }))
      .filter((p) => p.notes.length),
  };
  const keepFeel = opts.feel !== 'grid';
  const modelled = opts.feel === 'functions';
  const melodicNotes = file.parts.filter((p) => p.channel !== 9).flatMap((p) => p.notes);
  // the key is the whole song's, even when only a few bars of it come in
  const keyNotes = whole.parts.filter((p) => p.channel !== 9).flatMap((p) => p.notes);
  const key = findKey(keyNotes.length ? keyNotes : [{ beat: 0, end: 1, midi: 60, vel: 100 }], file.keySig);
  const exact = opts.exact && key.outside > 0.0005;
  const scale = exact ? 'chromatic' : key.scale;
  const steps = SCALES[scale].steps;
  const root = key.root;

  // a chosen range keeps its silent bars: the loop is as long as you chose
  let bars = ranged ? to - from : barsOf(file);
  // the finest grid any part needs sets how many bars fit in the step limit
  // the swing the whole file plays with, for parts too sparse to show their own
  const songSwing = findGrid(file.parts.flatMap((p) => p.notes)).swing;
  const grids = new Map(file.parts.map((p) => [p, findGrid(p.notes, songSwing)]));
  const finest = Math.min(...[...grids.values()].map((x) => x.g), 0.25);
  const maxBars = Math.max(1, Math.floor((MAX_STEPS * finest) / BEATS_PER_BAR));
  const truncatedBars = Math.max(0, bars - maxBars);
  bars = Math.min(bars, maxBars);
  const total = bars * BEATS_PER_BAR;

  // the harmony, bar by bar — only in a seven-note key, where chords mean something
  const useHarmony = opts.harmony && steps.length === 7;
  const hs = useHarmony ? findHarmony(melodicNotes.filter((n) => n.beat < total), bars, root, scale) : [];
  const hp = hs.length ? period(hs) : 0;
  const harmony = !hs.length ? '0' : hp === 1 ? String(hs[0]) : `pick(bar, ${hs.slice(0, hp).join(', ')})`;
  const hAt = (beat: number) => (hs.length ? hs[Math.floor(beat / BEATS_PER_BAR) % hs.length] : 0);

  let snapped = 0;
  let dropped = 0;
  const channels: ImportedChannel[] = [];

  /** shared by every channel: place notes, keep the feel, cut the loop */
  const lay = (notes: MidiNote[], g: number, swing: number) => {
    const n = Math.round(total / g);
    const at = new Map<number, { notes: MidiNote[]; shift: number; ratchet: number }>();
    for (const strike of strikes(notes)) {
      if (strike.beat >= total) continue;
      const { step, shift } = place(strike.beat, g);
      if (step < 0 || step >= n) continue;
      const cell = at.get(step);
      if (!cell) at.set(step, { notes: strike.notes.slice(), shift, ratchet: 1 });
      else if (strike.notes.every((x) => cell.notes.some((m) => m.midi === x.midi))) {
        // the same notes again inside one step: a roll
        cell.ratchet = Math.min(8, cell.ratchet + 1);
      } else for (const x of strike.notes) if (!cell.notes.some((m) => m.midi === x.midi)) cell.notes.push(x);
    }
    // the off-steps' common lateness is the part's swing; what is left over is each note's own shift
    const shifts = new Array(n).fill(0);
    for (const [s, c] of at) shifts[s] = keepFeel ? Math.max(0, Math.min(0.95, c.shift - (s % 2 ? swing : 0))) : 0;
    return { n, at, shifts };
  };

  const base0 = (g: number, swing: number, n: number): Partial<Track> => ({ steps: n, stepBeats: g, swing: keepFeel ? Math.round(swing * 100) / 100 : 0, volume: 0.75, send: 0.25 });

  /** the loop each list repeats within: the shortest period every list agrees on */
  const loopOf = (lists: number[][], n: number) => {
    for (let p = 1; p <= n; p++) {
      if (n % p) continue;
      // a loop is whole bars, or a whole number of beats under a bar
      if (lists.every((xs) => xs.every((x, i) => i < p || Math.abs(x - xs[i - p]) < 1e-6))) return p;
    }
    return n;
  };

  for (const part of file.parts) {
    const { g, swing } = grids.get(part)!;
    if (part.channel === 9) {
      // drums: one channel per voice
      const byVoice = new Map<string, MidiNote[]>();
      for (const note of part.notes) {
        const d = drumOf(note.midi);
        const k = `${d.voice}|${d.name}`;
        byVoice.set(k, [...(byVoice.get(k) ?? []), note]);
      }
      for (const [k, notes] of byVoice) {
        const [voice, name] = k.split('|') as [DrumVoice, string];
        const { n, at, shifts } = lay(notes, g, swing);
        const vel = new Array(n).fill(0), tune = new Array(n).fill(0), rat = new Array(n).fill(1);
        for (const [s, c] of at) {
          const loud = c.notes.reduce((a, b) => (b.vel > a.vel ? b : a));
          vel[s] = Math.round((loud.vel / 127) * 100) / 100;
          tune[s] = drumOf(loud.midi).tune ?? 0;
          rat[s] = c.ratchet;
        }
        if (opts.feel === 'grid') tidy(vel);
        // rests hold the last tuning, so the list stays short
        for (let s = 1; s < n; s++) if (!vel[s]) tune[s] = tune[s - 1];
        const gate = vel.map((v) => (v > 0 ? 1 : 0));
        // modelled feel: the loop is as long as the rhythm, not as long as the dynamics never repeat
        let p = loopOf(modelled ? [gate, tune, rat] : [vel, tune, rat, shifts], n);
        const seed = channels.length + 1;
        // a pattern that never repeats exactly (ghost notes that come and go): a bar or two where
        // each position plays as often as it did — chance() — so the loop is a bar, not the song
        let chanceGate: string | undefined;
        const spb = Math.round(BEATS_PER_BAR / g);
        if (modelled && p > 2 * spb) {
          let best: { P: number; doubt: number; freq: number[] } | null = null;
          for (const P of [spb, 2 * spb]) {
            if (n % P || loopOf([tune, rat], n) % P && loopOf([tune, rat], n) > P) continue;
            const freq = Array.from({ length: P }, (_, i) => {
              let hit = 0, all = 0;
              for (let s = i; s < n; s += P) (all++, (hit += gate[s]));
              return Math.round((hit / Math.max(1, all)) * 20) / 20;
            });
            const doubt = mean(freq.map((f) => f * (1 - f)));
            if (!best || doubt < best.doubt - 0.005) best = { P, doubt, freq };
          }
          if (best && best.freq.some((f) => f === 1)) {
            p = best.P;
            // a few passes only sample a probability roughly: positions that sometimes play share one,
            // unless they differ by more than the sampling can explain
            const samples = Math.max(1, Math.floor(n / p));
            const some = best.freq.filter((f) => f > 0 && f < 1);
            const shared = Math.round(mean(some) * 20) / 20;
            if (some.length && some.every((f) => Math.abs(f - shared) <= 1.6 / Math.sqrt(samples * 4))) best.freq = best.freq.map((f) => (f > 0 && f < 1 ? shared : f));
            const sure = best.freq.every((f) => f === 0 || f === 1);
            chanceGate = sure ? gateFormula(best.freq.map((f) => f === 1)) : `chance(n + ${p}k, ${fitLevels(best.freq, best.freq.map(() => true), 0.08)}, ${seed + 100})`;
          }
        }
        const feel = modelled ? modelFeel(vel, shifts, p, seed, chanceGate) : null;
        const formulas: Record<string, string> = { velocity: feel ? feel.velocity : velocityFormula(vel.slice(0, p)) };
        const tunes = new Set(tune.slice(0, p));
        if (tunes.size > 1 || [...tunes][0] !== 0) formulas.pitch = listFormula(tune.slice(0, p));
        if (rat.slice(0, p).some((r) => r > 1)) formulas.ratchet = listFormula(rat.slice(0, p), (x) => String(x));
        if (feel) {
          if (feel.shift) formulas.shift = feel.shift;
        } else if (shifts.slice(0, p).some((x) => x > 0.02)) formulas.shift = listFormula(shifts.slice(0, p).map((x) => Math.round(x * 100) / 100));
        const synth = GM_DRUMS[notes[0].midi]?.synth;
        channels.push({
          template: template(name, { ...base0(g, swing, p), waveform: voice, ...(synth ? { synth } : {}) }, formulas),
          kind: 'drums',
          grid: GRID_LABEL.get(g) ?? '',
          steps: p,
          notes: notes.length,
          formulas,
        });
      }
      continue;
    }

    // melodic: the part's own octave, so its numbers stay small
    const sorted = part.notes.map((x) => x.midi).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const octave = Math.max(0, Math.min(8, Math.floor(median / 12) - 1));
    const deg = (midi: number) => {
      const d = midiToDegree(midi, root, steps, octave);
      if (degreeToMidi(d, root, steps, octave) !== midi) snapped++;
      return d;
    };
    const voice = voiceFor(part.program, median);
    const { n, at, shifts } = lay(part.notes, g, swing);

    // chords: does every group of notes struck together stack as a scale chord?
    const groups = [...at.entries()].sort((a, b) => a[0] - b[0]);
    const poly = groups.some(([, c]) => c.notes.length > 1);
    let asChords = poly && steps.length === 7;
    const chordOf = new Map<number, { degree: number; size: number; inversion: number; strum: number }>();
    if (asChords) {
      for (const [s, c] of groups) {
        const ms = [...new Set(c.notes.map((x) => x.midi))].sort((a, b) => a - b);
        const size = ms.length;
        let found: { degree: number; inversion: number } | null = null;
        const low = deg(ms[0]);
        for (let inv = 0; inv < size && !found; inv++)
          for (let d = low - 2 * size - 7; d <= low + 7 && !found; d++) {
            const tones = [];
            for (let i = 0; i < size; i++) tones.push(degreeToMidi(d + 2 * i, root, steps, octave));
            const invd = tones.map((m, i) => (i < inv ? m + 12 : m)).sort((a, b) => a - b);
            if (invd.length === ms.length && invd.every((m, i) => m === ms[i])) found = { degree: d, inversion: inv };
          }
        if (!found) {
          asChords = false;
          break;
        }
        // a strum: the chord's notes rolled a little apart, in the order they were struck
        const ons = c.notes.map((x) => x.beat / g).sort((a, b) => a - b);
        const gaps = ons.slice(1).map((x, i) => x - ons[i]);
        const strum = keepFeel && gaps.length && gaps.every((x) => x > 0.005 && Math.abs(x - gaps[0]) < 0.02) ? Math.round(gaps[0] * 1000) / 1000 : 0;
        chordOf.set(s, { degree: found.degree, size, inversion: found.inversion, strum });
      }
    }

    /** write one line (a voice of the part, or its chords) as a channel */
    const emit = (name: string, cells: Map<number, { midi: number; vel: number; len: number; chord?: { degree: number; size: number; inversion: number; strum: number }; ratchet: number }>, kind: ImportedChannel['kind']) => {
      const NaNs = () => new Array<number>(n).fill(NaN);
      const vel = new Array<number>(n).fill(0), rat = new Array<number>(n).fill(1), sh = new Array<number>(n).fill(0);
      const abs = NaNs(), len = NaNs(), size = NaNs(), inv = NaNs(), strum = NaNs(), hs2 = NaNs();
      let notes = 0;
      for (const [s, c] of cells) {
        vel[s] = Math.max(0.01, Math.round((c.vel / 127) * 100) / 100);
        abs[s] = c.chord ? c.chord.degree : deg(c.midi);
        hs2[s] = useHarmony ? hAt(s * g) : 0;
        len[s] = Math.max(0.05, Math.round((c.len / g) * 100) / 100);
        rat[s] = c.ratchet;
        sh[s] = shifts[s];
        size[s] = c.chord ? c.chord.size : 1;
        inv[s] = c.chord ? c.chord.inversion : 0;
        strum[s] = c.chord ? c.chord.strum : 0;
        notes++;
      }
      if (opts.feel === 'grid') tidy(vel);
      /** a rest holds the value before it — round the loop, so the rests before the first note hold the last: the lists stay short */
      const fill = (xs: number[]) => {
        const out = xs.slice();
        let last = NaN;
        for (let s = n - 1; s >= 0 && Number.isNaN(last); s--) last = out[s];
        if (Number.isNaN(last)) return out.map(() => 0);
        for (let s = 0; s < n; s++) if (Number.isNaN(out[s])) out[s] = s ? out[s - 1] : last;
        return out;
      };

      // the pitch, written against whichever base makes it shortest: nothing, the chord (h), the
      // chord's root in one octave, or — for chords — the voice-led position the kits use
      const L = steps.length;
      const wrapv = (v: number, lo: number, hi: number) => lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));
      const lift = (h: number) => Math.ceil((L - 2 - wrapv(h, -2, L - 2)) / 2);
      const sizes = new Set(cells.size ? [...cells.values()].map((c) => c.chord?.size ?? 1) : [1]);
      const S = sizes.size === 1 ? [...sizes][0] : 0;
      type Base = { expr: string; f: (h: number) => number; inv?: { expr: string; f: (h: number) => number } };
      const bases: Base[] = [{ expr: '', f: () => 0 }];
      if (useHarmony) {
        bases.push({ expr: 'h', f: (h) => h }, { expr: 'wrap(h, -3, 4)', f: (h) => wrapv(h, -3, 4) }, { expr: 'wrap(h, -2, 5)', f: (h) => wrapv(h, -2, 5) });
        if (S > 1)
          bases.push({
            expr: voicedPitch(S),
            f: (h) => wrapv(h, -2, L - 2) - (lift(h) < S ? L : 0),
            inv: { expr: voicedInversion(S), f: (h) => (lift(h) < S ? lift(h) : 0) },
          });
      }
      const plus = (baseExpr: string, list: string) => (!baseExpr ? list : list === '0' ? baseExpr : list.startsWith('-') ? `${baseExpr} - ${list.slice(1)}` : `${baseExpr} + ${list}`);
      let pick: { pitch: number[]; inv: number[]; base: Base; cost: number } | null = null;
      for (const base of bases) {
        const pitch = fill(abs.map((a, s) => (Number.isNaN(a) ? NaN : a - base.f(hs2[s]))));
        const invl = fill(inv.map((a, s) => (Number.isNaN(a) ? NaN : a - (base.inv ? base.inv.f(hs2[s]) : 0))));
        const p = loopOf([pitch, invl, modelled ? vel.map((v) => (v > 0 ? 1 : 0)) : vel], n);
        // a base is one idea however long its spelling: it costs a little, what is left over costs its length
        const left = (xs: number[]) => {
          const f = listFormula(xs.slice(0, p));
          return f === '0' ? 0 : f.length;
        };
        const cost = (base.expr ? 6 : 0) + left(pitch) + (S > 1 ? left(invl) + (base.inv ? 2 : 0) : 0);
        if (!pick || cost < pick.cost) pick = { pitch, inv: invl, base, cost };
      }
      const { base } = pick!;
      const lists = { pitch: pick!.pitch, inv: pick!.inv, len: fill(len), size: fill(size), strum: fill(strum) };
      const lens = cells.size ? [...cells.values()].map((c) => Math.round((c.len / g) * 100) / 100) : [1];
      // the length most notes share (a few cut short at the end don't count)
      const lenMean = lens.slice().sort((a, b) => a - b)[Math.floor(lens.length / 2)];
      const evenLength = modelled && lens.filter((x) => Math.abs(x - lenMean) <= Math.max(0.15, lenMean * 0.08)).length >= lens.length * 0.85;
      const gateList = vel.map((v) => (v > 0 ? 1 : 0));
      // a length that is one constant doesn't hold the loop open
      const p = loopOf(modelled ? [lists.pitch, gateList, ...(evenLength ? [] : [lists.len]), rat, lists.size, lists.inv, lists.strum] : [lists.pitch, vel, lists.len, rat, lists.size, lists.inv, lists.strum, sh], n);
      const cut = (xs: number[]) => xs.slice(0, p);
      const feel = modelled ? modelFeel(vel, sh, p, channels.length + 1) : null;
      const formulas: Record<string, string> = {
        pitch: plus(base.expr, listFormula(cut(lists.pitch))),
        velocity: feel ? feel.velocity : velocityFormula(cut(vel)),
        length: evenLength ? num(Math.round(lenMean * 10) / 10) : listFormula(cut(lists.len)),
      };
      if (cut(lists.size).some((x) => x > 1)) formulas.chord = listFormula(cut(lists.size), (x) => String(x));
      const invF = plus(base.inv?.expr ?? '', listFormula(cut(lists.inv), (x) => String(x)));
      if (invF !== '0') formulas.inversion = invF;
      if (cut(lists.strum).some((x) => x > 0)) formulas.strum = listFormula(cut(lists.strum), (x) => num(x, 3));
      if (cut(rat).some((x) => x > 1)) formulas.ratchet = listFormula(cut(rat), (x) => String(x));
      if (feel) {
        if (feel.shift) formulas.shift = feel.shift;
      } else if (cut(sh).some((x) => x > 0.02)) formulas.shift = listFormula(cut(sh).map((x) => Math.round(x * 100) / 100));
      channels.push({
        template: template(name, { ...base0(g, swing, p), ...voice, octave, pitchMode: 'degree' }, formulas),
        kind,
        grid: GRID_LABEL.get(g) ?? '',
        steps: p,
        notes,
        formulas,
      });
    };

    if (asChords || !poly) {
      const cells = new Map<number, { midi: number; vel: number; len: number; chord?: { degree: number; size: number; inversion: number; strum: number }; ratchet: number }>();
      for (const [s, c] of groups) {
        const lead = c.notes.reduce((a, b) => (b.vel > a.vel ? b : a));
        const ch = chordOf.get(s);
        cells.set(s, { midi: c.notes[0].midi, vel: lead.vel, len: Math.max(...c.notes.map((x) => x.end - x.beat)), chord: ch && ch.size > 1 ? ch : undefined, ratchet: c.ratchet });
      }
      emit(part.name, cells, asChords ? 'chords' : 'melody');
    } else {
      // not stacked chords: one line per voice, top down
      const voices = Math.min(6, Math.max(...groups.map(([, c]) => c.notes.length)));
      for (let v = 0; v < voices; v++) {
        const cells = new Map<number, { midi: number; vel: number; len: number; ratchet: number }>();
        for (const [s, c] of groups) {
          const ms = c.notes.slice().sort((a, b) => b.midi - a.midi);
          const note = ms[v];
          if (!note) continue;
          cells.set(s, { midi: note.midi, vel: note.vel, len: note.end - note.beat, ratchet: c.ratchet });
          if (v === voices - 1) dropped += Math.max(0, ms.length - voices);
        }
        if (cells.size) emit(`${part.name} ${v + 1}`, cells, 'voice');
      }
    }
  }

  return {
    name: file.name || fileName.replace(/\.midi?$/i, '') || 'Imported MIDI',
    song: { bpm: Math.max(20, Math.min(300, Math.round(file.bpm))), root, scale, harmony },
    channels,
    report: {
      fileBars,
      from,
      bars,
      truncatedBars,
      outside: Math.round(key.outside * 1000) / 10,
      snapped: exact ? 0 : snapped,
      tempoChanges: file.tempoChanges,
      timeSig: file.timeSig,
      keyName: `${spellDegree(0, root, scale)} ${SCALES[scale].label}`,
      dropped,
    },
  };
}
