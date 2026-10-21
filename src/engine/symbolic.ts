/**
 * Turn a track's node graph into closed-form math: one expression per Note Out
 * input, with shared sub-results pulled out as named bindings. The same tree
 * prints as SoundFunc formulas, LaTeX, JavaScript and Python.
 */
import { compileAst, parse, type Ast, type BinOp } from './expr';
import { COMPARE_OPS, NODE_DEFS, parseList, parsePattern, sectionLengths, type GNode, type Graph } from './graph';
import { NOTE_NAMES, PITCH_MODES, SCALES } from './music';
import { BEATS_PER_BAR, isDrum, scaleLength, voiceLabel, type Song, type Track } from './project';

// ---------- tree helpers ----------

const num = (v: number): Ast => ({ k: 'num', v });
const v = (name: string): Ast => ({ k: 'var', name });
const call = (fn: string, ...args: Ast[]): Ast => ({ k: 'call', fn, args });
const bin = (op: BinOp, a: Ast, b: Ast): Ast => ({ k: 'bin', op, a, b });
const n = (x: unknown, d = 0) => (typeof x === 'number' && isFinite(x) ? x : Number(x) || d);

export function substitute(ast: Ast, map: Record<string, Ast>): Ast {
  switch (ast.k) {
    case 'var':
      return map[ast.name] ?? ast;
    case 'neg':
    case 'not':
      return { ...ast, a: substitute(ast.a, map) };
    case 'bin':
      return { ...ast, a: substitute(ast.a, map), b: substitute(ast.b, map) };
    case 'cond':
      return { ...ast, c: substitute(ast.c, map), a: substitute(ast.a, map), b: substitute(ast.b, map) };
    case 'call':
      return { ...ast, args: ast.args.map((x) => substitute(x, map)) };
    default:
      return ast;
  }
}

export function varsOf(ast: Ast, out = new Set<string>()): Set<string> {
  switch (ast.k) {
    case 'var':
      out.add(ast.name);
      break;
    case 'neg':
    case 'not':
      varsOf(ast.a, out);
      break;
    case 'bin':
      varsOf(ast.a, out), varsOf(ast.b, out);
      break;
    case 'cond':
      varsOf(ast.c, out), varsOf(ast.a, out), varsOf(ast.b, out);
      break;
    case 'call':
      ast.args.forEach((a) => varsOf(a, out));
      break;
  }
  return out;
}

export function functionsOf(ast: Ast, out = new Set<string>()): Set<string> {
  switch (ast.k) {
    case 'neg':
    case 'not':
      functionsOf(ast.a, out);
      break;
    case 'bin':
      if (ast.op === '%') out.add('mod');
      if (ast.op === '/') out.add('div');
      functionsOf(ast.a, out), functionsOf(ast.b, out);
      break;
    case 'cond':
      functionsOf(ast.c, out), functionsOf(ast.a, out), functionsOf(ast.b, out);
      break;
    case 'call':
      out.add(ast.fn);
      ast.args.forEach((a) => functionsOf(a, out));
      break;
  }
  return out;
}

/** the value of a plain number literal (hex/binary literals are kept as written), else null */
const numVal = (a: Ast): number | null => (a.k === 'num' && !a.raw ? a.v : null);
const isNum = (a: Ast, val?: number): boolean => {
  const x = numVal(a);
  return x !== null && (val === undefined || x === val);
};

/** constant folding + algebraic identities, bottom-up */
export function simplify(ast: Ast): Ast {
  switch (ast.k) {
    case 'neg': {
      const a = simplify(ast.a);
      if (isNum(a)) return num(-numVal(a)!);
      if (a.k === 'neg') return a.a;
      return { k: 'neg', a };
    }
    case 'not':
      return { k: 'not', a: simplify(ast.a) };
    case 'cond': {
      const c = simplify(ast.c), a = simplify(ast.a), b = simplify(ast.b);
      if (isNum(c)) return numVal(c) ? a : b;
      return { k: 'cond', c, a, b };
    }
    case 'call': {
      const args = ast.args.map(simplify);
      const out: Ast = { k: 'call', fn: ast.fn, args };
      return args.every((x) => isNum(x)) ? fold(out) : out;
    }
    case 'bin': {
      const a = simplify(ast.a), b = simplify(ast.b);
      if (isNum(a) && isNum(b)) return fold(bin(ast.op, a, b));
      switch (ast.op) {
        case '+':
          if (isNum(a, 0)) return b;
          if (isNum(b, 0)) return a;
          if (isNum(b) && numVal(b)! < 0) return bin('-', a, num(-numVal(b)!));
          if (b.k === 'neg') return bin('-', a, b.a);
          break;
        case '-':
          if (isNum(b, 0)) return a;
          if (isNum(a, 0)) return simplify({ k: 'neg', a: b });
          if (isNum(b) && numVal(b)! < 0) return bin('+', a, num(-numVal(b)!));
          break;
        case '*':
          if (isNum(a, 1)) return b;
          if (isNum(b, 1)) return a;
          if (isNum(a, 0) || isNum(b, 0)) return num(0);
          // numbers go first: x·3 → 3x
          if (isNum(b) && !isNum(a)) return bin('*', b, a);
          break;
        case '/':
          if (isNum(b, 1)) return a;
          if (isNum(a, 0)) return num(0);
          break;
        case '^':
          if (isNum(b, 1)) return a;
          if (isNum(b, 0)) return num(1);
          break;
      }
      return bin(ast.op, a, b);
    }
    default:
      return ast;
  }
}

function fold(ast: Ast): Ast {
  const val = compileAst(ast)({});
  return Number.isFinite(val) ? num(Math.round(val * 1e10) / 1e10) : ast;
}

// ---------- graph → expressions ----------

const PREFIX: Record<string, string> = {
  expr: 'f', math: 'm', func: 'g', compare: 'q', switch: 'i', map: 'r', wave: 'w', series: 's', euclid: 'E', chance: 'C', pattern: 'P', list: 'v', sections: 'S',
};

