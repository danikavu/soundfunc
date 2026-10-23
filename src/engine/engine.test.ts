import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile, compileAst, parse } from './expr';
import { compose, toSource, toTex, trackCode } from './symbolic';
import { compileGraph, euclid, evalCurve, NODE_DEFS, parseCurve } from './graph';
import { docFor } from './nodeDocs';
import { exportMidi, collectNotes, simplifyCurve, CURVE_TOLERANCE } from './midi';
import { patternBeats, songWindows, stretchOf } from './project';
import { degreeToMidi, SCALES, valueToMidi } from './music';
import { CHANNEL_PALETTE, KITS, PRESETS, defaultProject, pickColor, trackFromPreset, trackFromTemplate } from './presets';
import { harmonyAt, normalizeProject, renderTrack, scaleLength, songBeats, type Project, type Track } from './project';
import { chordName, chordTones, limitPitch } from './music';
import { mulberry32, mutateFormula, mutateOneNode, mutateTrack, musicalScore } from './mutate';
import { useStore } from '../state/store';
import { parsePattern } from './graph';
import { timbreHarmonics } from './timbre';
import { importMath } from './importMath';
import { auditionGraph, blockFromSelection, collapseNodes, curveToFormula, explodeFormula, insertBlock } from './graphEdit';
import { BLOCKS } from './blocks';
import { applyGrid } from './steps';
import { cleanProject, functionFile, functionOf, projectKey, readFunctionFile, useLibrary, voiceOf, wearsVoice } from '../state/library';

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
    expect(p.run({ n: 0, x: 0, t: 0, k: 0, steps: 1, h: 0, bar: 0, L: 7, beat: 0, np: 0, vars: {} })).not.toBeNull();
  });
  it('every preset renders notes without errors', () => {
    const song = defaultProject().song;
    PRESETS.forEach((preset, i) => {
      const r = renderTrack(trackFromPreset(preset, i), song);
      expect(r.errors.size, preset.id).toBe(0);
      // glide presets sound through their curve rather than discrete notes
      const sounding = preset.track.playMode === 'glide' ? r.curve.velocity.filter((v) => v > 0.01).length : r.notes.length;
      expect(sounding, preset.id).toBeGreaterThan(0);
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

describe('patterns & rhythm', () => {
  it('parses hex/binary literals and pattern helpers', () => {
    expect(ev('0xff')).toBe(255);
    expect(ev('0b101')).toBe(5);
    expect([0, 1, 2, 3].map((n) => ev('bits(0b1001, n, 4)', { n }))).toEqual([1, 0, 0, 1]);
    expect(ev('pick(5, 10, 20, 30)')).toBe(30);
    expect(ev('every(8, 4)')).toBe(1);
    expect(ev('recaman(4)')).toBe(2); // 0 1 3 6 2
  });
  it('reads drum notation', () => {
    expect(parsePattern('X.x|o 9')).toEqual([1, 0, 0.75, 0.35, 1]);
  });
  it('ratchets and swing produce extra, shifted hits', () => {
    const kit = KITS.find((k) => k.id === 'trap')!;
    const hats = trackFromTemplate(kit.tracks[2], 'hats', 0);
    const r = renderTrack(hats, defaultProject().song);
    expect(r.notes.length).toBeGreaterThan(hats.steps); // rolls add hits
    const swung = renderTrack({ ...hats, swing: 0.5 }, defaultProject().song);
    expect(swung.notes.find((n) => n.step === 1)!.beat).toBeCloseTo(1.5 * hats.stepBeats);
  });
});

describe('glide', () => {
  const theremin = () => trackFromPreset(PRESETS.find((p) => p.id === 'theremin')!, 0);
  it('produces a continuous, unquantized curve and no notes', () => {
    const r = renderTrack(theremin(), defaultProject().song);
    expect(r.notes).toHaveLength(0);
    expect(r.curve.midi.length).toBe(16 * 16);
    expect(r.curve.midi.some((m) => Math.abs(m - Math.round(m)) > 0.05)).toBe(true);
  });
  it('snaps to whole notes when quantized', () => {
    const r = renderTrack({ ...theremin(), quantize: true }, defaultProject().song);
    expect(r.curve.midi.every((m) => m === Math.round(m))).toBe(true);
  });
  it('exports glide as pitch bend and drums on channel 10', () => {
    const kit = KITS.find((k) => k.id === 'dnb')!;
    const p: Project = { name: 'dnb', song: { ...defaultProject().song, ...kit.song }, tracks: kit.tracks.map((t, i) => trackFromTemplate(t, t.name, i)) };
    const bytes = exportMidi(p);
    const has = (status: number) => bytes.some((b, i) => b === status && i > 14);
    expect(has(0x99)).toBe(true); // note-on, channel 10
    expect([...bytes].some((b) => (b & 0xf0) === 0xe0)).toBe(true); // pitch bend
  });
});

describe('kits & custom timbre', () => {
  it('every kit renders without errors', () => {
    for (const kit of KITS) {
      const song = { ...defaultProject().song, ...kit.song };
      kit.tracks.forEach((t, i) => {
        const r = renderTrack(trackFromTemplate(t, t.name, i), song);
        expect(r.errors.size, `${kit.id}/${t.name}`).toBe(0);
        expect(r.notes.length + r.curve.velocity.filter((v) => v > 0.01).length, `${kit.id}/${t.name}`).toBeGreaterThan(0);
      });
    }
  });
  it('turns a formula into harmonics', () => {
    const h = timbreHarmonics('sin(tau*p)')!;
    expect(Math.abs(h.imag[1])).toBeGreaterThan(0.9);
    expect(Math.abs(h.imag[2])).toBeLessThan(0.01);
    expect(timbreHarmonics('sin(')).toBeNull();
  });
  it('fills in fields missing from older saved projects', () => {
    const old = defaultProject();
    const stripped = { ...old, tracks: old.tracks.map(({ playMode, swing, send, ...t }) => t as Track) };
    const p = normalizeProject(stripped);
    expect(p.tracks[0].playMode).toBe('notes');
    expect(p.tracks[0].send).toBe(1);
  });
});

describe('chords & harmony', () => {
  it('stacks scale thirds into diatonic chords', () => {
    // C major: I = C E G, ii = D F A, V7 = G B D F
    expect(chordTones(0, 3, 2, 0, 0, 'major', 4)).toEqual([60, 64, 67]);
    expect(chordTones(1, 3, 2, 0, 0, 'major', 4)).toEqual([62, 65, 69]);
    expect(chordTones(4, 4, 2, 0, 0, 'major', 4)).toEqual([67, 71, 74, 77]);
    // first inversion lifts the root
    expect(chordTones(0, 3, 2, 1, 0, 'major', 4)).toEqual([64, 67, 72]);
    // quartal: stacked fourths
    expect(chordTones(0, 3, 3, 0, 0, 'major', 4)).toEqual([60, 65, 71]);
  });
  it('names chords', () => {
    expect(chordName(0, 0, 'major').name).toBe('C');
    expect(chordName(1, 0, 'major').name).toBe('Dm');
    expect(chordName(6, 0, 'major')).toEqual({ name: 'B°', roman: 'vii°' });
    expect(chordName(4, 0, 'major', 4).name).toBe('G7');
  });
  it('evaluates the progression per bar and feeds h to tracks', () => {
    const song = { ...defaultProject().song, root: 0, scale: 'major', harmony: 'pick(bar, 0, 4, 5, 3)' };
    expect([0, 4, 8, 12, 16].map((b) => harmonyAt(song, b))).toEqual([0, 4, 5, 3, 0]);
    const pad = trackFromPreset(PRESETS.find((p) => p.id === 'chordPad')!, 0);
    const notes = renderTrack(pad, song, 1).notes; // loop 1 = bar 1 = V
    expect(notes.map((n) => n.midi % 12).sort((a, b) => a - b)).toEqual([2, 5, 7, 11]); // G B D F
  });
  it('strums chords across time', () => {
    const strum = trackFromPreset(PRESETS.find((p) => p.id === 'strum')!, 0);
    const notes = renderTrack(strum, defaultProject().song).notes.filter((n) => n.step === 0);
    expect(notes).toHaveLength(3);
    expect(notes[1].beat).toBeGreaterThan(notes[0].beat);
  });
});

describe('randomizer', () => {
  it('mutates formulas into valid formulas', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      const out = mutateFormula('3*sin(tau*x) + bits(0xA030, n) + pick(n, 0, 2, 4)', i / 200, rng, ['n', 'x', 'k', 'h', 'L'], true);
      expect(() => compile(out, ['n', 'x', 'k', 'h', 'L'])).not.toThrow();
    }
  });
  it('reads number roles from context: degrees stay degrees, probabilities stay in 0..1', () => {
    const rng = mulberry32(5);
    const vars = ['n', 'x', 'k', 'h', 'L'];
    for (let i = 0; i < 300; i++) {
      const f = mutateFormula('h + pick(n, 0, 2, 4) + chance(n, 0.5, 3) + every(n, 4, 2)', 1, rng, vars);
      const nums = (re: RegExp) => [...f.matchAll(re)].map((m) => m[1].split(',').map((v) => Number(v.replace(/[()\s]/g, ''))));
      for (const args of nums(/pick\(n,([^)]*(?:\([^)]*\))*[^)]*)\)/g)) for (const d of args) expect(Math.abs(d)).toBeLessThanOrEqual(14);
      for (const [p] of nums(/chance\(n, ([^,]+),/g)) expect(p).toBeLessThanOrEqual(0.95);
    }
  });
  it('keeps the meaning of minus signs', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 100; i++) {
      const f = mutateFormula('x - 3', 0.9, rng, ['x']);
      expect(() => compile(f, ['x'])).not.toThrow();
      // unary minus is rewritten together with its number, never as -(-2)
      let g = 'pick(n, -2, 0, -4)';
      for (let j = 0; j < 5; j++) g = mutateFormula(g, 0.9, rng, ['n']);
      expect(g).not.toContain('(-(');
      expect(g).not.toContain('--');
    }
  });
  it('is deterministic per seed and actually changes something', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'fib')!, 0);
    const song = defaultProject().song;
    const a = mutateTrack(t, song, 0.3, 42);
    const b = mutateTrack(t, song, 0.3, 42);
    expect(JSON.stringify(a.track.graph)).toBe(JSON.stringify(b.track.graph));
    expect(JSON.stringify(a.track.graph)).not.toBe(JSON.stringify(t.graph));
  });
  it('respects locked nodes', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
    t.graph.nodes = t.graph.nodes.map((n) => ({ ...n, data: { ...n.data, locked: true } }));
    expect(mutateTrack(t, defaultProject().song, 0.9, 7).track.graph).toEqual(t.graph);
  });
  it('harmonious mode stays closer to chord tones than experimental', () => {
    const song = { ...defaultProject().song, root: 0, scale: 'major', harmony: 'pick(bar, 0, 3, 4, 0)' };
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'arp')!, 0);
    const avgNovelty = (chaos: number) => {
      let total = 0;
      for (let s = 0; s < 12; s++) {
        const m = mutateTrack(t, song, chaos, 100 + s);
        const a = renderTrack(m.track, song).notes.map((n) => n.midi);
        const o = renderTrack(t, song).notes.map((n) => n.midi);
        total += a.reduce((acc, v, i) => acc + Math.abs(v - (o[i] ?? v)), 0) / Math.max(1, a.length);
      }
      return total / 12;
    };
    expect(avgNovelty(0.1)).toBeLessThan(avgNovelty(0.95));
    // scoring is finite for a real candidate
    const r = renderTrack(t, song);
    expect(Number.isFinite(musicalScore(renderTrack(mutateTrack(t, song, 0.2, 3).track, song), r, t, song, 0.2))).toBe(true);
  });
});

