import { useEffect, useRef, useState } from 'react';
import { exportMidi, exportNotesCsv } from '../engine/midi';
import { NOTE_NAMES, PROGRESSIONS, SCALE_GROUPS, SCALES, type ScaleGroup } from '../engine/music';
import { tryCompile } from '../engine/expr';
import { useStore } from '../state/store';
import { togglePlay } from '../state/transport';
import { GardenMenu } from './GardenMenu';
import { FIXED_LENGTHS, shortBeats } from '../engine/steps';
import { Dropdown } from './Dropdown';
import { HARMONY_VARS, patternBeats } from '../engine/project';
import { Icon, Stepper, TextField, download, fileSafe, isProject } from './ui';

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
              const stats = { raw: 0, kept: 0 };
              download(`${name}.mid`, exportMidi(project, stats) as BlobPart, 'audio/midi');
              const loops = `${project.song.exportLoops} loop${project.song.exportLoops > 1 ? 's' : ''}`;
              toast(
                stats.raw && project.song.exportCurves !== 'full'
                  ? `Exported ${loops} as ${project.song.exportMidi === 'mpe' ? 'MPE ' : ''}MIDI · curves simplified: ${stats.raw.toLocaleString()} → ${stats.kept.toLocaleString()} points`
                  : `Exported ${loops} as ${project.song.exportMidi === 'mpe' ? 'MPE ' : ''}MIDI`,
              );
            })}
          >
            MIDI file{' '}
            <small>
              {project.song.exportMidi === 'mpe' ? 'MPE — every note its own channel' : 'Multi-channel .mid with tempo & key'}
              {project.song.exportCurves === 'full' ? ' · every curve sample' : ' · curves simplified'}
            </small>
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

/** The song's length: every track fills it — or free, where each track loops on its own. */
function SongLengthField() {
  const song = useStore((s) => s.project.song);
  const setSongLength = useStore((s) => s.setSongLength);
  const setSong = useStore((s) => s.setSong);
  const exact = song.repeat === 'exact';
  const longest = useStore((s) => Math.max(0, ...s.project.tracks.map(patternBeats)));
  const free = song.lengthMode === 'free';
  return (
    <div
      className="field-inline w-song"
      title={`${free ? `Free — each channel loops on its own; the song is its longest channel (${shortBeats(longest)})` : `Every channel is ${song.lengthBeats} beats long`} · ${exact ? 'repeats exactly, note for note' : 'evolves — k, bar and the harmony run on from pass to pass'}`}
    >
      <span>Length</span>
      <Dropdown
        compact
        label="Song length"
        value={
          <b>
            {free ? 'free' : song.lengthBeats}
            {exact ? (
              <span className="repeat-mark" aria-label="repeats exactly">
                {' '}
                ⟲
              </span>
            ) : (
              !free && <span className="unit"> beats</span>
            )}
          </b>
        }
        groups={[
          {
            title: 'Every channel this long',
            items: FIXED_LENGTHS.map((L) => ({
              key: `S${L}`,
              label: `${L} beats`,
              hint: `${L / 4} bar${L === 4 ? '' : 's'}`,
              selected: !free && song.lengthBeats === L,
              onSelect: () => setSongLength(L),
            })),
          },
          {
            title: 'Free',
            items: [
              {
                key: 'free',
                label: 'Free',
                hint: 'each channel loops on its own — for polyrhythms',
                selected: free,
                onSelect: () => setSongLength('free'),
              },
            ],
          },
          {
            title: 'Each pass',
            items: [
              {
                key: 'evolve',
                label: 'Evolves',
                hint: 'k, bar and the harmony run on — every pass can differ',
                selected: !exact,
                onSelect: () => setSong({ repeat: 'evolve' }),
              },
              {
                key: 'exact',
                label: 'Repeats exactly',
                hint: 'the clock starts again each pass — note for note',
                selected: exact,
                onSelect: () => setSong({ repeat: 'exact' }),
              },
            ],
          },
        ]}
      />
    </div>
  );
}