/** symbolic value of an unconnected input */
export function fallback(type: string, port: string, data: GNode['data']): Ast {
  switch (`${type}.${port}`) {
    case 'wave.p':
    case 'func.x':
      return v('x');
    case 'series.n':
    case 'euclid.n':
    case 'pattern.n':
    case 'list.n':
      return v('n');
    case 'chance.n':
      return bin('+', v('n'), bin('*', v('k'), v('steps')));
    case 'math.b':
      return num(n(data.b, 1));
    case 'compare.b':
      return num(n(data.b, 0));
    case 'switch.then':
      return num(n(data.then, 1));
    case 'switch.else':
      return num(n(data.else, 0));
    case 'output.velocity':
      return num(0.8);
    case 'output.length':
    case 'output.ratchet':
    case 'output.chord':
      return num(1);
    case 'output.stack':
      return num(2);
    default:
      return num(0);
  }
}

const SERIES_AST: Record<string, (x: Ast, p: number) => Ast> = {
  fib: (x) => call('fib', x),
  prime: (x) => call('prime', x),
  collatz: (x) => call('collatz', bin('+', x, num(1))),
  logistic: (x, p) => call('logistic', num(p || 3.7), x),
  pi: (x) => call('pidigit', x),
  phi: (x) => call('fract', bin('*', x, { k: 'const', name: 'phi' })),
  random: (x, p) => call('rand', x, num(p)),
  thue: (x) => call('thue', x),
  triangular: (x) => bin('/', bin('*', x, bin('+', x, num(1))), num(2)),
  recaman: (x) => call('recaman', x),
  lorenz: (x) => call('lorenz', x),
  sierpinski: (x, p) => bin('==', call('band', x, num(p || 7)), num(0)),
};

/** the expression a node computes for one of its outputs, given its inputs */
export function nodeAst(node: GNode, handle: string, ins: Ast[]): Ast {
  const d = node.data;
  switch (node.type) {
    case 'step':
      return v(handle);
    case 'number':
      return num(n(d.value));
    case 'expr': {
      try {
        const { ast } = parse(String(d.formula ?? '0'));
        return substitute(ast, { a: ins[0], b: ins[1], c: ins[2] });
      } catch {
        return num(0);
      }
    }
    case 'math': {
      const [a, b] = ins;
      switch (String(d.op)) {
        case 'sub': return bin('-', a, b);
        case 'mul': return bin('*', a, b);
        case 'div': return bin('/', a, b);
        case 'mod': return bin('%', a, b);
        case 'pow': return bin('^', a, b);
        case 'min': return call('min', a, b);
        case 'max': return call('max', a, b);
        case 'mix': return bin('/', bin('+', a, b), num(2));
        default: return bin('+', a, b);
      }
    }
    case 'func':
      return call(String(d.fn ?? 'abs'), ins[0]);
    case 'compare':
      return bin((COMPARE_OPS[String(d.op)] ? String(d.op) : '<') as BinOp, ins[0], ins[1]);
    case 'switch':
      return { k: 'cond', c: ins[0], a: ins[1], b: ins[2] };
    case 'map': {
      const a = n(d.inMin), b = n(d.inMax, 1), c = n(d.outMin), e = n(d.outMax, 1);
      let u: Ast = bin('/', bin('-', ins[0], num(a)), num(b - a));
      if (d.clamp !== false) u = call('clamp', u, num(0), num(1));
      return bin('+', num(c), bin('*', num(e - c), u));
    }
    case 'wave': {
      const shape = { sine: 'sine', triangle: 'tri', saw: 'saw', square: 'sqr' }[String(d.shape)] ?? 'sine';
      return bin('+', num(n(d.offset)), bin('*', num(n(d.amp, 1)), call(shape, bin('*', num(n(d.cycles, 1)), ins[0]))));
    }
    case 'series': {
      const s = (SERIES_AST[String(d.kind)] ?? SERIES_AST.fib)(ins[0], n(d.p));
      const m = n(d.modulo);
      return m > 0 ? bin('%', s, num(m)) : s;
    }
    case 'euclid':
      return call('euclid', ins[0], num(n(d.pulses, 3)), num(n(d.length, 8)), num(n(d.rotate)));
    case 'chance':
      return call('chance', ins[0], num(n(d.p, 0.5)), num(n(d.seed)));
    case 'pattern': {
      const vals = parsePattern(String(d.pattern ?? ''));
      return vals.length ? call('pick', bin('+', ins[0], num(n(d.rotate))), ...vals.map((x) => num(Math.round(x * 1000) / 1000))) : num(0);
    }
    case 'sections': {
      // piecewise over the song: position p = beat mod total, then the first section whose end is past p
      const lens = sectionLengths(d);
      const total = lens.reduce((a, b) => a + b, 0);
      if (!total) return handle === 'out' ? ins[0] : num(0);
      const pos: Ast = bin('%', v('beat'), num(total));
      return frontToBack(lens, pos, handle, ins);
    }
    case 'list': {
      const vals = parseList(String(d.values ?? ''));
      return vals.length ? call('pick', call('floor', bin('/', ins[0], num(Math.max(1, n(d.every, 1))))), ...vals.map(num)) : num(0);
    }
    default:
      return num(0);
  }
}

/** p < L₀ ? A : p < L₀+L₁ ? B : … — how a person would write the Sections node */
function frontToBack(lens: number[], pos: Ast, handle: string, ins: Ast[]): Ast {
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  const valueOf = (i: number): Ast =>
    handle === 'section' ? num(i) : handle === 'local' ? bin('/', bin('-', pos, num(starts[i])), num(lens[i])) : ins[i % 4];
  let out = valueOf(lens.length - 1);
  for (let i = lens.length - 2; i >= 0; i--) out = { k: 'cond', c: bin('<', pos, num(starts[i] + lens[i])), a: valueOf(i), b: out };
  return out;
}

export interface Binding {
  name: string;
  /** what the node was, e.g. "Wave" */
  label: string;
  ast: Ast;
}

export interface TrackMath {
  outputs: { port: string; ast: Ast }[];
  bindings: Binding[];
  /** every variable the expressions read: n, x, t, k, h, bar, L, steps */
  vars: Set<string>;
  hasOutput: boolean;
}

/** Inputs of Note Out worth showing: the core three, plus anything wired. */
const CORE_PORTS = ['pitch', 'velocity', 'length'];

