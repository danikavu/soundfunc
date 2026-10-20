/**
 * The randomizer: mutate a track's node parameters *and formulas*, render many
 * candidates, and keep the one that scores best on musical criteria.
 *
 * `chaos` 0 → 1 slides from harmonious (small, consonant, structure-preserving
 * moves; chord tones and stepwise melody rewarded) to experimental (big jumps,
 * function swaps, grafted terms; novelty rewarded).
 */
import { compile, tokenize } from './expr';
import { ctxVars, NODE_DEFS, type GNode, type Graph, type NodeData } from './graph';
import { chordTones, PROGRESSIONS, SCALES } from './music';
import { isDrum, renderTrack, type Song, type Track, type TrackRender } from './project';
import { TIMBRE_VARS } from './timbre';

// ---------- seeded randomness ----------

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const gauss = (rng: Rng) => Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** pick the item of `set` nearest to v, then wander ±spread positions */
function nearIn(set: readonly number[], v: number, spread: number, rng: Rng): number {
  let i = 0;
  set.forEach((s, j) => Math.abs(s - v) < Math.abs(set[i] - v) && (i = j));
  const off = Math.round(gauss(rng) * spread);
  return set[clamp(i + off, 0, set.length - 1)];
}

// musically meaningful value sets
const RATIOS = [0.125, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
const PERIODS = [2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
const CLASSIC_EUCLID: [number, number][] = [
  [2, 5], [3, 4], [3, 7], [3, 8], [4, 9], [4, 11], [5, 8], [5, 9], [5, 12], [5, 16],
  [7, 12], [7, 16], [9, 16], [11, 16], [13, 24], [3, 16], [4, 16], [6, 16],
];

// ---------- numbers ----------

export function mutateNumber(v: number, chaos: number, rng: Rng): number {
  if (Number.isInteger(v)) {
    const abs = Math.abs(v);
    // periods and lengths move along musical values (2, 3, 4, 6, 8, 12, 16…)
    if (abs >= 2 && PERIODS.includes(abs)) return Math.sign(v) * nearIn(PERIODS, abs, 0.6 + chaos * 2, rng);
    const step = Math.max(1, Math.round(Math.abs(gauss(rng)) * (0.8 + chaos * 3)));
    const out = v + (rng() < 0.5 ? -step : step);
    return chaos < 0.5 && v >= 0 && out < 0 ? Math.abs(out) : out;
  }
  if (chaos < 0.5) {
    // harmonious: gentle scaling, landing on simple values
    const mag = Math.abs(v);
    if (mag > 0 && mag < 8) {
      const nice = [...RATIOS, 0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 1.25].sort((a, b) => a - b);
      return Math.sign(v) * nearIn(nice, mag, 0.8 + chaos * 2, rng);
    }
    return round(v * (1 + gauss(rng) * (0.1 + chaos * 0.3)), 2);
  }
  return round(v * Math.exp(gauss(rng) * chaos * 0.8) + gauss(rng) * chaos * 0.3, 3);
}

/** rhythm masks: flip or rotate bits inside a 16/32-bit window */
function mutateMask(v: number, chaos: number, rng: Rng): number {
  const len = v > 0xffff ? 32 : 16;
  if (rng() < 0.5 - chaos * 0.3) {
    // rotate the whole groove by a step or two — keeps its feel
    const r = pick(rng, [1, 2, len - 1, len - 2]);
    const s = v.toString(2).padStart(len, '0');
    return parseInt(s.slice(r) + s.slice(0, r), 2);
  }
  let out = v;
  const flips = 1 + Math.floor(rng() * (1 + chaos * 3));
  for (let i = 0; i < flips; i++) {
    // harmonious mode leaves the downbeats alone
    let bit = Math.floor(rng() * len);
    if (chaos < 0.5 && bit % 4 === 0) bit = (bit + 1 + Math.floor(rng() * 3)) % len;
    out ^= 1 << (len - 1 - bit);
  }
  return out >>> 0;
}

// ---------- formulas ----------

const FAMILIES: string[][] = [
  ['sin', 'cos'],
  ['sine', 'tri', 'saw', 'sqr'],
  ['floor', 'round', 'ceil'],
  ['min', 'max'],
  ['fib', 'prime', 'collatz', 'recaman'],
  ['noise', 'rand'],
  ['abs', 'fract', 'tanh'],
];

/** extra musical terms grafted onto a pitch formula in experimental mode */
const GRAFTS = [
  (r: Rng) => ` + round(${pick(r, [1, 2, 3])} * sin(tau * x * ${pick(r, [1, 2, 3, 4])}))`,
  (r: Rng) => ` + ${pick(r, [2, 4, -2, 3])} * (sqr(x * ${pick(r, [1, 2, 4])}) > 0)`,
  (r: Rng) => ` + pick(n, 0, 0, ${pick(r, [2, 4, -1, 3])}, 0)`,
  (r: Rng) => ` + floor(${pick(r, [2, 3, 4])} * noise(n * ${pick(r, [0.2, 0.3, 0.5])}, ${Math.floor(r() * 99)}))`,
  (r: Rng) => ` + (k % ${pick(r, [2, 3, 4])}) * ${pick(r, [1, 2, -1])}`,
  (r: Rng) => ` + ${pick(r, [2, 4])} * every(n, ${pick(r, [3, 5, 7])})`,
];

/** What a number means, read from the function argument it sits in. */
type NumRole = 'degree' | 'period' | 'pulses' | 'probability' | 'seed' | 'plain';

const ROLES: Record<string, (arg: number) => NumRole> = {
  pick: (i) => (i === 0 ? 'plain' : 'degree'),
  every: (i) => (i === 1 ? 'period' : i === 2 ? 'degree' : 'plain'),
  phase: (i) => (i === 1 ? 'period' : 'plain'),
  decay: (i) => (i === 1 ? 'period' : 'plain'),
  euclid: (i) => (i === 1 ? 'pulses' : i === 2 ? 'period' : i === 3 ? 'degree' : 'plain'),
  bits: (i) => (i === 2 ? 'period' : 'plain'),
  chance: (i) => (i === 1 ? 'probability' : i === 2 ? 'seed' : 'plain'),
  rand: (i) => (i === 1 ? 'seed' : 'plain'),
  noise: (i) => (i === 1 ? 'seed' : 'plain'),
};

function mutateByRole(v: number, role: NumRole, chaos: number, rng: Rng): number {
  switch (role) {
    case 'degree': {
      // scale degrees move by steps; harmonious prefers chord-tone-sized moves (2 = a third)
      const step = chaos < 0.5 ? pick(rng, [-2, -1, 1, 2, 2, -2]) : pick(rng, [-4, -3, -2, -1, 1, 2, 3, 4, 5]);
      return clamp(Math.round(v) + step, -7, 14);
    }
    case 'period':
      return nearIn(PERIODS, Math.max(2, Math.abs(v)), 0.6 + chaos * 1.4, rng);
    case 'pulses':
      return Math.max(1, Math.round(v) + pick(rng, chaos < 0.5 ? [-1, 1, 2] : [-3, -2, -1, 1, 2, 3]));
    case 'probability':
      return round(clamp(v + gauss(rng) * (0.08 + chaos * 0.25), 0.05, 0.95), 2);
    case 'seed':
      return Math.floor(rng() * 100);
    default:
      return mutateNumber(v, chaos, rng);
  }
}

/** If the formula is "(core) + tail", return the core — used to prune grafts. */
function stripTail(src: string): string | null {
  if (src[0] !== '(') return null;
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return /^\s*[+*-]/.test(src.slice(i + 1)) ? src.slice(1, i) : null;
  }
  return null;
}

export function mutateFormula(src: string, chaos: number, rng: Rng, vars: readonly string[], graft = false): string {
  // long formulas shed a grafted term instead of growing forever
  if (src.length > 60 && rng() < 0.5) {
    const core = stripTail(src);
    if (core) src = core;
  }
  let toks;
  try {
    toks = tokenize(src);
  } catch {
    return src;
  }
  // which function argument each token sits in
  const roles: NumRole[] = [];
  const stack: { fn: string; arg: number; depth: number }[] = [];
  let depth = 0;
  toks.forEach((t, i) => {
    const top = stack[stack.length - 1];
    roles[i] = top && top.depth === depth ? (ROLES[top.fn]?.(top.arg) ?? 'plain') : 'plain';
    const prev = toks[i - 1];
    if (t.t === 'num' && prev?.t === 'op' && prev.v === '%') roles[i] = 'period';
    if (t.t === 'op' && t.v === '(') {
      depth++;
      if (prev?.t === 'id') stack.push({ fn: prev.v, arg: 0, depth });
    } else if (t.t === 'op' && t.v === ')') {
      if (top && top.depth === depth) stack.pop();
      depth--;
    } else if (t.t === 'op' && t.v === ',' && top && top.depth === depth) top.arg++;
  });

  const edits: { p: number; n: number; text: string }[] = [];
  const pNum = 0.2 + chaos * 0.45;
  toks.forEach((t, i) => {
    if (t.t === 'num' && rng() < pNum) {
      const lit = src.slice(t.p, t.p + t.n);
      if (/^0[xX]/.test(lit)) {
        edits.push({ p: t.p, n: t.n, text: '0x' + mutateMask(t.v, chaos, rng).toString(16).toUpperCase().padStart(t.n - 2, '0') });
      } else if (/^0[bB]/.test(lit)) {
        edits.push({ p: t.p, n: t.n, text: '0b' + mutateMask(t.v, chaos, rng).toString(2).padStart(t.n - 2, '0') });
      } else {
        const prevTok = toks[i - 1];
        const before = toks[i - 2];
        const minus = prevTok?.t === 'op' && prevTok.v === '-';
        // a unary minus belongs to the number: "pick(n, -2" → rewrite "-2" as one value
        const unary = minus && (!before || (before.t === 'op' && before.v !== ')'));
        const signed = minus ? -t.v : t.v;
        const nvSigned = mutateByRole(signed, roles[i], chaos, rng);
        if (unary) {
          edits.push({ p: prevTok.p, n: t.p + t.n - prevTok.p, text: String(nvSigned) });
          return;
        }
        // after a binary minus the literal keeps its own sign in parentheses: x - (-1)
        const nv = minus ? -nvSigned : nvSigned;
        const text = nv < 0 ? `(${nv})` : String(nv);
        edits.push({ p: t.p, n: t.n, text });
      }
    } else if (t.t === 'id' && toks[i + 1]?.t === 'op' && (toks[i + 1] as { v: string }).v === '(') {
      const fam = FAMILIES.find((f) => f.includes(t.v));
      if (fam && rng() < 0.06 + chaos * 0.35) edits.push({ p: t.p, n: t.n, text: pick(rng, fam.filter((f) => f !== t.v)) });
    } else if (t.t === 'op' && (t.v === '+' || t.v === '-') && chaos > 0.6 && rng() < (chaos - 0.6) * 0.3) {
      const prev = toks[i - 1];
      // only binary + / −, never a unary sign
      if (prev && (prev.t === 'num' || prev.t === 'id' || (prev.t === 'op' && prev.v === ')'))) edits.push({ p: t.p, n: t.n, text: t.v === '+' ? '-' : '+' });
    }
  });
  let out = src;
  for (const e of edits.sort((a, b) => b.p - a.p)) out = out.slice(0, e.p) + e.text + out.slice(e.p + e.n);
  if (graft && out.length < 70 && rng() < chaos * 0.55) out = `(${out})${pick(rng, GRAFTS)(rng)}`;
  try {
    compile(out, vars);
    return out;
  } catch {
    return src;
  }
}

// ---------- node parameters ----------

const FORMULA_VARS = ['a', 'b', 'c', ...ctxVars];

function mutateList(src: string, chaos: number, rng: Rng): string {
  const vals = src.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  if (!vals.length) return src;
  let len = vals.length;
  if (chaos > 0.6 && rng() < chaos * 0.4) len = clamp(len + pick(rng, [-2, 2, 4]), 2, 32);
  // a weighted random walk over scale degrees — mostly steps, sometimes a leap
  const out: number[] = [];
  let cur = vals[0];
  for (let i = 0; i < len; i++) {
    if (rng() < 0.35 + chaos * 0.5) {
      const leap = rng() < 0.2 + chaos * 0.4;
      const step = leap ? pick(rng, [-4, -3, 3, 4, 5]) : pick(rng, [-2, -1, -1, 0, 1, 1, 2]);
      cur = clamp((vals[i] ?? cur) + step, -7, 10 + chaos * 4);
    } else cur = vals[i] ?? cur;
    out.push(Math.round(cur));
  }
  return out.join(' ');
}

function mutatePattern(src: string, chaos: number, rng: Rng): string {
  const chars = [...src];
  const hits = chars.map((c, i) => (/[a-zA-Z1-9]/.test(c) ? i : -1)).filter((i) => i >= 0);
  const flips = 1 + Math.floor(rng() * (1 + chaos * 4));
  for (let f = 0; f < flips; f++) {
    const i = Math.floor(rng() * chars.length);
    if (chars[i] === ' ' || chars[i] === '|') continue;
    if (chaos < 0.5 && hits.length && i % 4 === 0) continue; // keep downbeats
    chars[i] = /[.\-_]/.test(chars[i]) ? pick(rng, chaos < 0.5 ? ['o', 'o', 'x'] : ['x', 'X', 'o']) : '.';
  }
  return chars.join('');
}

export function mutateNodeData(node: GNode, chaos: number, rng: Rng, onPitchPath: boolean): NodeData {
  const d = { ...node.data };
  const p = (base: number) => rng() < base + chaos * 0.4;
  switch (node.type) {
    case 'number': {
      const v = Number(d.value);
      d.value = clamp(mutateNumber(v, chaos, rng), Number(d.min ?? -12), Number(d.max ?? 12));
      break;
    }
    case 'wave':
      if (p(0.1)) d.shape = pick(rng, ['sine', 'triangle', 'saw', 'square']);
      if (p(0.4)) d.cycles = chaos < 0.6 ? nearIn(RATIOS, Number(d.cycles), 1 + chaos * 3, rng) : round(0.25 + rng() * 6, 2);
      if (p(0.35)) d.amp = clamp(Math.round(Number(d.amp) + gauss(rng) * (1 + chaos * 3)), chaos < 0.5 ? 1 : -8, 8);
      if (p(0.2)) d.offset = clamp(Math.round(Number(d.offset) + gauss(rng) * (1 + chaos * 2)), -5, 5);
      break;
    case 'math':
      if (p(0.05)) d.op = pick(rng, chaos < 0.5 ? ['add', 'sub', 'mix', 'max', 'min'] : ['add', 'sub', 'mul', 'mod', 'mix', 'max', 'min']);
      if (p(0.4)) d.b = mutateNumber(Number(d.b ?? 1), chaos, rng);
      break;
    case 'func':
      if (p(0.15)) d.fn = pick(rng, chaos < 0.5 ? ['abs', 'floor', 'round', 'ceil'] : ['sin', 'cos', 'abs', 'floor', 'round', 'fract', 'sign', 'tanh']);
      break;
    case 'map':
      if (p(0.4)) d.outMin = Math.round(Number(d.outMin) + gauss(rng) * (1 + chaos * 2));
      if (p(0.4)) d.outMax = Math.round(Number(d.outMax) + gauss(rng) * (1 + chaos * 3));
      break;
    case 'series':
      if (p(0.05)) d.kind = pick(rng, ['fib', 'prime', 'collatz', 'logistic', 'pi', 'phi', 'recaman', 'thue', 'lorenz', 'random']);
      if (p(0.3)) d.modulo = chaos < 0.5 ? nearIn([0, 5, 7, 8, 10, 12, 14], Number(d.modulo), 1, rng) : Math.floor(rng() * 16);
      if (p(0.3)) d.p = d.kind === 'logistic' ? round(clamp(3.4 + rng() * 0.6, 3.4, 4), 2) : mutateNumber(Number(d.p ?? 0), chaos, rng);
      break;
    case 'euclid':
      if (chaos < 0.6 || rng() < 0.5) {
        // jump to a nearby classic rhythm (tresillo, cinquillo, bossa…)
        if (p(0.35)) {
          const near = CLASSIC_EUCLID.filter(([, n]) => Math.abs(n - Number(d.length)) <= 4 + chaos * 8);
          const [k, n] = pick(rng, near.length ? near : CLASSIC_EUCLID);
          d.pulses = k;
          d.length = n;
        }
      } else {
        d.length = clamp(Math.round(Number(d.length) + gauss(rng) * 4), 3, 32);
        d.pulses = clamp(Math.round(Number(d.length) * (0.2 + rng() * 0.6)), 1, Number(d.length));
      }
      if (p(0.3)) d.rotate = Math.floor(rng() * Number(d.length));
      break;
    case 'chance':
      if (p(0.4)) d.p = round(clamp(Number(d.p) + gauss(rng) * (0.1 + chaos * 0.25), chaos < 0.5 ? 0.25 : 0.05, 0.95), 2);
      if (p(0.3)) d.seed = Math.floor(rng() * 100);
      break;
    case 'pattern':
      if (p(0.4)) d.pattern = mutatePattern(String(d.pattern), chaos, rng);
      if (p(0.15)) d.rotate = Number(d.rotate ?? 0) + pick(rng, [-2, -1, 1, 2]);
      break;
    case 'list':
      if (p(0.45)) d.values = mutateList(String(d.values), chaos, rng);
      if (p(0.15)) d.every = nearIn([1, 2, 4, 8, 16], Number(d.every), 1, rng);
      break;
    case 'expr':
      d.formula = mutateFormula(String(d.formula), chaos, rng, FORMULA_VARS, onPitchPath);
      break;
    case 'compare':
      if (p(0.05)) d.op = pick(rng, ['<', '<=', '>', '>=']);
      if (p(0.3)) d.b = mutateNumber(Number(d.b ?? 0), chaos, rng);
      break;
    case 'switch':
      if (p(0.3)) d.then = mutateNumber(Number(d.then ?? 1), chaos, rng);
      if (p(0.3)) d.else = mutateNumber(Number(d.else ?? 0), chaos, rng);
      break;
  }
  return d;
}

/** nodes whose output eventually reaches Note Out's pitch input */
function pitchPath(graph: Graph): Set<string> {
  const out = graph.nodes.find((n) => n.type === 'output');
  const set = new Set<string>();
  if (!out) return set;
  const stack = graph.edges.filter((e) => e.target === out.id && e.targetHandle === 'pitch').map((e) => e.source);
  while (stack.length) {
    const id = stack.pop()!;
    if (set.has(id)) continue;
    set.add(id);
    for (const e of graph.edges) if (e.target === id) stack.push(e.source);
  }
  return set;
}

function mutateGraph(graph: Graph, chaos: number, rng: Rng): Graph {
  const onPitch = pitchPath(graph);
  const mutable = graph.nodes.filter((n) => !n.data.locked && NODE_DEFS[n.type]?.params.length);
  // touch only some nodes so the result stays recognisable; more with more chaos
  const share = 0.35 + chaos * 0.55;
  const chosen = new Set(mutable.filter(() => rng() < share).map((n) => n.id));
  if (!chosen.size && mutable.length) chosen.add(pick(rng, mutable).id);
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (chosen.has(n.id) ? { ...n, data: mutateNodeData(n, chaos, rng, onPitch.has(n.id)) } : n)),
  };
}

