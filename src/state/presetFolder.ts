/**
 * The presets folder: a folder on your disk that holds your functions, one file each
 * (`name.soundfunc-function.json`, the same file a single download gives). Once opened, My
 * functions and the folder stay in step: everything in the folder is loaded, and saving,
 * importing or deleting a function writes or removes its file.
 *
 * A web page can't open Finder or Explorer, so "opening" the folder means choosing it once
 * (Chrome, Edge — the File System Access API); it is remembered, and the browser asks again
 * for access after a reload. Browsers without the API can still load a folder's functions.
 */
import { create } from 'zustand';
import { functionFile, readFunctionFile, useLibrary, type SavedFunction } from './library';
import { fileSafe } from '../components/ui';

export const FUNCTION_FILE_SUFFIX = '.soundfunc-function.json';
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
  removeEntry(name: string): Promise<void>;
  queryPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(opts: { mode: 'readwrite' }): Promise<PermissionState>;
}
type Picker = (opts: { id?: string; mode?: 'readwrite' }) => Promise<DirHandle>;
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

// ---------- reading and writing ----------

/** every function in a folder: one per file, or several from an Export all file */
async function readFolder(dir: DirHandle): Promise<{ fns: SavedFunction[]; fileOf: Map<string, string>; skipped: number }> {
  const fns: SavedFunction[] = [];
  const fileOf = new Map<string, string>();
  let skipped = 0;
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.json')) continue;
    try {
      const found = readFunctionFile(await (await entry.getFile()).text());
      for (const f of found) {
        fns.push(f);
        // only a one-function file belongs to its function (deleting it removes the file)
        if (found.length === 1) fileOf.set(f.name, entry.name);
      }
    } catch {
      skipped++;
    }
  }
  return { fns, fileOf, skipped };
}

async function writeFile(dir: DirHandle, name: string, text: string) {
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(text);
  await w.close();
}
const textOf = (fn: SavedFunction) => JSON.stringify(functionFile([fn]), null, 2);

// ---------- the folder, kept in step with My functions ----------

interface FolderState {
  /** the folder's name, once chosen */
  name: string | null;
  /** chosen, but the browser needs a click to grant access again (after a reload) */
  needsAccess: boolean;
  busy: boolean;
}
export const usePresetFolder = create<FolderState>(() => ({ name: null, needsAccess: false, busy: false }));

let dir: DirHandle | null = null;
/** what's in the folder by function name: its file, and the text last written or read */
let files = new Map<string, { file: string; text: string }>();
let unsubscribe: (() => void) | null = null;

/** bring the folder and the library together: the folder's functions in, the library's missing ones out */
async function connect(d: DirHandle): Promise<{ loaded: number; written: number; skipped: number }> {
  dir = d;
  usePresetFolder.setState({ name: d.name, needsAccess: false, busy: true });
  try {
    const { fns, fileOf, skipped } = await readFolder(d);
    const { fromFolder, merged } = mergeFunctions(fns);
    files = new Map(fromFolder.filter((f) => fileOf.has(f.name)).map((f) => [f.name, { file: fileOf.get(f.name)!, text: textOf(f) }]));
    for (const f of fromFolder) if (!fileOf.has(f.name)) files.set(f.name, { file: '', text: textOf(f) }); // from a several-function file: already on disk
    const written = await sync(merged);
    unsubscribe?.();
    unsubscribe = useLibrary.subscribe((s, prev) => {
      if (s.functions !== prev.functions) void sync(s.functions);
    });
    return { loaded: fns.length, written, skipped };
  } finally {
    usePresetFolder.setState({ busy: false });
  }
}

/** put a folder's functions into My functions: the folder's copy wins for a name both have, the rest is added */
export function mergeFunctions(fns: SavedFunction[]): { fromFolder: SavedFunction[]; merged: SavedFunction[] } {
  const lib = useLibrary.getState();
  const byName = new Map(lib.functions.map((f) => [f.name, f]));
  const fromFolder = fns.map((f) => ({ ...f, id: byName.get(f.name)?.id ?? f.id }));
  const names = new Set(fromFolder.map((f) => f.name));
  const merged = [...lib.functions.filter((f) => !names.has(f.name)), ...fromFolder];
  useLibrary.setState({ functions: merged });
  return { fromFolder, merged };
}

/** write what changed, remove the files of deleted functions; returns how many files were written */
let queue: Promise<unknown> = Promise.resolve();
function sync(fns: SavedFunction[]): Promise<number> {
  const run = async () => {
    if (!dir) return 0;
    let written = 0;
    const now = new Set(fns.map((f) => f.name));
    try {
      for (const fn of fns) {
        const text = textOf(fn), had = files.get(fn.name);
        if (had && had.text === text) continue;
        const file = had?.file || fileNameOf(fn.name);
        await writeFile(dir, file, text);
        files.set(fn.name, { file, text });
        written++;
      }
      for (const [name, { file }] of [...files]) {
        if (now.has(name)) continue;
        files.delete(name);
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
  return next;
}

/**
 * Open presets folder…: choose a folder (or, after a reload, grant access to the one chosen
 * before) and keep it in step. Without the File System Access API, `fallback` lets the page
 * read a folder's files once instead (readFolderFiles).
 */
export async function openPresetFolder(): Promise<string> {
  const pick = picker();
  if (!pick) throw new Error('no-picker');
  const st = usePresetFolder.getState();
  let d: DirHandle | null = null;
  if (st.needsAccess) {
    const kept = await idb<DirHandle>('readonly', (s) => s.get(KEY));
    if (kept && (await kept.requestPermission({ mode: 'readwrite' })) === 'granted') d = kept;
  }
  if (!d) {
    d = await pick({ id: 'soundfunc-presets', mode: 'readwrite' });
    await idb('readwrite', (s) => s.put(d, KEY));
  }
  const { loaded, written, skipped } = await connect(d);
  return `Presets folder “${d.name}”: ${loaded} function${loaded === 1 ? '' : 's'} loaded${written ? `, ${written} written to it` : ''}${skipped ? ` · ${skipped} file${skipped > 1 ? 's weren’t functions' : ' wasn’t a function'}` : ''}. Saving and deleting now keep it in step.`;
}

/** stop keeping the folder in step (its files stay as they are) */
export async function forgetPresetFolder() {
  unsubscribe?.();
  unsubscribe = null;
  dir = null;
  files = new Map();
  await idb('readwrite', (s) => s.delete(KEY));
  usePresetFolder.setState({ name: null, needsAccess: false });
}

/** on start: reconnect to the folder chosen before, if the browser still allows it — else wait for a click */
export async function restorePresetFolder() {
  if (!picker()) return;
  const kept = await idb<DirHandle>('readonly', (s) => s.get(KEY));
  if (!kept) return;
  if ((await kept.queryPermission({ mode: 'readwrite' }).catch(() => 'denied')) === 'granted') await connect(kept).catch(() => usePresetFolder.setState({ name: kept.name, needsAccess: true }));
  else usePresetFolder.setState({ name: kept.name, needsAccess: true });
}

/** browsers without the API: read the functions out of a folder's files (from <input webkitdirectory>) */
export async function readFolderFiles(list: FileList): Promise<{ fns: SavedFunction[]; skipped: number }> {
  const fns: SavedFunction[] = [];
  let skipped = 0;
  for (const f of Array.from(list)) {
    if (!f.name.toLowerCase().endsWith('.json')) continue;
    try {
      fns.push(...readFunctionFile(await f.text()));
    } catch {
      skipped++;
    }
  }
  return { fns, skipped };
}
