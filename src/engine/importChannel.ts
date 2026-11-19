/**
 * SoundFunc's own writing, read back. What the function sheet copies or downloads — its SoundFunc
 * formulas, its LaTeX (one line, or the whole document) — becomes the channels it came from, with
 * every Note Out input, the sliders and the grid. A .tex SoundFunc wrote also carries each channel
 * whole in a comment, so it comes back exactly as it was: nodes, sound and all.
 */
import { parse, type Ast } from './expr';
import { NODE_DEFS } from './graph';
import { importMath } from './importMath';
import { layoutGraph, uid } from './presets';
import { TRACK_DEFAULTS, type Slider, type Track } from './project';
import { toSource } from './symbolic';

export interface NativeChannel {
  name: string;
  /** what goes into Note Out, by input */
  outputs: { port: string; ast: Ast }[];
  sliders: Slider[];
  steps?: number;
  stepBeats?: number;
  /** the whole channel, when the export carried it */
  track?: Track;
}

export interface NativeRead {
  format: 'formulas' | 'latex' | 'saved';
  channels: NativeChannel[];
  /** one formula on its own: which input it was isn't written, so the reader is asked */
  lone: boolean;
  warnings: string[];
}

/** Note Out's inputs: pitch, velocity, length, … */
export const OUTPUT_PORTS: string[] = NODE_DEFS.output.inputs.map((p) => p.id);

/** the comment a SoundFunc .tex carries each channel in */
export const TRACK_COMMENT = '% soundfunc-track ';

/** SoundFunc functions a graphing calculator doesn't have: a formula that uses one is SoundFunc's */
const OWN_FUNCTIONS = new Set(['pick', 'every', 'euclid', 'bits', 'bit', 'chance', 'rand', 'noise', 'wrap', 'fold', 'phase', 'decay', 'quant', 'bend', 'lorenz', 'thue', 'recaman', 'pidigit', 'collatz', 'logistic', 'band', 'bor', 'bxor']);
/** SoundFunc's clocks besides plain time: a formula that reads one is SoundFunc's */
const OWN_CLOCKS = new Set(['n', 'k', 'h', 'bar', 'beat', 'np', 'L', 'steps']);
const CLOCKS = new Set([...OWN_CLOCKS, 't', 'x']);

/** Read SoundFunc's own writing; null when the text is something else (a function from elsewhere). */
export function readNative(src: string): NativeRead | null {
  const text = src.replace(/\r\n?/g, '\n').trim();
  if (!text) return null;
  return readSaved(text) ?? readFormulas(text) ?? readLatex(text) ?? readLone(text);
}

/**
 * The channel to plant: the one the export carried whole, or one Formula node per Note Out input
 * (a lone formula goes to `lonePort`). Its colour is picked when it is planted.
 */
export function nativeTrack(ch: NativeChannel, lonePort?: string): Track {
  if (ch.track) return { ...TRACK_DEFAULTS, ...ch.track, id: uid('track') };
  const outputs = lonePort ? ch.outputs.map((o) => ({ ...o, port: lonePort })) : ch.outputs;
  const graph = layoutGraph({
    nodes: [
      ...outputs.map((o) => ({ id: o.port, type: 'expr', position: { x: 0, y: 0 }, data: { formula: toSource(o.ast) } })),
      { id: 'out', type: 'output', position: { x: 0, y: 0 }, data: {} },
    ],
    edges: outputs.map((o) => ({ id: `${o.port}.out-out.${o.port}`, source: o.port, sourceHandle: 'out', target: 'out', targetHandle: o.port })),
  });
  return { ...TRACK_DEFAULTS, id: uid('track'), name: ch.name, color: '', graph, sliders: ch.sliders, steps: ch.steps ?? 16, stepBeats: ch.stepBeats ?? 0.25 };
}

// ---------- a .tex that carries its channels whole ----------

function readSaved(text: string): NativeRead | null {
  const channels: NativeChannel[] = [];
  for (const line of text.split('\n')) {
    const at = line.indexOf(TRACK_COMMENT);
    if (at < 0) continue;
    try {
      const track = JSON.parse(line.slice(at + TRACK_COMMENT.length)) as Track;
      if (!track || !track.graph || !Array.isArray(track.graph.nodes)) continue;
      channels.push({ name: track.name ?? 'Imported channel', outputs: [], sliders: track.sliders ?? [], steps: track.steps, stepBeats: track.stepBeats, track });
    } catch {
      /* not one of ours after all: read the math instead */
    }
  }
  return channels.length ? { format: 'saved', channels, lone: false, warnings: [] } : null;
}

// ---------- SoundFunc formulas: "# Name", "pitch = …", "velocity = …" ----------

const PORT_LINE = new RegExp(`^(${OUTPUT_PORTS.join('|')})\\s*=\\s*(.+)$`);

