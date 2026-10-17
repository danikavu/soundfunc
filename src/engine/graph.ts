import { compile, euclid, FUNCTIONS, CONSTANTS } from './expr';

export { euclid };

export interface StepCtx {
  /** step index within the pattern */
  n: number;
  /** progress through the pattern, 0 → 1 */
  x: number;
  /** time in beats since the pattern started */
  t: number;
  /** loop count (0 on first pass) — lets patterns evolve */
  k: number;
  /** pattern length in steps */
  steps: number;
  /** current chord of the song's harmony, as a scale degree */
  h: number;
  /** bar number since the song started (4 beats per bar) */
  bar: number;
  /** scale degrees per octave (7 for major, 5 for pentatonic…) */
  L: number;
}

export type NodeData = Record<string, string | number | boolean>;

export interface GNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: NodeData;
}

export interface GEdge {
  id: string;
  source: string;
  sourceHandle?: string | null;
  target: string;
  targetHandle?: string | null;
}

export interface Graph {
  nodes: GNode[];
  edges: GEdge[];
}

export interface PortDef {
  id: string;
  label: string;
  /** value when nothing is connected */
  fallback?: number | ((ctx: StepCtx, data: NodeData) => number);
}

export type ParamDef =
  | { key: string; label: string; kind: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: 'formula' }
  | { key: string; label: string; kind: 'text'; placeholder?: string };

export type Category = 'source' | 'math' | 'wave' | 'series' | 'rhythm' | 'output';

export interface NodeDef {
  type: string;
  label: string;
  category: Category;
  hint: string;
  defaults: NodeData;
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
  /** Build an evaluator. Throw to report a configuration error. */
  build: (data: NodeData) => (ins: number[], ctx: StepCtx) => number[];
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || d);

const WAVES: Record<string, (p: number) => number> = {
  sine: FUNCTIONS.sine.fn,
  triangle: FUNCTIONS.tri.fn,
  saw: FUNCTIONS.saw.fn,
  square: FUNCTIONS.sqr.fn,
};

const MATH_OPS: Record<string, { label: string; fn: (a: number, b: number) => number }> = {
  add: { label: 'a + b', fn: (a, b) => a + b },
  sub: { label: 'a − b', fn: (a, b) => a - b },
  mul: { label: 'a × b', fn: (a, b) => a * b },
  div: { label: 'a ÷ b', fn: (a, b) => (b === 0 ? 0 : a / b) },
  mod: { label: 'a mod b', fn: FUNCTIONS.mod.fn },
  pow: { label: 'a ^ b', fn: Math.pow },
  min: { label: 'min', fn: Math.min },
  max: { label: 'max', fn: Math.max },
  mix: { label: 'average', fn: (a, b) => (a + b) / 2 },
};

const UNARY = ['sin', 'cos', 'tan', 'abs', 'floor', 'round', 'ceil', 'fract', 'sqrt', 'exp', 'log', 'sign', 'tanh'];

const SERIES: Record<string, { label: string; fn: (n: number, p: number) => number }> = {
  fib: { label: 'Fibonacci', fn: (n) => FUNCTIONS.fib.fn(n) },
  prime: { label: 'Primes', fn: (n) => FUNCTIONS.prime.fn(n) },
  collatz: { label: 'Collatz steps', fn: (n) => FUNCTIONS.collatz.fn(n + 1) },
  logistic: { label: 'Logistic map (p = r)', fn: (n, p) => FUNCTIONS.logistic.fn(p || 3.7, n) },
  pi: { label: 'Digits of π', fn: (n) => Number(PI_DIGITS[Math.floor(n) % PI_DIGITS.length]) },
  phi: { label: 'Golden angle', fn: (n) => FUNCTIONS.fract.fn(n * CONSTANTS.phi) },
  random: { label: 'Random (p = seed)', fn: (n, p) => FUNCTIONS.rand.fn(n, p) },
  thue: { label: 'Thue–Morse', fn: (n) => popcount(Math.floor(n)) % 2 },
  triangular: { label: 'Triangular', fn: (n) => (n * (n + 1)) / 2 },
  recaman: { label: 'Recamán', fn: (n) => FUNCTIONS.recaman.fn(n) },
  lorenz: { label: 'Lorenz attractor', fn: (n) => FUNCTIONS.lorenz.fn(n) },
  sierpinski: { label: 'Sierpiński (p = row)', fn: (n, p) => ((Math.floor(n) & Math.floor(p || 7)) === 0 ? 1 : 0) },
};

