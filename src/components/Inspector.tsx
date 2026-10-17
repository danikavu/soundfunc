import { Fragment, useState } from 'react';
import { engine } from '../engine/audio';
import { CONSTANTS, FUNCTIONS } from '../engine/expr';
import { PITCH_MODES, type PitchMode } from '../engine/music';
import { TRACK_COLORS } from '../engine/presets';
import { WAVEFORMS, keyLabel, type Waveform } from '../engine/project';
import { useSelectedTrack, useStore } from '../state/store';
import { Icon, Seg, Slider, getRender } from './ui';

type Tab = 'sound' | 'notes' | 'guide';

const STEP_LENGTHS = [
  { value: 0.125, label: '1/32' },
  { value: 0.25, label: '1/16' },
  { value: 1 / 3, label: '1/8t' },
  { value: 0.375, label: '3/32' },
  { value: 0.5, label: '1/8' },
  { value: 1, label: '1/4' },
  { value: 2, label: '1/2' },
];

function SoundTab() {
  const track = useSelectedTrack()!;
  const { project, updateTrack, setSong, duplicateTrack, removeTrack, checkpoint } = useStore();
  const up = (patch: Parameters<typeof updateTrack>[1]) => updateTrack(track.id, patch);
  const render = getRender(track, project.song);

  return (
    <>
      <input className="track-title" value={track.name} onFocus={checkpoint} onChange={(e) => updateTrack(track.id, { name: e.target.value }, false)} />
      <div className="row" style={{ gap: 6, marginBottom: 4 }}>
        {TRACK_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => up({ color: c })}
            className="stone"
            style={{ background: c, border: 'none', cursor: 'pointer', width: 16, height: 13, outline: c === track.color ? '1.5px solid var(--ink)' : 'none', outlineOffset: 2 }}
            aria-label={`color ${c}`}
          />
        ))}
      </div>
      <div className="muted" style={{ fontSize: 11 }}>
        {render.notes.length} notes · {keyLabel(project.song)}
      </div>

      <div className="eyebrow">Voice</div>
      <Seg<Waveform> value={track.waveform} onChange={(waveform) => up({ waveform })} options={Object.entries(WAVEFORMS).map(([value, label]) => ({ value: value as Waveform, label }))} />
      <div style={{ marginTop: 10 }}>
        <Slider label="Volume" value={track.volume} min={0} max={1} onChange={(volume) => up({ volume })} />
        <Slider label="Pan" value={track.pan} min={-1} max={1} format={(v) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} onChange={(pan) => up({ pan })} />
        <Slider label="Attack" value={track.attack} min={0.003} max={1.5} format={(v) => `${Math.round(v * 1000)}ms`} onChange={(attack) => up({ attack })} />
        <Slider label="Release" value={track.release} min={0.02} max={3} format={(v) => `${v.toFixed(2)}s`} onChange={(release) => up({ release })} />
      </div>

      <div className="eyebrow">Pattern</div>
      <div className="grid2">
        <label className="field">
          <span>Steps</span>
          <input className="input" type="number" min={1} max={256} value={track.steps} onChange={(e) => up({ steps: Math.max(1, Math.min(256, Math.round(Number(e.target.value) || 1))) })} />
        </label>
        <label className="field">
          <span>Octave</span>
          <input className="input" type="number" min={0} max={8} value={track.octave} onChange={(e) => up({ octave: Math.max(0, Math.min(8, Math.round(Number(e.target.value)))) })} />
        </label>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <span>Step length</span>
        <Seg<number> value={track.stepBeats} onChange={(stepBeats) => up({ stepBeats })} options={STEP_LENGTHS} />
      </div>
      <label className="field" style={{ marginTop: 12 }}>
        <span>Pitch means</span>
        <select className="select" value={track.pitchMode} onChange={(e) => up({ pitchMode: e.target.value as PitchMode })}>
          {Object.entries(PITCH_MODES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <div className="eyebrow">Export</div>
      <Slider label="Loops" value={project.song.exportLoops} min={1} max={32} step={1} format={(v) => `×${v}`} onChange={(exportLoops) => setSong({ exportLoops })} />

      <div className="row" style={{ marginTop: 22, flexWrap: 'wrap' }}>
        <button className="btn small" onClick={() => duplicateTrack(track.id)}>
          <Icon name="copy" size={12} /> Duplicate
        </button>
        <button className="btn small ghost" onClick={() => removeTrack(track.id)}>
          <Icon name="trash" size={12} /> Remove
        </button>
      </div>
    </>
  );
}

