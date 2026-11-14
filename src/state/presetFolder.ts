/**
 * The presets folder: a "SoundFunc Presets" folder on your disk, laid out as
 *
 *   SoundFunc Presets/
 *     Functions/        your functions, one file each  (name.soundfunc-function.json)
 *     Rhythm kits/      your kits, one file each       (name.soundfunc-kit.json)
 *     Voices/           your saved sounds, one file each (name.soundfunc-voice.json)
 *     Factory presets/  every built-in function and kit, to look at, copy and share
 *
 * Once opened, My functions, My kits, My voices and the folder stay in step: what's in Functions,
 * Rhythm kits and Voices is loaded, and saving, importing or deleting writes or removes its file.
 * Factory presets is written for you and never read back.
 *
 * A web page can't open Finder or Explorer by itself, so "opening" means choosing where the
 * folder lives, once (Chrome, Edge — the File System Access API). Pick Documents and SoundFunc
 * makes "SoundFunc Presets" inside it; pick the SoundFunc Presets folder itself and it's used as
 * it is. It is remembered; after a reload the browser asks for access again with one click.
 * Browsers without the API can still load a folder's files once.
 */
import { create } from 'zustand';
import { functionFile, kitFile, readFunctionFile, readKitFile, readVoiceFile, useLibrary, voiceFile, type SavedFunction, type SavedKit, type Voice } from './library';
import { fileSafe } from '../components/ui';
import { KITS, PRESETS, trackFromPreset } from '../engine/presets';

export const ROOT_NAME = 'SoundFunc Presets';
const DIRS = { functions: 'Functions', kits: 'Rhythm kits', voices: 'Voices', factory: 'Factory presets' } as const;
export const FUNCTION_FILE_SUFFIX = '.soundfunc-function.json';
export const KIT_FILE_SUFFIX = '.soundfunc-kit.json';
export const VOICE_FILE_SUFFIX = '.soundfunc-voice.json';
export const fileNameOf = (name: string) => `${fileSafe(name)}${FUNCTION_FILE_SUFFIX}`;

// what the File System Access API gives (not in every TypeScript DOM library yet)
interface FileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
interface DirHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FileHandle | DirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<DirHandle>;
  removeEntry(name: string): Promise<void>;
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
}
type Picker = (opts: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<DirHandle>;
const picker = (): Picker | null => (typeof window !== 'undefined' ? ((window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker ?? null) : null);
/** can this browser keep a folder in step (write to it), or only read one? */
export const canLinkFolder = () => !!picker();

// ---------- the chosen folder, remembered across visits (IndexedDB keeps the handle) ----------

const DB = 'soundfunc-files', STORE = 'handles', KEY = 'presets';
function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const req = run(open.result.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined); // e.g. a handle this browser can't store: it just isn't remembered
        }
      };
    } catch {
      resolve(undefined);
    }
  });
}

// ---------- files ----------

async function writeFile(dir: DirHandle, name: string, text: string) {
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(text);
  await w.close();
}

async function names(dir: DirHandle): Promise<Set<string>> {
  const out = new Set<string>();
  for await (const e of dir.values()) out.add(e.name);
  return out;
}

/**
 * One kind of thing kept in step with a folder: functions or kits. `read` turns a file into
 * items (several for an Export all file), `text` writes one item as a file.
 */
interface Collection<T extends { name: string }> {
  suffix: string;
  read: (text: string) => T[];
  text: (item: T) => string;
  list: () => T[];
  /** put the folder's items into the library: the folder's copy wins for a name both have */
  merge: (items: T[]) => T[];
  dir: DirHandle | null;
  /** what's on disk by item name: its file ('' for one inside a several-item file), and the text last written or read */
  files: Map<string, { file: string; text: string }>;
}

/**
 * The folder's copy wins for a name both have — but an item keeps the date it joined the library,
 * and one that is new to it joins now (a file copied in from elsewhere carries its old date, and
 * "newest first" should still put it at the top).
 */
function mergeByName<T extends { id: string; name: string; savedAt: number }>(have: T[], incoming: T[]): T[] {
  const byName = new Map(have.map((x) => [x.name, x]));
  const now = Date.now();
  const fromFolder = incoming.map((x, i) => {
    const had = byName.get(x.name);
    return { ...x, id: had?.id ?? x.id, savedAt: had ? had.savedAt : now + i };
  });
  const taken = new Set(fromFolder.map((x) => x.name));
  return [...have.filter((x) => !taken.has(x.name)), ...fromFolder];
}

