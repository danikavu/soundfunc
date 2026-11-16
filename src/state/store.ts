import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GEdge, GNode, Graph, NodeData } from '../engine/graph';
import type { EditResult } from '../engine/graphEdit';
import { applyGrid, gridOf, type Grid } from '../engine/steps';
import type { SavedFunction } from './library';
import { defaultProject, KITS, pickColor, PRESETS, trackFromPreset, trackFromTemplate, uid, type Kit } from '../engine/presets';
import { mutateHarmony, mutateOneNode, mutateTrack } from '../engine/mutate';
import { blockFromSelection, insertBlock, type Block } from '../engine/graphEdit';
import { formulaNames, isDrum, normalizeProject, songGridLength, type Project, type Slider, type Song, type Track } from '../engine/project';
import { CONSTANTS, FUNCTIONS, renameVariable } from '../engine/expr';
import { ctxVars } from '../engine/graph';

const HISTORY_LIMIT = 80;

export interface NodeClip {
  block: Block;
  sliders: Slider[];
  /** the track it was copied from */
  from: string;
}

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
  /** plant a saved function: its track, with its own sliders */
  plantFunction: (fn: SavedFunction) => void;
  /** run a structural edit (explode, collapse, insert…) on a track's graph; returns an error message or null */
  applyGraphEdit: (trackId: string, edit: (g: Graph) => EditResult) => string | null;
  /** a node being listened to on its own (not saved) */
  audition: { trackId: string; nodeId: string } | null;
  setAudition: (a: { trackId: string; nodeId: string } | null) => void;
  /** add a slider to a track for `value`; returns its name */
  addSlider: (trackId: string, value: number, name?: string) => string;
  updateSlider: (trackId: string, name: string, patch: Partial<Slider>) => void;
  /** rename everywhere the track uses it; false if the name is taken or invalid */
  renameSlider: (trackId: string, from: string, to: string) => boolean;
  /** remove, writing its current value back into the track's formulas */
  removeSlider: (trackId: string, name: string) => void;
  /** the "paste a function" sheet */
  showImport: boolean;
  setShowImport: (open: boolean) => void;
  /** plant a multi-track kit (and its tempo/key); replaces the current tracks unless layering */
  /** a kit by id (built in), or the kit itself (a saved one) */
  addKit: (kit: string | Kit, layer?: boolean) => void;
  /**
   * plant channels read from a file (MIDI): never re-gridded — the song is fixed only when every
   * channel is the same allowed length, otherwise free, so each loops on its own as it was found
   */
  plantImported: (channels: (Partial<Track> & { name: string; graph: Graph })[], song: Partial<Song>, opts: { layer: boolean; adoptSong: boolean; name: string }) => void;
  /** add some of a kit's tracks (e.g. just its drums) to the current garden */
  addKitTracks: (kit: string | Kit, trackIndexes: number[], adoptSong?: boolean) => void;
  duplicateTrack: (id: string) => void;
  /** mute / solo every track at once (one undo step) */
  setAllTracks: (flag: 'muted' | 'solo' | 'locked', on: boolean) => void;
  /** change every melodic channel at once — glide, snap to scale… (drums have neither); one undo step */
  patchMelodic: (patch: Partial<Pick<Track, 'playMode' | 'quantize'>>) => void;
  /** copied nodes (with their wires and the sliders they read), ready to paste into any track */
  clipboard: NodeClip | null;
  /** copy nodes of a track; returns how many */
  copyNodes: (trackId: string, ids: string[]) => number;
  /** paste the clipboard into a track; returns how many nodes landed, or an error */
  pasteNodes: (trackId: string, at?: { x: number; y: number }) => number | string;
  /** mutate one node by the randomizer dial; false if nothing changed */
  mutateNode: (trackId: string, nodeId: string) => boolean;
  removeTrack: (id: string) => void;
  /** give every track the same step length (one undo step) */
  setStepBeatsAll: (stepBeats: number) => void;
  /** change a track's steps or step length — with a fixed song length, the track still fills it exactly */
  setGrid: (trackId: string, patch: Partial<Grid>) => void;
  /** the song's length (every track fills it) or 'free' (each track loops on its own) */
  setSongLength: (length: number | 'free') => void;
  /** remove every track at once (one undo step) */
  clearTracks: () => void;
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
  mutate: (scope: 'track' | 'garden') => { tracks: number; tried: number; locked: number };
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
}

