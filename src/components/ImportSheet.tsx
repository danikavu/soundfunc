import { useEffect, useMemo, useState } from 'react';
import { compileAst, type Ast } from '../engine/expr';
import { fitToSpan, importedPitch, importMath, ImportError, type Imported, type YMeans } from '../engine/importMath';
import { nativeTrack, readNative, type NativeRead } from '../engine/importChannel';
import { DEFAULT_PITCH_RANGE, midiToName } from '../engine/music';
import { TRACK_COLORS, layoutGraph, uid } from '../engine/presets';
import { simplify, substitute, toSource, toTex } from '../engine/symbolic';
import { TRACK_DEFAULTS, type Slider, type Track, type Waveform } from '../engine/project';
import { useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon, NumberField, Seg, TextField } from './ui';
import { Tex, useKatex } from './tex';
import { StepPicker } from './StepPicker';
import { shortBeats } from '../engine/steps';

type XMeans = 'beats' | 'steps' | 'loop';

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
  /** the time variable, when the reader's guess isn't right (null = let it guess) */
  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  /** slider starting values the user typed, by name */
  const [paramEdits, setParamEdits] = useState<Record<string, number>>({});
  /** when the function's length isn't the song's: free (each channel loops on its own), grow the song, or fit the song */

  /** fit y into a span of octaves: null = decide from the function (on when it can't be played as written) */
  const [fitChoice, setFitChoice] = useState<boolean | null>(null);
  const [fitOctaves, setFitOctaves] = useState(3);
  const song = useStore((s) => s.project.song);
  const katex = useKatex(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  // a new paste starts fresh: the reader guesses time again, sliders take the values as read
  useEffect(() => {
    setTimeChoice(null);
    setParamEdits({});
    setFitChoice(null);
  }, [src]);

  /** SoundFunc's own writing (what its function sheet copies): read back as the channels it came from */
  const native = useMemo((): { ok: NativeRead | null; error: string | null } => {
    try {
      return { ok: readNative(src), error: null };
    } catch (e) {
      return { ok: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [src]);
  /** a lone SoundFunc formula: which Note Out input it feeds */
  const [lonePort, setLonePort] = useState('pitch');

  const parsed = useMemo((): { ok: Imported | null; error: string | null } => {
    if (!src.trim() || native.ok) return { ok: null, error: null };
    if (native.error) return { ok: null, error: native.error };
    try {
      return { ok: importMath(src, { modReading, ...(timeChoice ? { timeVar: timeChoice } : {}) }), error: null };
    } catch (e) {
      return { ok: null, error: e instanceof ImportError || e instanceof Error ? e.message : String(e) };
    }
  }, [src, modReading, timeChoice, native]);

  /** the sliders this function will bring, with their values (as read, or as typed) */
  const params = useMemo(() => (parsed.ok?.params ?? []).map((p) => ({ ...p, value: paramEdits[p.name] ?? p.value })), [parsed.ok, paramEdits]);
  const paramScope = useMemo(() => Object.fromEntries(params.map((p) => [p.name, p.value])), [params]);

  /** x in the source → SoundFunc time (shifted so the track starts at x = xStart) */
  const timeAst = (): Ast => {
    const t: Ast = { k: 'var', name: 't' };
    const base: Ast = xMeans === 'steps' ? { k: 'bin', op: '/', a: t, b: { k: 'num', v: stepBeats } } : xMeans === 'loop' ? { k: 'var', name: 'x' } : t;
    return xStart ? { k: 'bin', op: '+', a: base, b: { k: 'num', v: xStart } } : base;
  };
  const toSf = (a: Ast) => simplify(substitute(a, { t: timeAst() }));

  // what will be heard: the channel's own length, unless the song's fixed Length decides
  const steps = Math.max(1, Math.min(1024, Math.round(length / stepBeats)));
  const ownLength = steps * stepBeats;
  const songFixed = song.lengthMode !== 'free';
  const mismatch = songFixed && Math.abs(ownLength - song.lengthBeats) > 1e-6;
  // the song's Length is yours: the function is cut to it, or runs on to fill it
  const heard = !mismatch ? ownLength : song.lengthBeats;

  // sample the function across exactly what the channel will play
  const range = song.pitchRange ?? DEFAULT_PITCH_RANGE;
  const sampled = useMemo(() => {
    const r = parsed.ok;
    if (!r) return null;
    const v = compileAst(r.value), g = r.gate ? compileAst(r.gate) : () => 1;
    const N = 480;
    const xs: number[] = [], ys: (number | null)[] = [];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) {
      const beats = (i / N) * heard;
      const x = xStart + (xMeans === 'beats' ? beats : xMeans === 'steps' ? beats / stepBeats : i / N);
      const scope = { ...paramScope, t: x };
      const y = g(scope) ? v(scope) : NaN;
      xs.push(x);
      if (Number.isFinite(y)) {
        ys.push(y);
        (lo = Math.min(lo, y)), (hi = Math.max(hi, y));
      } else ys.push(null);
    }
    if (!Number.isFinite(lo)) return { xs, ys, lo: 0, hi: 0, silent: true, runsAway: false };
    // as written: does it leave MIDI altogether, or span more than the pitch range holds?
    let pLo = Infinity, pHi = -Infinity;
    for (const y of ys) if (y !== null) {
      const { raw } = importedPitch(y, yMeans, song, glide);
      (pLo = Math.min(pLo, raw)), (pHi = Math.max(pHi, raw));
    }
    const runsAway = pLo < 0 || pHi > 127 || (range.mode !== 'off' && pHi - pLo > range.high - range.low);
    return { xs, ys, lo, hi, silent: false, runsAway };
  }, [parsed.ok, heard, xMeans, stepBeats, xStart, paramScope, yMeans, song, glide, range]);
  const fitting = !!sampled && !sampled.silent && (fitChoice ?? sampled.runsAway) && sampled.hi - sampled.lo > 1e-9;

  // …and the notes it becomes: what the channel plays, after the fit and the song's pitch range
  const plot = useMemo(() => {
    if (!sampled) return null;
    const { xs, ys } = sampled;
    const fitted = fitting ? compileAst(fitToSpan({ k: 'var', name: 'y' }, sampled.lo, sampled.hi, fitOctaves, yMeans, song.scale)) : null;
    const notes = ys.map((y) => (y === null ? null : importedPitch(fitted ? fitted({ y }) : y, yMeans, song, glide)));
    let lo = Infinity, hi = -Infinity, up = 0, down = 0, firstOut = -1;
    notes.forEach((p, i) => {
      if (!p) return;
      (lo = Math.min(lo, p.heard)), (hi = Math.max(hi, p.heard));
      if (Math.abs(p.heard - p.raw) > 1e-6) {
        if (firstOut < 0) firstOut = i;
        p.heard < p.raw ? up++ : down++;
      }
    });
    if (!Number.isFinite(lo)) return { notes, lo: 48, hi: 72, silent: true, up, down, firstX: null };
    // at least an octave in view, a semitone of room each side
    const mid = (lo + hi) / 2, half = Math.max(6, (hi - lo) / 2 + 1);
    return { notes, lo: mid - half, hi: mid + half, silent: false, up, down, firstX: firstOut < 0 ? null : xs[firstOut] };
  }, [sampled, fitting, fitOctaves, yMeans, song, glide]);

  if (!open) return null;

  const plantNative = () => {
    const read = native.ok;
    if (!read) return;
    const { plantTrack } = useStore.getState();
    for (const ch of read.channels) plantTrack(nativeTrack(ch, read.lone ? lonePort : undefined));
    setOpen(false);
    const names = read.channels.map((c) => `“${c.name}”`).join(', ');
    toast(read.format === 'saved' ? `Planted ${names} — exactly as it was saved` : `Planted ${names} from SoundFunc’s ${read.format === 'latex' ? 'LaTeX' : 'formulas'}`);
  };

  const plant = () => {
    const r = parsed.ok;
    if (!r) return;
    const value = toSource(toSf(fitting && sampled ? fitToSpan(r.value, sampled.lo, sampled.hi, fitOctaves, yMeans, song.scale) : r.value));
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
    // the function's parameters become the new track's own sliders
    const sliders: Slider[] = params.map(({ name: n, value: v }) => ({ name: n, value: v, ...(v > 0 ? { min: 0, max: v * 2 } : v < 0 ? { min: v * 2, max: 0 } : { min: -1, max: 1 }) }));
    const made = sliders.map((sl) => sl.name);
    const track: Track = {
      ...TRACK_DEFAULTS,
      id: uid('track'),
      name: name.trim() || 'Imported f(x)',
      color: TRACK_COLORS[project.tracks.length % TRACK_COLORS.length],
      graph,
      sliders,
      steps,
      stepBeats,
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
    const room = !mismatch ? '' : ownLength > song.lengthBeats ? ` · cut to the song’s ${shortBeats(song.lengthBeats)}` : ` · run on to the song’s ${shortBeats(song.lengthBeats)}`;
    toast(`Planted “${track.name}” — ${shortBeats(heard)}, ${glide ? 'glide' : 'notes'}${fitting ? `, fitted into ${fitOctaves} octaves` : ''}${room}${made.length ? ` · new slider${made.length > 1 ? 's' : ''}: ${made.join(', ')}` : ''}`);
  };

  const W = 640, H = 140;
  const yOf = (m: number) => (plot ? H - 8 - ((m - plot.lo) / (plot.hi - plot.lo)) * (H - 16) : 0);
  /** a polyline through the points `keep` allows, broken where it doesn't */
  const pathOf = (keep: (p: { raw: number; heard: number }) => boolean) =>
    plot
      ? plot.notes
          .map((p, i) => (p && keep(p) ? `${(i / (plot.notes.length - 1)) * W},${yOf(p.heard).toFixed(1)}` : null))
          .reduce<string[]>((acc, p, i, arr) => (p === null ? acc : [...acc, `${i && arr[i - 1] !== null ? 'L' : 'M'}${p}`]), [])
          .join('')
      : '';
  const path = pathOf(() => true);
  /** where the pitch range pinned or folded the function: drawn over the line in the warning colour */
  const outPath = pathOf((p) => Math.abs(p.heard - p.raw) > 1e-6);
  const band: [number, number] = range.mode === 'off' ? [0, 127] : [range.low, range.high];
  const bandLabel = range.mode === 'off' ? 'any pitch — MIDI 0…127' : `${midiToName(range.low)}–${midiToName(range.high)}, ${range.mode}`;
  const fmt = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1) : String(Number(v.toPrecision(3))));

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="sheet import-sheet" role="dialog" aria-label="Paste a function">
        <header className="sheet-head">
          <div>
            <div className="eyebrow" style={{ margin: 0 }}>
              Paste a function
            </div>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-md)' }}>
              LaTeX (Desmos: select an expression, ⌘C), <code className="mono">\begin{'{cases}'}</code>, plain math with ⌊ ⌋, mod, frac, n!, ≥ — or several lines: helper
              definitions like <code className="mono">g(x) = …</code> and <code className="mono">IF … : / ELSE IF / OTHERWISE</code> blocks. y as a function of x. What SoundFunc’s
              function sheet copies (LaTeX or formulas) comes back as the channels it came from.
            </p>
          </div>
          <button className="icon-btn" onClick={() => setOpen(false)} title="Close (Esc)">
            <Icon name="close" />
          </button>
        </header>

        <div className="sheet-body import-body">
          <div className="import-src-wrap">
            <textarea
              className="formula import-src"
              autoFocus
              spellCheck={false}
              placeholder="y = ⌊(12·mod(3⌊x/2⌋ + 5, 7) + 2)/7⌋/12 + e^(−12 frac(4x))/6"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              rows={4}
            />
            <button
              className="btn small import-paste"
              title="Paste from the clipboard — replaces what is in the box"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (!text.trim()) return toast('The clipboard is empty');
                  setSrc(text);
                } catch {
                  toast('The browser blocked reading the clipboard — click in the box and press ⌘V');
                }
              }}
            >
              <Icon name="copy" size={12} /> Paste
            </button>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Try:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} className="btn small ghost" onClick={() => setSrc(ex.src)}>
                {ex.label}
              </button>
            ))}
          </div>

          {native.ok && (
            <div className="import-native">
              <p className="import-native-head">
                {native.ok.format === 'saved'
                  ? 'A SoundFunc document: its channels come back exactly as they were — nodes, sound and grid.'
                  : native.ok.lone
                    ? 'A SoundFunc formula. Choose the Note Out input it feeds:'
                    : `SoundFunc’s own ${native.ok.format === 'latex' ? 'LaTeX' : 'formulas'}: ${native.ok.channels.length === 1 ? 'the channel' : `${native.ok.channels.length} channels`} it came from, with every input.`}
              </p>
              {native.ok.lone && (
                <Seg<string>
                  value={lonePort}
                  onChange={setLonePort}
                  options={['pitch', 'velocity', 'length', 'shift', 'chord', 'bend'].map((p) => ({ value: p, label: p }))}
                />
              )}
              {native.ok.channels.map((ch, i) => (
                <section key={i} className="import-native-ch">
                  <b>{ch.name}</b>
                  <small className="muted">
                    {ch.track
                      ? `${ch.track.graph.nodes.length} nodes · ${ch.track.steps} steps of ${ch.track.stepBeats} beats`
                      : `${ch.steps ?? 16} steps of ${ch.stepBeats ?? 0.25} beats${ch.sliders.length ? ` · sliders ${ch.sliders.map((s) => `${s.name} = ${s.value}`).join(', ')}` : ''}`}
                  </small>
                  {ch.outputs.map((o) => (
                    <div key={o.port} className="fn-line">
                      <span className="fn-label">{native.ok!.lone ? lonePort : o.port}</span>
                      <Tex tex={toTex(o.ast)} katex={katex} />
                    </div>
                  ))}
                </section>
              ))}
              {native.ok.warnings.map((w) => (
                <p key={w} className="import-warn">
                  {w}
                </p>
              ))}
            </div>
          )}
          {/* the preview keeps one size whatever is in it, so the sheet never jumps */}
          {!native.ok && (
          <div className="import-preview">
            <div className="import-read">
              <span className="fn-label">read as</span>
              <div className="import-read-tex">
                {parsed.ok ? (
                  /* shown with the source's own time variable (h, x, θ…), not SoundFunc's t */
                  <Tex tex={`y = ${toTex(substitute(parsed.ok.raw, { t: { k: 'var', name: parsed.ok.timeVar } }))}`} katex={katex} />
                ) : (
                  <span className="muted">{parsed.error ? '—' : 'Paste or type a function above'}</span>
                )}
              </div>
            </div>
            <div className="import-plot-box">
              {parsed.ok && plot ? (
                <svg className="import-plot" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  {/* every C, faintly — the plot is in notes, as the channel will play them */}
                  {Array.from({ length: 11 }, (_, o) => o * 12)
                    .filter((m) => m > plot.lo && m < plot.hi)
                    .map((m) => (
                      <line key={m} x1="0" x2={W} y1={yOf(m)} y2={yOf(m)} stroke="var(--line-soft)" />
                    ))}
                  {/* the edges of the pitch range, when the notes reach them */}
                  {band
                    .filter((m) => m > plot.lo && m < plot.hi)
                    .map((m) => (
                      <line key={`edge${m}`} className="import-edge" x1="0" x2={W} y1={yOf(m)} y2={yOf(m)} strokeDasharray="3 4" />
                    ))}
                  <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                  {outPath && <path className="import-out" d={outPath} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
                </svg>
              ) : (
                <div className="import-plot empty" />
              )}
              {parsed.error && <p className="import-error import-overlay">{parsed.error}</p>}
              {parsed.ok && plot && !plot.silent && (
                <>
                  <span className="import-note top">{midiToName(Math.round(plot.hi - 1))}</span>
                  <span className="import-note bottom">{midiToName(Math.round(plot.lo + 1))}</span>
                </>
              )}
              {parsed.ok && <span className="import-heard">{shortBeats(heard)}</span>}
              {parsed.ok && plot?.silent && <p className="import-error import-overlay">The function is undefined (silent) over the whole length.</p>}
            </div>
          </div>
          )}
          {parsed.ok && (
            <>
              {plot && sampled && !sampled.silent && (fitting || plot.up + plot.down > 0 || sampled.runsAway) && (
                <div className="import-fit">
                  <span>
                    {fitting ? (
                      <>
                        Fitted: y from <b>{fmt(sampled.lo)}</b> to <b>{fmt(sampled.hi)}</b> is scaled into <b>{fitOctaves} octaves</b> around {midiToName(60 + song.root)}, so the
                        whole shape plays.
                      </>
                    ) : (
                      sampled.runsAway && (
                      <>
                        As written, y runs from <b>{fmt(sampled.lo)}</b> to <b>{fmt(sampled.hi)}</b>
                        {yMeans === 'octaves' ? ' octaves' : yMeans === 'semitones' ? ' semitones' : ' scale degrees'} — more than the pitch range holds ({bandLabel}).
                      </>
                      )
                    )}
                    {plot.up + plot.down > 0 && plot.firstX !== null && (
                      <>
                        {' '}
                        From {parsed.ok.timeVar} ≈ {fmt(plot.firstX)}, {Math.round(((plot.up + plot.down) / plot.notes.filter(Boolean).length) * 100)}% of it{' '}
                        {range.mode === 'wrap' ? 'is folded back by octaves' : plot.up && plot.down ? 'sits on the top or bottom note' : plot.up ? 'sits on the top note' : 'sits on the bottom note'} — the
                        highlighted part of the preview.
                      </>
                    )}
                  </span>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Seg<boolean>
                      value={fitting}
                      onChange={setFitChoice}
                      options={[
                        { value: false, label: 'As written' },
                        { value: true, label: 'Fit y to range' },
                      ]}
                    />
                    {fitting && (
                      <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }}>
                        <NumberField className="input num" min={0.25} max={10} value={fitOctaves} onValue={setFitOctaves} aria-label="Octaves to fit into" style={{ width: 64 }} />
                        octaves
                      </label>
                    )}
                  </div>
                </div>
              )}
              {mismatch && (
                <div className="import-fit">
                  <span>
                    The song is <b>{shortBeats(song.lengthBeats)}</b> long; this function lasts <b>{shortBeats(ownLength)}</b>. The preview shows what you will hear.
                  </span>
                  <small className="muted">
                    {ownLength > song.lengthBeats
                      ? `Only the first ${shortBeats(song.lengthBeats)} play — the song’s Length is yours to change (top bar), an import never changes it.`
                      : `The function carries on past its length to fill the song’s ${shortBeats(song.lengthBeats)}.`}
                  </small>
                </div>
              )}
              {parsed.ok.warnings.map((w) => (
                <p key={w} className="import-warn">
                  {w}
                </p>
              ))}

              <div className="import-options">
                {(parsed.ok.names.length > 1 || parsed.ok.timeVar !== 'x') && (
                  <div className="field">
                    <span>Time variable — the one that moves</span>
                    <Seg<string>
                      value={parsed.ok.timeVar}
                      onChange={(v) => setTimeChoice(v)}
                      options={[...new Set([parsed.ok.timeVar, ...parsed.ok.names])].map((n) => ({ value: n, label: n }))}
                    />
                  </div>
                )}
                {params.length > 0 && (
                  <div className="field">
                    <span>Sliders — every other name becomes one you can play with</span>
                    <div className="import-params">
                      {params.map((prm) => (
                        <label key={prm.name} className="import-param">
                          <code>{prm.name}</code>
                          <NumberField className="input num" value={prm.value} onValue={(v) => setParamEdits((e) => ({ ...e, [prm.name]: v }))} aria-label={`${prm.name} starts at`} />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <label className="field">
                  <span>Channel name</span>
                  <TextField className="input" value={name} onValue={setName} />
                </label>
                <div className="field">
                  <span>{parsed.ok.timeVar} means</span>
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
                  <label className="field" style={{ width: 90 }} title="Where the channel begins along x — for functions that start at negative x">
                    <span>{parsed.ok.timeVar} starts at</span>
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
                  <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }}>
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
            {native.ok
              ? 'Every input becomes a Formula node you can keep editing; the song’s Length stays yours.'
              : parsed.ok
              ? `${steps} steps of ${stepBeats} beats${parsed.ok.gate ? ' · undefined regions become silence' : ''}${steps === 256 && length / stepBeats > 256 ? ' · capped at 256 steps' : ''}`
              : 'Your function stays exact: it becomes a Formula node you can keep editing.'}
          </span>
          {native.ok ? (
            <button className="btn primary" onClick={plantNative}>
              <Icon name="plus" size={13} /> Plant {native.ok.channels.length > 1 ? `${native.ok.channels.length} channels` : 'the channel'}
            </button>
          ) : (
            <button className="btn primary" disabled={!parsed.ok} onClick={plant}>
              <Icon name="plus" size={13} /> Plant as a channel
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