describe('symbolic: the written-out function equals the graph', () => {
  const all = () => {
    const out: { label: string; track: Track; song: Project['song'] }[] = [];
    const outs: typeof out = [];
    const base = defaultProject().song;
    const song = { ...base, harmony: 'pick(bar, 0, 4, 5, 3)' };
    PRESETS.forEach((p, i) => out.push({ label: p.id, track: trackFromPreset(p, i), song }));
    for (const kit of KITS) kit.tracks.forEach((t, i) => out.push({ label: `${kit.id}/${t.name}`, track: trackFromTemplate(t, t.name, i), song: { ...base, ...kit.song } }));
    // channels driven by Curve nodes: every starter curve, into Note Out, plus one curve read through another phase
    for (const id of ['duck', 'ramp', 'swell', 'bentsaw']) {
      const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
      const b = BLOCKS.find((x) => x.id === id)!;
      const out = t.graph.nodes.find((n) => n.type === 'output')!;
      const port = id === 'ramp' ? 'pitch' : (b.toOutput?.[0]?.port ?? 'pitch');
      const g = insertBlock({ ...t.graph, edges: t.graph.edges.filter((e) => !(e.target === out.id && e.targetHandle === port)) }, { ...b, toOutput: [{ node: 'c', handle: 'out', port }] }, { x: 0, y: 400 }).graph;
      outs.push({ label: `curve/${id}`, track: { ...t, graph: g }, song });
    }
    {
      const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
      const out = t.graph.nodes.find((n) => n.type === 'output')!;
      t.graph = {
        nodes: [...t.graph.nodes, { id: 'ph', type: 'expr', position: { x: 0, y: 0 }, data: { formula: 'fract(t / 3) * 0.9 + 0.05' } }, { id: 'cv', type: 'curve', position: { x: 0, y: 0 }, data: { points: '0.1:0.2:0.8 0.4:1:-0.7 0.4:0.3:0 0.85:0.6:0.3', repeats: 2, lo: -3, hi: 9 } }],
        edges: [...t.graph.edges.filter((e) => !(e.target === out.id && e.targetHandle === 'pitch')), { id: 'e1', source: 'ph', sourceHandle: 'out', target: 'cv', targetHandle: 'p' }, { id: 'e2', source: 'cv', sourceHandle: 'out', target: out.id, targetHandle: 'pitch' }],
      };
      outs.push({ label: 'curve/wired', track: t, song });
    }
    out.push(...outs);
    return out;
  };
  const scopeFor = (track: Track, song: Project['song'], n: number, k: number) => {
    const t = n * track.stepBeats;
    const beat = k * track.steps * track.stepBeats + t;
    return { ...Object.fromEntries((track.sliders ?? []).map((s) => [s.name, s.value])), n, x: n / track.steps, t, k, steps: track.steps, h: harmonyAt(song, beat), bar: Math.floor(beat / 4 + 1e-9), L: scaleLength(song), beat, np: 0 } as Record<string, number>;
  };

  it('symbolic expressions reproduce every preset and kit track', () => {
    for (const { label, track, song } of all()) {
      const c = compose(track);
      for (const k of [0, 1]) {
        const r = renderTrack(track, song, k, false);
        for (let n = 0; n < track.steps; n++) {
          const scope = scopeFor(track, song, n, k);
          for (const b of c.math.bindings) scope[b.name] = compileAst(b.ast)(scope);
          const val = (port: string) => compileAst(c.math.outputs.find((o) => o.port === port)!.ast)(scope);
          expect(val('pitch'), `${label} pitch n=${n} k=${k}`).toBeCloseTo(r.pitchCurve[n], 9);
          expect(Math.min(1, Math.max(0, val('velocity'))), `${label} vel n=${n} k=${k}`).toBeCloseTo(r.velocityCurve[n], 9);
        }
      }
    }
  });

  it('generated JavaScript runs and matches the engine', () => {
    for (const { label, track, song } of all()) {
      const c = compose(track);
      const code = trackCode([c], song, 'js').replace(/^export /gm, '');
      const fnName = code.match(/function (\w+)\(n, k = 0/)![1];
      const fn = new Function(`${code}\nreturn ${fnName};`)() as (n: number, k: number) => Record<string, number>;
      const r = renderTrack(track, song, 1, false);
      for (let n = 0; n < track.steps; n++) {
        const o = fn(n, 1);
        expect(o.pitch, `${label} js pitch n=${n}`).toBeCloseTo(r.pitchCurve[n], 9);
        expect(Math.min(1, Math.max(0, o.velocity)), `${label} js vel n=${n}`).toBeCloseTo(r.velocityCurve[n], 9);
      }
    }
  });

  it('generated Python runs and matches the engine', () => {
    let python = '';
    try {
      python = execFileSync('python3', ['--version']).toString();
    } catch {
      return; // no python on this machine
    }
    expect(python).toMatch(/Python 3/);
    const dir = mkdtempSync(join(tmpdir(), 'soundfunc-py-'));
    for (const { label, track, song } of all()) {
      const c = compose(track);
      const code = trackCode([c], song, 'py');
      const fnName = code.match(/def (\w+)\(n, k=0/)![1];
      const file = join(dir, 'track.py');
      writeFileSync(file, `${code}\nimport json\nprint(json.dumps([${fnName}(n, 1) for n in range(${track.steps})]))\n`);
      const rows = JSON.parse(execFileSync('python3', ['-I', file]).toString().trim().split('\n').pop()!) as Record<string, number>[];
      const r = renderTrack(track, song, 1, false);
      rows.forEach((o, n) => {
        expect(o.pitch, `${label} py pitch n=${n}`).toBeCloseTo(r.pitchCurve[n], 9);
        expect(Math.min(1, Math.max(0, o.velocity)), `${label} py vel n=${n}`).toBeCloseTo(r.velocityCurve[n], 9);
      });
    }
  }, 30_000);

  it('prints readable formulas and LaTeX', () => {
    const pond = compose(trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0));
    expect(toSource(pond.math.outputs[0].ast)).toBe('4 * sine(x)');
    expect(toTex(pond.math.outputs[0].ast)).toBe('4\\,\\operatorname{sine}\\left(x\\right)');
    // a formula printed as source parses back to the same value
    const ast = parse('-(2 + x)^2 % 3 - pick(n, -1, 2) * (x > 0.5 ? 1 : -1)').ast;
    const again = parse(toSource(ast)).ast;
    for (const x of [0, 0.3, 0.7]) expect(compileAst(again)({ x, n: 3 })).toBeCloseTo(compileAst(ast)({ x, n: 3 }), 12);
  });
});

describe('library', () => {
  it('saved projects drop editor-only state, so selecting a node is not an edit', () => {
    const p = defaultProject();
    const selected = {
      ...p,
      tracks: p.tracks.map((t) => ({ ...t, graph: { ...t.graph, nodes: t.graph.nodes.map((n) => ({ ...n, selected: true, measured: { width: 1, height: 2 } })) } })),
    };
    expect(projectKey(selected)).toBe(projectKey(p));
    expect(JSON.stringify(cleanProject(selected))).not.toContain('selected');
    const edited = { ...p, song: { ...p.song, bpm: p.song.bpm + 1 } };
    expect(projectKey(edited)).not.toBe(projectKey(p));
  });
  it('voices capture and recognise a track’s sound', () => {
    const t = { ...trackFromPreset(PRESETS.find((x) => x.id === 'wavetable')!, 0) };
    const v = voiceOf(t, 'Folded');
    expect(v).toMatchObject({ name: 'Folded', waveform: 'custom', timbre: t.timbre });
    expect(wearsVoice(t, v)).toBe(true);
    expect(wearsVoice({ ...t, timbre: 'sin(tau*p)' }, v)).toBe(false);
  });
  it('saved functions keep every node, value and the track’s sliders', () => {
    const song = defaultProject().song;
    const t = trackFromPreset(PRESETS.find((x) => x.id === 'desmos')!, 0);
    const expr = t.graph.nodes.find((n) => n.type === 'expr');
    expect(expr).toBeTruthy();
    expr!.data = { ...expr!.data, formula: `${expr!.data.formula} + depth/12` };
    t.sliders = [{ name: 'depth', value: 3, min: 0, max: 8 }];
    const fn = functionOf(t, 'Mine');
    expect(fn.track.sliders.map((s) => s.name)).toEqual(['depth']);
    expect(fn.track.graph.nodes).toHaveLength(t.graph.nodes.length);
    expect(fn.track).not.toHaveProperty('id');

    // through a file and back, it plays exactly the same notes
    const [back] = readFunctionFile(JSON.stringify(functionFile([fn])));
    const planted = trackFromTemplate(structuredClone(back.track), back.name, 0);
    const notes = (tr: Track) => renderTrack(tr, song).pitchCurve;
    expect(notes(t).length).toBeGreaterThan(0);
    expect(notes(planted)).toEqual(notes(t));
    expect(notes(planted)).not.toEqual(notes({ ...t, sliders: [{ ...t.sliders[0], value: 0 }] }));
    // files from before tracks owned their sliders still bring them
    const { sliders: _s, ...legacyTrack } = fn.track;
    const [old] = readFunctionFile(JSON.stringify(functionFile([{ ...fn, track: legacyTrack as typeof fn.track, sliders: fn.track.sliders }])));
    expect(old.track.sliders).toEqual(fn.track.sliders);
    expect(() => readFunctionFile('{"kind":"soundfunc-project"}')).toThrow(/functions file/);
    expect(() => readFunctionFile('not json')).toThrow(/JSON/);
  });
  it('importing functions numbers names that are taken', () => {
    useLibrary.setState({ functions: [] });
    const fn = functionOf(defaultProject().tracks[0], 'Pond');
    useLibrary.getState().saveFunction(fn);
    expect(useLibrary.getState().importFunctions([fn, fn])).toBe(2);
    expect(useLibrary.getState().functions.map((f) => f.name)).toEqual(['Pond', 'Pond 2', 'Pond 3']);
    useLibrary.getState().saveFunction({ ...fn, id: 'other' });
    expect(useLibrary.getState().functions.filter((f) => f.name === 'Pond')).toHaveLength(1);
  });
});

describe('importing functions', () => {
  // the first "graphed arpeggios" function, written three ways
  const reference = compile(
    'floor((12 * ((3*floor(t/2) + 2*(floor(4t) % 4) + (floor(4t) % 8 == 4) + 5) % 7) + 2) / 7) / 12 - (floor(4t) % 8 == 0) + (floor(t/2) == 2) * (floor(4t) % 4 == 1) / 12 + exp(-12 * fract(4t)) / 6',
    ['t'],
  ).fn;
  const same = (src: string) => {
    const r = importMath(src);
    const f = compileAst(r.value);
    for (let i = 0; i < 64; i++) {
      const t = i / 4 + 0.13;
      expect(f({ t }), `t=${t}`).toBeCloseTo(reference({ t }), 9);
    }
    return r;
  };

  it('reads LaTeX as Desmos copies it', () => {
    const r = same(
      'y=\\frac{\\operatorname{floor}\\left(\\frac{12\\operatorname{mod}\\left(3\\operatorname{floor}\\left(\\frac{x}{2}\\right)+2\\operatorname{mod}\\left(\\operatorname{floor}\\left(4x\\right),4\\right)+\\left\\{\\operatorname{mod}\\left(\\operatorname{floor}\\left(4x\\right),8\\right)=4:1,0\\right\\}+5,7\\right)+2}{7}\\right)}{12}-\\left\\{\\operatorname{mod}\\left(\\operatorname{floor}\\left(4x\\right),8\\right)=0:1,0\\right\\}+\\frac{\\left\\{\\operatorname{floor}\\left(\\frac{x}{2}\\right)=2:1,0\\right\\}\\left\\{\\operatorname{mod}\\left(\\operatorname{floor}\\left(4x\\right),4\\right)=1:1,0\\right\\}}{12}+\\frac{e^{-12\\operatorname{mod}\\left(4x,1\\right)}}{6}',
    );
    expect(r.gate).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it('reads LaTeX with \\lfloor and Iverson brackets', () => {
    same(
      'y = \\frac{\\left\\lfloor \\frac{12\\operatorname{mod}(3\\lfloor x/2 \\rfloor + 2(\\lfloor 4x \\rfloor \\bmod 4) + (\\lfloor 4x\\rfloor \\bmod 8 = 4) + 5, 7) + 2}{7} \\right\\rfloor}{12} - (\\lfloor 4x \\rfloor \\bmod 8 = 0) + \\frac{(\\lfloor x/2 \\rfloor = 2)(\\lfloor 4x \\rfloor \\bmod 4 = 1)}{12} + \\frac{e^{-12\\operatorname{frac}(4x)}}{6}',
    );
  });

  it('reads plain math with ⌊ ⌋ and mod(…)', () => {
    same('y = ⌊(12·mod(3⌊x/2⌋ + 2(⌊4x⌋ mod 4) + (⌊4x⌋ mod 8 = 4) + 5, 7) + 2)/7⌋/12 − (⌊4x⌋ mod 8 = 0) + (⌊x/2⌋ = 2)(⌊4x⌋ mod 4 = 1)/12 + e^(−12 frac(4x))/6');
  });

  it('keeps undefined piecewise regions as silence', () => {
    const r = importMath('\\begin{cases} 1 - 3(x-7)^2 & \\text{if } x \\ge 7 \\\\ 2 & \\text{if } \\operatorname{frac}(x) < \\frac14 \\end{cases}');
    const v = compileAst(r.value), g = compileAst(r.gate!);
    expect(v({ t: 7.5 })).toBeCloseTo(1 - 3 * 0.25);
    expect(g({ t: 7.5 })).toBe(1);
    expect(v({ t: 2.1 })).toBe(2);
    expect(g({ t: 2.1 })).toBe(1);
    expect(g({ t: 2.6 })).toBe(0); // neither case holds → undefined → silent
    // Desmos style, nested
    const d = importMath('\\left\\{\\operatorname{mod}(x,1)<0.5:\\left\\{x<2:1,3\\right\\}\\right\\}');
    expect(compileAst(d.gate!)({ t: 0.7 })).toBe(0);
    expect(compileAst(d.value)({ t: 2.2 })).toBe(3);
  });

  it('explains what it could not use', () => {
    expect(importMath('a x + 1').warnings.join(' ')).toMatch(/“a”/);
    expect(importMath('wobble(x)').warnings.join(' ')).toMatch(/Unknown function “wobble”/);
    expect(() => importMath('⌊x/2')).toThrow(/⌋/);
  });
});

describe('graph editing keeps the music', () => {
  const tracks = () => {
    const base = defaultProject().song;
    const song = { ...base, harmony: 'pick(bar, 0, 4, 5, 3)' };
    const out: { label: string; track: Track; song: Project['song'] }[] = [];
    const outs: typeof out = [];
    PRESETS.forEach((p, i) => out.push({ label: p.id, track: trackFromPreset(p, i), song }));
    for (const kit of KITS) kit.tracks.forEach((t, i) => out.push({ label: `${kit.id}/${t.name}`, track: trackFromTemplate(t, t.name, i), song: { ...base, ...kit.song } }));
    // channels driven by Curve nodes: every starter curve, into Note Out, plus one curve read through another phase
    for (const id of ['duck', 'ramp', 'swell', 'bentsaw']) {
      const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
      const b = BLOCKS.find((x) => x.id === id)!;
      const out = t.graph.nodes.find((n) => n.type === 'output')!;
      const port = id === 'ramp' ? 'pitch' : (b.toOutput?.[0]?.port ?? 'pitch');
      const g = insertBlock({ ...t.graph, edges: t.graph.edges.filter((e) => !(e.target === out.id && e.targetHandle === port)) }, { ...b, toOutput: [{ node: 'c', handle: 'out', port }] }, { x: 0, y: 400 }).graph;
      outs.push({ label: `curve/${id}`, track: { ...t, graph: g }, song });
    }
    {
      const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
      const out = t.graph.nodes.find((n) => n.type === 'output')!;
      t.graph = {
        nodes: [...t.graph.nodes, { id: 'ph', type: 'expr', position: { x: 0, y: 0 }, data: { formula: 'fract(t / 3) * 0.9 + 0.05' } }, { id: 'cv', type: 'curve', position: { x: 0, y: 0 }, data: { points: '0.1:0.2:0.8 0.4:1:-0.7 0.4:0.3:0 0.85:0.6:0.3', repeats: 2, lo: -3, hi: 9 } }],
        edges: [...t.graph.edges.filter((e) => !(e.target === out.id && e.targetHandle === 'pitch')), { id: 'e1', source: 'ph', sourceHandle: 'out', target: 'cv', targetHandle: 'p' }, { id: 'e2', source: 'cv', sourceHandle: 'out', target: out.id, targetHandle: 'pitch' }],
      };
      outs.push({ label: 'curve/wired', track: t, song });
    }
    out.push(...outs);
    return out;
  };
  const sameSound = (label: string, a: Track, b: Track, song: Project['song']) => {
    for (const k of [0, 1]) {
      const ra = renderTrack(a, song, k, false), rb = renderTrack(b, song, k, false);
      expect(rb.errors.size, `${label} errors`).toBe(0);
      ra.pitchCurve.forEach((v, n) => expect(rb.pitchCurve[n], `${label} pitch n=${n}`).toBeCloseTo(v, 9));
      ra.velocityCurve.forEach((v, n) => expect(rb.velocityCurve[n], `${label} vel n=${n}`).toBeCloseTo(v, 9));
    }
  };

  it('exploding formulas, layer after layer, changes nothing you hear', () => {
    let exploded = 0;
    for (const { label, track, song } of tracks()) {
      let graph = track.graph;
      for (let round = 0; round < 6; round++) {
        const formulas = graph.nodes.filter((n) => n.type === 'expr');
        let changed = false;
        for (const f of formulas) {
          const r = explodeFormula(graph, f.id);
          if ('error' in r) continue;
          graph = r.graph;
          changed = true;
          exploded++;
        }
        if (!changed) break;
      }
      sameSound(`${label} exploded`, track, { ...track, graph }, song);
    }
    expect(exploded).toBeGreaterThan(50);
  });

  it('conditions, comparisons, logic and any call explode into nodes', () => {
    const blank = trackFromPreset(PRESETS.find((p) => p.id === 'blank')!, 0);
    const f = blank.graph.nodes.find((n) => n.type === 'expr')!;
    const cases: [string, string][] = [
      ['n % 4 == 0 ? h + 2 : h - 1', 'switch'],
      ['n > 3 && x < 0.5', 'compare'],
      ['!(n % 3)', 'compare'],
      ['smoothstep(0, 1, fract(t * 2)) * 4', 'math'],
      ['rand(n + 16k, 3) * 7', 'math'],
      ['floor(7 * noise(n * 0.3, 2))', 'func'],
      ['pow(2, n % 4)', 'math'],
    ];
    for (const [formula, top] of cases) {
      let graph = { ...blank.graph, nodes: blank.graph.nodes.map((n) => (n.id === f.id ? { ...n, data: { formula } } : n)) };
      const original = { ...blank, graph };
      const first = explodeFormula(graph, f.id);
      if ('error' in first) throw new Error(`${formula}: ${first.error}`);
      expect(first.graph.nodes.find((n) => n.id === first.focus)?.type, formula).toBe(top);
      // keep exploding everything until nothing splits further — the sound never changes
      graph = first.graph;
      for (let round = 0; round < 12; round++) {
        let changed = false;
        for (const n of graph.nodes.filter((x) => x.type === 'expr')) {
          const r = explodeFormula(graph, n.id);
          if (!('error' in r)) (graph = r.graph), (changed = true);
        }
        if (!changed) break;
      }
      sameSound(formula, original, { ...blank, graph }, defaultProject().song);
      // …and collapsing the whole tree back gives one formula that sounds the same
      const ids = graph.nodes.filter((n) => n.type !== 'output' && n.type !== 'step').map((n) => n.id);
      if (ids.length >= 2) {
        const back = collapseNodes(graph, ids);
        if ('error' in back) throw new Error(`${formula} collapse: ${back.error}`);
        sameSound(`${formula} collapsed`, original, { ...blank, graph: back.graph }, defaultProject().song);
      }
    }
    // a call whose arguments are already plain inputs has nothing left to split
    const done = explodeFormula({ ...blank.graph, nodes: blank.graph.nodes.map((n) => (n.id === f.id ? { ...n, data: { formula: 'rand(a, 3)' } } : n)) }, f.id);
    expect('error' in done).toBe(true);
  });

  it('collapsing each branch into one formula changes nothing you hear', () => {
    for (const { label, track, song } of tracks()) {
      let graph = track.graph;
      const out = graph.nodes.find((n) => n.type === 'output')!;
      for (const e of track.graph.edges.filter((x) => x.target === out.id)) {
        // everything upstream of this Note Out input, except the clock
        const up = new Set<string>();
        const stack = [e.source];
        while (stack.length) {
          const id = stack.pop()!;
          if (up.has(id) || !graph.nodes.some((n) => n.id === id)) continue;
          up.add(id);
          for (const x of graph.edges) if (x.target === id) stack.push(x.source);
        }
        const ids = [...up].filter((id) => graph.nodes.find((n) => n.id === id)?.type !== 'step');
        if (ids.length < 2) continue;
        const r = collapseNodes(graph, ids);
        if ('error' in r) continue; // branches shared with another input
        graph = r.graph;
      }
      sameSound(`${label} collapsed`, track, { ...track, graph }, song);
    }
  });

  it('blocks insert cleanly and wire into Note Out', () => {
    const blank = trackFromPreset(PRESETS.find((p) => p.id === 'blank')!, 0);
    for (const b of BLOCKS) {
      const r = insertBlock(blank.graph, b, { x: 0, y: 300 });
      expect(r.ids.length, b.id).toBeGreaterThan(0);
      const render = renderTrack({ ...blank, graph: r.graph }, defaultProject().song);
      expect(render.errors.size, b.id).toBe(0);
      for (const w of b.toOutput ?? []) expect(r.graph.edges.some((e) => e.targetHandle === w.port && r.ids.includes(e.source)), `${b.id} → ${w.port}`).toBe(true);
    }
  });

  it('saves a selection as a block and plants it again', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'fib')!, 0);
    const ids = t.graph.nodes.filter((n) => n.type !== 'output').map((n) => n.id);
    const b = blockFromSelection(t.graph, ids, 'Fib groove');
    if ('error' in b) throw new Error(b.error);
    const blank = trackFromPreset(PRESETS.find((p) => p.id === 'blank')!, 0);
    const empty = { ...blank, graph: { nodes: blank.graph.nodes.filter((n) => n.type === 'output'), edges: [] } };
    const r = insertBlock(empty.graph, b, { x: 0, y: 0 });
    sameSound('block round-trip', t, { ...t, graph: r.graph }, defaultProject().song);
  });

  it('auditions a node as pitch, stretching small ranges', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'fib')!, 0);
    const eu = t.graph.nodes.find((n) => n.type === 'euclid')!;
    const g = auditionGraph(t.graph, eu.id, { asVelocity: false, lo: 0, hi: 1, span: 7 });
    const r = renderTrack({ ...t, graph: g }, defaultProject().song);
    expect(new Set(r.pitchCurve)).toEqual(new Set([0, 7]));
  });

  it('Sections and sliders: the written-out function and exported code still match', () => {
    const song = { ...defaultProject().song, harmony: 'pick(bar, 0, 3)' };
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'form')!, 0);
    t.sliders = [{ name: 'lift', value: 2, min: 0, max: 5 }];
    const formula = t.graph.nodes.find((n) => n.data.formula === 'h + round(3 * sin(tau * x * 2))')!;
    formula.data.formula = 'h + round(3 * sin(tau * x * 2)) + lift';
    const c = compose(t);
    const code = trackCode([c], song, 'js').replace(/^export /gm, '');
    const fn = new Function(`${code}\nreturn songForm;`)() as (n: number, k: number) => Record<string, number>;
    for (const k of [0, 1, 2, 3, 5]) {
      const r = renderTrack(t, song, k, false);
      for (let n = 0; n < t.steps; n++) expect(fn(n, k).pitch, `k=${k} n=${n}`).toBeCloseTo(r.pitchCurve[n], 9);
    }
    // the bridge (4th section, beats 24–32 → loops 6 and 7) reads the slider
    const bridge = renderTrack(t, song, 6, false).pitchCurve[0];
    const lower = renderTrack({ ...t, sliders: [{ ...t.sliders[0], value: 0 }] }, song, 6, false).pitchCurve[0];
    expect(bridge - lower).toBe(2);
  });
  it('each track has its own sliders: same name, different values, no crosstalk', () => {
    const song = defaultProject().song;
    const make = (v: number) => {
      const t = trackFromPreset(PRESETS.find((p) => p.id === 'form')!, 0);
      t.graph.nodes.find((n) => n.data.formula === 'h + round(3 * sin(tau * x * 2))')!.data.formula = 'h + round(3 * sin(tau * x * 2)) + lift';
      t.sliders = [{ name: 'lift', value: v, min: -5, max: 5 }];
      return t;
    };
    const a = make(0), b = make(3);
    expect(renderTrack(b, song, 6, false).pitchCurve[0] - renderTrack(a, song, 6, false).pitchCurve[0]).toBe(3);
    // the garden's code keeps each track's slider inside its own function
    const code = trackCode([compose({ ...a, name: 'low' }), compose({ ...b, name: 'high' })], song, 'js').replace(/^export /gm, '');
    const fns = new Function(`${code}\nreturn [low, high];`)() as ((n: number, k: number) => Record<string, number>)[];
    expect(fns[1](0, 6).pitch - fns[0](0, 6).pitch).toBe(3);
  });
  it('old gardens: song sliders move to the tracks that read them; the harmony keeps their values', () => {
    const p = defaultProject();
    const t = trackFromPreset(PRESETS.find((x) => x.id === 'form')!, 0);
    t.graph.nodes.find((n) => n.data.formula === 'h + round(3 * sin(tau * x * 2))')!.data.formula = 'h + round(3 * sin(tau * x * 2)) + lift';
    const { sliders: _a, ...plain } = t;
    const { sliders: _b, ...other } = p.tracks[0];
    const legacy = { ...p, song: { ...p.song, harmony: 'pick(bar, 0, root2)', sliders: [{ name: 'lift', value: 2, min: 0, max: 5 }, { name: 'root2', value: -3, min: -5, max: 5 }] }, tracks: [plain, other] } as unknown as Project;
    const n = normalizeProject(legacy);
    expect(n.tracks[0].sliders.map((s) => s.name)).toEqual(['lift']);
    expect(n.tracks[1].sliders).toEqual([]);
    expect(n.song).not.toHaveProperty('sliders');
    expect(n.song.harmony).toBe('pick(bar, 0, (-3))');
  });
});

