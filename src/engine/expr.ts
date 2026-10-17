// A tiny, safe math expression language compiled to JS closures.
// Supports: numbers, variables, + - * / % ^, comparisons, && || !, ternary,
// function calls, and implicit multiplication ("2pi", "3(x+1)").

export type Scope = Record<string, number>;
export type Compiled = (scope: Scope) => number;

export class ExprError extends Error {
  constructor(message: string, public pos: number) {
    super(message);
  }
}

// ---------- function library ----------

const fibCache: number[] = [0, 1];
function fib(n: number): number {
  n = Math.max(0, Math.floor(n));
  if (n > 1476) return Infinity;
  for (let i = fibCache.length; i <= n; i++) fibCache[i] = fibCache[i - 1] + fibCache[i - 2];
  return fibCache[n];
}

const primes: number[] = [2];
function prime(n: number): number {
  n = Math.max(0, Math.min(100000, Math.floor(n)));
  let c = primes[primes.length - 1] + 1;
  while (primes.length <= n) {
    if (isPrime(c)) primes.push(c);
    c++;
  }
  return primes[n];
}
function isPrime(n: number): number {
  n = Math.floor(n);
  if (n < 2) return 0;
  if (n % 2 === 0) return n === 2 ? 1 : 0;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return 0;
  return 1;
}

function collatz(n: number): number {
  // number of steps to reach 1
  n = Math.max(1, Math.floor(n));
  let s = 0;
  while (n !== 1 && s < 1000) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1;
    s++;
  }
  return s;
}

function logistic(r: number, n: number, x0 = 0.5): number {
  let x = x0;
  const k = Math.min(10000, Math.max(0, Math.floor(n)));
  for (let i = 0; i < k; i++) x = r * x * (1 - x);
  return x;
}

const recamanCache: number[] = [0];
const recamanSeen = new Set<number>([0]);
function recaman(n: number): number {
  n = Math.max(0, Math.min(100000, Math.floor(n)));
  for (let i = recamanCache.length; i <= n; i++) {
    const prev = recamanCache[i - 1];
    const next = prev - i > 0 && !recamanSeen.has(prev - i) ? prev - i : prev + i;
    recamanCache.push(next);
    recamanSeen.add(next);
  }
  return recamanCache[n];
}

// Lorenz attractor, integrated with a fixed step; x component, roughly -1..1
const lorenzCache: number[] = [];
let lorenzState: [number, number, number] | null = null;
function lorenz(n: number): number {
  n = Math.max(0, Math.min(20000, Math.floor(n)));
  if (!lorenzState) {
    lorenzState = [0.1, 0, 0];
    for (let i = 0; i < 400; i++) lorenzState = lorenzStep(...lorenzState); // settle onto the attractor
  }
  while (lorenzCache.length <= n) {
    for (let i = 0; i < 8; i++) lorenzState = lorenzStep(...lorenzState);
    lorenzCache.push(lorenzState[0] / 20);
  }
  return lorenzCache[n];
}
function lorenzStep(x: number, y: number, z: number): [number, number, number] {
  const dt = 0.005;
  return [x + dt * 10 * (y - x), y + dt * (x * (28 - z) - y), z + dt * (x * y - (8 / 3) * z)];
}

/** Euclidean rhythm: 1 if step n is a hit when spreading `pulses` over `steps`. */
export function euclid(n: number, pulses: number, steps: number, rotate = 0): number {
  steps = Math.max(1, Math.floor(steps));
  pulses = Math.max(0, Math.min(steps, Math.floor(pulses)));
  const i = (((Math.floor(n) + Math.floor(rotate)) % steps) + steps) % steps;
  return Math.floor((i * pulses) / steps) !== Math.floor(((i - 1) * pulses) / steps) ? 1 : 0;
}

