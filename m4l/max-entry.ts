/**
 * The device's script for Max's [v8] object: connects the device logic (host.ts) to Max.
 * Bundled into m4l/device/soundfunc.js by `npm run build:m4l`.
 *
 * Outlets:
 *   0 → [pipe] left: an event (MIDI packed into one number), or "clear"
 *   1 → [pipe] right: that event's delay in ms (sent first)
 *   2 → [midiout]: MIDI right now (note-offs when stopping)
 *   3 → the editor window ([jweb])
 *   4 → [pattr]: the project, kept with the Live Set
 *   5 → the status line on the device
 *   6 → the Play toggle (switched off, without a loop back, after Write to clip)
 */
import { createHost, type Io } from './host';

declare function outlet(n: number, ...args: unknown[]): void;
declare function post(...args: unknown[]): void;
declare class Dict {
  constructor(name: string);
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}
declare class File {
  constructor(path: string, access?: string);
  isopen: boolean;
  eof: number;
  position: number;
  readstring(count: number): string;
  close(): void;
}
/** Max's handle on the Live Object Model */
declare class LiveAPI {
  constructor(path?: string);
  id: string | number;
  type: string;
  unquotedpath: string;
  get(prop: string): unknown[];
  set(prop: string, ...values: unknown[]): void;
  call(fn: string, ...args: unknown[]): unknown;
  getcount(child: string): number;
}
declare class Task {
  constructor(fn: () => void);
  schedule(ms?: number): void;
  cancel(): void;
}

const g = globalThis as unknown as Record<string, unknown>;
g.inlets = 1;
g.outlets = 7;
g.autowatch = 0;

// what a browser has and Max's JavaScript engine may not
if (typeof g.structuredClone !== 'function') g.structuredClone = (v: unknown) => JSON.parse(JSON.stringify(v));
if (typeof g.setTimeout !== 'function') {
  g.setTimeout = (fn: () => void, ms: number) => {
    const t = new Task(fn);
    t.schedule(ms);
    return t;
  };
  g.clearTimeout = (t?: Task) => t?.cancel?.();
}