describe('the Kick, Zap & Hook preset', () => {
  it('is exactly what the LaTeX importer reads from the original', () => {
    const latex =
      'y = \\begin{cases} -2 + 3e^{-20\\operatorname{frac}(x)} & \\text{if } \\operatorname{frac}(x) < \\frac{1}{4} \\\\ \\frac{3}{5} + \\frac{\\operatorname{round}\\left(\\frac{12(\\lfloor 4x \\rfloor \\bmod 7)}{7}\\right)}{12} - \\frac{8}{5}\\operatorname{frac}(4x) & \\text{if } \\lfloor 4x \\rfloor \\bmod 3 = 0 \\\\ -1 + \\frac{e^{-12\\operatorname{frac}(4x)}}{6} & \\text{if } \\operatorname{frac}(4x) < 0.8 \\end{cases}';
    const imported = importMath(latex);
    const preset = trackFromPreset(PRESETS.find((p) => p.id === 'zap')!, 0);
    const y = compile(String(preset.graph.nodes.find((n) => n.id === 'y')!.data.formula), ['t']).fn;
    const gate = compile(String(preset.graph.nodes.find((n) => n.id === 'gate')!.data.formula), ['t']).fn;
    const iv = compileAst(imported.value), ig = compileAst(imported.gate!);
    for (let i = 0; i < 84 * 8; i++) {
      const t = i / 32 + 0.003;
      expect(Boolean(gate({ t })), `gate t=${t}`).toBe(Boolean(ig({ t })));
      if (ig({ t })) expect(y({ t }), `y t=${t}`).toBeCloseTo(iv({ t }), 9);
    }
  });
});

