import { useEffect, useRef, useState } from 'react';
import { exportMidi, exportNotesCsv, type MidiMode } from '../engine/midi';
import { NOTE_NAMES, PROGRESSION_GROUPS, PROGRESSIONS, SCALE_GROUPS, SCALES, spellDegree, type ScaleGroup } from '../engine/music';
import { tryCompile } from '../engine/expr';
import { useStore } from '../state/store';
import { togglePlay } from '../state/transport';
import { GardenMenu } from './GardenMenu';
import { FIXED_LENGTHS, shortBeats } from '../engine/steps';
import { Dropdown } from './Dropdown';
import { HARMONY_VARS, isDrum, patternBeats } from '../engine/project';
import { openMidiFile } from './MidiImportSheet';
import { Icon, Seg, Stepper, TextField, download, fileSafe, isProject } from './ui';
import { JamRecorder } from './JamRecorder';
import { clock } from '../engine/jam';
import { JAM_FILES, exportJam, useJam } from '../state/jam';

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

/**
 * The MIDI files offered: plain notes, and notes with automation. (The engine can also write MPE —
 * exportMidi(…, 'mpe') — but it isn't offered until it carries more than the automation export does.)
 */
const MIDI_EXPORTS: { mode: MidiMode; label: string; hint: string; suffix: string; done: string }[] = [
  { mode: 'notes', label: 'MIDI — notes only', hint: 'Plain notes, tempo & key. Glides become stepped notes; no bends or controllers', suffix: '', done: 'MIDI (notes only)' },
  {
    mode: 'standard',
    label: 'MIDI + automation',
    hint: 'Classic: one MIDI channel per channel — glides and bends as pitch bend, volume as expression, pressure, CC74',
    suffix: '-automation',
    done: 'MIDI with automation',
  },
];

/** a menu that closes when you click anywhere else */
function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return { open, setOpen, ref };
}

/** Bring things in: a MIDI file, a project, or a function pasted from anywhere (SoundFunc's own copies included). */
export function ImportMenu() {
  const { open, setOpen, ref } = useMenu();
  const fileRef = useRef<HTMLInputElement>(null);
  const midiRef = useRef<HTMLInputElement>(null);
  const loadProject = useStore((s) => s.loadProject);
  const setShowImport = useStore((s) => s.setShowImport);
  return (
    <div className="menu" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)} title="Import a MIDI file, a project, or paste a function">
        <Icon name="upload" size={14} /> Import
      </button>
      {open && (
        <div className="menu-pop">
          <button onClick={() => midiRef.current?.click()}>
            MIDI file… <small>Turn a .mid file into channels of functions (or drop it on the window)</small>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setShowImport(true);
            }}
          >
            Paste a function… <small>LaTeX, Desmos, plain math — or what SoundFunc copies, back as the channels it came from</small>
          </button>
          <button onClick={() => fileRef.current?.click()}>
            Project… <small>Open a .soundfunc.json file</small>
          </button>
        </div>
      )}
      <input
        ref={midiRef}
        type="file"
        accept=".mid,.midi,audio/midi,audio/x-midi"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          setOpen(false);
          if (f) void openMidiFile(f);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          setOpen(false);
          if (!f) return;
          try {
            const data = JSON.parse(await f.text());
            if (!isProject(data)) throw new Error('not a project');
            loadProject(data);
            toast(`Opened “${data.name}”`);
          } catch {
            toast('That file is not a SoundFunc project');
          }
        }}
      />
    </div>
  );
}

export function FileMenu() {
  const { open, setOpen, ref } = useMenu();
  const project = useStore((s) => s.project);
  const jam = useJam((s) => s.jam);

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
          {MIDI_EXPORTS.map((x) => (
            <button
              key={x.mode}
              onClick={run(() => {
                const stats = { raw: 0, kept: 0 };
                download(`${name}${x.suffix}.mid`, exportMidi(project, stats, x.mode) as BlobPart, 'audio/midi');
                const loops = `${project.song.exportLoops} loop${project.song.exportLoops > 1 ? 's' : ''}`;
                toast(
                  stats.raw && project.song.exportCurves !== 'full'
                    ? `Exported ${loops} as ${x.done} · curves simplified: ${stats.raw.toLocaleString()} → ${stats.kept.toLocaleString()} points`
                    : `Exported ${loops} as ${x.done}`,
                );
              })}
            >
              {x.label}{' '}
              <small>
                {x.hint}
                {x.mode !== 'notes' && (project.song.exportCurves === 'full' ? ' · every curve sample' : ' · curves simplified')}
              </small>
            </button>
          ))}
          {jam && (
            <>
              <hr />
              <div className="menu-title">Last jam · {clock(jam.seconds)}</div>
              {JAM_FILES.map((f) => (
                <button key={f.kind} disabled={f.kind === 'wav' && !jam.audio} onClick={run(() => exportJam(f.kind))}>
                  Jam — {f.label} <small>{f.hint}</small>
                </button>
              ))}
              <hr />
            </>
          )}
          <button onClick={run(() => download(`${name}-notes.csv`, exportNotesCsv(project), 'text/csv'))}>
            Note data <small>CSV of pitch, velocity, key, timing</small>
          </button>
          <button onClick={run(() => download(`${name}.soundfunc.json`, JSON.stringify(project, null, 2), 'application/json'))}>
            Project <small>Everything, to re-open later</small>
          </button>
        </div>
      )}
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