// ---------- musical fitness ----------

interface Shape {
  /** per step: lowest sounding pitch or null for a rest */
  pitch: (number | null)[];
  /** per step: the song chord */
  h: number[];
  hits: number;
  steps: number;
}

function shapeOf(r: TrackRender, track: Track): Shape {
  const steps = track.steps;
  const pitch: (number | null)[] = new Array(steps).fill(null);
  const h: number[] = new Array(steps).fill(0);
  if (track.playMode === 'glide' && !isDrum(track.waveform)) {
    const res = r.curve.res;
    for (let n = 0; n < steps; n++) if (r.curve.velocity[n * res] >= 0.01) pitch[n] = Math.round(r.curve.midi[n * res]);
  } else {
    for (const note of r.notes) {
      if (pitch[note.step] === null || note.midi < pitch[note.step]!) pitch[note.step] = note.midi;
      h[note.step] = note.h;
    }
  }
  return { pitch, h, hits: pitch.filter((p) => p !== null).length, steps };
}

/** Higher is better. Exposed for tests and for the UI's "how musical" readout. */
export function musicalScore(cand: TrackRender, orig: TrackRender, track: Track, song: Song, chaos: number): number {
  if (cand.errors.size || !cand.hasOutput) return -Infinity;
  const a = shapeOf(cand, track), o = shapeOf(orig, track);
  if (a.hits === 0) return -100;
  let score = 0;

  // density: not empty, not wall-to-wall
  const density = a.hits / a.steps;
  const [dLo, dHi] = isDrum(track.waveform) ? [0.1, 0.65 + chaos * 0.3] : [0.2 - chaos * 0.1, 0.85 + chaos * 0.15];
  score -= Math.max(0, dLo - density, density - dHi) * 8;

  // novelty: how far from what the user had — the dial sets the target
  let diff = 0;
  for (let i = 0; i < a.steps; i++) {
    const p = a.pitch[i], q = o.pitch[i];
    if ((p === null) !== (q === null)) diff += 1;
    else if (p !== null && q !== null) diff += Math.min(1, Math.abs(p - q) / 7);
  }
  const novelty = diff / a.steps;
  if (novelty < 0.02) return -50; // identical — useless as a mutation
  score -= Math.abs(novelty - (0.12 + chaos * 0.6)) * 4;

  if (isDrum(track.waveform)) {
    // anchor the groove: the first downbeat usually sounds
    if (a.pitch[0] !== null) score += 0.6 * (1 - chaos);
    return score;
  }

  // melody: mostly steps, few big leaps (experimental tolerates more)
  const seq = a.pitch.filter((p): p is number => p !== null);
  let leaps = 0, total = 0;
  for (let i = 1; i < seq.length; i++) {
    const iv = Math.abs(seq[i] - seq[i - 1]);
    total += iv;
    if (iv > 7) leaps++;
  }
  const meanIv = seq.length > 1 ? total / (seq.length - 1) : 0;
  score -= Math.abs(meanIv - (2.5 + chaos * 4)) * 0.35;
  score -= (leaps / Math.max(1, seq.length)) * 4 * (1 - chaos);
  const range = Math.max(...seq) - Math.min(...seq);
  score -= Math.max(0, range - (19 + chaos * 14)) * 0.15;
  const pcs = new Set(seq.map((p) => p % 12)).size;
  if (pcs < 3) score -= (3 - pcs) * (1.2 - chaos);

  // harmony: notes that land on tones of the song's current chord
  const scale = (SCALES[song.scale] ?? SCALES.major).steps;
  let fit = 0, count = 0;
  for (let i = 0; i < a.steps; i++) {
    const p = a.pitch[i];
    if (p === null) continue;
    const tones = new Set(chordTones(a.h[i], 3, 2, 0, song.root, song.scale, 4).map((m) => m % 12));
    // strong beats matter more
    const w = i % 4 === 0 ? 1.5 : 1;
    fit += tones.has(p % 12) ? w : 0;
    count += w;
  }
  if (scale.length > 3 && count) score += (fit / count) * 3 * (1 - chaos * 0.8);

  // a little self-similarity (motifs that come back) reads as intention
  const half = Math.floor(a.steps / 2);
  if (half >= 4) {
    let same = 0;
    for (let i = 0; i < half; i++) if (a.pitch[i] !== null && a.pitch[i] === a.pitch[i + half]) same++;
    score += (same / half) * 1.2 * (1 - chaos);
  }
  return score;
}

