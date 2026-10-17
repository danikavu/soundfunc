import { NODE_DEFS, type GEdge, type GNode, type Graph, type NodeData } from './graph';
import type { PitchMode } from './music';
import { TRACK_DEFAULTS, type DrumVoice, type Project, type Song, type Track, type Waveform } from './project';

export const TRACK_COLORS = ['#c4583d', '#6f8a63', '#4a5d7e', '#b39561', '#8a6a7e', '#5e8a86', '#6f6a62'];

type N = [id: string, type: string, x: number, y: number, data?: NodeData];
type E = [source: string, sourceHandle: string, target: string, targetHandle: string];

/** rough rendered height of a node card, so columns can stack without overlap */
function nodeHeight(node: GNode): number {
  const d = NODE_DEFS[node.type];
  // long formulas wrap onto several lines (~30 characters each)
  const formulaLines = node.type === 'expr' ? Math.ceil(String(node.data.formula ?? '').length / 30) - 1 : 0;
  return 70 + (d.inputs.length + d.outputs.length) * 21 + d.params.length * 30 + formulaLines * 18 + (node.type === 'number' ? 24 : 0) + (node.type === 'step' ? 0 : 36);
}

/** Layered layout: column = depth from the sources, rows stacked by height. */
export function layoutGraph(g: Graph): Graph {
  const depth = new Map<string, number>();
  const into = (id: string) => g.edges.filter((e) => e.target === id).map((e) => e.source);
  const walk = (id: string, seen = new Set<string>()): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const d = Math.max(-1, ...into(id).map((s) => walk(s, seen))) + 1;
    depth.set(id, d);
    return d;
  };
  g.nodes.forEach((n) => walk(n.id));
  // the output always sits in the last column; unwired sources sit next to what they feed
  const maxD = Math.max(...depth.values());
  for (const n of g.nodes) if (n.type === 'output') depth.set(n.id, Math.max(maxD, 1));
  const byDepth = new Map<number, GNode[]>();
  for (const n of g.nodes) {
    const d = depth.get(n.id)!;
    byDepth.set(d, [...(byDepth.get(d) ?? []), n]);
  }
  // wrap tall columns into several, so wide graphs stay readable at a normal zoom
  const MAX_H = 560, GAP = 28;
  const columns: GNode[][] = [];
  for (const d of [...byDepth.keys()].sort((a, b) => a - b)) {
    let col: GNode[] = [];
    let h = -GAP;
    for (const n of byDepth.get(d)!) {
      if (col.length && h + GAP + nodeHeight(n) > MAX_H) {
        columns.push(col);
        (col = []), (h = -GAP);
      }
      col.push(n);
      h += GAP + nodeHeight(n);
    }
    columns.push(col);
  }
  const colH = (c: GNode[]) => c.reduce((h, n) => h + nodeHeight(n) + GAP, -GAP);
  const tallest = Math.max(...columns.map(colH));
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((col, ci) => {
    let y = (tallest - colH(col)) / 2;
    for (const n of col) {
      pos.set(n.id, { x: ci * 280, y });
      y += nodeHeight(n) + GAP;
    }
  });
  const nodes = g.nodes.map((n) => ({ ...n, position: pos.get(n.id)! }));
  return { nodes, edges: g.edges };
}

function graph(nodes: N[], edges: E[]): Graph {
  return layoutGraph({
    nodes: nodes.map(([id, type, x, y, data]): GNode => ({ id, type, position: { x, y }, data: { ...data } })),
    edges: edges.map(([source, sourceHandle, target, targetHandle]): GEdge => ({
      id: `${source}.${sourceHandle}-${target}.${targetHandle}`,
      source,
      sourceHandle,
      target,
      targetHandle,
    })),
  });
}

/** compact graph builder: nodes by id, wires as 'src.handle>dst.handle' */
function wire(nodes: Record<string, [type: string, data?: NodeData]>, wires: string[]): Graph {
  return graph(
    Object.entries(nodes).map(([id, [type, data]]): N => [id, type, 0, 0, { ...NODE_DEFS[type].defaults, ...data }]),
    wires.map((w): E => {
      const [a, b] = w.split('>');
      const [s, sh] = a.split('.');
      const [t, th] = b.split('.');
      return [s, sh, t, th];
    }),
  );
}

