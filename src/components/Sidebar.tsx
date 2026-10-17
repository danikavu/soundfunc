import { KITS, PRESETS } from '../engine/presets';
import { audibleTracks, voiceLabel } from '../engine/project';
import { useSelectedTrack, useStore } from '../state/store';
import { Icon } from './ui';
import { toast } from './TopBar';

export function Sidebar() {
  const { project, selectTrack, updateTrack, addTrack, addKit, removeTrack } = useStore();
  const selected = useSelectedTrack();
  const audible = new Set(audibleTracks(project.tracks).map((t) => t.id));

  return (
    <aside className="panel">
      <div className="eyebrow">Tracks</div>
      {project.tracks.map((t) => (
        <div
          key={t.id}
          className={`track ${selected?.id === t.id ? 'selected' : ''} ${audible.has(t.id) ? '' : 'dim'}`}
          onClick={() => selectTrack(t.id)}
        >
          <span className="stone" style={{ background: t.color }} />
          <div style={{ minWidth: 0 }}>
            <div className="track-name">{t.name}</div>
            <div className="track-meta">
              {voiceLabel(t.waveform)}{t.playMode === 'glide' ? ' · glide' : ''} · {t.steps} steps
            </div>
          </div>
          <div className="track-actions" onClick={(e) => e.stopPropagation()}>
            <button className={`ms ${t.muted ? 'on' : ''}`} title="Mute" onClick={() => updateTrack(t.id, { muted: !t.muted })}>
              M
            </button>
            <button className={`ms solo ${t.solo ? 'on' : ''}`} title="Solo" onClick={() => updateTrack(t.id, { solo: !t.solo })}>
              S
            </button>
            <button className="ms remove" title="Remove track (⌘Z to undo)" aria-label={`Remove ${t.name}`} onClick={() => removeTrack(t.id)}>
              <Icon name="close" size={11} />
            </button>
          </div>
        </div>
      ))}
      {project.tracks.length === 0 && <p className="muted serif">An empty garden. Plant something below.</p>}

      <div className="eyebrow">Rhythm kits</div>
      {KITS.map((k) => (
        <button
          key={k.id}
          className="preset"
          onClick={(e) => {
            addKit(k.id, e.shiftKey);
            toast(e.shiftKey ? `Layered ${k.name}` : `Planted ${k.name} — ⌘Z to bring your garden back`);
          }}
          title={`${k.description}\n\nClick to replace the garden · ⇧-click to layer on top`}
        >
          <b>{k.name}</b>
          <code>
            {k.song?.bpm ? `${k.song.bpm} bpm · ` : ''}
            {k.tracks.length} tracks
          </code>
        </button>
      ))}

      <div className="eyebrow">Plant a function</div>
      {PRESETS.map((p) => (
        <button key={p.id} className="preset" onClick={() => addTrack(p.id)} title={p.description}>
          <b>{p.name}</b>
          <code>{p.formula}</code>
        </button>
      ))}
    </aside>
  );
}
