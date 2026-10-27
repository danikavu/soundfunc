/**
 * Read a function written for a graphing calculator or a paper — LaTeX (as Desmos
 * copies it), \begin{cases}, or plain math with ⌊ ⌋, mod, ≥ — into SoundFunc's
 * syntax tree. Piecewise functions keep their undefined regions, which become
 * silence (a velocity gate) instead of sound.
 */
import { compileAst, FUNCTIONS, type Ast, type BinOp } from './expr';
import { simplify, substitute, toSource, varsOf } from './symbolic';
import { DEFAULT_PITCH_RANGE, limitPitch, SCALES, valueToPitch, type PitchRange } from './music';

const UNDEF: Ast = { k: 'var', name: '__undefined' };

type Tok =
  | { t: 'num'; v: number }
  | { t: 'word'; v: string } // identifiers, function names, single-letter variables
  | { t: 'cmd'; v: string } // LaTeX commands, normalised
  | { t: 'sym'; v: string }
  | { t: 'text'; v: string }; // \text{if}, \text{otherwise}, "and"

export class ImportError extends Error {}

/** Greek letters read as ordinary names — σ is "sigma", as in Desmos (π, τ, φ stay constants) */
const GREEK = [
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'rho', 'sigma', 'upsilon', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Sigma', 'Upsilon', 'Psi', 'Omega',
];
export const GREEK_NAMES = new Set(GREEK);
const GREEK_VARIANTS: Record<string, string> = { varepsilon: 'epsilon', vartheta: 'theta', varrho: 'rho', varsigma: 'sigma', varkappa: 'kappa', varpi: 'pi', Pi: 'pi' };
const GREEK_UNICODE: Record<string, string> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi',
  ρ: 'rho', σ: 'sigma', υ: 'upsilon', χ: 'chi', ψ: 'psi', ω: 'omega', Γ: 'Gamma', Δ: 'Delta', Θ: 'Theta', Λ: 'Lambda', Σ: 'Sigma', Ω: 'Omega',
};

/** words that are functions or keywords when typed as plain text */
const WORDS = new Set([
  'mod', 'frac', 'floor', 'ceil', 'round', 'abs', 'sign', 'max', 'min', 'exp', 'ln', 'log', 'sqrt',
  'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'if', 'otherwise', 'else', 'and', 'or', 'for', 'when', 'pi', 'tau', 'phi', ...GREEK, 'sgn',
  ...Object.keys(FUNCTIONS),
]);

const IGNORED_CMDS = new Set(['left', 'right', 'displaystyle', 'limits', 'quad', 'qquad', 'big', 'Big', 'bigg', 'Bigg', 'bigl', 'bigr', 'Bigl', 'Bigr']);
const CMD_ALIASES: Record<string, Tok> = {
  cdot: { t: 'sym', v: '*' },
  times: { t: 'sym', v: '*' },
  ast: { t: 'sym', v: '*' },
  div: { t: 'sym', v: '/' },
  le: { t: 'sym', v: '<=' },
  leq: { t: 'sym', v: '<=' },
  leqslant: { t: 'sym', v: '<=' },
  ge: { t: 'sym', v: '>=' },
  geq: { t: 'sym', v: '>=' },
  geqslant: { t: 'sym', v: '>=' },
  ne: { t: 'sym', v: '!=' },
  neq: { t: 'sym', v: '!=' },
  lt: { t: 'sym', v: '<' },
  gt: { t: 'sym', v: '>' },
  land: { t: 'text', v: 'and' },
  wedge: { t: 'text', v: 'and' },
  lor: { t: 'text', v: 'or' },
  vee: { t: 'text', v: 'or' },
  mid: { t: 'sym', v: '|' },
  vert: { t: 'sym', v: '|' },
  lvert: { t: 'sym', v: '|' },
  rvert: { t: 'sym', v: '|' },
  bmod: { t: 'word', v: 'mod' },
  pmod: { t: 'word', v: 'mod' },
  varphi: { t: 'word', v: 'phi' },
  phi: { t: 'word', v: 'phi' },
  pi: { t: 'word', v: 'pi' },
  tau: { t: 'word', v: 'tau' },
};

