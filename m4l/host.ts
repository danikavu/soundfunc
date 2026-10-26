/**
 * The SoundFunc Max for Live device: Live's transport in, MIDI out.
 *
 * Max's JavaScript runs on the low-priority thread, so this never tries to fire events at
 * the right moment itself. A high-priority [metro] → [transport] reports where Live is every
 * few milliseconds; on each report this works out the next stretch of MIDI (the same events a
 * MIDI file of the song holds — engine/midi.ts) and hands every event to [pipe] with its exact
 * delay. [pipe] runs on the scheduler and lets each one go on time.
 *
 * Kept free of Max globals: the device wiring (max-entry.ts) passes in a small Io, so the
 * same logic runs in tests against a pretend transport.
 */
import { windowEvents, PPQ, type Ev, type MidiMode } from '../src/engine/midi';
import { audibleTracks, normalizeProject, songBeats, type Project } from '../src/engine/project';
import { defaultProject, MATH_PRESETS, trackFromPreset, trackFromTemplate } from '../src/engine/presets';
import { fitToSong } from '../src/engine/kits';

/** what the device can do to the outside world */
export interface Io {
  /** an event for [pipe]: its delay in ms, then the event packed into one number */
  later(delayMs: number, code: number): void;
  /** MIDI bytes out right now (note-offs when stopping) */
  now(bytes: number[]): void;
  /** cancel everything waiting in [pipe] */
  cancel(): void;
  /** a message to the editor window ([jweb]) */
  ui(...args: (string | number)[]): void;
  /** keep the project with the Live Set */
  store(json: string): void;
  /** the line of text on the device */
  status(text: string): void;
  /** read / write the text the editor and the device pass each other (`key`: "json" for the project) */
  readShared(key?: string): string | null;
  writeShared(text: string, key?: string): void;
  /** the shared dict's name, for the editor */
  sharedName: string;
}

/** how far ahead events are handed to [pipe] — enough to ride out the low-priority thread's delays */
export const LOOKAHEAD_MS = 120;
/** a jump in Live's position bigger than this (beats) is a relocation, not playback */
const JUMP = 0.75;

/** MIDI bytes packed into one number for [pipe] (a 2-byte message marks its third byte 255) */
export const pack = (bytes: number[]) => ((bytes[0] & 0xff) << 16) | ((bytes[1] ?? 0) << 8) | (bytes.length > 2 ? bytes[2] : 255);
export const unpack = (code: number) => {
  const b = [(code >> 16) & 0xff, (code >> 8) & 0xff, code & 0xff];
  return b[2] === 255 ? b.slice(0, 2) : b;
};

/** an event to play: a note-on carries the tick its note-off is due */
interface Play {
  tick: number;
  order: number;
  bytes: number[];
  off?: number;
}

