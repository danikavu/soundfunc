import { useState } from 'react';
import { STEP_GROUPS, parseStepLength, perBar, stepLabel } from '../engine/steps';
import { Dropdown } from './Dropdown';

/** Step length: named note values in groups, or any length typed by hand. */
export function StepPicker({
  value,
  onChange,
  compact = false,
  onApplyAll,
}: {
  value: number;
  onChange: (beats: number) => void;
  /** a slim field for the top bar */
  compact?: boolean;
  /** offer "use for every track" in the menu */
  onApplyAll?: () => void;
}) {
  const [custom, setCustom] = useState('');
  const [bad, setBad] = useState(false);
  const apply = () => {
    const v = parseStepLength(custom);
    if (v === null) return setBad(true);
    setBad(false);
    setCustom('');
    onChange(v);
  };
  return (
    <Dropdown
      label="Step length"
      compact={compact}
      value={
        compact ? (
          <>
            <b>{stepLabel(value)}</b>
            <small>{perBar(value)}/bar</small>
          </>
        ) : (
          <>
            <b>{stepLabel(value)}</b>
            <small>
              {perBar(value)} per bar · {Number(value.toFixed(4))} beat{value === 1 ? '' : 's'}
            </small>
          </>
        )
      }
      groups={STEP_GROUPS.map((g) => ({
        title: g.title,
        items: g.items.map((s) => ({
          key: `${g.title}-${s.label}`,
          label: s.label,
          hint: s.hint,
          selected: Math.abs(s.beats - value) < 1e-9,
          onSelect: () => onChange(s.beats),
        })),
      }))}
      footer={
        <>
        <label className="step-custom" onMouseDown={(e) => e.stopPropagation()}>
          <span>Custom</span>
          <input
            className={`input mono ${bad ? 'bad' : ''}`}
            placeholder="3/20 · 0.3 · phi/4"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setBad(false);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') apply();
            }}
            title="Any length in beats — a fraction, a decimal or a formula (1/64 … 32 beats)"
          />
          <span className="muted">beats</span>
          <button className="btn small" onClick={apply}>
            Set
          </button>
        </label>
        {onApplyAll && (
          <button className="btn small ghost step-all" onClick={onApplyAll} title="Give every track this step length">
            Use {stepLabel(value)} for every track
          </button>
        )}
        </>
      }
    />
  );
}