/**
 * Drum-machine notation, one character per step (spaces and | are ignored):
 *   X accent · x hit · o ghost · 1–9 velocity in ninths · . - _ rest
 */
export function parsePattern(src: string): number[] {
  const out: number[] = [];
  for (const ch of src) {
    if (ch === ' ' || ch === '|') continue;
    if (ch === 'X') out.push(1);
    else if (ch === 'x') out.push(0.75);
    else if (ch === 'o' || ch === 'O') out.push(0.35);
    else if (ch >= '1' && ch <= '9') out.push(Number(ch) / 9);
    else out.push(0);
  }
  return out;
}

/** "0 3 5 7" or "0, 3, -2.5" → numbers */
export function parseList(src: string): number[] {
  return src
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((v) => Number.isFinite(v));
}

const PI_DIGITS =
  '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';

function popcount(n: number): number {
  let c = 0;
  n = Math.abs(n);
  while (n) {
    c += n & 1;
    n >>>= 1;
  }
  return c;
}

export const ctxVars = ['n', 'x', 't', 'k', 'steps', 'h', 'bar', 'L'] as const;

export const NODE_DEFS: Record<string, NodeDef> = {
  step: {
    type: 'step',
    label: 'Time',
    category: 'source',
    hint: 'The clock: step n, progress x (0→1), beats t, loop k, plus the current chord h and bar',
    defaults: {},
    inputs: [],
    outputs: [
      { id: 'n', label: 'n step' },
      { id: 'x', label: 'x 0→1' },
      { id: 't', label: 't beats' },
      { id: 'k', label: 'k loop' },
      { id: 'h', label: 'h chord' },
      { id: 'bar', label: 'bar' },
    ],
    params: [],
    build: () => (_i, c) => [c.n, c.x, c.t, c.k, c.h, c.bar],
  },
  number: {
    type: 'number',
    label: 'Number',
    category: 'source',
    hint: 'A constant you can tweak',
    defaults: { value: 1, min: -12, max: 12 },
    inputs: [],
    outputs: [{ id: 'out', label: 'value' }],
    params: [{ key: 'value', label: 'value', kind: 'number', step: 0.01 }],
    build: (d) => {
      const v = num(d.value);
      return () => [v];
    },
  },
  expr: {
    type: 'expr',
    label: 'Formula',
    category: 'math',
    hint: 'Write any expression. Use a, b, c inputs and n, x, t, k, h (chord), bar, L',
    defaults: { formula: 'sin(x * tau) * 4' },
    inputs: [
      { id: 'a', label: 'a', fallback: 0 },
      { id: 'b', label: 'b', fallback: 0 },
      { id: 'c', label: 'c', fallback: 0 },
    ],
    outputs: [{ id: 'out', label: 'out' }],
    params: [{ key: 'formula', label: 'f =', kind: 'formula' }],
    build: (d) => {
      const fn = compile(String(d.formula ?? '0'), ['a', 'b', 'c', ...ctxVars]).fn;
      const scope: Record<string, number> = {};
      return (ins, c) => {
        scope.a = ins[0];
        scope.b = ins[1];
        scope.c = ins[2];
        scope.n = c.n;
        scope.x = c.x;
        scope.t = c.t;
        scope.k = c.k;
        scope.steps = c.steps;
        scope.h = c.h;
        scope.bar = c.bar;
        scope.L = c.L;
        return [fn(scope)];
      };
    },
  },
  math: {
    type: 'math',
    label: 'Math',
    category: 'math',
    hint: 'Combine two values',
    defaults: { op: 'add', b: 1 },
    inputs: [
      { id: 'a', label: 'a', fallback: 0 },
      { id: 'b', label: 'b', fallback: (_c, d) => num(d.b, 1) },
    ],
    outputs: [{ id: 'out', label: 'out' }],
    params: [
      { key: 'op', label: 'op', kind: 'select', options: Object.entries(MATH_OPS).map(([value, o]) => ({ value, label: o.label })) },
      { key: 'b', label: 'b (if unlinked)', kind: 'number', step: 0.1 },
    ],
    build: (d) => {
      const f = (MATH_OPS[String(d.op)] ?? MATH_OPS.add).fn;
      return (ins) => [f(ins[0], ins[1])];
    },
  },
  func: {
    type: 'func',
    label: 'Function',
    category: 'math',
    hint: 'Apply a one-argument function',
    defaults: { fn: 'abs' },
    inputs: [{ id: 'x', label: 'x', fallback: (c) => c.x }],
    outputs: [{ id: 'out', label: 'out' }],
    params: [{ key: 'fn', label: 'fn', kind: 'select', options: UNARY.map((u) => ({ value: u, label: u })) }],
    build: (d) => {
      const f = (FUNCTIONS[String(d.fn)] ?? FUNCTIONS.abs).fn;
      return (ins) => [f(ins[0])];
    },
  },
  map: {
    type: 'map',
    label: 'Range',
    category: 'math',
    hint: 'Remap a value from one range to another',
    defaults: { inMin: -1, inMax: 1, outMin: 0, outMax: 7, clamp: true },
    inputs: [{ id: 'v', label: 'value', fallback: 0 }],
    outputs: [{ id: 'out', label: 'out' }],
    params: [
      { key: 'inMin', label: 'in min', kind: 'number', step: 0.1 },
      { key: 'inMax', label: 'in max', kind: 'number', step: 0.1 },
      { key: 'outMin', label: 'out min', kind: 'number', step: 0.1 },
      { key: 'outMax', label: 'out max', kind: 'number', step: 0.1 },
    ],
    build: (d) => {
      const a = num(d.inMin), b = num(d.inMax, 1), c = num(d.outMin), e = num(d.outMax, 1);
      const clamp = d.clamp !== false;
      return (ins) => {
        let u = b === a ? 0 : (ins[0] - a) / (b - a);
        if (clamp) u = Math.min(1, Math.max(0, u));
        return [c + (e - c) * u];
      };
    },
  },
  wave: {
    type: 'wave',
    label: 'Wave',
    category: 'wave',
    hint: 'A periodic wave: cycles per pattern, amplitude, offset',
    defaults: { shape: 'sine', cycles: 1, amp: 4, offset: 0 },
    inputs: [{ id: 'p', label: 'phase', fallback: (c) => c.x }],
    outputs: [{ id: 'out', label: 'out' }],
    params: [
      { key: 'shape', label: 'shape', kind: 'select', options: Object.keys(WAVES).map((w) => ({ value: w, label: w })) },
      { key: 'cycles', label: 'cycles', kind: 'number', step: 0.25 },
      { key: 'amp', label: 'amp', kind: 'number', step: 0.5 },
      { key: 'offset', label: 'offset', kind: 'number', step: 0.5 },
    ],
    build: (d) => {
      const w = WAVES[String(d.shape)] ?? WAVES.sine;
      const cy = num(d.cycles, 1), amp = num(d.amp, 1), off = num(d.offset);
      return (ins) => [off + amp * w(ins[0] * cy)];
    },
  },
  series: {
    type: 'series',
    label: 'Sequence',
    category: 'series',
    hint: 'Famous number sequences, chaos and randomness',
    defaults: { kind: 'fib', p: 0, modulo: 7 },
    inputs: [{ id: 'n', label: 'n', fallback: (c) => c.n }],
    outputs: [{ id: 'out', label: 'out' }],
    params: [
      { key: 'kind', label: 'sequence', kind: 'select', options: Object.entries(SERIES).map(([value, s]) => ({ value, label: s.label })) },
      { key: 'p', label: 'p', kind: 'number', step: 0.01 },
      { key: 'modulo', label: 'mod (0 = off)', kind: 'number', step: 1 },
    ],
    build: (d) => {
      const s = (SERIES[String(d.kind)] ?? SERIES.fib).fn;
      const p = num(d.p), m = num(d.modulo);
      return (ins) => {
        const v = s(ins[0], p);
        return [m > 0 ? FUNCTIONS.mod.fn(v, m) : v];
      };
    },
  },
  euclid: {
    type: 'euclid',
    label: 'Euclid Rhythm',
    category: 'rhythm',
    hint: 'Spread pulses evenly over steps — outputs 1 on hits, 0 on rests',
    defaults: { pulses: 5, length: 8, rotate: 0 },
    inputs: [{ id: 'n', label: 'n', fallback: (c) => c.n }],
    outputs: [{ id: 'out', label: 'gate' }],
    params: [
      { key: 'pulses', label: 'pulses', kind: 'number', step: 1, min: 0 },
      { key: 'length', label: 'length', kind: 'number', step: 1, min: 1 },
      { key: 'rotate', label: 'rotate', kind: 'number', step: 1 },
    ],
    build: (d) => {
      const p = num(d.pulses, 3), l = num(d.length, 8), r = num(d.rotate);
      return (ins) => [euclid(ins[0], p, l, r)];
    },
  },
  pattern: {
    type: 'pattern',
    label: 'Pattern',
    category: 'rhythm',
    hint: 'Type a beat: X accent, x hit, o ghost, . rest — outputs velocity',
    defaults: { pattern: 'X...x...X..x..o.', rotate: 0 },
    inputs: [{ id: 'n', label: 'n', fallback: (c) => c.n }],
    outputs: [{ id: 'out', label: 'velocity' }],
    params: [
      { key: 'pattern', label: 'beat', kind: 'text', placeholder: 'X..o x...' },
      { key: 'rotate', label: 'rotate', kind: 'number', step: 1 },
    ],
    build: (d) => {
      const pat = parsePattern(String(d.pattern ?? ''));
      const r = num(d.rotate);
      return (ins) => [pat.length ? pat[FUNCTIONS.mod.fn(Math.floor(ins[0]) + r, pat.length)] : 0];
    },
  },
  list: {
    type: 'list',
    label: 'Steps',
    category: 'series',
    hint: 'A list of values played in order — basslines, chords, riffs',
    defaults: { values: '0 0 3 5', every: 4 },
    inputs: [{ id: 'n', label: 'n', fallback: (c) => c.n }],
    outputs: [{ id: 'out', label: 'value' }],
    params: [
      { key: 'values', label: 'values', kind: 'text', placeholder: '0 3 5 7' },
      { key: 'every', label: 'hold steps', kind: 'number', step: 1, min: 1 },
    ],
    build: (d) => {
      const vals = parseList(String(d.values ?? ''));
      const every = Math.max(1, num(d.every, 1));
      return (ins) => [vals.length ? vals[FUNCTIONS.mod.fn(Math.floor(ins[0] / every), vals.length)] : 0];
    },
  },
  chance: {
    type: 'chance',
    label: 'Chance',
    category: 'rhythm',
    hint: 'Deterministic coin flip: 1 with probability p',
    defaults: { p: 0.7, seed: 1 },
    inputs: [{ id: 'n', label: 'n', fallback: (c) => c.n + c.k * c.steps }],
    outputs: [{ id: 'out', label: 'gate' }],
    params: [
      { key: 'p', label: 'probability', kind: 'number', step: 0.05, min: 0, max: 1 },
      { key: 'seed', label: 'seed', kind: 'number', step: 1 },
    ],
    build: (d) => {
      const p = num(d.p, 0.5), seed = num(d.seed);
      return (ins) => [FUNCTIONS.rand.fn(ins[0], seed) < p ? 1 : 0];
    },
  },
  output: {
    type: 'output',
    label: 'Note Out',
    category: 'output',
    hint: 'pitch · velocity (0 = rest) · length in steps · shift (late by part of a step) · ratchet (repeats) · chord (tones stacked every `stack` degrees) · inversion · strum',
    defaults: {},
    inputs: [
      { id: 'pitch', label: 'pitch', fallback: 0 },
      { id: 'velocity', label: 'velocity', fallback: 0.8 },
      { id: 'length', label: 'length', fallback: 1 },
      { id: 'shift', label: 'shift', fallback: 0 },
      { id: 'ratchet', label: 'ratchet', fallback: 1 },
      { id: 'chord', label: 'chord', fallback: 1 },
      { id: 'stack', label: 'stack', fallback: 2 },
      { id: 'inversion', label: 'inversion', fallback: 0 },
      { id: 'strum', label: 'strum', fallback: 0 },
    ],
    outputs: [],
    params: [],
    build: () => (ins) => ins,
  },
};