export function createHost(io: Io) {
  let project: Project = defaultProject();
  /** which channel this device plays: 0 = all (each on its own MIDI channel), n = channel n alone (on MIDI channel 1) */
  let only = 0;
  let mode: Exclude<MidiMode, 'mpe'> = 'standard';
  let active = true;

  let playing = false;
  let lastBeat = -1;
  /** everything before this (beats) has been handed to [pipe] */
  let handedTo = 0;
  /** note-offs owed for notes already sent: tick → bytes */
  let owed: { tick: number; bytes: number[] }[] = [];
  /** notes sounding (or about to), for a clean stop: "ch:note" → note-off bytes */
  const sounding = new Map<string, number[]>();
  /** note-offs handed to [pipe] but not yet due — cancelling [pipe] would swallow them */
  let offsWaiting: { beat: number; bytes: number[] }[] = [];
  /** MIDI channels that have bent, to re-centre */
  const bent = new Set<number>();
  const passes = new Map<number, Play[]>();
  let storeTimer = 0;
  /** imports waiting for the editor to open */
  let pendingImport: { kind: 'functions' | 'math'; text: string } | null = null;
  let editorReady = false;
  function handOver(kind: 'functions' | 'math', text: string) {
    io.writeShared(kind, 'import_kind');
    io.writeShared(text, 'import_text');
    io.ui('sf_import', io.sharedName);
  }

  const songLength = () => Math.max(1 / 16, songBeats(audibleTracks(project.tracks), project.song));

  /** one pass of the song as events to play: what the MIDI file of this pass holds */
  function pass(p: number): Play[] {
    let evs = passes.get(p);
    if (evs) return evs;
    const T = songLength();
    let channels = windowEvents(project, mode, p * T, (p + 1) * T, { raw: 0, kept: 0 }, false);
    if (only > 0) channels = channels.filter((c) => audibleTracks(project.tracks).indexOf(c.track) === only - 1);
    const all: Ev[] = [];
    for (const c of channels) {
      for (const e of c.events) {
        if ((e.bytes[0] & 0xf0) === 0xc0) continue; // program changes mean nothing to Live's instruments
        // one channel alone plays on MIDI channel 1
        all.push(only > 0 ? { ...e, bytes: [(e.bytes[0] & 0xf0) | 0, ...e.bytes.slice(1)] } : e);
      }
    }
    all.sort((a, b) => a.tick - b.tick || a.order - b.order);
    // pair each note-on with its note-off: the off is owed the moment the on is sent
    evs = [];
    const open = new Map<string, Play[]>();
    for (const e of all) {
      const kind = e.bytes[0] & 0xf0;
      const key = `${e.bytes[0] & 0x0f}:${e.bytes[1]}`;
      if (kind === 0x90 && e.bytes[2] > 0) {
        const play: Play = { ...e };
        evs.push(play);
        open.set(key, [...(open.get(key) ?? []), play]);
      } else if (kind === 0x80 || (kind === 0x90 && e.bytes[2] === 0)) {
        const on = open.get(key)?.shift();
        if (on) on.off = e.tick;
      } else evs.push({ ...e });
    }
    passes.set(p, evs);
    if (passes.size > 8) passes.delete(passes.keys().next().value!);
    return evs;
  }

  function stopAll() {
    io.cancel();
    for (const bytes of sounding.values()) io.now(bytes);
    for (const o of offsWaiting) if (o.beat > lastBeat - 1e-9) io.now(o.bytes);
    offsWaiting = [];
    for (const ch of bent) io.now([0xe0 | ch, 0, 64]);
    sounding.clear();
    bent.clear();
    owed = [];
  }

  /** Live's transport, every few ms: tempo (bpm), playing (1/0), position (Max ticks) */
  function clock(tempo: number, state: number, ticks: number) {
    const beat = ticks / PPQ;
    if (!state || !active) {
      if (playing) {
        stopAll();
        io.ui('sf_pos', -1); // the editor's playhead goes away
      }
      playing = false;
      lastBeat = beat;
      return;
    }
    // a start, a loop back or a jump: begin again from here
    if (!playing || beat < lastBeat - 1e-3 || beat > handedTo + JUMP) {
      if (playing) stopAll();
      playing = true;
      handedTo = beat;
    }
    lastBeat = beat;
    const msPerBeat = 60000 / Math.max(1, tempo);
    const horizon = beat + LOOKAHEAD_MS / msPerBeat;
    if (horizon <= handedTo) return;
    const from = Math.round(handedTo * PPQ), to = Math.round(horizon * PPQ);
    const T = songLength();
    const out: { tick: number; order: number; bytes: number[] }[] = [];
    // note-offs owed in this stretch
    owed = owed.filter((o) => (o.tick < to ? (out.push({ tick: o.tick, order: 0, bytes: o.bytes }), false) : true));
    // from the pass before: its notes and their expression can ring on past its end
    for (let p = Math.max(0, Math.floor(handedTo / T) - 1); p * T < horizon; p++) {
      for (const e of pass(p)) {
        if (e.tick < from || e.tick >= to) continue;
        out.push(e);
        if (e.off !== undefined) {
          const offBytes = [0x80 | (e.bytes[0] & 0x0f), e.bytes[1], 0];
          if (e.off < to) out.push({ tick: e.off, order: 0, bytes: offBytes });
          else owed.push({ tick: e.off, bytes: offBytes });
        }
      }
    }
    out.sort((a, b) => a.tick - b.tick || a.order - b.order);
    for (const e of out) {
      const kind = e.bytes[0] & 0xf0;
      const key = `${e.bytes[0] & 0x0f}:${e.bytes[1]}`;
      if (kind === 0x90) sounding.set(key, [0x80 | (e.bytes[0] & 0x0f), e.bytes[1], 0]);
      else if (kind === 0x80) {
        sounding.delete(key);
        offsWaiting.push({ beat: e.tick / PPQ, bytes: e.bytes });
      }
      else if (kind === 0xe0) bent.add(e.bytes[0] & 0x0f);
      io.later(Math.max(0, (e.tick / PPQ - beat) * msPerBeat), pack(e.bytes));
    }
    handedTo = horizon;
    offsWaiting = offsWaiting.filter((o) => o.beat > beat - 1e-9);
    if (Math.round(beat * 8) !== Math.round(lastSent * 8)) {
      lastSent = beat;
      io.ui('sf_pos', Math.round(beat * 1000) / 1000);
    }
  }
  let lastSent = -1;

  /** the project changed: start the coming passes afresh (sent notes still get their offs) */
  function setProject(p: Project, persist = true) {
    project = normalizeProject(p);
    passes.clear();
    // re-render from where playback has got to, so the change is heard right away
    if (playing) handedTo = Math.max(lastBeat, handedTo - LOOKAHEAD_MS / 1000);
    io.status(describe());
    if (persist) {
      clearTimeout(storeTimer);
      storeTimer = setTimeout(() => io.store(JSON.stringify(project)), 1500) as unknown as number;
    }
  }

  function describe() {
    const n = audibleTracks(project.tracks).length;
    const which = only > 0 ? `channel ${only} of ${n}` : `${n} channel${n === 1 ? '' : 's'}`;
    return `${project.name || 'Untitled'} · ${which} · ${Math.round(songLength() * 100) / 100} beats`;
  }

  return {
    clock,
    setProject,
    /** the device was saved with a project: bring it back (no store — it came from the store) */
    restore(json: string) {
      try {
        setProject(JSON.parse(json) as Project, false);
      } catch {
        io.status('could not read the saved project — starting fresh');
      }
    },
    /** messages from the editor window */
    ui(cmd: string) {
      if (cmd === 'ready') {
        editorReady = true;
        io.writeShared(JSON.stringify(project));
        io.ui('sf_load', io.sharedName);
        if (pendingImport) handOver(pendingImport.kind, pendingImport.text), (pendingImport = null);
      } else if (cmd === 'changed') {
        const json = io.readShared();
        if (json) {
          try {
            setProject(JSON.parse(json) as Project);
          } catch {
            /* a half-written edit: the next one will do */
          }
        }
      }
    },
    /** the device's own controls */
    active(on: number) {
      active = !!on;
      if (!active && playing) stopAll();
    },
    channel(n: number) {
      only = Math.max(0, Math.round(n));
      passes.clear();
      if (playing) stopAll(), (handedTo = lastBeat);
      io.status(describe());
    },
    midi(m: number) {
      mode = m ? 'standard' : 'notes';
      passes.clear();
      if (playing) stopAll(), (handedTo = lastBeat);
    },
    /** load a math function straight from the device: 0 = keep, n = the nth (it becomes the device's channel) */
    fn(n: number) {
      const preset = MATH_PRESETS[n - 1];
      if (!preset) return;
      const track = fitToSong(trackFromPreset(preset, 0), project.song);
      setProject({ ...project, name: preset.name, tracks: [track] });
      io.writeShared(JSON.stringify(project));
      io.ui('sf_load', io.sharedName);
    },
    /**
     * A file from the device's Import… button: a SoundFunc functions file (into My functions, the
     * first one playing), a whole project, or math (LaTeX, Desmos, plain) for the Paste function sheet.
     */
    importText(text: string, filename = '') {
      let data: unknown = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* not JSON: math */
      }
      const d = data as { kind?: string; functions?: { name?: string; track?: Project['tracks'][number] }[]; tracks?: unknown; song?: unknown } | null;
      let kind: 'functions' | 'math' = 'math';
      if (d && d.kind === 'soundfunc-functions' && Array.isArray(d.functions)) {
        kind = 'functions';
        const first = d.functions.find((f) => f?.track?.graph);
        if (first?.track) {
          const name = first.name ?? 'Imported';
          const t = fitToSong({ ...trackFromTemplate(first.track, name, 0), name }, project.song);
          setProject({ ...project, name: first.name ?? project.name, tracks: [t] });
          io.writeShared(JSON.stringify(project));
          if (editorReady) io.ui('sf_load', io.sharedName);
        }
      } else if (d && Array.isArray(d.tracks) && d.song) {
        setProject(d as Project);
        io.writeShared(JSON.stringify(project));
        if (editorReady) io.ui('sf_load', io.sharedName);
        io.status(`Loaded ${filename.split(/[\\/:]/).pop() || 'the project'} · ${describe()}`);
        return;
      }
      // the editor shows it: open it if it isn't, and hand the import over once it's ready
      if (editorReady) handOver(kind, text);
      else pendingImport = { kind, text };
      io.ui('openeditor');
    },
    /** the editor window closed: imports wait for the next time it opens */
    editorClosed() {
      editorReady = false;
    },
    panic: stopAll,
    get project() {
      return project;
    },
    describe,
  };
}

export type Host = ReturnType<typeof createHost>;
