import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid, type Kit } from '../engine/presets';
import { NOTE_NAMES, SCALES } from '../engine/music';
import type { Block } from '../engine/graphEdit';
import { DRUMS, normalizeProject, TRACK_DEFAULTS, WAVEFORMS, type Project, type Slider, type Song, type Track, type Waveform } from '../engine/project';

/** The sound of a track, without its notes: reusable across tracks and projects. */
export interface Voice {
  id: string;
  name: string;
  waveform: Waveform;
  timbre: string;
  attack: number;
  release: number;
  /** the channel's changes to the voice's patch (filter, unison, sauce…) */
  synth?: Track['synth'];
  savedAt: number;
}

/**
 * A whole track saved as a reusable function: every node with its values and wires,
 * its sound and grid, and its own sliders.
 */
export interface SavedFunction {
  id: string;
  name: string;
  description: string;
  savedAt: number;
  track: Omit<Track, 'id' | 'name' | 'color' | 'muted' | 'solo'>;
  /** files from before tracks owned their sliders kept them here */
  sliders?: Slider[];
}

/** the file format for sharing functions */
export interface FunctionFile {
  kind: 'soundfunc-functions';
  version: 1;
  functions: SavedFunction[];
}

export function functionOf(track: Track, name: string): SavedFunction {
  const { id: _id, name: _name, color: _color, muted: _m, solo: _s, ...rest } = track;
  const graph = {
    nodes: track.graph.nodes.map(({ id, type, position, data }) => ({ id, type, position: { x: Math.round(position.x), y: Math.round(position.y) }, data: structuredClone(data) })),
    edges: track.graph.edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
  };
  const sliders = track.sliders.map((sl) => ({ ...sl }));
  const kinds = new Set(graph.nodes.map((n) => n.type));
  return {
    id: uid('fn'),
    name,
    description: `${graph.nodes.length} nodes · ${[...kinds].filter((k) => k !== 'output' && k !== 'step').slice(0, 3).join(', ') || 'formula'}${sliders.length ? ` · ${sliders.length} slider${sliders.length > 1 ? 's' : ''}` : ''}`,
    savedAt: Date.now(),
    track: { ...rest, graph, sliders },
  };
}

/** read a functions file; throws a plain-language error for anything else */
export function readFunctionFile(text: string): SavedFunction[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t JSON');
  }
  const f = data as Partial<FunctionFile>;
  if (f.kind !== 'soundfunc-functions' || !Array.isArray(f.functions)) throw new Error('That file isn’t a SoundFunc functions file');
  return f.functions
    .filter((x) => x && typeof x.name === 'string' && x.track && Array.isArray(x.track.graph?.nodes))
    .map(({ sliders, ...x }) => ({ ...x, track: { ...TRACK_DEFAULTS, ...x.track, sliders: x.track.sliders ?? (Array.isArray(sliders) ? sliders : []) } }));
}

export const functionFile = (functions: SavedFunction[]): FunctionFile => ({ kind: 'soundfunc-functions', version: 1, functions });

/**
 * A rhythm kit you saved: every channel of a track (nodes, sliders, sound, grid) and the
 * song settings that make it groove: tempo, key, scale, harmony, length.
 */
export interface SavedKit {
  id: string;
  name: string;
  description: string;
  savedAt: number;
  song: Partial<Song>;
  tracks: Kit['tracks'];
}

/** the file format for sharing kits */
export interface KitFile {
  kind: 'soundfunc-kits';
  version: 1;
  kits: SavedKit[];
}

export function kitOf(project: Project, name: string): SavedKit {
  const { song } = project;
  const tracks = project.tracks.map((t) => {
    const { id: _id, color: _color, muted: _m, solo: _s, ...rest } = t;
    return {
      ...rest,
      graph: {
        nodes: t.graph.nodes.map(({ id, type, position, data }) => ({ id, type, position: { x: Math.round(position.x), y: Math.round(position.y) }, data: structuredClone(data) })),
        edges: t.graph.edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
      },
      sliders: t.sliders.map((sl) => ({ ...sl })),
    };
  });
  const scale = (SCALES[song.scale] ?? SCALES.major).label;
  return {
    id: uid('kit'),
    name,
    description: `${tracks.length} channel${tracks.length === 1 ? '' : 's'} · ${song.bpm} bpm · ${NOTE_NAMES[song.root]} ${scale}: ${tracks.map((t) => t.name).join(', ')}`,
    savedAt: Date.now(),
    song: { bpm: song.bpm, root: song.root, scale: song.scale, harmony: song.harmony, lengthMode: song.lengthMode, lengthBeats: song.lengthBeats, repeat: song.repeat, pitchRange: { ...song.pitchRange } },
    tracks,
  };
}