function NotesTab() {
  const track = useSelectedTrack()!;
  const song = useStore((s) => s.project.song);
  const { notes } = getRender(track, song);
  return (
    <>
      <p className="muted" style={{ marginTop: 0, fontSize: 11.5 }}>
        One pass of <b className="serif">{track.name}</b> in {keyLabel(song)}. Click a row to hear it. Export the full data as CSV or MIDI from the top bar.
      </p>
      <table className="notes-table">
        <thead>
          <tr>
            <th>step</th>
            <th>note</th>
            <th>midi</th>
            <th>vel</th>
            <th>len</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n) => (
            <tr key={n.step} onClick={() => engine.preview(track, n.midi, n.velocity)}>
              <td className="muted">{n.step}</td>
              <td>{n.name}</td>
              <td>{n.midi}</td>
              <td>
                <span className="vel-bar" style={{ width: 4 + n.velocity * 26, opacity: 0.3 + n.velocity * 0.7 }} /> {Math.round(n.velocity * 127)}
              </td>
              <td>{n.duration.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notes.length === 0 && <p className="empty">Silence. Every velocity is zero.</p>}
    </>
  );
}

function GuideTab() {
  return (
    <div className="ref">
      <div className="eyebrow">How it flows</div>
      <p style={{ marginTop: 0 }}>
        Each step, the graph runs once. Whatever reaches <b>Note Out</b> becomes a note: <code>pitch</code> is mapped onto the key & scale,{' '}
        <code>velocity</code> 0 means rest, and <code>length</code> is measured in steps.
      </p>
      <div className="eyebrow">Variables</div>
      <dl>
        <dt><code>n</code></dt><dd>step index 0, 1, 2…</dd>
        <dt><code>x</code></dt><dd>progress through pattern 0 → 1</dd>
        <dt><code>t</code></dt><dd>time in beats</dd>
        <dt><code>k</code></dt><dd>loop count — evolve over time</dd>
        <dt><code>steps</code></dt><dd>pattern length</dd>
        <dt><code>a b c</code></dt><dd>Formula node inputs</dd>
        {Object.keys(CONSTANTS).map((c) => (
          <Fragment key={c}><dt><code>{c}</code></dt><dd>{CONSTANTS[c].toFixed(4)}</dd></Fragment>
        ))}
      </dl>
      <div className="eyebrow">Operators</div>
      <p style={{ margin: 0 }}>
        <code>+ − * / % ^</code> · <code>&lt; &gt; == != &amp;&amp; ||</code> · <code>cond ? a : b</code> · implicit <code>2pi</code>
      </p>
      <div className="eyebrow">Functions</div>
      <dl>
        {Object.entries(FUNCTIONS).map(([k, f]) => (
          <Fragment key={k}><dt><code>{k}</code></dt><dd>{f.doc}</dd></Fragment>
        ))}
      </dl>
    </div>
  );
}

export function Inspector() {
  const track = useSelectedTrack();
  const [tab, setTab] = useState<Tab>('sound');
  return (
    <aside className="panel">
      <div style={{ marginBottom: 18 }}>
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sound', label: 'Track' },
            { value: 'notes', label: 'Notes' },
            { value: 'guide', label: 'Guide' },
          ]}
        />
      </div>
      {tab === 'guide' ? <GuideTab /> : !track ? <p className="empty">No track selected.</p> : tab === 'sound' ? <SoundTab /> : <NotesTab />}
    </aside>
  );
}
