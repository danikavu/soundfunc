import { LIBRARY_PRESETS } from './presetsLibrary';
import { NODE_DEFS, type GEdge, type GNode, type Graph, type NodeData } from './graph';
import { DEFAULT_PITCH_RANGE, type PitchMode } from './music';
import type { SynthParams } from './synth';
import { WAVE_VOICES } from './timbre';
import { CHANNEL_COLORS, CHANNEL_COLORS_WIDE, TRACK_DEFAULTS, type DrumVoice, type Project, type Song, type Track, type Waveform } from './project';

export const TRACK_COLORS = CHANNEL_COLORS;

/** the wider palette: the basic seven, then softer ones of the same family */
export const CHANNEL_PALETTE = [...CHANNEL_COLORS, ...CHANNEL_COLORS_WIDE];

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
export type PresetGroup = 'start' | 'math' | 'melodies' | 'harmony' | 'bass' | 'westcoast' | 'curves' | 'rave' | 'fx';
export const PRESET_GROUPS: Record<PresetGroup, { label: string; hint: string }> = {
  start: { label: 'Start here', hint: 'the simplest functions' },
  math: { label: 'Math & nature', hint: 'sequences, fractals, chaos and constants' },
  melodies: { label: 'Melodies & leads', hint: 'tunes and lines to play over the harmony' },
  harmony: { label: 'Chords & keys', hint: 'chords, comps and arpeggios on the song’s harmony' },
  bass: { label: 'Bass', hint: 'roots, walks and wobbles under the chords' },
  westcoast: { label: 'G-funk & West Coast', hint: 'whistles, Moog bass, talkbox and Rhodes ninths' },
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
  /** where it sits in the Rhythm kits list */
  group?: KitGroup;
  song?: Partial<Song>;
  tracks: (Template & { name: string })[];
}