/** a saved kit as the kit picker plants it */
export const asKit = (k: SavedKit): Kit => ({ id: `mine:${k.id}`, name: k.name, description: k.description, group: 'mine', song: k.song, tracks: k.tracks });

/** read a kits file; throws a plain-language error for anything else */
export function readKitFile(text: string): SavedKit[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t JSON');
  }
  const f = data as Partial<KitFile>;
  if (f.kind !== 'soundfunc-kits' || !Array.isArray(f.kits)) throw new Error('That file isn’t a SoundFunc kits file');
  return f.kits
    .filter((k) => k && typeof k.name === 'string' && Array.isArray(k.tracks) && k.tracks.every((t) => t && Array.isArray(t.graph?.nodes)))
    .map((k) => ({ ...k, id: k.id || uid('kit'), description: k.description ?? '', savedAt: k.savedAt ?? Date.now(), song: k.song ?? {}, tracks: k.tracks.map((t) => ({ ...TRACK_DEFAULTS, ...t, sliders: t.sliders ?? [] })) }));
}

export const kitFile = (kits: SavedKit[]): KitFile => ({ kind: 'soundfunc-kits', version: 1, kits });

export interface SavedProject {
  id: string;
  name: string;
  savedAt: number;
  project: Project;
}

/**
 * The project without editor-only state (which node is selected, measured sizes…),
 * so saving stays small and selecting a node doesn't count as an unsaved change.
 */
export function cleanProject(p: Project): Project {
  return {
    ...p,
    tracks: p.tracks.map((t) => ({
      ...t,
      solo: false,
      graph: {
        nodes: t.graph.nodes.map(({ id, type, position, data }) => ({ id, type, position: { x: Math.round(position.x), y: Math.round(position.y) }, data })),
        edges: t.graph.edges.map(({ id, source, sourceHandle, target, targetHandle }) => ({ id, source, sourceHandle, target, targetHandle })),
      },
    })),
  };
}

/** Comparable fingerprint of a project's content. */
export const projectKey = (p: Project) => JSON.stringify(cleanProject(p));

export function voiceOf(track: Track, name: string): Voice {
  return { id: uid('voice'), name, waveform: track.waveform, timbre: track.timbre, attack: track.attack, release: track.release, synth: track.synth ? { ...track.synth } : undefined, savedAt: Date.now() };
}

/** Does this track currently sound like this voice? */
export const wearsVoice = (t: Track, v: Voice) =>
  t.waveform === v.waveform &&
  (v.waveform !== 'custom' || t.timbre === v.timbre) &&
  Math.abs(t.attack - v.attack) < 1e-6 &&
  Math.abs(t.release - v.release) < 1e-6 &&
  JSON.stringify(t.synth ?? {}) === JSON.stringify(v.synth ?? {});

/** the file format for sharing voices (sounds): one voice, or every one */
export interface VoiceFile {
  kind: 'soundfunc-voices';
  version: 1;
  voices: Voice[];
}

export const voiceFile = (voices: Voice[]): VoiceFile => ({ kind: 'soundfunc-voices', version: 1, voices });

const isWaveform = (w: unknown): w is Waveform => typeof w === 'string' && (w in WAVEFORMS || w in DRUMS);
const num = (v: unknown, fallback: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);

/** read a voices file; throws a plain-language error for anything else */
export function readVoiceFile(text: string): Voice[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t JSON');
  }
  const f = data as Partial<VoiceFile>;
  if (f.kind !== 'soundfunc-voices' || !Array.isArray(f.voices)) throw new Error('That file isn’t a SoundFunc voices file');
  return f.voices
    .filter((v) => v && typeof v.name === 'string' && v.name.trim() && isWaveform(v.waveform))
    .map((v) => ({
      id: uid('voice'),
      name: v.name.trim(),
      waveform: v.waveform,
      timbre: typeof v.timbre === 'string' && v.timbre.trim() ? v.timbre : TRACK_DEFAULTS.timbre,
      attack: num(v.attack, TRACK_DEFAULTS.attack, 0, 10),
      release: num(v.release, TRACK_DEFAULTS.release, 0, 20),
      synth: v.synth && typeof v.synth === 'object' && !Array.isArray(v.synth) ? { ...v.synth } : undefined,
      savedAt: typeof v.savedAt === 'number' ? v.savedAt : Date.now(),
    }));
}

