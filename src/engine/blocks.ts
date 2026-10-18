import type { Block } from './graphEdit';
import { wire } from './presets';

/** Ready-made groups of nodes, from the Add-node menu or by dragging a wire into space. */
function block(id: string, name: string, description: string, nodes: Parameters<typeof wire>[0], wires: string[], extra: Partial<Block>): Block {
  const g = wire(nodes, wires);
  return { id, name, description, nodes: g.nodes, edges: g.edges, ...extra };
}

export const BLOCKS: Block[] = [
  block('arp', 'Arpeggio', 'Walks the current chord: h + 0, 2, 4, octave', { f: ['expr', { formula: 'h + pick(n, 0, 2, 4, L)' }] }, [], {
    outlet: { node: 'f', handle: 'out' },
    toOutput: [{ node: 'f', handle: 'out', port: 'pitch' }],
  }),
  block('drop', 'Octave-drop bass', 'Drops whatever comes in (a) an octave on every 8th step', { f: ['expr', { formula: 'a - L * every(n, 8)' }] }, [], {
    inlet: { node: 'f', handle: 'a' },
    outlet: { node: 'f', handle: 'out' },
  }),
  block('hook', 'Pitch hook', 'Each note starts 2 degrees high and falls into place', { f: ['expr', { formula: 'a + 2 * exp(-12 * fract(t * 4))' }] }, [], {
    inlet: { node: 'f', handle: 'a' },
    outlet: { node: 'f', handle: 'out' },
  }),
  block('gate', 'Euclid gate', 'Five hits spread over eight steps, as velocity', { e: ['euclid', { pulses: 5, length: 8, rotate: 0 }], v: ['math', { op: 'mul', b: 0.8 }] }, ['e.out>v.a'], {
    outlet: { node: 'v', handle: 'out' },
    toOutput: [{ node: 'v', handle: 'out', port: 'velocity' }],
  }),
  block('chord', 'Chord on the harmony', 'Pitch = the song’s chord h, stacked as a triad', { p: ['expr', { formula: 'h' }], size: ['number', { value: 3, min: 1, max: 8 }] }, [], {
    outlet: { node: 'p', handle: 'out' },
    toOutput: [
      { node: 'p', handle: 'out', port: 'pitch' },
      { node: 'size', handle: 'out', port: 'chord' },
    ],
  }),
  block('ghost', 'Ghost notes', 'Keeps the hits (a) and sprinkles quiet random ones between', { f: ['expr', { formula: 'max(a, 0.3 * chance(n + 16k, 0.2, 7))' }] }, [], {
    inlet: { node: 'f', handle: 'a' },
    outlet: { node: 'f', handle: 'out' },
  }),
  block('humanize', 'Humanize', 'Small random velocity changes, different every loop', { f: ['expr', { formula: 'a * (0.8 + 0.2 * rand(n + 16k, 3))' }] }, [], {
    inlet: { node: 'f', handle: 'a' },
    outlet: { node: 'f', handle: 'out' },
  }),
  block('roll', 'Roll at the end', 'Triplet roll on the last two steps of every other loop', { f: ['expr', { formula: 'n % 16 >= 14 && k % 2 == 1 ? 3 : 1' }] }, [], {
    outlet: { node: 'f', handle: 'out' },
    toOutput: [{ node: 'f', handle: 'out', port: 'ratchet' }],
  }),
  block('lfo', 'Slow wave', 'A sine taking four loops… a quarter cycle per loop', { w: ['wave', { shape: 'sine', cycles: 0.25, amp: 2, offset: 0 }] }, [], {
    outlet: { node: 'w', handle: 'out' },
  }),
  block('ab', 'A / B sections', 'Two ideas taking turns every 8 beats', {
    a: ['expr', { formula: 'h + pick(n, 0, 2, 4)' }],
    b: ['expr', { formula: 'h + pick(n, 4, 2, 0, -1)' }],
    s: ['sections', { lengths: '8 8', unit: 'beats' }],
  }, ['a.out>s.A', 'b.out>s.B'], {
    outlet: { node: 's', handle: 'out' },
  }),
];
