import { PRESET_GROUPS, PRESETS, TRACK_COLORS, groupOf, trackFromPreset, trackFromTemplate, type PresetGroup } from '../engine/presets';
import { MiniScore } from './MiniScore';
import { KitPicker } from './KitPicker';
import { audibleTracks, stretchOf, voiceLabel } from '../engine/project';
import { useSelectedTrack, useStore } from '../state/store';
import { Icon, download, fileSafe } from './ui';
import { useRef, useState, type ReactNode } from 'react';
import { functionFile, functionOf, readFunctionFile, useLibrary, type SavedFunction } from '../state/library';
import { toast } from './TopBar';
import { canLinkFolder, forgetPresetFolder, mergeFunctions, mergeKits, mergeVoices, openPresetFolder, readFolderFiles, usePresetFolder } from '../state/presetFolder';

/** Functions you saved: whole tracks — every node with its values — to plant in any garden, or share as a file. */
function MyFunctions() {
  const { functions, saveFunction, deleteFunction, importFunctions } = useLibrary();
  const track = useSelectedTrack();
  const plantFunction = useStore((s) => s.plantFunction);
  const [naming, setNaming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const folder = usePresetFolder();

  const openFolder = async () => {
    // browsers without the File System Access API (Safari, Firefox): read a folder once instead
    if (!canLinkFolder()) return folderRef.current?.click();
    try {
      toast(await openPresetFolder());
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // closed the picker
      toast(err instanceof Error ? `Couldn’t open the folder — ${err.message}` : 'Couldn’t open the folder');
    }
  };

  const save = () => {
    const name = (naming ?? '').trim();
    setNaming(null);
    if (!name || !track) return;
    const replacing = functions.some((f) => f.name === name);
    saveFunction(functionOf(track, name));
    toast(`${replacing ? 'Updated' : 'Saved'} “${name}” — it’s under My functions, in every track`);
  };
  const exportFns = (fns: SavedFunction[], file: string) => download(file, JSON.stringify(functionFile(fns), null, 2), 'application/json');

  return (
    <>
      <div className="track-tools">
        <button className="icon-btn" disabled={!track} onClick={() => track && setNaming(track.name)} title="Save Channel — the selected channel, all its nodes, values, sound and grid, as a function" aria-label="Save channel as a function">
          <Icon name="save" size={14} />
        </button>
        <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Import functions from a .json file" aria-label="Import functions">
          <Icon name="upload" size={14} />
        </button>
        <button
          className="icon-btn"
          disabled={!functions.length}
          onClick={() => exportFns(functions, 'soundfunc-functions.json')}
          title={functions.length ? `Export all ${functions.length} functions as one file — Import reads it back` : 'Save a channel first — then export your functions as one file'}
          aria-label="Export all functions"
        >
          <Icon name="download" size={14} />
        </button>
        <button
          className={`icon-btn mine-folder ${folder.name && !folder.needsAccess ? 'on' : ''} ${folder.needsAccess ? 'needs' : ''}`}
          disabled={folder.busy}
          onClick={openFolder}
          aria-label={folder.name ? (folder.needsAccess ? `Reconnect ${folder.name}` : `Presets folder: ${folder.name}`) : 'Open presets folder'}
          title={
            !canLinkFolder()
              ? 'Load every function file in a folder (this browser can read a folder, not keep it in step — Chrome and Edge can)'
              : folder.name
                ? folder.needsAccess
                  ? `Reconnect “${folder.name}” — the browser asks for access again after a reload`
                  : `Your presets folder: ${folder.name} — Functions, Rhythm kits and Factory presets, kept in step as you save and delete. Click to choose another.`
                : 'Choose where your presets live (Documents is a good place): SoundFunc makes a “SoundFunc Presets” folder there with Functions, Rhythm kits, Voices and Factory presets, and keeps it in step as you save and delete'
          }
        >
          <Icon name="folder" size={14} />
        </button>
        {folder.name && (
          <button className="icon-btn" title={`Stop keeping “${folder.name}” in step (its files stay)`} aria-label="Forget presets folder" onClick={() => void forgetPresetFolder()}>
            <Icon name="close" size={11} />
          </button>
        )}
        <input
          ref={folderRef}
          type="file"
          hidden
          {...({ webkitdirectory: '' } as Record<string, string>)}
          onChange={async (e) => {
            const list = e.target.files;
            if (!list?.length) return;
            const { fns, kits, voices, skipped } = await readFolderFiles(list);
            e.target.value = '';
            mergeFunctions(fns);
            mergeKits(kits);
            mergeVoices(voices);
            toast(
              fns.length || kits.length || voices.length
                ? `Loaded ${fns.length} function${fns.length === 1 ? '' : 's'}, ${kits.length} kit${kits.length === 1 ? '' : 's'} and ${voices.length} voice${voices.length === 1 ? '' : 's'} from the folder${skipped ? ` · ${skipped} file${skipped > 1 ? 's' : ''} skipped` : ''}`
                : 'No SoundFunc files in that folder',
            );
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
            if (!f) return;
            try {
              const n = importFunctions(readFunctionFile(await f.text()));
              toast(n ? `Imported ${n} function${n > 1 ? 's' : ''}` : 'No functions in that file');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not read that file');
            }
          }}
        />
      </div>
      {naming !== null && (
        <div className="save-voice" style={{ margin: '0 0 8px' }}>
          <input
            className="input"
            autoFocus
            value={naming}
            onChange={(e) => setNaming(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setNaming(null);
            }}
            aria-label="Function name"
          />
          <button className="btn small primary" onClick={save}>
            Save
          </button>
          <button className="btn small ghost" onClick={() => setNaming(null)}>
            Cancel
          </button>
        </div>
      )}
      <Fold id="my-functions" title="My functions" count={functions.length} defaultOpen>
        {functions.length === 0 && <p className="muted fold-empty">Nothing saved yet.</p>}
        {functions.map((fn, i) => (
        <div key={fn.id} className="mine-row">
          <button className="preset reveal" onClick={() => plantFunction(fn)} title={`Plant “${fn.name}” — ${fn.description}`}>
            <span className="preset-line">
              <b>{fn.name}</b>
              <MiniScore id={`${fn.id}@${fn.savedAt}`} make={() => trackFromTemplate(fn.track, fn.name, 0)} color={TRACK_COLORS[i % TRACK_COLORS.length]} />
            </span>
            <code>{fn.description}</code>
          </button>
          <span className="mine-actions">
            <button
              className="icon-btn"
              title={`Download “${fn.name}”`}
              onClick={() => exportFns([fn], `${fileSafe(fn.name)}.soundfunc-function.json`)}
            >
              <Icon name="download" size={12} />
            </button>
            <button
              className="icon-btn"
              title={`Delete “${fn.name}”`}
              onClick={() => confirm(`Delete the function “${fn.name}”?${folder.name && !folder.needsAccess ? ` Its file in “${folder.name}” goes too.` : ''}`) && deleteFunction(fn.id)}
            >
              <Icon name="close" size={11} />
            </button>
          </span>
        </div>
        ))}
      </Fold>
    </>
  );
}

/** the presets, by index, in each group — worked out once */
const PRESETS_BY_GROUP = new Map<PresetGroup, { p: (typeof PRESETS)[number]; i: number }[]>();
PRESETS.forEach((p, i) => {
  const g = groupOf(p);
  PRESETS_BY_GROUP.set(g, [...(PRESETS_BY_GROUP.get(g) ?? []), { p, i }]);
});

/** One group of Function presets: a small header that folds, remembering whether you left it open. */
function PresetGroupList({ group, onPlant }: { group: PresetGroup; onPlant: (id: string) => void }) {
  const items = PRESETS_BY_GROUP.get(group) ?? [];
  const key = `sf-preset-group-${group}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? group === 'start' : v === '1';
    } catch {
      return group === 'start';
    }
  });
  if (!items.length) return null;
  const { label, hint } = PRESET_GROUPS[group];
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? '0' : '1');
      } catch {
        /* the choice just isn't remembered */
      }
      return !o;
    });
  return (
    <div className={`preset-group ${open ? 'open' : ''}`}>
      <button className="preset-group-head" onClick={toggle} aria-expanded={open} title={hint}>
        <span className="preset-group-chevron" aria-hidden>
          ›
        </span>
        <span>{label}</span>
        <small>{items.length}</small>
      </button>
      {open &&
        items.map(({ p, i }) => (
          <button key={p.id} className="preset reveal" onClick={() => onPlant(p.id)} title={p.description}>
            <span className="preset-line">
              <b>{p.name}</b>
              <MiniScore id={`preset:${p.id}`} make={() => trackFromPreset(p, i)} color={TRACK_COLORS[i % TRACK_COLORS.length]} />
            </span>
            <code>{p.formula}</code>
          </button>
        ))}
    </div>
  );
}

/** A section that folds away, remembering whether you left it open. */
function Fold({ id, title, count, defaultOpen = false, children }: { id: string; title: string; count: number; defaultOpen?: boolean; children: ReactNode }) {
  const key = `sf-fold-${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v === null ? defaultOpen : v === '1';
    } catch {
      return defaultOpen;
    }
  });
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? '0' : '1');
      } catch {
        /* the choice just isn't remembered */
      }
      return !o;
    });
  };
  return (
    <div className={`fold ${open ? 'open' : ''}`}>
      <button className="fold-trigger" onClick={toggle} aria-expanded={open}>
        <span>{title}</span>
        <small>{count}</small>
        <span className="fold-chevron" aria-hidden>
          ›
        </span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const { project, selectTrack, updateTrack, addTrack, removeTrack, duplicateTrack, setAllTracks } = useStore();
  const allMuted = project.tracks.length > 0 && project.tracks.every((t) => t.muted);
  const anySolo = project.tracks.some((t) => t.solo);
  const selected = useSelectedTrack();
  const audible = new Set(audibleTracks(project.tracks).map((t) => t.id));

  return (
    <aside className="panel">
      <div className="eyebrow">Channels</div>
      <div className="tracks-head">
        {project.tracks.length > 0 && (
          <div className="ms-col">
            <button
              className={`ms ${allMuted ? 'on' : ''}`}
              title={allMuted ? 'Unmute every channel' : 'Mute every channel'}
              aria-label={allMuted ? 'Unmute all' : 'Mute all'}
              onClick={() => setAllTracks('muted', !allMuted)}
            >
              M
            </button>
            <button
              className={`ms solo ${anySolo ? 'on' : ''}`}
              title={anySolo ? 'Clear every solo' : 'Solo every channel'}
              aria-label={anySolo ? 'Unsolo all' : 'Solo all'}
              onClick={() => setAllTracks('solo', !anySolo)}
            >
              S
            </button>
          </div>
        )}
        <div className="tracks-head-tools">
          <button className="icon-btn" onClick={() => addTrack('blank')} title="New empty channel — a clock, one formula and Note Out" aria-label="New empty channel">
            <Icon name="plus" size={16} />
          </button>
          <button className="icon-btn" onClick={() => useStore.getState().setShowImport(true)} title="Paste a function — LaTeX, Desmos or plain math" aria-label="Paste function">
            <span className="serif fx-glyph">ƒ</span>
          </button>
          {project.tracks.length > 0 && (
            <button
              className="icon-btn"
              onClick={() => {
                const n = project.tracks.length;
                useStore.getState().clearTracks();
                toast(`Cleared ${n} channel${n > 1 ? 's' : ''} — ⌘Z brings them back`);
              }}
              title="Clear — remove every channel (⌘Z to undo)"
              aria-label="Clear all channels"
            >
              <Icon name="trash" size={17} />
            </button>
          )}
        </div>
      </div>
      {project.tracks.map((t) => (
        <div
          key={t.id}
          className={`track ${selected?.id === t.id ? 'selected' : ''} ${audible.has(t.id) ? '' : 'dim'}`}
          onClick={() => selectTrack(t.id)}
        >
          <div className="ms-col" onClick={(e) => e.stopPropagation()}>
            <button className={`ms ${t.muted ? 'on' : ''}`} title="Mute" aria-label={`Mute ${t.name}`} onClick={() => updateTrack(t.id, { muted: !t.muted })}>
              M
            </button>
            <button className={`ms solo ${t.solo ? 'on' : ''}`} title="Solo" aria-label={`Solo ${t.name}`} onClick={() => updateTrack(t.id, { solo: !t.solo })}>
              S
            </button>
          </div>
          <span className="ch-num" style={{ background: t.color }}>
            {project.tracks.indexOf(t) + 1}
          </span>
          <div style={{ minWidth: 0 }} title={`${voiceLabel(t.waveform)}${t.playMode === 'glide' ? ' · glide' : ''} · ${t.steps} steps`}>
            <div className="track-name">
              {t.name}
              {stretchOf(t) !== 1 && <small className="stretch-badge">×{Number(stretchOf(t).toFixed(3))}</small>}
            </div>
          </div>
          <span className={`led ${audible.has(t.id) ? 'on' : ''}`} title={audible.has(t.id) ? 'Sounding' : t.muted ? 'Muted' : 'Silent — another channel is soloed'} />
          <div className="track-actions" onClick={(e) => e.stopPropagation()}>
            <button className="ms remove" title="Duplicate channel — every node, value and slider" aria-label={`Duplicate ${t.name}`} onClick={() => duplicateTrack(t.id)}>
              <Icon name="copy" size={11} />
            </button>
            <button className="ms remove" title="Remove channel (⌘Z to undo)" aria-label={`Remove ${t.name}`} onClick={() => removeTrack(t.id)}>
              <Icon name="close" size={11} />
            </button>
          </div>
        </div>
      ))}
      {project.tracks.length === 0 && <p className="muted serif">An empty track. Plant something below.</p>}

      <KitPicker />

      <div className="eyebrow">Plant a function</div>
      <MyFunctions />
      <Fold id="function-presets" title="Function presets" count={PRESETS.length}>
        {(Object.keys(PRESET_GROUPS) as PresetGroup[]).map((g) => (
          <PresetGroupList key={g} group={g} onPlant={addTrack} />
        ))}
      </Fold>
    </aside>
  );
}
