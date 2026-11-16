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

/** a position in beats as bar.beat (1-based), with the sixteenth when it isn't on a beat */
function at(beat: number): string {
  const bar = Math.floor(beat / 4 + 1e-9), b = beat - bar * 4, whole = Math.floor(b + 1e-9), frac = Math.round((b - whole) * 4);
  return `${bar + 1}.${whole + 1}${frac ? `.${frac + 1}` : ''}`;
}
const beatsLabel = (beats: number) => (Math.abs(beats / 4 - Math.round(beats / 4)) < 1e-9 ? `${beats / 4} bar${beats === 4 ? '' : 's'}` : `${Math.round(beats * 100) / 100} beats`);

/** MIDI → functions: what was found, what each channel becomes, and where it goes */
export function MidiImportSheet() {
  const file = useMidiImport((s) => s.file);
  const plantImported = useStore((s) => s.plantImported);
  const songLength = useStore((s) => (s.project.song.lengthMode === 'free' ? null : s.project.song.lengthBeats));
  const [opts, setOpts] = useState(IMPORT_DEFAULTS);
  const fileBars = useMemo(() => (file ? barsOf(file.data) : 1), [file]);
  // nothing is worked out until you choose the stretch to bring in (in beats, on any grid division)
  const [range, setRange] = useState<[number, number] | null>(null);
  useEffect(() => setRange(null), [file]);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [adoptSong, setAdoptSong] = useState(true);
  const close = () => useMidiImport.setState({ file: null });

  const result = useMemo(() => (file && range ? midiToFunctions(file.data, { ...opts, fromBeat: range[0], toBeat: range[1] }, file.name) : null), [file, opts, range]);
  useEffect(() => setSkip(new Set()), [file]);
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file]);

  if (!file) return null;
  const channels = result?.channels ?? [];
  const chosen = channels.filter((_, i) => !skip.has(i));
  const plant = (layer: boolean) => {
    if (!result) return;
    const { song } = result;
    plantImported(
      chosen.map((c) => c.template),
      song,
      { layer, adoptSong, name: result.name },
    );
    close();
    toast(`${layer ? 'Added' : 'Planted'} ${chosen.length} channel${chosen.length === 1 ? '' : 's'} from “${file.name}” — ⌘Z to undo`);
  };
  const report = result?.report;
  const song = result?.song;
  const notes: string[] = [];
  if (report) {
  if (report.snapped) notes.push(`${report.snapped} note${report.snapped === 1 ? '' : 's'} outside ${report.keyName} snapped into the key`);
  if (report.truncatedBars) notes.push(`the last ${report.truncatedBars} bar${report.truncatedBars === 1 ? '' : 's'} didn’t fit the step limit and were left out`);
  if (report.tempoChanges > 1) notes.push(`the file changes tempo ${report.tempoChanges - 1} time${report.tempoChanges === 2 ? '' : 's'} — the first tempo is used`);
  if (report.timeSig[0] !== 4 || report.timeSig[1] !== 4) notes.push(`it is in ${report.timeSig[0]}/${report.timeSig[1]} — bars here are four beats`);
  if (songLength !== null && Math.abs(report.beats - songLength) > 1e-6)
    notes.push(
      report.beats > songLength
        ? `your song is ${songLength} beats (its Length is yours — an import never changes it): only the first ${songLength} of these ${Math.round(report.beats * 100) / 100} beats will play`
        : `your song is ${songLength} beats (its Length is yours — an import never changes it): these ${Math.round(report.beats * 100) / 100} beats loop to fill it`,
    );
  if (report.extraNotes) notes.push(`${report.extraNotes} note${report.extraNotes === 1 ? '' : 's'} no chord held (doublings, added tones, strays) kept on extra lines`);
  if (report.dropped) notes.push(`${report.dropped} note${report.dropped === 1 ? '' : 's'} beyond six at once left out`);
  }

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
              {!report || !song ? (
                <>
                  {file.data.bpm} bpm · {fileBars} bars · {file.data.parts.length} part{file.data.parts.length === 1 ? '' : 's'} — choose the stretch to bring in
                </>
              ) : (
                <>
              {song.bpm} bpm · {report.keyName} · {at(report.fromBeat)} → {at(report.fromBeat + report.beats)} ({beatsLabel(report.beats)}) · {channels.length} channel{channels.length === 1 ? '' : 's'}
              {song.harmony && song.harmony !== '0' && (
                <>
                  {' '}
                  · harmony <code>{song.harmony}</code>
                </>
              )}
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
          {!result && (
            <p className="midi-choose">
              <Icon name="info" size={13} /> Drag across the overview to choose the stretch to bring in — it snaps to the grid you pick (bars, beats, 1/8 or 1/16, or the notes themselves). Nothing is worked out until you do.
            </p>
          )}
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
          {/* Chords: found chord by chord — off, nothing else changes */}
          <div className="midi-options">
            <span className="midi-option-label">Chords</span>
            <button
              className={`btn small ${opts.smartChords ? 'on' : ''}`}
              aria-pressed={!!opts.smartChords}
              onClick={() => setOpts((o) => ({ ...o, smartChords: !o.smartChords }))}
              title="Keep chord parts together: the song keeps its key (a note outside it sounds exact through a semitone bend), chords are found chord by chord — stacks of thirds or fourths, octave doublings set aside, loosely played notes still one chord — and only what fits no chord goes to small extra lines. Off: a part is one chord channel only if every chord stacks in thirds, else every voice its own line."
            >
              Smart chords
            </button>
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

          {result && (
          <>
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
          </>
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

type Snap = 'bar' | 'beat' | 'eighth' | 'sixteenth' | 'note';
const SNAP_BEATS: Record<Exclude<Snap, 'note'>, number> = { bar: 4, beat: 1, eighth: 0.5, sixteenth: 0.25 };

/**
 * The whole file at a glance — every note on a strip of bars — and the stretch to bring in: drag
 * across it; the ends snap to the grid you pick (bars, beats, 1/8, 1/16) or to the notes'
 * own starts, so a part that begins off the bar comes in from where it begins.
 */
function BarPicker({ data, bars, range, onRange }: { data: MidiFileData; bars: number; range: [number, number] | null; onRange: (r: [number, number]) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [snap, setSnap] = useState<Snap>('bar');
  const total = bars * 4;
  // what the strip shows, in bars: all of it, or zoomed in on a stretch
  const [view, setView] = useState({ start: 0, span: bars });
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => setView({ start: 0, span: bars }), [bars, data]);
  const minSpan = Math.min(bars, 1);
  const clampView = (start: number, span: number) => {
    span = Math.max(minSpan, Math.min(bars, span));
    return { start: Math.max(0, Math.min(bars - span, start)), span };
  };
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
    const mid = range ? (range[0] + range[1]) / 8 : v.start + v.span / 2;
    setView(clampView(mid - span / 2, span));
  };
  const onsets = useMemo(() => [...new Set(data.parts.flatMap((p) => p.notes.map((n) => Math.round(n.beat * 1000) / 1000)))].sort((a, b) => a - b), [data]);
  /** a beat on the chosen grid: rounded to the division, or to the nearest note start */
  const snapTo = (beat: number) => {
    if (snap === 'note') {
      if (!onsets.length) return beat;
      let best = onsets[0];
      for (const o of onsets) if (Math.abs(o - beat) < Math.abs(best - beat)) best = o;
      return beat >= total - 0.01 ? total : best;
    }
    const d = SNAP_BEATS[snap];
    return Math.max(0, Math.min(total, Math.round(beat / d) * d));
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
    const ppbar = W / view.span;
    const every = Math.max(1, Math.ceil(28 / ppbar));
    g.font = '9px Doto, monospace';
    for (let b = Math.floor(view.start); b <= Math.ceil(view.start + view.span); b++) {
      const x = bx(b * 4);
      g.fillStyle = v('--lcd-line');
      g.globalAlpha = b % 4 === 0 ? 0.9 : 0.45;
      g.fillRect(Math.round(x), 12, 1, H - 12);
      // beats, and sixteenths when zoomed in far enough
      const sub = ppbar > 240 ? 16 : ppbar > 60 ? 4 : 1;
      for (let q = 1; q < sub; q++) {
        g.globalAlpha = q % (sub / 4) === 0 ? 0.22 : 0.1;
        g.fillRect(Math.round(bx(b * 4 + (q * 4) / sub)), 12, 1, H - 12);
      }
      if (b % every === 0 && b < bars) {
        g.globalAlpha = 0.8;
        g.fillStyle = v('--lcd-ink-3');
        g.fillText(String(b + 1), x + 2, 9);
      }
    }
    g.globalAlpha = 1;
    data.parts.forEach((p, i) => {
      g.fillStyle = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
      for (const n of p.notes) {
        if (n.end < a || n.beat > z) continue;
        if (p.channel === 9) g.fillRect(bx(n.beat), H - drumH + 2, Math.max(1.2, ppbar / 64), drumH - 4);
        else g.fillRect(bx(n.beat), my(n.midi), Math.max(1.2, bx(n.end) - bx(n.beat)), Math.max(2, Math.min(5, (H - 30) / Math.max(1, hi - lo))));
      }
    });
    if (shown) {
      // what is outside the selection steps back
      const sx0 = bx(shown[0]), sx1 = bx(shown[1]);
      g.fillStyle = v('--lcd');
      g.globalAlpha = 0.68;
      if (sx0 > 0) g.fillRect(0, 12, Math.min(W, sx0), H - 12);
      if (sx1 < W) g.fillRect(Math.max(0, sx1), 12, W - Math.max(0, sx1), H - 12);
      g.globalAlpha = 1;
      g.strokeStyle = v('--accent');
      g.lineWidth = 1.5;
      g.strokeRect(sx0 + 0.75, 12.75, sx1 - sx0 - 1.5, H - 13.5);
    }
  }, [data, bars, shown, lo, hi, view]);

  const beatAt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(total, (view.start + ((e.clientX - r.left) / r.width) * view.span) * 4));
  };
  /** a drag from beat a to beat b as a stretch on the grid — at least one division long */
  const stretch = (a: number, b: number): [number, number] => {
    let s0 = snapTo(Math.min(a, b)), s1 = snapTo(Math.max(a, b));
    if (s1 <= s0) {
      const d = snap === 'note' ? 1 : SNAP_BEATS[snap];
      s1 = Math.min(total, s0 + d);
      if (s1 <= s0) s0 = Math.max(0, s1 - d);
    }
    return [s0, s1];
  };
  const len = shown ? shown[1] - shown[0] : 0;
  const first = onsets.length ? onsets[0] : 0;
  /** n bars from where the selection (or the music) starts */
  const take = (n: number) => {
    const s0 = range ? range[0] : snapTo(first);
    onRange([Math.max(0, Math.min(s0, total - n * 4)), Math.min(total, Math.max(s0, 0) + n * 4)]);
  };
  const zoomed = view.span < bars - 1e-9;

  return (
    <div className="midi-bars">
      <canvas
        ref={ref}
        className="midi-overview"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const b = beatAt(e);
          (e.currentTarget as HTMLCanvasElement).dataset.anchor = String(b);
          setDrag(stretch(b, b));
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          setDrag(stretch(Number((e.currentTarget as HTMLCanvasElement).dataset.anchor), beatAt(e)));
        }}
        onPointerUp={() => {
          if (drag) onRange(drag);
          setDrag(null);
        }}
        onDoubleClick={() => setView(zoomed || !range ? { start: 0, span: bars } : clampView((range[0] + range[1]) / 8 - Math.max(minSpan, (len / 4) * 1.5) / 2, Math.max(minSpan, (len / 4) * 1.5)))}
        title="Drag across to choose the stretch to bring in · ⌘/Ctrl + scroll (or pinch) to zoom, scroll to move along · double-click to zoom to the selection"
      />
      <div className="midi-bars-row">
        <span className="muted">
          {shown ? (
            <>
              {at(shown[0])} → {at(shown[1])} <small>({beatsLabel(len)})</small>
            </>
          ) : (
            'Nothing chosen yet'
          )}
        </span>
        <span className="row" style={{ gap: 2 }}>
          <span className="midi-option-label">Snap</span>
          <span title="Where the ends of a drag land: on bars, beats, eighths or sixteenths — or on the notes’ own starts">
            <Seg<Snap>
              value={snap}
              onChange={setSnap}
              options={[
                { value: 'bar', label: 'Bar' },
                { value: 'beat', label: 'Beat' },
                { value: 'eighth', label: '1/8' },
                { value: 'sixteenth', label: '1/16' },
                { value: 'note', label: 'Note' },
              ]}
            />
          </span>
          <span className="midi-bars-gap" />
          <button className="icon-btn" onClick={() => zoomToSelection(1 / 1.6)} disabled={view.span <= minSpan + 1e-9} title="Zoom in on the selection (⌘/Ctrl + scroll, or pinch, zooms where you point)" aria-label="Zoom in">
            <Icon name="plus" size={12} />
          </button>
          <button className="icon-btn" onClick={() => zoomToSelection(1.6)} disabled={!zoomed} title="Zoom out around the selection" aria-label="Zoom out">
            <Icon name="minus" size={12} />
          </button>
          <button className="icon-btn" onClick={() => setView({ start: 0, span: bars })} disabled={!zoomed} title="Show the whole song" aria-label="Show the whole song">
            <Icon name="fit" size={12} />
          </button>
          <span className="midi-bars-gap" />
          {[4, 8, 16].filter((n) => n < bars).map((n) => (
            <button key={n} className={`btn small ${len === n * 4 ? 'on' : ''}`} onClick={() => take(n)} title={`${n} bars from where ${range ? 'the selection' : 'the music'} starts`}>
              {n} bars
            </button>
          ))}
          <button className={`btn small ${shown && shown[0] === 0 && len === total ? 'on' : ''}`} onClick={() => onRange([0, total])}>
            All
          </button>
        </span>
      </div>
    </div>
  );
}