function tokenize(input: string): Tok[] {
  let s = input
    .replace(/\b(AND|OR|IF|ELSE|OTHERWISE|WHEN)\b/g, (m) => m.toLowerCase())
    .replace(/\$+/g, ' ')
    .replace(/[−–]/g, '-')
    .replace(/[·×∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/⌊/g, '\\lfloor ')
    .replace(/⌋/g, '\\rfloor ')
    .replace(/⌈/g, '\\lceil ')
    .replace(/⌉/g, '\\rceil ')
    .replace(/[αβγδεζηθικλμνξρσυχψωΓΔΘΛΣΩ]/g, (c) => ` ${GREEK_UNICODE[c]} `)
    .replace(/π/g, ' pi ')
    .replace(/τ/g, ' tau ')
    .replace(/[φϕ]/g, ' phi ')
    // LaTeX shorthand: \frac14 = \frac{1}{4}
    .replace(/\\([dt]?frac)\s*(\d)\s*(\d)/g, '\\$1{$2}{$3}')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    // \operatorname{mod}, \mathrm{floor}, \text{if} → words / text
    .replace(/\\(?:operatorname|mathrm|mathit|mathsf)\*?\s*\{\s*([a-zA-Z]+)\s*\}/g, ' $1 ')
    .replace(/\\(?:text|textrm|textit|mbox|textbf)\s*\{([^}]*)\}/g, (_, t: string) => ` \u0001${t.trim()}\u0002 `);
  // the function's own name at the start — y =, p =, t_i =, f(x) =, g\left(x\right) = — is not part of it
  s = s.replace(/^\s*(?:[A-Za-z]|\\[A-Za-z]+)(?:_(?:\{[^}]*\}|[A-Za-z0-9]))?\s*(?:(?:\\left)?\(\s*[^()=]*?(?:\\right)?\))?\s*=(?!=)/, '');

  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '\u0001') {
      const end = s.indexOf('\u0002', i);
      const text = s.slice(i + 1, end).trim().toLowerCase();
      for (const w of text.split(/[\s,]+/).filter(Boolean)) out.push({ t: 'text', v: w });
      i = end + 1;
      continue;
    }
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i))!;
      i += m[0].length;
      const name = m[1];
      if (IGNORED_CMDS.has(name) || name === ',' || name === ';' || name === '!' || name === ' ' || name === ':') continue;
      if (name === '\\') out.push({ t: 'sym', v: '\\\\' });
      else if (name === '{' || name === '}') out.push({ t: 'sym', v: `\\${name}` });
      else if (name === '|') out.push({ t: 'sym', v: '|' });
      else if (name === 'begin' || name === 'end') {
        const env = /^\s*\{(\w+\*?)\}/.exec(s.slice(i));
        if (env) i += env[0].length;
        out.push({ t: 'cmd', v: `${name}:${env?.[1] ?? ''}` });
      } else if (CMD_ALIASES[name]) out.push(CMD_ALIASES[name]);
      else if (GREEK_NAMES.has(name) || GREEK_VARIANTS[name]) out.push({ t: 'word', v: GREEK_VARIANTS[name] ?? name });
      else out.push({ t: 'cmd', v: name });
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (num) {
      out.push({ t: 'num', v: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^[a-zA-Z]+/.exec(s.slice(i));
    if (word) {
      i += word[0].length;
      const w = word[0];
      if (WORDS.has(w)) out.push(['if', 'otherwise', 'else', 'and', 'or', 'for', 'when'].includes(w) ? { t: 'text', v: w } : { t: 'word', v: w });
      // an unknown name called like a function: keep it whole so it can be reported
      else if (w.length > 1 && /^\s*(?:\\left\s*)?\(/.test(s.slice(i))) out.push({ t: 'word', v: w });
      // unknown runs of letters are products of variables: "2xy" → 2·x·y
      else for (const ch of w) out.push({ t: 'word', v: ch });
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '!=', '=='].includes(two)) {
      out.push({ t: 'sym', v: two === '==' ? '=' : two });
      i += 2;
      continue;
    }
    if ('+-*/^_()[]{}|,:&=<>;'.includes(c)) {
      out.push({ t: 'sym', v: c });
      i++;
      continue;
    }
    throw new ImportError(`Can't read “${c}”`);
  }
  return out;
}

// ---------- parser ----------

const FN_MAP: Record<string, string> = {
  frac: 'fract', ln: 'log', arcsin: 'asin', arccos: 'acos', arctan: 'atan', cosh: 'cosh', sgn: 'sign',
};

export interface ImportOptions {
  /** what the source calls its time variable (default x) */
  timeVar?: string;
  /** SoundFunc variable to put in its place */
  timeAs?: string;
  /**
   * How "a + b mod n" is read. 'sum' (default): mod applies to the whole sum before
   * it, (a + b) mod n — how it is usually meant on paper. 'term': like ×, a + (b mod n).
   */
  modReading?: 'sum' | 'term';
}

/** internal: helper functions defined in the same text, e.g. g(x) = … */
interface ReadContext {
  warnings: Set<string>;
  userNames: Set<string>;
  callUser: (name: string, args: Ast[]) => Ast | null;
  /** names that aren't the time variable — they become sliders */
  params: Set<string>;
  /** constant definitions (k = 2.5): numbers become slider values, expressions are written in */
  constants: Map<string, Ast>;
  /** every free name as the source wrote it, in order — for guessing the time variable */
  seen: string[];
}

export interface Imported {
  /** the source's time variable (x, t, h…) */
  timeVar: string;
  /** names that aren't time — sliders, with their starting values */
  params: { name: string; value: number }[];
  /** every variable name the source uses, as written — any of them could be time */
  names: string[];
  /** as read, with undefined regions kept (for display) */
  raw: Ast;
  /** the function's value, undefined regions as 0 */
  value: Ast;
  /** 1 where the function is defined, 0 where it is not (null = always defined) */
  gate: Ast | null;
  warnings: string[];
}

function readExpr(src: string, opts: ImportOptions, ctx: ReadContext): Ast {
  // "f, \sigma > 0": everything after a top-level comma is a side condition, not the function
  const parts = splitTopLevel(src);
  if (parts.length > 1) {
    for (const extra of parts.slice(1)) ctx.warnings.add(`Read “${extra.trim()}” as a condition on the function — it isn't part of the sound.`);
    src = parts[0];
  }
  const timeVar = opts.timeVar ?? 'x';
  const timeAs = opts.timeAs ?? 't';
  const modSum = (opts.modReading ?? 'sum') === 'sum';
  const toks = tokenize(src);
  const warnings = ctx.warnings;
  let k = 0;
  const peek = (o = 0) => toks[k + o];
  const is = (t: Tok['t'], v?: string, o = 0) => {
    const x = toks[k + o];
    return !!x && x.t === t && (v === undefined || (x as { v: unknown }).v === v);
  };
  const sym = (v: string) => is('sym', v);
  const expect = (v: string) => {
    if (!sym(v)) throw new ImportError(`Expected “${v}” ${peek() ? `but found “${(peek() as { v: unknown }).v}”` : 'at the end'}`);
    k++;
  };
  const bin = (op: BinOp, a: Ast, b: Ast): Ast => ({ k: 'bin', op, a, b });
  const call = (fn: string, ...args: Ast[]): Ast => ({ k: 'call', fn, args });

  /** is the token at offset o a "(" whose contents hold a top-level comma — i.e. mod(a, n) not "a mod (n)" */
  const callsWithComma = (o: number) => {
    if (!is('sym', '(', o)) return false;
    let depth = 0;
    for (let j = k + o; j < toks.length; j++) {
      const t = toks[j];
      if (t.t !== 'sym') continue;
      if (['(', '[', '{', '\\{'].includes(t.v)) depth++;
      else if ([')', ']', '}', '\\}'].includes(t.v) && --depth === 0) return false;
      else if (t.v === ',' && depth === 1) return true;
    }
    return false;
  };

  /** stop tokens for the current context, so "|a|" and "cond: value" parse */
  const stops: string[][] = [[]];
  const stopped = () => {
    const x = peek();
    if (!x) return true;
    if (x.t === 'text' && ['if', 'otherwise', 'else', 'for', 'when'].includes(x.v)) return true;
    if (x.t === 'cmd' && (x.v.startsWith('end:') || x.v === 'rfloor' || x.v === 'rceil')) return true;
    if (x.t === 'sym' && [')', ']', '}', '\\}', ',', ':', '&', '\\\\', ';'].includes(x.v)) return true;
    return x.t === 'sym' && stops[stops.length - 1].includes(x.v);
  };

  function expr(): Ast {
    return or();
  }
  function or(): Ast {
    let l = and();
    while (is('text', 'or')) {
      k++;
      l = bin('||', l, and());
    }
    return l;
  }
  function and(): Ast {
    let l = rel();
    while (is('text', 'and')) {
      k++;
      l = bin('&&', l, rel());
    }
    return l;
  }
  function rel(): Ast {
    const first = add();
    let l = first;
    let prev = first;
    let out: Ast | null = null;
    // chained comparisons: a < b < c → a < b && b < c
    while (['<', '>', '<=', '>=', '=', '!='].some((o) => sym(o))) {
      const op = (peek() as { v: string }).v;
      k++;
      const r = add();
      const cmp = bin((op === '=' ? '==' : op) as BinOp, prev, r);
      out = out ? bin('&&', out, cmp) : cmp;
      prev = r;
      l = out;
    }
    return l;
  }
  function add(): Ast {
    let l = mul();
    for (;;) {
      if (sym('+') || sym('-')) {
        const op = (toks[k++] as { v: string }).v as BinOp;
        l = bin(op, l, mul());
      } else if (modSum && infixMod()) {
        // "a + b mod n" → (a + b) mod n: mod takes everything before it in this group
        k++;
        warnings.add(MOD_SUM_NOTE);
        l = bin('%', l, mul());
      } else return l;
    }
  }
  /** "mod" used as an operator (a mod n), not the function mod(a, n) */
  function infixMod(): boolean {
    return is('word', 'mod') && !callsWithComma(1);
  }
  function startsAtom(): boolean {
    const x = peek();
    if (!x || stopped()) return false;
    if (infixMod()) return false;
    if (x.t === 'num' || x.t === 'word') return true;
    if (x.t === 'cmd') return !x.v.startsWith('end:');
    if (x.t === 'sym') return ['(', '[', '{', '\\{'].includes(x.v) || (x.v === '|' && !stops[stops.length - 1].includes('|'));
    return false;
  }
  function mul(): Ast {
    let l = unary();
    for (;;) {
      if (sym('*') || sym('/')) {
        const op = (toks[k++] as { v: string }).v as BinOp;
        l = bin(op, l, unary());
      } else if (!modSum && infixMod()) {
        // infix "a mod b" with the precedence of ×
        k++;
        warnings.add(MOD_TERM_NOTE);
        l = bin('%', l, unary());
      } else if (startsAtom()) {
        l = bin('*', l, power()); // implicit multiplication: 2x, 3⌊x/2⌋, (a)(b)
      } else return l;
    }
  }
  function unary(): Ast {
    if (sym('-')) {
      k++;
      return { k: 'neg', a: unary() };
    }
    if (sym('+')) {
      k++;
      return unary();
    }
    return power();
  }
  function power(): Ast {
    const base = atom();
    if (sym('^')) {
      k++;
      const ex = group();
      if (base.k === 'const' && base.name === 'e') return call('exp', ex);
      return bin('^', base, ex);
    }
    return base;
  }
  /** a LaTeX argument: {…}, or a single token (x^2, \frac12) */
  function group(): Ast {
    if (sym('{')) {
      k++;
      stops.push([]);
      const e = expr();
      stops.pop();
      expect('}');
      return e;
    }
    if (is('num')) {
      const t = toks[k++] as { v: number };
      return { k: 'num', v: t.v };
    }
    if (sym('-')) {
      k++;
      return { k: 'neg', a: group() };
    }
    return atom();
  }
  function args(): Ast[] {
    if (sym('(') || sym('[')) {
      const close = sym('(') ? ')' : ']';
      k++;
      stops.push([]);
      const list = [expr()];
      while (sym(',')) {
        k++;
        list.push(expr());
      }
      stops.pop();
      expect(close);
      return list;
    }
    if (sym('{')) return [group()];
    // \sin x, frac 4x: the argument runs to the end of the product
    return [mulNoImplicitFn()];
  }
  /** argument of an unparenthesised function: a product like 4x, but stopping before + − */
  function mulNoImplicitFn(): Ast {
    let l = power();
    while (startsAtom() && !(peek()!.t === 'word' && FUNCTION_NAMES.has((peek() as { v: string }).v))) l = bin('*', l, power());
    return l;
  }
  function fn(name: string): Ast {
    const a = args();
    const user = ctx.callUser(name, a);
    if (user) return user;
    switch (name) {
      case 'mod':
        if (a.length !== 2) throw new ImportError('mod needs two arguments: mod(a, n)');
        return bin('%', a[0], a[1]);
      case 'log':
        return bin('/', call('log', a[0]), call('log', { k: 'num', v: 10 }));
      case 'cosh':
        return bin('/', bin('+', call('exp', a[0]), call('exp', { k: 'neg', a: a[0] })), { k: 'num', v: 2 });
      case 'sqrt':
        return call('sqrt', a[0]);
    }
    const mapped = FN_MAP[name] ?? name;
    if (!FUNCTIONS[mapped]) {
      warnings.add(`Unknown function “${name}” — it was replaced by 0. Define it with SoundFunc functions, or pick a close one from the Guide.`);
      return { k: 'num', v: 0 };
    }
    if (['tri', 'saw', 'sqr', 'sine'].includes(mapped)) warnings.add(`“${mapped}” is SoundFunc’s version: period 1, range −1…1. If your source defined ${mapped} differently, adjust it.`);
    return call(mapped, ...a);
  }
  function piecewise(close: string): Ast {
    // Desmos: \{ c₁: v₁, c₂: v₂, default \}
    const rows: { c: Ast | null; v: Ast }[] = [];
    while (!sym(close)) {
      const first = expr();
      if (sym(':')) {
        k++;
        rows.push({ c: first, v: expr() });
      } else rows.push({ c: null, v: first });
      if (sym(',')) k++;
      else break;
    }
    expect(close);
    return foldRows(rows.map((r) => (r.c === null || rows.some((x) => x.c !== null) ? r : { c: r.v, v: { k: 'num', v: 1 } })));
  }
  function cases(): Ast {
    // \begin{cases} v & \text{if } c \\ v & \text{otherwise} \end{cases}
    const rows: { c: Ast | null; v: Ast }[] = [];
    while (!is('cmd', 'end:cases') && peek()) {
      const v = expr();
      let c: Ast | null = null;
      if (sym('&')) k++;
      if (is('text', 'if') || is('text', 'for') || is('text', 'when')) k++;
      if (is('text', 'otherwise') || is('text', 'else')) k++;
      else if (!sym('\\\\') && !is('cmd', 'end:cases')) c = expr();
      rows.push({ c, v });
      if (sym('\\\\')) k++;
    }
    if (is('cmd', 'end:cases')) k++;
    return foldRows(rows);
  }
  function foldRows(rows: { c: Ast | null; v: Ast }[]): Ast {
    let out: Ast = UNDEF;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      out = r.c ? { k: 'cond', c: r.c, a: r.v, b: out } : r.v;
    }
    return out;
  }
  /** a variable name, with its subscript (p_0, t_{max}, σ_1): time, a constant, or a parameter */
  function nameAtom(w: string): Ast {
    let name = w;
    if (sym('_')) {
      k++;
      let sub = '';
      const t = peek();
      if (t && (t.t === 'num' || t.t === 'word')) {
        k++;
        sub = String(t.v);
      } else if (sym('{')) {
        k++;
        while (!sym('}') && peek()) sub += String((toks[k++] as { v: unknown }).v);
        expect('}');
      }
      name = `${w}_${sub.replace(/[^A-Za-z0-9]/g, '')}`;
    }
    if (name === timeVar) return { k: 'var', name: timeAs };
    if (ctx.constants.has(name)) {
      // a constant written in brings along any sliders it is made of (c = 2a uses a)
      const ast = ctx.constants.get(name)!;
      for (const v of varsOf(ast)) if (v !== timeAs && v !== '__arg') ctx.params.add(v);
      return ast;
    }
    if (!ctx.seen.includes(name)) ctx.seen.push(name);
    const safe = safeName(name);
    if (safe !== name) ctx.warnings.add(`“${name}” is already a SoundFunc name (${name === 'k' ? 'the loop count' : name === 't' ? 'time in beats' : name === 'h' ? 'the current chord' : 'a built-in'}), so your ${name} is the slider “${safe}”.`);
    ctx.params.add(safe);
    return { k: 'var', name: safe };
  }
  function atom(): Ast {
    const x = peek();
    if (!x) throw new ImportError('The formula ends too early');
    if (x.t === 'num') {
      k++;
      return { k: 'num', v: x.v };
    }
    if (x.t === 'sym') {
      if (x.v === '(' || x.v === '[') {
        k++;
        stops.push([]);
        const e = expr();
        stops.pop();
        expect(x.v === '(' ? ')' : ']');
        return e;
      }
      if (x.v === '{') return group();
      if (x.v === '\\{') {
        k++;
        return piecewise('\\}');
      }
      if (x.v === '|') {
        warnings.add('|…| was read as an absolute value. If you meant to round down, write ⌊…⌋ or floor(…) — for example |4x| and ⌊4x⌋ differ between steps.');
        k++;
        stops.push(['|']);
        const e = expr();
        stops.pop();
        expect('|');
        return call('abs', e);
      }
    }
    if (x.t === 'cmd') {
      k++;
      switch (x.v) {
        case 'frac':
        case 'dfrac':
        case 'tfrac': {
          const a = group();
          return bin('/', a, group());
        }
        case 'sqrt': {
          if (sym('[')) {
            k++;
            const n = expr();
            expect(']');
            return bin('^', group(), bin('/', { k: 'num', v: 1 }, n));
          }
          return call('sqrt', group());
        }
        case 'lfloor':
        case 'lceil': {
          stops.push([]);
          const e = expr();
          stops.pop();
          if (!is('cmd', x.v === 'lfloor' ? 'rfloor' : 'rceil')) throw new ImportError(`Missing closing ${x.v === 'lfloor' ? '⌋' : '⌉'}`);
          k++;
          return call(x.v === 'lfloor' ? 'floor' : 'ceil', e);
        }
        case 'begin:cases':
        case 'begin:dcases':
          return cases();
        case 'exp':
        case 'ln':
        case 'log':
        case 'sin':
        case 'cos':
        case 'tan':
        case 'sinh':
        case 'cosh':
        case 'tanh':
        case 'arcsin':
        case 'arccos':
        case 'arctan':
        case 'max':
        case 'min':
          return fn(x.v);
        default:
          throw new ImportError(`Unsupported command \\${x.v}`);
      }
    }
    if (x.t === 'word') {
      k++;
      const w = x.v;
      if (w === 'pi' || w === 'tau' || w === 'phi') return { k: 'const', name: w };
      if (w === 'e' && sym('^')) return { k: 'const', name: 'e' };
      if (w === 'e') return { k: 'const', name: 'e' };
      if (GREEK_NAMES.has(w) && !(ctx.userNames.has(w) && sym('('))) return nameAtom(w);
      if (w === timeVar && !sym('(') && !sym('_')) return { k: 'var', name: timeAs };
      if (w.length > 1 || FUNCTION_NAMES.has(w) || (ctx.userNames.has(w) && sym('('))) {
        // e.g. "floor(x/2)", "frac 4x", "\operatorname{mod}(a, b)"
        return fn(w);
      }
      return nameAtom(w);
    }
    throw new ImportError(`Unexpected “${(x as { v: unknown }).v}”`);
  }

  if (!toks.length) throw new ImportError('Paste a function first');
  const ast = expr();
  if (k < toks.length) throw new ImportError(`Couldn't read past “${(toks[k] as { v: unknown }).v}”`);
  return ast;
}