const functions: Collection<SavedFunction> = {
  suffix: FUNCTION_FILE_SUFFIX,
  read: readFunctionFile,
  text: (fn) => JSON.stringify(functionFile([fn]), null, 2),
  list: () => useLibrary.getState().functions,
  merge: (items) => {
    const merged = mergeByName(useLibrary.getState().functions, items);
    useLibrary.setState({ functions: merged });
    return merged;
  },
  dir: null,
  files: new Map(),
};
const kits: Collection<SavedKit> = {
  suffix: KIT_FILE_SUFFIX,
  read: readKitFile,
  text: (k) => JSON.stringify(kitFile([k]), null, 2),
  list: () => useLibrary.getState().kits,
  merge: (items) => {
    const merged = mergeByName(useLibrary.getState().kits, items);
    useLibrary.setState({ kits: merged });
    return merged;
  },
  dir: null,
  files: new Map(),
};

const voices: Collection<Voice> = {
  suffix: VOICE_FILE_SUFFIX,
  read: readVoiceFile,
  text: (v) => JSON.stringify(voiceFile([v]), null, 2),
  list: () => useLibrary.getState().voices,
  merge: (items) => {
    const merged = mergeByName(useLibrary.getState().voices, items);
    useLibrary.setState({ voices: merged });
    return merged;
  },
  dir: null,
  files: new Map(),
};

/** read every item in a folder (and, for functions, in an older flat folder's top level) */
async function load<T extends { name: string }>(c: Collection<T>, ...dirs: DirHandle[]): Promise<{ items: T[]; skipped: number }> {
  const items: T[] = [];
  let skipped = 0;
  c.files = new Map();
  for (const dir of dirs) {
    for await (const entry of dir.values()) {
      if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.json')) continue;
      let found: T[];
      try {
        found = c.read(await (await entry.getFile()).text());
      } catch {
        // a file of the other kind, or not ours: leave it be
        if (dir === c.dir) skipped++;
        continue;
      }
      for (const it of found) {
        items.push(it);
        // only a one-item file in this collection's own folder belongs to its item (deleting it removes the file)
        c.files.set(it.name, { file: found.length === 1 && dir === c.dir ? entry.name : '', text: c.text(it) });
      }
    }
  }
  return { items, skipped };
}

/** write what changed, remove the files of deleted items; returns how many files were written */
let queue: Promise<unknown> = Promise.resolve();
function sync<T extends { name: string }>(c: Collection<T>, items: T[]): Promise<number> {
  const run = async () => {
    const dir = c.dir;
    if (!dir) return 0;
    let written = 0;
    const now = new Set(items.map((x) => x.name));
    try {
      for (const it of items) {
        const text = c.text(it), had = c.files.get(it.name);
        if (had && had.text === text) continue;
        const file = had?.file || `${fileSafe(it.name)}${c.suffix}`;
        await writeFile(dir, file, text);
        c.files.set(it.name, { file, text });
        written++;
      }
      for (const [name, { file }] of [...c.files]) {
        if (now.has(name)) continue;
        c.files.delete(name);
        if (file) await dir.removeEntry(file).catch(() => {});
      }
    } catch {
      // access was withdrawn (or the folder moved): ask again on the next click
      usePresetFolder.setState({ needsAccess: true });
    }
    return written;
  };
  const next = queue.then(run, run);
  queue = next;
  return next as Promise<number>;
}

/** the built-in presets and kits as files, so the folder shows everything SoundFunc comes with; only missing ones are written */
async function writeFactory(root: DirHandle): Promise<number> {
  const factory = await root.getDirectoryHandle(DIRS.factory, { create: true });
  const fnDir = await factory.getDirectoryHandle(DIRS.functions, { create: true });
  const kitDir = await factory.getDirectoryHandle(DIRS.kits, { create: true });
  const [haveFn, haveKit] = await Promise.all([names(fnDir), names(kitDir)]);
  let n = 0;
  for (const [i, p] of PRESETS.entries()) {
    const file = `${fileSafe(p.name)}${FUNCTION_FILE_SUFFIX}`;
    if (haveFn.has(file)) continue;
    const { id: _id, color: _c, muted: _m, solo: _s, name: _n, ...track } = trackFromPreset(p, i);
    const fn: SavedFunction = { id: `preset-${p.id}`, name: p.name, description: p.description, savedAt: 0, track };
    await writeFile(fnDir, file, functions.text(fn));
    n++;
  }
  for (const k of KITS) {
    const file = `${fileSafe(k.name)}${KIT_FILE_SUFFIX}`;
    if (haveKit.has(file)) continue;
    const saved: SavedKit = { id: `kit-${k.id}`, name: k.name, description: k.description, savedAt: 0, song: k.song ?? {}, tracks: k.tracks };
    await writeFile(kitDir, file, kits.text(saved));
    n++;
  }
  return n;
}

