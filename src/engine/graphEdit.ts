/**
 * Structural edits on a node graph — all pure functions, so they can be tested
 * against the engine: exploding a formula into nodes, collapsing nodes into a
 * formula, inserting / saving blocks, and re-routing a node to be auditioned.
 */
import { parse, type Ast } from './expr';
import { NODE_DEFS, type GEdge, type GNode, type Graph, type NodeData } from './graph';
import { nodeHeight, uid } from './presets';
import { fallback, nodeAst, simplify, toSource } from './symbolic';

export type EditResult = { graph: Graph; focus?: string } | { error: string };

const CLOCK = new Set(['n', 'x', 't', 'k', 'h', 'bar']);
const UNARY = new Set(['sin', 'cos', 'tan', 'abs', 'floor', 'round', 'ceil', 'fract', 'sqrt', 'exp', 'log', 'sign', 'tanh']);
const WAVE_SHAPES: Record<string, string> = { sine: 'sine', tri: 'triangle', saw: 'saw', sqr: 'square' };
const SEQUENCES: Record<string, string> = { fib: 'fib', prime: 'prime', recaman: 'recaman', lorenz: 'lorenz', thue: 'thue', pidigit: 'pi' };
const MATH_OPS: Record<string, string> = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '^': 'pow' };

const NODE_W = 250;

/** the nearest free spot above or below (x, y) for a box of this size, given where the other nodes sit */
export function freeSpot(nodes: GNode[], x: number, y: number, h: number, w = NODE_W): { x: number; y: number } {
  const boxes = nodes.map((n) => ({ x: n.position.x, y: n.position.y, w: NODE_W, h: nodeHeight(n) }));
  const hits = (yy: number) => boxes.some((b) => x < b.x + b.w + 20 && x + w + 20 > b.x && yy < b.y + b.h + 20 && yy + h + 20 > b.y);
  // try just below or above, widening outwards
  for (let d = 0; d < 4000; d += 30) {
    if (!hits(y + d)) return { x, y: y + d };
    if (!hits(y - d)) return { x, y: y - d };
  }
  return { x, y };
}

const isNum = (a: Ast): a is { k: 'num'; v: number } => a.k === 'num' && !a.raw;
const edgeId = (s: string, sh: string, t: string, th: string) => `${s}.${sh}-${t}.${th}`;
const mkEdge = (source: string, sourceHandle: string, target: string, targetHandle: string): GEdge => ({
  id: edgeId(source, sourceHandle, target, targetHandle),
  source,
  sourceHandle,
  target,
  targetHandle,
});

// ---------- explode: one formula → a node for its outermost operation ----------

