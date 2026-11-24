import { describe, expect, it } from 'vitest';
import { compileAst, FUNCTIONS, parse, type Ast } from './expr';
import { importMath, ImportError } from './importMath';
import { readNative, type NativeChannel } from './importChannel';
import { compose, trackDocument, trackFormulas, trackTex, fmtNum, texVariants, toTex } from './symbolic';
import { PRESETS, defaultProject, trackFromPreset } from './presets';
import { scaleLength, type Track } from './project';

/** the function's value at these variables (time is t) */
const at = (src: string, scope: Record<string, number>, opts = {}) => compileAst(importMath(src, opts).value)(scope);
const value = (ast: Ast, scope: Record<string, number>) => compileAst(ast)(scope);

describe('factorials and binomials', () => {
  it('reads n! as the factorial', () => {
    expect(at('5!', {})).toBe(120);
    expect(at('0!', {})).toBe(1);
    expect(at('(2 + 1)!', {})).toBe(6);
    expect(at('3!!', {})).toBe(720);
    expect(at('-3!', {})).toBe(-6);
    expect(at('2x!', { t: 3 })).toBe(12);
    expect(at('x!^2', { t: 3 })).toBe(36);
  });
  it('reads the binomial coefficient however it is written', () => {
    // a friend's n!/r!(n−r)!: the product written without a sign stays under the line
    const plain = importMath('n!/r!(n-r)!', { timeVar: 'n' });
    expect(compileAst(plain.value)({ t: 5, r: 2 })).toBe(10);
    expect(plain.warnings.some((w) => w.includes('kept together under'))).toBe(true);
    expect(at('\\frac{n!}{r!(n-r)!}', { t: 5, r: 2 }, { timeVar: 'n' })).toBe(10);
    expect(at('\\frac{n!}{r!\\left(n-r\\right)!}', { t: 6, r: 3 }, { timeVar: 'n' })).toBe(20);
    expect(at('\\binom{n}{r}', { t: 52, r: 5 }, { timeVar: 'n' })).toBe(2598960);
    expect(at('choose(x, 2)', { t: 4 })).toBe(6);
  });
  it('the engine has them too, and edge cases are sane', () => {
    expect(FUNCTIONS.fact.fn(4.7)).toBe(24);
    expect(FUNCTIONS.fact.fn(-1)).toBe(0);
    expect(FUNCTIONS.choose.fn(5, 7)).toBe(0);
    expect(FUNCTIONS.choose.fn(10, 0)).toBe(1);
  });
});

describe('precedence', () => {
  it('keeps a product written without a sign together under /', () => {
    expect(at('1/2x', { t: 4 })).toBeCloseTo(1 / 8);
    expect(at('(1/2)x', { t: 4 })).toBe(2);
    expect(at('1/2*x', { t: 4 })).toBe(2);
    expect(at('x/2π', { t: Math.PI })).toBeCloseTo(0.5);
    // nothing changes where there is no product to keep together
    expect(at('⌊7x⌋/12 + 1', { t: 1 })).toBeCloseTo(7 / 12 + 1);
  });
  it('reads mod as asked, and SoundFunc’s % like ×', () => {
    expect(at('1 + x mod 3', { t: 4 })).toBe(2); // (1 + 4) mod 3
    expect(at('1 + x mod 3', { t: 4 }, { modReading: 'term' })).toBe(2); // 1 + (4 mod 3)
    expect(at('2 + x mod 3', { t: 4 }, { modReading: 'term' })).toBe(3);
    expect(at('2 + x % 3', { t: 4 })).toBe(3);
  });
});

describe('SoundFunc’s own syntax, pasted in', () => {
  it('reads ? :, &&, ||, !, ==, % and hex', () => {
    expect(at('x > 2 ? 1 : 0', { t: 3 })).toBe(1);
    expect(at('x > 2 ? 1 : 0', { t: 1 })).toBe(0);
    expect(at('x > 1 && x < 3', { t: 2 })).toBe(1);
    expect(at('x < 1 || x > 3', { t: 2 })).toBe(0);
    expect(at('!x', { t: 0 })).toBe(1);
    expect(at('x == 2', { t: 2 })).toBe(1);
    expect(at('0x10 + x', { t: 1 })).toBe(17);
    expect(at('0b101', {})).toBe(5);
  });
});