const MOD_SUM_NOTE = 'Infix “mod” was read as applying to everything before it in its group: a + b mod n = (a + b) mod n. Switch “mod reads” if you meant a + (b mod n).';
const MOD_TERM_NOTE = 'Infix “mod” was read with the precedence of ×: a + b mod n = a + (b mod n). Switch “mod reads” if you meant the whole sum.';

const noUser: ReadContext['callUser'] = () => null;

export function importMath(src: string, opts: ImportOptions = {}): Imported {
  const read = (o: ImportOptions) => {
    const ctx: ReadContext = { warnings: new Set(), userNames: new Set(), callUser: noUser, params: new Set(), constants: new Map(), seen: [] };
    const values = new Map<string, number>();
    const ast = looksStructured(src) ? readProgram(src, o, ctx, values) : readExpr(src, o, ctx);
    return { ast, ctx, values };
  };
  let timeVar = opts.timeVar ?? 'x';
  let r = read({ ...opts, timeVar });
  // no x? then t, or the one plain lowercase name left over (h in p = p_0 e^{-h/H}), is time
  if (!opts.timeVar && !usesVar(r.ast, opts.timeAs ?? 't') && r.ctx.seen.length) {
    // judged on the names as written: t first, then a plain lowercase letter (not p_0), then a Greek one
    const names = r.ctx.seen;
    const guess = names.find((n) => n === 't') ?? names.find((n) => /^[a-z]$/.test(n)) ?? names.find((n) => GREEK_NAMES.has(n)) ?? names[0];
    timeVar = guess;
    r = read({ ...opts, timeVar });
    r.ctx.warnings.add(`There is no x, so “${guess}” is read as time. Choose another time variable below if that’s wrong.`);
  }
  const params = [...r.ctx.params].map((name) => ({ name, value: r.values.get(name) ?? 1 }));
  const names = [...new Set([...(usesVar(r.ast, opts.timeAs ?? 't') ? [timeVar] : []), ...r.ctx.seen])];
  return { ...finish(r.ast, r.ctx.warnings, timeVar, params), names };
}