describe('importing structured functions (definitions, IF / ELSE IF / OTHERWISE)', () => {
  const program = `frac(x) = x − ⌊x⌋

y(x) =
IF x < 4 AND frac(4x) < 0.8 AND ⌊42184 / 2^(⌊4x⌋ mod 16)⌋ mod 2 = 1:
  y = ⌊12·frac(x/3)⌋/12 + e^(−12·frac(4x))/6
OTHERWISE:
  y = −2 + ⌊(12(3⌊x/2⌋ + 5 mod 7) + 2)/7⌋/12 + g(x)

g(x) =
IF x ≥ 4:
  IF frac(x) < 1/2:
    3e^(−30·frac(x))
  OTHERWISE:
    e^(12·frac(x) − 12)
OTHERWISE:
  IF frac(x) < 1/4:
    2.5e^(−22·frac(x))
  ELSE IF frac(4x) < 0.72:
    (⌊4x⌋ mod 2) + 0.22e^(−14·frac(4x))`;

  const fr = (v: number) => v - Math.floor(v);
  const mod = (a: number, b: number) => ((a % b) + b) % b;
  const g = (x: number): number | null =>
    x >= 4 ? (fr(x) < 0.5 ? 3 * Math.exp(-30 * fr(x)) : Math.exp(12 * fr(x) - 12)) : fr(x) < 0.25 ? 2.5 * Math.exp(-22 * fr(x)) : fr(4 * x) < 0.72 ? mod(Math.floor(4 * x), 2) + 0.22 * Math.exp(-14 * fr(4 * x)) : null;
  const y = (x: number): number | null => {
    if (x < 4 && fr(4 * x) < 0.8 && mod(Math.floor(42184 / 2 ** mod(Math.floor(4 * x), 16)), 2) === 1) return Math.floor(12 * fr(x / 3)) / 12 + Math.exp(-12 * fr(4 * x)) / 6;
    const gv = g(x);
    return gv === null ? null : -2 + Math.floor((12 * mod(3 * Math.floor(x / 2) + 5, 7) + 2) / 7) / 12 + gv;
  };

  it('reads definitions, nested blocks, helper functions and AND', () => {
    const r = importMath(program);
    const v = compileAst(r.value), gt = compileAst(r.gate!);
    let silent = 0;
    for (let i = 0; i < 1600; i++) {
      const x = -8 + i * 0.01 + 0.0007;
      const want = y(x);
      expect(Boolean(gt({ t: x })), `defined at x=${x}`).toBe(want !== null);
      if (want === null) silent++;
      else expect(v({ t: x }), `y(${x})`).toBeCloseTo(want, 9);
    }
    expect(silent).toBeGreaterThan(0); // g has no final OTHERWISE → gaps
  });

  it('reads "a + b mod n" both ways', () => {
    const sum = compileAst(importMath('3 + 5 mod 7').value)({});
    const term = compileAst(importMath('3 + 5 mod 7', { modReading: 'term' }).value)({});
    expect(sum).toBe(1); // (3 + 5) mod 7
    expect(term).toBe(8); // 3 + (5 mod 7)
  });

  it('accepts lower-case keywords, inline IF values and ELSE', () => {
    const r = importMath('y =\nif x < 1: 2\nelse if x < 2 or x > 5: 3\nelse:\n  4');
    const v = compileAst(r.value);
    expect([0.5, 1.5, 6, 3].map((t) => v({ t }))).toEqual([2, 3, 3, 4]);
  });

  it('reports a function defined in terms of itself', () => {
    expect(() => importMath('y(x) = g(x)\ng(x) = 1 + g(x)')).toThrow(/itself/);
  });
});

