import { LIBRARY_PRESETS } from './presetsLibrary';
import { NODE_DEFS, type GEdge, type GNode, type Graph, type NodeData } from './graph';
import { DEFAULT_PITCH_RANGE, type PitchMode } from './music';
import { TRACK_DEFAULTS, type DrumVoice, type Project, type Song, type Track, type Waveform } from './project';

export const TRACK_COLORS = ['#e2483a', '#e8a93a', '#4fc98a', '#4f86d9', '#a865d6', '#3fb7b0', '#e07a3c'];

/** the wider palette: the basic seven, then more lab-instrument colours */
export const CHANNEL_PALETTE = [
  ...TRACK_COLORS,
  '#f06292', '#ff8a65', '#ffd54f', '#c5e15a', '#8bc34a', '#26a69a', '#4dd0e1',
  '#64b5f6', '#7986cb', '#9575cd', '#ce93d8', '#f48fb1', '#bcaaa4', '#b0bec5',
  '#d4c25a', '#7fdba8', '#ff5a5a',
];

/** a colour no channel has yet, picked at random (any colour, once the palette is used up) */
export function pickColor(taken: readonly string[], rng: () => number = Math.random): string {
  const used = new Set(taken.map((c) => c.toLowerCase()));
  const free = CHANNEL_PALETTE.filter((c) => !used.has(c));
  const from = free.length ? free : CHANNEL_PALETTE;
  return from[Math.floor(rng() * from.length) % from.length];
}

type N = [id: string, type: string, x: number, y: number, data?: NodeData];
type E = [source: string, sourceHandle: string, target: string, targetHandle: string];

