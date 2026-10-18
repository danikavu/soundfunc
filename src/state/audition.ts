import { NODE_DEFS } from '../engine/graph';
import { auditionGraph } from '../engine/graphEdit';
import { isDrum, renderTrack, scaleLength, type Project } from '../engine/project';

/**
 * The project as the engine should play it while one node is being listened to:
 * that node drives the track's pitch (or velocity, for rhythm nodes) and the
 * track plays solo. Nothing here is saved.
 */
export function withAudition(project: Project, a: { trackId: string; nodeId: string } | null): Project {
  if (!a) return project;
  const track = project.tracks.find((t) => t.id === a.trackId);
  const node = track?.graph.nodes.find((n) => n.id === a.nodeId);
  if (!track || !node) return project;
  const asVelocity = NODE_DEFS[node.type]?.category === 'rhythm';
  const trace = renderTrack(track, project.song, 0, true).traces.get(node.id) ?? [0];
  const lo = Math.min(...trace), hi = Math.max(...trace);
  const span = isDrum(track.waveform) ? 12 : track.pitchMode === 'degree' ? scaleLength(project.song) : 12;
  const graph = auditionGraph(track.graph, node.id, { asVelocity, lo, hi, span });
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === track.id ? { ...t, graph, solo: true, muted: false } : { ...t, solo: false })),
  };
}
