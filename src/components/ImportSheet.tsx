import { useEffect, useMemo, useState } from 'react';
import { compileAst, type Ast } from '../engine/expr';
import { importMath, ImportError, type Imported } from '../engine/importMath';
import { TRACK_COLORS, layoutGraph, uid } from '../engine/presets';
import { simplify, substitute, toSource, toTex } from '../engine/symbolic';
import { TRACK_DEFAULTS, type Track, type Waveform } from '../engine/project';
import { useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon, NumberField, Seg, TextField } from './ui';
import { Tex, useKatex } from './tex';
import { StepPicker } from './StepPicker';
import { FIXED_LENGTHS, nearestFixedLength } from '../engine/steps';

type XMeans = 'beats' | 'steps' | 'loop';
type YMeans = 'octaves' | 'semitones' | 'degrees';

const EXAMPLES: { label: string; src: string }[] = [
  { label: 'Desmos LaTeX', src: '\\frac{\\operatorname{floor}\\left(\\frac{12\\operatorname{mod}\\left(3\\operatorname{floor}\\left(\\frac{x}{2}\\right)+2\\operatorname{mod}\\left(\\operatorname{floor}\\left(4x\\right),4\\right)+5,7\\right)+2}{7}\\right)}{12}+\\frac{e^{-12\\operatorname{mod}\\left(4x,1\\right)}}{6}' },
  { label: 'Piecewise', src: '\\begin{cases} \\sin(\\pi x) & \\text{if } \\operatorname{frac}(x) < 0.5 \\\\ -\\frac{1}{4} & \\text{if } x \\ge 6 \\end{cases}' },
  { label: 'Plain math', src: 'y = ⌊7·frac(x·φ)⌋/12 + 0.1 sin(2π·8x)' },
];