// ---------- the folder, kept in step with the library ----------

interface FolderState {
  /** where it is, as far as the browser lets us see: "Documents › SoundFunc Presets" */
  name: string | null;
  /** chosen, but the browser needs a click to grant access again (after a reload) */
  needsAccess: boolean;
  busy: boolean;
}
export const usePresetFolder = create<FolderState>(() => ({ name: null, needsAccess: false, busy: false }));

let unsubscribe: (() => void) | null = null;

/** bring the folder and the library together: the folder's items in, the library's missing ones out */
async function connect(root: DirHandle, label: string): Promise<{ functions: number; kits: number; voices: number; written: number; factory: number; skipped: number }> {
  usePresetFolder.setState({ name: label, needsAccess: false, busy: true });
  try {
    functions.dir = await root.getDirectoryHandle(DIRS.functions, { create: true });
    kits.dir = await root.getDirectoryHandle(DIRS.kits, { create: true });
    voices.dir = await root.getDirectoryHandle(DIRS.voices, { create: true });
    // an older folder kept functions at its top level: read those too (new ones go into Functions)
    const f = await load(functions, functions.dir, root);
    const k = await load(kits, kits.dir);
    const v = await load(voices, voices.dir);
    const written = (await sync(functions, functions.merge(f.items))) + (await sync(kits, kits.merge(k.items))) + (await sync(voices, voices.merge(v.items)));
    const factory = await writeFactory(root).catch(() => 0);
    unsubscribe?.();
    const off = useLibrary.subscribe((s, prev) => {
      if (s.functions !== prev.functions) void sync(functions, s.functions);
      if (s.kits !== prev.kits) void sync(kits, s.kits);
      if (s.voices !== prev.voices) void sync(voices, s.voices);
    });
    // files dropped into the folder from outside (Finder, another machine) turn up when you come back to SoundFunc
    const back = () => document.visibilityState === 'visible' && void rescan(root);
    window.addEventListener('focus', back);
    document.addEventListener('visibilitychange', back);
    unsubscribe = () => {
      off();
      window.removeEventListener('focus', back);
      document.removeEventListener('visibilitychange', back);
    };
    return { functions: f.items.length, kits: k.items.length, voices: v.items.length, written, factory, skipped: f.skipped + k.skipped + v.skipped };
  } finally {
    usePresetFolder.setState({ busy: false });
  }
}

/** read the folder again and bring in what appeared there since; nothing is removed from the library */
let rescanning = false;
async function rescan(root: DirHandle) {
  if (rescanning || !functions.dir || usePresetFolder.getState().needsAccess) return;
  rescanning = true;
  try {
    const before = useLibrary.getState();
    const f = await load(functions, functions.dir, root);
    const k = await load(kits, kits.dir!);
    const v = await load(voices, voices.dir!);
    const added = (xs: { name: string }[], have: { name: string }[]) => xs.filter((x) => !have.some((h) => h.name === x.name)).length;
    const n = added(f.items, before.functions) + added(k.items, before.kits) + added(v.items, before.voices);
    await sync(functions, functions.merge(f.items));
    await sync(kits, kits.merge(k.items));
    await sync(voices, voices.merge(v.items));
    if (n) void import('../components/TopBar').then((m) => m.toast(`${n} new preset${n === 1 ? '' : 's'} from your presets folder — newest first in My functions`));
  } catch {
    usePresetFolder.setState({ needsAccess: true });
  } finally {
    rescanning = false;
  }
}

/** is this folder already a SoundFunc presets folder (or an older flat one with functions in it)? */
async function isPresetsFolder(d: DirHandle): Promise<boolean> {
  if (d.name === ROOT_NAME) return true;
  for await (const e of d.values()) {
    if (e.kind === 'directory' && (e.name === DIRS.functions || e.name === DIRS.kits || e.name === DIRS.voices || e.name === DIRS.factory)) return true;
    if (e.kind === 'file' && (e.name.endsWith(FUNCTION_FILE_SUFFIX) || e.name.endsWith(KIT_FILE_SUFFIX) || e.name.endsWith(VOICE_FILE_SUFFIX))) return true;
  }
  return false;
}