export function explodeFormula(graph: Graph, nodeId: string): EditResult {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || node.type !== 'expr') return { error: 'Only Formula nodes can be exploded.' };
  let ast: Ast;
  try {
    ast = parse(String(node.data.formula ?? '0')).ast;
  } catch (e) {
    return { error: `Fix the formula first: ${e instanceof Error ? e.message : e}` };
  }

  const nodes = graph.nodes.filter((n) => n.id !== nodeId);
  const edges = graph.edges.filter((e) => e.target !== nodeId);
  const incoming = graph.edges.filter((e) => e.target === nodeId);
  const outgoing = graph.edges.filter((e) => e.source === nodeId);
  const base = node.position;
  /** children go one column to the left, wherever there is room */
  const place = (n: GNode): GNode => ({ ...n, position: freeSpot(nodes, base.x - 290, base.y, nodeHeight(n)) });

  let clock = nodes.find((n) => n.type === 'step');
  const clockOut = (handle: string): { node: string; handle: string } => {
    if (!clock) {
      clock = { id: uid('step'), type: 'step', position: { x: base.x - 580, y: base.y }, data: {} };
      clock = { ...clock, position: freeSpot(nodes, base.x - 580, base.y, nodeHeight(clock)) };
      nodes.push(clock);
    }
    return { node: clock.id, handle };
  };

  /** a sub-expression as something wireable: an existing source, the clock, a Number, or a new Formula */
  const source = (sub: Ast): { node: string; handle: string } => {
    if (sub.k === 'var' && ['a', 'b', 'c'].includes(sub.name)) {
      const e = incoming.find((x) => x.targetHandle === sub.name);
      if (e) return { node: e.source, handle: String(e.sourceHandle ?? 'out') };
      return source({ k: 'num', v: 0 });
    }
    if (sub.k === 'var' && CLOCK.has(sub.name)) return clockOut(sub.name);
    const id = uid(isNum(sub) ? 'number' : 'expr');
    if (isNum(sub)) {
      nodes.push(place({ id, type: 'number', position: base, data: { value: sub.v, min: Math.min(-12, sub.v), max: Math.max(12, sub.v) } }));
      return { node: id, handle: 'out' };
    }
    nodes.push(place({ id, type: 'expr', position: base, data: { formula: toSource(sub) } }));
    // the child formula reads the same a / b / c the original did
    for (const e of incoming) if (usesVar(sub, String(e.targetHandle))) edges.push(mkEdge(e.source, String(e.sourceHandle ?? 'out'), id, String(e.targetHandle)));
    return { node: id, handle: 'out' };
  };
  const wire = (from: { node: string; handle: string }, to: string, port: string) => edges.push(mkEdge(from.node, from.handle, to, port));

  const topId = uid('node');
  let top: GNode | null = null;
  const make = (type: string, data: NodeData) => (top = { id: topId, type, position: base, data: { ...NODE_DEFS[type].defaults, ...data } });

  /** wire an input unless it is exactly what the node assumes when nothing is connected */
  const feed = (sub: Ast, port: string, defaultVar?: string) => {
    if (defaultVar && sub.k === 'var' && sub.name === defaultVar) return;
    wire(source(sub), topId, port);
  };

  if (ast.k === 'bin' && MATH_OPS[ast.op]) {
    let { a, b } = ast;
    if (isNum(a) && !isNum(b) && (ast.op === '+' || ast.op === '*')) [a, b] = [b, a];
    make('math', { op: MATH_OPS[ast.op], b: isNum(b) ? b.v : 1 });
    feed(a, 'a');
    if (!isNum(b)) feed(b, 'b');
  } else if (ast.k === 'neg') {
    make('math', { op: 'mul', b: -1 });
    feed(ast.a, 'a');
  } else if (ast.k === 'call' && (ast.fn === 'min' || ast.fn === 'max') && ast.args.length === 2) {
    make('math', { op: ast.fn, b: isNum(ast.args[1]) ? ast.args[1].v : 1 });
    feed(ast.args[0], 'a');
    if (!isNum(ast.args[1])) feed(ast.args[1], 'b');
  } else if (ast.k === 'call' && UNARY.has(ast.fn) && ast.args.length === 1) {
    make('func', { fn: ast.fn });
    feed(ast.args[0], 'x', 'x');
  } else if (ast.k === 'call' && WAVE_SHAPES[ast.fn] && ast.args.length === 1) {
    // sine(c · p) → Wave with c cycles over phase p
    const arg = ast.args[0];
    const scaled = arg.k === 'bin' && arg.op === '*' && isNum(arg.a);
    make('wave', { shape: WAVE_SHAPES[ast.fn], cycles: scaled ? (arg as { a: { v: number } }).a.v : 1, amp: 1, offset: 0 });
    feed(scaled ? (arg as { b: Ast }).b : arg, 'p', 'x');
  } else if (ast.k === 'call' && ast.fn === 'euclid' && ast.args.length >= 3 && ast.args.slice(1).every(isNum)) {
    const [, k, len, rot] = ast.args as { v: number }[];
    make('euclid', { pulses: k.v, length: len.v, rotate: rot?.v ?? 0 });
    feed(ast.args[0], 'n', 'n');
  } else if (ast.k === 'call' && ast.fn === 'chance' && ast.args.length >= 2 && ast.args.slice(1).every(isNum)) {
    const [, p, seed] = ast.args as { v: number }[];
    make('chance', { p: p.v, seed: seed?.v ?? 0 });
    feed(ast.args[0], 'n');
  } else if (ast.k === 'call' && ast.fn === 'pick' && ast.args.length >= 2 && ast.args.slice(1).every(isNum)) {
    make('list', { values: ast.args.slice(1).map((x) => (x as { v: number }).v).join(' '), every: 1 });
    feed(ast.args[0], 'n', 'n');
  } else if (ast.k === 'call' && SEQUENCES[ast.fn] && ast.args.length === 1) {
    make('series', { kind: SEQUENCES[ast.fn], modulo: 0, p: 0 });
    feed(ast.args[0], 'n', 'n');
  } else if (ast.k === 'num') {
    make('number', { value: ast.v, min: Math.min(-12, ast.v), max: Math.max(12, ast.v) });
  } else {
    const why = ast.k === 'cond' ? 'Conditions (a ? b : c) stay as formulas for now.' : ast.k === 'var' ? 'It is a single variable already.' : 'This formula is already as simple as nodes get.';
    return { error: why };
  }

  nodes.push(top!);
  for (const e of outgoing) edges.push(mkEdge(topId, 'out', e.target, String(e.targetHandle)));
  return { graph: { nodes, edges: dedupe(edges) }, focus: topId };
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

