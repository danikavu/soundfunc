import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { IMPORT_DEFAULTS, barsOf, midiToFunctions, parseMidi, type Feel, type MidiFileData } from '../engine/midiImport';
import { CHANNEL_COLORS } from '../engine/project';
import { voiceLabel, type Waveform } from '../engine/project';
import { useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon, Seg } from './ui';

/** the MIDI file waiting to be planted, and whether a file is being dragged over the window */
export const useMidiImport = create<{ file: { name: string; data: MidiFileData } | null; dragging: boolean }>(() => ({ file: null, dragging: false }));

export const isMidiFile = (f: File) => /\.(mid|midi|smf)$/i.test(f.name) || f.type === 'audio/midi' || f.type === 'audio/x-midi';

/** read a MIDI file and open the import sheet on it */
export async function openMidiFile(f: File) {
  try {
    const data = parseMidi(new Uint8Array(await f.arrayBuffer()));
    if (!data.parts.length) return toast(`“${f.name}” has no notes in it`);
    useMidiImport.setState({ file: { name: f.name, data } });
  } catch (err) {
    toast(err instanceof Error ? `Couldn’t read “${f.name}” — ${err.message}` : `Couldn’t read “${f.name}”`);
  }
}

const KIND: Record<string, string> = { drums: 'Drums', melody: 'Line', chords: 'Chords', voice: 'Voice' };
const FEEL_HINT: Record<Feel, string> = {
  functions: 'The feel as functions: each position’s level and lateness, ghost notes as chance(), and the hand’s variation as a rand() of the same spread — short loops, no long lists. Every pass differs, as played.',
  exact: 'Note for note: every velocity and every note’s distance from the grid kept as lists. Long lists for long, humanised parts.',
  grid: 'Everything on the grid, dynamics tidied into a few levels — the plainest functions.',
};
const OPTION_HINTS: Record<'harmony' | 'exact', [string, string]> = {
  harmony: ['Follow the chords', 'Find the chord of each bar, set it as the song’s Harmony, and write parts against it (h + …) when that is simpler — change the harmony later and the parts follow.'],
  exact: ['Every note exact', 'Notes outside the key make the song use every semitone, so nothing moves. Off: the song keeps its key and those notes snap to the nearest note in it.'],
};

