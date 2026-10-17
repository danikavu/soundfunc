import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import type { Project, Song, Track, TrackRender } from '../engine/project';
import { renderTrack } from '../engine/project';

// ---------- icons (thin brush-like strokes) ----------

const paths: Record<string, ReactNode> = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  lock: <path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" />,
  unlock: <path d="M7 11V8a5 5 0 0 1 9.6-2M6 11h12v9H6z" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  copy: <path d="M9 9h10v10H9zM5 15V5h10" />,
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  sun: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 20V9M7 14l5-5 5 5M5 4h14" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5" />,
  wave: <path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2" />,
};

export function Icon({ name, size = 16 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
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
}) {
  const { label, value, min, max, step = 0.01, format = (v) => v.toFixed(2), onChange } = props;
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{format(value)}</output>
    </label>
  );
}

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