function usesVar(ast: Ast, name: string): boolean {
  switch (ast.k) {
    case 'var':
      return ast.name === name;
    case 'neg':
    case 'not':
      return usesVar(ast.a, name);
    case 'bin':
      return usesVar(ast.a, name) || usesVar(ast.b, name);
    case 'cond':
      return usesVar(ast.c, name) || usesVar(ast.a, name) || usesVar(ast.b, name);
    case 'call':
      return ast.args.some((x) => usesVar(x, name));
    default:
      return false;
  }
}

/** split at commas that aren't inside any brackets */
function splitTopLevel(src: string): string[] {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      out.push(src.slice(from, i));
      from = i + 1;
    }
  }
  out.push(src.slice(from));
  return out.filter((p) => p.trim());
}

function finish(ast: Ast, warnings: Set<string>, timeVar: string, params: Imported['params']): Omit<Imported, 'names'> {
  const value = simplify(replaceUndef(ast));
  const gate = simplify(definedness(ast));
  return {
    timeVar,
    params,
    raw: simplify(ast),
    value,
    gate: gate.k === 'num' && gate.v === 1 ? null : gate,
    warnings: [...warnings],
  };
}

/** names SoundFunc already uses — a parameter with one of these names is renamed with a trailing _ */
const TAKEN = new Set(['n', 'x', 't', 'k', 'h', 'bar', 'L', 'steps', 'beat', 'a', 'b', 'c', 'p', 'e', 'pi', 'tau', 'phi', ...Object.keys(FUNCTIONS)]);
const safeName = (name: string) => (TAKEN.has(name) ? `${name}_` : name);