/** MIDI → functions: what was found, what each channel becomes, and where it goes */
export function MidiImportSheet() {
  const file = useMidiImport((s) => s.file);
  const plantImported = useStore((s) => s.plantImported);
  const [opts, setOpts] = useState(IMPORT_DEFAULTS);
  const fileBars = useMemo(() => (file ? barsOf(file.data) : 1), [file]);
  // a long song opens on eight bars from where the music starts — a loop, not the whole thing
  const [range, setRange] = useState<[number, number]>([0, 1]);
  useEffect(() => {
    if (!file) return;
    const first = Math.floor(Math.min(...file.data.parts.flatMap((p) => p.notes.map((n) => n.beat))) / 4);
    setRange(fileBars > 8 ? [first, Math.min(fileBars, first + 8)] : [0, fileBars]);
  }, [file, fileBars]);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [adoptSong, setAdoptSong] = useState(true);
  const close = () => useMidiImport.setState({ file: null });

  const result = useMemo(() => (file ? midiToFunctions(file.data, { ...opts, from: range[0], to: range[1] }, file.name) : null), [file, opts, range]);
  useEffect(() => setSkip(new Set()), [file]);
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file]);

  if (!file || !result) return null;
  const { report, song, channels } = result;
  const chosen = channels.filter((_, i) => !skip.has(i));
  const plant = (layer: boolean) => {
    plantImported(
      chosen.map((c) => c.template),
      song,
      { layer, adoptSong, name: result.name },
    );
    close();
    toast(`${layer ? 'Added' : 'Planted'} ${chosen.length} channel${chosen.length === 1 ? '' : 's'} from “${file.name}” — ⌘Z to undo`);
  };
  const notes: string[] = [];
  if (report.snapped) notes.push(`${report.snapped} note${report.snapped === 1 ? '' : 's'} outside ${report.keyName} snapped into the key`);
  if (report.truncatedBars) notes.push(`the last ${report.truncatedBars} bar${report.truncatedBars === 1 ? '' : 's'} didn’t fit the step limit and were left out`);
  if (report.tempoChanges > 1) notes.push(`the file changes tempo ${report.tempoChanges - 1} time${report.tempoChanges === 2 ? '' : 's'} — the first tempo is used`);
  if (report.timeSig[0] !== 4 || report.timeSig[1] !== 4) notes.push(`it is in ${report.timeSig[0]}/${report.timeSig[1]} — bars here are four beats`);
  if (report.dropped) notes.push(`${report.dropped} note${report.dropped === 1 ? '' : 's'} beyond six at once left out`);

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet midi-sheet" role="dialog" aria-label="Import MIDI">
        <header className="sheet-head">
          <div>
            <div className="eyebrow" style={{ margin: 0 }}>
              MIDI → functions
            </div>
            <h2 className="serif sheet-title">{file.name}</h2>
            <p className="muted midi-found">
              {song.bpm} bpm · {report.keyName} · bars {report.from + 1}–{report.from + report.bars} of {report.fileBars} · {channels.length} channel{channels.length === 1 ? '' : 's'}
              {song.harmony && song.harmony !== '0' && (
                <>
                  {' '}
                  · harmony <code>{song.harmony}</code>
                </>
              )}
            </p>
          </div>
          <button className="icon-btn" onClick={close} title="Close (Esc)" aria-label="Close">
            <Icon name="close" />
          </button>
        </header>

        <div className="sheet-body">
          <BarPicker data={file.data} bars={fileBars} range={range} onRange={setRange} />
          <div className="midi-options">
            <span className="midi-option-label">Feel</span>
            <span title={FEEL_HINT[opts.feel]}>
              <Seg<Feel>
                value={opts.feel}
                onChange={(feel) => setOpts((o) => ({ ...o, feel }))}
                options={[
                  { value: 'functions', label: 'Functions' },
                  { value: 'exact', label: 'Exact' },
                  { value: 'grid', label: 'Grid' },
                ]}
              />
            </span>
            {(Object.keys(OPTION_HINTS) as ('harmony' | 'exact')[]).map((k) => (
              <button key={k} className={`btn small ${opts[k] ? 'on' : ''}`} aria-pressed={opts[k]} title={OPTION_HINTS[k][1]} onClick={() => setOpts((o) => ({ ...o, [k]: !o[k] }))}>
                {OPTION_HINTS[k][0]}
              </button>
            ))}
          </div>
          {/* Math: the melodic lines' pitch as sums of sines — off, nothing else changes */}
          <div className="midi-options">
            <span className="midi-option-label">Math</span>
            <button
              className={`btn small ${opts.math ? 'on' : ''}`}
              aria-pressed={!!opts.math}
              onClick={() => setOpts((o) => ({ ...o, math: o.math ? undefined : { terms: 'exact', glide: false } }))}
              title="Write each melodic line's pitch as a sum of sines over the loop — c + A·sin(k·τ·x + φ)… — fitted where its notes play. A pure function, no list: it can be bent, mutated, read. Off: the lists, as ever."
            >
              Sum of sines
            </button>
            {opts.math && (
              <>
                <span className="midi-option-label" style={{ marginLeft: 'var(--sp-3)' }}>
                  Terms
                </span>
                <span title="Exact: as many sines as it takes for every note to land. A number: at most that many — a simpler contour that keeps the line’s shape; each channel says how many of its notes still land.">
                  <Seg<string>
                    value={String(opts.math.terms)}
                    onChange={(v) => setOpts((o) => ({ ...o, math: { ...o.math!, terms: v === 'exact' ? 'exact' : Number(v) } }))}
                    options={[
                      { value: 'exact', label: 'Exact' },
                      { value: '1', label: '1' },
                      { value: '2', label: '2' },
                      { value: '4', label: '4' },
                    ]}
                  />
                </span>
                <button
                  className={`btn small ${opts.math.glide ? 'on' : ''}`}
                  aria-pressed={opts.math.glide}
                  onClick={() => setOpts((o) => ({ ...o, math: { ...o.math!, glide: !o.math!.glide } }))}
                  title="Play each line as a glide: one voice sliding from note to note along its curve, held for each note’s length (the series keeps to slow harmonics, so the line flows)"
                  style={{ marginLeft: 'var(--sp-2)' }}
                >
                  Glide line
                </button>
              </>
            )}
          </div>

          <div className="midi-channels-head">
            <span className="midi-option-label">
              Channels <small>{chosen.length} of {channels.length}</small>
            </span>
            <span className="row" style={{ gap: 2 }}>
              <button className="btn small" disabled={!skip.size} onClick={() => setSkip(new Set())}>
                Select all
              </button>
              <button className="btn small" disabled={skip.size === channels.length} onClick={() => setSkip(new Set(channels.map((_, i) => i)))}>
                Select none
              </button>
            </span>
          </div>
          <ul className="midi-channels">
            {channels.map((c, i) => (
              <li key={`${c.template.name}-${i}`} className={skip.has(i) ? 'off' : ''}>
                <label className="midi-pick">
                  <input
                    type="checkbox"
                    checked={!skip.has(i)}
                    onChange={() =>
                      setSkip((s) => {
                        const next = new Set(s);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  />
                  <b>{c.template.name}</b>
                </label>
                <span className="muted midi-meta">
                  {KIND[c.kind]} · {voiceLabel(c.template.waveform as Waveform)} · {c.grid} · {c.steps} steps · {c.notes} note{c.notes === 1 ? '' : 's'}
                  {c.match !== undefined && c.kind !== 'drums' && ` · ${c.match === 1 ? 'every note exact' : `${Math.round(c.match * 100)}% of notes exact`}`}
                  {c.template.playMode === 'glide' && ' · glide'}
                </span>
                <div className="midi-formulas">
                  {Object.entries(c.formulas).map(([port, f]) => (
                    <div key={port} className="midi-formula" title={f}>
                      <span>{port}</span>
                      <code>{f}</code>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {notes.length > 0 && (
            <p className="muted midi-notes">
              <Icon name="info" size={12} /> {notes.join(' · ')}.
            </p>
          )}
        </div>

        <footer className="sheet-foot">
          <label className="row midi-adopt" title="The channels are written in the file’s key and against its chords; without them their notes follow your song instead">
            <input type="checkbox" checked={adoptSong} onChange={(e) => setAdoptSong(e.target.checked)} /> Use the file’s tempo, key &amp; chords when adding
          </label>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn" disabled={!chosen.length} onClick={() => plant(true)} title="Add these channels to the track you’re working on">
              <Icon name="plus" size={13} /> Add to track
            </button>
            <button className="btn primary" disabled={!chosen.length} onClick={() => plant(false)} title="Replace the track with these channels, at the file’s tempo and key">
              Replace track
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** a file dragged over the window: say what dropping it does */
export function MidiDropOverlay() {
  const dragging = useMidiImport((s) => s.dragging);
  if (!dragging) return null;
  return (
    <div className="midi-drop" aria-hidden>
      <div>
        <Icon name="upload" size={28} />
        <b>Drop a MIDI file</b>
        <span className="muted">it becomes channels of functions</span>
      </div>
    </div>
  );
}

/**
 * The whole file at a glance — every note on a strip of bars — and the bars to bring in: drag
 * across it (it snaps to bars), or take 4, 8 or 16 bars from where the selection starts.
 */
function BarPicker({ data, bars, range, onRange }: { data: MidiFileData; bars: number; range: [number, number]; onRange: (r: [number, number]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  // what the strip shows, in bars: all of it, or zoomed in on a stretch
  const [view, setView] = useState({ start: 0, span: bars });
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => setView({ start: 0, span: bars }), [bars, data]);
  const minSpan = Math.min(bars, 2);
  const clampView = (start: number, span: number) => {
    span = Math.max(minSpan, Math.min(bars, span));
    return { start: Math.max(0, Math.min(bars - span, start)), span };
  };
  /** zoom by a factor around a point of the strip (0 … 1 across it) */
  const zoom = (factor: number, at = 0.5) => {
    const v = viewRef.current;
    const span = Math.max(minSpan, Math.min(bars, v.span * factor));
    setView(clampView(v.start + (v.span - span) * at, span));
  };
  const shown = drag ?? range;
  /** zoom with the selection at the centre (as near as the ends of the song allow) */
  const zoomToSelection = (factor: number) => {
    const v = viewRef.current;
    const span = Math.max(minSpan, Math.min(bars, v.span * factor));
    setView(clampView((range[0] + range[1]) / 2 - span / 2, span));
  };
  const [lo, hi] = useMemo(() => {
    const ms = data.parts.filter((p) => p.channel !== 9).flatMap((p) => p.notes.map((n) => n.midi));
    return ms.length ? [Math.min(...ms) - 1, Math.max(...ms) + 1] : [48, 72];
  }, [data]);

  // ⌘/Ctrl + scroll or a pinch zooms around the pointer; scroll pans along the song
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const at = (e.clientX - r.left) / r.width;
      if (e.ctrlKey || e.metaKey) zoom(Math.exp(e.deltaY * 0.01), at);
      else {
        const v = viewRef.current;
        const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / r.width;
        setView(clampView(v.start + d * v.span, v.span));
      }
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const a = view.start * 4, z = (view.start + view.span) * 4;
    const bx = (beat: number) => ((beat - a) / (z - a)) * W;
    const drumH = data.parts.some((p) => p.channel === 9) ? 14 : 0;
    const my = (m: number) => 14 + (1 - (m - lo) / Math.max(1, hi - lo)) * (H - 30 - drumH);
    g.fillStyle = v('--lcd');
    g.fillRect(0, 0, W, H);
    // bars: a line each (beats too, zoomed in far enough), a number where there is room
    const ppbar = W / view.span;
    const every = Math.max(1, Math.ceil(28 / ppbar));
    g.font = '9px Doto, monospace';
    for (let b = Math.floor(view.start); b <= Math.ceil(view.start + view.span); b++) {
      const x = bx(b * 4);
      g.fillStyle = v('--lcd-line');
      g.globalAlpha = b % 4 === 0 ? 0.9 : 0.45;
      g.fillRect(Math.round(x), 12, 1, H - 12);
      if (ppbar > 60)
        for (let q = 1; q < 4; q++) {
          g.globalAlpha = 0.18;
          g.fillRect(Math.round(bx(b * 4 + q)), 12, 1, H - 12);
        }
      if (b % every === 0 && b < bars) {
        g.globalAlpha = 0.8;
        g.fillStyle = v('--lcd-ink-3');
        g.fillText(String(b + 1), x + 2, 9);
      }
    }
    g.globalAlpha = 1;
    // the notes in view: melodic parts by pitch, drums as ticks along the bottom
    data.parts.forEach((p, i) => {
      g.fillStyle = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
      for (const n of p.notes) {
        if (n.end < a || n.beat > z) continue;
        if (p.channel === 9) g.fillRect(bx(n.beat), H - drumH + 2, Math.max(1.2, ppbar / 64), drumH - 4);
        else g.fillRect(bx(n.beat), my(n.midi), Math.max(1.2, bx(n.end) - bx(n.beat)), Math.max(2, Math.min(5, (H - 30) / Math.max(1, hi - lo))));
      }
    });
    // what is outside the selection steps back
    const sx0 = bx(shown[0] * 4), sx1 = bx(shown[1] * 4);
    g.fillStyle = v('--lcd');
    g.globalAlpha = 0.68;
    if (sx0 > 0) g.fillRect(0, 12, Math.min(W, sx0), H - 12);
    if (sx1 < W) g.fillRect(Math.max(0, sx1), 12, W - Math.max(0, sx1), H - 12);
    g.globalAlpha = 1;
    g.strokeStyle = v('--accent');
    g.lineWidth = 1.5;
    g.strokeRect(sx0 + 0.75, 12.75, sx1 - sx0 - 1.5, H - 13.5);
  }, [data, bars, shown, lo, hi, view]);

  const barAt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(bars - 1, Math.floor(view.start + ((e.clientX - r.left) / r.width) * view.span)));
  };
  const span = shown[1] - shown[0];
  const take = (n: number) => onRange([Math.min(range[0], Math.max(0, bars - n)), Math.min(bars, Math.max(range[0], 0) + n)]);
  const zoomed = view.span < bars - 1e-9;

  return (
    <div className="midi-bars">
      <canvas
        ref={ref}
        className="midi-overview"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const b = barAt(e);
          setDrag([b, b + 1]);
          (e.currentTarget as HTMLCanvasElement).dataset.anchor = String(b);
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const a = Number((e.currentTarget as HTMLCanvasElement).dataset.anchor), b = barAt(e);
          setDrag([Math.min(a, b), Math.max(a, b) + 1]);
        }}
        onPointerUp={() => {
          if (drag) onRange(drag);
          setDrag(null);
        }}
        onDoubleClick={() => setView(zoomed ? { start: 0, span: bars } : clampView((shown[0] + shown[1]) / 2 - Math.max(minSpan, span * 1.5) / 2, Math.max(minSpan, span * 1.5)))}
        title="Drag across the bars to bring in · ⌘/Ctrl + scroll (or pinch) to zoom, scroll to move along · double-click to zoom to the selection"
      />
      <div className="midi-bars-row">
        <span className="muted">
          Bars {shown[0] + 1}–{shown[1]} <small>({span} of {bars})</small>
        </span>
        <span className="row" style={{ gap: 2 }}>
          <button className="icon-btn" onClick={() => zoomToSelection(1 / 1.6)} disabled={view.span <= minSpan + 1e-9} title="Zoom in on the selected bars (⌘/Ctrl + scroll, or pinch, zooms where you point)" aria-label="Zoom in">
            <Icon name="plus" size={12} />
          </button>
          <button className="icon-btn" onClick={() => zoomToSelection(1.6)} disabled={!zoomed} title="Zoom out around the selected bars" aria-label="Zoom out">
            <Icon name="minus" size={12} />
          </button>
          <button className="icon-btn" onClick={() => setView({ start: 0, span: bars })} disabled={!zoomed} title="Show the whole song" aria-label="Show the whole song">
            <Icon name="fit" size={12} />
          </button>
          <span className="midi-bars-gap" />
          {[4, 8, 16].filter((n) => n < bars).map((n) => (
            <button key={n} className={`btn small ${span === n ? 'on' : ''}`} onClick={() => take(n)}>
              {n} bars
            </button>
          ))}
          <button className={`btn small ${span === bars ? 'on' : ''}`} onClick={() => onRange([0, bars])}>
            All
          </button>
        </span>
      </div>
    </div>
  );
}