export function trackMath(graph: Graph, opts: { inline?: boolean } = {}): TrackMath {
  const byId = new Map(graph.nodes.map((x) => [x.id, x]));
  const out = graph.nodes.find((x) => x.type === 'output');
  if (!out) return { outputs: [], bindings: [], vars: new Set(), hasOutput: false };

  // how many times each (node, handle) is consumed by the part of the graph that reaches the output
  const reach = new Set<string>();
  const stack = [out.id];
  while (stack.length) {
    const id = stack.pop()!;
    if (reach.has(id)) continue;
    reach.add(id);
    for (const e of graph.edges) if (e.target === id && byId.has(e.source)) stack.push(e.source);
  }
  const uses = new Map<string, number>();
  for (const e of graph.edges) if (reach.has(e.target)) uses.set(`${e.source}.${e.sourceHandle}`, (uses.get(`${e.source}.${e.sourceHandle}`) ?? 0) + 1);

  const bindings: Binding[] = [];
  const bound = new Map<string, string>();
  const counters: Record<string, number> = {};
  const visiting = new Set<string>();

  const valueOf = (nodeId: string, handle: string): Ast => {
    const node = byId.get(nodeId)!;
    const key = `${nodeId}.${handle}`;
    if (bound.has(key)) return v(bound.get(key)!);
    if (visiting.has(nodeId)) return num(0); // cycle
    visiting.add(nodeId);
    const def = NODE_DEFS[node.type];
    const ins = (def?.inputs ?? []).map((p) => {
      const e = graph.edges.find((x) => x.target === nodeId && x.targetHandle === p.id && byId.has(x.source));
      return e ? valueOf(e.source, String(e.sourceHandle ?? 'out')) : fallback(node.type, p.id, node.data);
    });
    visiting.delete(nodeId);
    const ast = simplify(nodeAst(node, handle, ins));
    const trivial = ast.k === 'num' || ast.k === 'var' || ast.k === 'const';
    if (!opts.inline && !trivial && (uses.get(key) ?? 0) > 1 && PREFIX[node.type]) {
      const prefix = PREFIX[node.type];
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      const name = `${prefix}${counters[prefix]}`;
      bindings.push({ name, label: def?.label ?? node.type, ast });
      bound.set(key, name);
      return v(name);
    }
    return ast;
  };

  const outDef = NODE_DEFS.output;
  const outputs = outDef.inputs
    .map((p) => {
      const e = graph.edges.find((x) => x.target === out.id && x.targetHandle === p.id && byId.has(x.source));
      if (!e && !CORE_PORTS.includes(p.id)) return null;
      return { port: p.id, ast: e ? valueOf(e.source, String(e.sourceHandle ?? 'out')) : fallback('output', p.id, out.data) };
    })
    .filter((x): x is { port: string; ast: Ast } => !!x);

  const vars = new Set<string>();
  for (const o of outputs) varsOf(o.ast, vars);
  for (const b of bindings) varsOf(b.ast, vars);
  for (const b of bindings) vars.delete(b.name);
  return { outputs, bindings, vars, hasOutput: true };
}

// ---------- printing: SoundFunc formula syntax ----------

const PREC: Record<string, number> = { '||': 2, '&&': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '==': 4, '!=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '^': 8 };

export function fmtNum(x: number): string {
  if (Number.isInteger(x)) return String(x);
  return String(Number(x.toFixed(4)));
}

function precOf(ast: Ast): number {
  switch (ast.k) {
    case 'num':
      return ast.v < 0 ? 7 : 9;
    case 'neg':
    case 'not':
      return 7;
    case 'bin':
      return PREC[ast.op];
    case 'cond':
      return 1;
    default:
      return 9;
  }
}

export function toSource(ast: Ast, min = 0): string {
  const wrap = (s: string) => (precOf(ast) < min ? `(${s})` : s);
  switch (ast.k) {
    case 'num':
      return wrap(ast.raw ?? fmtNum(ast.v));
    case 'var':
    case 'const':
      return ast.name;
    case 'neg': {
      const inner = toSource(ast.a, 7);
      return wrap(`-${inner.startsWith('-') ? `(${inner})` : inner}`);
    }
    case 'not':
      return wrap(`!${toSource(ast.a, 7)}`);
    case 'cond':
      return wrap(`${toSource(ast.c, 2)} ? ${toSource(ast.a, 1)} : ${toSource(ast.b, 1)}`);
    case 'call':
      return `${ast.fn}(${ast.args.map((a) => toSource(a)).join(', ')})`;
    case 'bin': {
      const p = PREC[ast.op];
      if (ast.op === '^') return wrap(`${toSource(ast.a, 9)}^${toSource(ast.b, 7)}`);
      return wrap(`${toSource(ast.a, p)} ${ast.op} ${toSource(ast.b, p + 1)}`);
    }
  }
}

// ---------- printing: LaTeX ----------

const TEX_VARS: Record<string, string> = { bar: '\\mathrm{bar}', steps: 'N', __undefined: '\\text{silence}' };
const TEX_CONST: Record<string, string> = { pi: '\\pi', tau: '\\tau', phi: '\\varphi', e: 'e' };
const TEX_FN: Record<string, string> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', sinh: '\\sinh', tanh: '\\tanh',
  log: '\\ln', log2: '\\log_2', min: '\\min', max: '\\max', gcd: '\\gcd',
};

const TEX_GREEK = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'rho', 'sigma', 'upsilon', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Sigma', 'Upsilon', 'Psi', 'Omega',
]);

function texName(name: string): string {
  if (TEX_VARS[name]) return TEX_VARS[name];
  // a name renamed to dodge a SoundFunc one (k → k_) shows as k′
  if (/^[A-Za-z]+_$/.test(name)) return `${texName(name.slice(0, -1))}'`;
  const sub = /^([A-Za-z]+)_([A-Za-z0-9]+)$/.exec(name);
  if (sub) return `${texName(sub[1])}_{${sub[2].length > 1 && !/^\d+$/.test(sub[2]) ? `\\mathrm{${sub[2]}}` : sub[2]}}`;
  if (TEX_GREEK.has(name)) return `\\${name}`;
  const m = /^([a-zA-Z]+)(\d+)$/.exec(name);
  if (m) return `${m[1]}_{${m[2]}}`;
  return name.length > 1 ? `\\mathit{${name}}` : name;
}

function texNum(a: { v: number; raw?: string }): string {
  if (a.raw) return `\\mathtt{${a.raw}}`;
  return fmtNum(a.v);
}

