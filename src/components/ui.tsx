import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import type { Project, Song, Track, TrackRender } from '../engine/project';
import { renderTrack } from '../engine/project';

// ---------- icons: dot-matrix, on the same kind of grid as the Doto type around them ----------

/* each icon is 9 × 9 dots, drawn by hand: # is a dot */
const art: Record<string, string> = {
  play: `
..#......
..##.....
..###....
..####...
..#####..
..####...
..###....
..##.....
..#......`,
  stop: `
.........
.#######.
.#######.
.#######.
.#######.
.#######.
.#######.
.#######.
.........`,
  plus: `
.........
....#....
....#....
....#....
.#######.
....#....
....#....
....#....
.........`,
  minus: `
.........
.........
.........
.........
.#######.
.........
.........
.........
.........`,
  close: `
.........
.#.....#.
..#...#..
...#.#...
....#....
...#.#...
..#...#..
.#.....#.
.........`,
  dice: `
.#######.
#.......#
#.#...#.#
#.......#
#...#...#
#.......#
#.#...#.#
#.......#
.#######.`,
  lock: `
...###...
..#...#..
..#...#..
.#######.
.#.....#.
.#..#..#.
.#..#..#.
.#.....#.
.#######.`,
  unlock: `
...###...
..#...#..
..#......
.#######.
.#.....#.
.#..#..#.
.#..#..#.
.#.....#.
.#######.`,
  headphones: `
..#####..
.#.....#.
#.......#
#.......#
#.......#
###...###
###...###
###...###
.........`,
  split: `
....#....
....#....
....#....
...#.#...
..#...#..
.#.....#.
.#.....#.
.........
###...###`,
  merge: `
#.......#
.#.....#.
..#...#..
...#.#...
....#....
....#....
....#....
....#....
....#....`,
  bookmark: `
.#######.
.#.....#.
.#.....#.
.#.....#.
.#.....#.
.#.....#.
.#..#..#.
.#.#.#.#.
.##...##.`,
  sliders: `
..#......
#########
..#......
......#..
#########
......#..
...#.....
#########
...#.....`,
  copy: `
#####....
#...#....
#.######.
#.#....#.
###....#.
..#....#.
..#....#.
..######.
.........`,
  send: `
.....####
.......##
......#.#
#####.#..
#...##...
#.......#
#.......#
#.......#
#########`,
  moon: `
...###...
.###.....
.##......
###......
###......
###.....#
.###...##
..######.
...####..`,
  sun: `
....#....
.#.....#.
...###...
..#...#..
#.#...#.#
..#...#..
...###...
.#.....#.
....#....`,
  download: `
....#....
....#....
....#....
.#..#..#.
..#.#.#..
...###...
....#....
.........
#########`,
  upload: `
#########
.........
....#....
...###...
..#.#.#..
.#..#..#.
....#....
....#....
....#....`,
  undo: `
...#.....
..#......
.#######.
..#.....#
...#....#
........#
........#
.....###.
.........`,
  redo: `
.....#...
......#..
.#######.
#.....#..
#....#...
#........
#........
.###.....
.........`,
  fit: `
###...###
#.......#
#.......#
.........
.........
.........
#.......#
#.......#
###...###`,
  save: `
#######..
#.#...##.
#.#...#.#
#.#####.#
#.......#
#.#####.#
#.#...#.#
#.#...#.#
#########`,
  info: `
..#####..
.#.....#.
#...#...#
#.......#
#...#...#
#...#...#
#...#...#
.#.....#.
..#####..`,
  sigma: `
.#######.
..#......
...#.....
....#....
.....#...
....#....
...#.....
..#......
.#######.`,
  caret: `
.........
.........
.........
.#.....#.
..#...#..
...#.#...
....#....
.........
.........`,
  folder: `
.........
####.....
#...#....
#....####
#.......#
#.......#
#.......#
#########
.........`,
  book: `
.########
#.#.....#
#.#.....#
#.#.....#
#.#.....#
#.#.....#
#.#.....#
#.#######
.##......`,
  pen: `
......##.
.....#..#
....#..#.
...#..#..
..#..#...
.#..#....
.#.#.....
.##......
#........`,
  wave: `
.........
.##......
#..#.....
#...#....
....#...#
.....#..#
......##.
.........
.........`,
};

const DOTS = 9;
const dotCache = new Map<string, [number, number][]>();
function iconDots(name: string): [number, number][] {
  let dots = dotCache.get(name);
  if (!dots) {
    dots = [];
    (art[name] ?? '').trim().split('\n').forEach((row, y) => [...row.trim()].forEach((c, x) => c === '#' && dots!.push([x, y])));
    dotCache.set(name, dots);
  }
  return dots;
}