export const CATEGORY_LABELS: Record<Category, string> = {
  source: 'Sources',
  math: 'Math',
  wave: 'Waves',
  series: 'Sequences',
  rhythm: 'Rhythm',
  output: 'Output',
};

// ---------- evaluation ----------

export interface StepOutput {
  pitch: number;
  velocity: number;
  length: number;
  shift: number;
  ratchet: number;
  chord: number;
  stack: number;
  inversion: number;
  strum: number;
}

export interface GraphProgram {
  /** evaluate one step; also fills `trace` if provided */
  run: (ctx: StepCtx, trace?: Map<string, number[]>) => StepOutput | null;
  errors: Map<string, string>;
}

export function compileGraph(graph: Graph): GraphProgram {
  const errors = new Map<string, string>();
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, GEdge[]>();
  for (const e of graph.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    const list = incoming.get(e.target) ?? [];
    list.push(e);
    incoming.set(e.target, list);
  }

  // topological order with cycle detection
  const order: GNode[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (n: GNode) => {
    const s = state.get(n.id);
    if (s === 2) return;
    if (s === 1) {
      errors.set(n.id, 'Cycle detected');
      return;
    }
    state.set(n.id, 1);
    for (const e of incoming.get(n.id) ?? []) visit(byId.get(e.source)!);
    state.set(n.id, 2);
    order.push(n);
  };
  graph.nodes.forEach(visit);

  interface Step {
    node: GNode;
    def: NodeDef;
    eval: (ins: number[], ctx: StepCtx) => number[];
    sources: ({ node: string; idx: number } | null)[];
  }
  const steps: Step[] = [];
  for (const node of order) {
    const def = NODE_DEFS[node.type];
    if (!def) continue;
    let ev: Step['eval'];
    try {
      ev = def.build(node.data);
    } catch (e) {
      errors.set(node.id, e instanceof Error ? e.message : String(e));
      ev = () => def.outputs.map(() => 0);
    }
    const sources = def.inputs.map((inp) => {
      const e = (incoming.get(node.id) ?? []).find((x) => x.targetHandle === inp.id);
      if (!e) return null;
      const src = byId.get(e.source)!;
      const sdef = NODE_DEFS[src.type];
      const idx = sdef ? Math.max(0, sdef.outputs.findIndex((o) => o.id === e.sourceHandle)) : 0;
      return { node: e.source, idx };
    });
    steps.push({ node, def, eval: ev, sources });
  }

  const outputNode = steps.find((s) => s.def.type === 'output');
  const values = new Map<string, number[]>();

  return {
    errors,
    run(ctx, trace) {
      values.clear();
      for (const s of steps) {
        const ins = s.def.inputs.map((inp, i) => {
          const src = s.sources[i];
          if (src) return values.get(src.node)?.[src.idx] ?? 0;
          const fb = inp.fallback;
          return typeof fb === 'function' ? fb(ctx, s.node.data) : fb ?? 0;
        });
        let out: number[];
        try {
          out = s.eval(ins, ctx).map((v) => (Number.isFinite(v) ? v : 0));
        } catch {
          out = s.def.outputs.map(() => 0);
        }
        values.set(s.node.id, out);
        if (trace) {
          // output node traces its inputs; others trace their first output
          const v = s.def.type === 'output' ? ins[0] : out[0];
          let arr = trace.get(s.node.id);
          if (!arr) trace.set(s.node.id, (arr = []));
          arr.push(v);
        }
      }
      if (!outputNode) return null;
      const o = values.get(outputNode.node.id)!;
      return { pitch: o[0], velocity: o[1], length: o[2], shift: o[3], ratchet: o[4], chord: o[5], stack: o[6], inversion: o[7], strum: o[8] };
    },
  };
}