/** the dict the editor and the device pass the project through — one per device */
const sharedName = `sf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const io: Io = {
  later(delayMs, code) {
    outlet(1, delayMs);
    outlet(0, code);
  },
  now(bytes) {
    outlet(2, ...bytes);
  },
  cancel() {
    outlet(0, 'clear');
  },
  ui(...args) {
    outlet(3, ...args);
  },
  store(json) {
    outlet(4, 'set', json);
  },
  status(text) {
    outlet(5, 'set', text);
  },
  readShared(key = 'json') {
    const v = new Dict(sharedName).get(key);
    return typeof v === 'string' ? v : null;
  },
  writeShared(text, key = 'json') {
    new Dict(sharedName).set(key, text);
  },
  sharedName,
};

const host = createHost(io);

/**
 * The editor's page, beside the device: the device's (or patch's) path with its file name
 * swapped for ui/index.html — in Max's own path form ("Macintosh HD:/…" or "C:/…"), which
 * [jweb]'s readfile takes directly.
 */
let editorPage = '';
function showEditorFrom(path: string) {
  if (!path) return;
  let folder = path.replace(/\\/g, '/');
  if (/\.(amxd|maxpat|maxhelp)$/i.test(folder)) folder = folder.slice(0, folder.lastIndexOf('/'));
  const page = `${folder}/ui/index.html`;
  if (page === editorPage) return;
  editorPage = page;
  post(`SoundFunc editor page: ${page}\n`);
  io.ui('readfile', page);
}

// ---------- messages from the patch ----------

g.clock = (tempo: number, state: number, ticks: number) => host.clock(tempo, state, ticks);
g.restore = (...parts: unknown[]) => host.restore(parts.join(' '));
g.ui = (cmd: unknown) => host.ui(String(cmd));
g.active = (on: number) => host.active(on);
g.channel = (n: number) => host.channel(n);
g.midi = (m: number) => host.midi(m);
g.fn = (n: number) => host.fn(n);
g.panic = () => host.panic();

/**
 * Write to clip: the song's notes into a clip on this device's track, so they're Live's own notes
 * to edit. The clip open in Live's clip view, if it's on this track (session or arrangement) — its
 * notes are replaced — or else a new clip in the track's first empty session slot. Live's clip API
 * takes notes only: glides arrive as the notes they pass through, bends stay with the device.
 */
const live = (path: string) => new LiveAPI(path);
const isSome = (api: LiveAPI) => String(api.id) !== '0';
/** the track a clip sits on: a session clip's parent is its slot, an arrangement clip's is the track */
function trackOfClip(clip: LiveAPI): LiveAPI {
  const parent = live(`${clip.unquotedpath} canonical_parent`);
  return parent.type === 'ClipSlot' ? live(`${parent.unquotedpath} canonical_parent`) : parent;
}
g.writeclip = () => {
  try {
    const { name, length, notes } = host.clipNotes();
    if (!notes.length) return io.status('Nothing to write — the song has no notes.');
    const track = live('this_device canonical_parent');
    if (!isSome(track) || track.type !== 'Track') return io.status('Write to clip works on a MIDI track.');
    let clip: LiveAPI | null = null;
    let fresh = false;
    const shown = live('live_set view detail_clip');
    if (isSome(shown) && Number(shown.get('is_midi_clip')[0]) === 1 && String(trackOfClip(shown).id) === String(track.id)) clip = shown;
    else {
      const slots = track.getcount('clip_slots');
      for (let i = 0; i < slots && !clip; i++) {
        const slot = live(`${track.unquotedpath} clip_slots ${i}`);
        if (Number(slot.get('has_clip')[0]) === 0) {
          slot.call('create_clip', length);
          clip = live(`${slot.unquotedpath} clip`);
          fresh = true;
        }
      }
    }
    if (!clip || !isSome(clip)) return io.status('No empty clip slot on this track — open a clip on it, or free a slot.');
    if (!fresh) {
      const old = Number(clip.get('length')[0]) || 0;
      clip.call('remove_notes_extended', 0, 128, 0, Math.max(old, length) + 1);
      // the clip takes the song's length (loop end and end marker, in the order Live allows)
      if (length > Number(clip.get('loop_end')[0])) clip.set('end_marker', length), clip.set('loop_end', length);
      else clip.set('loop_end', length), clip.set('end_marker', length);
      clip.set('loop_start', 0);
      clip.set('start_marker', 0);
    }
    clip.call('add_new_notes', { notes });
    clip.set('name', name);
    // the clip plays the notes now — stop the device playing them too, or they'd sound twice
    outlet(6, 'set', 0);
    host.active(0);
    io.status(`Wrote ${notes.length} notes (${length} beats) to “${name}”. Play is off — the clip plays them.`);
  } catch (e) {
    post(`SoundFunc Write to clip: ${e}\n`);
    io.status('Couldn’t write the clip — see the Max Console.');
  }
};
/** Import…: Max's file dialog picked a file — read it whole and let the device decide what it is */
g.importfile = (...parts: unknown[]) => {
  const path = parts.join(' ');
  const f = new File(path, 'read');
  if (!f.isopen) return io.status(`Couldn't open ${path}`);
  let text = '';
  while (f.position < f.eof) {
    const chunk = f.readstring(32768);
    if (!chunk) break;
    text += chunk;
  }
  f.close();
  host.importText(text, path);
};
/** where the device lives, so the editor window can find its page (ui/index.html beside the device) */
g.devicepath = (...parts: unknown[]) => showEditorFrom(parts.join(' '));
g.loadbang = () => {
  io.status(host.describe());
  // where this script's patch lives — the editor page sits beside it
  const self = (globalThis as unknown as { patcher?: { filepath?: string } }).patcher;
  if (self?.filepath) showEditorFrom(self.filepath);
  post('SoundFunc ready\n');
};
g.bang = () => io.status(host.describe());