/** rough rendered height of a node card, so columns can stack without overlap */
export function nodeHeight(node: GNode): number {
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
export function wire(nodes: Record<string, [type: string, data?: NodeData]>, wires: string[]): Graph {
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
  /** where it sits in the Function presets list (built-ins are placed by GROUP_OF) */
  group?: PresetGroup;
  track: Template & { waveform: Waveform; pitchMode: PitchMode };
}

/** the Function presets list, in this order */
export type PresetGroup = 'start' | 'math' | 'melodies' | 'harmony' | 'bass' | 'curves' | 'rave' | 'fx';
export const PRESET_GROUPS: Record<PresetGroup, { label: string; hint: string }> = {
  start: { label: 'Start here', hint: 'the simplest functions' },
  math: { label: 'Math & nature', hint: 'sequences, fractals, chaos and constants' },
  melodies: { label: 'Melodies & leads', hint: 'tunes and lines to play over the harmony' },
  harmony: { label: 'Chords & keys', hint: 'chords, comps and arpeggios on the song’s harmony' },
  bass: { label: 'Bass', hint: 'roots, walks and wobbles under the chords' },
  curves: { label: 'Glide curves', hint: 'wild shapes, followed continuously' },
  rave: { label: 'Rave & piecewise', hint: 'kicks, riffs and drops written as one piecewise function' },
  fx: { label: 'Risers & FX', hint: 'builds and swells' },
};
/** the built-in presets' groups (library presets carry their own) */
const GROUP_OF: Record<string, PresetGroup> = {
  pond: 'start', blank: 'start',
  fib: 'math', chaos: 'math', golden: 'math', pi: 'math', collatz: 'math', lissajous: 'math', recaman: 'math', sierpinski: 'math', lorenzGlide: 'math', evolve: 'math',
  theremin: 'melodies', desmos: 'melodies', drawn: 'melodies', scooplead: 'melodies', wavetable: 'melodies', form: 'melodies',
  chordPad: 'harmony', strum: 'harmony', arp: 'harmony', quartal: 'harmony', bloomchords: 'harmony', pump: 'harmony', pumppad: 'harmony', discostrings: 'harmony', housestabs: 'harmony', rhodes: 'harmony', bossaguitar: 'harmony', montuno: 'harmony', clav: 'harmony',
  bass: 'bass', wobble: 'bass', slide808: 'bass', walking: 'bass', bossabass: 'bass', tumbao: 'bass', slap: 'bass', discobass: 'bass',
  zap: 'rave',
  riser: 'fx',
};
export const groupOf = (p: Preset): PresetGroup => p.group ?? GROUP_OF[p.id] ?? 'math';

export interface Kit {
  id: string;
  name: string;
  description: string;
  song?: Partial<Song>;
  tracks: (Template & { name: string })[];
}

const OUT_X = 640;

// ---------- chords that move well: close position inside one octave ----------

/**
 * Voice-led chords: wrap the chord's root into the octave around the middle of the keys
 * (degrees −2 … L−3), then invert exactly the notes that would stick out above it — every
 * chord lands in close position inside one octave, so the hand barely moves between chords.
 * (For a size-S chord stacked in thirds.)
 */
const LIFT = 'ceil((L - 2 - wrap(h, -2, L - 2)) / 2)';
export const voicedPitch = (S: number) => `wrap(h, -2, L - 2) - (${LIFT} < ${S}) * L`;
/** lift only when the chord was lowered: a chord that already fits stays in root position */
export const voicedInversion = (S: number) => `(${LIFT} < ${S}) * ${LIFT}`;
/** the bass: the chord's root, wrapped into one octave so it never wanders off */
const ROOT = 'wrap(h, -3, 4)';

// ---------- the parts of the style kits — also plantable alone (they follow any harmony) ----------

const WALKING_BASS = voice('Walking bass', 'triangle', `${ROOT} + pick(n, 0, 2, 0, 4, 0, 5, 0, 2)`, '0.72 + 0.12 * (n % 2 == 0)', { length: 0.95 }, {
  stepBeats: 1, steps: 8, octave: 2, attack: 0.005, release: 0.12, volume: 0.8, send: 0.15,
});
const RHODES_COMP = voice('Rhodes comp', 'bell', voicedPitch(4), 'pick(n % 8, 0.55, 0, 0, 0.42, 0.55, 0, 0, 0.35) * (0.85 + 0.15 * rand(n + 16k, 8))', {
  chord: 4, inversion: voicedInversion(4), length: 1.2, strum: 0.015,
}, { stepBeats: 0.5, steps: 16, octave: 4, swing: 0.33, volume: 0.5, send: 0.55 });
const BOSSA_GUITAR = voice('Nylon guitar', 'pluck', voicedPitch(4), '0.48 * bits(pick(floor(n / 16), 0x9228, 0x2924), n)', {
  chord: 4, inversion: voicedInversion(4), length: 1.5, strum: 0.03,
}, { steps: 32, octave: 4, volume: 0.55, send: 0.4, swing: 0.04 });
const BOSSA_BASS = voice('Bossa bass', 'triangle', `${ROOT} + (n % 16 >= 6) * 4`, '0.8 * bits(0x8280, n)', {
  length: 'pick((n % 16 == 6) + 2 * (n % 16 == 8), 5.5, 1.8, 7)',
}, { steps: 32, octave: 2, attack: 0.005, release: 0.15, volume: 0.8 });
const MONTUNO = voice('Montuno piano', 'pluck', 'wrap(h, -2, 5) + pick(floor(n / 2) % 4, 0, 4, 2, 4)', 'every(n, 2) * (0.42 + 0.25 * bits(0x2222, n))', {
  chord: 2, stack: 'L', length: 1.6,
}, { steps: 32, octave: 4, volume: 0.5, send: 0.3 });
const TUMBAO = voice('Tumbao bass', 'triangle', `${ROOT} + (n % 16 == 6) * 4`, '0.85 * bits(0x0208, n)', { length: 3.5 }, {
  steps: 32, octave: 2, attack: 0.005, release: 0.12, volume: 0.85,
});
const SLAP_BASS = voice('Slap bass', 'pluck', `${ROOT} - L + pick(n % 16, 0, 0, 0, 0, 0, 0, L, 0, 0, 0, L - 1, 0, 0, 0, L, 0)`, 'bits(0x92A6, n) * (0.68 + 0.27 * bits(0x0202, n))', {
  length: 0.8,
}, { steps: 32, octave: 3, release: 0.1, volume: 0.8, send: 0.05 });
const CLAV = voice('Clav', 'square', voicedPitch(3), '0.42 * bits(0x2452, n)', { chord: 3, inversion: voicedInversion(3), length: 0.5 }, {
  steps: 32, octave: 4, attack: 0.003, release: 0.06, volume: 0.4, send: 0.15,
});
const DISCO_BASS = voice('Octave bass', 'sawtooth', `${ROOT} - L + L * (floor(n / 2) % 2)`, '0.8 * every(n, 2)', { length: 1.4 }, {
  steps: 16, octave: 3, attack: 0.004, release: 0.08, volume: 0.6,
});
const DISCO_STRINGS = voice('Strings', 'pad', voicedPitch(3), '0.5 * every(n, 16)', { chord: 3, inversion: voicedInversion(3), length: 16 }, {
  steps: 16, octave: 4, attack: 0.3, release: 1, volume: 0.45, send: 0.8,
});
const HOUSE_STABS = voice('Organ stabs', 'custom', voicedPitch(5), '0.5 * bits(0x1224, n)', { chord: 5, inversion: voicedInversion(5), length: 0.8 }, {
  steps: 16, octave: 4, attack: 0.005, release: 0.25, volume: 0.42, send: 0.55, swing: 0.12,
});
const HOUSE_SUB = voice('Sub bass', 'sine', `${ROOT} - L`, '0.85 * every(n, 4, 2)', { length: 1.6 }, { steps: 16, octave: 3, release: 0.1, volume: 0.85 });
/** a pad on the chord whose notes are held long and pumped by pressure — a Curve once a beat */
const PUMP_PAD: Template & { name: string } = {
  name: 'Pumping pad',
  waveform: 'pad',
  steps: 16,
  stepBeats: 0.25,
  octave: 4,
  attack: 0.4,
  release: 1.2,
  volume: 0.4,
  send: 0.8,
  graph: wire(
    {
      pitch: ['expr', { formula: voicedPitch(4) }],
      inv: ['expr', { formula: voicedInversion(4) }],
      vel: ['expr', { formula: '0.45 * every(n, 16)' }],
      chord: ['number', { value: 4, min: 1, max: 8 }],
      length: ['number', { value: 16, min: 0, max: 64 }],
      beats: ['expr', { formula: 't' }],
      duck: ['curve', { points: '0:0.15:0.7 0.9:1:0 1:0.15:0', repeats: 1, lo: 0, hi: 1 }],
      out: ['output'],
    },
    ['pitch.out>out.pitch', 'inv.out>out.inversion', 'vel.out>out.velocity', 'chord.out>out.chord', 'length.out>out.length', 'beats.out>duck.p', 'duck.out>out.pressure'],
  ),
};

/** a part as a plantable preset */
const part = (id: string, t: Template & { name: string }, description: string, formula: string): Preset => ({
  id,
  name: t.name,
  description,
  formula,
  track: { pitchMode: 'degree', ...t, waveform: t.waveform ?? 'sine' },
});

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
    id: 'desmos',
    name: 'Graphed Arpeggios',
    description:
      'A y = f(x) melody written for a graphing calculator: x is time in beats, y is pitch in octaves. VI–VII–V–i minor arpeggios, octave-drop bass, and a falling e^(−12·frac 4x) hook on every note.',
    formula: 'y = ⌊(12d + 2)/7⌋/12 + e^(−12 frac 4x)/6',
    track: {
      waveform: 'triangle',
      pitchMode: 'semitone',
      playMode: 'glide',
      quantize: false,
      glide: 0.004,
      steps: 32,
      stepBeats: 0.25,
      octave: 4,
      attack: 0.004,
      release: 0.06,
      volume: 0.7,
      send: 0.5,
      graph: wire(
        {
          // the formula as written, with x → t (beats); y is in octaves
          y: [
            'expr',
            {
              formula:
                'floor((12 * ((3*floor(t/2) + 2*(floor(4t) % 4) + (floor(4t) % 8 == 4) + 5) % 7) + 2) / 7) / 12 - (floor(4t) % 8 == 0) + (floor(t/2) == 2) * (floor(4t) % 4 == 1) / 12 + exp(-12 * fract(4t)) / 6',
            },
          ],
          semitones: ['math', { op: 'mul', b: 12 }],
          // re-articulate each note so the hooks are heard as separate notes
          gate: ['expr', { formula: 'fract(4t) < 0.85 ? 0.8 : 0' }],
          out: ['output'],
        },
        ['y.out>semitones.a', 'semitones.out>out.pitch', 'gate.out>out.velocity'],
      ),
    },
  },
  {
    id: 'zap',
    name: 'Kick, Zap & Hook',
    description:
      'A three-case piecewise function in x (beats), y (octaves): a falling kick on each beat, a 1.6-octave zap on every third 16th, and an octave-down hook between. Repeats every 84 sixteenths.',
    formula: 'y = −2 + 3e^(−20 frac x) | 3/5 + round(12(⌊4x⌋ mod 7)/7)/12 − 8/5 frac 4x | −1 + e^(−12 frac 4x)/6',
    track: {
      waveform: 'triangle',
      pitchMode: 'semitone',
      playMode: 'glide',
      quantize: false,
      glide: 0.003,
      // ⌊4x⌋ mod 3, ⌊4x⌋ mod 7 and the beat line up again after lcm(3, 7, 4) = 84 sixteenths
      steps: 84,
      stepBeats: 0.25,
      octave: 4,
      attack: 0.003,
      release: 0.05,
      volume: 0.7,
      send: 0.35,
      graph: wire(
        {
          // y in octaves, exactly as written; the first case that holds wins
          y: [
            'expr',
            {
              formula:
                'fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4t) % 3 == 0 ? 3/5 + round(12 * (floor(4t) % 7) / 7) / 12 - 8/5 * fract(4t) : -1 + exp(-12 * fract(4t)) / 6',
            },
          ],
          semitones: ['math', { op: 'mul', b: 12 }],
          // where no case holds, the function is undefined: silence
          gate: ['expr', { formula: '0.8 * (fract(t) < 0.25 || floor(4t) % 3 == 0 || fract(4t) < 0.8)' }],
          out: ['output'],
        },
        ['y.out>semitones.a', 'semitones.out>out.pitch', 'gate.out>out.velocity'],
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
    description: 'The sound itself is a function: f(p) = sin(2πp + 2·sin(2πp)). Edit it in Channel → Voice.',
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
    id: 'form',
    name: 'Song Form',
    description: 'The Sections node: verse, verse, chorus, bridge — each section its own function, switched by time.',
    formula: 'A 8 · A 8 · B 8 · C 8 beats',
    track: {
      waveform: 'pluck',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.55,
      send: 0.5,
      graph: wire(
        {
          verse: ['expr', { formula: 'h + pick(n, 0, 2, 4, 2)' }],
          chorus: ['expr', { formula: 'h + L + pick(n, 4, 2, 0, 2, 4, 5)' }],
          bridge: ['expr', { formula: 'h + round(3 * sin(tau * x * 2))' }],
          form: ['sections', { lengths: '8 8 8 8', unit: 'beats' }],
          gate: ['expr', { formula: 'a == 2 ? 0.8 : 0.6 * euclid(n, 5, 8) + 0.2' }],
          out: ['output'],
        },
        ['verse.out>form.A', 'verse.out>form.B', 'chorus.out>form.C', 'bridge.out>form.D', 'form.out>out.pitch', 'form.section>gate.a', 'gate.out>out.velocity'],
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
  // ---------- style parts: they follow whatever the Harmony says ----------
  part('walking', WALKING_BASS, 'Jazz walking bass on the harmony: the root on each chord, a passing note between — quarter notes, swinging.', 'pitch = root + 0 2 0 4 0 5 0 2'),
  part('rhodes', RHODES_COMP, 'Voice-led seventh chords comping on swung eighths — close position, so the hand barely moves between chords.', 'chord of 4 on h, voice-led'),
  part('bossaguitar', BOSSA_GUITAR, 'Bossa nova guitar: voice-led seventh chords on the syncopated two-bar rhythm, strummed lightly.', 'chord of 4 · bits(0x9228 / 0x2924)'),
  part('bossabass', BOSSA_BASS, 'Bossa bass: the root held, the fifth anticipating beat three — the surdo’s two-step.', 'pitch = root, fifth on the and-of-2'),
  part('montuno', MONTUNO, 'Salsa piano montuno: chord tones in octaves, eighth notes with the offbeats leaning in.', 'octaves on h + 0 4 2 4'),
  part('tumbao', TUMBAO, 'Salsa tumbao: the bass anticipates — the fifth on the and-of-2, the next root on four.', 'fifth on 6, root on 12'),
  part('slap', SLAP_BASS, 'Funk slap bass: thumbed roots, octave pops and a flat-seven, syncopated sixteenths.', 'root · pops on L · bits(0x92A6)'),
  part('clav', CLAV, 'Funk clavinet: short voice-led triads on the offbeat sixteenths.', 'chord of 3 · bits(0x2452)'),
  part('discobass', DISCO_BASS, 'Disco octave bass: root, octave, root, octave — eighth notes that never sit still.', 'root ± L, every eighth'),
  part('discostrings', DISCO_STRINGS, 'Disco strings: a voice-led triad held through every bar.', 'chord of 3, held'),
  part('housestabs', HOUSE_STABS, 'Deep house organ stabs: minor ninth chords on a syncopated swing.', 'chord of 5 · bits(0x1224)'),
  part('pumppad', PUMP_PAD, 'A pad held through each bar, pumped on every beat by a pressure Curve — sidechain without a compressor.', 'chord of 4 · pressure = duck(t)'),

  // ---------- drawn with Curve nodes: automation as music ----------
  {
    id: 'riser',
    name: 'Riser',
    description: 'A drawn Curve climbs two octaves — slow, then urgent — while a second one swells the volume. A build-up you can reshape by dragging.',
    formula: 'pitch = 14 · bend(x, 0.6) · volume = bend(x, 0.5)',
    track: {
      waveform: 'sawtooth',
      pitchMode: 'degree',
      playMode: 'glide',
      quantize: false,
      glide: 0.02,
      steps: 16,
      stepBeats: 1,
      octave: 3,
      volume: 0.5,
      attack: 0.05,
      release: 0.4,
      send: 0.6,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['up', 'curve', 260, 0, { points: '0:0:0.6 1:1:0', repeats: 1, lo: 0, hi: 14 }],
          ['vol', 'curve', 260, 300, { points: '0:0.2:0.5 1:1:0', repeats: 1, lo: 0, hi: 0.85 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['up', 'out', 'out', 'pitch'],
          ['vol', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'pump',
    name: 'Ducking Pad',
    description: 'A pad on the song’s chord, ducked by a Curve on every beat — the sidechain pump, drawn instead of compressed.',
    formula: 'pitch = h · volume = duck curve × 4 per loop',
    track: {
      waveform: 'pad',
      pitchMode: 'degree',
      playMode: 'glide',
      quantize: true,
      glide: 0.08,
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.6,
      attack: 0.02,
      release: 0.3,
      send: 0.7,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['p', 'expr', 260, 20, { formula: 'h + pick(floor(x * 2), 0, 2)' }],
          ['duck', 'curve', 260, 200, { points: '0:0.1:0.7 0.9:1:0 1:0.1:0', repeats: 4, lo: 0, hi: 0.85 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['p', 'out', 'out', 'pitch'],
          ['duck', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'drawn',
    name: 'Drawn Melody',
    description: 'A melody drawn as one Curve — rises, dips and leaps between seven corners — read as notes on the scale. Drag a corner to rewrite it.',
    formula: 'pitch = −2 + 11 · curve(x)',
    track: {
      waveform: 'pluck',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.7,
      send: 0.45,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['mel', 'curve', 260, 0, { points: '0:0.2:0 0.12:0.55:-0.4 0.3:0.35:0.3 0.45:0.9:-0.6 0.62:0.6:0 0.78:0.75:0.5 1:0.2:0', repeats: 1, lo: -2, hi: 9 }],
          ['v', 'expr', 260, 260, { formula: '0.5 + 0.35 * every(n, 4) + 0.1 * every(n, 2)' }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['mel', 'out', 'out', 'pitch'],
          ['v', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  {
    id: 'wobble',
    name: 'Bent Wobble',
    description: 'A Reese bass on the chord root, its volume cut by a bent Curve eight times a loop — the wobble, with a shape you can drag.',
    formula: 'pitch = h · volume = bend(1 − u, −0.7), 8 per loop',
    track: {
      waveform: 'reese',
      pitchMode: 'degree',
      playMode: 'glide',
      quantize: true,
      glide: 0.05,
      steps: 16,
      stepBeats: 0.25,
      octave: 2,
      volume: 0.7,
      release: 0.1,
      send: 0.15,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['p', 'expr', 260, 20, { formula: 'h' }],
          ['wob', 'curve', 260, 200, { points: '0:1:-0.7 1:0.05:0', repeats: 8, lo: 0.1, hi: 0.9 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['p', 'out', 'out', 'pitch'],
          ['wob', 'out', 'out', 'velocity'],
        ],
      ),
    },
  },
  // ---------- curves on pitch: bends inside each note (MPE) ----------
  {
    id: 'scooplead',
    name: 'Scooped Lead',
    description: 'A lead whose every note scoops up from below — a Curve on Note Out’s bend, restarting on each note through np. MIDI + automation exports it as pitch bend.',
    formula: 'pitch = 0 2 4 2 5 4 2 0 · bend = −2 + 2 · curve(np)',
    track: {
      waveform: 'square',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.5,
      attack: 0.01,
      release: 0.25,
      send: 0.4,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['mel', 'list', 260, 0, { values: '0 2 4 2 5 4 2 0', every: 2 }],
          ['len', 'number', 260, 200, { value: 1.8 }],
          ['scoop', 'curve', 260, 320, { points: '0:0:-0.6 0.35:1:0 1:1:0', repeats: 1, lo: -2, hi: 0 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['mel', 'out', 'out', 'pitch'],
          ['len', 'out', 'out', 'length'],
          ['time', 'np', 'scoop', 'p'],
          ['scoop', 'out', 'out', 'bend'],
        ],
      ),
    },
  },
  {
    id: 'slide808',
    name: '808 Slide',
    description: 'Long sub notes on the chord root that hold, then dive a fifth as they end — the trap 808, drawn as a bend Curve on each note.',
    formula: 'pitch = h · bend = −7 · curve(np)',
    track: {
      waveform: 'sine',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 2,
      volume: 0.85,
      attack: 0.005,
      release: 0.15,
      send: 0.05,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['p', 'expr', 260, 0, { formula: 'h + pick(floor(n / 8), 0, 0, 2, 4)' }],
          ['v', 'expr', 260, 120, { formula: 'bits(0x8020, n) * 0.9' }],
          ['len', 'number', 260, 240, { value: 6 }],
          ['dive', 'curve', 260, 340, { points: '0:1:0 0.55:1:0.5 1:0:0', repeats: 1, lo: -7, hi: 0 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['p', 'out', 'out', 'pitch'],
          ['v', 'out', 'out', 'velocity'],
          ['len', 'out', 'out', 'length'],
          ['time', 'np', 'dive', 'p'],
          ['dive', 'out', 'out', 'bend'],
        ],
      ),
    },
  },
  {
    id: 'bloomchords',
    name: 'Blooming Chords',
    description: 'Chords on the harmony that swell from soft (pressure) and grow a vibrato through each chord (bend) — every note of the chord moves together.',
    formula: 'chord on h · bend = depth(np) · sin(4τt) · pressure = swell(np)',
    track: {
      waveform: 'flute',
      pitchMode: 'degree',
      steps: 16,
      stepBeats: 0.25,
      octave: 4,
      volume: 0.55,
      attack: 0.08,
      release: 0.8,
      send: 0.7,
      graph: graph(
        [
          ['time', 'step', 0, 80],
          ['p', 'expr', 260, 0, { formula: 'h' }],
          ['v', 'expr', 260, 100, { formula: '0.7 * every(n, 8)' }],
          ['chord', 'number', 260, 200, { value: 3 }],
          ['len', 'number', 260, 280, { value: 7.5 }],
          ['depth', 'curve', 260, 360, { points: '0:0:0.5 0.7:1:0 1:1:0', repeats: 1, lo: 0, hi: 0.3 }],
          ['vib', 'expr', 470, 360, { formula: 'a * sin(tau * 4 * t)' }],
          ['swell', 'curve', 260, 560, { points: '0:0.2:0.5 0.6:1:-0.4 1:0.7:0', repeats: 1, lo: 0, hi: 1 }],
          ['out', 'output', OUT_X, 100],
        ],
        [
          ['p', 'out', 'out', 'pitch'],
          ['v', 'out', 'out', 'velocity'],
          ['chord', 'out', 'out', 'chord'],
          ['len', 'out', 'out', 'length'],
          ['time', 'np', 'depth', 'p'],
          ['depth', 'out', 'vib', 'a'],
          ['vib', 'out', 'out', 'bend'],
          ['time', 'np', 'swell', 'p'],
          ['swell', 'out', 'out', 'pressure'],
        ],
      ),
    },
  },
  {
    id: 'blank',
    name: 'Empty Channel',
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
  // the function library: made in SoundFunc, saved from My functions
  ...LIBRARY_PRESETS,
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

/** the boom-bap kick: two bars as 16-bit masks — the second answers the first */
const BOOM_KICK = 'bits(pick(floor(n / 16), 0x8120, 0x9024), n)';

export const KITS: Kit[] = [
  {
    id: 'jazz',
    name: 'Smoky Club',
    description:
      '132 bpm swing in B♭ over Rhythm changes, two chords a bar. Ride with the skip beat, feathered kick and brushes, a walking bass that lands on every root, voice-led Rhodes comping and a sax that wanders the chord tones.',
    song: { bpm: 132, root: 10, scale: 'major', harmony: 'pick(floor(beat / 2), 0, 5, 1, 4, 2, 5, 1, 4, 0, 3, 2, 5, 1, 4, 0, 0)' },
    tracks: [
      drum('Ride', 'hat', 16, 'pick(n % 8, 0.75, 0, 0.6, 0.5, 0.75, 0, 0.6, 0.5) * (0.9 + 0.1 * rand(n + 16k, 2))', { stepBeats: 0.5, swing: 0.33, volume: 0.55, send: 0.35 }),
      drum('Hi-hat foot', 'hat', 16, '0.35 * (n % 4 == 2)', { stepBeats: 0.5, swing: 0.33, volume: 0.4 }),
      drum('Kick', 'kick', 16, '0.22 * every(n, 2) + 0.35 * (n % 16 == 15)', { stepBeats: 0.5, swing: 0.33, volume: 0.6 }),
      drum('Brushes', 'snare', 16, '0.18 * chance(n + 16k, 0.3, 4) * (n % 2) + 0.45 * (n % 16 == 11) * (k % 2)', { stepBeats: 0.5, swing: 0.33, volume: 0.5, send: 0.3 }),
      WALKING_BASS,
      RHODES_COMP,
      voice('Sax', 'flute', 'h + 2 * floor(4 * noise(n * 0.37 + k * 3, 5))', 'chance(n + 16k, 0.6, 11) * (0.4 + 0.2 * (n % 2 == 0))', { length: 0.9 }, {
        stepBeats: 0.5, steps: 16, octave: 5, swing: 0.33, volume: 0.45, send: 0.5, attack: 0.03,
      }),
    ],
  },
  {
    id: 'bossa',
    name: 'Ipanema Dusk',
    description:
      '130 bpm bossa nova in D: the rim-shot clave, a surdo kick, shaker, the root-and-fifth bass, voice-led nylon guitar on the syncopated two-bar rhythm, and a flute line over I–ii–V–iii–vi.',
    song: { bpm: 130, root: 2, scale: 'major', harmony: 'pick(bar, 0, 0, 1, 4, 2, 5, 1, 4)' },
    tracks: [
      drum('Clave (rim)', 'rim', 32, '0.6 * bits(pick(floor(n / 16), 0x9224, 0x2240), n)', { volume: 0.6, send: 0.2 }),
      drum('Surdo', 'kick', 32, '0.7 * bits(0x8080, n) + 0.4 * bits(0x1010, n)', { volume: 0.75 }),
      drum('Shaker', 'hat', 32, '0.18 + 0.14 * every(n, 2, 1) + 0.05 * rand(n + 32k, 3)', { volume: 0.4, swing: 0.06 }),
      BOSSA_BASS,
      BOSSA_GUITAR,
      voice('Flute', 'flute', 'h + pick(floor(n / 4) % 8, 4, 2, 4, 6, 7, 6, 4, 2)', '0.5 * bits(0x8888, n) * chance(floor(n / 4) + 8k, 0.7, 5)', { length: 3.6 }, {
        steps: 32, octave: 5, volume: 0.45, send: 0.6, attack: 0.04,
      }),
    ],
  },
  {
    id: 'salsa',
    name: 'Montuno',
    description:
      '96 bpm salsa in A harmonic minor, i–iv–V–iv a bar each. 2-3 son clave, tumbao congas and campana, the bombo, a tumbao bass (the fifth on the and-of-2, the root on four), the piano montuno in octaves and horn hits to close each phrase.',
    song: { bpm: 96, root: 9, scale: 'harmonicMinor', harmony: 'pick(bar, 0, 3, 4, 3)' },
    tracks: [
      drum('Clave 2-3', 'rim', 32, '0.7 * bits(pick(floor(n / 16), 0x0880, 0x8208), n)', { volume: 0.6, send: 0.15 }),
      drum('Congas', 'tom', 32, 'bits(0x2323, n) * (0.55 + 0.25 * (n % 16 == 2 || n % 16 == 10))', { tune: '(n % 16 == 2 || n % 16 == 10) ? 14 : 9', volume: 0.6 }),
      drum('Campana', 'tom', 32, 'every(n, 4) * (0.35 + 0.2 * every(n, 8))', { tune: '22', volume: 0.35 }),
      drum('Bombo', 'kick', 32, '0.6 * (n % 16 == 6) + 0.3 * (n % 16 == 12)', { volume: 0.7 }),
      TUMBAO,
      MONTUNO,
      voice('Horns', 'sawtooth', voicedPitch(3), '0.55 * bits(pick(floor(n / 16), 0, 0x0012), n)', { chord: 3, inversion: voicedInversion(3), length: 1 }, {
        steps: 32, octave: 4, attack: 0.02, release: 0.2, volume: 0.45, send: 0.35,
      }),
    ],
  },
  {
    id: 'funk',
    name: 'Get Down',
    description:
      '104 bpm funk in E dorian: a syncopated kick, backbeat with ghost notes, sixteenth hats and an open hat, slap bass with octave pops, clavinet on the offbeats, and horn stabs — i7 for a while, then IV7, then the turn.',
    song: { bpm: 104, root: 4, scale: 'dorian', harmony: 'pick(bar, 0, 0, 3, 3, 0, 0, 6, 3)' },
    tracks: [
      drum('Kick', 'kick', 32, '0.95 * bits(pick(floor(n / 16), 0x8220, 0x9092), n)', { volume: 0.9 }),
      drum('Snare', 'snare', 32, 'max(every(n, 8, 4), 0.2 * bits(0x0542, n))', { send: 0.15 }),
      drum('Hats', 'hat', 32, '(0.3 + 0.35 * every(n, 2)) * (n % 16 != 14) * (0.9 + 0.1 * rand(n + 32k, 2))', { volume: 0.5 }),
      drum('Open hat', 'openhat', 32, '0.45 * (n % 16 == 14)', { volume: 0.45 }),
      SLAP_BASS,
      CLAV,
      voice('Horns', 'sawtooth', `${voicedPitch(3)} + L`, '0.55 * bits(pick(floor(n / 16), 0, 0x000A), n)', { chord: 3, inversion: voicedInversion(3), length: 1 }, {
        steps: 32, octave: 4, attack: 0.015, release: 0.15, volume: 0.42, send: 0.3,
      }),
    ],
  },
  {
    id: 'disco',
    name: 'Mirror Ball',
    description:
      '120 bpm disco in A minor, an eight-bar loop that goes all the way round: four-on-the-floor, claps, open hats on the offbeat, the octave bass, held strings and chicken-scratch guitar.',
    song: { bpm: 120, root: 9, scale: 'minor', harmony: 'pick(bar, 0, 3, 6, 2, 5, 3, 4, 4)' },
    tracks: [
      drum('Kick', 'kick', 16, 'every(n, 4)', { volume: 0.9 }),
      drum('Clap', 'clap', 16, '0.7 * every(n, 8, 4)', { send: 0.25 }),
      drum('Open hat', 'openhat', 16, '0.5 * every(n, 4, 2)', { volume: 0.5 }),
      drum('Hats', 'hat', 16, '0.2 * (n % 4 != 2) + 0.06 * rand(n + 16k, 4)', { volume: 0.4 }),
      DISCO_BASS,
      DISCO_STRINGS,
      voice('Guitar', 'pluck', `${voicedPitch(3)} + L`, '0.45 * (n % 4 == 2) + 0.15 * (n % 2)', { chord: 2, length: 0.5 }, {
        steps: 16, octave: 4, release: 0.05, volume: 0.35, swing: 0.05,
      }),
    ],
  },
  {
    id: 'deephouse',
    name: 'Deep Hours',
    description:
      '122 bpm deep house in D minor, i–VII–VI–VII (Dm–C–B♭–C): kick on every beat, swung claps and hats, an offbeat sub, ninth-chord organ stabs, and a pad pumped on every beat by a pressure Curve.',
    song: { bpm: 122, root: 2, scale: 'minor', harmony: 'pick(bar, 0, 6, 5, 6)' },
    tracks: [
      drum('Kick', 'kick', 16, 'every(n, 4)', { volume: 0.9 }),
      drum('Clap', 'clap', 16, '0.6 * every(n, 8, 4)', { swing: 0.08, send: 0.3 }),
      drum('Hats', 'hat', 16, '0.25 + 0.2 * every(n, 4, 2) + 0.08 * rand(n + 16k, 6)', { swing: 0.12, volume: 0.45 }),
      drum('Open hat', 'openhat', 16, '0.4 * every(n, 4, 2)', { swing: 0.12, volume: 0.4 }),
      HOUSE_SUB,
      HOUSE_STABS,
      PUMP_PAD,
    ],
  },
  {
    id: 'boombap',
    name: 'Boom Bap',
    description:
      '90 bpm, head-nod hip-hop. A kick that skips around the backbeat, a fat snare with ghost notes, lazy swung hats, a sub that lands with the kick, and dusty 7th chords on the harmony — the keys breathe with a sidechain Curve.',
    song: { bpm: 90, root: 9, scale: 'minor', harmony: 'pick(bar, 0, 5, 3, 4)' },
    tracks: [
      drum('Kick', 'kick', 32, `${BOOM_KICK} * (0.88 + 0.1 * rand(n + 32k, 3))`, { volume: 0.95, swing: 0.1 }),
      drum('Snare', 'snare', 32, 'max(every(n, 8, 4), 0.28 * bits(pick(floor(n / 16), 0x0001, 0x0101), n))', { volume: 0.85, send: 0.22, swing: 0.1 }),
      drum('Hats', 'hat', 32, 'every(n, 2) * (0.45 + 0.3 * every(n, 4) + 0.12 * rand(n + 32k, 5))', { swing: 0.16, volume: 0.5 }),
      drum('Open hat', 'openhat', 32, 'n % 32 == 30 ? 0.42 : 0', { swing: 0.16, volume: 0.45 }),
      voice('Sub', 'sine', 'h', `0.85 * ${BOOM_KICK}`, { length: 3 }, { octave: 2, steps: 32, volume: 0.75, attack: 0.005, release: 0.18, swing: 0.1, send: 0.05 }),
      {
        name: 'Keys',
        waveform: 'bell',
        steps: 32,
        stepBeats: 0.25,
        octave: 4,
        volume: 0.5,
        send: 0.6,
        swing: 0.16,
        attack: 0.01,
        release: 0.9,
        graph: wire(
          {
            pitch: ['expr', { formula: 'h' }],
            hit: ['expr', { formula: 'bits(pick(floor(n / 16), 0x8202, 0x8020), n)' }],
            duck: ['curve', { points: '0:0.5:0.6 0.9:1:0 1:0.5:0', repeats: 8, lo: 0, hi: 0.7 }],
            v: ['math', { op: 'mul' }],
            chord: ['number', { value: 4, min: 1, max: 8 }],
            length: ['number', { value: 6, min: 0, max: 16 }],
            strum: ['number', { value: 0.04, min: -0.5, max: 0.5 }],
            out: ['output'],
          },
          ['pitch.out>out.pitch', 'hit.out>v.a', 'duck.out>v.b', 'v.out>out.velocity', 'chord.out>out.chord', 'length.out>out.length', 'strum.out>out.strum'],
        ),
      },
    ],
  },
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
    description: 'The Royal Road, IV–V–iii–vi: the progression of a thousand J-pop ballads: 7th-chord pads, strummed koto, an arpeggio and bass that all read the chord h.',
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
    name: 'Polyrhythm Track',
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
    sliders: structuredClone(template.sliders ?? []),
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
    name: 'Untitled',
    song: { bpm: 84, root: 2, scale: 'hirajoshi', reverb: 0.35, exportLoops: 4, harmony: '0', pitchRange: { ...DEFAULT_PITCH_RANGE }, lengthMode: 'fixed', lengthBeats: 8, repeat: 'evolve', exportCurves: 'simple', exportMidi: 'standard', bendRange: 24, mpeBendRange: 48 },
    tracks,
  };
}