export function toTex(ast: Ast, min = 0): string {
  const wrap = (s: string) => (precOf(ast) < min ? `\\left(${s}\\right)` : s);
  switch (ast.k) {
    case 'num':
      return wrap(texNum(ast));
    case 'var':
      return texName(ast.name);
    case 'const':
      return TEX_CONST[ast.name] ?? ast.name;
    case 'neg':
      return wrap(`-${toTex(ast.a, 7)}`);
    case 'not':
      return wrap(`\\lnot ${toTex(ast.a, 7)}`);
    case 'cond':
      return `\\begin{cases} ${toTex(ast.a)} & \\text{if } ${toTex(ast.c)} \\\\ ${toTex(ast.b)} & \\text{otherwise} \\end{cases}`;
    case 'bin': {
      const p = PREC[ast.op];
      const a = ast.a, b = ast.b;
      switch (ast.op) {
        case '/':
          return `\\frac{${toTex(a)}}{${toTex(b)}}`;
        case '^':
          return `{${toTex(a, 9)}}^{${toTex(b)}}`;
        case '*': {
          // juxtapose a number with what follows: 3x, 2\sin(…); otherwise a centred dot
          const left = toTex(a, p), right = toTex(b, p + 1);
          const juxt = a.k === 'num' && !a.raw && (b.k === 'var' || b.k === 'const' || b.k === 'call' || precOf(b) < p);
          return wrap(juxt ? `${left}\\,${right}` : `${left} \\cdot ${right}`);
        }
        case '%':
          return wrap(`${toTex(a, p)} \\bmod ${toTex(b, p + 1)}`);
        default: {
          const op = { '<=': '\\le', '>=': '\\ge', '==': '=', '!=': '\\ne', '&&': '\\land', '||': '\\lor' }[ast.op as string] ?? ast.op;
          return wrap(`${toTex(a, p)} ${op} ${toTex(b, p + 1)}`);
        }
      }
    }
    case 'call': {
      const args = ast.args;
      const t = (i: number) => toTex(args[i] ?? num(0));
      switch (ast.fn) {
        case 'floor':
          return `\\left\\lfloor ${t(0)} \\right\\rfloor`;
        case 'ceil':
          return `\\left\\lceil ${t(0)} \\right\\rceil`;
        case 'round':
          return `\\left\\lfloor ${t(0)} \\right\\rceil`;
        case 'abs':
          return `\\left| ${t(0)} \\right|`;
        case 'sqrt':
          return `\\sqrt{${t(0)}}`;
        case 'exp':
          return `e^{${t(0)}}`;
        case 'pow':
          return `{${toTex(args[0], 9)}}^{${t(1)}}`;
        case 'mod':
          return wrap(`${toTex(args[0], 6)} \\bmod ${toTex(args[1], 7)}`);
        case 'fract':
          return `\\left\\{ ${t(0)} \\right\\}`;
        case 'pick':
          // a cyclic sequence indexed by the first argument
          return `\\left(${args.slice(1).map((a) => toTex(a)).join(',\\ ')}\\right)_{${t(0)}}`;
        case 'every':
          // Iverson bracket: 1 when the condition holds, else 0
          return `\\left[\\,${t(0)} \\equiv ${args[2] ? t(2) : '0'} \\pmod{${t(1)}}\\,\\right]`;
        default: {
          const f = TEX_FN[ast.fn] ?? `\\operatorname{${ast.fn}}`;
          return `${f}\\left(${args.map((a) => toTex(a)).join(',\\ ')}\\right)`;
        }
      }
    }
  }
}

// ---------- printing: JavaScript & Python ----------

type Lang = 'js' | 'py';

const MATH_JS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'tanh', 'abs', 'floor', 'ceil', 'round', 'sqrt', 'exp', 'log', 'log2', 'pow', 'min', 'max', 'sign']);
const MATH_PY: Record<string, string> = {
  sin: 'math.sin', cos: 'math.cos', tan: 'math.tan', asin: 'math.asin', acos: 'math.acos', atan: 'math.atan', atan2: 'math.atan2',
  sinh: 'math.sinh', tanh: 'math.tanh', floor: 'math.floor', ceil: 'math.ceil', sqrt: 'math.sqrt', exp: 'math.exp', log: 'math.log', log2: 'math.log2',
  abs: 'abs', min: 'min', max: 'max', round: 'jsround', sign: 'sign', pow: 'pow',
};

export function toCode(ast: Ast, lang: Lang, min = 0): string {
  const wrap = (s: string) => (precOf(ast) < min ? `(${s})` : s);
  const r = (a: Ast, m = 0) => toCode(a, lang, m);
  switch (ast.k) {
    case 'num':
      return wrap(ast.raw ?? fmtNum(ast.v));
    case 'var':
      return ast.name;
    case 'const':
      if (lang === 'js') return { pi: 'Math.PI', tau: '(2 * Math.PI)', e: 'Math.E', phi: 'PHI' }[ast.name] ?? ast.name;
      return { pi: 'math.pi', tau: 'math.tau', e: 'math.e', phi: 'PHI' }[ast.name] ?? ast.name;
    case 'neg': {
      const inner = r(ast.a, 7);
      return wrap(`-${inner.startsWith('-') ? `(${inner})` : inner}`);
    }
    case 'not':
      return lang === 'js' ? `(${r(ast.a, 7)} ? 0 : 1)` : `(0 if ${r(ast.a, 7)} else 1)`;
    case 'cond':
      return lang === 'js' ? wrap(`${r(ast.c, 2)} ? ${r(ast.a, 1)} : ${r(ast.b, 1)}`) : `(${r(ast.a)} if ${r(ast.c)} else ${r(ast.b)})`;
    case 'call': {
      const args = ast.args.map((a) => r(a)).join(', ');
      if (lang === 'js') return `${MATH_JS.has(ast.fn) ? `Math.${ast.fn}` : ast.fn}(${args})`;
      return `${MATH_PY[ast.fn] ?? ast.fn}(${args})`;
    }
    case 'bin': {
      const p = PREC[ast.op];
      const a = ast.a, b = ast.b;
      switch (ast.op) {
        case '%':
          return `mod(${r(a)}, ${r(b)})`;
        case '^':
          return lang === 'js' ? `Math.pow(${r(a)}, ${r(b)})` : wrap(`${r(a, 9)} ** ${r(b, 7)}`);
        case '/':
          // Python raises on division by zero; the engine treats it as silence
          if (lang === 'py' && !(b.k === 'num' && b.v !== 0)) return `div(${r(a)}, ${r(b)})`;
          return wrap(`${r(a, p)} / ${r(b, p + 1)}`);
        case '&&':
        case '||': {
          const op = lang === 'js' ? ast.op : ast.op === '&&' ? 'and' : 'or';
          return lang === 'js' ? `(${r(a, 3)} ${op} ${r(b, 3)} ? 1 : 0)` : `(1 if (${r(a)}) ${op} (${r(b)}) else 0)`;
        }
        case '<':
        case '>':
        case '<=':
        case '>=':
        case '==':
        case '!=': {
          // comparisons yield 1/0 so they can be used in arithmetic
          const op = lang === 'js' ? { '==': '===', '!=': '!==' }[ast.op as string] ?? ast.op : ast.op;
          return lang === 'js' ? `+(${r(a, 5)} ${op} ${r(b, 5)})` : `int(${r(a, 5)} ${op} ${r(b, 5)})`;
        }
        default:
          return wrap(`${r(a, p)} ${ast.op} ${r(b, p + 1)}`);
      }
    }
  }
}