describe('the song length rules every track', () => {
  const fit = (L: number, stepBeats: number) => applyGrid({ steps: 16, stepBeats: 0.25 }, { stepBeats }, L);
  it('divides the song length into whole steps', () => {
    expect(fit(8, 0.25)).toMatchObject({ steps: 32, stepBeats: 0.25 });
    expect(fit(4, 1 / 3)).toMatchObject({ steps: 12 });
    expect(fit(16, 0.2)).toMatchObject({ steps: 80 });
  });
  it('nudges an irrational step so the track still lands on the beat', () => {
    const g = fit(4, (Math.sqrt(5) - 1) / 4); // φ⁻¹/2 ≈ 0.309 beat
    expect(g.steps).toBe(13);
    expect(g.steps * g.stepBeats).toBeCloseTo(4, 12);
  });
  it('a typed step count divides the length evenly', () => {
    expect(applyGrid({ steps: 16, stepBeats: 0.25 }, { steps: 12 }, 4).stepBeats).toBeCloseTo(1 / 3, 12);
  });
  it('a free song leaves steps × step length as they are', () => {
    expect(applyGrid({ steps: 21, stepBeats: 0.375 }, { stepBeats: (Math.sqrt(5) - 1) / 2 }, null).steps).toBe(21);
  });
  it('fits 64 beats of 1/64 notes, and caps at 1024 steps', () => {
    expect(fit(64, 1 / 16)).toMatchObject({ steps: 1024, stepBeats: 1 / 16 });
    expect(fit(64, 1 / 32).steps).toBe(1024);
  });
});

describe('negative octaves', () => {
  it('play lower, stay inside MIDI, and still export', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
    // raw octave behaviour, with the pitch range switched off
    const song = { ...defaultProject().song, pitchRange: { mode: 'off' as const, low: 24, high: 96 } };
    const at = (octave: number) => renderTrack({ ...t, octave }, song).notes.map((n) => n.midi);
    const four = at(4), minusOne = at(-1), minusFour = at(-4);
    four.forEach((m, i) => expect(minusOne[i]).toBe(Math.max(0, m - 60)));
    expect(Math.min(...minusFour)).toBe(0); // below MIDI note 0 they sit on it
    expect(minusFour.every((m) => m >= 0 && m <= 127)).toBe(true);
    const bytes = exportMidi({ ...defaultProject(), tracks: [{ ...t, octave: -2 }] });
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
  });
});

describe('pitch range', () => {
  const extreme = () => {
    const blank = trackFromPreset(PRESETS.find((p) => p.id === 'blank')!, 0);
    const f = blank.graph.nodes.find((n) => n.type === 'expr')!;
    // wildly out-of-range values, like a formula gone astray
    f.data.formula = 'pick(n, -8373, 0, 4000, 2, -50, 61)';
    return blank;
  };
  const base = defaultProject().song;

  it('is on by default — wrap into C1–C7 — and fills in for older projects', () => {
    expect(base.pitchRange).toEqual({ mode: 'wrap', low: 24, high: 96 });
    const { pitchRange, ...old } = base;
    expect(normalizeProject({ ...defaultProject(), song: old as Project['song'] }).song.pitchRange.mode).toBe('wrap');
  });

  it('wrap keeps every note in range and keeps its note name', () => {
    const t = extreme();
    const off = renderTrack(t, { ...base, root: 0, scale: 'major', pitchRange: { mode: 'off', low: 24, high: 96 } }).notes;
    const wrapped = renderTrack(t, { ...base, root: 0, scale: 'major' }).notes;
    for (const n of wrapped) {
      expect(n.midi).toBeGreaterThanOrEqual(24);
      expect(n.midi).toBeLessThanOrEqual(96);
    }
    // the note name (pitch class) of an in-range note never changes
    expect(wrapped[1].midi).toBe(off[1].midi);
    // the unclamped value of −8373 degrees is some real note; wrapping keeps it
    const raw = valueToMidi(-8373, 'degree', 0, 'major', 4, false);
    expect(wrapped[0].midi % 12).toBe(((raw % 12) + 12) % 12);
    // without a range, the extremes all pile up on the edges of MIDI
    expect(off.filter((n) => n.midi === 0 || n.midi === 127).length).toBeGreaterThanOrEqual(2);
  });

  it('clamp pins notes to the edges; glide curves follow the range too', () => {
    const t = extreme();
    const clamped = renderTrack(t, { ...base, pitchRange: { mode: 'clamp', low: 48, high: 72 } }).notes.map((n) => n.midi);
    expect(Math.min(...clamped)).toBe(48);
    expect(Math.max(...clamped)).toBe(72);
    const glide = renderTrack({ ...t, playMode: 'glide', quantize: false }, base).curve.midi;
    expect(glide.every((m) => m >= 24 && m <= 96)).toBe(true);
  });

  it('limitPitch handles the edges and narrow ranges', () => {
    expect(limitPitch(-8000, { mode: 'wrap', low: 24, high: 96 })).toBeGreaterThanOrEqual(24);
    expect(limitPitch(130.5, { mode: 'wrap', low: 24, high: 96 })).toBeCloseTo(94.5);
    expect(limitPitch(30, { mode: 'wrap', low: 60, high: 64 })).toBe(60); // narrower than an octave: clamps
    expect(limitPitch(200, { mode: 'off', low: 0, high: 0 })).toBe(127);
  });
});

