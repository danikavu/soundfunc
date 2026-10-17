import { useEffect, useRef, useState } from 'react';
import { exportMidi, exportNotesCsv } from '../engine/midi';
import { NOTE_NAMES, PROGRESSIONS, SCALES } from '../engine/music';
import { tryCompile } from '../engine/expr';
import { useStore } from '../state/store';
import { togglePlay } from '../state/transport';
import { Enso, Icon, download, fileSafe, isProject } from './ui';

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
  const { project, loadProject, resetProject } = useStore();

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
            Open project… <small>Load a .soundfunc.json</small>
          </button>
          <button
            onClick={run(() => {
              if (confirm('Replace the current garden with the default one? (You can undo.)')) resetProject();
            })}
          >
            New garden <small>Reset to the default project</small>
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

export function TopBar() {
  const { project, setSong, setProjectName, playing, theme, toggleTheme, undo, redo, past, future, checkpoint } = useStore();
  const { song } = project;

  return (
    <header className="topbar">
      <div className="brand">
        <Enso />
        <span>SoundFunc</span>
        <small className="hide-narrow">音 · 数</small>
      </div>
      <input className="project-name hide-narrow" value={project.name} onChange={(e) => setProjectName(e.target.value)} aria-label="Project name" />

      <div className="transport">
        <button className={`play ${playing ? 'on' : ''}`} onClick={() => void togglePlay()} title="Play / stop (space)">
          <Icon name={playing ? 'stop' : 'play'} size={18} />
        </button>
        <label className="field-inline">
          <span>Tempo</span>
          <input
            className="input num"
            type="number"
            min={20}
            max={300}
            value={song.bpm}
            onChange={(e) => setSong({ bpm: Math.max(20, Math.min(300, Number(e.target.value) || 90)) })}
          />
        </label>
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
          <span>Harmony · chord of bar</span>
          <div className="harmony">
            <input
              className="input"
              value={song.harmony}
              spellCheck={false}
              onFocus={checkpoint}
              onChange={(e) => setSong({ harmony: e.target.value }, false)}
              style={tryCompile(song.harmony, ['bar', 'k', 'L']).error ? { borderBottomColor: 'var(--accent)' } : undefined}
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
