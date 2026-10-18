import { useEffect, useRef, useState } from 'react';
import type { Slider } from '../engine/project';
import { useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon, NumberField } from './ui';

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

function SliderChip({ s }: { s: Slider }) {
  const { updateSlider, renameSlider, removeSlider, checkpoint } = useStore();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const commitName = () => {
    const to = (renaming ?? '').trim();
    setRenaming(null);
    if (!to || to === s.name) return;
    if (!renameSlider(s.name, to)) toast(`“${to}” can’t be a slider name — it is taken, reserved, or not a plain word`);
  };
  const step = (s.max - s.min) / 200 || 0.01;

  return (
    <div className="slider-chip" ref={ref}>
      {renaming !== null ? (
        <input
          className="input slider-name-input"
          autoFocus
          value={renaming}
          onChange={(e) => setRenaming(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') setRenaming(null);
          }}
          aria-label="Slider name"
        />
      ) : (
        <button className="slider-name" title="Click to rename — every formula using it follows" onClick={() => setRenaming(s.name)}>
          {s.name}
        </button>
      )}
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={step}
        value={s.value}
        onPointerDown={checkpoint}
        onChange={(e) => updateSlider(s.name, { value: Number(e.target.value) })}
        aria-label={`${s.name} value`}
      />
      <output>{fmt(s.value)}</output>
      <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => setMenu((m) => !m)} title="Range, remove">
        ⋯
      </button>
      {menu && (
        <div className="menu-pop slider-pop">
          <div className="row" style={{ gap: 10, padding: '4px 6px' }}>
            <label className="field" style={{ width: 70 }}>
              <span>min</span>
              <NumberField className="input" value={s.min} onValue={(min) => updateSlider(s.name, { min, value: Math.max(min, s.value) })} />
            </label>
            <label className="field" style={{ width: 70 }}>
              <span>max</span>
              <NumberField className="input" value={s.max} onValue={(max) => updateSlider(s.name, { max, value: Math.min(max, s.value) })} />
            </label>
          </div>
          <hr />
          <button
            onClick={() => {
              removeSlider(s.name);
              toast(`Removed “${s.name}” — formulas now hold ${fmt(s.value)}`);
            }}
          >
            Remove slider <small>Its current value is written back into every formula</small>
          </button>
        </div>
      )}
    </div>
  );
}

/** The song's sliders: named constants any formula (and the harmony) can read. */
export function SlidersBar() {
  const sliders = useStore((s) => s.project.song.sliders);
  if (!sliders.length) return null;
  return (
    <div className="sliders-bar">
      <span className="eyebrow-label">
        <Icon name="sliders" size={12} /> Sliders
      </span>
      {sliders.map((s) => (
        <SliderChip key={s.name} s={s} />
      ))}
    </div>
  );
}
