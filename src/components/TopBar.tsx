import { useEffect, useRef, useState } from 'react';
import { exportMidi, exportNotesCsv } from '../engine/midi';
import { NOTE_NAMES, PROGRESSIONS, SCALES } from '../engine/music';
import { tryCompile } from '../engine/expr';
import { useStore } from '../state/store';
import { togglePlay } from '../state/transport';
import { GardenMenu } from './GardenMenu';
import { StepPicker } from './StepPicker';
import { FIXED_LENGTHS, shortBeats, stepLabel } from '../engine/steps';
import { Dropdown } from './Dropdown';
import { isDrum } from '../engine/project';
import { useSelectedTrack } from '../state/store';
import { Enso, Icon, NumberField, TextField, download, fileSafe, isProject } from './ui';

export function toast(msg: string) {
  window.dispatchEvent(new CustomEvent('sf-toast', { detail: msg }));
}

function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = window.setTimeout(() => setMsg(null), 2400);
    };
    window.addEventListener('sf-toast', on);
    return () => window.removeEventListener('sf-toast', on);
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

function FileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { project, loadProject } = useStore();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const name = fileSafe(project.name);
  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div className="menu" ref={ref}>
      <button className="btn primary" onClick={() => setOpen((o) => !o)}>
        <Icon name="download" size={14} /> Export
      </button>
      {open && (
        <div className="menu-pop">
          <button
            onClick={run(() => {
              download(`${name}.mid`, exportMidi(project) as BlobPart, 'audio/midi');
              toast(`Exported ${project.song.exportLoops} loop${project.song.exportLoops > 1 ? 's' : ''} as MIDI`);
            })}
          >
            MIDI file <small>Multi-track .mid with tempo & key</small>
          </button>
          <button onClick={run(() => download(`${name}-notes.csv`, exportNotesCsv(project), 'text/csv'))}>
            Note data <small>CSV of pitch, velocity, key, timing</small>
          </button>
          <button onClick={run(() => download(`${name}.soundfunc.json`, JSON.stringify(project, null, 2), 'application/json'))}>
            Project <small>Everything, to re-open later</small>
          </button>
          <hr />
          <button onClick={() => fileRef.current?.click()}>
            Import project… <small>Load a .soundfunc.json file</small>
          </button>

        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            if (!isProject(data)) throw new Error('not a project');
            loadProject(data);
            toast(`Opened “${data.name}”`);
          } catch {
            toast('That file is not a SoundFunc project');
          }
          setOpen(false);
        }}
      />
    </div>
  );
}

/** a field that keeps its place in the bar when it has nothing to show */
function Placeholder({ label, width, title }: { label: string; width: string; title: string }) {
  return (
    <div className={`field-inline ${width}`} title={title}>
      <span>{label}</span>
      <span className="field-placeholder">–</span>
    </div>
  );
}

/**
 * The selected track's grid — steps × step length, loop length, octave. Every field
 * has a fixed width, so changing tracks or values never shifts the rest of the bar.
 */
function GridField() {
  const track = useSelectedTrack();
  const updateTrack = useStore((s) => s.updateTrack);
  const setGrid = useStore((s) => s.setGrid);
  const setStepBeatsAll = useStore((s) => s.setStepBeatsAll);
  const setLengthAll = useStore((s) => s.setLengthAll);
  const trackCount = useStore((s) => s.project.tracks.length);
  if (!track) {
    return (
      <>
        <Placeholder label="Steps" width="w-grid" title="Select a track to set its steps" />
        <Placeholder label="Length" width="w-length" title="Select a track to set its length" />
        <Placeholder label="Octave" width="w-octave" title="Select a track to set its octave" />
      </>
    );
  }
  const loopBeats = track.steps * track.stepBeats;
  return (
    <>
      <div className="field-inline grid-field w-grid">
        <span title={`Steps and step length of “${track.name}”`}>
          <i className="grid-dot" style={{ background: track.color }} />
          <span className="grid-name">{track.name}</span>
        </span>
        <div className="grid-controls">
          <NumberField
            className="input num"
            integer
            min={1}
            max={256}
            value={track.steps}
            onValue={(steps) => setGrid(track.id, { steps })}
            aria-label="Steps"
            title={track.lengthMode === 'fixed' ? `Steps — divides the ${track.lengthBeats}-beat loop evenly` : 'Steps'}
          />
          <span className="muted grid-times">×</span>
          <StepPicker
            compact
            value={track.stepBeats}
            onChange={(stepBeats) => setGrid(track.id, { stepBeats })}
            onApplyAll={
              trackCount > 1
                ? () => {
                    setStepBeatsAll(track.stepBeats);
                    toast(`Every track now steps in ${stepLabel(track.stepBeats)} — ⌘Z to undo`);
                  }
                : undefined
            }
          />
        </div>
      </div>
      <div className="field-inline w-length" title={track.lengthMode === 'fixed' ? `${track.lengthBeats} beats` : `free — ${loopBeats} beats`}>
        <span>Length</span>
        <Dropdown
          compact
          label="Loop length"
          value={
            track.lengthMode === 'fixed' ? (
              <>
                <b>{track.lengthBeats} beats</b>
                <small>{track.lengthBeats / 4} bar{track.lengthBeats === 4 ? '' : 's'}</small>
              </>
            ) : (
              <>
                <b>free</b>
                <small>{shortBeats(loopBeats)}</small>
              </>
            )
          }          groups={[
            {
              title: 'Fixed — always lands on the bar',
              items: FIXED_LENGTHS.map((L) => ({
                key: `L${L}`,
                label: `${L} beats`,
                hint: `${L / 4} bar${L === 4 ? '' : 's'} · ${Math.max(1, Math.min(256, Math.round(L / track.stepBeats)))} steps`,
                selected: track.lengthMode === 'fixed' && track.lengthBeats === L,
                onSelect: () => setGrid(track.id, { lengthMode: 'fixed', lengthBeats: L }),
              })),
            },
            {
              title: 'Free — experimental',
              items: [
                {
                  key: 'free',
                  label: 'Free',
                  hint: 'steps × step length, whatever that adds up to',
                  selected: track.lengthMode === 'free',
                  onSelect: () => setGrid(track.id, { lengthMode: 'free' }),
                },
              ],
            },
          ]}
          footer={
            trackCount > 1 ? (
              <button
                className="btn small ghost step-all"
                onClick={() => {
                  setLengthAll(track.lengthMode === 'fixed' ? { lengthMode: 'fixed', lengthBeats: track.lengthBeats } : { lengthMode: 'free' });
                  toast(`Every track is now ${track.lengthMode === 'fixed' ? `${track.lengthBeats} beats long` : 'free'} — ⌘Z to undo`);
                }}
              >
                {track.lengthMode === 'fixed' ? `Make every track ${track.lengthBeats} beats` : 'Make every track free'}
              </button>
            ) : undefined
          }
        />
      </div>
      {isDrum(track.waveform) ? (
        <Placeholder label="Octave" width="w-octave" title="Drums have no octave — their pitch input tunes the hit" />
      ) : (
        <label className="field-inline w-octave" title="Octave — where pitch 0 sits (4 = middle C’s octave)">
          <span>Octave</span>
          <NumberField className="input num grid-oct" integer min={0} max={8} value={track.octave} onValue={(octave) => updateTrack(track.id, { octave })} />
        </label>
      )}
    </>
  );
}