/** the Rhythm kits list, in this order */
export type KitGroup = 'mine' | 'hiphop' | 'westcoast' | 'phonk' | 'soul' | 'triphop' | 'dance' | 'latin' | 'breaks' | 'math';
export const KIT_GROUPS: Record<KitGroup, string> = {
  mine: 'My kits',
  hiphop: 'Hip-hop & lo-fi',
  westcoast: 'G-funk & West Coast',
  phonk: 'Trap, phonk & funk trap',
  soul: 'Soul, jazz & funk',
  triphop: 'Trip hop & chill',
  dance: 'Dance & swing',
  latin: 'Latin & world',
  breaks: 'Breaks & DnB',
  math: 'Math rhythms',
};
export const kitGroupOf = (k: Kit): KitGroup => k.group ?? 'math';

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
const RHODES_COMP = voice('Rhodes comp', 'keys', voicedPitch(4), 'pick(n % 8, 0.55, 0, 0, 0.42, 0.55, 0, 0, 0.35) * (0.85 + 0.15 * rand(n + 16k, 8))', {
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

// ---------- G-funk & West Coast: the parts the kits share, also plantable alone (32 steps, two bars) ----------

/** the portamento whistle: a high sine sliding between long chord tones, with a slow vibrato */
const G_WHISTLE = voice('G-funk whistle', 'sine', 'h + pick(floor(n / 8) + 4 * (k % 2), 7, 9, 8, 7, 4, 7, 6, 4)', 'phase(n, 8) < 0.88 ? 0.42 : 0', {}, {
  playMode: 'glide', quantize: true, glide: 0.14, steps: 32, octave: 5, volume: 0.3, send: 0.55, pan: 0.15, synth: { vibrato: 0.65 },
});
/** the Minimoog bass: one voice that slides into its roots, octave pops and a leading tone */
const MOOG_BASS = voice('Moog bass', 'sawtooth', `${ROOT} + pick(n % 16, 0,0,0,0, 0,0,0,0, 0,0,L,L, 0,0,-1,-1)`, '0.8 * pick(n % 16, 1,1,1,0, 0,0,1,1, 1,0,1,1, 0,0,1,1)', {}, {
  playMode: 'glide', quantize: true, glide: 0.07, steps: 32, octave: 2, volume: 0.6, release: 0.1, swing: 0.12, send: 0.04,
  synth: { cutoff: 0.3, resonance: 0.4, sub: 0.35 },
});
/** Rhodes ninths, voice-led, answering the snare */
const G_KEYS = voice('Rhodes ninths', 'keys', voicedPitch(5), '0.42 * bits(pick(floor(n / 16), 0x0808, 0x082A), n)', { chord: 5, inversion: voicedInversion(5), length: 1.8, strum: 0.02 }, {
  steps: 32, octave: 4, volume: 0.36, send: 0.45, swing: 0.12, synth: { chorus: 0.45, vibrato: 0.15 },
});
/** the talkbox: a filtered saw that talks through a two-bar phrase, then rests for the answer */
const TALKBOX = voice('Talkbox', 'sawtooth', 'h + pick(floor(n / 2), 4, 4, 5, 4, 2, 4, 0, 0, 2, 2, 4, 2, 0, -1, 0, 0)', '(n % 32 < 22) * (phase(n, 2) < 0.8 ? 0.42 : 0)', {}, {
  playMode: 'glide', quantize: true, glide: 0.05, steps: 32, octave: 4, volume: 0.32, send: 0.3, pan: -0.15,
  synth: { cutoff: 0.42, resonance: 0.55, vibrato: 0.25, chorus: 0.2 },
});
/** chicken-scratch guitar: muted chord chops on the off-sixteenths, an accent before each backbeat */
const SCRATCH_GUITAR = voice('Chicken scratch', 'pluck', voicedPitch(3), 'every(n, 2, 1) * (0.22 + 0.25 * bits(0x0404, n) + 0.06 * rand(n + 32k, 14))', {
  chord: 3, inversion: voicedInversion(3), length: 0.15, strum: 0.008,
}, { steps: 32, octave: 4, volume: 0.36, release: 0.04, swing: 0.1, send: 0.18, pan: 0.3 });
/** staccato piano triads on the eighths, the voicing rocking up on the second half of each beat pair */
const PIANO_STABS = voice('Piano stabs', 'keys', voicedPitch(3), 'every(n, 2) * (0.38 + 0.14 * every(n, 4) + 0.05 * rand(n + 32k, 15))', {
  chord: 3, inversion: `${voicedInversion(3)} + (n % 8 >= 4)`, length: 0.35,
}, { steps: 32, octave: 4, volume: 0.42, release: 0.08, send: 0.3, synth: { chorus: 0.1 } });
/** the 2010s LA pluck: a bright minor riff bouncing on a dotted pattern, an octave up */
const RATCHET_PLUCK = voice('Ratchet pluck', 'pluck', 'h + pick(n % 8, 7, 4, 7, 9, 7, 4, 2, 4)', '0.4 * bits(pick(floor(n / 16), 0xB6B6, 0xB6B4), n)', { length: 0.4 }, {
  steps: 32, octave: 4, volume: 0.34, release: 0.06, send: 0.3, pan: -0.2, synth: { delay: 0.25, delayTime: 0.375 },
});

/** a part as a plantable preset */
const part = (id: string, t: Template & { name: string }, description: string, formula: string, group?: PresetGroup): Preset => ({
  id,
  name: t.name,
  description,
  formula,
  group,
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
  // ---------- G-funk & West Coast ----------
  part('gwhistle', G_WHISTLE, 'The G-funk whistle: a high sine gliding between long chord tones with a slow vibrato — two phrases that answer each other.', 'glide · h + 7 9 8 7 / 4 7 6 4', 'westcoast'),
  part('moogbass', MOOG_BASS, 'Minimoog-style bass: one voice that slides from the root up to the octave and back through the leading tone, filtered and fat.', 'glide · root, L, −1', 'westcoast'),
  part('gkeys', G_KEYS, 'Rhodes ninth chords on the backbeats, voice-led and chorused — the warm bed under every West Coast record.', 'chord of 5 · bits(0x0808 / 0x082A)', 'westcoast'),
  part('talkbox', TALKBOX, 'Talkbox lead: a resonant saw that talks through a two-bar phrase on the chord, then leaves space for the answer.', 'glide · h + 4 4 5 4 2 4 0…', 'westcoast'),
  part('chickenscratch', SCRATCH_GUITAR, 'Funk chicken-scratch guitar: short muted triads on every off-sixteenth, leaning into the backbeat.', 'chord of 3 · every(n, 2, 1)', 'westcoast'),
  part('pianostabs', PIANO_STABS, 'Staccato piano triads on the eighths, the voicing rocking up and back — the hard, bare West Coast piano.', 'chord of 3 · inversion + (n % 8 ≥ 4)', 'westcoast'),
  part('ratchetpluck', RATCHET_PLUCK, '2010s LA pluck: a bright riff on the chord bouncing through a dotted rhythm, with a short delay.', 'h + 7 4 7 9 7 4 2 4 · bits(0xB6B6)', 'westcoast'),

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
  opts: Partial<Track> & { ratchet?: string; tune?: string; shift?: string } = {},
): Template & { name: string } {
  const { ratchet, tune, shift, ...rest } = opts;
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
  // played late by part of a step: a laid-back snare, a drunk kick
  if (shift) {
    nodes.shift = ['expr', { formula: shift }];
    wires.push('shift.out>out.shift');
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

/** wear a Sonic Menagerie voice: its wave, envelope and whole Shape, with a few settings moved */
function wear(id: string, synth: Partial<SynthParams> = {}): Partial<Track> {
  const v = WAVE_VOICES.find((w) => w.id === id)!;
  return { waveform: 'custom', timbre: v.timbre, attack: v.attack, release: v.release, synth: { ...v.synth, ...synth } };
}

/**
 * Chords that breathe: voice-led chords of `size` on the harmony, struck on `hits`, and pumped by a
 * Curve — on velocity (each strike ducks under the kick) or on pressure (held chords swell back
 * after every beat: sidechain without a compressor).
 */
function chords(
  name: string,
  waveform: Waveform,
  size: number,
  hits: string,
  o: { length: number; strum?: number; lift?: string; duck?: { points: string; repeats: number; lo: number; hi: number; on: 'velocity' | 'pressure'; clock?: string } },
  rest: Partial<Track>,
): Template & { name: string } {
  const nodes: Record<string, [string, NodeData?]> = {
    pitch: ['expr', { formula: o.lift ? `${voicedPitch(size)} + ${o.lift}` : voicedPitch(size) }],
    hit: ['expr', { formula: hits }],
    chord: ['number', { value: size, min: 1, max: 8 }],
    inversion: ['expr', { formula: voicedInversion(size) }],
    length: ['number', { value: o.length, min: 0, max: 64 }],
    out: ['output'],
  };
  const wires = ['pitch.out>out.pitch', 'chord.out>out.chord', 'inversion.out>out.inversion', 'length.out>out.length'];
  if (o.strum) {
    nodes.strum = ['number', { value: o.strum, min: -0.5, max: 0.5 }];
    wires.push('strum.out>out.strum');
  }
  if (o.duck) {
    const { on, clock = 't', ...curve } = o.duck;
    nodes.clock = ['expr', { formula: clock }];
    nodes.duck = ['curve', curve];
    wires.push('clock.out>duck.p');
    if (on === 'velocity') {
      nodes.v = ['math', { op: 'mul' }];
      wires.push('hit.out>v.a', 'duck.out>v.b', 'v.out>out.velocity');
    } else wires.push('hit.out>out.velocity', 'duck.out>out.pressure');
  } else wires.push('hit.out>out.velocity');
  return { name, waveform, steps: 32, stepBeats: 0.25, graph: wire(nodes, wires), ...rest };
}

/** a hand that never hits twice the same: ±12% on each hit, a fresh draw every pass */
const hum = (seed: number, steps = 32) => `(0.88 + 0.12 * rand(n + ${steps}k, ${seed}))`;
/** a hand that is never quite on the grid: up to `amt` of a step late */
const drag = (amt: number, seed: number, steps = 32) => `${amt} * rand(n + ${steps}k, ${seed})`;

/**
 * One kit per style, each a finished groove: the drums sit in a pocket (the snare and the keys a
 * touch behind, every hand humanised, each part swung its own amount), the chords are voice-led
 * ninths and thirteenths, and every sound is shaped — drum tone, decay and drive, filters and
 * envelopes, the Sonic Menagerie voices.
 */
export const KITS: Kit[] = [
  // ---------- Hip-hop & lo-fi ----------
  {
    id: 'dustyfingers',
    group: 'hiphop',
    name: 'Dusty Fingers',
    description:
      '88 bpm boom bap in F dorian, Fm9–B♭9–E♭maj9–Cm9. A saturated kick that skips, a cracking snare dragged a hair behind with ghost notes that come and go, dark swung hats that never land twice the same, vinyl crackle, a round bass with a fifth that leads home, worn Rhodes ninths ducking under the kick, and a clarinet answering in the second bar.',
    song: { bpm: 88, root: 5, scale: 'dorian', harmony: 'pick(bar, 0, 3, 6, 4)' },
    tracks: [
      drum('Kick', 'kick', 32, `0.95 * bits(pick(floor(n / 16), 0x8120, 0xA024), n) * ${hum(3)}`, {
        swing: 0.18, volume: 0.95, synth: { tone: -0.15, decay: 1.15, drive: 0.32 },
      }),
      drum('Snare', 'snare', 32, `max(0.95 * every(n, 8, 4), 0.17 * bits(pick(floor(n / 16), 0x0104, 0x0141), n) * chance(n + 32k, 0.7, 4)) * ${hum(5)}`, {
        shift: `0.1 * every(n, 8, 4) + ${drag(0.05, 6)}`, swing: 0.18, volume: 0.82, send: 0.22, synth: { tone: 0.05, decay: 1.2, drive: 0.25 },
      }),
      drum('Rim', 'rim', 32, '0.4 * every(n, 8, 4)', { shift: '0.1', volume: 0.3, send: 0.2, synth: { tone: 0.25 } }),
      drum('Hats', 'hat', 32, `every(n, 2) * (0.34 + 0.26 * every(n, 4) + 0.1 * rand(n + 32k, 7)) + 0.13 * (n % 2) * chance(n + 32k, 0.35, 8)`, {
        shift: drag(0.04, 9), swing: 0.24, volume: 0.56, pan: 0.12, synth: { tone: -0.35, decay: 0.8 },
      }),
      drum('Open hat', 'openhat', 32, '0.32 * (n == 30)', { swing: 0.24, volume: 0.38, pan: 0.12, synth: { tone: -0.3 } }),
      drum('Crackle', 'hat', 32, '0.04 + 0.08 * chance(n + 32k, 0.4, 10)', { ratchet: '1 + floor(3 * rand(n + 32k, 11))', volume: 0.16, send: 0, pan: -0.2, synth: { tone: 0.85, decay: 0.3 } }),
      voice('Bass', 'custom', `${ROOT} + 4 * (n % 16 == 14)`, `0.84 * bits(pick(floor(n / 16), 0x8122, 0xA026), n) * ${hum(12)}`, { length: 3.5, shift: '0.04 * (n % 4 != 0)' }, {
        timbre: 'sin(tau*p) + 0.3*sin(2*tau*p) + 0.1*sin(3*tau*p)',
        steps: 32, octave: 2, volume: 0.72, attack: 0.005, release: 0.18, swing: 0.18, send: 0.04,
        synth: { filter: 'lowpass', cutoff: 0.32, resonance: 0.15, envAmount: 0.3, envDecay: 0.12, keyTrack: 0.3, decay: 0.7, sustain: 0.7, drive: 0.28, sub: 0.3 },
      }),
      chords('Rhodes', 'keys', 5, `bits(pick(floor(n / 16), 0x8204, 0x0A20), n) * ${hum(13)}`, {
        length: 5, strum: 0.04, duck: { points: '0:0.55:0.6 0.85:1:0 1:0.55:0', repeats: 8, lo: 0, hi: 0.66, on: 'velocity', clock: 'x' },
      }, { octave: 4, volume: 0.46, send: 0.45, swing: 0.2, attack: 0.008, release: 0.7, synth: { cutoff: 0.5, wow: 0.35, drive: 0.15, chorus: 0.45, delay: 0.12, delayTime: 0.75 } }),
      voice('Clarinet', 'custom', 'h + pick(n % 16 + 16 * (k % 2), 0,0,0,0, 8,0,6,0, 0,0,4,0, 6,0,0,0, 0,0,0,0, 7,0,6,0, 0,0,4,0, 2,0,0,0)', '0.46 * bits(pick(floor(n / 16), 0, 0x0A28), n)', { length: 1.6 }, {
        ...wear('moonreed', { delay: 0.3, delayTime: 0.75 }), steps: 32, octave: 5, volume: 0.3, send: 0.45, swing: 0.2, pan: -0.2,
      }),
    ],
  },

  // ---------- G-funk & West Coast ----------
  {
    id: 'cruisecontrol',
    group: 'westcoast',
    name: 'Cruise Control',
    description:
      '92 bpm G-funk in G dorian, Gm9–Gm9–C9–F. A bouncing kick, a snare with a clap flammed just after it, sixteenth hats that breathe, a tambourine on the offbeats, a fat Moog bass sliding through roots and octaves, chorused Rhodes ninths answering the snare, strings far behind, and the high whistle gliding over the top.',
    song: { bpm: 92, root: 7, scale: 'dorian', harmony: 'pick(bar, 0, 0, 3, 6)' },
    tracks: [
      drum('Kick', 'kick', 32, `0.95 * bits(pick(floor(n / 16), 0x8822, 0x80A4), n) * ${hum(3)}`, { swing: 0.12, volume: 0.92, synth: { tone: -0.05, decay: 1.25, drive: 0.25 } }),
      drum('Snare', 'snare', 32, `0.86 * every(n, 8, 4) * ${hum(4)}`, { shift: '0.05', volume: 0.7, send: 0.25, synth: { tone: 0.15, decay: 1.1 } }),
      drum('Clap', 'clap', 32, '0.6 * every(n, 8, 4)', { shift: '0.09', volume: 0.5, send: 0.3, synth: { tone: 0.1 } }),
      drum('Hats', 'hat', 32, `(0.22 + 0.2 * every(n, 2) + 0.1 * every(n, 4)) * ${hum(6)}`, { shift: drag(0.03, 7), swing: 0.14, volume: 0.52, synth: { tone: 0.1, decay: 0.9 } }),
      drum('Tambourine', 'hat', 32, '0.34 * every(n, 8, 4) + 0.12 * every(n, 2, 1)', { swing: 0.14, volume: 0.32, pan: 0.3, synth: { tone: 0.6, decay: 1.4 } }),
      voice('Moog bass', 'sawtooth', `${ROOT} + pick(n % 16, 0,0,0,0, 0,0,0,0, 0,0,L,L, 0,0,-1,-1)`, '0.82 * pick(n % 16, 1,1,1,0, 0,0,1,1, 1,0,1,1, 0,0,1,1)', {}, {
        playMode: 'glide', quantize: true, glide: 0.07, steps: 32, octave: 2, volume: 0.62, release: 0.1, swing: 0.12, send: 0.04,
        synth: { filter: 'lowpass', cutoff: 0.32, resonance: 0.45, envAmount: 0.35, envDecay: 0.2, sub: 0.4, drive: 0.2 },
      }),
      chords('Rhodes', 'keys', 5, `bits(pick(floor(n / 16), 0x0808, 0x082A), n) * 0.46 * ${hum(9)}`, { length: 2.4, strum: 0.03 }, {
        octave: 4, volume: 0.38, send: 0.45, swing: 0.12, synth: { chorus: 0.5, wow: 0.15, vibrato: 0.12 },
      }),
      chords('Strings', 'pad', 4, '0.3 * every(n, 32)', { length: 32 }, { octave: 4, volume: 0.22, attack: 0.8, release: 1.6, send: 0.7, synth: { cutoff: 0.4 } }),
      voice('Whistle', 'sine', 'h + pick(floor(n / 8) + 4 * (k % 2), 7, 9, 8, 7, 4, 7, 6, 4)', 'phase(n, 8) < 0.86 ? 0.4 : 0', {}, {
        playMode: 'glide', quantize: true, glide: 0.13, steps: 32, octave: 6, volume: 0.3, send: 0.55, pan: 0.15, synth: { vibrato: 0.65, delay: 0.2, delayTime: 1 },
      }),
    ],
  },

  // ---------- Trap, phonk & funk trap ----------
  {
    id: 'nightshift',
    group: 'phonk',
    name: 'Night Shift',
    description:
      '140 bpm half-time trap in C♯ harmonic minor, i–i–♭VI–V: a punchy kick, a driven 808 that slides and jumps the octave, a clap and snare stacked on three, hats that roll and climb in pitch, a phonk cowbell riff in the gaps, a choir underneath and a glass bell line crying over the dominant.',
    song: { bpm: 140, root: 1, scale: 'harmonicMinor', harmony: 'pick(bar, 0, 0, 5, 4)' },
    tracks: [
      drum('Kick', 'kick', 32, 'bits(pick(floor(n / 16), 0x8120, 0x80A0), n)', { volume: 0.92, synth: { tone: 0.1, decay: 0.9, drive: 0.45 } }),
      voice('808', 'sine', `${ROOT} + L * (n % 32 >= 28)`, '0.92 * pick(n % 16, 1,1,1,1, 1,1,0,1, 1,1,1,1, 1,1,0,0)', {}, {
        playMode: 'glide', quantize: true, glide: 0.1, steps: 32, octave: 1, volume: 0.88, release: 0.25, send: 0, synth: { drive: 0.55, sub: 0.25 },
      }),
      drum('Clap', 'clap', 32, 'every(n, 16, 8) + 0.3 * (n == 31)', { volume: 0.9, send: 0.32, synth: { drive: 0.3, tone: 0.15 } }),
      drum('Snare', 'snare', 32, '0.55 * every(n, 16, 8)', { volume: 0.6, synth: { tone: 0.3, decay: 0.7 } }),
      drum('Hats', 'hat', 32, `(0.34 + 0.22 * every(n, 2)) * ${hum(5)}`, {
        ratchet: 'pick(n + 32 * (k % 2), 1,1,1,1, 1,1,2,1, 1,1,1,1, 3,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,4,2, 6,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,2,1, 1,1,1,1, 1,1,1,1, 3,3,1,1, 1,1,1,1, 4,2,6,1)',
        tune: 'n % 16 >= 12 ? (n % 16 - 12) * 2 : 0', volume: 0.52, synth: { tone: 0.2, decay: 0.7 },
      }),
      drum('Open hat', 'openhat', 32, '0.3 * (n == 14)', { volume: 0.32, synth: { tone: 0.1 } }),
      drum('Cowbell', 'tom', 32, '0.62 * bits(pick(floor(n / 16), 0x2492, 0x2494), n)', {
        tune: 'pick(n % 8, 24, 24, 27, 24, 23, 24, 20, 24)', volume: 0.2, send: 0.2, pan: 0.2, synth: { decay: 0.35, tone: 0.8, drive: 0.5 },
      }),
      chords('Choir', 'custom', 3, '0.3 * every(n, 32)', { length: 32 }, { ...wear('prismchoir', { cutoff: 0.5 }), octave: 4, volume: 0.22, send: 0.75 }),
      voice('Bell', 'custom', 'h + pick(floor(n / 2) % 8, 7, 6, 4, 2, 4, 6, 4, 0)', '0.4 * every(n, 2) * (n >= 16) * (n % 8 != 6)', { length: 1.6 }, {
        ...wear('glasscathedral', { delay: 0.4, delayTime: 0.75 }), steps: 32, octave: 5, volume: 0.24, send: 0.6, pan: -0.25,
      }),
    ],
  },

  // ---------- Soul, jazz & funk ----------
  {
    id: 'sundaypocket',
    group: 'soul',
    name: 'Sunday Pocket',
    description:
      '86 bpm neo-soul in D♭, ii9–V13–Imaj9–vi9, played behind the beat: a kick that stumbles in late, a snare dragged way back with ghosts, triplet-swung hats, a finger bass that walks into every change, lazy strummed Rhodes ninths, a string bed and brass that swells in at the turnaround.',
    song: { bpm: 86, root: 1, scale: 'major', harmony: 'pick(bar, 1, 4, 0, 5)' },
    tracks: [
      drum('Kick', 'kick', 32, `0.9 * bits(pick(floor(n / 16), 0x8024, 0x8124), n) * ${hum(3)}`, {
        shift: '0.14 * (n % 4 != 0)', swing: 0.26, volume: 0.95, synth: { tone: -0.2, decay: 1.1 },
      }),
      drum('Snare', 'snare', 32, `max(0.85 * every(n, 8, 4), 0.15 * chance(n + 32k, 0.35, 4) * (n % 2)) * ${hum(5)}`, {
        shift: `0.18 * every(n, 8, 4) + ${drag(0.06, 6)}`, swing: 0.26, volume: 0.7, send: 0.25, synth: { tone: -0.15, decay: 1.2 },
      }),
      drum('Hats', 'hat', 32, `(0.36 + 0.22 * every(n, 4)) * (every(n, 2) + 0.35 * chance(n + 32k, 0.3, 8)) * ${hum(7)}`, {
        shift: drag(0.05, 9), swing: 0.3, volume: 0.54, synth: { tone: -0.3, decay: 0.9 },
      }),
      voice('Bass', 'custom', `${ROOT} + pick(n % 16, 0,0,0,0, 0,0,0,0, 4,0,0,0, 0,0,6,0)`, `0.82 * bits(pick(floor(n / 16), 0x8A22, 0x8226), n) * ${hum(12)}`, { length: 1.8, shift: '0.06' }, {
        timbre: 'sin(tau*p) + 0.25*sin(2*tau*p) + 0.1*sin(3*tau*p) + 0.04*sin(5*tau*p)',
        steps: 32, octave: 2, volume: 0.82, attack: 0.006, release: 0.14, swing: 0.26, send: 0.06,
        synth: { filter: 'lowpass', cutoff: 0.38, resonance: 0.12, envAmount: 0.3, envDecay: 0.1, keyTrack: 0.4, decay: 0.55, sustain: 0.55, drive: 0.15 },
      }),
      chords('Rhodes', 'keys', 5, `0.52 * bits(pick(floor(n / 16), 0x8208, 0x0882), n) * ${hum(13)}`, { length: 3.5, strum: 0.05 }, {
        octave: 4, volume: 0.46, send: 0.45, swing: 0.26, synth: { chorus: 0.4, wow: 0.2, vibrato: 0.08 },
      }),
      chords('Strings', 'pad', 4, '0.3 * every(n, 16)', { length: 16 }, { octave: 4, volume: 0.24, attack: 0.9, release: 1.6, send: 0.7, synth: { cutoff: 0.42 } }),
      chords('Brass', 'custom', 3, '0.4 * (n == 26) + 0.34 * (n == 30)', { length: 1.6, lift: 'L' }, {
        ...wear('bronzetitan', { cutoff: 0.5 }), octave: 3, volume: 0.26, send: 0.4, swing: 0.26, pan: -0.2,
      }),
    ],
  },

  // ---------- Trip hop & chill ----------
  {
    id: 'fogline',
    group: 'triphop',
    name: 'Fog Line',
    description:
      '78 bpm trip hop in D minor, i–♭VI–♭III–♭VII. A heavy kick, a cavernous snare dragged behind the beat with a rim under it, half-asleep hats, vinyl crackle, a deep sub, a celestial choir pad, a violin that glides slowly across the chords and a glass bell drifting through the echo.',
    song: { bpm: 78, root: 2, scale: 'minor', harmony: 'pick(bar, 0, 5, 2, 6)' },
    tracks: [
      drum('Kick', 'kick', 32, `bits(pick(floor(n / 16), 0x8020, 0x8420), n) * ${hum(3)}`, { swing: 0.14, volume: 0.95, synth: { tone: -0.4, decay: 1.6, drive: 0.3 } }),
      drum('Snare', 'snare', 32, `max(0.8 * every(n, 8, 4), 0.16 * bits(0x0102, n) * chance(n + 32k, 0.6, 4))`, {
        shift: '0.14', swing: 0.14, volume: 0.62, send: 0.7, synth: { tone: -0.35, decay: 1.5 },
      }),
      drum('Rim', 'rim', 32, '0.35 * every(n, 8, 4) + 0.25 * (n == 29)', { shift: '0.14', volume: 0.36, send: 0.55, pan: -0.15 }),
      drum('Hats', 'hat', 32, `every(n, 2) * (0.22 + 0.14 * every(n, 4)) * chance(n + 32k, 0.8, 5)`, { shift: drag(0.05, 6), swing: 0.2, volume: 0.42, synth: { tone: -0.45, decay: 0.8 } }),
      drum('Crackle', 'hat', 32, '0.05 + 0.08 * chance(n + 32k, 0.35, 10)', { ratchet: '1 + floor(3 * rand(n + 32k, 11))', volume: 0.15, send: 0, synth: { tone: 0.9, decay: 0.3 } }),
      voice('Sub', 'sine', ROOT, '0.75 * bits(pick(floor(n / 16), 0x8020, 0x8420), n)', { length: 6 }, { steps: 32, octave: 2, volume: 0.7, release: 0.5, send: 0, synth: { drive: 0.15 } }),
      chords('Choir', 'custom', 4, '0.32 * every(n, 16)', { length: 16 }, { ...wear('prismchoir', { cutoff: 0.48 }), octave: 4, volume: 0.24, send: 0.8 }),
      voice('Violin', 'custom', 'h + pick(floor(n / 8) + 4 * (k % 2), 4, 6, 7, 6, 8, 7, 6, 4)', 'phase(n, 16) < 0.92 ? 0.36 : 0', {}, {
        ...wear('bowstorm'), playMode: 'glide', quantize: true, glide: 0.22, steps: 32, octave: 5, volume: 0.24, send: 0.65, pan: 0.15,
      }),
      voice('Bell', 'custom', 'h + pick(floor(n / 8) + k, 7, 4, 6, 2)', '0.32 * (n % 16 == 10) * chance(floor(n / 16) + 2k, 0.7, 2)', { length: 6 }, {
        ...wear('glasscathedral', { delay: 0.5, delayTime: 1.5 }), steps: 32, octave: 5, volume: 0.22, send: 0.85, pan: 0.3,
      }),
    ],
  },

  // ---------- Dance & swing ----------
  {
    id: 'afterhours',
    group: 'dance',
    name: 'After Hours',
    description:
      '122 bpm deep house in A minor, Am9–Fmaj9–G9–Em9. A round kick on every beat, a clap a hair late on 2 and 4, open hats on the offbeats, swung shaker sixteenths and a syncopated rim, a deep offbeat bass that pops the octave, minor-ninth organ stabs echoing in eighths, and a pad that pumps on every beat.',
    song: { bpm: 122, root: 9, scale: 'minor', harmony: 'pick(bar, 0, 5, 6, 4)' },
    tracks: [
      drum('Kick', 'kick', 32, 'every(n, 4)', { volume: 0.95, synth: { tone: -0.1, decay: 1.05, drive: 0.15 } }),
      drum('Clap', 'clap', 32, `0.72 * every(n, 8, 4) * ${hum(4)}`, { shift: '0.04', volume: 0.82, send: 0.3, synth: { tone: 0.1 } }),
      drum('Open hat', 'openhat', 32, `0.45 * every(n, 4, 2) * ${hum(5)}`, { volume: 0.42, synth: { tone: 0.1, decay: 0.9 } }),
      drum('Shaker', 'hat', 32, `(0.18 + 0.16 * every(n, 2, 1) + 0.08 * every(n, 4, 2)) * ${hum(6)}`, { swing: 0.12, volume: 0.48, pan: -0.2, synth: { tone: 0.35, decay: 0.7 } }),
      drum('Rim', 'rim', 32, `0.35 * bits(pick(floor(n / 16), 0x0124, 0x0122), n) * ${hum(7)}`, { swing: 0.12, volume: 0.32, send: 0.3, pan: 0.3, synth: { tone: 0.3 } }),
      voice('Bass', 'custom', `${ROOT} + L * (n % 8 == 6)`, `0.84 * bits(pick(floor(n / 16), 0x2226, 0x2232), n) * ${hum(12)}`, { length: 1.4 }, {
        timbre: 'sin(tau*p) + 0.22*sin(2*tau*p) + 0.08*sin(3*tau*p)',
        steps: 32, octave: 2, volume: 0.74, attack: 0.004, release: 0.1, swing: 0.12, send: 0.03,
        synth: { filter: 'lowpass', cutoff: 0.36, resonance: 0.2, envAmount: 0.35, envDecay: 0.1, keyTrack: 0.3, decay: 0.5, sustain: 0.6, drive: 0.18, sub: 0.25 },
      }),
      chords('Organ stabs', 'custom', 5, `0.48 * bits(pick(floor(n / 16), 0x1224, 0x1222), n) * ${hum(13)}`, { length: 0.8 }, {
        timbre: 'sin(tau*p) + 0.5*sin(2*tau*p) + 0.3*sin(3*tau*p) + 0.15*sin(4*tau*p) + 0.1*sin(6*tau*p)', octave: 4, volume: 0.4, send: 0.5, swing: 0.12, attack: 0.005, release: 0.25, synth: { delay: 0.3, delayTime: 0.75, chorus: 0.25 },
      }),
      chords('Pad', 'pad', 4, '0.4 * every(n, 16)', {
        length: 16, duck: { points: '0:0.15:0.7 0.9:1:0 1:0.15:0', repeats: 1, lo: 0, hi: 1, on: 'pressure' },
      }, { octave: 4, volume: 0.32, attack: 0.4, release: 1.2, send: 0.8, synth: { cutoff: 0.45 } }),
    ],
  },

  // ---------- Latin & world ----------
  {
    id: 'aguadecoco',
    group: 'latin',
    name: 'Agua de Coco',
    description:
      '136 bpm bossa nova in G, Gmaj9–Em9–Am9–D13. The rim-shot clave, a soft surdo on the dotted pulse, shaker sixteenths, an upright bass on root and fifth, nylon guitar on the syncopated two-bar strum with a little roll in every chord, strings barely there, and a breathy flute line that answers itself.',
    song: { bpm: 136, root: 7, scale: 'major', harmony: 'pick(bar, 0, 5, 1, 4)' },
    tracks: [
      drum('Clave (rim)', 'rim', 32, `0.58 * bits(pick(floor(n / 16), 0x9224, 0x2240), n) * ${hum(3)}`, { shift: '0.03', volume: 0.78, send: 0.22, synth: { tone: 0.35 } }),
      drum('Surdo', 'kick', 32, '0.7 * bits(0x8080, n) + 0.42 * bits(0x0202, n)', { volume: 0.82, synth: { tone: -0.3, decay: 0.9 } }),
      drum('Shaker', 'hat', 32, `(0.16 + 0.14 * every(n, 2, 1) + 0.06 * every(n, 4)) * ${hum(5)}`, { shift: drag(0.04, 6), swing: 0.06, volume: 0.52, synth: { tone: 0.3, decay: 0.7 } }),
      voice('Upright bass', 'custom', `${ROOT} + 4 * (n % 16 >= 6)`, '0.82 * bits(0x8282, n)', { length: 'pick((n % 16 == 6) + 2 * (n % 16 == 8), 5.5, 1.8, 5.5)' }, {
        timbre: 'sin(tau*p) + 0.4*sin(2*tau*p) + 0.15*sin(3*tau*p) + 0.05*sin(4*tau*p)',
        steps: 32, octave: 2, volume: 0.85, attack: 0.005, release: 0.15, send: 0.1,
        synth: { filter: 'lowpass', cutoff: 0.4, envAmount: 0.3, envDecay: 0.1, keyTrack: 0.4, decay: 0.5, sustain: 0.35 },
      }),
      chords('Nylon guitar', 'pluck', 4, `0.48 * bits(pick(floor(n / 16), 0x9228, 0x2924), n) * ${hum(13)}`, { length: 1.5, strum: 0.03 }, {
        octave: 4, volume: 0.62, send: 0.35, swing: 0.04, pan: 0.15, synth: { chorus: 0.2, cutoff: 0.55 },
      }),
      chords('Strings', 'pad', 4, '0.22 * every(n, 16)', { length: 16 }, { octave: 4, volume: 0.18, attack: 1, release: 1.6, send: 0.7, synth: { cutoff: 0.4 } }),
      voice('Flute', 'flute', 'h + pick(floor(n / 4) % 8 + 8 * (k % 2), 4, 6, 7, 6, 4, 2, 4, 0, 8, 7, 6, 7, 4, 6, 2, 4)', `0.46 * bits(0x8888, n) * chance(floor(n / 4) + 8k, 0.8, 5)`, { length: 3.6 }, {
        steps: 32, octave: 5, volume: 0.48, send: 0.55, attack: 0.04, pan: -0.2, synth: { vibrato: 0.3, delay: 0.15, delayTime: 1 },
      }),
    ],
  },

  // ---------- Breaks & DnB ----------
  {
    id: 'liquidhour',
    group: 'breaks',
    name: 'Liquid Hour',
    description:
      '174 bpm liquid drum & bass in F minor, i–♭VI–♭III–♭VII two bars each. A two-step kick, a tight snare with ghosts that shuffle, rolling sixteenth hats and a ride, a rolling neuro bass gliding on the roots, choir pads pumping on every beat, Rhodes ninths answering the snare, and glass arps echoing high above.',
    song: { bpm: 174, root: 5, scale: 'minor', harmony: 'pick(floor(bar / 2), 0, 5, 2, 6)' },
    tracks: [
      drum('Kick', 'kick', 32, `bits(pick(floor(n / 16), 0x8020, 0x8024), n) * ${hum(3)}`, { volume: 0.92, synth: { decay: 0.8, drive: 0.2 } }),
      drum('Snare', 'snare', 32, `max(0.92 * every(n, 8, 4), 0.18 * bits(pick(floor(n / 16), 0x0141, 0x0105), n) * chance(n + 32k, 0.65, 4)) * ${hum(5)}`, {
        shift: '0.03', volume: 0.8, send: 0.2, synth: { tone: 0.3, decay: 0.9 },
      }),
      drum('Hats', 'hat', 32, `(0.26 + 0.24 * every(n, 2, 1) + 0.08 * every(n, 4)) * ${hum(6)}`, { swing: 0.08, volume: 0.52, synth: { tone: 0.25, decay: 0.7 } }),
      drum('Ride', 'hat', 32, '0.16 * every(n, 2) + 0.06', { volume: 0.26, send: 0.3, pan: 0.3, synth: { tone: 0.4, decay: 2.2 } }),
      voice('Neuro bass', 'custom', `${ROOT} + pick(n % 16, 0,0,0,0, 0,0,0,0, 0,0,L,0, 0,0,0,0)`, '0.82 * pick(n % 16, 1,1,1,1, 1,1,1,0, 1,1,1,1, 1,0,1,0)', {}, {
        ...wear('undertow', { cutoff: 0.42, sauce: 0.5 }), playMode: 'glide', quantize: true, glide: 0.06, steps: 32, octave: 2, volume: 0.6, send: 0.08,
      }),
      chords('Choir pad', 'custom', 5, '0.4 * every(n, 32)', {
        length: 32, duck: { points: '0:0.2:0.7 0.9:1:0 1:0.2:0', repeats: 1, lo: 0, hi: 1, on: 'pressure' },
      }, { ...wear('prismchoir', { cutoff: 0.55 }), octave: 3, volume: 0.26, send: 0.75 }),
      chords('Rhodes', 'keys', 5, `0.42 * bits(pick(floor(n / 16), 0x0820, 0x0208), n) * ${hum(13)}`, { length: 2.5, strum: 0.02 }, {
        octave: 4, volume: 0.36, send: 0.45, pan: -0.15, synth: { chorus: 0.35, delay: 0.25, delayTime: 0.75 },
      }),
      voice('Glass arp', 'custom', 'h + pick(n % 8, 0, 4, 7, 9, 7, 4, 2, 4)', '0.3 * every(n, 2) * (n >= 16) * chance(n + 32k, 0.8, 7)', { length: 1 }, {
        ...wear('glasscathedral', { delay: 0.45, delayTime: 0.75 }), steps: 32, octave: 6, volume: 0.18, send: 0.6, pan: 0.3,
      }),
    ],
  },

  // ---------- Math rhythms ----------
  {
    id: 'phasegarden',
    group: 'math',
    name: 'Phase Garden',
    description:
      '100 bpm phase music in D yo (pentatonic): one marimba figure played twice — once in 12 steps, once in 13 — so the two drift apart and come home every 156 steps, Reich-style. Under it a 3-in-8 kick, a 5-in-12 rim, a 7-in-16 shaker, bells walking the golden ratio in a 21-step Fibonacci rhythm, a slow root-and-fifth bass and a drone.',
    song: { bpm: 100, root: 2, scale: 'yo', harmony: '0' },
    tracks: [
      voice('Marimba · 12', 'pluck', 'pick(n, 0, 2, 4, 2, 5, 4, 0, 2, 4, 5, 7, 5)', `(0.42 + 0.22 * euclid(n, 5, 12)) * ${hum(3, 12)}`, { length: 0.9 }, {
        steps: 12, octave: 4, volume: 0.42, send: 0.35, pan: -0.35, synth: { cutoff: 0.6, decay: 0.4 },
      }),
      voice('Marimba · 13', 'pluck', 'pick(n, 0, 2, 4, 2, 5, 4, 0, 2, 4, 5, 7, 5, 4)', `(0.42 + 0.22 * euclid(n, 5, 13)) * ${hum(4, 13)}`, { length: 0.9 }, {
        steps: 13, octave: 4, volume: 0.42, send: 0.35, pan: 0.35, synth: { cutoff: 0.6, decay: 0.4 },
      }),
      drum('Kick · 3/8', 'kick', 8, 'euclid(n, 3, 8)', { volume: 0.78, synth: { tone: -0.25, decay: 1.1 } }),
      drum('Rim · 5/12', 'rim', 12, `0.5 * euclid(n, 5, 12, 1) * ${hum(5, 12)}`, { volume: 0.42, send: 0.25, pan: 0.2, synth: { tone: 0.3 } }),
      drum('Shaker · 7/16', 'hat', 16, `(0.2 + 0.2 * euclid(n, 7, 16, 2)) * ${hum(6, 16)}`, { volume: 0.34, pan: -0.15, synth: { tone: 0.35, decay: 0.7 } }),
      voice('Golden bells', 'bell', 'floor(n * 1.618034) % 7', `0.34 * euclid(n, 8, 21)`, { length: 2 }, {
        steps: 21, stepBeats: 0.5, octave: 5, volume: 0.28, send: 0.6, synth: { delay: 0.3, delayTime: 1.5 },
      }),
      voice('Bass', 'custom', 'pick(floor(n / 4), 0, 0, 3, 0)', '0.7 * every(n, 4)', { length: 3.5 }, {
        timbre: 'sin(tau*p) + 0.2*sin(2*tau*p)', steps: 16, stepBeats: 0.5, octave: 2, volume: 0.6, release: 0.3, send: 0.1,
        synth: { filter: 'lowpass', cutoff: 0.35, decay: 0.8, sustain: 0.6 },
      }),
      chords('Drone', 'custom', 3, '0.28 * every(n, 32)', { length: 32 }, { ...wear('prismchoir', { cutoff: 0.42 }), steps: 32, stepBeats: 0.5, octave: 3, volume: 0.2, send: 0.8 }),
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