// ---------- helper library for exported code ----------

const JS_HELPERS: Record<string, string> = {
  mod: 'function mod(a, b) { return b === 0 ? 0 : ((a % b) + b) % b; }',
  div: 'function div(a, b) { return b === 0 ? 0 : a / b; }',
  fract: 'function fract(x) { return x - Math.floor(x); }',
  clamp: 'function clamp(x, lo = 0, hi = 1) { return Math.min(Math.max(x, lo), hi); }',
  lerp: 'function lerp(a, b, t) { return a + (b - a) * t; }',
  step: 'function step(edge, x) { return x < edge ? 0 : 1; }',
  smoothstep: 'function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }',
  sine: 'function sine(x) { return Math.sin(2 * Math.PI * x); }',
  tri: 'function tri(x) { return 1 - 4 * Math.abs(fract(x - 0.25) - 0.5); }',
  saw: 'function saw(x) { return 2 * fract(x) - 1; }',
  sqr: 'function sqr(x) { return fract(x) < 0.5 ? 1 : -1; }',
  fib: 'function fib(n) { let a = 0, b = 1; for (let i = 0; i < Math.max(0, Math.floor(n)); i++) [a, b] = [b, a + b]; return a; }',
  isprime: 'function isprime(n) { n = Math.floor(n); if (n < 2) return 0; for (let i = 2; i * i <= n; i++) if (n % i === 0) return 0; return 1; }',
  prime: 'function prime(n) { let c = 1; for (let i = 0; i <= Math.max(0, Math.floor(n)); ) if (isprime(++c)) i++; return c; }',
  collatz: 'function collatz(n) { n = Math.max(1, Math.floor(n)); let s = 0; while (n !== 1 && s < 1000) { n = n % 2 === 0 ? n / 2 : 3 * n + 1; s++; } return s; }',
  logistic: 'function logistic(r, n, x = 0.5) { for (let i = 0; i < Math.min(10000, Math.max(0, Math.floor(n))); i++) x = r * x * (1 - x); return x; }',
  digits: 'function digits(x, n) { return Number(Math.abs(x).toFixed(15).replace(".", "")[Math.max(0, Math.floor(n))] ?? 0); }',
  pidigit: 'const PI_DIGITS = "' + '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679' + '";\nfunction pidigit(n) { return Number(PI_DIGITS[mod(Math.floor(n), PI_DIGITS.length)]); }',
  recaman: 'function recaman(n) { const seen = new Set([0]); let a = 0; for (let i = 1; i <= Math.floor(n); i++) { a = a - i > 0 && !seen.has(a - i) ? a - i : a + i; seen.add(a); } return a; }',
  lorenz:
    'function lorenz(n) {\n  let x = 0.1, y = 0, z = 0;\n  const step = () => { const dt = 0.005; [x, y, z] = [x + dt * 10 * (y - x), y + dt * (x * (28 - z) - y), z + dt * (x * y - (8 / 3) * z)]; };\n  for (let i = 0; i < 400 + 8 * (Math.max(0, Math.floor(n)) + 1); i++) step();\n  return x / 20;\n}',
  thue: 'function thue(n) { let c = 0; for (let v = Math.abs(Math.floor(n)); v; v >>>= 1) c += v & 1; return c % 2; }',
  euclid: 'function euclid(n, pulses, steps, rotate = 0) { steps = Math.max(1, Math.floor(steps)); pulses = Math.max(0, Math.min(steps, Math.floor(pulses))); const i = mod(Math.floor(n) + Math.floor(rotate), steps); return Math.floor((i * pulses) / steps) !== Math.floor(((i - 1) * pulses) / steps) ? 1 : 0; }',
  bits: 'function bits(mask, n, len = 16) { len = Math.max(1, Math.min(52, Math.floor(len))); return Math.floor(mask / Math.pow(2, len - 1 - mod(Math.floor(n), len))) % 2; }',
  bit: 'function bit(x, i) { return Math.floor(Math.abs(x) / Math.pow(2, Math.floor(i))) % 2; }',
  band: 'function band(a, b) { return (Math.floor(a) & Math.floor(b)) >>> 0; }',
  bor: 'function bor(a, b) { return (Math.floor(a) | Math.floor(b)) >>> 0; }',
  bxor: 'function bxor(a, b) { return (Math.floor(a) ^ Math.floor(b)) >>> 0; }',
  pick: 'function pick(i, ...vals) { return vals.length ? vals[mod(Math.floor(i), vals.length)] : 0; }',
  every: 'function every(n, m, off = 0) { return mod(Math.floor(n) - Math.floor(off), Math.max(1, Math.floor(m))) === 0 ? 1 : 0; }',
  chance: 'function chance(n, p, seed = 0) { return rand(n, seed) < p ? 1 : 0; }',
  phase: 'function phase(n, len) { return len ? mod(n, len) / len : 0; }',
  decay: 'function decay(n, len, rate = 4) { return Math.exp(-rate * (len ? mod(n, len) / len : 0)); }',
  quant: 'function quant(v, s) { return s ? Math.round(v / s) * s : v; }',
  wrap: 'function wrap(v, lo, hi) { return hi === lo ? lo : lo + mod(v - lo, hi - lo); }',
  fold: 'function fold(v, lo, hi) { const s = hi - lo; if (s <= 0) return lo; const u = mod(v - lo, 2 * s); return lo + (u > s ? 2 * s - u : u); }',
  rand:
    'function rand(n, seed = 0) {\n  let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(seed) + 0x632be5ab, 0xc2b2ae35);\n  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;\n  return (h >>> 0) / 4294967296;\n}',
  noise: 'function noise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return rand(i, seed) * (1 - u) + rand(i + 1, seed) * u; }',
  gcd: 'function gcd(a, b) { a = Math.abs(Math.floor(a)); b = Math.abs(Math.floor(b)); while (b) [a, b] = [b, a % b]; return a; }',
};

