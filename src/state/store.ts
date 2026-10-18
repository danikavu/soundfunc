import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GEdge, GNode, Graph, NodeData } from '../engine/graph';
import type { EditResult } from '../engine/graphEdit';
import { defaultProject, KITS, PRESETS, trackFromPreset, trackFromTemplate, uid } from '../engine/presets';
import { mutateHarmony, mutateTrack } from '../engine/mutate';
import { normalizeProject, type Project, type Slider, type Song, type Track } from '../engine/project';
import { CONSTANTS, FUNCTIONS, renameVariable } from '../engine/expr';
import { ctxVars } from '../engine/graph';

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
  /** add a ready-made track (e.g. an imported function) and select it */
  plantTrack: (track: Track) => void;
  /** run a structural edit (explode, collapse, insert…) on a track's graph; returns an error message or null */
  applyGraphEdit: (trackId: string, edit: (g: Graph) => EditResult) => string | null;
  /** a node being listened to on its own (not saved) */
  audition: { trackId: string; nodeId: string } | null;
  setAudition: (a: { trackId: string; nodeId: string } | null) => void;
  /** add a slider for `value`; returns its name */
  addSlider: (value: number, name?: string) => string;
  updateSlider: (name: string, patch: Partial<Slider>) => void;
  /** rename everywhere it is used; false if the name is taken or invalid */
  renameSlider: (from: string, to: string) => boolean;
  /** remove, writing its current value back into every formula */
  removeSlider: (name: string) => void;
  /** the "paste a function" sheet */
  showImport: boolean;
  setShowImport: (open: boolean) => void;
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
        plantTrack: (track) => {
          commit((p) => ({ ...p, tracks: [...p.tracks, track] }));
          set({ selectedTrackId: track.id });
        },
        applyGraphEdit: (trackId, edit) => {
          const t = get().project.tracks.find((x) => x.id === trackId);
          if (!t) return 'No track';
          const r = edit(t.graph);
          if ('error' in r) return r.error;
          commit(mapTrack(trackId, (x) => ({ ...x, graph: r.graph })));
          // let the editor bring the new nodes into view
          window.dispatchEvent(new CustomEvent('sf-fit'));
          return null;
        },
        audition: null,
        setAudition: (audition) => set({ audition }),
        addSlider: (value, name) => {
          const taken = new Set(get().project.song.sliders.map((s) => s.name));
          let n = name;
          for (let i = 1; !n || !validSliderName(n) || taken.has(n); i++) n = `s${i}`;
          const span = Math.max(1, Math.abs(value) * 2);
          const slider: Slider = value >= 0 && value <= 1 ? { name: n, value, min: 0, max: 1 } : { name: n, value, min: Math.min(0, value - span), max: value + span };
          commit((p) => ({ ...p, song: { ...p.song, sliders: [...p.song.sliders, slider] } }));
          return n;
        },
        updateSlider: (name, patch) =>
          commit((p) => ({ ...p, song: { ...p.song, sliders: p.song.sliders.map((s) => (s.name === name ? { ...s, ...patch } : s)) } }), false),
        renameSlider: (from, to) => {
          const p0 = get().project;
          if (from === to) return true;
          if (!validSliderName(to) || p0.song.sliders.some((s) => s.name === to)) return false;
          commit((p) => rewriteFormulas({ ...p, song: { ...p.song, sliders: p.song.sliders.map((s) => (s.name === from ? { ...s, name: to } : s)) } }, (f) => renameVariable(f, from, to)));
          return true;
        },
        removeSlider: (name) => {
          const s = get().project.song.sliders.find((x) => x.name === name);
          if (!s) return;
          const literal = s.value < 0 ? `(${s.value})` : String(s.value);
          commit((p) => rewriteFormulas({ ...p, song: { ...p.song, sliders: p.song.sliders.filter((x) => x.name !== name) } }, (f) => renameVariable(f, name, literal)));
        },
        showImport: false,
        setShowImport: (showImport) => set({ showImport }),
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

const RESERVED = new Set<string>([...ctxVars, 'a', 'b', 'c', 'p', ...Object.keys(CONSTANTS), ...Object.keys(FUNCTIONS)]);
export const validSliderName = (n: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !RESERVED.has(n);

/** apply a rewrite to every formula in the project: Formula nodes and the harmony */
function rewriteFormulas(p: Project, fn: (src: string) => string): Project {
  return {
    ...p,
    song: { ...p.song, harmony: fn(p.song.harmony) },
    tracks: p.tracks.map((t) => ({
      ...t,
      graph: { ...t.graph, nodes: t.graph.nodes.map((n) => (n.type === 'expr' ? { ...n, data: { ...n.data, formula: fn(String(n.data.formula ?? '')) } } : n)) },
    })),
  };
}

export function useSelectedTrack(): Track | null {
  return useStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId) ?? s.project.tracks[0] ?? null);
}
