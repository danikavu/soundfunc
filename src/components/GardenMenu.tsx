import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultProject } from '../engine/presets';
import { projectKey, useLibrary } from '../state/library';
import { useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon } from './ui';

/** Save the current garden (overwriting its saved copy, if it has one). ⌘S */
export function saveGarden(asCopy = false) {
  const { project, currentProjectId, setCurrentProjectId, setProjectName } = useStore.getState();
  const { saveProject, projects } = useLibrary.getState();
  let target = asCopy ? null : currentProjectId;
  if (target && !projects.some((p) => p.id === target)) target = null; // it was deleted
  let p = project;
  if (asCopy) {
    // "Name" → "Name 2", "Name 3"…
    const base = project.name.replace(/\s+\d+$/, '');
    let i = 2;
    while (projects.some((x) => x.name === `${base} ${i}`)) i++;
    setProjectName(`${base} ${i}`);
    p = useStore.getState().project;
  }
  const id = saveProject(p, target);
  setCurrentProjectId(id);
  toast(`Saved “${p.name}”`);
}

/** true when the open garden differs from its saved copy (or was never saved) */
export function useUnsaved(): boolean {
  const project = useStore((s) => s.project);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const saved = useLibrary((s) => s.projects.find((p) => p.id === currentProjectId));
  const savedKey = useMemo(() => (saved ? projectKey(saved.project) : null), [saved]);
  return useMemo(() => savedKey === null || projectKey(project) !== savedKey, [project, savedKey]);
}

function ago(ms: number): string {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function GardenMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const projects = useLibrary((s) => s.projects);
  const deleteProject = useLibrary((s) => s.deleteProject);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const loadProject = useStore((s) => s.loadProject);
  const unsaved = useUnsaved();
  const currentName = useStore((s) => s.project.name);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const leave = (what: string) =>
    !unsaved || confirm(`“${currentName}” has unsaved changes. ${what} anyway?\n(You can still get them back with ⌘Z.)`);

  return (
    <div className="menu garden-menu" ref={ref}>
      <button className="icon-btn save-btn" onClick={() => saveGarden()} title={unsaved ? 'Save (⌘S) — there are unsaved changes' : 'Save (⌘S) — saved'} aria-label="Save track">
        <Icon name="save" size={21} />
        {unsaved && <span className="unsaved-dot" />}
      </button>
      <button className={`icon-btn garden-caret ${open ? 'active' : ''}`} onClick={() => setOpen((o) => !o)} title="Your tracks — save as a copy, open, start anew" aria-label="Your tracks">
        <Icon name="caret" size={13} />
      </button>
      {open && (
        <div className="menu-pop garden-pop">
          <button
            onClick={() => {
              saveGarden();
              setOpen(false);
            }}
          >
            Save <kbd>⌘S</kbd>
            <small>{currentProjectId ? 'Update the saved copy' : 'Keep this track in your library'}</small>
          </button>
          <button
            onClick={() => {
              saveGarden(true);
              setOpen(false);
            }}
          >
            Save as a copy <small>Branch off under a new name</small>
          </button>
          <button
            onClick={() => {
              if (!leave('Start a new track')) return;
              loadProject(defaultProject());
              setOpen(false);
            }}
          >
            New track <small>Start from the default three channels</small>
          </button>
          <hr />
          <div className="garden-list-head">Your tracks</div>
          {projects.length === 0 && <p className="muted garden-empty">Nothing saved yet. Save keeps every channel, node and setting.</p>}
          {projects.map((sp) => (
            <div key={sp.id} className={`garden-row ${sp.id === currentProjectId ? 'current' : ''}`}>
              <button
                onClick={() => {
                  if (sp.id !== currentProjectId && !leave(`Open “${sp.name}”`)) return;
                  loadProject(sp.project, sp.id);
                  setOpen(false);
                  toast(`Opened “${sp.name}”`);
                }}
              >
                <span className="serif">{sp.name}</span>
                <small>
                  {sp.project.tracks.length} channels · {sp.project.song.bpm} bpm · {ago(sp.savedAt)}
                  {sp.id === currentProjectId && (unsaved ? ' · open, edited' : ' · open')}
                </small>
              </button>
              <button
                className="icon-btn"
                title={`Delete “${sp.name}”`}
                onClick={() => {
                  if (!confirm(`Delete the saved track “${sp.name}”? This can’t be undone.`)) return;
                  deleteProject(sp.id);
                  if (sp.id === currentProjectId) useStore.getState().setCurrentProjectId(null);
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
