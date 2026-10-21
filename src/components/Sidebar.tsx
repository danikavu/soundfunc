import { PRESETS } from '../engine/presets';
import { KitPicker } from './KitPicker';
import { audibleTracks, voiceLabel } from '../engine/project';
import { useSelectedTrack, useStore } from '../state/store';
import { Icon, download, fileSafe } from './ui';
import { useRef, useState, type ReactNode } from 'react';
import { functionFile, functionOf, readFunctionFile, useLibrary, type SavedFunction } from '../state/library';
import { toast } from './TopBar';

/** Functions you saved: whole tracks — every node with its values — to plant in any garden, or share as a file. */
function MyFunctions() {
  const { functions, saveFunction, deleteFunction, importFunctions } = useLibrary();
  const track = useSelectedTrack();
  const plantFunction = useStore((s) => s.plantFunction);
  const [naming, setNaming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        <button className="btn small ghost" disabled={!track} onClick={() => track && setNaming(track.name)} title="Save the selected channel — all its nodes, values, sound and grid — as a function">
          <Icon name="save" size={13} /> Save Channel
        </button>
        <button className="btn small ghost" onClick={() => fileRef.current?.click()} title="Add functions from a .json file">
          <Icon name="upload" size={13} /> Import
        </button>
        <button
          className="btn small ghost"
          disabled={!functions.length}
          onClick={() => exportFns(functions, 'soundfunc-functions.json')}
          title={functions.length ? 'Download all your functions as one file' : 'Save a channel first — then export your functions as one file'}
        >
          <Icon name="download" size={13} /> Export
        </button>
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
        {functions.map((fn) => (
        <div key={fn.id} className="mine-row">
          <button className="preset reveal" onClick={() => plantFunction(fn)} title={`Plant “${fn.name}” — ${fn.description}`}>
            <b>{fn.name}</b>
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
            <button className="icon-btn" title={`Delete “${fn.name}”`} onClick={() => confirm(`Delete the function “${fn.name}”?`) && deleteFunction(fn.id)}>
              <Icon name="close" size={11} />
            </button>
          </span>
        </div>
        ))}
      </Fold>
    </>
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
          <span className="stone" style={{ background: t.color }} />
          <div style={{ minWidth: 0 }} title={`${voiceLabel(t.waveform)}${t.playMode === 'glide' ? ' · glide' : ''} · ${t.steps} steps`}>
            <div className="track-name">{t.name}</div>
          </div>
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
        {PRESETS.map((p) => (
          <button key={p.id} className="preset reveal" onClick={() => addTrack(p.id)} title={p.description}>
            <b>{p.name}</b>
            <code>{p.formula}</code>
          </button>
        ))}
      </Fold>
    </aside>
  );
}