export function TopBar() {
  const { project, setSong, setProjectName, playing, theme, toggleTheme, undo, redo, past, future, checkpoint } = useStore();
  const { song } = project;

  return (
    <header className="topbar">
      <div className="brand">
        <Enso />
        <span className="brand-name">SoundFunc</span>
        <small className="hide-narrow">音 · 数</small>
      </div>
      <div className="row hide-narrow" style={{ gap: 2 }}>
        <TextField className="project-name" value={project.name} onValue={setProjectName} aria-label="Project name" />
        <GardenMenu />
      </div>

      <div className="transport">
        <button className={`play ${playing ? 'on' : ''}`} onClick={() => void togglePlay()} title="Play / stop (space)">
          <Icon name={playing ? 'stop' : 'play'} size={18} />
        </button>
        <label className="field-inline">
          <span>Tempo</span>
          <NumberField className="input num" min={20} max={300} value={song.bpm} onValue={(bpm) => setSong({ bpm })} />
        </label>
        <GridField />
        <label className="field-inline">
          <span>Key</span>
          <select className="select" value={song.root} onChange={(e) => setSong({ root: Number(e.target.value) })}>
            {NOTE_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <span>Scale</span>
          <select className="select" value={song.scale} onChange={(e) => setSong({ scale: e.target.value })}>
            {Object.entries(SCALES).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field-inline">
          <span title="The chord of each bar, as a function of bar">Harmony</span>
          <div className="harmony">
            <TextField
              className="input"
              value={song.harmony}
              spellCheck={false}
              onFocus={checkpoint}
              onValue={(harmony) => setSong({ harmony }, false)}
              style={tryCompile(song.harmony, ['bar', 'k', 'L', ...song.sliders.map((x) => x.name)]).error ? { borderBottomColor: 'var(--accent)' } : undefined}
              title="The chord (scale degree) as a function of bar. Tracks read it as h."
            />
            <button
              className={`lock ${song.harmonyLocked ? 'on' : ''}`}
              style={{ margin: 0, opacity: song.harmonyLocked ? 1 : 0.55 }}
              title={song.harmonyLocked ? 'Harmony locked — garden mutations keep it' : 'Lock the harmony against garden mutations'}
              aria-pressed={!!song.harmonyLocked}
              onClick={() => setSong({ harmonyLocked: !song.harmonyLocked })}
            >
              <Icon name={song.harmonyLocked ? 'lock' : 'unlock'} size={12} />
            </button>
            <select className="select" value="" onChange={(e) => e.target.value && setSong({ harmony: e.target.value })} title="Chord progressions" aria-label="Chord progressions">
              <option value="" disabled>
                Progressions
              </option>
              {PROGRESSIONS.map((p) => (
                <option key={p.formula} value={p.formula}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className="field-inline hide-narrow" style={{ width: 80 }}>
          <span>Space</span>
          <input type="range" min={0} max={1} step={0.01} value={song.reverb} onChange={(e) => setSong({ reverb: Number(e.target.value) })} />
        </label>
      </div>

      <div className="spacer" />

      <div className="row" style={{ gap: 2 }}>
        <button className="icon-btn" onClick={undo} disabled={!past.length} title="Undo (⌘Z)">
          <Icon name="undo" />
        </button>
        <button className="icon-btn" onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)">
          <Icon name="redo" />
        </button>
        <button className="icon-btn" onClick={toggleTheme} title="Day / night">
          <Icon name={theme === 'light' ? 'moon' : 'sun'} />
        </button>
      </div>
      <FileMenu />
      <Toast />
    </header>
  );
}