const FUNCTION_NAMES = new Set([...Object.keys(FUNCTIONS), 'mod', 'frac', 'ln', 'log', 'exp', 'max', 'min', 'sqrt', 'arcsin', 'arccos', 'arctan', 'cosh']);

function replaceUndef(ast: Ast): Ast {
  switch (ast.k) {
    case 'var':
      return ast.name === '__undefined' ? { k: 'num', v: 0 } : ast;
    case 'neg':
    case 'not':
      return { ...ast, a: replaceUndef(ast.a) };
    case 'bin':
      return { ...ast, a: replaceUndef(ast.a), b: replaceUndef(ast.b) };
    case 'cond':
      return { ...ast, c: replaceUndef(ast.c), a: replaceUndef(ast.a), b: replaceUndef(ast.b) };
    case 'call':
      return { ...ast, args: ast.args.map(replaceUndef) };
    default:
      return ast;
  }
}

/** 1 where the expression has a value, 0 inside an undefined piecewise region */
function definedness(ast: Ast): Ast {
  const one: Ast = { k: 'num', v: 1 };
  const all = (xs: Ast[]): Ast => xs.map(definedness).reduce((acc, d) => (isOne(acc) ? d : isOne(d) ? acc : { k: 'bin', op: '*', a: acc, b: d }), one);
  switch (ast.k) {
    case 'var':
      return ast.name === '__undefined' ? { k: 'num', v: 0 } : one;
    case 'cond': {
      const a = definedness(ast.a), b = definedness(ast.b);
      if (isOne(a) && isOne(b)) return definedness(ast.c);
      return { k: 'cond', c: replaceUndef(ast.c), a, b };
    }
    case 'neg':
    case 'not':
      return definedness(ast.a);
    case 'bin':
      return all([ast.a, ast.b]);
    case 'call':
      return all(ast.args);
    default:
      return one;
  }
}