function readFormulas(text: string): NativeRead | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.some((l) => PORT_LINE.test(l))) return null;
  const channels: NativeChannel[] = [];
  const warnings: string[] = [];
  let ch: NativeChannel | null = null;
  const current = () => (ch ??= pushChannel(channels, 'Imported channel'));
  for (const line of lines) {
    const grid = /^#\s*grid\s+(\d+)\s*[×x*]\s*([\d.]+)/i.exec(line);
    const slider = /^#\s*slider\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?[\d.eE+-]+)(?:\s*\(\s*(-?[\d.eE+-]+)\s*…\s*(-?[\d.eE+-]+)\s*\))?/.exec(line);
    const port = PORT_LINE.exec(line);
    if (grid) Object.assign(current(), { steps: Number(grid[1]), stepBeats: Number(grid[2]) });
    else if (slider) current().sliders.push(sliderOf(slider[1], Number(slider[2]), slider[3], slider[4]));
    else if (line.startsWith('#')) ch = pushChannel(channels, line.replace(/^#+\s*/, '') || 'Imported channel');
    else if (port) {
      try {
        current().outputs.push({ port: port[1], ast: parse(port[2]).ast });
      } catch (e) {
        throw new Error(`${port[1]}: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (/^harmony\b/.test(line)) warnings.push('The harmony line was left out: the song keeps its own Harmony.');
    // anything else isn't SoundFunc's formulas
    else return null;
  }
  return finishChannels('formulas', channels, warnings);
}

// ---------- SoundFunc's LaTeX: the whole document, or lines of it ----------

const OUTPUT_LHS = new RegExp(`^\\\\operatorname\\{(${OUTPUT_PORTS.join('|')})\\}\\s*(?:\\\\left)?\\(`);

function readLatex(text: string): NativeRead | null {
  if (!/\\operatorname\{\w+\}\s*(?:\\left)?\(/.test(text) || !text.split('\n').some((l) => OUTPUT_LHS.test(l.trim()) || /\\operatorname\{\w+\}\s*\(n/.test(l))) return null;
  // the document's wrapping, and comments, are not math
  const body = text
    .split('\n')
    .filter((l) => !/^\s*%/.test(l))
    .join('\n')
    .replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}|\\usepackage(\[[^\]]*\])?\{[^}]*\}|\\(begin|end)\{(document|gather\*?|align\*?|equation\*?)\}/g, '');
  // one channel per \section*{Name}
  const parts = body.split(/\\section\*?\{((?:[^{}]|\\[{}])*)\}/);
  const blocks: { name: string; tex: string }[] = [];
  if (parts[0].trim()) blocks.push({ name: 'Imported channel', tex: parts[0] });
  for (let i = 1; i < parts.length; i += 2) blocks.push({ name: parts[i].replace(/\\([&%$#_{}])/g, '$1'), tex: parts[i + 1] ?? '' });
  const channels: NativeChannel[] = [];
  const warnings = new Set<string>();
  for (const block of blocks) {
    const ch = pushChannel(channels, block.name);
    // rows of the display (\\ then a new line), and the clock row's definitions (,\quad)
    const rows = block.tex.split(/\\\\\s*\n/).flatMap((r) => r.split(/,\s*\\quad\s*/)).map((r) => r.trim()).filter(Boolean);
    const outputs: { port: string; rhs: string }[] = [];
    const defs: { lhs: string; rhs: string }[] = [];
    for (const row of rows) {
      const eq = defSplit(row);
      if (!eq) {
        const range = /n\s*\\in\s*\\\{.*?(\d+)\s*\\\}/.exec(row);
        if (range) ch.steps = Number(range[1]) + 1;
        continue;
      }
      const port = OUTPUT_LHS.exec(eq.lhs);
      if (port) outputs.push({ port: port[1], rhs: eq.rhs });
      else defs.push(eq);
    }
    // the where-clause and the clock row: shared parts are written back in, sliders and the grid read off
    const constants = new Map<string, Ast>();
    for (const { lhs, rhs } of defs) {
      const name = lhsName(lhs);
      const slider = /^(-?[\d.]+)\s*\\\s*\\text\{\(slider\)\}$/.exec(rhs);
      if (name === null || /^\\mathrm\{midi\}/.test(lhs)) continue;
      if (slider) ch.sliders.push(sliderOf(name, Number(slider[1])));
      else if (name === 'steps') ch.steps = Number(rhs) || ch.steps;
      else if (name === 'x') {
        const m = /\\frac\{n\}\{(\d+)\}/.exec(rhs);
        if (m) ch.steps = Number(m[1]);
      } else if (name === 't') {
        const m = /^([\d.]+)\s*(?:\\,|\\cdot)?\s*n$/.exec(rhs);
        ch.stepBeats = m ? Number(m[1]) : rhs.trim() === 'n' ? 1 : ch.stepBeats;
      } else if (name === 'h') warnings.add('The harmony line was left out: the song keeps its own Harmony.');
      else if (CLOCKS.has(name)) continue;
      else {
        // a shared part (w_1 = …); a row that isn't one of those (S = (…) under pitch → MIDI) is only notes
        try {
          constants.set(name, importMath(rhs, { native: true, constants }).value);
        } catch {
          /* not a definition the channel needs */
        }
      }
    }
    for (const { port, rhs } of outputs) ch.outputs.push({ port, ast: importMath(rhs, { native: true, constants }).value });
  }
  return finishChannels('latex', channels, [...warnings]);
}

/** "lhs = rhs" at the first definition sign (not ≤, ≥, ≠ or ==) */
function defSplit(row: string): { lhs: string; rhs: string } | null {
  const m = /^(.*?[^<>!=\\])=(?!=)(.*)$/s.exec(row);
  if (!m) return null;
  return { lhs: m[1].trim(), rhs: m[2].trim() };
}

/** the SoundFunc name a defined name is written as: w_{1} → w_1, k' → k_, \mathit{beat} → beat, N → steps */
function lhsName(lhs: string): string | null {
  try {
    const ast = importMath(lhs, { native: true }).value;
    return ast.k === 'var' ? ast.name : null;
  } catch {
    return null;
  }
}

// ---------- one SoundFunc formula, on its own ----------

function readLone(text: string): NativeRead | null {
  if (text.includes('\n')) return null;
  let ast: Ast, variables: string[];
  try {
    ({ ast, variables } = parse(text.replace(/^\s*[A-Za-z]\w*\s*=(?!=)\s*/, '')));
  } catch {
    return null;
  }
  // only when it is clearly SoundFunc's: its functions, its operators, or its clocks
  const own = [...functionsIn(ast)].some((f) => OWN_FUNCTIONS.has(f)) || /%|\?|==|&&|\|\||!(?!=)/.test(text) || variables.some((v) => OWN_CLOCKS.has(v) && v !== 'n') || (variables.includes('n') && variables.some((v) => v === 'k' || v === 'h'));
  if (!own) return null;
  const channels: NativeChannel[] = [];
  pushChannel(channels, 'Imported formula').outputs.push({ port: 'pitch', ast });
  return finishChannels('formulas', channels, [], true);
}

function functionsIn(ast: Ast, out = new Set<string>()): Set<string> {
  switch (ast.k) {
    case 'call':
      out.add(ast.fn);
      ast.args.forEach((a) => functionsIn(a, out));
      break;
    case 'bin':
      functionsIn(ast.a, out);
      functionsIn(ast.b, out);
      break;
    case 'neg':
    case 'not':
      functionsIn(ast.a, out);
      break;
    case 'cond':
      functionsIn(ast.c, out);
      functionsIn(ast.a, out);
      functionsIn(ast.b, out);
      break;
  }
  return out;
}

// ---------- shared ----------

function pushChannel(channels: NativeChannel[], name: string): NativeChannel {
  const ch: NativeChannel = { name: name.trim() || 'Imported channel', outputs: [], sliders: [] };
  channels.push(ch);
  return ch;
}

function sliderOf(name: string, value: number, lo?: string, hi?: string): Slider {
  if (lo !== undefined && hi !== undefined) return { name, value, min: Number(lo), max: Number(hi) };
  return { name, value, ...(value > 0 ? { min: 0, max: value * 2 } : value < 0 ? { min: value * 2, max: 0 } : { min: -1, max: 1 }) };
}

/** keep the channels that say something; every name a formula reads that isn't a clock becomes a slider */
function finishChannels(format: NativeRead['format'], all: NativeChannel[], warnings: string[], lone = false): NativeRead | null {
  const channels = all.filter((c) => c.outputs.length);
  if (!channels.length) return null;
  for (const ch of channels) {
    const named = new Set(ch.sliders.map((s) => s.name));
    const missing = new Set<string>();
    for (const o of ch.outputs) for (const v of varsIn(o.ast)) if (!CLOCKS.has(v) && !named.has(v)) missing.add(v);
    for (const name of missing) ch.sliders.push(sliderOf(name, 1));
    if (missing.size) warnings.push(`${[...missing].join(', ')} ${missing.size > 1 ? 'are' : 'is'} read as slider${missing.size > 1 ? 's' : ''} starting at 1 — the export didn’t say ${missing.size > 1 ? 'their values' : 'its value'}.`);
  }
  return { format, channels, lone, warnings };
}

function varsIn(ast: Ast, out = new Set<string>()): Set<string> {
  switch (ast.k) {
    case 'var':
      out.add(ast.name);
      break;
    case 'call':
      ast.args.forEach((a) => varsIn(a, out));
      break;
    case 'bin':
      varsIn(ast.a, out);
      varsIn(ast.b, out);
      break;
    case 'neg':
    case 'not':
      varsIn(ast.a, out);
      break;
    case 'cond':
      varsIn(ast.c, out);
      varsIn(ast.a, out);
      varsIn(ast.b, out);
      break;
  }
  return out;
}
