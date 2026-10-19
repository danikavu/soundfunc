import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile, compileAst, parse } from './expr';
import { compose, toSource, toTex, trackCode } from './symbolic';
import { compileGraph, euclid } from './graph';
import { exportMidi, collectNotes } from './midi';
import { degreeToMidi, SCALES, valueToMidi } from './music';
import { KITS, PRESETS, defaultProject, trackFromPreset, trackFromTemplate } from './presets';
import { harmonyAt, normalizeProject, renderTrack, scaleLength, type Project, type Track } from './project';
import { chordName, chordTones } from './music';
import { mulberry32, mutateFormula, mutateTrack, musicalScore } from './mutate';
import { parsePattern } from './graph';
import { timbreHarmonics } from './timbre';
import { importMath } from './importMath';
import { auditionGraph, blockFromSelection, collapseNodes, explodeFormula, insertBlock } from './graphEdit';
import { BLOCKS } from './blocks';
import { cleanProject, projectKey, voiceOf, wearsVoice } from '../state/library';

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
    expect(p.run({ n: 0, x: 0, t: 0, k: 0, steps: 1, h: 0, bar: 0, L: 7, beat: 0, vars: {} })).not.toBeNull();
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
    const base = defaultProject().song;
    const song = { ...base, harmony: 'pick(bar, 0, 4, 5, 3)' };
    PRESETS.forEach((p, i) => out.push({ label: p.id, track: trackFromPreset(p, i), song }));
    for (const kit of KITS) kit.tracks.forEach((t, i) => out.push({ label: `${kit.id}/${t.name}`, track: trackFromTemplate(t, t.name, i), song: { ...base, ...kit.song } }));
    return out;
  };
  const scopeFor = (track: Track, song: Project['song'], n: number, k: number) => {
    const t = n * track.stepBeats;
    const beat = k * track.steps * track.stepBeats + t;
    return { ...Object.fromEntries((song.sliders ?? []).map((s) => [s.name, s.value])), n, x: n / track.steps, t, k, steps: track.steps, h: harmonyAt(song, beat), bar: Math.floor(beat / 4 + 1e-9), L: scaleLength(song), beat } as Record<string, number>;
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
      const fnName = code.match(/function (\w+)\(n, k = 0\)/)![1];
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
      const fnName = code.match(/def (\w+)\(n, k=0\)/)![1];
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
    PRESETS.forEach((p, i) => out.push({ label: p.id, track: trackFromPreset(p, i), song }));
    for (const kit of KITS) kit.tracks.forEach((t, i) => out.push({ label: `${kit.id}/${t.name}`, track: trackFromTemplate(t, t.name, i), song: { ...base, ...kit.song } }));
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
    const song = { ...defaultProject().song, harmony: 'pick(bar, 0, 3)', sliders: [{ name: 'lift', value: 2, min: 0, max: 5 }] };
    const t = trackFromPreset(PRESETS.find((p) => p.id === 'form')!, 0);
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
    const lower = renderTrack(t, { ...song, sliders: [{ ...song.sliders[0], value: 0 }] }, 6, false).pitchCurve[0];
    expect(bridge - lower).toBe(2);
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
