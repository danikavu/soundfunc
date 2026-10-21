import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NOTE_NAMES, SCALES } from '../engine/music';
import { KITS, TRACK_COLORS } from '../engine/presets';
import { isDrum, voiceLabel, type Waveform } from '../engine/project';
import { useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon } from './ui';

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
  const kit = KITS.find((k) => k.id === kitId)!;
  const drums = kit.tracks.map((t, i) => (isDrum(t.waveform as Waveform) ? i : -1)).filter((i) => i >= 0);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = pop.current?.offsetHeight ?? 420;
    setPos({ left: r.right + 10, top: Math.max(12, Math.min(r.top - 40, window.innerHeight - h - 12)) });
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
            {KITS.map((k) => (
              <li key={k.id}>
                <button className={k.id === kitId ? 'on' : ''} onMouseEnter={() => setKitId(k.id)} onFocus={() => setKitId(k.id)} onClick={() => setKitId(k.id)}>
                  <span className="serif">{k.name}</span>
                  <small>
                    {k.song?.bpm ? `${k.song.bpm} bpm · ` : ''}
                    {k.tracks.length} tracks
                  </small>
                </button>
              </li>
            ))}
          </ul>

          <div className="kit-detail">
            <h3 className="serif">{kit.name}</h3>
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
                  addKit(kit.id, false);
                  setOpen(false);
                  toast(`Planted ${kit.name} — ⌘Z to bring your garden back`);
                }}
              >
                Replace garden
              </button>
              <button
                className="btn small"
                onClick={() => {
                  addKitTracks(kit.id, kit.tracks.map((_, i) => i), adopt);
                  toast(`Layered all of ${kit.name}${tempoNote}`);
                }}
              >
                Layer whole kit
              </button>
              {drums.length > 0 && drums.length < kit.tracks.length && (
                <button
                  className="btn small"
                  onClick={() => {
                    addKitTracks(kit.id, drums, adopt);
                    toast(`Added ${drums.length} percussion tracks from ${kit.name}${tempoNote}`);
                  }}
                >
                  <Icon name="plus" size={11} /> Percussion only
                </button>
              )}
            </div>

            <div className="kit-tracks-head">
              <span>Tracks — add one at a time</span>
              <label title="Off: tracks join your garden at its own tempo. On: the garden takes the kit’s tempo and key.">
                <input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.target.checked)} /> use kit tempo & key
              </label>
            </div>
            <ul className="kit-tracks">
              {kit.tracks.map((t, i) => {
                const drum = isDrum(t.waveform as Waveform);
                return (
                  <li key={t.name}>
                    <span className={`stone ${drum ? 'drum' : ''}`} style={{ background: TRACK_COLORS[i % TRACK_COLORS.length] }} />
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
                        addKitTracks(kit.id, [i], adopt);
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