describe('song length', () => {
  it('sets the song loop — a progression that never repeats can’t stretch it', () => {
    const p = defaultProject();
    expect(p.song).toMatchObject({ lengthMode: 'fixed', lengthBeats: 8 });
    expect(songBeats(p.tracks, p.song)).toBe(8);
    expect(songBeats(p.tracks, { ...p.song, harmony: 'floor(7 * fract(bar * phi))' })).toBe(8);
  });
  it('a free song is as long as its longest track', () => {
    const p = defaultProject();
    const long = { ...p.tracks[0], steps: 64, stepBeats: 0.5 }; // 32 beats
    expect(songBeats([long, p.tracks[1]], { ...p.song, lengthMode: 'free' })).toBe(32);
    expect(songBeats([long, p.tracks[1]], p.song)).toBe(8); // fixed: the song's length rules
  });
  it('older projects open fixed only when their tracks already agree', () => {
    const p = defaultProject();
    const { lengthMode, lengthBeats, ...old } = p.song;
    expect(normalizeProject({ ...p, song: old as Project['song'] }).song).toMatchObject({ lengthMode: 'fixed', lengthBeats: 8 });
    const mixed = { ...p, song: old as Project['song'], tracks: [p.tracks[0], { ...p.tracks[1], steps: 12 }] };
    expect(normalizeProject(mixed).song.lengthMode).toBe('free');
    // and tracks no longer carry a loop of their own
    const withLoop = { ...p, tracks: [{ ...p.tracks[0], lengthMode: 'fixed', lengthBeats: 32 } as unknown as Track] };
    expect('lengthMode' in normalizeProject(withLoop).tracks[0]).toBe(false);
  });
});

describe('node help', () => {
  it('every port and setting of every node explains itself', () => {
    const missing: string[] = [];
    for (const def of Object.values(NODE_DEFS)) {
      for (const p of [...def.inputs, ...def.outputs]) if (!docFor(def.type, p.id)) missing.push(`${def.type}.${p.id}`);
      for (const p of def.params) if (!docFor(def.type, p.key)) missing.push(`${def.type}.${p.key}`);
    }
    expect(missing).toEqual([]);
  });
});

describe('importing: Greek letters, subscripts, parameters, any time variable', () => {
  const run = (src: string, scope: Record<string, number> = {}) => {
    const r = importMath(src);
    return { r, at: (t: number) => compileAst(r.value)({ ...Object.fromEntries(r.params.map((p) => [p.name, p.value])), ...scope, t }) };
  };
  it('t_i = x − σ u_i, σ > 0: Greek and subscripted names become sliders; the condition is noted', () => {
    const { r, at } = run('t_i = x - \\sigma u_i, \\quad \\sigma > 0');
    expect(r.timeVar).toBe('x');
    expect(r.params.map((p) => p.name).sort()).toEqual(['sigma', 'u_i']);
    expect(at(3)).toBe(2); // 3 − 1·1
    expect(r.warnings.join(' ')).toMatch(/condition/);
  });
  it('p = p_0 e^{−h/H}: any name can be the function; h is the one that moves', () => {
    const { r, at } = run('p = p_0 e^{-h/H}');
    expect(r.timeVar).toBe('h');
    expect(r.params.map((p) => p.name).sort()).toEqual(['H', 'p_0']);
    expect(at(1)).toBeCloseTo(Math.exp(-1), 12);
  });
  it('k = 2.5 on its own line becomes a slider starting at 2.5, renamed away from the loop count', () => {
    const { r, at } = run('k=2.5\ng(x)=\\tanh(k\\sin(2\\pi x))');
    expect(r.params).toEqual([{ name: 'k_', value: 2.5 }]);
    expect(at(0.25)).toBeCloseTo(Math.tanh(2.5), 12);
  });
  it('a constant written as an expression is written into the function', () => {
    const { r, at } = run('a = 3\nc = 2a\ny = c x');
    expect(r.params.map((p) => p.name)).toEqual(['a_']);
    expect(at(1)).toBe(6);
  });
  it('the time variable can be Greek, and can be chosen', () => {
    expect(run('r(\\theta) = 1 + \\cos(3\\theta)').r.timeVar).toBe('theta');
    const chosen = importMath('p = p_0 e^{-h/H}', { timeVar: 'H' });
    expect(chosen.params.map((p) => p.name).sort()).toEqual(['h_', 'p_0']);
    expect(chosen.names).toContain('h');
  });
  it('unicode Greek and \\operatorname{sgn} read too', () => {
    const { r, at } = run('y = α sgn(sin(2πx))');
    expect(r.params.map((p) => p.name)).toEqual(['alpha']);
    expect(at(0.25)).toBe(1);
    expect(at(0.75)).toBe(-1);
  });
});

describe('each pass: evolve or repeat exactly', () => {
  const evolving = () => {
    const p = defaultProject();
    const t = trackFromPreset(PRESETS.find((x) => x.id === 'evolve')!, 0);
    return { ...p, song: { ...p.song, lengthBeats: 4, exportLoops: 3 }, tracks: [t] } as Project;
  };
  const passes = (p: Project) => {
    const notes = collectNotes(p)[0].notes;
    return [0, 1, 2].map((i) => notes.filter((n) => n.beat >= i * 4 && n.beat < (i + 1) * 4).map((n) => [n.beat - i * 4, n.midi]));
  };
  it('song windows split play time into passes only when repeating exactly', () => {
    const song = defaultProject().song;
    expect(songWindows(song, 8, 6, 10)).toEqual([{ base: 0, from: 6, to: 10 }]);
    expect(songWindows({ ...song, repeat: 'exact' }, 8, 6, 10)).toEqual([{ base: 0, from: 6, to: 8 }, { base: 8, from: 0, to: 2 }]);
  });
  it('evolve: k runs on, so passes differ; exact: every pass is the first', () => {
    const p = evolving();
    const ev = passes(p);
    expect(ev[1]).not.toEqual(ev[0]);
    const ex = passes({ ...p, song: { ...p.song, repeat: 'exact' } });
    expect(ex[0]).toEqual(ev[0]);
    expect(ex[1]).toEqual(ex[0]);
    expect(ex[2]).toEqual(ex[0]);
  });
  it('exact, free length: shorter tracks start again with the song', () => {
    const p = evolving();
    const long = { ...p.tracks[0], id: 'long', steps: 20 }; // 5 beats
    const short = { ...p.tracks[0], id: 'short', steps: 12 }; // 3 beats
    const song = { ...p.song, lengthMode: 'free' as const, repeat: 'exact' as const, exportLoops: 2 };
    const [, s] = collectNotes({ ...p, song, tracks: [long, short] });
    const first = s.notes.filter((n) => n.beat < 5).map((n) => [n.beat, n.midi]);
    const second = s.notes.filter((n) => n.beat >= 5).map((n) => [n.beat - 5, n.midi]);
    expect(second).toEqual(first);
    expect(first.every(([b]) => b < 5)).toBe(true);
  });
});

describe('duplicate, copy & paste, and one-node mutation', () => {
  const fresh = () => {
    useStore.setState({ project: defaultProject(), clipboard: null, past: [], future: [] });
    const [a, b] = useStore.getState().project.tracks;
    useStore.getState().selectTrack(a.id);
    return { a, b };
  };
  const track = (id: string) => useStore.getState().project.tracks.find((t) => t.id === id)!;

  it('duplicates a track right after itself, with a copy name', () => {
    const { a } = fresh();
    useStore.getState().duplicateTrack(a.id);
    useStore.getState().duplicateTrack(a.id);
    const names = useStore.getState().project.tracks.map((t) => t.name);
    expect(names.slice(0, 3)).toEqual([a.name, `${a.name} copy 2`, `${a.name} copy`]);
    const copy = useStore.getState().project.tracks[2];
    expect(copy.id).not.toBe(a.id);
    expect(copy.graph).toEqual(a.graph);
  });
  it('copies nodes into another track: fresh ids, inner wires, its clock, its sliders, free Note Out ports only', () => {
    const { a, b } = fresh();
    useStore.getState().updateNodeData(a.id, a.graph.nodes.find((n) => n.type !== 'output' && n.type !== 'step')!.id, {});
    // a formula that reads a slider of track a
    useStore.getState().addSlider(a.id, 0.5, 'depth');
    useStore.getState().setGraph(a.id, [...track(a.id).graph.nodes, { id: 'f1', type: 'expr', position: { x: 0, y: 500 }, data: { formula: 'x * depth' } }], track(a.id).graph.edges);
    const ids = track(a.id).graph.nodes.filter((n) => n.type !== 'output').map((n) => n.id);
    expect(useStore.getState().copyNodes(a.id, ids)).toBe(ids.length);
    const before = track(b.id);
    const r = useStore.getState().pasteNodes(b.id);
    expect(typeof r).toBe('number');
    const after = track(b.id);
    const added = after.graph.nodes.filter((n) => !before.graph.nodes.some((x) => x.id === n.id));
    expect(added.length).toBe(r);
    expect(added.some((n) => n.type === 'step')).toBe(before.graph.nodes.every((n) => n.type !== 'step'));
    expect(added.every((n) => !ids.includes(n.id))).toBe(true);
    expect(after.sliders.map((s) => s.name)).toContain('depth');
    // b's Note Out keeps its own wiring
    const out = after.graph.nodes.find((n) => n.type === 'output')!;
    for (const e of before.graph.edges.filter((e) => e.target === out.id)) expect(after.graph.edges).toContainEqual(expect.objectContaining({ source: e.source, targetHandle: e.targetHandle }));
    expect(renderTrack(after, useStore.getState().project.song).errors.size).toBe(0);
  });
  it('the node dice changes only that node', () => {
    const t = trackFromPreset(PRESETS.find((x) => x.id === 'evolve')!, 0);
    const target = t.graph.nodes.find((n) => n.type === 'expr')!;
    const r = mutateOneNode(t, defaultProject().song, target.id, 0.5, 1234);
    expect(r.track).not.toBe(t);
    for (const n of r.track.graph.nodes) {
      const was = t.graph.nodes.find((x) => x.id === n.id)!;
      if (n.id === target.id) expect(n.data).not.toEqual(was.data);
      else expect(n.data).toEqual(was.data);
    }
    expect(r.track.graph.edges).toEqual(t.graph.edges);
  });
  it('every scale is well-formed, and None is every semitone', () => {
    for (const [k, sc] of Object.entries(SCALES)) {
      expect(sc.steps[0], k).toBe(0);
      expect([...sc.steps].sort((x, y) => x - y), k).toEqual(sc.steps);
      expect(new Set(sc.steps).size, k).toBe(sc.steps.length);
      expect(Math.max(...sc.steps), k).toBeLessThan(12);
    }
    expect(SCALES.chromatic.label).toBe('None');
    expect(degreeToMidi(13, 0, SCALES.chromatic.steps, 4)).toBe(60 + 13);
  });
});

