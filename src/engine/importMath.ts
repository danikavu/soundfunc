/**
 * Read a function written for a graphing calculator or a paper — LaTeX (as Desmos
 * copies it), \begin{cases}, or plain math with ⌊ ⌋, mod, ≥ — into SoundFunc's
 * syntax tree. Piecewise functions keep their undefined regions, which become
 * silence (a velocity gate) instead of sound.
 */
import { FUNCTIONS, type Ast, type BinOp } from './expr';
import { simplify, toSource } from './symbolic';

const UNDEF: Ast = { k: 'var', name: '__undefined' };

type Tok =
  | { t: 'num'; v: number }
  | { t: 'word'; v: string } // identifiers, function names, single-letter variables
  | { t: 'cmd'; v: string } // LaTeX commands, normalised
  | { t: 'sym'; v: string }
  | { t: 'text'; v: string }; // \text{if}, \text{otherwise}, "and"

export class ImportError extends Error {}

/** words that are functions or keywords when typed as plain text */
const WORDS = new Set([
  'mod', 'frac', 'floor', 'ceil', 'round', 'abs', 'sign', 'max', 'min', 'exp', 'ln', 'log', 'sqrt',
  'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'if', 'otherwise', 'else', 'and', 'or', 'for', 'when', 'pi', 'tau', 'phi',
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
  // strip "y =" / "f(x) =" at the start
  s = s.replace(/^\s*(?:y|f\s*(?:\\left)?\(\s*x\s*(?:\\right)?\))\s*=(?!=)/, '');

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
  frac: 'fract', ln: 'log', arcsin: 'asin', arccos: 'acos', arctan: 'atan', cosh: 'cosh',
};

export interface ImportOptions {
  /** what the source calls its time variable (default x) */
  timeVar?: string;
  /** SoundFunc variable to put in its place */
  timeAs?: 't' | 'n' | 'x';
}

export interface Imported {
  /** as read, with undefined regions kept (for display) */
  raw: Ast;
  /** the function's value, undefined regions as 0 */
  value: Ast;
  /** 1 where the function is defined, 0 where it is not (null = always defined) */
  gate: Ast | null;
  warnings: string[];
}

export function importMath(src: string, opts: ImportOptions = {}): Imported {
  const timeVar = opts.timeVar ?? 'x';
  const timeAs = opts.timeAs ?? 't';
  const toks = tokenize(src);
  const warnings = new Set<string>();
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
    while (sym('+') || sym('-')) {
      const op = (toks[k++] as { v: string }).v as BinOp;
      l = bin(op, l, mul());
    }
    return l;
  }
  function startsAtom(): boolean {
    const x = peek();
    if (!x || stopped()) return false;
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
      } else if (is('word', 'mod') && !callsWithComma(1)) {
        // infix "a mod b": usual multiplicative precedence — say so, it's ambiguous on paper
        k++;
        warnings.add('Infix “mod” was read with normal precedence (like ×). If you meant the whole sum mod n, write mod(a, n).');
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
      if (w === timeVar) return { k: 'var', name: timeAs };
      if (w.length > 1 || FUNCTION_NAMES.has(w)) {
        // e.g. "floor(x/2)", "frac 4x", "\operatorname{mod}(a, b)"
        return fn(w);
      }
      // subscripts like a_1 are part of the name
      let name = w;
      if (sym('_')) {
        k++;
        const sub = peek();
        if (sub && (sub.t === 'num' || sub.t === 'word')) {
          k++;
          name += String(sub.v);
        } else if (sym('{')) {
          k++;
          while (!sym('}') && peek()) name += String((toks[k++] as { v: unknown }).v);
          expect('}');
        }
      }
      warnings.add(`“${name}” isn't the time variable — it was set to 0. Replace it with a number, or rename your time variable to ${timeVar}.`);
      return { k: 'num', v: 0 };
    }
    throw new ImportError(`Unexpected “${(x as { v: unknown }).v}”`);
  }

  if (!toks.length) throw new ImportError('Paste a function first');
  const ast = expr();
  if (k < toks.length) throw new ImportError(`Couldn't read past “${(toks[k] as { v: unknown }).v}”`);

  const value = simplify(replaceUndef(ast));
  const gate = simplify(definedness(ast));
  return {
    raw: simplify(ast),
    value,
    gate: gate.k === 'num' && gate.v === 1 ? null : gate,
    warnings: [...warnings],
  };
}

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