describe('the LaTeX SoundFunc writes', () => {
  const native = (tex: string, scope: Record<string, number>) => compileAst(importMath(tex, { native: true }).value)(scope);
  it('reads round, the fractional part, pick, every, log₂ and gcd', () => {
    expect(native('\\left\\lfloor n \\right\\rceil', { n: 2.5 })).toBe(3);
    expect(native('\\left\\{ n \\right\\}', { n: 2.25 })).toBe(0.25);
    expect(native('\\left(10,\\ 20,\\ 30\\right)_{n}', { n: 4 })).toBe(20);
    expect(native('\\left[\\,n \\equiv 1 \\pmod{4}\\,\\right]', { n: 5 })).toBe(1);
    expect(native('\\left[\\,n \\equiv 1 \\pmod{4}\\,\\right]', { n: 6 })).toBe(0);
    expect(native('\\log_2\\left(n\\right)', { n: 8 })).toBeCloseTo(3);
    expect(native('\\gcd\\left(n,\\ 12\\right)', { n: 18 })).toBe(6);
    expect(native('\\mathtt{0x8000}', {})).toBe(0x8000);
    expect(native('\\mathit{beat} + \\mathrm{bar} + N', { beat: 1, bar: 2, steps: 4 })).toBe(7);
    expect(native("k' + 1", { k_: 2 })).toBe(3);
    expect(native('\\lnot n', { n: 0 })).toBe(1);
  });
  it('keeps SoundFunc’s clocks as clocks, and Desmos piecewise as piecewise', () => {
    const r = importMath('n + k + h', { native: true });
    expect(r.params).toEqual([]);
    expect(at('\\left\\{x<1: 2, 3\\right\\}', { t: 0 })).toBe(2);
    expect(at('\\left\\{x<1: 2, 3\\right\\}', { t: 5 })).toBe(3);
  });
  it('says what is wrong with a list that has no index', () => {
    expect(() => importMath('(1, 2, 3)', { native: true })).toThrow(ImportError);
  });
});

// ---------- round trips: what SoundFunc copies comes back as the same channel ----------

const song = { ...defaultProject().song, harmony: 'pick(bar, 0, 3, 4, 2)' };

/** the scopes a channel is heard at: steps across a few loops and chords */
function scopes(track: Track): Record<string, number>[] {
  const out: Record<string, number>[] = [];
  const sliders = Object.fromEntries((track.sliders ?? []).map((s) => [s.name, s.value]));
  for (const k of [0, 1, 3]) {
    for (let n = 0; n < Math.min(track.steps, 96); n++) {
      const t = n * track.stepBeats;
      out.push({ ...sliders, n, k, t, x: n / track.steps, steps: track.steps, L: scaleLength(song), h: (n + k) % 5, bar: Math.floor(t / 4), beat: t + k * track.steps * track.stepBeats, np: 0.3 });
    }
  }
  return out;
}

/** numbers as the LaTeX shows them (four decimals): what reading it back can recover */
function shown(ast: Ast): Ast {
  switch (ast.k) {
    case 'num':
      return ast.raw ? ast : { k: 'num', v: Number(fmtNum(ast.v)) };
    case 'neg':
    case 'not':
      return { ...ast, a: shown(ast.a) };
    case 'bin':
      return { ...ast, a: shown(ast.a), b: shown(ast.b) };
    case 'cond':
      return { ...ast, c: shown(ast.c), a: shown(ast.a), b: shown(ast.b) };
    case 'call':
      return { ...ast, args: ast.args.map(shown) };
    default:
      return ast;
  }
}

/** a step heard the same: equal, or both silent (not a number plays as silence) */
function same(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return !Number.isFinite(a) && !Number.isFinite(b);
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a));
}

function expectSameChannel(label: string, track: Track, read: NativeChannel, round: boolean) {
  const reference = compose(track, true).math.outputs;
  for (const o of reference) {
    const back = read.outputs.find((x) => x.port === o.port);
    expect(back, `${label}: ${o.port} came back`).toBeTruthy();
    const want = compileAst(round ? shown(o.ast) : o.ast), got = compileAst(back!.ast);
    // sliders by the names the import gave them
    const names = new Map(read.sliders.map((s) => [s.name, s.value]));
    let wrong = 0, first = '';
    for (const sc of scopes(track)) {
      const scope = { ...sc, ...Object.fromEntries(names) };
      const a = want(scope), b = got(scope);
      if (!same(a, b)) {
        if (!wrong) first = `n=${sc.n} k=${sc.k}: ${a} ≠ ${b}`;
        wrong++;
      }
    }
    expect(wrong, `${label} ${o.port}: ${first}`).toBe(0);
  }
}

const tracks = PRESETS.map((p, i) => trackFromPreset(p, i));