export function TopBar() {
  const { project, setSong, setProjectName, playing, theme, toggleTheme, undo, redo, past, future, checkpoint } = useStore();
  const { song } = project;

  return (
    <header className="topbar">

      <div className="transport">
        <button className={`play ${playing ? 'on' : ''}`} onClick={() => void togglePlay()} title="Play / stop (space)">
          <Icon name={playing ? 'stop' : 'play'} size={18} />
        </button>
        <div className="field-inline w-tempo">
          <span>Tempo</span>
          <Stepper className="tempo" label="Tempo" title="Beats per minute (20–300) — type it, use the arrows, or ↑/↓" min={20} max={300} value={song.bpm} onValue={(bpm) => setSong({ bpm })} />
        </div>
        <SongLengthField />
        <div className="field-inline w-key">
          <span>Key</span>
          <Dropdown
            compact
            label="Key"
            value={<b>{NOTE_NAMES[song.root]}</b>}
            groups={[
              {
                title: 'Key — the root note',
                items: NOTE_NAMES.map((n, i) => ({ key: n, label: n, selected: song.root === i, onSelect: () => setSong({ root: i }) })),
              },
            ]}
          />
        </div>
        <div className="field-inline w-scale">
          <span>Scale</span>
          <Dropdown
            compact
            label="Scale"
            value={<b>{(SCALES[song.scale] ?? SCALES.major).label}</b>}
            groups={(Object.keys(SCALE_GROUPS) as ScaleGroup[]).map((g) => ({
              title: SCALE_GROUPS[g],
              items: Object.entries(SCALES)
                .filter(([, sc]) => sc.group === g)
                .map(([k, sc]) => ({
                  key: k,
                  label: sc.label,
                  hint: sc.hint ? `${sc.steps.length} notes · ${sc.hint}` : `${sc.steps.length} notes`,
                  selected: song.scale === k,
                  onSelect: () => setSong({ scale: k }),
                })),
            }))}
          />
        </div>
        <div className="field-inline">
          <span title="The chord of each bar, as a function of bar">Harmony</span>
          <div className="harmony">
            <TextField
              className="input"
              value={song.harmony}
              spellCheck={false}
              onFocus={checkpoint}
              onValue={(harmony) => setSong({ harmony }, false)}
              style={tryCompile(song.harmony, HARMONY_VARS).error ? { borderBottomColor: 'var(--accent)' } : undefined}
              title="The chord (scale degree) as a function of bar. Channels read it as h."
            />
            <button
              className={`lock ${song.harmonyLocked ? 'on' : ''}`}
              style={{ margin: 0, opacity: song.harmonyLocked ? 1 : 0.55 }}
              title={song.harmonyLocked ? 'Harmony locked — track mutations keep it' : 'Lock the harmony against track mutations'}
              aria-pressed={!!song.harmonyLocked}
              onClick={() => setSong({ harmonyLocked: !song.harmonyLocked })}
            >
              <Icon name={song.harmonyLocked ? 'lock' : 'unlock'} size={12} />
            </button>
            <div className="w-prog">
              <Dropdown
                compact
                label="Chord progressions"
                value={(() => {
                  const prog = PROGRESSIONS.find((p) => p.formula === song.harmony);
                  // "Royal Road  IV–V–iii–vi" → "Royal Road"; a constant harmony is a drone
                  const name = prog ? prog.label.split(/\s{2,}/)[0] : /^\s*-?\d+(\.\d+)?\s*$/.test(song.harmony) ? 'Drone' : 'Custom';
                  return (
                    <b className="prog-name" title={prog?.label ?? (name === 'Drone' ? 'One chord all the way' : 'Your own progression')}>
                      {name}
                    </b>
                  );
                })()}
                groups={[
                  {
                    title: 'Progressions',
                    items: PROGRESSIONS.map((p) => ({
                      key: p.formula,
                      label: p.label,
                      hint: p.formula,
                      selected: p.formula === song.harmony,
                      onSelect: () => setSong({ harmony: p.formula }),
                    })),
                  },
                ]}
              />
            </div>
          </div>
        </div>
        <label className="field-inline hide-narrow w-space" title="Reverb — how much of the whole track rings in the room">
          <span>Reverb</span>
          <span className="space-slider">
            <input type="range" min={0} max={1} step={0.01} value={song.reverb} onChange={(e) => setSong({ reverb: Number(e.target.value) })} aria-label="Reverb" />
          </span>
        </label>
      </div>

      <div className="spacer" />

      <div className="row garden-title">
        <TextField className="project-name" value={project.name} onValue={setProjectName} aria-label="Track name" title={`${project.name} — click to rename`} />
        <GardenMenu />
      </div>
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