const PY_HELPERS: Record<string, string> = {
  mod: 'def mod(a, b):\n    return 0 if b == 0 else ((a % b) + b) % b',
  div: 'def div(a, b):\n    return 0 if b == 0 else a / b',
  jsround: 'def jsround(x):\n    return math.floor(x + 0.5)  # JavaScript rounding: halves go up',
  sign: 'def sign(x):\n    return (x > 0) - (x < 0)',
  fract: 'def fract(x):\n    return x - math.floor(x)',
  clamp: 'def clamp(x, lo=0, hi=1):\n    return min(max(x, lo), hi)',
  lerp: 'def lerp(a, b, t):\n    return a + (b - a) * t',
  step: 'def step(edge, x):\n    return 0 if x < edge else 1',
  smoothstep: 'def smoothstep(a, b, x):\n    t = clamp((x - a) / (b - a), 0, 1)\n    return t * t * (3 - 2 * t)',
  sine: 'def sine(x):\n    return math.sin(2 * math.pi * x)',
  tri: 'def tri(x):\n    return 1 - 4 * abs(fract(x - 0.25) - 0.5)',
  saw: 'def saw(x):\n    return 2 * fract(x) - 1',
  sqr: 'def sqr(x):\n    return 1 if fract(x) < 0.5 else -1',
  fib: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(max(0, math.floor(n))):\n        a, b = b, a + b\n    return a',
  isprime: 'def isprime(n):\n    n = math.floor(n)\n    if n < 2:\n        return 0\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return 0\n        i += 1\n    return 1',
  prime: 'def prime(n):\n    c, i = 1, 0\n    while i <= max(0, math.floor(n)):\n        c += 1\n        if isprime(c):\n            i += 1\n    return c',
  collatz: 'def collatz(n):\n    n, s = max(1, math.floor(n)), 0\n    while n != 1 and s < 1000:\n        n = n // 2 if n % 2 == 0 else 3 * n + 1\n        s += 1\n    return s',
  logistic: 'def logistic(r, n, x=0.5):\n    for _ in range(min(10000, max(0, math.floor(n)))):\n        x = r * x * (1 - x)\n    return x',
  digits: 'def digits(x, n):\n    s = f"{abs(x):.15f}".replace(".", "")\n    i = max(0, math.floor(n))\n    return int(s[i]) if i < len(s) else 0',
  pidigit: 'PI_DIGITS = "' + '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679' + '"\n\ndef pidigit(n):\n    return int(PI_DIGITS[mod(math.floor(n), len(PI_DIGITS))])',
  recaman: 'def recaman(n):\n    seen, a = {0}, 0\n    for i in range(1, math.floor(n) + 1):\n        a = a - i if a - i > 0 and a - i not in seen else a + i\n        seen.add(a)\n    return a',
  lorenz:
    'def lorenz(n):\n    x, y, z, dt = 0.1, 0.0, 0.0, 0.005\n    for _ in range(400 + 8 * (max(0, math.floor(n)) + 1)):\n        x, y, z = x + dt * 10 * (y - x), y + dt * (x * (28 - z) - y), z + dt * (x * y - (8 / 3) * z)\n    return x / 20',
  thue: 'def thue(n):\n    return bin(abs(math.floor(n))).count("1") % 2',
  euclid:
    'def euclid(n, pulses, steps, rotate=0):\n    steps = max(1, math.floor(steps))\n    pulses = max(0, min(steps, math.floor(pulses)))\n    i = mod(math.floor(n) + math.floor(rotate), steps)\n    return 1 if (i * pulses) // steps != ((i - 1) * pulses) // steps else 0',
  bits: 'def bits(mask, n, length=16):\n    length = max(1, min(52, math.floor(length)))\n    return math.floor(mask / 2 ** (length - 1 - mod(math.floor(n), length))) % 2',
  bit: 'def bit(x, i):\n    return math.floor(abs(x) / 2 ** math.floor(i)) % 2',
  band: 'def band(a, b):\n    return (math.floor(a) & math.floor(b)) & 0xFFFFFFFF',
  bor: 'def bor(a, b):\n    return (math.floor(a) | math.floor(b)) & 0xFFFFFFFF',
  bxor: 'def bxor(a, b):\n    return (math.floor(a) ^ math.floor(b)) & 0xFFFFFFFF',
  pick: 'def pick(i, *vals):\n    return vals[mod(math.floor(i), len(vals))] if vals else 0',
  every: 'def every(n, m, off=0):\n    return 1 if mod(math.floor(n) - math.floor(off), max(1, math.floor(m))) == 0 else 0',
  chance: 'def chance(n, p, seed=0):\n    return 1 if rand(n, seed) < p else 0',
  phase: 'def phase(n, length):\n    return mod(n, length) / length if length else 0',
  decay: 'def decay(n, length, rate=4):\n    return math.exp(-rate * (mod(n, length) / length if length else 0))',
  quant: 'def quant(v, s):\n    return jsround(v / s) * s if s else v',
  wrap: 'def wrap(v, lo, hi):\n    return lo if hi == lo else lo + mod(v - lo, hi - lo)',
  fold: 'def fold(v, lo, hi):\n    s = hi - lo\n    if s <= 0:\n        return lo\n    u = mod(v - lo, 2 * s)\n    return lo + (2 * s - u if u > s else u)',
  rand:
    'def _imul(a, b):\n    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF\n\ndef rand(n, seed=0):\n    """Deterministic hash → [0, 1); bit-for-bit the same as SoundFunc."""\n    h = _imul((math.floor(n) & 0xFFFFFFFF) ^ 0x9E3779B9, 0x85EBCA6B) ^ _imul((math.floor(seed) + 0x632BE5AB) & 0xFFFFFFFF, 0xC2B2AE35)\n    h ^= h >> 16\n    h = _imul(h, 0x7FEB352D)\n    h ^= h >> 15\n    h = _imul(h, 0x846CA68B)\n    h ^= h >> 16\n    return h / 4294967296',
  noise: 'def noise(x, seed=0):\n    i = math.floor(x)\n    f = x - i\n    u = f * f * (3 - 2 * f)\n    return rand(i, seed) * (1 - u) + rand(i + 1, seed) * u',
  gcd: 'def gcd(a, b):\n    return math.gcd(abs(math.floor(a)), abs(math.floor(b)))',
};

