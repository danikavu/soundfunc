import { useMemo, useState } from 'react';
import { audibleTracks, isDrum, type Track } from '../engine/project';
import { compose, trackTex } from '../engine/symbolic';
import { useStore } from '../state/store';
import { Tex, useKatex } from './tex';

type Detail = 'main' | 'all';
const KEY = 'sf.scoreMath';

function load(): { open: boolean; detail: Detail } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '');
    return { open: !!v.open, detail: v.detail === 'all' ? 'all' : 'main' };
  } catch {
    return { open: false, detail: 'main' };
  }
}

/** what a channel shows: its tune (a drum, its rhythm) — or every Note Out input and the named parts */
function linesOf(t: Track, song: Parameters<typeof trackTex>[1], detail: Detail) {
  const lines = trackTex(compose(t), song);
  if (detail === 'all') return lines.filter((l) => l.label !== 'n runs over' && l.label !== 'pitch → MIDI');
  const main = lines.find((l) => l.label === (isDrum(t.waveform) ? 'velocity' : 'pitch')) ?? lines[0];
  return main ? [main] : [];
}

/** whether the Score shows its functions, and how much of them — remembered between visits */
export function useScoreMath() {
  const [state, setState] = useState(load);
  const set = (patch: Partial<typeof state>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* private window: it just won't be remembered */
      }
      return next;
    });
  return [state, set] as const;
}

/**
 * The Score's functions, in place: a panel over the score that writes each channel you can hear
 * as math, so a screen recording shows the notes and the functions that make them together.
 * It follows mute, solo, new and removed channels as they happen.
 */
export function ScoreMath({ detail, onDetail }: { detail: Detail; onDetail: (d: Detail) => void }) {
  const tracks = useStore((s) => s.project.tracks);
  const song = useStore((s) => s.project.song);
  const katex = useKatex();
  const heard = useMemo(() => audibleTracks(tracks), [tracks]);
  const shown = useMemo(() => heard.map((t) => ({ track: t, lines: linesOf(t, song, detail) })), [detail, heard, song]);

  return (
    <div className="score-math">
      <button
        className={`btn small ghost score-math-all ${detail === 'all' ? 'on' : ''}`}
        aria-pressed={detail === 'all'}
        onClick={() => onDetail(detail === 'all' ? 'main' : 'all')}
        title={detail === 'all' ? 'Every Note Out input and the named parts — click for just the tune' : 'Just the tune (a drum: its rhythm) — click for every input'}
      >
        All
      </button>
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
  );
}