/** Mutate's Safe ↔ Wild, where it starts (and where a double-click puts it back) */
export const DEFAULT_CHAOS = 0.3;

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
        chaos: DEFAULT_CHAOS,
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
          const made = trackFromPreset(preset, get().project.tracks.length);
          const track = fitToSong({ ...made, color: pickColor(colorsIn(get().project)) }, get().project.song);
          commit((p) => ({ ...p, tracks: [...p.tracks, track] }));
          set({ selectedTrackId: track.id });
        },
        plantImported: (channels, fileSong, { layer, adoptSong, name }) => {
          const start = layer ? get().project.tracks.length : 0;
          const tracks = withNewColors(
            channels.map((t, i) => trackFromTemplate(t, t.name, start + i)),
            layer ? colorsIn(get().project) : [],
          );
          const cur = get().project.song;
          // the song's Length is yours: an import never changes it — the channels fit into it
          const song: Song = { ...cur, ...withoutLength(adoptSong || !layer ? fileSong : {}), ...lengthOf(cur) };
          const fitted = tracks.map((t) => fitToSong(t, song));
          commit((p) => ({ ...p, name: layer ? p.name : name, song, tracks: layer ? [...p.tracks, ...fitted] : fitted }));
          if (!layer) set({ currentProjectId: null });
          set({ selectedTrackId: tracks[0]?.id ?? get().selectedTrackId });
        },
        addKit: (which, layer = false) => {
          const kit = typeof which === 'string' ? KITS.find((k) => k.id === which) : which;
          if (!kit) return;
          const start = layer ? get().project.tracks.length : 0;
          const tracks = withNewColors(
            kit.tracks.map((t, i) => trackFromTemplate(t, t.name, start + i)),
            layer ? colorsIn(get().project) : [],
          );
          const cur = get().project.song;
          // the song's Length is yours: a kit never changes it — its channels fit into it
          const song: Song = { ...cur, ...withoutLength(kit.song ?? {}), ...lengthOf(cur) };
          const fitted = tracks.map((t) => fitToSong(t, song));
          commit((p) => ({
            ...p,
            // a kit that replaces the garden starts a new one — unnamed, like any other
            name: layer ? p.name : 'Untitled',
            song,
            tracks: layer ? [...p.tracks, ...fitted] : fitted,
          }));
          if (!layer) set({ currentProjectId: null });
          set({ selectedTrackId: tracks[0]?.id ?? null });
        },
        plantTrack: (planted) => {
          const track = { ...planted, color: pickColor(colorsIn(get().project)) };
          commit((p) => ({ ...p, tracks: [...p.tracks, fitToSong(track, p.song)] }));
          set({ selectedTrackId: track.id });
        },
        applyGraphEdit: (trackId, edit) => {
          const t = get().project.tracks.find((x) => x.id === trackId);
          if (!t) return 'No channel';
          const r = edit(t.graph);
          if ('error' in r) return r.error;
          commit(mapTrack(trackId, (x) => ({ ...x, graph: r.graph })));
          // let the editor bring the new nodes into view
          window.dispatchEvent(new CustomEvent('sf-fit'));
          return null;
        },
        audition: null,
        setAudition: (audition) => set({ audition }),
        addSlider: (trackId, value, name) => {
          const t = get().project.tracks.find((x) => x.id === trackId);
          if (!t) return '';
          const taken = new Set(t.sliders.map((s) => s.name));
          let n = name;
          for (let i = 1; !n || !validSliderName(n) || taken.has(n); i++) n = `s${i}`;
          const span = Math.max(1, Math.abs(value) * 2);
          const slider: Slider = value >= 0 && value <= 1 ? { name: n, value, min: 0, max: 1, initial: value } : { name: n, value, min: Math.min(0, value - span), max: value + span, initial: value };
          commit(mapTrack(trackId, (x) => ({ ...x, sliders: [...x.sliders, slider] })));
          return n;
        },
        updateSlider: (trackId, name, patch) =>
          commit(mapTrack(trackId, (x) => ({ ...x, sliders: x.sliders.map((s) => (s.name === name ? { ...s, ...patch } : s)) })), false),
        renameSlider: (trackId, from, to) => {
          const t = get().project.tracks.find((x) => x.id === trackId);
          if (!t) return false;
          if (from === to) return true;
          if (!validSliderName(to) || t.sliders.some((s) => s.name === to)) return false;
          commit(mapTrack(trackId, (x) => rewriteFormulas({ ...x, sliders: x.sliders.map((s) => (s.name === from ? { ...s, name: to } : s)) }, (f) => renameVariable(f, from, to))));
          return true;
        },
        removeSlider: (trackId, name) => {
          const s = get().project.tracks.find((x) => x.id === trackId)?.sliders.find((x) => x.name === name);
          if (!s) return;
          const literal = s.value < 0 ? `(${s.value})` : String(s.value);
          commit(mapTrack(trackId, (x) => rewriteFormulas({ ...x, sliders: x.sliders.filter((y) => y.name !== name) }, (f) => renameVariable(f, name, literal))));
        },
        plantFunction: (fn) => {
          const { project } = get();
          const track = fitToSong({ ...trackFromTemplate(structuredClone(fn.track), fn.name, project.tracks.length), color: pickColor(colorsIn(project)) }, project.song);
          commit((p) => ({ ...p, tracks: [...p.tracks, track] }));
          set({ selectedTrackId: track.id });
        },
        showImport: false,
        setShowImport: (showImport) => set({ showImport }),
        addKitTracks: (which, trackIndexes, adoptSong = false) => {
          const kit = typeof which === 'string' ? KITS.find((k) => k.id === which) : which;
          if (!kit || !trackIndexes.length) return;
          const start = get().project.tracks.length;
          const tracks = withNewColors(
            trackIndexes.map((i, j) => trackFromTemplate(kit.tracks[i], kit.tracks[i].name, start + j)),
            colorsIn(get().project),
          );
          commit((p) => {
            const song = adoptSong ? { ...p.song, ...withoutLength(kit.song ?? {}), ...lengthOf(p.song) } : p.song;
            return { ...p, song, tracks: [...p.tracks, ...tracks.map((t) => fitToSong(t, song))] };
          });
          set({ selectedTrackId: tracks[0].id });
        },
        patchMelodic: (patch) => commit((p) => ({ ...p, tracks: p.tracks.map((t) => (isDrum(t.waveform) ? t : { ...t, ...patch })) })),
        setAllTracks: (flag, on) => commit((p) => ({ ...p, tracks: p.tracks.map((t) => ({ ...t, [flag]: on })) })),
        clipboard: null,
        copyNodes: (trackId, ids) => {
          const t = get().project.tracks.find((x) => x.id === trackId);
          if (!t) return 0;
          const block = blockFromSelection(t.graph, ids, 'clipboard');
          if ('error' in block) return 0;
          const used = formulaNames({ nodes: block.nodes, edges: [] });
          set({ clipboard: { block, sliders: t.sliders.filter((sl) => used.has(sl.name)).map((sl) => ({ ...sl })), from: trackId } });
          return block.nodes.length;
        },
        pasteNodes: (trackId, at) => {
          const clip = get().clipboard;
          const t = get().project.tracks.find((x) => x.id === trackId);
          if (!clip) return 'Nothing copied yet — select nodes and press ⌘C';
          if (!t) return 'No channel';
          // wires into Note Out only where this track's Note Out is still free
          const out = t.graph.nodes.find((n) => n.type === 'output');
          const busy = new Set(t.graph.edges.filter((e) => e.target === out?.id).map((e) => String(e.targetHandle)));
          const block = { ...clip.block, toOutput: (clip.block.toOutput ?? []).filter((w) => !busy.has(w.port)) };
          // paste beside what's there: to the right of the source when it is the same track
          const minX = Math.min(...block.nodes.map((n) => n.position.x)), minY = Math.min(...block.nodes.map((n) => n.position.y));
          const r = insertBlock(t.graph, block, at ?? (clip.from === trackId ? { x: minX + 40, y: minY + 40 } : { x: minX, y: minY }));
          const missing = clip.sliders.filter((sl) => !t.sliders.some((x) => x.name === sl.name));
          commit(mapTrack(trackId, (x) => ({ ...x, graph: r.graph, sliders: [...x.sliders, ...missing] })));
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sf-fit'));
          return r.ids.length;
        },
        mutateNode: (trackId, nodeId) => {
          const { project, chaos } = get();
          const t = project.tracks.find((x) => x.id === trackId);
          if (!t || t.locked) return false;
          const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
          const r = mutateOneNode(t, project.song, nodeId, chaos, seed);
          if (r.track === t) return false;
          commit(mapTrack(trackId, () => r.track));
          return true;
        },
        duplicateTrack: (id) => {
          const src = get().project.tracks.find((t) => t.id === id);
          if (!src) return;
          const copy: Track = { ...structuredClone(src), id: uid('track'), name: copyName(src.name, get().project.tracks.map((t) => t.name)), color: pickColor(colorsIn(get().project)), solo: false };
          commit((p) => {
            const i = p.tracks.findIndex((t) => t.id === id);
            const tracks = [...p.tracks];
            tracks.splice(i + 1, 0, copy);
            return { ...p, tracks };
          });
          set({ selectedTrackId: copy.id });
        },
        setStepBeatsAll: (stepBeats) =>
          commit((p) => ({ ...p, tracks: p.tracks.map((t) => ({ ...t, ...applyGrid(gridOf(t), { stepBeats }, songGridLength(p.song)) })) })),
        setGrid: (trackId, patch) => commit((p) => mapTrack(trackId, (t) => ({ ...t, ...applyGrid(gridOf(t), patch, songGridLength(p.song)) }))(p)),
        setSongLength: (length) =>
          commit((p) => {
            // free: every track keeps the loop it has; fixed: every track fills the new length
            if (length === 'free') return { ...p, song: { ...p.song, lengthMode: 'free' } };
            const song: Song = { ...p.song, lengthMode: 'fixed', lengthBeats: length };
            return { ...p, song, tracks: p.tracks.map((t) => fitToSong(t, song)) };
          }),
        clearTracks: () => {
          commit((p) => ({ ...p, tracks: [] }));
          set({ selectedTrackId: null, audition: null });
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
          let tried = 0, changed = 0, locked = 0;
          const tracks = project.tracks.map((t, i) => {
            if (scope === 'track' && t.id !== targetId) return t;
            if (t.locked) {
              locked++;
              return t;
            }
            const r = mutateTrack(t, song, chaos, seed + i * 7919);
            tried += r.tried;
            if (r.track !== t) changed++;
            return r.track;
          });
          commit((p) => ({ ...p, song, tracks }));
          return { tracks: changed, tried, locked };
        },
        toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
        /** snapshot before a continuous edit (typing, dragging) so it undoes as one step */
        // nothing changed since the last checkpoint (a double-click's second press…): one undo step is enough
        checkpoint: () => set((s) => (s.past[s.past.length - 1] === s.project ? { future: [] } : { past: [...s.past, s.project].slice(-HISTORY_LIMIT), future: [] })),
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

