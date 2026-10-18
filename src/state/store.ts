import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GEdge, GNode, NodeData } from '../engine/graph';
import { defaultProject, KITS, PRESETS, trackFromPreset, trackFromTemplate, uid } from '../engine/presets';
import { mutateHarmony, mutateTrack } from '../engine/mutate';
import { normalizeProject, type Project, type Song, type Track } from '../engine/project';

const HISTORY_LIMIT = 80;

interface State {
  project: Project;
  selectedTrackId: string | null;
  /** the saved garden this project came from (null = never saved) */
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  theme: 'light' | 'dark';
  playing: boolean;
  /** the "function in full" sheet */
  showFunction: boolean;
  setShowFunction: (open: boolean) => void;
  /** randomizer dial: 0 harmonious → 1 experimental */
  chaos: number;
  past: Project[];
  future: Project[];

  setProjectName: (name: string) => void;
  setSong: (patch: Partial<Song>, record?: boolean) => void;
  updateTrack: (id: string, patch: Partial<Track>, record?: boolean) => void;
  selectTrack: (id: string) => void;
  addTrack: (presetId: string) => void;
  /** plant a multi-track kit (and its tempo/key); replaces the current tracks unless layering */
  addKit: (kitId: string, layer?: boolean) => void;
  duplicateTrack: (id: string) => void;
  removeTrack: (id: string) => void;
  setGraph: (trackId: string, nodes: GNode[], edges: GEdge[], record?: boolean) => void;
  updateNodeData: (trackId: string, nodeId: string, patch: NodeData) => void;
  /** lock / unlock nodes against the randomizer (one undo step) */
  setLocked: (trackId: string, nodeIds: string[] | 'all', locked: boolean) => void;
  loadProject: (p: Project, savedId?: string | null) => void;
  resetProject: () => void;
  toggleTheme: () => void;
  setPlaying: (on: boolean) => void;
  setChaos: (chaos: number) => void;
  /** mutate the selected track, or every track plus the harmony; one undo step */
  mutate: (scope: 'track' | 'garden') => { tracks: number; tried: number };
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
        currentProjectId: null,
        setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),
        theme: 'light',
        playing: false,
        chaos: 0.3,
        showFunction: false,
        setShowFunction: (showFunction) => set({ showFunction }),
        past: [],
        future: [],

        setProjectName: (name) => commit((p) => ({ ...p, name }), false),
        setSong: (patch, record = true) => commit((p) => ({ ...p, song: { ...p.song, ...patch } }), record),
        updateTrack: (id, patch, record = true) => commit(mapTrack(id, (t) => ({ ...t, ...patch })), record),
        selectTrack: (id) => set({ selectedTrackId: id }),
        addTrack: (presetId) => {
          const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
          const track = trackFromPreset(preset, get().project.tracks.length);
          commit((p) => ({ ...p, tracks: [...p.tracks, track] }));
          set({ selectedTrackId: track.id });
        },
        addKit: (kitId, layer = false) => {
          const kit = KITS.find((k) => k.id === kitId);
          if (!kit) return;
          const start = layer ? get().project.tracks.length : 0;
          const tracks = kit.tracks.map((t, i) => trackFromTemplate(t, t.name, start + i));
          commit((p) => ({
            ...p,
            name: layer ? p.name : kit.name,
            song: { ...p.song, ...kit.song },
            tracks: layer ? [...p.tracks, ...tracks] : tracks,
          }));
          if (!layer) set({ currentProjectId: null });
          set({ selectedTrackId: tracks[0]?.id ?? null });
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
        setLocked: (trackId, nodeIds, locked) =>
          commit(
            mapTrack(trackId, (t) => ({
              ...t,
              graph: {
                ...t.graph,
                nodes: t.graph.nodes.map((n) => (nodeIds === 'all' || nodeIds.includes(n.id) ? { ...n, data: { ...n.data, locked } } : n)),
              },
            })),
          ),
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
        loadProject: (raw, savedId = null) => {
          const project = normalizeProject(raw);
          commit(() => project);
          set({ currentProjectId: savedId });
          set({ selectedTrackId: project.tracks[0]?.id ?? null });
        },
        resetProject: () => get().loadProject(defaultProject()),
        setPlaying: (playing) => set({ playing }),
        setChaos: (chaos) => set({ chaos }),
        mutate: (scope) => {
          const { project, chaos, selectedTrackId } = get();
          const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
          const targetId = selectedTrackId ?? project.tracks[0]?.id;
          let song = project.song;
          if (scope === 'garden' && chaos > 0.15 && !song.harmonyLocked) song = { ...song, harmony: mutateHarmony(song.harmony, chaos, seed) };
          let tried = 0, changed = 0;
          const tracks = project.tracks.map((t, i) => {
            if (scope === 'track' && t.id !== targetId) return t;
            const r = mutateTrack(t, song, chaos, seed + i * 7919);
            tried += r.tried;
            if (r.track !== t) changed++;
            return r.track;
          });
          commit((p) => ({ ...p, song, tracks }));
          return { tracks: changed, tried };
        },
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
      version: 2,
      // projects saved by older versions just get the new track fields filled in
      migrate: (state) => {
        const s = state as { project?: Project };
        if (s.project) s.project = normalizeProject(s.project);
        return s as State;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        return { ...current, ...p, project: p?.project ? normalizeProject(p.project) : current.project };
      },
      partialize: (s) => ({ project: s.project, selectedTrackId: s.selectedTrackId, theme: s.theme, chaos: s.chaos, currentProjectId: s.currentProjectId }),
    },
  ),
);

export function useSelectedTrack(): Track | null {
  return useStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId) ?? s.project.tracks[0] ?? null);
}