const isOne = (a: Ast) => a.k === 'num' && a.v === 1;

/** Convenience: the imported function as SoundFunc formula text. */
export function importToSource(src: string, opts?: ImportOptions): { value: string; gate: string | null; warnings: string[] } {
  const r = importMath(src, opts);
  return { value: toSource(r.value), gate: r.gate ? toSource(r.gate) : null, warnings: r.warnings };
}

// ---------- structured text: definitions and IF / ELSE IF / OTHERWISE blocks ----------

const DEF_RE = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\))?\s*=(?!=)\s*(.*)$/;
const IF_RE = /^(?:else\s+if|elif|if|when)\b\s*(.*?)\s*:?\s*$/i;
const ELSE_RE = /^(?:otherwise|else)\b\s*:?\s*(.*)$/i;

/** text written as several lines: definitions like g(x) = …, or IF … : blocks */
export function looksStructured(src: string): boolean {
  const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2 && !/^if\b/i.test(lines[0] ?? '')) return false;
  return lines.some((l) => IF_RE.test(l) && /^(if|else|elif|when)\b/i.test(l)) || lines.filter((l) => DEF_RE.test(l) && !/^(if|else)\b/i.test(l)).length > 1;
}

interface Line {
  indent: number;
  text: string;
}

interface Definition {
  name: string;
  param: string | null;
  lines: Line[];
  ast?: Ast;
  reading?: boolean;
}