describe('stretch: a channel played out over more or less time', () => {
  const base = () => trackFromPreset(PRESETS.find((x) => x.id === 'fib')!, 0);
  const song = { ...defaultProject().song, harmony: 'pick(bar, 0, 3, 4, 5)' };
  it('same notes, same order — every time and length scaled; one pass lasts stretch × as long', () => {
    const t = base();
    const one = renderTrack(t, song, 0, false);
    for (const s of [2, 0.5, 1.5]) {
      const st = { ...t, stretch: s };
      const r = renderTrack(st, song, 0, false);
      expect(patternBeats(st)).toBeCloseTo(patternBeats(t) * s, 9);
      expect(r.pitchCurve).toEqual(one.pitchCurve);
      expect(r.notes.length).toBe(one.notes.length);
      r.notes.forEach((n, i) => {
        expect(n.beat).toBeCloseTo(one.notes[i].beat * s, 9);
        expect(n.duration).toBeCloseTo(one.notes[i].duration * s, 9);
      });
      r.curve.beat.forEach((b, i) => expect(b).toBeCloseTo(one.curve.beat[i] * s, 9));
    }
  });
  it('the harmony follows real time, so a stretched channel still meets the song’s chords', () => {
    const t = { ...base(), stretch: 2 };
    const r = renderTrack(t, song, 0, false);
    for (const n of r.notes) expect(n.h).toBe(harmonyAt(song, n.beat - (n.beat % (t.stepBeats * 2))));
  });
  it('free songs last as long as the longest stretched channel; bad values fall back to ×1', () => {
    const t = base();
    expect(songBeats([t, { ...t, stretch: 3 }], { ...song, lengthMode: 'free' })).toBeCloseTo(patternBeats(t) * 3, 9);
    expect(stretchOf({ ...t, stretch: 0 })).toBe(1);
    expect(stretchOf({ ...t, stretch: NaN })).toBe(1);
    expect(stretchOf({ ...t, stretch: 100 })).toBe(16);
  });
  it('the written-out code still matches the engine when stretched', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'form')!, 0);
    t.stretch = 1.5;
    const code = trackCode([compose(t)], song, 'js').replace(/^export /gm, '');
    const fn = new Function(`${code}\nreturn songForm;`)() as (n: number, k: number) => Record<string, number>;
    for (const k of [0, 1, 3]) {
      const r = renderTrack(t, song, k, false);
      for (let n = 0; n < t.steps; n++) expect(fn(n, k).pitch, `k=${k} n=${n}`).toBeCloseTo(r.pitchCurve[n], 9);
    }
  });
});