/** one wire per input; the last one wins */
function dedupe(edges: GEdge[]): GEdge[] {
  const byTarget = new Map<string, GEdge>();
  for (const e of edges) byTarget.set(`${e.target}.${e.targetHandle}`, e);
  return [...byTarget.values()];
}

// ---------- collapse: selected nodes → one formula ----------

export function collapseNodes(graph: Graph, ids: string[]): EditResult {
  const S = new Set(ids.filter((id) => graph.nodes.find((n) => n.id === id && n.type !== 'output')));
  if (S.size < 2) return { error: 'Select two or more nodes (not Note Out) to collapse.' };
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  // the one output of the selection that the rest of the graph uses
  const exits = graph.edges.filter((e) => S.has(e.source) && !S.has(e.target));
  const exitKeys = [...new Set(exits.map((e) => `${e.source}.${e.sourceHandle}`))];
  if (exitKeys.length === 0) return { error: 'The selection does not feed anything outside it.' };
  if (exitKeys.length > 1) return { error: `The selection feeds ${exitKeys.length} different outputs — a formula has only one. Collapse each branch separately.` };
  const [sinkId, sinkHandle] = [exits[0].source, String(exits[0].sourceHandle ?? 'out')];

  // wires coming in from outside become a, b, c (the clock becomes its variables)
  const inputs = new Map<string, Ast>();
  const letters = ['a', 'b', 'c'];
  const external: { from: string; handle: string; letter: string }[] = [];
  for (const e of graph.edges) {
    if (!S.has(e.target) || S.has(e.source)) continue;
    const key = `${e.source}.${e.sourceHandle}`;
    if (inputs.has(key)) continue;
    const src = byId.get(e.source);
    if (src?.type === 'step') {
      inputs.set(key, { k: 'var', name: String(e.sourceHandle) });
      continue;
    }
    if (external.length === 3) return { error: 'More than three wires come into the selection — a formula has inputs a, b and c only.' };
    const letter = letters[external.length];
    external.push({ from: e.source, handle: String(e.sourceHandle ?? 'out'), letter });
    inputs.set(key, { k: 'var', name: letter });
  }

  const visiting = new Set<string>();
  const valueOf = (id: string, handle: string): Ast => {
    const node = byId.get(id)!;
    if (visiting.has(id)) return { k: 'num', v: 0 };
    visiting.add(id);
    const ins = (NODE_DEFS[node.type]?.inputs ?? []).map((p) => {
      const e = graph.edges.find((x) => x.target === id && x.targetHandle === p.id);
      if (!e) return fallback(node.type, p.id, node.data);
      const key = `${e.source}.${e.sourceHandle}`;
      if (inputs.has(key)) return inputs.get(key)!;
      return valueOf(e.source, String(e.sourceHandle ?? 'out'));
    });
    visiting.delete(id);
    return nodeAst(node, handle, ins);
  };
  const formula = toSource(simplify(valueOf(sinkId, sinkHandle)));

  const sink = byId.get(sinkId)!;
  const newId = uid('expr');
  const nodes = graph.nodes.filter((n) => !S.has(n.id));
  nodes.push({ id: newId, type: 'expr', position: sink.position, data: { formula } });
  const edges = graph.edges.filter((e) => !S.has(e.source) && !S.has(e.target));
  for (const x of external) edges.push(mkEdge(x.from, x.handle, newId, x.letter));
  for (const e of exits) edges.push(mkEdge(newId, 'out', e.target, String(e.targetHandle)));
  return { graph: { nodes, edges: dedupe(edges) }, focus: newId };
}

// ---------- blocks: reusable groups of nodes ----------

export interface Block {
  id: string;
  name: string;
  description: string;
  nodes: GNode[];
  edges: GEdge[];
  /** the output used when a block is dropped onto a wire */
  outlet?: { node: string; handle: string };
  /** the input fed when a wire is dragged out of another node into the block */
  inlet?: { node: string; handle: string };
  /** wires straight into Note Out, made on insert when the track has one */
  toOutput?: { node: string; handle: string; port: string }[];
}