/** helpers that other helpers call */
const DEPS: Record<string, string[]> = {
  smoothstep: ['clamp'], tri: ['fract'], saw: ['fract'], sqr: ['fract'], prime: ['isprime'], pidigit: ['mod'], euclid: ['mod'],
  bits: ['mod'], pick: ['mod'], every: ['mod'], chance: ['rand'], phase: ['mod'], decay: ['mod'], wrap: ['mod'], fold: ['mod'],
  noise: ['rand'], quant: ['jsround'],
};

function helperClosure(fns: Set<string>, lang: Lang): string[] {
  const lib = lang === 'js' ? JS_HELPERS : PY_HELPERS;
  const out = new Set<string>();
  const add = (f: string) => {
    if (lang === 'py' && f === 'round') f = 'jsround';
    if (lang === 'py' && f === 'sign') f = 'sign';
    if (!lib[f] || out.has(f)) return;
    for (const d of DEPS[f] ?? []) add(d);
    out.add(f);
  };
  [...fns].sort().forEach(add);
  return [...out].map((f) => lib[f]);
}

// ---------- whole-track documents ----------

/** "Koto Strum" → kotoStrum (JavaScript) or koto_strum (Python) */
const ident = (s: string, lang: Lang) => {
  const words = s.normalize('NFKD').replace(/[^\w]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'track';
  const id =
    lang === 'py'
      ? words.map((w) => w.toLowerCase()).join('_')
      : words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1))).join('');
  return /^\d/.test(id) ? `_${id}` : id;
};

export interface Composed {
  track: Track;
  math: TrackMath;
}

export function compose(track: Track, inline = false): Composed {
  return { track, math: trackMath(track.graph, { inline }) };
}

function harmonyAst(song: Song): Ast {
  try {
    return simplify(parse(song.harmony || '0').ast);
  } catch {
    return num(0);
  }
}

/** beat = k · patternBeats + t */
function beatAst(track: Track): Ast {
  return simplify(bin('+', bin('*', num(track.steps * track.stepBeats), v('k')), v('t')));
}

/** bar = ⌊(k · patternBeats + t) / 4⌋ */
function barAst(track: Track): Ast {
  const len = track.steps * track.stepBeats;
  return simplify(call('floor', bin('/', bin('+', bin('*', num(len), v('k')), v('t')), num(BEATS_PER_BAR))));
}

export function describeTrack(track: Track, song: Song): string {
  const scale = SCALES[song.scale] ?? SCALES.major;
  if (isDrum(track.waveform)) return `${voiceLabel(track.waveform)} drum · pitch tunes the hit in semitones`;
  return `${NOTE_NAMES[song.root]} ${scale.label} · ${PITCH_MODES[track.pitchMode].toLowerCase()} · octave ${track.octave}${track.playMode === 'glide' ? ' · glide (continuous)' : ''}`;
}

/** LaTeX lines for one track: the outputs, the where-clause, then the clock and harmony. */
export function trackTex(c: Composed, song: Song): { label: string; tex: string }[] {
  const { track, math } = c;
  if (!math.hasOutput) return [{ label: 'no output', tex: '\\text{This track has no Note Out node.}' }];
  const args = math.vars.has('k') || math.vars.has('h') || math.vars.has('bar') ? 'n, k' : 'n';
  const lines = math.outputs.map((o) => ({ label: o.port, tex: `\\operatorname{${o.port}}(${args}) = ${toTex(o.ast)}` }));
  for (const b of math.bindings) lines.push({ label: `where · ${b.label}`, tex: `${texName(b.name)} = ${toTex(b.ast)}` });
  const vars = new Set(math.vars);
  for (const b of math.bindings) varsOf(b.ast, vars);
  const defs: string[] = [];
  if (vars.has('x')) defs.push(`x = \\frac{n}{${track.steps}}`);
  if (vars.has('t') || vars.has('h') || vars.has('bar')) defs.push(`t = ${toTex(simplify(bin('*', num(track.stepBeats), v('n'))))}`);
  if (vars.has('steps')) defs.push(`N = ${track.steps}`);
  if (vars.has('L')) defs.push(`L = ${scaleLength(song)}`);
  if (vars.has('h') || vars.has('bar')) defs.push(`\\mathrm{bar} = ${toTex(barAst(track))}`);
  if (vars.has('beat')) defs.push(`\\mathit{beat} = ${toTex(beatAst(track))}`);
  for (const sl of track.sliders ?? []) if (vars.has(sl.name)) defs.push(`${texName(sl.name)} = ${fmtNum(sl.value)}\\ \\text{(slider)}`);
  if (vars.has('h')) defs.push(`h = ${toTex(harmonyAst(song))}`);
  if (defs.length) lines.push({ label: 'clock, harmony & sliders', tex: defs.join(',\\quad ') });
  lines.push({ label: 'n runs over', tex: `n \\in \\{0, 1, \\dots, ${track.steps - 1}\\},\\quad k = \\text{loop count}` });
  if (!isDrum(track.waveform) && track.pitchMode === 'degree') {
    const steps = (SCALES[song.scale] ?? SCALES.major).steps;
    lines.push({
      label: 'pitch → MIDI',
      tex: `\\mathrm{midi} = ${12 * (track.octave + 1) + song.root} + 12\\left\\lfloor \\frac{d}{${steps.length}} \\right\\rfloor + S_{d \\bmod ${steps.length}},\\quad d = \\operatorname{round}(\\operatorname{pitch}),\\quad S = (${steps.join(',')})`,
    });
  }
  return lines;
}

/** SoundFunc formulas — each line can be pasted into a Formula node. */
export function trackSource(c: Composed, song: Song): { label: string; code: string }[] {
  const lines = c.math.outputs.map((o) => ({ label: o.port, code: toSource(o.ast) }));
  if (c.math.vars.has('h')) lines.push({ label: 'harmony h(bar)', code: toSource(harmonyAst(song)) });
  return lines;
}

