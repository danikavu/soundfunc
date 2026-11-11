import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NOTE_NAMES, SCALES } from '../engine/music';
import { KIT_GROUPS, KITS, TRACK_COLORS, kitGroupOf, type KitGroup } from '../engine/presets';
import { isDrum, voiceLabel, type Waveform } from '../engine/project';
import { asKit, kitFile, kitOf, readKitFile, savedKitOf, useLibrary } from '../state/library';
import { useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon, download, fileSafe } from './ui';

/**
 * Rhythm kits in one place: pick a kit, then plant all of it, layer it, or bring
 * just its percussion — or single tracks — into the garden you are working on.
 */
export function KitPicker() {
  const [open, setOpen] = useState(false);
  const [kitId, setKitId] = useState(KITS[0].id);
  const [adopt, setAdopt] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const { addKit, addKitTracks } = useStore();
  const bpm = useStore((s) => s.project.song.bpm);
  const { kits: mine, saveKit, deleteKit, importKits } = useLibrary();
  const [naming, setNaming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // your own kits first, then the built-in ones
  const allKits = [...mine.map(asKit), ...KITS];
  const kit = allKits.find((k) => k.id === kitId) ?? KITS[0];
  const saved = kit.id.startsWith('mine:') ? mine.find((k) => `mine:${k.id}` === kit.id) : undefined;

  const saveCurrent = () => {
    const name = (naming ?? '').trim();
    setNaming(null);
    if (!name) return;
    const { project } = useStore.getState();
    if (!project.tracks.length) return toast('Nothing to save — the track has no channels');
    const replacing = mine.some((k) => k.name === name);
    const k = kitOf(project, name);
    saveKit(k);
    setKitId(`mine:${k.id}`);
    toast(`${replacing ? 'Updated' : 'Saved'} the kit “${name}” — ${k.tracks.length} channels, under My kits`);
  };
  const exportKits = (ks: typeof mine, file: string) => download(file, JSON.stringify(kitFile(ks), null, 2), 'application/json');
  const drums = kit.tracks.map((t, i) => (isDrum(t.waveform as Waveform) ? i : -1)).filter((i) => i >= 0);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = pop.current?.offsetHeight ?? 420;
    setPos({
      left: r.right + 10,
      top: Math.max(12, Math.min(r.top - 40, window.innerHeight - h - 12)),
    });
  }, [open, kitId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const tempoNote = adopt && kit.song?.bpm && kit.song.bpm !== bpm ? ` · tempo → ${kit.song.bpm}` : '';

  return (
    <>
      <button ref={btn} className={`kit-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          <b className="serif">Rhythm kits</b>
        </span>
        <span className="kit-chevron" aria-hidden>
          ›
        </span>
      </button>

      {open && (
        <div className="kit-pop" ref={pop} style={{ left: pos.left, top: pos.top }} role="dialog" aria-label="Rhythm kits">
          <ul className="kit-list">
            {/* My kits: save the track you're working on as a kit, or bring kits in from a file */}
            <li className="kit-group-head">{KIT_GROUPS.mine}</li>
            <li className="kit-mine-tools">
              {naming === null ? (
                <>
                  <button className="btn small ghost" onClick={() => setNaming(useStore.getState().project.name || 'My kit')} title="Save every channel of this track, with its tempo, key and harmony, as a kit">
                    <Icon name="save" size={12} /> Save as kit
                  </button>
                  <span className="row" style={{ gap: 2 }}>
                    <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Import kits from a .json file" aria-label="Import kits">
                      <Icon name="upload" size={12} />
                    </button>
                    <button className="icon-btn" disabled={!mine.length} onClick={() => exportKits(mine, 'soundfunc-kits.json')} title="Export all your kits as one file" aria-label="Export all kits">
                      <Icon name="download" size={12} />
                    </button>
                  </span>
                </>
              ) : (
                <span className="save-voice">
                  <input
                    className="input"
                    autoFocus
                    value={naming}
                    onChange={(e) => setNaming(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') saveCurrent();
                      if (e.key === 'Escape') setNaming(null);
                    }}
                    aria-label="Kit name"
                  />
                  <button className="btn small primary" onClick={saveCurrent}>
                    Save
                  </button>
                </span>
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
                    const n = importKits(readKitFile(await f.text()));
                    toast(n ? `Imported ${n} kit${n > 1 ? 's' : ''} — under My kits` : 'No kits in that file');
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Could not read that file');
                  }
                }}
              />
            </li>
            {!mine.length && <li className="kit-mine-empty muted">Nothing saved yet.</li>}
            {(Object.keys(KIT_GROUPS) as KitGroup[]).flatMap((g) => {
              const kits = allKits.filter((k) => kitGroupOf(k) === g);
              // My kits' header is above, with its tools
              if (g === 'mine')
                return kits.map((k) => (
                  <li key={k.id}>
                    <button className={k.id === kitId ? 'on' : ''} onMouseEnter={() => setKitId(k.id)} onFocus={() => setKitId(k.id)} onClick={() => setKitId(k.id)}>
                      <span className="serif">{k.name}</span>
                      <small>
                        {k.song?.bpm ? `${k.song.bpm} bpm · ` : ''}
                        {k.tracks.length} channels
                      </small>
                    </button>
                  </li>
                ));
              return kits.length
                ? [
                    <li key={`group-${g}`} className="kit-group-head">
                      {KIT_GROUPS[g]}
                    </li>,
                    ...kits.map((k) => (
                      <li key={k.id}>
                        <button className={k.id === kitId ? 'on' : ''} onMouseEnter={() => setKitId(k.id)} onFocus={() => setKitId(k.id)} onClick={() => setKitId(k.id)}>
                          <span className="serif">{k.name}</span>
                          <small>
                            {k.song?.bpm ? `${k.song.bpm} bpm · ` : ''}
                            {k.tracks.length} channels
                          </small>
                        </button>
                      </li>
                    )),
                  ]
                : [];
            })}
          </ul>

          <div className="kit-detail">
            <h3 className="serif">{kit.name}</h3>
            <div className="row kit-mine-actions">
              <button className="btn small ghost" onClick={() => exportKits([saved ?? savedKitOf(kit)], `${fileSafe(kit.name)}.soundfunc-kit.json`)} title={`Export “${kit.name}” as a kit file — import it under My kits anywhere`}>
                <Icon name="download" size={12} /> Export kit
              </button>
              {saved && (
                <button
                  className="btn small ghost"
                  onClick={() => {
                    deleteKit(saved.id);
                    toast(`Deleted the kit “${saved.name}”`);
                    setKitId(KITS[0].id);
                  }}
                  title={`Delete “${saved.name}”`}
                >
                  <Icon name="trash" size={12} /> Delete
                </button>
              )}
            </div>
            <p className="muted">{kit.description}</p>
            {kit.song && (
              <p className="kit-meta">
                {kit.song.bpm} bpm
                {kit.song.root !== undefined && ` · ${NOTE_NAMES[kit.song.root]} ${(SCALES[kit.song.scale ?? 'major'] ?? SCALES.major).label}`}
              </p>
            )}

            <div className="kit-actions">
              <button
                className="btn primary small"
                onClick={() => {
                  addKit(kit, false);
                  setOpen(false);
                  toast(`Planted ${kit.name} — ⌘Z to bring your track back`);
                }}
              >
                Replace track
              </button>
              <button
                className="btn small"
                onClick={() => {
                  addKitTracks(
                    kit,
                    kit.tracks.map((_, i) => i),
                    adopt,
                  );
                  toast(`Layered all of ${kit.name}${tempoNote}`);
                }}
              >
                Layer whole kit
              </button>
              {drums.length > 0 && drums.length < kit.tracks.length && (
                <button
                  className="btn small"
                  onClick={() => {
                    addKitTracks(kit, drums, adopt);
                    toast(`Added ${drums.length} percussion channels from ${kit.name}${tempoNote}`);
                  }}
                >
                  <Icon name="plus" size={11} /> Percussion only
                </button>
              )}
            </div>

            <div className="kit-tracks-head">
              <span>Channels — add one at a time</span>
              <label title="Off: channels join your track at its own tempo. On: the track takes the kit’s tempo and key.">
                <input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} /> use kit tempo & key
              </label>
            </div>
            <ul className="kit-tracks">
              {kit.tracks.map((t, i) => {
                return (
                  <li key={i}>
                    <span
                      className="kit-swatch"
                      style={{
                        background: TRACK_COLORS[i % TRACK_COLORS.length],
                      }}
                      aria-hidden
                    />
                    <span className="kit-track-name">
                      {t.name}
                      <small>
                        {voiceLabel(t.waveform as Waveform)}
                        {t.playMode === 'glide' ? ' · glide' : ''} · {t.steps ?? 16} steps
                      </small>
                    </span>
                    <button
                      className="btn small ghost"
                      onClick={() => {
                        addKitTracks(kit, [i], adopt);
                        toast(`Added ${t.name} from ${kit.name}${tempoNote}`);
                      }}
                    >
                      <Icon name="plus" size={11} /> Add
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