/** Paste a function from a paper, a graphing calculator, or LaTeX — and plant it as a track. */
export function ImportSheet() {
  const open = useStore((s) => s.showImport);
  const setOpen = useStore((s) => s.setShowImport);
  const [src, setSrc] = useState('');
  const [name, setName] = useState('Imported f(x)');
  const [xMeans, setXMeans] = useState<XMeans>('beats');
  const [yMeans, setYMeans] = useState<YMeans>('octaves');
  const [length, setLength] = useState(8);
  const [stepBeats, setStepBeats] = useState(0.25);
  const [glide, setGlide] = useState(true);
  const [articulate, setArticulate] = useState(true);
  const [modReading, setModReading] = useState<'sum' | 'term'>('sum');
  const [xStart, setXStart] = useState(0);
  const katex = useKatex(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const parsed = useMemo((): { ok: Imported | null; error: string | null } => {
    if (!src.trim()) return { ok: null, error: null };
    try {
      return { ok: importMath(src, { modReading }), error: null };
    } catch (e) {
      return { ok: null, error: e instanceof ImportError || e instanceof Error ? e.message : String(e) };
    }
  }, [src, modReading]);

  /** x in the source → SoundFunc time (shifted so the track starts at x = xStart) */
  const timeAst = (): Ast => {
    const t: Ast = { k: 'var', name: 't' };
    const base: Ast = xMeans === 'steps' ? { k: 'bin', op: '/', a: t, b: { k: 'num', v: stepBeats } } : xMeans === 'loop' ? { k: 'var', name: 'x' } : t;
    return xStart ? { k: 'bin', op: '+', a: base, b: { k: 'num', v: xStart } } : base;
  };
  const toSf = (a: Ast) => simplify(substitute(a, { t: timeAst() }));

  // sample the function across the chosen length, for the plot
  const plot = useMemo(() => {
    const r = parsed.ok;
    if (!r) return null;
    const v = compileAst(r.value), g = r.gate ? compileAst(r.gate) : () => 1;
    const N = 480;
    const pts: (number | null)[] = [];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) {
      const beats = (i / N) * length;
      const x = xStart + (xMeans === 'beats' ? beats : xMeans === 'steps' ? beats / stepBeats : i / N);
      const y = g({ t: x }) ? v({ t: x }) : NaN;
      if (Number.isFinite(y)) {
        pts.push(y);
        (lo = Math.min(lo, y)), (hi = Math.max(hi, y));
      } else pts.push(null);
    }
    if (!Number.isFinite(lo)) return { pts, lo: -1, hi: 1, silent: true };
    if (hi - lo < 1e-9) (lo -= 1), (hi += 1);
    return { pts, lo, hi, silent: false };
  }, [parsed.ok, length, xMeans, stepBeats, xStart]);

  if (!open) return null;

  const steps = Math.max(1, Math.min(256, Math.round(length / stepBeats)));

  const plant = () => {
    const r = parsed.ok;
    if (!r) return;
    const value = toSource(toSf(r.value));
    const gateParts = [r.gate ? `(${toSource(toSf(r.gate))})` : null, articulate ? `(fract(t / ${stepBeats}) < 0.85)` : null].filter(Boolean);
    const velocity = gateParts.length ? `0.8 * ${gateParts.join(' * ')}` : '0.8';
    const nodes: Record<string, [string, Record<string, string | number>]> = {
      f: ['expr', { formula: value }],
      v: ['expr', { formula: velocity }],
      out: ['output', {}],
    };
    const edges: [string, string, string, string][] = [['v', 'out', 'out', 'velocity']];
    if (yMeans === 'octaves') {
      nodes.oct = ['math', { op: 'mul', b: 12 }];
      edges.push(['f', 'out', 'oct', 'a'], ['oct', 'out', 'out', 'pitch']);
    } else edges.push(['f', 'out', 'out', 'pitch']);
    const graph = layoutGraph({
      nodes: Object.entries(nodes).map(([id, [type, data]]) => ({ id, type, position: { x: 0, y: 0 }, data })),
      edges: edges.map(([source, sourceHandle, target, targetHandle]) => ({ id: `${source}.${sourceHandle}-${target}.${targetHandle}`, source, sourceHandle, target, targetHandle })),
    });
    const { project, plantTrack } = useStore.getState();
    const track: Track = {
      ...TRACK_DEFAULTS,
      id: uid('track'),
      name: name.trim() || 'Imported f(x)',
      color: TRACK_COLORS[project.tracks.length % TRACK_COLORS.length],
      graph,
      steps,
      stepBeats,
      ...((FIXED_LENGTHS as readonly number[]).includes(length)
        ? { lengthMode: 'fixed' as const, lengthBeats: length, stepBeats: length / steps }
        : { lengthMode: 'free' as const, lengthBeats: nearestFixedLength(length) }),
      octave: 4,
      pitchMode: yMeans === 'degrees' ? 'degree' : 'semitone',
      playMode: glide ? 'glide' : 'notes',
      quantize: false,
      glide: 0.004,
      attack: 0.004,
      release: 0.06,
      waveform: 'triangle' as Waveform,
      send: 0.5,
    };
    plantTrack(track);
    setOpen(false);
    toast(`Planted “${track.name}” — ${steps} steps, ${glide ? 'glide' : 'notes'}`);
  };

  const W = 640, H = 140;
  const path = plot
    ? plot.pts
        .map((y, i) => (y === null ? null : `${(i / (plot.pts.length - 1)) * W},${(H - 8 - ((y - plot.lo) / (plot.hi - plot.lo)) * (H - 16)).toFixed(1)}`))
        .reduce<string[]>((acc, p, i, arr) => (p === null ? acc : [...acc, `${i && arr[i - 1] !== null ? 'L' : 'M'}${p}`]), [])
        .join('')
    : '';

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="sheet import-sheet" role="dialog" aria-label="Paste a function">
        <header className="sheet-head">
          <div>
            <div className="eyebrow" style={{ margin: 0 }}>
              Paste a function
            </div>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
              LaTeX (Desmos: select an expression, ⌘C), <code className="mono">\begin{'{cases}'}</code>, plain math with ⌊ ⌋, mod, frac, ≥ — or several lines: helper
              definitions like <code className="mono">g(x) = …</code> and <code className="mono">IF … : / ELSE IF / OTHERWISE</code> blocks. y as a function of x.
            </p>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} title="Close (Esc)">
            <Icon name="close" />
          </button>
        </header>

        <div className="sheet-body import-body">
          <textarea
            className="formula import-src"
            autoFocus
            spellCheck={false}
            placeholder="y = ⌊(12·mod(3⌊x/2⌋ + 5, 7) + 2)/7⌋/12 + e^(−12 frac(4x))/6"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            rows={4}
          />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 11 }}>Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} className="btn small ghost" onClick={() => setSrc(ex.src)}>
                {ex.label}
              </button>
            ))}
          </div>

          {parsed.error && <p className="import-error">{parsed.error}</p>}
          {parsed.ok && (
            <>
              <div className="fn-line">
                <span className="fn-label">read as</span>
                <Tex tex={`y = ${toTex(parsed.ok.raw)}`} katex={katex} />
              </div>
              {plot && (
                <svg className="import-plot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  <line x1="0" x2={W} y1={H - 8 - ((0 - plot.lo) / (plot.hi - plot.lo)) * (H - 16)} y2={H - 8 - ((0 - plot.lo) / (plot.hi - plot.lo)) * (H - 16)} stroke="var(--line)" strokeDasharray="2 4" />
                  <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
              )}
              {plot?.silent && <p className="import-error">The function is undefined (silent) over the whole length.</p>}
              {parsed.ok.warnings.map((w) => (
                <p key={w} className="import-warn">
                  {w}
                </p>
              ))}

              <div className="import-options">
                <label className="field">
                  <span>Track name</span>
                  <TextField className="input" value={name} onValue={setName} />
                </label>
                <div className="field">
                  <span>x means</span>
                  <Seg<XMeans>
                    value={xMeans}
                    onChange={setXMeans}
                    options={[
                      { value: 'beats', label: 'Beats' },
                      { value: 'steps', label: 'Steps' },
                      { value: 'loop', label: '0 → 1 over the loop' },
                    ]}
                  />
                </div>
                <div className="field">
                  <span>y means</span>
                  <Seg<YMeans>
                    value={yMeans}
                    onChange={setYMeans}
                    options={[
                      { value: 'octaves', label: 'Octaves' },
                      { value: 'semitones', label: 'Semitones' },
                      { value: 'degrees', label: 'Scale degrees' },
                    ]}
                  />
                </div>
                <div className="field">
                  <span>“mod” in a sum reads as</span>
                  <Seg<'sum' | 'term'>
                    value={modReading}
                    onChange={setModReading}
                    options={[
                      { value: 'sum', label: 'a + b mod n = (a + b) mod n' },
                      { value: 'term', label: 'a + (b mod n)' },
                    ]}
                  />
                </div>
                <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label className="field" style={{ width: 90 }} title="Where the track begins along x — for functions that start at negative x">
                    <span>x starts at</span>
                    <NumberField className="input" value={xStart} onValue={setXStart} />
                  </label>
                  <label className="field" style={{ width: 90 }}>
                    <span>Length (beats)</span>
                    <NumberField className="input" min={0.25} max={256} value={length} onValue={setLength} />
                  </label>
                  <div className="field">
                    <span>Step</span>
                    <StepPicker value={stepBeats} onChange={setStepBeats} />
                  </div>
                  <div className="field">
                    <span>Play as</span>
                    <Seg<boolean>
                      value={glide}
                      onChange={setGlide}
                      options={[
                        { value: true, label: 'Glide (continuous)' },
                        { value: false, label: 'Notes' },
                      ]}
                    />
                  </div>
                  <label className="row" style={{ gap: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={articulate} onChange={(e) => setArticulate(e.target.checked)} />
                    re-attack every step
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="sheet-foot">
          <span className="muted">
            {parsed.ok
              ? `${steps} steps of ${stepBeats} beats${parsed.ok.gate ? ' · undefined regions become silence' : ''}${steps === 256 && length / stepBeats > 256 ? ' · capped at 256 steps' : ''}`
              : 'Your function stays exact: it becomes a Formula node you can keep editing.'}
          </span>
          <button className="btn primary" disabled={!parsed.ok} onClick={plant}>
            <Icon name="plus" size={13} /> Plant as a track
          </button>
        </footer>
      </div>
    </div>
  );
}