/** Glide all / Snap all: how every melodic channel plays, in one click */
function AllChannels() {
  const tracks = useStore((s) => s.project.tracks);
  const patchMelodic = useStore((s) => s.patchMelodic);
  const melodic = tracks.filter((t) => !isDrum(t.waveform));
  const allGlide = melodic.length > 0 && melodic.every((t) => t.playMode === 'glide');
  const allSnap = melodic.length > 0 && melodic.every((t) => t.quantize);
  const allFree = melodic.length > 0 && melodic.every((t) => !t.quantize);
  const none = melodic.length === 0;
  return (
    <div className="field-inline">
      <span title="Set on every melodic channel at once">All channels</span>
      <div className="row all-channels-bar">
        <button
          className={`btn small ${allGlide ? 'on' : ''}`}
          disabled={none}
          aria-pressed={allGlide}
          onClick={() => {
            patchMelodic({ playMode: allGlide ? 'notes' : 'glide' });
            toast(`${allGlide ? 'Every channel plays notes again' : 'Every melodic channel glides'} — ⌘Z to undo`);
          }}
          title={allGlide ? 'Every melodic channel glides — click to play notes again' : 'Glide all — every melodic channel follows its curve'}
        >
          Glide
        </button>
        {/* both lit only when every glide agrees — a mix of the two shows neither */}
        <Seg<'snap' | 'free' | 'mixed'>
          value={allSnap ? 'snap' : allFree ? 'free' : 'mixed'}
          onChange={(v) => {
            if (v === 'mixed') return;
            patchMelodic({ quantize: v === 'snap' });
            toast(`${v === 'snap' ? 'Every glide snaps to the scale' : 'Every glide is free pitch — between the notes'} — ⌘Z to undo`);
          }}
          options={[
            { value: 'snap', label: 'Snap' },
            { value: 'free', label: 'Free pitch' },
          ]}
        />
      </div>
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
        <JamRecorder />
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
            // spelled the way the key spells it: D♭ major, C♯ minor
            value={<b>{spellDegree(0, song.root, song.scale)}</b>}
            groups={[
              {
                title: 'Key — the root note',
                items: NOTE_NAMES.map((n, i) => ({ key: n, label: spellDegree(0, i, song.scale), selected: song.root === i, onSelect: () => setSong({ root: i }) })),
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
        <div className="field-inline w-harmony">
          <span title="The chord of each bar, as a function of bar">Harmony</span>
          <div className="harmony">
            <TextField
              className="input"
              value={song.harmony}
              spellCheck={false}
              onFocus={checkpoint}
              onValue={(harmony) => setSong({ harmony }, false)}
              style={tryCompile(song.harmony, HARMONY_VARS).error ? { borderBottomColor: 'var(--accent)' } : undefined}
              title="The chord (scale degree) as a function of bar — or of beat, for chords that change inside a bar: pick(floor(beat / 2), …). Channels read it as h."
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
                groups={(['story', 'groove', 'classic'] as const).map((g) => ({
                  title: PROGRESSION_GROUPS[g],
                  items: PROGRESSIONS.filter((p) => (p.group ?? 'classic') === g).map((p) => ({
                    key: p.formula,
                    label: p.label,
                    hint: p.story ? `${p.story}${p.scale && p.scale !== song.scale ? ` · sets ${(SCALES[p.scale] ?? SCALES.major).label}` : ''}` : p.formula,
                    selected: p.formula === song.harmony,
                    onSelect: () => {
                      setSong(p.scale ? { harmony: p.formula, scale: p.scale } : { harmony: p.formula });
                      if (p.scale && p.scale !== song.scale) toast(`${p.label.split(/\s{2,}/)[0]} — scale set to ${(SCALES[p.scale] ?? SCALES.major).label}`);
                    },
                  })),
                }))}
              />
            </div>
          </div>
        </div>
        <AllChannels />
        <label className="field-inline hide-narrow w-space" title={`Volume — the whole track's level: ${Math.round((song.volume ?? 0.8) * 100)}% (each channel's own is in its Sound tab)`}>
          <span>Volume</span>
          <span className="space-slider">
            <input type="range" min={0} max={1} step={0.01} value={song.volume ?? 0.8} onChange={(e) => setSong({ volume: Number(e.target.value) }, false)} onDoubleClick={() => setSong({ volume: 0.8 })} aria-label="Volume" />
          </span>
        </label>
      </div>

      <div className="spacer" />

      <div className="row garden-title">
        <TextField className="project-name" value={project.name} onValue={setProjectName} aria-label="Track name" title={`${project.name} — click to rename`} />
        <GardenMenu />
      </div>
      <div className="row" style={{ gap: 2 }}>
        <button className="icon-btn undo-redo" onClick={undo} disabled={!past.length} title="Undo (⌘Z)" aria-label="Undo">
          {'<'}
        </button>
        <button className="icon-btn undo-redo" onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)" aria-label="Redo">
          {'>'}
        </button>
        <button className="icon-btn" onClick={toggleTheme} title="Day / night">
          <Icon name={theme === 'light' ? 'moon' : 'sun'} />
        </button>
      </div>
      <Toast />
    </header>
  );
}