interface Library {
  voices: Voice[];
  projects: SavedProject[];
  blocks: Block[];
  functions: SavedFunction[];
  kits: SavedKit[];
  /** saving under an existing name replaces it */
  saveKit: (kit: SavedKit) => void;
  deleteKit: (id: string) => void;
  /** add kits from a file; names that already exist get a number; returns how many */
  importKits: (kits: SavedKit[]) => number;
  saveFunction: (fn: SavedFunction) => void;
  deleteFunction: (id: string) => void;
  /** add functions from a file; names that already exist get a number; returns how many */
  importFunctions: (fns: SavedFunction[]) => number;
  saveBlock: (block: Block) => void;
  deleteBlock: (id: string) => void;
  saveVoice: (voice: Voice) => void;
  deleteVoice: (id: string) => void;
  /** add voices from a file; names that already exist get a number; returns how many */
  importVoices: (voices: Voice[]) => number;
  /** save (or overwrite, when `id` is given) a project; returns its id */
  saveProject: (project: Project, id?: string | null) => string;
  deleteProject: (id: string) => void;
}

export const useLibrary = create<Library>()(
  persist(
    (set, get) => ({
      voices: [],
      projects: [],
      blocks: [],
      functions: [],
      kits: [],
      saveKit: (kit) => set((s) => ({ kits: [...s.kits.filter((k) => k.name !== kit.name), kit] })),
      deleteKit: (id) => set((s) => ({ kits: s.kits.filter((k) => k.id !== id) })),
      importKits: (kits) => {
        const taken = new Set(get().kits.map((k) => k.name));
        const added = kits.map((k) => {
          let name = k.name, i = 2;
          while (taken.has(name)) name = `${k.name} ${i++}`;
          taken.add(name);
          return { ...k, id: uid('kit'), name };
        });
        set((s) => ({ kits: [...s.kits, ...added] }));
        return added.length;
      },
      // saving under an existing name replaces it
      saveFunction: (fn) => set((s) => ({ functions: [...s.functions.filter((f) => f.name !== fn.name), fn] })),
      deleteFunction: (id) => set((s) => ({ functions: s.functions.filter((f) => f.id !== id) })),
      importFunctions: (fns) => {
        const taken = new Set(get().functions.map((f) => f.name));
        const added = fns.map((f) => {
          let name = f.name, i = 2;
          while (taken.has(name)) name = `${f.name} ${i++}`;
          taken.add(name);
          return { ...f, id: uid('fn'), name };
        });
        set((s) => ({ functions: [...s.functions, ...added] }));
        return added.length;
      },
      saveBlock: (block) => set((s) => ({ blocks: [...s.blocks.filter((b) => b.name !== block.name), block] })),
      deleteBlock: (id) => set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })),
      saveVoice: (voice) => set((s) => ({ voices: [...s.voices.filter((v) => v.name !== voice.name), voice] })),
      deleteVoice: (id) => set((s) => ({ voices: s.voices.filter((v) => v.id !== id) })),
      importVoices: (voices) => {
        const taken = new Set(get().voices.map((v) => v.name));
        const added = voices.map((v) => {
          let name = v.name, i = 2;
          while (taken.has(name)) name = `${v.name} ${i++}`;
          taken.add(name);
          return { ...v, id: uid('voice'), name };
        });
        set((s) => ({ voices: [...s.voices, ...added] }));
        return added.length;
      },
      saveProject: (project, id) => {
        const existing = id ? get().projects.find((p) => p.id === id) : undefined;
        const entry: SavedProject = { id: existing?.id ?? uid('garden'), name: project.name || 'Untitled', savedAt: Date.now(), project: cleanProject(project) };
        set((s) => ({ projects: [entry, ...s.projects.filter((p) => p.id !== entry.id)] }));
        return entry.id;
      },
      deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
    }),
    {
      name: 'soundfunc-library',
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<Library> | undefined;
        return {
          ...current,
          voices: p?.voices ?? [],
          blocks: p?.blocks ?? [],
          kits: p?.kits ?? [],
          functions: (p?.functions ?? []).map(({ sliders, ...f }) => ({ ...f, track: { ...TRACK_DEFAULTS, ...f.track, sliders: f.track.sliders ?? sliders ?? [] } })),
          projects: (p?.projects ?? []).map((sp) => ({ ...sp, project: normalizeProject(sp.project) })),
        };
      },
    },
  ),
);
