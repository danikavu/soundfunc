import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../engine/presets';
import type { Block } from '../engine/graphEdit';
import { normalizeProject, type Project, type Track, type Waveform } from '../engine/project';

/** The sound of a track, without its notes: reusable across tracks and projects. */
export interface Voice {
  id: string;
  name: string;
  waveform: Waveform;
  timbre: string;
  attack: number;
  release: number;
  savedAt: number;
}

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
  return { id: uid('voice'), name, waveform: track.waveform, timbre: track.timbre, attack: track.attack, release: track.release, savedAt: Date.now() };
}

/** Does this track currently sound like this voice? */
export const wearsVoice = (t: Track, v: Voice) =>
  t.waveform === v.waveform && (v.waveform !== 'custom' || t.timbre === v.timbre) && Math.abs(t.attack - v.attack) < 1e-6 && Math.abs(t.release - v.release) < 1e-6;

interface Library {
  voices: Voice[];
  projects: SavedProject[];
  blocks: Block[];
  saveBlock: (block: Block) => void;
  deleteBlock: (id: string) => void;
  saveVoice: (voice: Voice) => void;
  deleteVoice: (id: string) => void;
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
      saveBlock: (block) => set((s) => ({ blocks: [...s.blocks.filter((b) => b.name !== block.name), block] })),
      deleteBlock: (id) => set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) })),
      saveVoice: (voice) => set((s) => ({ voices: [...s.voices.filter((v) => v.name !== voice.name), voice] })),
      deleteVoice: (id) => set((s) => ({ voices: s.voices.filter((v) => v.id !== id) })),
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
          projects: (p?.projects ?? []).map((sp) => ({ ...sp, project: normalizeProject(sp.project) })),
        };
      },
    },
  ),
);