type Template = Partial<Track> & { graph: Graph };

export interface Preset {
  id: string;
  name: string;
  description: string;
  formula: string;
  track: Template & { waveform: Waveform; pitchMode: PitchMode };
}

export interface Kit {
  id: string;
  name: string;
  description: string;
  song?: Partial<Song>;
  tracks: (Template & { name: string })[];
}

const OUT_X = 640;

export const PRESETS: Preset[] = [
  {
    id: 'pond',
    name: 'Still Pond',
    description: 'One slow sine wave. The simplest melody.',
    formula: 'pitch = 4·sin(2πx)',
    track: {
      waveform: 'bell',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.5,
      octave: 5,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['wave', 'wave', 260, 40, { shape: 'sine', cycles: 1, amp: 4, offset: 0 }],
          ['vel', 'number', 260, 260, { value: 0.7 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['time', 'x', 'wave', 'p'],
          ['wave', 'out', 'out', 'pitch'],
          ['vel', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'fib',
    name: 'Fibonacci Spiral',
    description: 'Fibonacci numbers folded into the scale with a Euclidean pulse.',
    formula: 'pitch = fib(n) mod 7 · gate = E(5,8)',
    track: {
      waveform: 'pluck',
      pitchMode: 'degree',
      steps: 32,
      stepBeats: 0.25,
      octave: 4,
      graph: graph(
        [
          ['time', 'step', 0, 100],
          ['fib', 'series', 260, 20, { kind: 'fib', p: 0, modulo: 7 }],
          ['eu', 'euclid', 260, 230, { pulses: 5, length: 8, rotate: 0 }],
          ['vel', 'math', 460, 250, { op: 'mul', b: 0.8 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['time', 'n', 'fib', 'n'],
          ['time', 'n', 'eu', 'n'],
          ['fib', 'out', 'out', 'pitch'],
          ['eu', 'out', 'vel', 'a'],
          ['vel', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'chaos',
    name: 'Chaos Bloom',
    description: 'The logistic map at r = 3.7 — order dissolving into chaos.',
    formula: 'xₙ₊₁ = r·xₙ(1 − xₙ)',
    track: {
      waveform: 'flute',
      pitchMode: 'degree',
      steps: 24,
      stepBeats: 0.5,
      octave: 4,
      attack: 0.08,
      release: 0.6,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['log', 'series', 240, 20, { kind: 'logistic', p: 3.7, modulo: 0 }],
          ['map', 'map', 460, 20, { inMin: 0, inMax: 1, outMin: 0, outMax: 10, clamp: true }],
          ['vel', 'expr', 240, 260, { formula: '0.35 + 0.5 * noise(n * 0.4)' }],
          ['out', 'output', OUT_X + 60, 140],
        ],
        [
          ['time', 'n', 'log', 'n'],
          ['log', 'out', 'map', 'v'],
          ['map', 'out', 'out', 'pitch'],
          ['vel', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'golden',
    name: 'Golden Rain',
    description: 'Each drop lands at n·φ — never repeating, always balanced.',
    formula: 'pitch = 12·fract(n·φ)',
    track: {
      waveform: 'bell',
      pitchMode: 'degree',
      steps: 21,
      stepBeats: 0.375,
      octave: 4,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['phi', 'expr', 260, 20, { formula: 'floor(12 * fract(n * phi))' }],
          ['ch', 'chance', 260, 220, { p: 0.75, seed: 3 }],
          ['vel', 'expr', 460, 220, { formula: 'a * (0.4 + 0.5 * rand(n, 9))' }],
          ['out', 'output', OUT_X + 40, 100],
        ],
        [
          ['phi', 'out', 'out', 'pitch'],
          ['ch', 'out', 'vel', 'a'],
          ['vel', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'pi',
    name: 'Digits of π',
    description: 'π read one digit at a time, played on the scale.',
    formula: 'pitch = πₙ',
    track: {
      waveform: 'triangle',
      pitchMode: 'degree',
      steps: 32,
      stepBeats: 0.25,
      octave: 4,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['pi', 'series', 260, 20, { kind: 'pi', p: 0, modulo: 0 }],
          ['eu', 'euclid', 260, 240, { pulses: 7, length: 12, rotate: 2 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['time', 'n', 'pi', 'n'],
          ['time', 'n', 'eu', 'n'],
          ['pi', 'out', 'out', 'pitch'],
          ['eu', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'collatz',
    name: 'Collatz Path',
    description: 'How many steps each number takes to fall back to 1.',
    formula: 'pitch = collatz(n) mod 12',
    track: {
      waveform: 'square',
      pitchMode: 'semitone',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.6,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['col', 'series', 260, 40, { kind: 'collatz', p: 0, modulo: 12 }],
          ['vel', 'expr', 260, 250, { formula: 'n % 4 == 0 ? 0.9 : 0.55' }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['time', 'n', 'col', 'n'],
          ['col', 'out', 'out', 'pitch'],
          ['vel', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'lissajous',
    name: 'Lissajous',
    description: 'Two sines at 3:2 interfere into a looping figure.',
    formula: 'pitch = 3·sin(3τx) + 2·cos(2τx)',
    track: {
      waveform: 'sine',
      pitchMode: 'degree',
      steps: 32,
      stepBeats: 0.25,
      octave: 5,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['f', 'expr', 260, 60, { formula: '3*sin(3*tau*x) + 2*cos(2*tau*x)' }],
          ['len', 'number', 260, 260, { value: 0.8 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['f', 'out', 'out', 'pitch'],
          ['len', 'out', 'out', 'length'],
        ],
      ),
    },
  },
  {
    id: 'bass',
    name: 'Breathing Bass',
    description: 'A slow triangle wave, deep and long.',
    formula: 'pitch = 2·tri(x/2)',
    track: {
      waveform: 'pad',
      pitchMode: 'degree',
      steps: 8,
      stepBeats: 1,
      octave: 2,
      volume: 0.7,
      attack: 0.3,
      release: 1.2,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['wave', 'wave', 260, 40, { shape: 'triangle', cycles: 0.5, amp: 2, offset: 0 }],
          ['len', 'number', 260, 270, { value: 2 }],
          ['eu', 'euclid', 260, 400, { pulses: 1, length: 2, rotate: 0 }],
          ['out', 'output', OUT_X, 140],
        ],
        [
          ['time', 'x', 'wave', 'p'],
          ['time', 'n', 'eu', 'n'],
          ['wave', 'out', 'out', 'pitch'],
          ['len', 'out', 'out', 'length'],
          ['eu', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'evolve',
    name: 'Evolving Tide',
    description: 'Uses the loop counter k — the melody shifts every pass.',
    formula: 'pitch = 3·sin(τx + k/2) + (k mod 3)',
    track: {
      waveform: 'sawtooth',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.55,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['f', 'expr', 260, 40, { formula: '3*sin(tau*x + k/2) + (k % 3)' }],
          ['vel', 'expr', 260, 240, { formula: '0.3 + 0.6 * abs(saw(x * 2))' }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['f', 'out', 'out', 'pitch'],
          ['vel', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'theremin',
    name: 'Theremin',
    description: 'Glide mode: the pitch follows the curve continuously, with vibrato — no notes at all.',
    formula: 'y = 7·sin(2πx) + 0.3·sin(48πx)',
    track: {
      waveform: 'sine',
      pitchMode: 'semitone',
      playMode: 'glide',
      quantize: false,
      glide: 0.02,
      steps: 16,
      stepBeats: 0.5,
      octave: 5,
      attack: 0.2,
      release: 0.5,
      graph: wire(
        {
          f: ['expr', { formula: '7*sin(tau*x) + 0.3*sin(24*tau*x)' }],
          v: ['expr', { formula: '0.5 + 0.35*sin(tau*x*2)^2' }],
          out: ['output'],
        },
        ['f.out>out.pitch', 'v.out>out.velocity'],
      ),
    },
  },
  {
    id: 'lorenzGlide',
    name: 'Lorenz Glide',
    description: 'A strange attractor sliding between scale notes with portamento.',
    formula: 'dx/dt = σ(y − x) …',
    track: {
      waveform: 'flute',
      pitchMode: 'degree',
      playMode: 'glide',
      quantize: true,
      glide: 0.12,
      steps: 32,
      stepBeats: 0.25,
      octave: 4,
      graph: wire(
        {
          time: ['step'],
          lz: ['series', { kind: 'lorenz', modulo: 0 }],
          map: ['map', { inMin: -1, inMax: 1, outMin: -3, outMax: 9 }],
          v: ['expr', { formula: '0.75 * smoothstep(0, 0.15, fract(x*4)) ' }],
          out: ['output'],
        },
        ['time.n>lz.n', 'lz.out>map.v', 'map.out>out.pitch', 'v.out>out.velocity'],
      ),
    },
  },
  {
    id: 'recaman',
    name: 'Recamán’s Ladder',
    description: 'Step back if you can, forward if you must — a famous self-avoiding walk.',
    formula: 'aₙ = aₙ₋₁ − n or + n',
    track: {
      waveform: 'pluck',
      pitchMode: 'degree',
      steps: 32,
      stepBeats: 0.25,
      octave: 4,
      graph: wire(
        {
          time: ['step'],
          r: ['series', { kind: 'recaman', modulo: 14 }],
          eu: ['euclid', { pulses: 11, length: 16 }],
          v: ['expr', { formula: 'a * (0.5 + 0.4 * rand(n, 2))' }],
          out: ['output'],
        },
        ['time.n>r.n', 'r.out>out.pitch', 'time.n>eu.n', 'eu.out>v.a', 'v.out>out.velocity'],
      ),
    },
  },
  {
    id: 'sierpinski',
    name: 'Sierpiński Bells',
    description: 'Bitwise AND draws a fractal triangle; here it rings bells. Changes each loop.',
    formula: 'gate = (n AND k+3) == 0',
    track: {
      waveform: 'bell',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 5,
      graph: wire(
        {
          p: ['expr', { formula: 'bit(n,0) + 2*bit(n,2) + 3*bit(n,3)' }],
          v: ['expr', { formula: 'band(n, k + 3) == 0 ? 0.8 : 0' }],
          out: ['output'],
        },
        ['p.out>out.pitch', 'v.out>out.velocity'],
      ),
    },
  },
  {
    id: 'wavetable',
    name: 'Wavefolder',
    description: 'The sound itself is a function: f(p) = sin(2πp + 2·sin(2πp)). Edit it in Track → Voice.',
    formula: 'timbre = sin(τp + 2 sin τp)',
    track: {
      waveform: 'custom',
      timbre: 'sin(tau*p + 2*sin(tau*p))',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 3,
      graph: wire(
        {
          p: ['expr', { formula: 'h + pick(floor(n / 2), 0, 2, 4, 2, 5, 4, 2, 1)' }],
          v: ['expr', { formula: 'euclid(n, 11, 16) * (0.55 + 0.45 * every(n, 4))' }],
          out: ['output'],
        },
        ['p.out>out.pitch', 'v.out>out.velocity'],
      ),
    },
  },
  {
    id: 'chordPad',
    name: 'Chord Pad',
    description: 'Holds the song’s current chord: pitch = h, chord = 4 stacks four scale-thirds (a 7th chord).',
    formula: 'pitch = h · chord = 4',
    track: {
      waveform: 'pad',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 3,
      attack: 0.4,
      release: 1.6,
      send: 0.9,
      volume: 0.55,
      graph: wire(
        {
          p: ['expr', { formula: 'h' }],
          v: ['expr', { formula: '0.55 * every(n, 16)' }],
          chord: ['number', { value: 4, min: 1, max: 8 }],
          length: ['number', { value: 16, min: 0, max: 32 }],
          out: ['output'],
        },
        ['p.out>out.pitch', 'v.out>out.velocity', 'chord.out>out.chord', 'length.out>out.length'],
      ),
    },
  },
  {
    id: 'strum',
    name: 'Koto Strum',
    description: 'Strummed triads on the progression; inversions rotate every beat so the top voice moves.',
    formula: 'inversion = ⌊n/4⌋ mod 3',
    track: {
      waveform: 'pluck',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.55,
      send: 0.6,
      graph: wire(
        {
          p: ['expr', { formula: 'h' }],
          v: ['expr', { formula: '0.75 * euclid(n, 5, 16)' }],
          chord: ['number', { value: 3, min: 1, max: 8 }],
          inv: ['expr', { formula: 'floor(n / 4) % 3' }],
          strum: ['number', { value: 0.08, min: -0.5, max: 0.5 }],
          out: ['output'],
        },
        ['p.out>out.pitch', 'v.out>out.velocity', 'chord.out>out.chord', 'inv.out>out.inversion', 'strum.out>out.strum'],
      ),
    },
  },
  {
    id: 'arp',
    name: 'Arpeggiator',
    description: 'Walks up and down the current chord: h + 0, 2, 4 (root, third, fifth) and L (the octave).',
    formula: 'pitch = h + pick(n, 0, 2, 4, L, 4, 2)',
    track: {
      waveform: 'triangle',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.5,
      graph: wire(
        {
          p: ['expr', { formula: 'h + pick(n, 0, 2, 4, L, 4, 2)' }],
          v: ['expr', { formula: '0.4 + 0.4 * every(n, 3)' }],
          out: ['output'],
        },
        ['p.out>out.pitch', 'v.out>out.velocity'],
      ),
    },
  },
  {
    id: 'quartal',
    name: 'Quartal Mist',
    description: 'Chords stacked in fourths (stack = 3) instead of thirds — open, modal, very zen.',
    formula: 'chord = 4 · stack = 3',
    track: {
      waveform: 'flute',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.5,
      octave: 4,
      attack: 0.2,
      release: 1,
      send: 1,
      volume: 0.45,
      graph: wire(
        {
          p: ['expr', { formula: 'h + round(2 * sin(tau * x))' }],
          v: ['expr', { formula: '0.5 * every(n, 4)' }],
          chord: ['number', { value: 4, min: 1, max: 8 }],
          stack: ['number', { value: 3, min: 1, max: 7 }],
          length: ['number', { value: 4, min: 0, max: 16 }],
          out: ['output'],
        },
        ['p.out>out.pitch', 'v.out>out.velocity', 'chord.out>out.chord', 'stack.out>out.stack', 'length.out>out.length'],
      ),
    },
  },
  {
    id: 'blank',
    name: 'Empty Garden',
    description: 'Just a clock and an output. Start from nothing.',
    formula: 'pitch = ?',
    track: {
      waveform: 'sine',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['f', 'expr', 260, 60, { formula: 'n % 8' }],
          ['out', 'output', OUT_X, 100],
        ],
        [['f', 'out', 'out', 'pitch']],
      ),
    },
  },
];


// ---------- rhythm kits: several tracks planted together, all pure functions ----------

/** a drum track whose velocity (and optional ratchet / tuning) are formulas of n, k, x… */
function drum(
  name: string,
  waveform: DrumVoice,
  steps: number,
  vel: string,
  opts: Partial<Track> & { ratchet?: string; tune?: string } = {},
): Template & { name: string } {
  const { ratchet, tune, ...rest } = opts;
  const nodes: Record<string, [string, NodeData?]> = { vel: ['expr', { formula: vel }], out: ['output'] };
  const wires = ['vel.out>out.velocity'];
  if (ratchet) {
    nodes.rat = ['expr', { formula: ratchet }];
    wires.push('rat.out>out.ratchet');
  }
  if (tune) {
    nodes.tune = ['expr', { formula: tune }];
    wires.push('tune.out>out.pitch');
  }
  return { name, waveform, steps, stepBeats: 0.25, send: 0.12, volume: 0.8, graph: wire(nodes, wires), ...rest };
}

/** a melodic track: pitch & velocity formulas, plus optional constants/formulas for other Note Out inputs */
function voice(
  name: string,
  waveform: Waveform,
  pitch: string,
  vel: string,
  inputs: Partial<Record<'length' | 'chord' | 'stack' | 'inversion' | 'strum' | 'shift' | 'ratchet', number | string>>,
  rest: Partial<Track>,
): Template & { name: string } {
  const nodes: Record<string, [string, NodeData?]> = {
    pitch: ['expr', { formula: pitch }],
    vel: ['expr', { formula: vel }],
    out: ['output'],
  };
  const wires = ['pitch.out>out.pitch', 'vel.out>out.velocity'];
  for (const [port, v] of Object.entries(inputs)) {
    nodes[port] = typeof v === 'number' ? ['number', { value: v, min: 0, max: 16 }] : ['expr', { formula: v }];
    wires.push(`${port}.out>out.${port}`);
  }
  return { name, waveform, steps: 16, stepBeats: 0.25, graph: wire(nodes, wires), ...rest };
}

/** the four bars of the Amen break as 16-bit masks, read with bits() */
const AMEN = {
  kick: 'bits(pick(floor(n / 16), 0xA030, 0xA030, 0xA020, 0x3020), n)',
  snare: 'bits(pick(floor(n / 16), 0x0808, 0x0808, 0x0802, 0x0802), n) + 0.4 * bits(pick(floor(n / 16), 0x0141, 0x0141, 0x4140, 0x4140), n)',
};

export const KITS: Kit[] = [
  {
    id: 'dnb',
    name: 'Two-Step DnB',
    description: '174 bpm, liquid. Two-step kick & backbeat from every(), random ghost snares, a roll every 4th bar, a pumping Reese and 7th-chord pads following the harmony.',
    song: { bpm: 174, root: 5, scale: 'minor', harmony: 'pick(floor(bar / 2), 0, 5, 3, 4)' },
    tracks: [
      drum('Kick', 'kick', 32, 'every(n, 16) + 0.9 * every(n, 16, 10) + 0.7 * every(n, 32, 29) * (k % 2)', { volume: 0.95 }),
      drum('Snare', 'snare', 32, 'n >= 28 && k % 4 == 3 ? 0.4 + (n - 28) * 0.15 : max(every(n, 8, 4), 0.3 * chance(n + 32k, 0.16, 7) * (1 - every(n, 2)))', {
        ratchet: 'n >= 28 && k % 4 == 3 ? 4 : 1',
      }),
      drum('Hats', 'hat', 16, '0.4 + 0.4 * every(n, 4, 2) + 0.15 * rand(n + 16k, 7)', { swing: 0.08, volume: 0.55 }),
      drum('Crash', 'crash', 32, 'n == 0 && k % 4 == 0 ? 0.5 : 0', { send: 0.5, volume: 0.5 }),
      voice('Reese', 'reese', 'h', '0.2 + 0.7 * smoothstep(0, 0.7, phase(x * steps, 4))', {}, {
        playMode: 'glide', quantize: true, glide: 0.06, octave: 2, steps: 32, send: 0.1, volume: 0.7, release: 0.1,
      }),
      voice('Pads', 'pad', 'h', '0.45 * every(n, 32)', { chord: 4, length: 32 }, { octave: 3, steps: 32, send: 0.9, volume: 0.45, attack: 0.4, release: 1.5 }),
    ],
  },
  {
    id: 'amen',
    name: 'Amen Break',
    description: '170 bpm. The most sampled break in history as four hex numbers per drum — bits(0xA030, n) is bar one of the kick.',
    song: { bpm: 170, root: 9, scale: 'minor', harmony: 'pick(bar, 0, 0, 5, 3)' },
    tracks: [
      drum('Kick', 'kick', 64, AMEN.kick),
      drum('Snare', 'snare', 64, AMEN.snare),
      drum('Ride', 'hat', 16, 'every(n, 2) * (0.5 + 0.3 * bit(n, 2))', { volume: 0.55 }),
      drum('Crash', 'crash', 64, 'every(n, 64, 58) * 0.6', { volume: 0.45, send: 0.4 }),
      voice('Sub', 'sine', 'h', 'phase(n, 16) < 0.85 ? 0.8 : 0', {}, { playMode: 'glide', quantize: true, glide: 0.05, octave: 2, steps: 64, send: 0, volume: 0.8, release: 0.08 }),
    ],
  },
  {
    id: 'jungle',
    name: 'Jungle Roller',
    description: '172 bpm, generative. Euclidean kicks, chance ghost snares that roll, noisy hats, a Lorenz-driven bass — never the same bar twice.',
    song: { bpm: 172, root: 7, scale: 'dorian', harmony: 'pick(bar, 0, 0, 3, 4)' },
    tracks: [
      drum('Kick', 'kick', 16, 'euclid(n, 3, 16)'),
      drum('Snare', 'snare', 16, 'max(every(n, 8, 4), chance(n + 16k, 0.22, 5) * (0.2 + 0.2 * rand(n, 1)))', {
        ratchet: 'every(n, 8, 4) == 0 && rand(n + 16k, 9) > 0.8 ? pick(n, 2, 3) : 1',
      }),
      drum('Hats', 'hat', 16, '0.35 + 0.45 * noise(n * 0.7 + 3k)', { ratchet: 'rand(n + 16k, 11) > 0.9 ? 3 : 1', tune: '4 * rand(n, 2) - 2', volume: 0.5, swing: 0.1 }),
      voice('Lorenz Bass', 'reese', 'h + floor(3 * lorenz(floor(n / 4) + 4k))', '0.25 + 0.6 * smoothstep(0, 0.6, phase(x * steps, 4))', {}, {
        playMode: 'glide', quantize: true, glide: 0.09, octave: 2, send: 0.1, volume: 0.7, release: 0.1,
      }),
      voice('Recamán Pluck', 'pluck', 'h + recaman(n) % 8', 'euclid(n, 5, 16, 3)', {}, { octave: 5, steps: 32, volume: 0.4, send: 0.6, pan: -0.3 }),
    ],
  },
  {
    id: 'house',
    name: 'Four on the Floor',
    description: '124 bpm house: every(n, 4) kick, clap on 2 & 4, offbeat hats, a Euclidean bassline and chord stabs on the progression.',
    song: { bpm: 124, root: 0, scale: 'minor', harmony: 'pick(bar, 0, 5, 3, 4)' },
    tracks: [
      drum('Kick', 'kick', 16, 'every(n, 4)'),
      drum('Clap', 'clap', 16, 'every(n, 8, 4)', { send: 0.3 }),
      drum('Open Hat', 'openhat', 16, '0.7 * every(n, 4, 2)', { volume: 0.5 }),
      drum('Closed Hat', 'hat', 16, 'every(n, 2) * (0.5 + 0.3 * rand(n, 4)) + 0.5 * every(n, 16, 15)', { volume: 0.45, swing: 0.12 }),
      voice('Bassline', 'reese', 'h + pick(n, 0, 0, 0, 0, 2, 0, 0, -1)', 'euclid(n, 7, 16, 2)', { length: 0.6 }, { octave: 2, volume: 0.6, send: 0.05 }),
      voice('Stabs', 'pluck', 'h', '0.6 * every(n, 8, 3) + 0.45 * every(n, 16, 14)', { chord: 3, length: 0.5, inversion: 1 }, { octave: 4, volume: 0.45, send: 0.5 }),
    ],
  },
  {
    id: 'trap',
    name: 'Trap Rolls',
    description: '140 bpm half-time: hex-mask kicks, a clap on 3, hi-hat ratchets that rise in pitch, and a sliding 808 on the chord root.',
    song: { bpm: 140, root: 1, scale: 'minor', harmony: 'pick(floor(bar / 2), 0, 5)' },
    tracks: [
      drum('Kick', 'kick', 32, 'bits(pick(floor(n / 16), 0x8120, 0x80A0), n)'),
      drum('Clap', 'clap', 16, 'every(n, 16, 8)', { send: 0.35 }),
      drum('Hats', 'hat', 16, '0.4 + 0.3 * rand(n, 6) + 0.2 * bit(n, 1)', {
        ratchet: 'pick(n + 16 * (k % 2), 1,1,1,1, 1,1,2,1, 1,1,1,1, 3,1,4,2, 1,1,1,1, 1,1,1,1, 2,2,1,1, 6,1,3,1)',
        tune: 'n >= 12 ? (n - 12) * 2 : 0',
        volume: 0.5,
      }),
      voice('808', 'sine', 'h + (n % 16 >= 12) * pick(n, 3, 3, 5, 7)', '0.9 * (1 - 0.6 * phase(n, 16))', {}, {
        playMode: 'glide', quantize: true, glide: 0.14, octave: 2, steps: 32, send: 0, volume: 0.9, release: 0.3,
      }),
    ],
  },
  {
    id: 'royal',
    name: 'Royal Road Ballad',
    description: '王道進行 IV–V–iii–vi, the progression of a thousand J-pop ballads: 7th-chord pads, strummed koto, an arpeggio and bass that all read the chord h.',
    song: { bpm: 76, root: 2, scale: 'major', harmony: 'pick(bar, 3, 4, 2, 5)' },
    tracks: [
      voice('Pad', 'pad', 'h', '0.5 * every(n, 16)', { chord: 4, length: 16 }, { octave: 3, volume: 0.5, send: 0.9, attack: 0.5, release: 1.8 }),
      voice('Koto Strum', 'pluck', 'h', '0.75 * euclid(n, 3, 8)', { chord: 3, strum: 0.07, inversion: 'floor(n / 4) % 3' }, { octave: 4, volume: 0.5, send: 0.6, pan: 0.25 }),
      voice('Arpeggio', 'bell', 'h + pick(n, 0, 2, 4, 2, L, 4, 2, 4)', '0.35 + 0.35 * every(n, 4) * chance(n + 16k, 0.8, 2)', {}, { octave: 5, volume: 0.35, send: 0.7, pan: -0.3 }),
      voice('Bass', 'sine', 'h', 'phase(n, 16) < 0.9 ? 0.7 : 0', {}, { playMode: 'glide', quantize: true, glide: 0.08, octave: 2, volume: 0.7, send: 0.1 }),
      drum('Soft Kick', 'kick', 16, '0.7 * every(n, 16) + 0.45 * every(n, 16, 10)', { volume: 0.6 }),
      drum('Rim', 'rim', 16, '0.5 * every(n, 8, 4)', { volume: 0.5, send: 0.4 }),
    ],
  },
  {
    id: 'poly',
    name: 'Polyrhythm Garden',
    description: '3 against 5 against 7: Euclidean rhythms of different lengths drifting in and out of phase.',
    song: { bpm: 108, root: 2, scale: 'yo', harmony: '0' },
    tracks: [
      drum('Kick · 3/8', 'kick', 8, 'euclid(n, 3, 8)'),
      drum('Rim · 5/12', 'rim', 12, 'euclid(n, 5, 12)', { pan: 0.4 }),
      drum('Toms · 7/16', 'tom', 16, 'euclid(n, 7, 16, 1)', { tune: '2.5 * (fib(n) % 5)', pan: -0.4, send: 0.3 }),
      voice('Bells · 4/9', 'bell', 'pick(n + k, 0, 2, 4, 1, 3)', 'euclid(n, 4, 9)', {}, { steps: 9, stepBeats: 0.5, octave: 5, volume: 0.45 }),
    ],
  },
];

let counter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function trackFromTemplate(template: Template, name: string, index: number): Track {
  return {
    ...TRACK_DEFAULTS,
    name,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    ...template,
    graph: structuredClone(template.graph),
    id: uid('track'),
  };
}

export function trackFromPreset(preset: Preset, index: number): Track {
  return trackFromTemplate(preset.track, preset.name, index);
}

export function defaultProject(): Project {
  const pick = (id: string) => PRESETS.find((p) => p.id === id)!;
  const tracks = [trackFromPreset(pick('pond'), 0), trackFromPreset(pick('fib'), 1), trackFromPreset(pick('bass'), 2)];
  tracks[1].volume = 0.55;
  tracks[1].pan = 0.3;
  return {
    name: 'Zen Garden',
    song: { bpm: 84, root: 2, scale: 'hirajoshi', reverb: 0.35, exportLoops: 4, harmony: '0' },
    tracks,
  };
}