// deterministic hash in [0,1)
function hash(n: number, seed = 0): number {
  let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(seed) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// smooth 1D value noise in [0,1)
function noise(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

const fract = (x: number) => x - Math.floor(x);
const mod = (a: number, b: number) => (b === 0 ? 0 : ((a % b) + b) % b);

export const FUNCTIONS: Record<string, { fn: (...a: number[]) => number; doc: string }> = {
  sin: { fn: Math.sin, doc: 'sine' },
  cos: { fn: Math.cos, doc: 'cosine' },
  tan: { fn: Math.tan, doc: 'tangent' },
  asin: { fn: Math.asin, doc: 'arc sine' },
  acos: { fn: Math.acos, doc: 'arc cosine' },
  atan: { fn: Math.atan, doc: 'arc tangent' },
  atan2: { fn: Math.atan2, doc: 'atan2(y, x)' },
  sinh: { fn: Math.sinh, doc: 'hyperbolic sine' },
  tanh: { fn: Math.tanh, doc: 'hyperbolic tangent' },
  abs: { fn: Math.abs, doc: 'absolute value' },
  sign: { fn: Math.sign, doc: '-1, 0 or 1' },
  floor: { fn: Math.floor, doc: 'round down' },
  ceil: { fn: Math.ceil, doc: 'round up' },
  round: { fn: Math.round, doc: 'round to nearest' },
  fract: { fn: fract, doc: 'fractional part' },
  sqrt: { fn: Math.sqrt, doc: 'square root' },
  exp: { fn: Math.exp, doc: 'e^x' },
  log: { fn: Math.log, doc: 'natural log' },
  log2: { fn: Math.log2, doc: 'log base 2' },
  pow: { fn: Math.pow, doc: 'pow(a, b)' },
  min: { fn: Math.min, doc: 'minimum' },
  max: { fn: Math.max, doc: 'maximum' },
  mod: { fn: mod, doc: 'positive modulo' },
  clamp: { fn: (x, a = 0, b = 1) => Math.min(Math.max(x, a), b), doc: 'clamp(x, lo, hi)' },
  lerp: { fn: (a, b, t) => a + (b - a) * t, doc: 'lerp(a, b, t)' },
  step: { fn: (edge, x) => (x < edge ? 0 : 1), doc: 'step(edge, x)' },
  smoothstep: {
    fn: (a, b, x) => {
      const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
      return t * t * (3 - 2 * t);
    },
    doc: 'smoothstep(a, b, x)',
  },
  // periodic waves, period 1, range -1..1
  sine: { fn: (x) => Math.sin(2 * Math.PI * x), doc: 'sine wave, period 1' },
  tri: { fn: (x) => 1 - 4 * Math.abs(fract(x - 0.25) - 0.5), doc: 'triangle wave, period 1' },
  saw: { fn: (x) => 2 * fract(x) - 1, doc: 'sawtooth wave, period 1' },
  sqr: { fn: (x) => (fract(x) < 0.5 ? 1 : -1), doc: 'square wave, period 1' },
  // sequences & chaos
  fib: { fn: fib, doc: 'nth Fibonacci number' },
  prime: { fn: prime, doc: 'nth prime (0 → 2)' },
  isprime: { fn: isPrime, doc: '1 if prime else 0' },
  collatz: { fn: collatz, doc: 'Collatz stopping time' },
  logistic: { fn: logistic, doc: 'logistic(r, n) map' },
  digits: {
    fn: (x, n) => {
      // nth decimal digit of x
      const s = Math.abs(x).toFixed(15).replace('.', '');
      return Number(s[Math.max(0, Math.floor(n))] ?? 0);
    },
    doc: 'digits(x, n) nth digit',
  },
  recaman: { fn: recaman, doc: 'Recamán sequence' },
  lorenz: { fn: lorenz, doc: 'Lorenz attractor x, ≈ −1..1' },
  euclid: { fn: (n, k, s, r = 0) => euclid(n, k, s, r), doc: 'euclid(n, pulses, steps, rot) → 0/1' },
  bits: {
    fn: (mask, n, len = 16) => {
      // read a rhythm written as binary, left to right: bits(0b1000100010001000, n)
      len = Math.max(1, Math.min(52, Math.floor(len)));
      const i = mod(Math.floor(n), len);
      return Math.floor(mask / Math.pow(2, len - 1 - i)) % 2;
    },
    doc: 'bits(0b1001…, n, len) rhythm from binary',
  },
  bit: { fn: (x, i) => Math.floor(Math.abs(x) / Math.pow(2, Math.floor(i))) % 2, doc: 'bit(x, i) ith bit' },
  band: { fn: (a, b) => ((Math.floor(a) & Math.floor(b)) >>> 0), doc: 'bitwise and' },
  bor: { fn: (a, b) => ((Math.floor(a) | Math.floor(b)) >>> 0), doc: 'bitwise or' },
  bxor: { fn: (a, b) => ((Math.floor(a) ^ Math.floor(b)) >>> 0), doc: 'bitwise xor' },
  pick: {
    fn: (i, ...vals) => (vals.length ? vals[mod(Math.floor(i), vals.length)] : 0),
    doc: 'pick(i, a, b, c…) choose by index',
  },
  every: { fn: (n, m, off = 0) => (mod(Math.floor(n) - Math.floor(off), Math.max(1, Math.floor(m))) === 0 ? 1 : 0), doc: 'every(n, m, offset) → 1 every m steps' },
  chance: { fn: (n, p, seed = 0) => (hash(n, seed) < p ? 1 : 0), doc: 'chance(n, p, seed) → 1 with probability p' },
  phase: { fn: (n, len) => (len ? mod(n, len) / len : 0), doc: 'phase(n, len) 0→1 ramp every len steps' },
  decay: { fn: (n, len, rate = 4) => Math.exp(-rate * (len ? mod(n, len) / len : 0)), doc: 'decay(n, len, rate) falling envelope' },
  quant: { fn: (v, s) => (s ? Math.round(v / s) * s : v), doc: 'quant(v, step) snap to a grid' },
  wrap: { fn: (v, lo, hi) => (hi === lo ? lo : lo + mod(v - lo, hi - lo)), doc: 'wrap(v, lo, hi) wrap into range' },
  fold: {
    fn: (v, lo, hi) => {
      const span = hi - lo;
      if (span <= 0) return lo;
      const u = mod(v - lo, 2 * span);
      return lo + (u > span ? 2 * span - u : u);
    },
    doc: 'fold(v, lo, hi) bounce inside range',
  },
  rand: { fn: hash, doc: 'rand(n, seed) deterministic 0..1' },
  noise: { fn: noise, doc: 'noise(x, seed) smooth 0..1' },
  gcd: {
    fn: (a, b) => {
      a = Math.abs(Math.floor(a));
      b = Math.abs(Math.floor(b));
      while (b) [a, b] = [b, a % b];
      return a;
    },
    doc: 'greatest common divisor',
  },
};

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
  phi: (1 + Math.sqrt(5)) / 2,
};

// ---------- tokenizer ----------

/** p = position in the source, n = length — lets the randomizer rewrite formulas in place */
export type Tok =
  | { t: 'num'; v: number; p: number; n: number }
  | { t: 'id'; v: string; p: number; n: number }
  | { t: 'op'; v: string; p: number; n: number }
  | { t: 'eof'; p: number; n: number };

const OPS = ['<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '^', '(', ')', ',', '<', '>', '!', '?', ':'];

export function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '0' && /[xXbB]/.test(src[i + 1] ?? '')) {
      const m = /^0([xX][0-9a-fA-F]+|[bB][01]+)/.exec(src.slice(i));
      if (!m) throw new ExprError(`Bad number`, i);
      out.push({ t: 'num', v: parseInt(m[1].slice(1), /[xX]/.test(m[1][0]) ? 16 : 2), p: i, n: m[0].length });
      i += m[0].length;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new ExprError(`Bad number`, i);
      out.push({ t: 'num', v: parseFloat(m[0]), p: i, n: m[0].length });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0], p: i, n: m[0].length });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ExprError(`Unexpected '${c}'`, i);
    out.push({ t: 'op', v: op, p: i, n: op.length });
    i += op.length;
  }
  out.push({ t: 'eof', p: src.length, n: 0 });
  return out;
}

