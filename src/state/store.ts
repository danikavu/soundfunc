import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GEdge, GNode, NodeData } from '../engine/graph';
import { defaultProject, PRESETS, trackFromPreset, uid } from '../engine/presets';
import type { Project, Song, Track } from '../engine/project';

const HISTORY_LIMIT = 80;

interface State {
  project: Project;
  selectedTrackId: string | null;
  theme: 'light' | 'dark';
  playing: boolean;
  past: Project[];
  future: Project[];

  setProjectName: (name: string) => void;
  setSong: (patch: Partial<Song>) => void;
  updateTrack: (id: string, patch: Partial<Track>, record?: boolean) => void;
  selectTrack: (id: string) => void;
  addTrack: (presetId: string) => void;
  duplicateTrack: (id: string) => void;
  removeTrack: (id: string) => void;
  setGraph: (trackId: string, nodes: GNode[], edges: GEdge[], record?: boolean) => void;
  updateNodeData: (trackId: string, nodeId: string, patch: NodeData) => void;
  loadProject: (p: Project) => void;
  resetProject: () => void;
  toggleTheme: () => void;
  setPlaying: (on: boolean) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** apply a project change, optionally recording an undo step */
      const commit = (fn: (p: Project) => Project, record = true) =>
        set((s) => ({
          project: fn(s.project),
          ...(record ? { past: [...s.past, s.project].slice(-HISTORY_LIMIT), future: [] } : {}),
        }));
      const mapTrack = (id: string, fn: (t: Track) => Track) => (p: Project) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === id ? fn(t) : t)),
      });

      return {
        project: defaultProject(),
        selectedTrackId: null,
        theme: 'light',
        playing: false,
        past: [],
        future: [],

        setProjectName: (name) => commit((p) => ({ ...p, name }), false),
        setSong: (patch) => commit((p) => ({ ...p, song: { ...p.song, ...patch } })),
        updateTrack: (id, patch, record = true) => commit(mapTrack(id, (t) => ({ ...t, ...patch })), record),
        selectTrack: (id) => set({ selectedTrackId: id }),
        addTrack: (presetId) => {
          const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
          const track = trackFromPreset(preset, get().project.tracks.length);
          commit((p) => ({ ...p, tracks: [...p.tracks, track] }));
          set({ selectedTrackId: track.id });
        },
        duplicateTrack: (id) => {
          const src = get().project.tracks.find((t) => t.id === id);
          if (!src) return;
          const copy: Track = { ...structuredClone(src), id: uid('track'), name: `${src.name} ²`, solo: false };
          commit((p) => {
            const i = p.tracks.findIndex((t) => t.id === id);
            const tracks = [...p.tracks];
            tracks.splice(i + 1, 0, copy);
            return { ...p, tracks };
          });
          set({ selectedTrackId: copy.id });
        },
        removeTrack: (id) => {
          commit((p) => ({ ...p, tracks: p.tracks.filter((t) => t.id !== id) }));
          if (get().selectedTrackId === id) set({ selectedTrackId: get().project.tracks[0]?.id ?? null });
        },
        setGraph: (trackId, nodes, edges, record = false) =>
          commit(mapTrack(trackId, (t) => ({ ...t, graph: { nodes, edges } })), record),
        updateNodeData: (trackId, nodeId, patch) =>
          commit(
            mapTrack(trackId, (t) => ({
              ...t,
              graph: {
                ...t.graph,
                nodes: t.graph.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)),
              },
            })),
            false,
          ),
        loadProject: (project) => {
          commit(() => project);
          set({ selectedTrackId: project.tracks[0]?.id ?? null });
        },
        resetProject: () => get().loadProject(defaultProject()),
        setPlaying: (playing) => set({ playing }),
        toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
        /** snapshot before a continuous edit (typing, dragging) so it undoes as one step */
        checkpoint: () => set((s) => ({ past: [...s.past, s.project].slice(-HISTORY_LIMIT), future: [] })),
        undo: () =>
          set((s) => {
            const prev = s.past[s.past.length - 1];
            if (!prev) return s;
            return { project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future] };
          }),
        redo: () =>
          set((s) => {
            const next = s.future[0];
            if (!next) return s;
            return { project: next, future: s.future.slice(1), past: [...s.past, s.project] };
          }),
      };
    },
    {
      name: 'soundfunc',
      version: 1,
      partialize: (s) => ({ project: s.project, selectedTrackId: s.selectedTrackId, theme: s.theme }),
    },
  ),
);

export function useSelectedTrack(): Track | null {
  return useStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId) ?? s.project.tracks[0] ?? null);
}
