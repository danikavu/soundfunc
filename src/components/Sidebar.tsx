import { PRESET_GROUPS, PRESETS, TRACK_COLORS, groupOf, trackFromPreset, trackFromTemplate, type PresetGroup } from '../engine/presets';
import { MiniScore } from './MiniScore';
import { KitPicker } from './KitPicker';
import { audibleTracks, groupRuns, stretchOf, voiceLabel, type Group, type Track } from '../engine/project';
import { usePicked, useSelectedTrack, useStore } from '../state/store';
import { Icon, download, fileSafe } from './ui';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { functionFile, functionOf, readFunctionFile, useLibrary, type SavedFunction } from '../state/library';
import { toast } from './TopBar';
import { canLinkFolder, forgetPresetFolder, mergeFunctions, mergeKits, mergeVoices, openPresetFolder, readFolderFiles, usePresetFolder } from '../state/presetFolder';

/** Functions you saved: whole tracks — every node with its values — to plant in any garden, or share as a file. */
/** My functions in date order: newest first (↓) or oldest first (↑) */
type Order = 'newest' | 'oldest';
const ORDER_KEY = 'sf.presetOrder';
function useOrder() {
  const [order, setOrder] = useState<Order>(() => {
    try {
      const v = localStorage.getItem(ORDER_KEY);
      return v === 'oldest' ? 'oldest' : 'newest';
    } catch {
      return 'newest';
    }
  });
  const set = (o: Order) => {
    setOrder(o);
    try {
      localStorage.setItem(ORDER_KEY, o);
    } catch {
      /* private window: it just won't be remembered */
    }
  };
  return [order, set] as const;
}