// ---------- entry points ----------

export interface MutationResult {
  track: Track;
  score: number;
  /** how many candidates were tried */
  tried: number;
}

export function mutateTrack(track: Track, song: Song, chaos: number, seed = Date.now(), candidates = 40): MutationResult {
  const rng = mulberry32(seed);
  const orig = renderTrack(track, song, 0, false);
  let best: MutationResult = { track, score: -Infinity, tried: 0 };
  for (let i = 0; i < candidates; i++) {
    // experimental mode sometimes compounds two mutations
    let graph = mutateGraph(track.graph, chaos, rng);
    if (chaos > 0.6 && rng() < chaos - 0.4) graph = mutateGraph(graph, chaos, rng);
    const cand: Track = { ...track, graph };
    if (track.waveform === 'custom' && rng() < 0.2 + chaos * 0.4) cand.timbre = mutateFormula(track.timbre, chaos, rng, TIMBRE_VARS);
    const score = musicalScore(renderTrack(cand, song, 0, false), orig, track, song, chaos);
    // a touch of randomness so equal-scoring candidates don't always win in order
    const jitter = rng() * 0.2 * (0.3 + chaos);
    if (score + jitter > best.score) best = { track: cand, score: score + jitter, tried: i + 1 };
  }
  best.tried = candidates;
  return best.score === -Infinity ? { track, score: -Infinity, tried: candidates } : best;
}