/** Insert a block's nodes at a position, with fresh ids. Reuses the track's clock if it has one. */
export function insertBlock(graph: Graph, block: Block, at: { x: number; y: number }): { graph: Graph; ids: string[]; outlet?: { node: string; handle: string }; inlet?: { node: string; handle: string } } {
  const map = new Map<string, string>();
  const existingClock = graph.nodes.find((n) => n.type === 'step');
  const minX = Math.min(...block.nodes.map((n) => n.position.x));
  const minY = Math.min(...block.nodes.map((n) => n.position.y));
  // keep the block clear of nodes already there
  const width = Math.max(...block.nodes.map((n) => n.position.x)) - minX + NODE_W;
  const height = Math.max(...block.nodes.map((n) => n.position.y + nodeHeight(n))) - minY;
  at = freeSpot(graph.nodes, at.x, at.y, height, width);
  const added: GNode[] = [];
  for (const n of block.nodes) {
    if (n.type === 'step' && existingClock) {
      map.set(n.id, existingClock.id);
      continue;
    }
    if (n.type === 'output') continue;
    const id = uid(n.type);
    map.set(n.id, id);
    added.push({ id, type: n.type, position: { x: at.x + n.position.x - minX, y: at.y + n.position.y - minY }, data: structuredClone(n.data) });
  }
  const edges = [...graph.edges];
  for (const e of block.edges) {
    const s = map.get(e.source), t = map.get(e.target);
    if (s && t) edges.push(mkEdge(s, String(e.sourceHandle ?? 'out'), t, String(e.targetHandle)));
  }
  const out = graph.nodes.find((n) => n.type === 'output');
  if (out) for (const w of block.toOutput ?? []) if (map.get(w.node)) edges.push(mkEdge(map.get(w.node)!, w.handle, out.id, w.port));
  const remap = (p?: { node: string; handle: string }) => (p && map.get(p.node) ? { node: map.get(p.node)!, handle: p.handle } : undefined);
  return {
    graph: { nodes: [...graph.nodes.map((n) => ({ ...n, selected: false }) as GNode), ...added.map((n) => ({ ...n, selected: true }) as GNode)], edges: dedupe(edges) },
    ids: added.map((n) => n.id),
    outlet: remap(block.outlet),
    inlet: remap(block.inlet),
  };
}

/** Save selected nodes as a block: their settings and the wires between them. */
export function blockFromSelection(graph: Graph, ids: string[], name: string, description = ''): Block | { error: string } {
  const S = new Set(ids.filter((id) => graph.nodes.some((n) => n.id === id && n.type !== 'output')));
  if (!S.size) return { error: 'Select the nodes you want to keep (Note Out is left out).' };
  const nodes = graph.nodes.filter((n) => S.has(n.id)).map(({ id, type, position, data }) => ({ id, type, position: { ...position }, data: structuredClone(data) }));
  const edges = graph.edges.filter((e) => S.has(e.source) && S.has(e.target)).map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle }));
  const exits = graph.edges.filter((e) => S.has(e.source) && !S.has(e.target));
  const outNode = graph.nodes.find((n) => n.type === 'output');
  const toOutput = exits.filter((e) => e.target === outNode?.id).map((e) => ({ node: e.source, handle: String(e.sourceHandle ?? 'out'), port: String(e.targetHandle) }));
  const other = exits.find((e) => e.target !== outNode?.id) ?? exits[0];
  const entry = graph.edges.find((e) => S.has(e.target) && !S.has(e.source) && graph.nodes.find((n) => n.id === e.source)?.type !== 'step');
  return {
    id: uid('block'),
    name,
    description: description || `${nodes.length} node${nodes.length > 1 ? 's' : ''}`,
    nodes,
    edges,
    outlet: other ? { node: other.source, handle: String(other.sourceHandle ?? 'out') } : undefined,
    inlet: entry ? { node: entry.target, handle: String(entry.targetHandle) } : undefined,
    toOutput,
  };
}

// ---------- listen: hear one node ----------

/**
 * Re-route a node into Note Out so it can be heard on its own: rhythm nodes drive
 * velocity, everything else drives pitch. Small ranges (e.g. 0…1) are stretched
 * across an octave of `span` so the contour is audible.
 */
export function auditionGraph(graph: Graph, nodeId: string, opts: { asVelocity: boolean; lo: number; hi: number; span: number }): Graph {
  const out = graph.nodes.find((n) => n.type === 'output');
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!out || !node || node.id === out.id) return graph;
  const handle = NODE_DEFS[node.type]?.outputs[0]?.id ?? 'out';
  const port = opts.asVelocity ? 'velocity' : 'pitch';
  const edges = graph.edges.filter((e) => !(e.target === out.id && e.targetHandle === port));
  const nodes = [...graph.nodes];
  let from = { node: nodeId, handle };
  const range = opts.hi - opts.lo;
  if (!opts.asVelocity && range < 3) {
    const id = '__audition_range';
    nodes.push({ id, type: 'map', position: { x: 0, y: 0 }, data: { inMin: opts.lo, inMax: range < 1e-9 ? opts.lo + 1 : opts.hi, outMin: 0, outMax: opts.span, clamp: true } });
    edges.push(mkEdge(nodeId, handle, id, 'v'));
    from = { node: id, handle: 'out' };
  }
  edges.push(mkEdge(from.node, from.handle, out.id, port));
  return { nodes, edges };
}