/** the song's Length — set only by the user, never by an import */
const lengthOf = (s: Song) => ({ lengthMode: s.lengthMode, lengthBeats: s.lengthBeats });
function withoutLength(s: Partial<Song>): Partial<Song> {
  const { lengthMode: _m, lengthBeats: _b, ...rest } = s;
  void _m;
  void _b;
  return rest;
}

/** with a fixed song length, a track is re-gridded to fill it exactly; a free song leaves it as it is */
/** a track re-gridded to the song's Length, as planting it does */
export function fitToSong(t: Track, song: Song): Track {
  const L = songGridLength(song);
  return L === null ? t : { ...t, ...applyGrid(gridOf(t), {}, L) };
}

const RESERVED = new Set<string>([...ctxVars, 'a', 'b', 'c', 'p', ...Object.keys(CONSTANTS), ...Object.keys(FUNCTIONS)]);
export const validSliderName = (n: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !RESERVED.has(n);

/** apply a rewrite to every formula in the project: Formula nodes and the harmony */
/** rewrite one track's formulas */
function rewriteFormulas(t: Track, fn: (src: string) => string): Track {
  return {
    ...t,
    graph: { ...t.graph, nodes: t.graph.nodes.map((n) => (n.type === 'expr' ? { ...n, data: { ...n.data, formula: fn(String(n.data.formula ?? '')) } } : n)) },
  };
}

export function useSelectedTrack(): Track | null {
  return useStore((s) => s.project.tracks.find((t) => t.id === s.selectedTrackId) ?? s.project.tracks[0] ?? null);
}

/** "Bass" → "Bass copy", then "Bass copy 2"… */
function copyName(name: string, taken: string[]): string {
  const base = `${name.replace(/ copy( \d+)?$/, '')} copy`;
  let n = base;
  for (let i = 2; taken.includes(n); i++) n = `${base} ${i}`;
  return n;
}

const colorsIn = (p: Project) => p.tracks.map((t) => t.color);

/** give each new channel its own random colour, unused by the others */
function withNewColors(tracks: Track[], taken: string[]): Track[] {
  const used = [...taken];
  return tracks.map((t) => {
    const color = pickColor(used);
    used.push(color);
    return { ...t, color };
  });
}