function readProgram(src: string, opts: ImportOptions, ctx: ReadContext, values: Map<string, number>): Ast {
  const lines: Line[] = src
    .replace(/\t/g, '  ')
    .split('\n')
    .map((raw) => ({ indent: raw.length - raw.trimStart().length, text: raw.trim().replace(/[;,]$/, '') }))
    .filter((l) => l.text && !/^(#|\/\/|%)/.test(l.text));

  // split into definitions: a name at the outermost indent, then everything indented under it
  const top = Math.min(...lines.map((l) => l.indent));
  const defs = new Map<string, Definition>();
  const order: Definition[] = [];
  let current: Definition | null = null;
  for (const l of lines) {
    const m = l.indent === top && !/^(if|else|elif|otherwise|when)\b/i.test(l.text) ? DEF_RE.exec(l.text) : null;
    if (m && !/^(if|else|elif|otherwise|when)$/i.test(m[1])) {
      current = { name: m[1], param: m[2] ?? null, lines: m[3] ? [{ indent: l.indent + 2, text: m[3] }] : [] };
      defs.set(current.name, current);
      order.push(current);
    } else {
      if (!current) {
        current = { name: 'y', param: 'x', lines: [] };
        defs.set('y', current);
        order.push(current);
      }
      current.lines.push(l);
    }
  }

  for (const d of defs.values()) if (d.param) ctx.userNames.add(d.name);
  Object.assign(ctx, {
    callUser: (name: string, args: Ast[]): Ast | null => {
      const d = defs.get(name);
      if (!d || !d.param) return null;
      if (d.reading) throw new ImportError(`“${name}” is defined in terms of itself`);
      if (!d.ast) {
        d.reading = true;
        // read the body with its parameter as a placeholder, then substitute the argument
        d.ast = readBlock(d.lines, { ...opts, timeVar: d.param, timeAs: '__arg' }, ctx, d.name);
        d.reading = false;
      }
      const arg = args[0] ?? { k: 'num', v: 0 };
      // a helper that is just a built-in under its usual name (frac(x) = x − ⌊x⌋) stays readable as that built-in
      const builtin = FN_MAP[name] ?? name;
      if (FUNCTIONS[builtin] && sameAsBuiltin(d.ast, builtin)) return { k: 'call', fn: builtin, args: [arg] };
      return substitute(d.ast, { __arg: arg });
    },
  });

  // the function to play: y, or f, or the last one that is a function, or the last line
  const main = defs.get('y') ?? defs.get('f') ?? [...order].reverse().find((d) => d.param) ?? order[order.length - 1];
  if (!main) throw new ImportError('Nothing to read');
  // other lines without a parameter are constants: k = 2.5 becomes a slider starting at 2.5;
  // c = 2k is written into the function wherever c appears
  for (const d of order) {
    if (d === main || d.param) continue;
    const ast = simplify(readBlock(d.lines, { ...opts, timeVar: '__none' }, ctx, d.name));
    if (ast.k === 'num') values.set(safeName(d.name), ast.v);
    else ctx.constants.set(d.name, ast);
  }
  ctx.params.clear(); // from here on: only the names the main function actually uses
  if (main.param && main.param !== (opts.timeVar ?? 'x')) ctx.warnings.add(`The main function takes “${main.param}”, read as time.`);
  return readBlock(main.lines, { ...opts, timeVar: main.param ?? opts.timeVar ?? 'x' }, ctx, main.name);
}

/** a run of lines at one indent: IF / ELSE IF / OTHERWISE cases, or one expression */
function readBlock(lines: Line[], opts: ImportOptions, ctx: ReadContext, name: string): Ast {
  if (!lines.length) throw new ImportError(`“${name}” has no body`);
  const base = Math.min(...lines.map((l) => l.indent));
  const rows: { c: Ast | null; v: Ast }[] = [];
  let i = 0;
  const childrenOf = (at: number): Line[] => {
    const kids: Line[] = [];
    for (let j = at + 1; j < lines.length && lines[j].indent > base; j++) kids.push(lines[j]);
    return kids;
  };
  const body = (inline: string, at: number): { ast: Ast; used: number } => {
    const kids = childrenOf(at);
    if (inline) return { ast: readExpr(stripAssign(inline, name), opts, ctx), used: kids.length };
    if (!kids.length) throw new ImportError(`Line “${lines[at].text}” needs something under it`);
    return { ast: readBlock(kids, opts, ctx, name), used: kids.length };
  };
  while (i < lines.length) {
    const l = lines[i];
    const isIf = /^(if|else\s+if|elif|when)\b/i.test(l.text);
    const isElse = !isIf && /^(otherwise|else)\b/i.test(l.text);
    if (isIf) {
      // "IF cond: value" or "IF cond:" with the value indented below
      const text = l.text.replace(/^(?:else\s+if|elif|if|when)\b\s*/i, '');
      const colon = topLevelColon(text);
      const cond = readExpr(colon < 0 ? text : text.slice(0, colon), opts, ctx);
      const { ast, used } = body(colon < 0 ? '' : text.slice(colon + 1).trim(), i);
      rows.push({ c: cond, v: ast });
      i += 1 + used;
    } else if (isElse) {
      const inline = ELSE_RE.exec(l.text)![1].trim();
      const { ast, used } = body(inline, i);
      rows.push({ c: null, v: ast });
      i += 1 + used;
    } else {
      // a plain line: the value (any indented lines under it continue the expression)
      const kids = childrenOf(i);
      rows.push({ c: null, v: readExpr(stripAssign([l.text, ...kids.map((k) => k.text)].join(' '), name), opts, ctx) });
      i += 1 + kids.length;
    }
  }
  // fold: first true case wins; no OTHERWISE leaves the rest undefined (silence)
  let out: Ast = UNDEF;
  for (let j = rows.length - 1; j >= 0; j--) out = rows[j].c ? { k: 'cond', c: rows[j].c!, a: rows[j].v, b: out } : rows[j].v;
  return out;
}

/** does a one-argument definition agree with the built-in of that name everywhere we look? */
function sameAsBuiltin(body: Ast, builtin: string): boolean {
  const f = FUNCTIONS[builtin].fn;
  const mine = compileAst(replaceUndef(body));
  for (let i = 0; i < 40; i++) {
    const x = (i - 20) * 0.731 + 0.123;
    const a = f(x), b = mine({ __arg: x });
    if (!(Math.abs(a - b) < 1e-9)) return false;
  }
  return true;
}

/** "y = …" or "g(x) = …" inside a block → just the expression */
function stripAssign(text: string, name: string): string {
  const m = /^([A-Za-z][A-Za-z0-9_]*)\s*(?:\([^)]*\))?\s*=(?!=)\s*(.*)$/.exec(text);
  return m && (m[1] === name || m[1] === 'y') ? m[2] : text;
}

/** the colon that ends "IF cond:", ignoring any inside brackets (Desmos {c: v}) */
function topLevelColon(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
}

// ---------- where an imported function lands as notes ----------

export type YMeans = 'octaves' | 'semitones' | 'degrees';

/** one octave, in the units y is read in */
export function octaveOf(yMeans: YMeans, scaleKey: string): number {
  return yMeans === 'octaves' ? 1 : yMeans === 'semitones' ? 12 : (SCALES[scaleKey] ?? SCALES.major).steps.length;
}

/**
 * The note a value of y becomes on the planted channel (octave 4, the song's key and pitch
 * range): `raw` as written, `heard` once the range has pinned (clamp, any pitch → MIDI 0…127)
 * or folded (wrap) it — the same steps renderTrack takes.
 */
export function importedPitch(
  y: number,
  yMeans: YMeans,
  song: { root: number; scale: string; pitchRange?: PitchRange },
  glide: boolean,
  octave = 4,
): { raw: number; heard: number } {
  const value = yMeans === 'octaves' ? y * 12 : y;
  const raw = valueToPitch(value, yMeans === 'degrees' ? 'degree' : 'semitone', song.root, song.scale, octave, !glide, false);
  return { raw, heard: limitPitch(raw, song.pitchRange ?? DEFAULT_PITCH_RANGE) };
}

/** a number kept short in a formula */
const tidy = (v: number) => Number(v.toPrecision(4));

/**
 * Fit y into a span: the function's lowest…highest value (`lo`…`hi`) is scaled onto
 * `octaves` octaves centred on the channel's octave — a riser that runs away stays a riser.
 */
export function fitToSpan(value: Ast, lo: number, hi: number, octaves: number, yMeans: YMeans, scaleKey: string): Ast {
  if (!(hi - lo > 1e-12)) return value;
  const span = octaves * octaveOf(yMeans, scaleKey);
  const a = tidy(span / (hi - lo)), b = tidy(-lo * (span / (hi - lo)) - span / 2);
  // kept as written: a formula prints numbers to 4 decimals, and a runaway riser needs a tiny scale
  const num = (v: number): Ast => ({ k: 'num', v, raw: String(v) });
  const scaled: Ast = { k: 'bin', op: '*', a: num(a), b: value };
  return b ? { k: 'bin', op: b < 0 ? '-' : '+', a: scaled, b: num(Math.abs(b)) } : scaled;
}
