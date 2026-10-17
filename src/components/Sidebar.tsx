import { PRESETS } from '../engine/presets';
import { WAVEFORMS, audibleTracks } from '../engine/project';
import { useSelectedTrack, useStore } from '../state/store';

export function Sidebar() {
  const { project, selectTrack, updateTrack, addTrack } = useStore();
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
              {WAVEFORMS[t.waveform]} · {t.steps} steps
            </div>
          </div>
          <div className="track-actions" onClick={(e) => e.stopPropagation()}>
            <button className={`ms ${t.muted ? 'on' : ''}`} title="Mute" onClick={() => updateTrack(t.id, { muted: !t.muted })}>
              M
            </button>
            <button className={`ms solo ${t.solo ? 'on' : ''}`} title="Solo" onClick={() => updateTrack(t.id, { solo: !t.solo })}>
              S
            </button>
          </div>
        </div>
      ))}
      {project.tracks.length === 0 && <p className="muted serif">An empty garden. Plant something below.</p>}

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
