import { useEffect, useRef, useState } from 'react';
import { DEFAULT_PITCH_RANGE, RANGE_PRESETS, midiToName, type RangeMode } from '../engine/music';
import { useStore } from '../state/store';
import { NumberField, Seg } from './ui';

/** The project's pitch range: where notes may go, and what happens to the ones that stray. */
export function RangeControl() {
  const range = useStore((s) => s.project.song.pitchRange) ?? DEFAULT_PITCH_RANGE;
  const setSong = useStore((s) => s.setSong);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const set = (patch: Partial<typeof range>) => {
    const next = { ...range, ...patch };
    if (next.high <= next.low) next.high = Math.min(127, next.low + 1);
    setSong({ pitchRange: next });
  };
  const summary = range.mode === 'off' ? 'any pitch' : `${midiToName(range.low)}–${midiToName(range.high)} · ${range.mode}`;

  return (
    <div className="range-control" ref={ref}>
      <button className={`range-pill ${range.mode === 'off' ? 'off' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Pitch range — keep notes where you can hear them">
        <span className="eyebrow-label">Pitch</span> {summary}
      </button>
      {open && (
        <div className="range-pop" role="dialog" aria-label="Pitch range">
          <p className="muted">
            Functions can wander far — to −8373 or beyond. The range keeps every note you hear and export where it is musical. Drums are left as they are.
          </p>
          <Seg<RangeMode>
            value={range.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'wrap', label: 'Wrap by octaves' },
              { value: 'clamp', label: 'Clamp to edge' },
              { value: 'off', label: 'Off' },
            ]}
          />
          <p className="muted range-explain">
            {range.mode === 'wrap' && 'A note outside moves by whole octaves until it fits — it keeps its note name.'}
            {range.mode === 'clamp' && 'A note outside sits on the nearest edge of the range.'}
            {range.mode === 'off' && 'Notes go wherever the function sends them, up to the limits of MIDI.'}
          </p>
          <div className={`range-bounds ${range.mode === 'off' ? 'dim' : ''}`}>
            <label className="field">
              <span>Lowest</span>
              <div className="row" style={{ gap: 6 }}>
                <NumberField className="input num" integer min={0} max={126} value={range.low} onValue={(low) => set({ low })} aria-label="Lowest MIDI note" />
                <b className="serif">{midiToName(range.low)}</b>
              </div>
            </label>
            <label className="field">
              <span>Highest</span>
              <div className="row" style={{ gap: 6 }}>
                <NumberField className="input num" integer min={1} max={127} value={range.high} onValue={(high) => set({ high })} aria-label="Highest MIDI note" />
                <b className="serif">{midiToName(range.high)}</b>
              </div>
            </label>
          </div>
          <div className="seg range-presets">
            {RANGE_PRESETS.map((p) => (
              <button
                key={p.label}
                className={range.low === p.low && range.high === p.high ? 'on' : ''}
                onClick={() => set({ low: p.low, high: p.high, mode: range.mode === 'off' ? 'wrap' : range.mode })}
                title={`${midiToName(p.low)}–${midiToName(p.high)}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
