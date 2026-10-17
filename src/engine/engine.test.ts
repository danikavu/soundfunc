import { describe, expect, it } from 'vitest';
import { compile } from './expr';
import { compileGraph, euclid } from './graph';
import { exportMidi, collectNotes } from './midi';
import { degreeToMidi, SCALES, valueToMidi } from './music';
import { PRESETS, defaultProject, trackFromPreset } from './presets';
import { renderTrack } from './project';

const ev = (s: string, scope = {}) => compile(s).fn(scope);

describe('expr', () => {
  it('handles precedence and power', () => {
    expect(ev('1 + 2 * 3')).toBe(7);
    expect(ev('-2^2')).toBe(-4);
    expect(ev('2^3^2')).toBe(512);
    expect(ev('(1 + 2) * 3')).toBe(9);
  });
  it('supports implicit multiplication and constants', () => {
    expect(ev('2pi')).toBeCloseTo(Math.PI * 2);
    expect(ev('3(x + 1)', { x: 1 })).toBe(6);
  });
  it('uses positive modulo, comparisons and ternary', () => {
    expect(ev('-1 % 7')).toBe(6);
    expect(ev('n % 4 == 0 ? 1 : 2', { n: 8 })).toBe(1);
    expect(ev('n > 2 && n < 5', { n: 3 })).toBe(1);
  });
  it('calls library functions', () => {
    expect(ev('fib(10)')).toBe(55);
    expect(ev('prime(4)')).toBe(11);
    expect(ev('max(1, 5, 3)')).toBe(5);
    expect(ev('rand(3, 1)')).toBe(ev('rand(3, 1)'));
  });
  it('reports errors', () => {
    expect(() => compile('1 +')).toThrow();
    expect(() => compile('foo(1)')).toThrow(/Unknown function/);
    expect(() => compile('q', ['x'])).toThrow(/Unknown variable/);
  });
});

describe('music', () => {
  it('maps scale degrees across octaves', () => {
    const major = SCALES.major.steps;
    expect(degreeToMidi(0, 0, major, 4)).toBe(60);
    expect(degreeToMidi(7, 0, major, 4)).toBe(72);
    expect(degreeToMidi(-1, 0, major, 4)).toBe(59);
  });
  it('snaps semitones to the scale', () => {
    // C# in C major snaps to C or D
    expect([60, 62]).toContain(valueToMidi(1, 'semitone', 0, 'major', 4));
  });
});

describe('graph', () => {
  it('euclid(3,8) gives the tresillo', () => {
    expect([...Array(8)].map((_, i) => euclid(i, 3, 8))).toEqual([1, 0, 0, 1, 0, 0, 1, 0]);
  });
  it('detects cycles without crashing', () => {
    const p = compileGraph({
      nodes: [
        { id: 'a', type: 'math', position: { x: 0, y: 0 }, data: { op: 'add' } },
        { id: 'b', type: 'math', position: { x: 0, y: 0 }, data: { op: 'add' } },
        { id: 'o', type: 'output', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: '1', source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'a' },
        { id: '2', source: 'b', sourceHandle: 'out', target: 'a', targetHandle: 'a' },
        { id: '3', source: 'b', sourceHandle: 'out', target: 'o', targetHandle: 'pitch' },
      ],
    });
    expect(p.errors.size).toBeGreaterThan(0);
    expect(p.run({ n: 0, x: 0, t: 0, k: 0, steps: 1 })).not.toBeNull();
  });
  it('every preset renders notes without errors', () => {
    const song = defaultProject().song;
    PRESETS.forEach((preset, i) => {
      const r = renderTrack(trackFromPreset(preset, i), song);
      expect(r.errors.size, preset.id).toBe(0);
      expect(r.notes.length, preset.id).toBeGreaterThan(0);
      for (const n of r.notes) expect(n.midi).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('midi', () => {
  it('writes a valid SMF header and tracks', () => {
    const p = defaultProject();
    const bytes = exportMidi(p);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    const ntracks = (bytes[10] << 8) | bytes[11];
    expect(ntracks).toBe(p.tracks.length + 1);
    // walk the chunks and check lengths line up with the file size
    let off = 14;
    for (let i = 0; i < ntracks; i++) {
      expect(String.fromCharCode(...bytes.slice(off, off + 4))).toBe('MTrk');
      const len = (bytes[off + 4] << 24) | (bytes[off + 5] << 16) | (bytes[off + 6] << 8) | bytes[off + 7];
      off += 8 + len;
    }
    expect(off).toBe(bytes.length);
  });
  it('tiles shorter patterns to the export length', () => {
    const p = defaultProject();
    const notes = collectNotes(p);
    const total = 8 * 4; // longest pattern is 8 beats, 4 loops
    for (const t of notes) for (const n of t.notes) expect(n.beat).toBeLessThan(total);
  });
});