export function trackCode(cs: Composed[], song: Song, lang: Lang): string {
  const scale = SCALES[song.scale] ?? SCALES.major;
  const fns = new Set<string>();
  const anyHarmony = cs.some((c) => c.math.vars.has('h') || c.math.bindings.some((b) => varsOf(b.ast).has('h')));
  const harmony = harmonyAst(song);
  if (anyHarmony) functionsOf(harmony, fns);
  const L = scaleLength(song);
  const body: string[] = [];
  const header =
    lang === 'js'
      ? [
          `// SoundFunc — ${cs.length === 1 ? `"${cs[0].track.name}"` : 'garden'} · ${NOTE_NAMES[song.root]} ${scale.label} · ${song.bpm} bpm`,
          '// Each track function takes the step n (and loop k) and returns its Note Out inputs:',
          '// pitch (see `mode`), velocity 0..1 (0 = rest), length in steps.',
          '',
          `export const song = { bpm: ${song.bpm}, root: ${song.root} /* ${NOTE_NAMES[song.root]} */, scale: [${scale.steps.join(', ')}] };`,
          'const PHI = (1 + Math.sqrt(5)) / 2;',
        ]
      : [
          `"""SoundFunc — ${cs.length === 1 ? `"${cs[0].track.name}"` : 'garden'} · ${NOTE_NAMES[song.root]} ${scale.label} · ${song.bpm} bpm`,
          '',
          'Each track function takes the step n (and loop k) and returns its Note Out inputs:',
          'pitch (see `mode`), velocity 0..1 (0 = rest), length in steps.',
          '"""',
          'import math',
          '',
          `SONG = {"bpm": ${song.bpm}, "root": ${song.root}, "scale": [${scale.steps.join(', ')}]}  # root ${NOTE_NAMES[song.root]}`,
          'PHI = (1 + math.sqrt(5)) / 2',
        ];
  if (anyHarmony) {
    body.push(
      lang === 'js'
        ? `\n/** the song's chord, as a scale degree, for each bar */\nexport function harmony(bar) {\n  return ${toCode(harmony, 'js')};\n}`
        : `\n\ndef harmony(bar):\n    """The song's chord, as a scale degree, for each bar."""\n    return ${toCode(harmony, 'py')}`,
    );
  }
  const used = new Set<string>();
  for (const c of cs) {
    const { track, math } = c;
    if (!math.hasOutput) continue;
    let name = ident(track.name, lang);
    while (used.has(name)) name += '_';
    used.add(name);
    const vars = new Set(math.vars);
    for (const b of math.bindings) varsOf(b.ast, vars);
    for (const o of math.outputs) functionsOf(o.ast, fns);
    for (const b of math.bindings) functionsOf(b.ast, fns);
    const clock: string[] = [];
    const pre = lang === 'js' ? 'const ' : '';
    const end = lang === 'js' ? ';' : '';
    if (vars.has('steps') || vars.has('x')) clock.push(`${pre}steps = ${track.steps}${end}`);
    if (vars.has('x')) clock.push(`${pre}x = n / steps${end}`);
    if (vars.has('t') || vars.has('bar') || vars.has('h') || vars.has('beat')) clock.push(`${pre}t = n * ${track.stepBeats}${end}`);
    if (vars.has('beat')) clock.push(`${pre}beat = ${toCode(beatAst(track), lang)}${end}`);
    if (vars.has('bar') || vars.has('h')) {
      functionsOf(barAst(track), fns);
      clock.push(`${pre}bar = ${toCode(barAst(track), lang)}${end}`);
    }
    if (vars.has('h')) clock.push(`${pre}h = harmony(bar)${end}`);
    if (vars.has('L')) clock.push(`${pre}L = ${L}${end}  ${lang === 'js' ? '//' : '#'} scale degrees per octave`);
    // this track's sliders — change these to change the music
    const sliders = (track.sliders ?? []).filter((sl) => vars.has(sl.name)).map((sl) => `${pre}${sl.name} = ${fmtNum(sl.value)}${end}  ${lang === 'js' ? '//' : '#'} slider ${fmtNum(sl.min)} … ${fmtNum(sl.max)}`);
    clock.unshift(...sliders);
    const binds = math.bindings.map((b) => `${pre}${b.name} = ${toCode(b.ast, lang)}${end}  ${lang === 'js' ? '//' : '#'} ${b.label}`);
    const mode = `${describeTrack(track, song)} · ${track.steps} steps of ${track.stepBeats} beats`;
    if (lang === 'js') {
      const outs = math.outputs.map((o) => `    ${o.port}: ${toCode(o.ast, 'js')},`);
      body.push(
        `\n/** ${track.name} — ${mode} */\nexport function ${name}(n, k = 0) {\n${[...clock, ...binds].map((l) => `  ${l}`).join('\n')}${clock.length + binds.length ? '\n' : ''}  return {\n${outs.join('\n')}\n  };\n}`,
      );
    } else {
      const outs = math.outputs.map((o) => `        "${o.port}": ${toCode(o.ast, 'py')},`);
      body.push(
        `\n\ndef ${name}(n, k=0):\n    """${track.name} — ${mode}"""\n${[...clock, ...binds].map((l) => `    ${l}`).join('\n')}${clock.length + binds.length ? '\n' : ''}    return {\n${outs.join('\n')}\n    }`,
      );
    }
  }
  if (lang === 'js') {
    body.push(
      `\n/** scale degree → MIDI note number */\nexport function toMidi(degree, octave = 4) {\n  const s = song.scale, d = Math.round(degree);\n  return 12 * (octave + 1) + song.root + 12 * Math.floor(d / s.length) + s[mod(d, s.length)];\n}`,
    );
    fns.add('mod');
  } else {
    body.push(
      `\n\ndef to_midi(degree, octave=4):\n    """Scale degree → MIDI note number."""\n    s, d = SONG["scale"], jsround(degree)\n    return 12 * (octave + 1) + SONG["root"] + 12 * (d // len(s)) + s[mod(d, len(s))]`,
    );
    fns.add('mod');
    fns.add('round');
  }
  const helpers = helperClosure(fns, lang);
  const helperBlock = helpers.length
    ? lang === 'js'
      ? `\n\n// ---- helpers (only the ones used above) ----\n\n${helpers.join('\n')}`
      : `\n\n\n# ---- helpers (only the ones used above) ----\n\n${helpers.join('\n\n\n')}`
    : '';
  const usage =
    lang === 'js'
      ? ''
      : `\n\n\nif __name__ == "__main__":\n${cs
          .filter((c) => c.math.hasOutput)
          .slice(0, 1)
          .map((c) => `    for n in range(${c.track.steps}):\n        print(n, ${ident(c.track.name, 'py')}(n))`)
          .join('\n') || '    pass'}`;
  return `${header.join('\n')}${body.join('')}${helperBlock}${usage}\n`;
}
