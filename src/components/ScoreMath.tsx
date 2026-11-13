import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { audibleTracks, isDrum, type Track } from '../engine/project';
import { compose, trackTex } from '../engine/symbolic';
import { useStore } from '../state/store';
import { Tex, useKatex } from './tex';
import { Icon } from './ui';

type Detail = 'main' | 'all';
const KEY = 'sf.scoreMath';

/** how big the math is drawn: 50% … 300% */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

function load(): { open: boolean; detail: Detail; zoom: number } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '');
    return { open: !!v.open, detail: v.detail === 'all' ? 'all' : 'main', zoom: clampZoom(Number(v.zoom) || 1) };
  } catch {
    return { open: false, detail: 'main', zoom: 1 };
  }
}

/** what a channel shows: its tune (a drum, its rhythm) — or every Note Out input and the named parts */
function linesOf(t: Track, song: Parameters<typeof trackTex>[1], detail: Detail) {
  const lines = trackTex(compose(t), song);
  if (detail === 'all') return lines.filter((l) => l.label !== 'n runs over' && l.label !== 'pitch → MIDI');
  const main = lines.find((l) => l.label === (isDrum(t.waveform) ? 'velocity' : 'pitch')) ?? lines[0];
  return main ? [main] : [];
}

/** whether the Score shows its functions, how much of them and how big — remembered between visits */
export function useScoreMath() {
  const [state, setState] = useState(load);
  const set = useCallback(
    (patch: Partial<ReturnType<typeof load>>) =>
      setState((s) => {
        const next = { ...s, ...patch };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* private window: it just won't be remembered */
        }
        return next;
      }),
    [],
  );
  return [state, set] as const;
}

/**
 * The Score's functions, in place: a panel over the score that writes each channel you can hear
 * as math, so a screen recording shows the notes and the functions that make them together.
 * It follows mute, solo, new and removed channels as they happen.
 */
export function ScoreMath({ detail, onDetail, zoom, onZoom }: { detail: Detail; onDetail: (d: Detail) => void; zoom: number; onZoom: (z: number) => void }) {
  const tracks = useStore((s) => s.project.tracks);
  const song = useStore((s) => s.project.song);
  const katex = useKatex();
  const heard = useMemo(() => audibleTracks(tracks), [tracks]);
  const shown = useMemo(() => heard.map((t) => ({ track: t, lines: linesOf(t, song, detail) })), [detail, heard, song]);
  const ref = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const zoomTo = (z: number) => onZoom(clampZoom(z));

  // ⌘/Ctrl + scroll (or a trackpad pinch) zooms the math; plain scrolling scrolls the strip
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoom(clampZoom(zoomRef.current * Math.exp(-e.deltaY * 0.003)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onZoom]);

  return (
    <div className="score-math" ref={ref} style={{ '--math-zoom': zoom } as CSSProperties}>
      <div className="score-math-head">
        <span className="score-math-title">Functions</span>
        <span className="score-math-tools">
          <button className="icon-btn" onClick={() => zoomTo(zoom / 1.2)} disabled={zoom <= ZOOM_MIN} title="Smaller (⌘/Ctrl + scroll, or pinch)" aria-label="Zoom out">
            <Icon name="minus" size={12} />
          </button>
          <span className="score-math-zoom" onDoubleClick={() => zoomTo(1)} title="Double-click for 100%">
            {Math.round(zoom * 100)}%
          </span>
          <button className="icon-btn" onClick={() => zoomTo(zoom * 1.2)} disabled={zoom >= ZOOM_MAX} title="Bigger (⌘/Ctrl + scroll, or pinch)" aria-label="Zoom in">
            <Icon name="plus" size={12} />
          </button>
          <button
            className={`btn small ghost score-math-all ${detail === 'all' ? 'on' : ''}`}
            aria-pressed={detail === 'all'}
            onClick={() => onDetail(detail === 'all' ? 'main' : 'all')}
            title={detail === 'all' ? 'Every Note Out input and the named parts — click for just the tune' : 'Just the tune (a drum: its rhythm) — click for every input'}
          >
            All
          </button>
        </span>
      </div>
      {/* the channels scroll, both ways, under the header */}
      <div className="score-math-body">
        {!shown.length && <p className="muted">No channel is sounding.</p>}
        {shown.map(({ track, lines }) => (
          <section key={track.id} className="score-math-ch">
            <span className="score-math-name">
              <i style={{ background: track.color }} />
              {track.name}
            </span>
            {lines.map((l, i) => (
              <Tex key={i} tex={l.tex} katex={katex} display={false} className="score-math-tex" />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