/**
 * Mutate one node only, by the same dial: try candidates for its settings and keep the
 * most musical. A node that doesn't reach the sound (yet) still gets a fresh roll.
 */
export function mutateOneNode(track: Track, song: Song, nodeId: string, chaos: number, seed = Date.now(), candidates = 30): MutationResult {
  const node = track.graph.nodes.find((n) => n.id === nodeId);
  if (!node || !NODE_DEFS[node.type]?.params.length) return { track, score: -Infinity, tried: 0 };
  const rng = mulberry32(seed);
  const onPitch = pitchPath(track.graph).has(nodeId);
  const orig = renderTrack(track, song, 0, false);
  const same = JSON.stringify(node.data);
  let best: MutationResult = { track, score: -Infinity, tried: candidates };
  let fallback: Track | null = null;
  for (let i = 0; i < candidates; i++) {
    const data = mutateNodeData(node, chaos, rng, onPitch);
    if (JSON.stringify(data) === same) continue;
    const cand: Track = { ...track, graph: { ...track.graph, nodes: track.graph.nodes.map((n) => (n.id === nodeId ? { ...n, data } : n)) } };
    const r = renderTrack(cand, song, 0, false);
    if (r.errors.size && !orig.errors.size) continue;
    fallback ??= cand;
    const score = musicalScore(r, orig, track, song, chaos) + rng() * 0.2 * (0.3 + chaos);
    if (score > best.score) best = { track: cand, score, tried: candidates };
  }
  // unheard changes score as "identical" — still better than nothing for the node you asked about
  if (best.score <= -50 && fallback) return { track: fallback, score: best.score, tried: candidates };
  return best.score === -Infinity ? { track, score: -Infinity, tried: candidates } : best;
}

/** Harmony: harmonious picks another well-known progression; experimental rewrites the formula. */
export function mutateHarmony(src: string, chaos: number, seed = Date.now()): string {
  const rng = mulberry32(seed);
  if (chaos < 0.45 || rng() < 0.3) return pick(rng, PROGRESSIONS.filter((p) => p.formula !== src)).formula;
  return mutateFormula(src, chaos, rng, ['bar', 'k', 'L']);
}