function MyFunctions() {
  const [order, setOrder] = useOrder();
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
        <span className="mine-order" role="group" aria-label="Order My functions by date">
          <button className={`icon-btn order-key ${order === 'newest' ? 'on' : ''}`} aria-pressed={order === 'newest'} onClick={() => setOrder('newest')} title="Newest first — the function you saved last at the top" aria-label="Newest first">
            <Icon name="caret" size={13} />
          </button>
          <button className={`icon-btn order-key ${order === 'oldest' ? 'on' : ''}`} aria-pressed={order === 'oldest'} onClick={() => setOrder('oldest')} title="Oldest first — the function you saved first at the top" aria-label="Oldest first">
            <Icon name="caretUp" size={13} />
          </button>
        </span>
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
        {[...functions].sort((a, b) => (order === 'newest' ? b.savedAt - a.savedAt : a.savedAt - b.savedAt)).map((fn, i) => (
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
              onClick={() => (deleteFunction(fn.id), toast(`Deleted the function “${fn.name}”${folder.name && !folder.needsAccess ? `, and its file in “${folder.name}”` : ''}`))}
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

/** a built-in preset as a function file, the same kind My functions exports — its own description kept */
function exportPreset(p: (typeof PRESETS)[number], i: number) {
  const fn = { ...functionOf(trackFromPreset(p, i), p.name), description: p.description };
  download(`${fileSafe(p.name)}.soundfunc-function.json`, JSON.stringify(functionFile([fn]), null, 2), 'application/json');
}

/** one built-in preset: plant it on click, export it on hover */
function PresetRow({ p, i, onPlant }: { p: (typeof PRESETS)[number]; i: number; onPlant: (id: string) => void }) {
  return (
    <div className="mine-row">
      <button className="preset reveal" onClick={() => onPlant(p.id)} title={p.description}>
        <span className="preset-line">
          <b>{p.name}</b>
          <MiniScore id={`preset:${p.id}`} make={() => trackFromPreset(p, i)} color={TRACK_COLORS[i % TRACK_COLORS.length]} />
        </span>
        <code>{p.formula}</code>
      </button>
      <span className="mine-actions">
        <button className="icon-btn" title={`Export “${p.name}” as a function file — Import puts it under My functions`} aria-label={`Export ${p.name}`} onClick={() => exportPreset(p, i)}>
          <Icon name="download" size={12} />
        </button>
      </span>
    </div>
  );
}

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
      {open && items.map(({ p, i }) => <PresetRow key={p.id} p={p} i={i} onPlant={onPlant} />)}
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

/** how far the pointer goes before a press on a channel is a drag (px) */
const DRAG_FROM = 5;

/** where a drag lands: before the row `slot` of the list (the count = after the last), and in which group */
interface Drop {
  ids: string[];
  slot: number;
  group: string | null;
}

/**
 * Dragging channels to another place: the pressed one — or, when it is one of several selected, all
 * of them; or a group, by its header — goes where the line shows. Dropped among a group's channels
 * (or just under its header), a channel joins it; dropped anywhere else, it is loose. Near the top or
 * bottom the list scrolls; Esc lets go.
 */
function useChannelDrag() {
  const list = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drop | null>(null);
  /** a drag just ended: the click that follows isn't one */
  const justDragged = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  /** `group`: the group being dragged by its header */
  const onPointerDown = (e: ReactPointerEvent, ids: string[], group?: string) => {
    if (e.button !== 0 || e.pointerType === 'touch' || (e.target as Element).closest('.ms-col, .track-actions, .group-tools, input')) return;
    stop.current?.();
    const x0 = e.clientX, y0 = e.clientY;
    const ends = new AbortController();
    const { signal } = ends;
    let moving: string[] | null = null;
    let drop: Drop | null = null, y = y0, raf = 0;
    const place = () => {
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])];
      const boxes = rows.map((r) => r.getBoundingClientRect());
      let slot = boxes.filter((r) => y > r.top + r.height / 2).length;
      const below = slot === rows.length && boxes.length > 0 && y > boxes[boxes.length - 1].bottom + 6;
      const before = rows[slot - 1]?.dataset, after = rows[slot]?.dataset;
      // just under an open group's header, or after one of its channels: in that group
      let into: string | null = !below && before?.group && !(before.kind === 'head' && before.collapsed) ? before.group : null;
      if (group) {
        // a group never goes inside another: past it, instead
        if (into && into !== group) {
          while (rows[slot]?.dataset.group === into) slot++;
        }
        into = null;
      }
      void after;
      drop = { ids: moving!, slot, group: into };
      setDrag((d) => (d && d.slot === drop!.slot && d.group === drop!.group ? d : drop));
    };
    const scroll = () => {
      raf = requestAnimationFrame(scroll);
      const box = list.current;
      if (!box) return;
      const b = box.getBoundingClientRect();
      // the header stays put over the top of the list
      const top = (box.querySelector('.side-channels-head')?.getBoundingClientRect().bottom ?? b.top) + 16;
      const over = y < top ? y - top : y > b.bottom - 24 ? y - b.bottom + 24 : 0;
      if (!over) return;
      box.scrollTop += Math.max(-12, Math.min(12, over / 4));
      place();
    };
    const done = (ok: boolean) => {
      ends.abort();
      cancelAnimationFrame(raf);
      stop.current = null;
      document.documentElement.classList.remove('dragging-channels');
      if (!moving) return;
      setDrag(null);
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
      if (!ok || !drop) return;
      // the slot, as a place in the list of channels: before the channel that row is (or starts)
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[data-row]') ?? [])];
      const { tracks } = useStore.getState().project;
      const r = rows[drop.slot]?.dataset;
      const to = !r ? tracks.length : r.kind === 'track' ? tracks.findIndex((t) => t.id === r.id) : tracks.findIndex((t) => t.group === r.group);
      useStore.getState().moveTracks(moving, Math.max(0, to), group ? undefined : drop.group);
    };
    stop.current = () => done(false);
    window.addEventListener(
      'pointermove',
      (m) => {
        y = m.clientY;
        if (!moving) {
          if (Math.hypot(m.clientX - x0, m.clientY - y0) < DRAG_FROM) return;
          moving = ids;
          document.documentElement.classList.add('dragging-channels');
          scroll();
        }
        place();
      },
      { signal },
    );
    window.addEventListener('pointerup', () => done(true), { signal });
    window.addEventListener('pointercancel', () => done(false), { signal });
    window.addEventListener(
      'keydown',
      (k) => {
        if (k.key !== 'Escape' || !moving) return;
        k.stopPropagation();
        done(false);
      },
      { signal, capture: true },
    );
  };
  return { list, drag, justDragged, onPointerDown };
}

/** a group's header: fold it, name it, mute or solo all of it, let it go; click to select its channels, drag to move them */
function GroupHead({ group, tracks, row, drop, dragged, onPointerDown, justDragged }: { group: Group; tracks: Track[]; row: number; drop: string; dragged: boolean; onPointerDown: (e: ReactPointerEvent) => void; justDragged: { current: boolean } }) {
  const { updateGroup, ungroup, editTracks, setPicked } = useStore();
  const liveFades = useStore((st) => st.liveFades);
  const [naming, setNaming] = useState(false);
  const ids = tracks.map((t) => t.id);
  const allMuted = liveFades ? ids.every((id) => liveFades.down.includes(id)) : tracks.every((t) => t.muted);
  const allSolo = tracks.every((t) => t.solo);
  return (
    <div
      className={`group-head ${group.collapsed ? 'collapsed' : ''} ${dragged ? 'dragged' : ''} ${drop}`}
      data-row={row}
      data-kind="head"
      data-group={group.id}
      data-collapsed={group.collapsed ? '1' : undefined}
      onPointerDown={onPointerDown}
      onClick={() => !justDragged.current && setPicked(ids)}
      title="Click to select the group’s channels; drag to move the group"
    >
      <div className="ms-col" onClick={(e) => e.stopPropagation()}>
        <button
          className={`ms ${allMuted ? 'on' : ''}`}
          title={liveFades ? (allMuted ? 'Bring the group in at the start of the next loop' : 'Switch the group off') : allMuted ? 'Unmute the group' : 'Mute the group'}
          aria-label={`Mute group ${group.name}`}
          onClick={() => (liveFades ? liveFades.toggleMany(ids) : editTracks(ids, { muted: !allMuted }))}
        >
          M
        </button>
        <button className={`ms solo ${allSolo ? 'on' : ''}`} title={allSolo ? 'Unsolo the group' : 'Solo the group'} aria-label={`Solo group ${group.name}`} onClick={() => editTracks(ids, { solo: !allSolo })}>
          S
        </button>
      </div>
      <button
        className="group-fold"
        onClick={(e) => (e.stopPropagation(), updateGroup(group.id, { collapsed: !group.collapsed }))}
        aria-expanded={!group.collapsed}
        title={group.collapsed ? 'Open the group' : 'Fold the group'}
        aria-label={group.collapsed ? `Open ${group.name}` : `Fold ${group.name}`}
      >
        ›
      </button>
      {naming ? (
        <input
          className="input group-name-input"
          autoFocus
          defaultValue={group.name}
          onFocus={(e) => e.target.select()}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => (setNaming(false), e.target.value.trim() && updateGroup(group.id, { name: e.target.value.trim() }))}
          onKeyDown={(e) => (e.key === 'Enter' ? e.currentTarget.blur() : e.key === 'Escape' && setNaming(false))}
          aria-label="Group name"
        />
      ) : (
        <span className="group-name" onDoubleClick={(e) => (e.stopPropagation(), setNaming(true))} title="Double-click to rename">
          {group.name} <small>{tracks.length}</small>
        </span>
      )}
      <div className="group-tools" onClick={(e) => e.stopPropagation()}>
        <button className="ms remove" title="Ungroup — the channels stay" aria-label={`Ungroup ${group.name}`} onClick={() => ungroup(group.id)}>
          <Icon name="close" size={11} />
        </button>
        <button
          className="ms remove"
          title="Delete the group and its channels (⌘Z to undo)"
          aria-label={`Delete group ${group.name}`}
          onClick={() => {
            useStore.getState().removeTracks(ids);
            toast(`Deleted ${group.name} and its ${tracks.length} channels — ⌘Z brings them back`);
          }}
        >
          <Icon name="trash" size={11} />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { project, selectTrack, pickTrack, updateTrack, editTracks, addTrack, removeTrack, duplicateTrack, duplicateTracks, removeTracks, setAllTracks, groupTracks } = useStore();
  const picked = usePicked().map((t) => t.id);
  const many = picked.length > 1;
  const { list, drag, justDragged, onPointerDown } = useChannelDrag();
  /** a channel's M, S or lock: on one of several selected, it sets them all */
  const flag = (t: (typeof project.tracks)[number], patch: { muted?: boolean; solo?: boolean; locked?: boolean }) =>
    many && picked.includes(t.id) ? editTracks(picked, patch) : updateTrack(t.id, patch);
  // Esc: back to one channel
  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      if (e.key === 'Escape' && !typing && !document.querySelector('.sheet-backdrop') && !useStore.getState().audition) useStore.getState().setPicked([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [many]);
  const allMuted = project.tracks.length > 0 && project.tracks.every((t) => t.muted);
  const anySolo = project.tracks.some((t) => t.solo);
  const allLocked = project.tracks.length > 0 && project.tracks.every((t) => t.locked);
  const selected = useSelectedTrack();
  const liveFades = useStore((st) => st.liveFades);
  const audible = new Set(audibleTracks(project.tracks).map((t) => t.id));
  // the list as it is drawn: each group's header, then its channels (unless folded); loose channels as they are
  const rows: ({ kind: 'head'; group: Group; tracks: Track[] } | { kind: 'track'; t: Track; i: number })[] = [];
  for (const run of groupRuns(project)) {
    if (run.group) rows.push({ kind: 'head', group: run.group, tracks: run.tracks });
    if (!run.group?.collapsed) for (const t of run.tracks) rows.push({ kind: 'track', t, i: project.tracks.indexOf(t) });
  }
  /** the drop line, on a row: above it — or below it, for the very end */
  const dropAt = (ri: number) => (!drag ? '' : drag.slot === ri ? `drop-before ${drag.group ? 'drop-in' : ''}` : drag.slot === rows.length && ri === rows.length - 1 ? `drop-after ${drag.group ? 'drop-in' : ''}` : '');
  const trackRow = (t: Track, i: number, ri: number) => (
        <div
          key={t.id}
          className={`track ${t.group ? 'in-group' : ''} ${selected?.id === t.id ? 'selected' : ''} ${many && picked.includes(t.id) ? 'picked' : ''} ${audible.has(t.id) ? '' : 'dim'} ${drag?.ids.includes(t.id) ? 'dragged' : ''} ${dropAt(ri)}`}
          aria-selected={picked.includes(t.id)}
          data-row={ri}
          data-kind="track"
          data-id={t.id}
          data-group={t.group}
          onPointerDown={(e) => onPointerDown(e, picked.includes(t.id) ? picked : [t.id])}
          onClick={(e) => {
            if (justDragged.current) return;
            if (e.shiftKey) pickTrack(t.id, 'range');
            else if (e.metaKey || e.ctrlKey) pickTrack(t.id, 'toggle');
            else selectTrack(t.id);
          }}
        >
          <div className="ms-col" onClick={(e) => e.stopPropagation()}>
            {liveFades ? (
              // video studio: M switches the channel — off at once, back on at the start of the next loop
              <button
                className={`ms ${liveFades.down.includes(t.id) ? 'on' : ''} ${liveFades.cued.includes(t.id) ? 'cued' : ''}`}
                title={liveFades.cued.includes(t.id) ? 'Comes in at the start of the next loop' : liveFades.down.includes(t.id) ? 'Bring in at the start of the next loop' : 'Switch off'}
                aria-label={`Mute ${t.name}`}
                onClick={() => liveFades.toggle(t.id)}
              >
                M
              </button>
            ) : (
              <button className={`ms ${t.muted ? 'on' : ''}`} title="Mute" aria-label={`Mute ${t.name}`} onClick={() => flag(t, { muted: !t.muted })}>
                M
              </button>
            )}
            <button className={`ms solo ${t.solo ? 'on' : ''}`} title="Solo" aria-label={`Solo ${t.name}`} onClick={() => flag(t, { solo: !t.solo })}>
              S
            </button>
            <button
              className={`ms lock ${t.locked ? 'on' : ''}`}
              title={t.locked ? 'Locked — Mutate leaves this channel alone. Click to unlock' : 'Lock this channel against Mutate'}
              aria-label={`${t.locked ? 'Unlock' : 'Lock'} ${t.name}`}
              aria-pressed={!!t.locked}
              onClick={() => flag(t, { locked: !t.locked })}
            >
              <Icon name={t.locked ? 'lock' : 'unlock'} size={10} />
            </button>
          </div>
          {/* the number is a tick: click it to select several */}
          <span
            className="ch-num"
            style={{ background: t.color }}
            title={`${many && picked.includes(t.id) ? 'Take out of' : 'Add to'} the selection (also ⌘-click the channel, ⇧-click for a run). Drag the channel to move it`}
            onClick={(e) => {
              e.stopPropagation();
              if (justDragged.current) return;
              pickTrack(t.id, e.shiftKey ? 'range' : 'toggle');
            }}
          >
            {i + 1}
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
      );
  // two halves that scroll on their own: the channels always in view above, kits and functions below
  return (
    <aside className="panel side-split">
      <div className="side-half side-channels" ref={list}>
      {/* the header and its keys stay put while a long list of channels scrolls under them */}
      <div className="side-channels-head">
      <div className="channels-title">
        <div className={`eyebrow ${many ? 'eyebrow-picked' : ''}`}>{many ? `${picked.length} selected` : 'Channels'}</div>
        {many && (
          <div className="picked-tools" role="toolbar" aria-label="Selected channels">
            <button
              className="icon-btn"
              onClick={() => {
                groupTracks(picked);
                toast(`Grouped ${picked.length} channels — double-click the group’s name to rename it`);
              }}
              title={`Group the ${picked.length} selected channels`}
              aria-label="Group the selected channels"
            >
              <Icon name="folder" size={12} />
            </button>
            <button className="icon-btn" onClick={() => duplicateTracks(picked)} title={`Duplicate the ${picked.length} selected channels`} aria-label="Duplicate the selected channels">
              <Icon name="copy" size={12} />
            </button>
            <button
              className="icon-btn"
              onClick={() => {
                removeTracks(picked);
                toast(`Removed ${picked.length} channels — ⌘Z brings them back`);
              }}
              title={`Remove the ${picked.length} selected channels (⌘Z to undo)`}
              aria-label="Remove the selected channels"
            >
              <Icon name="trash" size={12} />
            </button>
            <button className="icon-btn" onClick={() => useStore.getState().setPicked([])} title="Select just one again (Esc)" aria-label="Clear the selection">
              <Icon name="close" size={12} />
            </button>
          </div>
        )}
      </div>
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
            <button
              className={`ms lock ${allLocked ? 'on' : ''}`}
              title={allLocked ? 'Unlock every channel — Mutate may change them again' : 'Lock every channel against Mutate'}
              aria-label={allLocked ? 'Unlock all' : 'Lock all'}
              onClick={() => setAllTracks('locked', !allLocked)}
            >
              <Icon name={allLocked ? 'lock' : 'unlock'} size={10} />
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
              <Icon name="close" size={17} />
            </button>
          )}
        </div>
      </div>
      </div>
      {rows.map((r, ri) =>
        r.kind === 'head' ? (
          <GroupHead key={r.group.id} group={r.group} tracks={r.tracks} row={ri} drop={dropAt(ri)} dragged={!!drag && r.tracks.every((t) => drag.ids.includes(t.id))} justDragged={justDragged} onPointerDown={(e) => onPointerDown(e, r.tracks.map((t) => t.id), r.group.id)} />
        ) : (
          trackRow(r.t, r.i, ri)
        ),
      )}
      {project.tracks.length === 0 && <p className="muted serif">An empty track. Plant something below.</p>}
      </div>

      <div className="side-half side-plant">
      <KitPicker />

      <div className="eyebrow">Plant a function</div>
      <MyFunctions />
      <Fold id="function-presets" title="Function presets" count={PRESETS.length}>
        {(Object.keys(PRESET_GROUPS) as PresetGroup[]).map((g) => (
          <PresetGroupList key={g} group={g} onPlant={addTrack} />
        ))}
      </Fold>
      </div>
    </aside>
  );
}
