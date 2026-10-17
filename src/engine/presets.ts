import { NODE_DEFS, type GEdge, type GNode, type Graph, type NodeData } from './graph';
import type { PitchMode } from './music';
import type { Project, Track, Waveform } from './project';

export const TRACK_COLORS = ['#c4583d', '#6f8a63', '#4a5d7e', '#b39561', '#8a6a7e', '#5e8a86', '#6f6a62'];

type N = [id: string, type: string, x: number, y: number, data?: NodeData];
type E = [source: string, sourceHandle: string, target: string, targetHandle: string];

/** rough rendered height of a node card, so columns can stack without overlap */
function nodeHeight(type: string): number {
  const d = NODE_DEFS[type];
  return 70 + (d.inputs.length + d.outputs.length) * 21 + d.params.length * 30 + (type === 'number' ? 24 : 0) + (type === 'step' ? 0 : 36);
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
  const cols = new Map<number, GNode[]>();
  for (const n of g.nodes) {
    const d = depth.get(n.id)!;
    cols.set(d, [...(cols.get(d) ?? []), n]);
  }
  const heights = [...cols.values()].map((c) => c.reduce((h, n) => h + nodeHeight(n.type) + 28, -28));
  const tallest = Math.max(...heights);
  const nodes = g.nodes.map((n) => ({ ...n }));
  for (const [d, col] of cols) {
    let y = (tallest - col.reduce((h, n) => h + nodeHeight(n.type) + 28, -28)) / 2;
    for (const n of col) {
      const target = nodes.find((m) => m.id === n.id)!;
      target.position = { x: d * 280, y };
      y += nodeHeight(n.type) + 28;
    }
  }
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

export interface Preset {
  id: string;
  name: string;
  description: string;
  formula: string;
  track: Partial<Track> & { graph: Graph; waveform: Waveform; pitchMode: PitchMode };
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

let counter = 0;
export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function trackFromPreset(preset: Preset, index: number): Track {
  return {
    name: preset.name,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    steps: 16,
    stepBeats: 0.25,
    octave: 4,
    volume: 0.8,
    pan: 0,
    attack: 0.01,
    release: 0.4,
    muted: false,
    solo: false,
    ...preset.track,
    graph: structuredClone(preset.track.graph),
    id: uid('track'),
  };
}

export function defaultProject(): Project {
  const pick = (id: string) => PRESETS.find((p) => p.id === id)!;
  const tracks = [trackFromPreset(pick('pond'), 0), trackFromPreset(pick('fib'), 1), trackFromPreset(pick('bass'), 2)];
  tracks[1].volume = 0.55;
  tracks[1].pan = 0.3;
  return {
    name: 'Zen Garden',
    song: { bpm: 84, root: 2, scale: 'hirajoshi', reverb: 0.35, exportLoops: 4 },
    tracks,
  };
}