// ---------- parser → closures ----------

export interface CompileResult {
  fn: Compiled;
  variables: string[];
}

export function compile(src: string, allowedVars?: readonly string[]): CompileResult {
  const toks = tokenize(src);
  let k = 0;
  const vars = new Set<string>();
  const peek = () => toks[k];
  const isOp = (v: string) => {
    const t = toks[k];
    return t.t === 'op' && t.v === v;
  };
  const expect = (v: string) => {
    if (!isOp(v)) throw new ExprError(`Expected '${v}'`, toks[k].p);
    k++;
  };

  function expr(): Compiled {
    const c = or();
    if (isOp('?')) {
      k++;
      const a = expr();
      expect(':');
      const b = expr();
      return (s) => (c(s) ? a(s) : b(s));
    }
    return c;
  }
  function or(): Compiled {
    let l = and();
    while (isOp('||')) {
      k++;
      const a = l, b = and();
      l = (s) => (a(s) || b(s) ? 1 : 0);
    }
    return l;
  }
  function and(): Compiled {
    let l = cmp();
    while (isOp('&&')) {
      k++;
      const a = l, b = cmp();
      l = (s) => (a(s) && b(s) ? 1 : 0);
    }
    return l;
  }
  function cmp(): Compiled {
    let l = add();
    for (;;) {
      const t = peek();
      if (t.t !== 'op' || !['<', '>', '<=', '>=', '==', '!='].includes(t.v)) return l;
      k++;
      const a = l, b = add();
      switch (t.v) {
        case '<': l = (s) => +(a(s) < b(s)); break;
        case '>': l = (s) => +(a(s) > b(s)); break;
        case '<=': l = (s) => +(a(s) <= b(s)); break;
        case '>=': l = (s) => +(a(s) >= b(s)); break;
        case '==': l = (s) => +(a(s) === b(s)); break;
        default: l = (s) => +(a(s) !== b(s));
      }
    }
  }
  function add(): Compiled {
    let l = mul();
    while (isOp('+') || isOp('-')) {
      const op = (toks[k++] as { v: string }).v;
      const a = l, b = mul();
      l = op === '+' ? (s) => a(s) + b(s) : (s) => a(s) - b(s);
    }
    return l;
  }
  function mul(): Compiled {
    let l = unary();
    for (;;) {
      if (isOp('*') || isOp('/') || isOp('%')) {
        const op = (toks[k++] as { v: string }).v;
        const a = l, b = unary();
        l = op === '*' ? (s) => a(s) * b(s) : op === '/' ? (s) => a(s) / b(s) : (s) => mod(a(s), b(s));
        continue;
      }
      // implicit multiplication: "2x", "2(x)", "(a)(b)", "x y" is not allowed
      const t = peek();
      const prev = toks[k - 1];
      const prevEndsValue = prev && (prev.t === 'num' || (prev.t === 'op' && prev.v === ')'));
      if (prevEndsValue && (t.t === 'id' || (t.t === 'op' && t.v === '('))) {
        const a = l, b = unary();
        l = (s) => a(s) * b(s);
        continue;
      }
      return l;
    }
  }
  function unary(): Compiled {
    if (isOp('-')) {
      k++;
      const a = unary();
      return (s) => -a(s);
    }
    if (isOp('+')) {
      k++;
      return unary();
    }
    if (isOp('!')) {
      k++;
      const a = unary();
      return (s) => +!a(s);
    }
    return power();
  }
  function power(): Compiled {
    const base = atom();
    if (isOp('^')) {
      k++;
      const ex = unary();
      return (s) => Math.pow(base(s), ex(s));
    }
    return base;
  }
  function atom(): Compiled {
    const t = peek();
    if (t.t === 'num') {
      k++;
      const v = t.v;
      return () => v;
    }
    if (t.t === 'op' && t.v === '(') {
      k++;
      const e = expr();
      expect(')');
      return e;
    }
    if (t.t === 'id') {
      k++;
      const name = t.v;
      if (isOp('(')) {
        k++;
        const f = FUNCTIONS[name];
        if (!f) throw new ExprError(`Unknown function '${name}'`, t.p);
        const args: Compiled[] = [];
        if (!isOp(')')) {
          args.push(expr());
          while (isOp(',')) {
            k++;
            args.push(expr());
          }
        }
        expect(')');
        const fn = f.fn;
        switch (args.length) {
          case 0: return () => fn();
          case 1: { const [a] = args; return (s) => fn(a(s)); }
          case 2: { const [a, b] = args; return (s) => fn(a(s), b(s)); }
          case 3: { const [a, b, c] = args; return (s) => fn(a(s), b(s), c(s)); }
          default: return (s) => fn(...args.map((a) => a(s)));
        }
      }
      if (name in CONSTANTS) {
        const v = CONSTANTS[name];
        return () => v;
      }
      if (allowedVars && !allowedVars.includes(name)) {
        throw new ExprError(`Unknown variable '${name}'`, t.p);
      }
      vars.add(name);
      return (s) => s[name] ?? 0;
    }
    if (t.t === 'eof') throw new ExprError('Unexpected end of formula', t.p);
    throw new ExprError(`Unexpected '${t.v}'`, t.p);
  }

  if (toks.length === 1) throw new ExprError('Empty formula', 0);
  const fn = expr();
  if (peek().t !== 'eof') throw new ExprError(`Unexpected '${(peek() as { v: string }).v}'`, peek().p);
  return { fn, variables: [...vars] };
}

export function tryCompile(src: string, allowedVars?: readonly string[]): { fn: Compiled | null; error: string | null } {
  try {
    return { fn: compile(src, allowedVars).fn, error: null };
  } catch (e) {
    return { fn: null, error: e instanceof Error ? e.message : String(e) };
  }
}