export function Icon({ name, size = 16 }: { name: keyof typeof art | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${DOTS} ${DOTS}`} fill="currentColor" aria-hidden>
      {iconDots(name).map(([x, y]) => (
        <circle key={`${x}.${y}`} cx={x + 0.5} cy={y + 0.5} r={0.42} />
      ))}
    </svg>
  );
}

/** The ensō — a single brush circle, left open. */
export function Enso({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 4.2a11.8 11.8 0 1 0 11.2 8.1" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx="26.6" cy="9.4" r="1.6" fill="var(--accent)" />
    </svg>
  );
}

// ---------- controls ----------

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  /** double-click the knob to go back to this value — or call this to reset */
  reset?: number | (() => void);
}) {
  const { label, value, min, max, step = 0.01, format = (v) => v.toFixed(2), onChange, reset } = props;
  return (
    <label className="slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={resetOnDoubleClick(reset, onChange)}
        title={reset === undefined ? undefined : 'Double-click to reset'}
      />
      <output>{format(value)}</output>
    </label>
  );
}

/** a range input's double-click: back to its default value */
export const resetOnDoubleClick = (reset: number | (() => void) | undefined, onChange: (v: number) => void) =>
  reset === undefined ? undefined : () => (typeof reset === 'number' ? onChange(reset) : reset());

export function Seg<T extends string | number | boolean>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {props.options.map((o) => (
        <button key={String(o.value)} className={o.value === props.value ? 'on' : ''} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- render cache: one render per (track, song) object pair ----------

const cache = new WeakMap<Track, { song: Song; render: TrackRender }>();

export function getRender(track: Track, song: Song): TrackRender {
  const hit = cache.get(track);
  if (hit && hit.song === song) return hit.render;
  const render = renderTrack(track, song, 0, true);
  cache.set(track, { song, render });
  return render;
}

// ---------- files ----------

export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSafe = (s: string) => s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'soundfunc';

export function isProject(x: unknown): x is Project {
  const p = x as Project;
  return !!p && typeof p === 'object' && Array.isArray(p.tracks) && !!p.song && typeof p.song.bpm === 'number';
}

// ---------- fields that keep the caret where you put it ----------

/**
 * Editing state that belongs to the field while it has focus. The store is
 * still updated on every keystroke, but a value echoed back later (React Flow
 * re-renders nodes after a tick) never overwrites what is being typed — which
 * is what used to throw the caret to the end.
 */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  return {
    draft,
    setDraft,
    bind: {
      onFocus: () => {
        focused.current = true;
      },
      onBlur: () => {
        focused.current = false;
      },
    },
  };
}

type TextProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValue: (v: string) => void };

export function TextField({ value, onValue, onFocus, onBlur, ...rest }: TextProps) {
  const { draft, setDraft, bind } = useDraft(value);
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onValue(e.target.value);
      }}
      onFocus={(e) => {
        bind.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        bind.onBlur();
        onBlur?.(e);
      }}
    />
  );
}

type AreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onValue: (v: string) => void };

export function TextArea({ value, onValue, onFocus, onBlur, ...rest }: AreaProps) {
  const { draft, setDraft, bind } = useDraft(value);
  return (
    <textarea
      {...rest}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onValue(e.target.value);
      }}
      onFocus={(e) => {
        bind.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        bind.onBlur();
        onBlur?.(e);
      }}
    />
  );
}

type NumberProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'> & {
  value: number;
  onValue: (v: number) => void;
  min?: number;
  max?: number;
  integer?: boolean;
};

/**
 * Numbers apply as soon as what you've typed is a valid in-range value; half-typed
 * input ("", "-", "1." or a tempo of "1" on the way to "120") is left alone until
 * Enter or blur, when it is clamped.
 */
export function NumberField({ value, onValue, min, max, integer, onFocus, onBlur, onKeyDown, ...rest }: NumberProps) {
  const { draft, setDraft, bind } = useDraft(String(value));
  const clamp = (v: number) => {
    let x = integer ? Math.round(v) : v;
    if (min !== undefined) x = Math.max(min, x);
    if (max !== undefined) x = Math.min(max, x);
    return x;
  };
  const settle = () => {
    const v = Number(draft);
    const next = draft.trim() === '' || !Number.isFinite(v) ? value : clamp(v);
    if (next !== value) onValue(next);
    setDraft(String(next));
  };
  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(e) => {
        const s = e.target.value;
        setDraft(s);
        const v = Number(s);
        if (s.trim() !== '' && Number.isFinite(v) && clamp(v) === v) onValue(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') settle();
        onKeyDown?.(e);
      }}
      onFocus={(e) => {
        bind.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        bind.onBlur();
        settle();
        onBlur?.(e);
      }}
    />
  );
}

/** A number in a box with up/down arrows beside it — the value stays typeable, and ↑/↓ keys work too. */
export function Stepper({ value, min, max, onValue, label, title, className = '' }: { value: number; min: number; max: number; onValue: (v: number) => void; label: string; title?: string; className?: string }) {
  const nudge = (d: number) => onValue(Math.min(max, Math.max(min, value + d)));
  return (
    <div className={`stepper ${className}`} title={title}>
      <NumberField className="input num stepper-input" integer min={min} max={max} value={value} onValue={onValue} aria-label={label} />
      <span className="stepper-arrows">
        <button type="button" tabIndex={-1} aria-label={`${label} up`} disabled={value >= max} onClick={() => nudge(1)}>
          <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden>
            <path d="M1 4l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" tabIndex={-1} aria-label={`${label} down`} disabled={value <= min} onClick={() => nudge(-1)}>
          <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden>
            <path d="M1 1l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </span>
    </div>
  );
}

/**
 * A small ⓘ that shows its explanation on hover, focus or click — instead of a paragraph of text.
 * The note floats above everything (fixed to the window), so no panel edge can clip it.
 */
export function Info({ children, label = 'More about this' }: { children: ReactNode; label?: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [pinned, setPinned] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const W = 260;
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), window.innerWidth - W - 8);
    setPos({ left, top: r.bottom + 8 });
  };
  const hide = () => !pinned && setPos(null);
  return (
    <span className="info" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btn}
        type="button"
        className={`info-btn ${pos ? 'on' : ''}`}
        aria-label={label}
        aria-expanded={!!pos}
        onFocus={show}
        onBlur={() => (setPinned(false), setPos(null))}
        onClick={() => (pinned ? (setPinned(false), setPos(null)) : (setPinned(true), show()))}
      >
        <Icon name="info" size={14} />
      </button>
      {pos && (
        <span className="info-pop" role="tooltip" style={{ left: pos.left, top: pos.top, width: W }}>
          {children}
        </span>
      )}
    </span>
  );
}