describe('channel colours', () => {
  it('a new channel gets a colour no other channel has, until the palette is used up', () => {
    const taken: string[] = [];
    for (let i = 0; i < CHANNEL_PALETTE.length; i++) taken.push(pickColor(taken));
    expect(new Set(taken).size).toBe(CHANNEL_PALETTE.length);
    expect(CHANNEL_PALETTE).toContain(pickColor(taken)); // all used: any palette colour
  });
  it('new channels in the store come out in different colours', () => {
    useStore.setState({ project: defaultProject(), past: [], future: [] });
    for (let i = 0; i < 5; i++) useStore.getState().addTrack('blank');
    useStore.getState().duplicateTrack(useStore.getState().project.tracks[0].id);
    const colors = useStore.getState().project.tracks.map((t) => t.color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('Curve node', () => {
  const run = (data: Record<string, string | number>, x: number) =>
    compileGraph({ nodes: [{ id: 'c', type: 'curve', position: { x: 0, y: 0 }, data }, { id: 'o', type: 'output', position: { x: 0, y: 0 }, data: {} }], edges: [{ id: 'e', source: 'c', sourceHandle: 'out', target: 'o', targetHandle: 'pitch' }] }).run({ n: 0, x, t: 0, k: 0, steps: 16, h: 0, bar: 0, L: 7, beat: 0, np: 0, vars: {} })!.pitch;
  it('straight lines between corners, flat outside them, scaled between bottom and top', () => {
    const pts = parseCurve('0.25:0:0 0.75:1:0');
    expect(evalCurve(pts, 0)).toBe(0);
    expect(evalCurve(pts, 0.5)).toBeCloseTo(0.5, 12);
    expect(evalCurve(pts, 0.9)).toBe(1);
    expect(run({ points: '0:0:0 1:1:0', lo: 2, hi: 10, repeats: 1 }, 0.25)).toBeCloseTo(4, 12);
  });
  it('a bend keeps the corners and only changes the middle: + starts slow, − starts fast', () => {
    const at = (b: number, u: number) => evalCurve(parseCurve(`0:0:${b} 1:1:0`), u);
    for (const b of [-1, -0.4, 0, 0.4, 1]) {
      expect(at(b, 0)).toBeCloseTo(0, 12);
      expect(at(b, 0.999999)).toBeCloseTo(1, 4);
    }
    expect(at(0.5, 0.5)).toBeLessThan(0.5);
    expect(at(-0.5, 0.5)).toBeGreaterThan(0.5);
    expect(at(0.5, 0.5) + at(-0.5, 0.5)).toBeCloseTo(1, 12); // opposite bends mirror each other
  });
  it('repeats play the shape again', () => {
    const d = { points: '0:0:0.5 1:1:0', repeats: 4, lo: 0, hi: 1 };
    for (const x of [0.1, 0.33, 0.6]) expect(run(d, x)).toBeCloseTo(run(d, x + 0.25 > 1 ? x - 0.25 : x + 0.25), 12);
  });
  it('“Write as a formula” sounds exactly the same', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
    const out = t.graph.nodes.find((n) => n.type === 'output')!;
    t.graph = {
      nodes: [...t.graph.nodes, { id: 'cv', type: 'curve', position: { x: 0, y: 0 }, data: { points: '0:0.2:0.7 0.5:1:-0.5 1:0:0', repeats: 2, lo: -2, hi: 6 } }],
      edges: [...t.graph.edges.filter((e) => !(e.target === out.id && e.targetHandle === 'pitch')), { id: 'e', source: 'cv', sourceHandle: 'out', target: out.id, targetHandle: 'pitch' }],
    };
    const r = curveToFormula(t.graph, 'cv');
    if ('error' in r) throw new Error(r.error);
    expect(r.graph.nodes.find((n) => n.id === 'cv')!.type).toBe('expr');
    const song = defaultProject().song;
    expect(renderTrack({ ...t, graph: r.graph }, song, 0, false).pitchCurve).toEqual(renderTrack(t, song, 0, false).pitchCurve.map((v) => expect.closeTo(v, 9)));
  });
  it('the dice keeps the corners in place and the values in range', () => {
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'pond')!, 0);
    const b = BLOCKS.find((x) => x.id === 'duck')!;
    t.graph = insertBlock(t.graph, b, { x: 0, y: 400 }).graph;
    const id = t.graph.nodes.find((n) => n.type === 'curve')!.id;
    const before = parseCurve(String(t.graph.nodes.find((n) => n.id === id)!.data.points));
    const r = mutateOneNode(t, defaultProject().song, id, 0.3, 99);
    const after = parseCurve(String(r.track.graph.nodes.find((n) => n.id === id)!.data.points));
    expect(after.map((q) => q.x)).toEqual(before.map((q) => q.x));
    for (const q of after) {
      expect(q.y).toBeGreaterThanOrEqual(0);
      expect(q.y).toBeLessThanOrEqual(1);
      expect(Math.abs(q.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('exporting curves: simplified', () => {
  const redraw = (xs: number[], ys: number[], keep: number[]) =>
    xs.map((x) => {
      let j = 0;
      while (j < keep.length - 2 && xs[keep[j + 1]] <= x) j++;
      const a = keep[j], b = keep[j + 1];
      return xs[b] === xs[a] ? ys[a] : ys[a] + ((ys[b] - ys[a]) * (x - xs[a])) / (xs[b] - xs[a]);
    });
  it('a triangle needs only its three corners', () => {
    const xs = Array.from({ length: 129 }, (_, i) => i);
    const ys = xs.map((x) => (x <= 64 ? x / 64 : (128 - x) / 64));
    expect(simplifyCurve(xs, ys, 0.001)).toEqual([0, 64, 128]);
  });
  it('a bent curve keeps enough points to stay within the tolerance — everywhere', () => {
    const xs = Array.from({ length: 400 }, (_, i) => i);
    const ys = xs.map((x) => 12 * ((Math.exp(3 * (x % 100) / 100) - 1) / (Math.exp(3) - 1)) + 2 * Math.sin(x / 13));
    const keep = simplifyCurve(xs, ys, 0.03);
    expect(keep.length).toBeLessThan(xs.length / 3);
    const back = redraw(xs, ys, keep);
    xs.forEach((_, i) => expect(Math.abs(back[i] - ys[i])).toBeLessThanOrEqual(0.03 + 1e-9));
  });
  it('the MIDI file shrinks; "every sample" keeps all of it', () => {
    const p = defaultProject();
    const riser = trackFromPreset(PRESETS.find((x) => x.id === 'riser')!, 0);
    const project = { ...p, tracks: [riser] };
    const simple = { raw: 0, kept: 0 }, full = { raw: 0, kept: 0 };
    const a = exportMidi(project, simple);
    const b = exportMidi({ ...project, song: { ...project.song, exportCurves: 'full' } }, full);
    expect(simple.kept).toBeLessThan(simple.raw / 5);
    expect(a.length).toBeLessThan(b.length / 3);
    expect(CURVE_TOLERANCE.semis).toBeLessThanOrEqual(0.05);
  });
});

describe('curves on pitch & MPE', () => {
  /** read a .mid back: every track's channel events, in order */
  const readMidi = (bytes: Uint8Array) => {
    const tracks: { tick: number; status: number; data: number[] }[][] = [];
    let i = 14;
    while (i < bytes.length) {
      const len = (bytes[i + 4] << 24) | (bytes[i + 5] << 16) | (bytes[i + 6] << 8) | bytes[i + 7];
      let j = i + 8;
      const end = j + len;
      let tick = 0;
      const evs: { tick: number; status: number; data: number[] }[] = [];
      while (j < end) {
        let d = 0;
        for (;;) {
          const b = bytes[j++];
          d = (d << 7) | (b & 0x7f);
          if (!(b & 0x80)) break;
        }
        tick += d;
        const st = bytes[j++];
        if (st === 0xff) {
          j++;
          let l = 0;
          for (;;) {
            const b = bytes[j++];
            l = (l << 7) | (b & 0x7f);
            if (!(b & 0x80)) break;
          }
          j += l;
          continue;
        }
        const n = (st & 0xf0) === 0xc0 || (st & 0xf0) === 0xd0 ? 1 : 2;
        evs.push({ tick, status: st, data: [...bytes.slice(j, j + n)] });
        j += n;
      }
      tracks.push(evs);
      i = end;
    }
    return tracks;
  };
  const project = (presetId: string, midi: 'standard' | 'mpe') => {
    const p = defaultProject();
    return { ...p, song: { ...p.song, exportMidi: midi, exportLoops: 1 }, tracks: [trackFromPreset(PRESETS.find((x) => x.id === presetId)!, 0)] };
  };

  it('a bend Curve on np scoops into every note, however long', () => {
    const t = trackFromPreset(PRESETS.find((x) => x.id === 'scooplead')!, 0);
    const r = renderTrack(t, defaultProject().song, 0, false);
    expect(r.notes.length).toBeGreaterThan(4);
    for (const n of r.notes) {
      expect(n.expr!.bend[0]).toBeCloseTo(-2, 9); // starts low…
      expect(n.expr!.bend.at(-1)!).toBeCloseTo(0, 6); // …and lands on the note
      expect(n.expr!.at.at(-1)!).toBeCloseTo(n.duration, 6);
    }
  });
  it('channels without bend / pressure / slide wired carry no expression (and cost nothing)', () => {
    const r = renderTrack(trackFromPreset(PRESETS.find((x) => x.id === 'pond')!, 0), defaultProject().song, 0, false);
    expect(r.notes.every((n) => n.expr === undefined)).toBe(true);
  });
  it('MPE: a zone of 15 members, chord notes on their own channels, each with its own bend and pressure', () => {
    const [, tr] = readMidi(exportMidi(project('bloomchords', 'mpe')));
    const cc = (ch: number, c: number) => tr.filter((e) => e.status === (0xb0 | ch) && e.data[0] === c).map((e) => e.data[1]);
    expect(cc(0, 100)).toContain(6); // MPE Configuration Message on the master channel…
    expect(cc(0, 6)).toContain(15); // …15 member channels
    expect(cc(1, 6)).toContain(48); // members bend ±48
    const ons = tr.filter((e) => (e.status & 0xf0) === 0x90 && e.data[1] > 0);
    const firstChord = ons.filter((e) => e.tick === ons[0].tick);
    expect(firstChord.length).toBe(3);
    const chans = new Set(firstChord.map((e) => e.status & 0x0f));
    expect(chans.size).toBe(3);
    expect([...chans].every((c) => c >= 1 && c <= 15)).toBe(true);
    for (const c of chans) {
      expect(tr.some((e) => e.status === (0xe0 | c))).toBe(true); // its own pitch bend
      expect(tr.some((e) => e.status === (0xd0 | c))).toBe(true); // its own pressure
    }
  });
  it('standard MIDI: one channel, the bends on it, and centred again after each note', () => {
    const [, tr] = readMidi(exportMidi(project('slide808', 'standard')));
    const ch = tr.find((e) => (e.status & 0xf0) === 0x90)!.status & 0x0f;
    const bends = tr.filter((e) => e.status === (0xe0 | ch));
    expect(bends.length).toBeGreaterThan(4);
    expect(bends.at(-1)!.data).toEqual([0, 64]); // back to centre
    const lowest = Math.min(...bends.map((e) => e.data[0] | (e.data[1] << 7)));
    expect(lowest).toBeLessThan(8192 - 8192 * (6 / 24)); // the dive reaches about a fifth down
  });
  it('MIDI, notes only: no bends, pressure or controllers — glides become the notes they pass through', () => {
    for (const id of ['riser', 'scooplead', 'bloomchords']) {
      const [, tr] = readMidi(exportMidi(project(id, 'standard'), { raw: 0, kept: 0 }, 'notes'));
      const kinds = new Set(tr.map((e) => e.status & 0xf0));
      expect([...kinds].sort(), id).toEqual([0x80, 0x90, 0xc0]);
    }
    const whole = project('riser', 'standard');
    const [, riser] = readMidi(exportMidi({ ...whole, song: { ...whole.song, lengthMode: 'free' } }, { raw: 0, kept: 0 }, 'notes'));
    const pitches = riser.filter((e) => (e.status & 0xf0) === 0x90).map((e) => e.data[0]);
    expect(pitches.length).toBeGreaterThan(8); // a two-octave climb, step by step
    expect(pitches.every((m, i) => i === 0 || m >= pitches[i - 1])).toBe(true); // …always upward
  });
  it('pitch bends are written for the chosen range: decoded with it, they give back the pitch you hear', () => {
    for (const range of [2, 12, 24, 48]) {
      const base = project('riser', 'standard');
      const p = { ...base, song: { ...base.song, lengthMode: 'free' as const, bendRange: range } };
      const glide = collectNotes(p)[0].glide;
      const [, tr] = readMidi(exportMidi(p, { raw: 0, kept: 0 }, 'standard'));
      expect(tr.filter((e) => (e.status & 0xf0) === 0xb0 && e.data[0] === 6).map((e) => e.data[1])).toContain(range); // announced
      // the note a bend belongs to: the last one started at or before it (a retrigger's bend comes just before its note-on, at the same tick)
      const ons = tr.filter((e) => (e.status & 0xf0) === 0x90 && e.data[1] > 0);
      let checked = 0;
      for (const e of tr) {
        const on = ons.filter((o) => o.tick <= e.tick).at(-1);
        const note = on ? on.data[0] : -1;
        if ((e.status & 0xf0) !== 0xe0 || note < 0) continue;
        const semis = (((e.data[1] << 7) | e.data[0]) - 8192) / 8192 * range;
        const beat = e.tick / 480;
        const at = glide.reduce((a, g) => (Math.abs(g.beat - beat) < Math.abs(a.beat - beat) ? g : a));
        if (Math.abs(at.beat - beat) > 1e-6 || at.velocity < 0.01) continue;
        expect(Math.abs(note + semis - at.midi), `±${range} at beat ${beat}`).toBeLessThan(0.05);
        expect(Math.abs(semis)).toBeLessThanOrEqual(range);
        checked++;
      }
      expect(checked, `±${range}`).toBeGreaterThan(5);
    }
  });
  it('the export menu’s mode wins over the saved setting', () => {
    const p = project('bloomchords', 'standard');
    const [, mpe] = readMidi(exportMidi(p, { raw: 0, kept: 0 }, 'mpe'));
    expect(new Set(mpe.filter((e) => (e.status & 0xf0) === 0x90).map((e) => e.status & 0x0f)).size).toBeGreaterThan(1);
  });
  it('a glide exported as MPE is one long note per phrase, not a retrigger every two octaves', () => {
    const [, mpe] = readMidi(exportMidi(project('riser', 'mpe')));
    const [, std] = readMidi(exportMidi(project('riser', 'standard')));
    const ons = (t: typeof mpe) => t.filter((e) => (e.status & 0xf0) === 0x90 && e.data[1] > 0).length;
    expect(ons(mpe)).toBeLessThanOrEqual(ons(std));
    expect(ons(mpe)).toBe(1);
  });
});
