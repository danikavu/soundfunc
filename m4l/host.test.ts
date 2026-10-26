import { describe, expect, it } from 'vitest';
import { createHost, pack, unpack, type Io } from './host';
import { windowEvents, PPQ } from '../src/engine/midi';
import { audibleTracks, songBeats, type Project } from '../src/engine/project';
import { defaultProject, KITS, PRESETS, trackFromPreset, trackFromTemplate } from '../src/engine/presets';
import { fitToSong, kitSong } from '../src/engine/kits';

/** a pretend Max: records what the device sends and when it would come out of [pipe] */
function rig() {
  let nowMs = 0;
  const played: { ms: number; bytes: number[] }[] = [];
  let pending: { at: number; bytes: number[] }[] = [];
  const immediate: number[][] = [];
  let cancels = 0;
  let shared: string | null = null;
  const ui: (string | number)[][] = [];
  const io: Io = {
    later: (delay, code) => pending.push({ at: nowMs + delay, bytes: unpack(code) }),
    now: (bytes) => immediate.push(bytes),
    cancel: () => {
      cancels++;
      pending = [];
    },
    ui: (...a) => ui.push(a),
    store: () => {},
    status: () => {},
    readShared: () => shared,
    writeShared: (j) => (shared = j),
    sharedName: 'sf_test',
  };
  const host = createHost(io);
  /** run Live's transport: tempo, from beat a to b, reporting every `every` ms */
  const run = (tempo: number, a: number, b: number, every = 10) => {
    const msPerBeat = 60000 / tempo;
    for (let beat = a; beat < b; beat += every / msPerBeat) {
      host.clock(tempo, 1, beat * PPQ);
      nowMs += every;
      // [pipe] lets out whatever is due
      pending = pending.filter((p) => (p.at <= nowMs ? (played.push({ ms: p.at, bytes: p.bytes }), false) : true));
    }
  };
  const flush = () => {
    for (const p of pending) played.push({ ms: p.at, bytes: p.bytes });
    pending = [];
  };
  return { host, run, flush, played, immediate, ui, cancels: () => cancels, setShared: (j: string) => (shared = j), time: () => nowMs };
}

const kit = (id: string): Project => {
  const k = KITS.find((x) => x.id === id)!;
  const tracks = k.tracks.map((t, i) => trackFromTemplate(t, t.name, i));
  const song = kitSong(k, tracks, defaultProject().song);
  return { name: k.name, song, tracks: tracks.map((t) => fitToSong(t, song)) };
};

describe('Max for Live device', () => {
  it('packs MIDI bytes into one number for [pipe] and back', () => {
    for (const b of [[0x90, 60, 100], [0x80, 60, 0], [0xe3, 0, 64], [0xd2, 77], [0xb0, 74, 127]]) expect(unpack(pack(b))).toEqual(b);
  });

  it('plays exactly what the MIDI file holds — same events on the same ticks, pass after pass', () => {
    // a kit, plus a glide and per-note bends so automation is in the mix too
    const p = kit('funk');
    p.tracks.push(fitToSong(trackFromPreset(PRESETS.find((x) => x.id === 'riser')!, 7), p.song), fitToSong(trackFromPreset(PRESETS.find((x) => x.id === 'scooplead')!, 8), p.song));
    const r = rig();
    r.host.setProject(p, false);
    const tempo = 104;
    const T = songBeats(audibleTracks(r.host.project.tracks), r.host.project.song);
    r.run(tempo, 0, T * 2 + 0.5);
    r.flush();
    const msPerBeat = 60000 / tempo;
    const got = r.played
      .map((e) => ({ tick: Math.round((e.ms / msPerBeat) * PPQ), bytes: e.bytes }))
      .filter((e) => e.tick < Math.round(2 * T * PPQ) && (e.bytes[0] & 0xf0) !== 0x80);
    const want = [0, 1]
      .flatMap((pass) => windowEvents(r.host.project, 'standard', pass * T, (pass + 1) * T, undefined, false).flatMap((c) => c.events))
      .filter((e) => e.tick < Math.round(2 * T * PPQ) && (e.bytes[0] & 0xf0) !== 0xc0 && (e.bytes[0] & 0xf0) !== 0x80 && !((e.bytes[0] & 0xf0) === 0x90 && e.bytes[2] === 0));
    const key = (e: { tick: number; bytes: number[] }) => `${e.tick}|${e.bytes.join(',')}`;
    const near = (set: Set<string>, e: { tick: number; bytes: number[] }) => [-1, 0, 1].some((d) => set.has(key({ tick: e.tick + d, bytes: e.bytes })));
    const gotSet = new Set(got.map(key));
    const missing = want.filter((e) => !near(gotSet, e));
    expect(missing.slice(0, 5)).toEqual([]);
    expect(got.length).toBeGreaterThanOrEqual(want.length * 0.99);
    expect(got.filter((e) => (e.bytes[0] & 0xf0) === 0x90).length).toBe(want.filter((e) => (e.bytes[0] & 0xf0) === 0x90).length);
  });

  it('never leaves a note hanging — even when the project changes while it plays', () => {
    const r = rig();
    r.host.setProject(kit('disco'), false);
    r.run(120, 0, 5.3);
    r.host.setProject(kit('bossa'), false); // a different song, mid-bar
    r.run(120, 5.3, 12);
    r.flush();
    r.host.clock(120, 0, 12 * PPQ); // and Live stops
    const open = new Map<string, number>();
    for (const e of [...r.played, ...r.immediate.map((bytes) => ({ ms: Infinity, bytes }))]) {
      const kind = e.bytes[0] & 0xf0, k = `${e.bytes[0] & 15}:${e.bytes[1]}`;
      if (kind === 0x90 && e.bytes[2] > 0) open.set(k, (open.get(k) ?? 0) + 1);
      if (kind === 0x80 || (kind === 0x90 && e.bytes[2] === 0)) open.set(k, (open.get(k) ?? 0) - 1);
    }
    expect([...open.entries()].filter(([, v]) => v > 0)).toEqual([]);
  });

  it('stopping and jumping clean up: pending events cancelled, sounding notes ended', () => {
    const r = rig();
    r.host.setProject(kit('deephouse'), false);
    r.run(122, 0, 3.97);
    r.host.clock(122, 0, 4 * PPQ); // Live stops
    expect(r.cancels()).toBe(1);
    expect(r.immediate.some((b) => (b[0] & 0xf0) === 0x80)).toBe(true);
    r.run(122, 8, 9); // starts again elsewhere
    const before = r.cancels();
    r.run(122, 2, 2.5); // loops back
    expect(r.cancels()).toBe(before + 1);
  });

  it('one channel alone comes out on MIDI channel 1', () => {
    const r = rig();
    r.host.setProject(kit('jazz'), false);
    r.host.channel(5); // the walking bass
    r.run(132, 0, 8);
    r.flush();
    const ons = r.played.filter((e) => (e.bytes[0] & 0xf0) === 0x90);
    expect(ons.length).toBeGreaterThan(4);
    expect(new Set(ons.map((e) => e.bytes[0] & 15))).toEqual(new Set([0]));
  });

  it('talks to the editor: hands over the project, takes back changes', () => {
    const r = rig();
    r.host.setProject(kit('salsa'), false);
    r.host.ui('ready');
    expect(r.ui.at(-1)).toEqual(['sf_load', 'sf_test']);
    const edited = { ...r.host.project, song: { ...r.host.project.song, bpm: 101 } };
    r.setShared(JSON.stringify(edited));
    r.host.ui('changed');
    expect(r.host.project.song.bpm).toBe(101);
  });
});