interface Kept {
  root: DirHandle;
  label: string;
}

/**
 * Open presets folder…: choose where it lives (or, after a reload, grant access to the one
 * chosen before) and keep it in step. Picking any ordinary folder makes "SoundFunc Presets"
 * inside it. Throws 'no-picker' where the browser can't (use readFolderFiles there).
 */
export async function openPresetFolder(): Promise<string> {
  const pick = picker();
  if (!pick) throw new Error('no-picker');
  let kept: Kept | null = null;
  if (usePresetFolder.getState().needsAccess) {
    const k = await idb<Kept>('readonly', (s) => s.get(KEY));
    if (k?.root && (await k.root.requestPermission({ mode: 'readwrite' })) === 'granted') kept = k;
  }
  if (!kept) {
    const chosen = await pick({ id: 'soundfunc-presets', mode: 'readwrite', startIn: 'documents' });
    const root = (await isPresetsFolder(chosen)) ? chosen : await chosen.getDirectoryHandle(ROOT_NAME, { create: true });
    kept = { root, label: root === chosen ? chosen.name : `${chosen.name} › ${ROOT_NAME}` };
    await idb('readwrite', (s) => s.put(kept, KEY));
  }
  const r = await connect(kept.root, kept.label);
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
  return `Presets folder: ${kept.label}. ${plural(r.functions, 'function')}, ${plural(r.kits, 'kit')} and ${plural(r.voices, 'voice')} loaded${r.written ? `, ${r.written} written` : ''}${r.factory ? ` · ${r.factory} factory presets added` : ''}${r.skipped ? ` · ${plural(r.skipped, 'file')} skipped` : ''}. Saving and deleting now keep it in step.`;
}

/** stop keeping the folder in step (its files stay as they are) */
export async function forgetPresetFolder() {
  unsubscribe?.();
  unsubscribe = null;
  functions.dir = kits.dir = voices.dir = null;
  functions.files = new Map();
  kits.files = new Map();
  voices.files = new Map();
  await idb('readwrite', (s) => s.delete(KEY));
  usePresetFolder.setState({ name: null, needsAccess: false });
}

/** on start: reconnect to the folder chosen before, if the browser still allows it — else wait for a click */
export async function restorePresetFolder() {
  if (!picker()) return;
  const raw = await idb<Kept | DirHandle>('readonly', (s) => s.get(KEY));
  if (!raw) return;
  // a folder remembered by an older version: the handle itself
  const kept: Kept = 'root' in raw ? raw : { root: raw, label: raw.name };
  if ((await kept.root.queryPermission({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted') await connect(kept.root, kept.label).catch(() => usePresetFolder.setState({ name: kept.label, needsAccess: true }));
  else usePresetFolder.setState({ name: kept.label, needsAccess: true });
}

/** put functions from a folder into My functions: the folder's copy wins for a name both have */
export function mergeFunctions(fns: SavedFunction[]) {
  functions.merge(fns);
}
/** …and kits into My kits */
export function mergeKits(ks: SavedKit[]) {
  kits.merge(ks);
}

/** …and voices into My voices */
export function mergeVoices(vs: Voice[]) {
  voices.merge(vs);
}

/** browsers without the API: read the functions, kits and voices out of a folder's files (from <input webkitdirectory>) */
export async function readFolderFiles(list: FileList): Promise<{ fns: SavedFunction[]; kits: SavedKit[]; voices: Voice[]; skipped: number }> {
  const fns: SavedFunction[] = [], ks: SavedKit[] = [], vs: Voice[] = [];
  let skipped = 0;
  for (const f of Array.from(list)) {
    if (!f.name.toLowerCase().endsWith('.json')) continue;
    // the factory copies are SoundFunc's own: they're already built in
    if ((f as File & { webkitRelativePath?: string }).webkitRelativePath?.includes(`${DIRS.factory}/`)) continue;
    const text = await f.text();
    try {
      fns.push(...readFunctionFile(text));
      continue;
    } catch {
      /* maybe a kit */
    }
    try {
      ks.push(...readKitFile(text));
      continue;
    } catch {
      /* maybe a voice */
    }
    try {
      vs.push(...readVoiceFile(text));
    } catch {
      skipped++;
    }
  }
  return { fns, kits: ks, voices: vs, skipped };
}