describe('round trips through what SoundFunc copies', () => {
  it('the SoundFunc formulas of every preset come back exactly', () => {
    for (const track of tracks) {
      const text = trackFormulas([compose(track, true)], song);
      const read = readNative(text);
      expect(read?.format, track.name).toBe('formulas');
      const ch = read!.channels[0];
      expect(ch.name).toBe(track.name);
      expect(ch.steps).toBe(track.steps);
      expect(ch.stepBeats).toBe(track.stepBeats);
      expectSameChannel(`${track.name} (formulas)`, track, ch, false);
    }
  });
  it('the LaTeX of every preset comes back as it reads (to the four decimals it shows)', () => {
    for (const track of tracks) {
      // the document, without the comment that carries the channel whole: only the math is read
      const tex = trackDocument([compose(track)], song)
        .split('\n')
        .filter((l) => !l.startsWith('%'))
        .join('\n');
      const read = readNative(tex);
      expect(read?.format, track.name).toBe('latex');
      expect(read!.channels[0].steps, track.name).toBe(track.steps);
      expectSameChannel(`${track.name} (LaTeX)`, track, read!.channels[0], true);
    }
  });
  it('a LaTeX line copied on its own comes back too', () => {
    for (const track of tracks.slice(0, 12)) {
      const lines = trackTex(compose(track), song);
      const pitch = lines.find((l) => l.label === 'pitch')!;
      // with the where-clause it leans on, as the sheet shows it
      const where = lines.filter((l) => l.label.startsWith('where'));
      const read = readNative([pitch, ...where].map((l) => l.tex).join(' \\\\\n'));
      expect(read?.format, track.name).toBe('latex');
      expect(read!.channels[0].outputs.map((o) => o.port)).toContain('pitch');
    }
  });
  it('a whole track’s document brings back every channel exactly, nodes and all', () => {
    const doc = trackDocument(tracks.slice(0, 5).map((t) => compose(t)), song);
    const read = readNative(doc);
    expect(read?.format).toBe('saved');
    expect(read!.channels.map((c) => c.name)).toEqual(tracks.slice(0, 5).map((t) => t.name));
    read!.channels.forEach((c, i) => {
      const { id: _a, ...want } = tracks[i];
      expect(c.track).toEqual(want);
    });
  });
});

describe('telling SoundFunc’s writing from a function from elsewhere', () => {
  it('reads a lone SoundFunc formula, and leaves plain math to the function reader', () => {
    const lone = readNative('pick(n % 8, 0, 2, 4) + h');
    expect(lone?.lone).toBe(true);
    expect(value(lone!.channels[0].outputs[0].ast, { n: 9, h: 1 })).toBe(3);
    expect(readNative('0.85 * bits(0x8024, n) * (0.96 + 0.08 * rand(n + 32k, 1))')?.lone).toBe(true);
    expect(readNative('sin(2*pi*x)')).toBeNull();
    expect(readNative('y = ⌊7·frac(x·φ)⌋/12')).toBeNull();
    expect(readNative('\\frac{x}{2}+\\sin\\left(x\\right)')).toBeNull();
    expect(readNative('n!/r!(n-r)!')).toBeNull();
  });
  it('turns unknown names into sliders, and says so', () => {
    const read = readNative('# Mine\npitch = a * n\nvelocity = 0.8');
    expect(read!.channels[0].sliders.map((s) => s.name)).toEqual(['a']);
    expect(read!.warnings.join(' ')).toContain('slider');
  });
  it('reports a broken line instead of guessing', () => {
    expect(() => readNative('pitch = n +\nvelocity = 1')).toThrow(/pitch/);
  });
});

describe('how the LaTeX is laid out', () => {
  it('writes if … else if … otherwise as one list of cases, and reads it back', () => {
    const src = '(n < 10 ? 1 : n < 20 ? 2 : n < 30 ? 3 : 4) * 2 + (n % 2 == 0 ? (n < 4 ? 7 : 8) : 9)';
    const ast = parse(src).ast;
    const tex = toTex(ast);
    expect(toTex(parse('n < 10 ? 1 : n < 20 ? 2 : 3').ast).match(/begin\{cases\}/g)).toHaveLength(1);
    const back = compileAst(importMath(tex, { native: true }).value), want = compileAst(ast);
    for (const n of [0, 1, 4, 5, 12, 13, 25, 26, 40, 41]) expect(back({ n }), `n=${n}`).toBe(want({ n }));
  });
  it('breaks a long formula between its terms or factors, losing nothing, and sets long lists in rows', () => {
    const sum = texVariants('pitch', parse('7.29 + 10.39 * sin(3 * t) - 1.61 * sin(8 * t) + 4.82 * sin(12 * t)').ast);
    expect(sum).toHaveLength(4); // one line, then 2, 3 and 4
    const bare = (t: string) => t.replace(/\\begin\{aligned\}|\\end\{aligned\}|\\\\|&|\\quad|\{\}|\s|[{}=]/g, '');
    for (const v of sum) expect(bare(v)).toBe(bare(sum[0]));
    expect(sum.map((v) => v.split(' \\\\ ').length)).toEqual([1, 2, 3, 4]);
    const product = texVariants('velocity', parse('0.95 * bits(0x8120, n) * (0.88 + 0.12 * rand(n, 3))').ast);
    expect(product.length).toBeGreaterThan(1);
    const list = texVariants('pitch', parse('h + pick(n, 0,0,0,0,8,0,6,0,0,0,4,0,6,0,0,0)').ast);
    expect(list.some((v) => v.includes('begin{array}'))).toBe(true);
    // brackets round cases close in on them, and nothing else changes
    const lead = texVariants('pitch', parse('floor((n < 4 ? 12 : 34) / 10^(n % 2)) % 10 - floor(n / 2)').ast)[0];
    expect(lead.match(/vcenter/g)).toHaveLength(1);
    expect(lead.match(/\\left(?![a-z])/g)).toHaveLength(lead.match(/\\right(?![a-z])/g)!.length);
  });
});
