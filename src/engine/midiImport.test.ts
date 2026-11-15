import { describe, expect, it } from 'vitest';
import { exportMidi } from './midi';
import { IMPORT_DEFAULTS, fourierFit, midiToFunctions, parseMidi, type ImportOptions } from './midiImport';
import { KITS, defaultProject, trackFromTemplate } from './presets';
import { isDrum, patternBeats, renderTrack, DRUMS, type Project, type Track, type Waveform } from './project';

/** a kit exported to MIDI the way the app writes it: one pass */
function kitMidi(id: string, loops = 1) {
  const kit = KITS.find((k) => k.id === id)!;
  const song = { ...defaultProject().song, ...kit.song, exportLoops: loops };
  const project: Project = { name: kit.name, song, tracks: kit.tracks.map((t, i) => trackFromTemplate(t, t.name, i)) };
  return exportMidi(project, undefined, 'notes');
}

/** every note the imported channels play over the file's length, as the engine renders them */
function rendered(bytes: Uint8Array, extra: Partial<ImportOptions> = {}) {
  const file = parseMidi(bytes);
  const r = midiToFunctions(file, { ...IMPORT_DEFAULTS, feel: 'exact', ...extra });
  const song = { ...defaultProject().song, ...r.song };
  const total = r.report.bars * 4;
  const out: { beat: number; midi: number; vel: number; who: string }[] = [];
  const errors: string[] = [];
  r.channels.forEach((c, i) => {
    const t = trackFromTemplate(c.template, c.template.name, i) as Track;
    const len = patternBeats(t);
    for (let k = 0; k * len < total - 1e-9; k++) {
      const res = renderTrack(t, song, k, false);
      for (const e of res.errors.values()) errors.push(`${c.template.name}: ${e}`);
      for (const n of res.notes) if (k * len + n.beat < total - 1e-9) out.push({ beat: k * len + n.beat, midi: n.midi, vel: n.velocity, who: c.template.name });
    }
  });
  const want = file.parts.flatMap((p) => p.notes.map((n) => ({ beat: n.beat, midi: n.midi, vel: n.vel / 127 })));
  return { file, r, out, want, errors };
}

const sortNotes = <T extends { beat: number; midi: number }>(xs: T[]) => xs.slice().sort((a, b) => a.beat - b.beat || a.midi - b.midi);

describe('MIDI → functions', () => {
  it('reads a file: tempo, key signature, running status, note-on with velocity 0 as a note-off', () => {
    // one track: tempo 100, key of E♭ (−3 flats), C4 for a beat (running status, the off as on-with-0), then E4
    const ev = [
      0x00, 0xff, 0x51, 0x03, 0x09, 0x27, 0xc0, // 600 000 µs = 100 bpm
      0x00, 0xff, 0x59, 0x02, 0xfd, 0x00,
      0x00, 0x90, 60, 100,
      0x83, 0x60, 60, 0, // +480 ticks, running status, velocity 0
      0x00, 64, 90,
      0x83, 0x60, 0x80, 64, 0,
      0x00, 0xff, 0x2f, 0x00,
    ];
    const bytes = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, ev.length, ...ev]);
    const f = parseMidi(bytes);
    expect(f.bpm).toBe(100);
    expect(f.keySig).toEqual({ sf: -3, minor: false });
    expect(f.parts).toHaveLength(1);
    expect(f.parts[0].notes.map((n) => [n.beat, n.end, n.midi, n.vel])).toEqual([
      [0, 1, 60, 100],
      [1, 2, 64, 90],
    ]);
  });

  it('refuses what isn’t a MIDI file', () => {
    expect(() => parseMidi(new TextEncoder().encode('hello'))).toThrow(/Not a MIDI file/);
  });

  for (const id of ['afterhours', 'sundaypocket', 'dustyfingers', 'aguadecoco', 'cruisecontrol', 'fogline', 'liquidhour']) {
    it(`round-trips the ${id} kit: export it as MIDI, import it back, and every note comes back`, () => {
      const { out, want, errors } = rendered(kitMidi(id));
      expect(errors, id).toEqual([]);
      const got = sortNotes(out), exp = sortNotes(want);
      expect(got.length, `${id}: note count`).toBe(exp.length);
      // match each wanted note to a played one: same pitch, the same moment, the same strength
      const pool = got.slice();
      const misses: string[] = [];
      for (const w of exp) {
        const i = pool.findIndex((g) => g.midi === w.midi && Math.abs(g.beat - w.beat) < 0.02 && Math.abs(g.vel - w.vel) < 0.04);
        if (i < 0) misses.push(`${w.midi} @ ${w.beat.toFixed(3)} v${w.vel.toFixed(2)}`);
        else pool.splice(i, 1);
      }
      expect(misses.slice(0, 8), `${id}: ${misses.length} notes missing`).toEqual([]);
    });
  }

  it('finds the key, the chords and writes compact functions', () => {
    // two passes: the kit's channels are two bars, its progression four
    const { r } = rendered(kitMidi('afterhours', 2));
    expect(r.report.keyName).toBe('A Minor');
    // the kit's own progression, Am9–Fmaj9–G9–Em9 (i–VI–VII–v)
    expect(r.song.harmony).toBe('pick(bar, 0, 5, 6, 4)');
    const kick = r.channels.find((c) => c.template.name === 'Kick')!;
    expect(kick.steps).toBeLessThanOrEqual(16); // four on the floor, one bar at most — as every(n, 4)
    expect(kick.formulas.velocity).toMatch(/every\(n, 4\)/);
    // the organ stabs come back as one chord channel, not five lines
    expect(r.channels.some((c) => c.kind === 'chords')).toBe(true);
    for (const c of r.channels) for (const f of Object.values(c.formulas)) expect(f.length, `${c.template.name}: ${f}`).toBeLessThan(600);
  });

  it('maps GM drums onto the drum voices', () => {
    const { r } = rendered(kitMidi('dustyfingers'));
    const drums = r.channels.filter((c) => c.kind === 'drums').map((c) => c.template.waveform as Waveform);
    expect(drums.every((w) => isDrum(w))).toBe(true);
    expect(new Set(drums)).toEqual(new Set(['kick', 'snare', 'rim', 'hat', 'openhat']));
    expect(DRUMS.kick.gm).toBe(36);
  });

  it('without the feel: on the grid, dynamics tidied into a few levels — short formulas', () => {
    const r = midiToFunctions(parseMidi(kitMidi('afterhours', 2)), { ...IMPORT_DEFAULTS, feel: 'grid' });
    for (const c of r.channels) {
      expect(c.formulas.shift, c.template.name).toBeUndefined();
      expect(c.template.swing ?? 0, c.template.name).toBe(0);
    }
    // the clap: one level on 2 and 4 — a function, not a list
    expect(r.channels.find((c) => c.template.name === 'Clap')!.formulas.velocity).toMatch(/every\(n, 8, 4\)/);
  });

  it('notes outside the key: every one exact on the chromatic scale, or snapped into the key if asked', () => {
    // C major with a blue note: E♭ against E
    const notes = [60, 62, 63, 64, 65, 67, 69, 71, 72].map((midi, i) => ({ beat: i * 0.5, end: i * 0.5 + 0.45, midi, vel: 100 }));
    const file = { name: 'blue', bpm: 100, tempoChanges: 1, timeSig: [4, 4] as [number, number], keySig: null, parts: [{ name: 'Lead', channel: 0, program: 0, notes }] };
    const exact = midiToFunctions(file, IMPORT_DEFAULTS);
    expect(exact.song.scale).toBe('chromatic');
    const song = { ...defaultProject().song, ...exact.song };
    const t = trackFromTemplate(exact.channels[0].template, 'Lead', 0) as Track;
    expect(renderTrack(t, song, 0, false).notes.map((n) => n.midi)).toEqual(notes.map((n) => n.midi));
    const snapped = midiToFunctions(file, { ...IMPORT_DEFAULTS, exact: false });
    expect(snapped.song.scale).toBe('major');
    expect(snapped.report.snapped).toBeGreaterThan(0);
  });

  it('Functions: the feel as functions — short loops, no long lists, the same music to within its humanising', () => {
    for (const id of ['sundaypocket', 'dustyfingers', 'afterhours']) {
      const file = parseMidi(kitMidi(id, 4));
      const r = midiToFunctions(file, IMPORT_DEFAULTS);
      expect(IMPORT_DEFAULTS.feel).toBe('functions');
      const song = { ...defaultProject().song, ...r.song };
      let played = 0;
      r.channels.forEach((c, i) => {
        expect(c.steps, `${id}/${c.template.name}: a short loop`).toBeLessThanOrEqual(64);
        const t = trackFromTemplate(c.template, c.template.name, i) as Track;
        const len = patternBeats(t);
        for (let k = 0; k * len < r.report.bars * 4 - 1e-9; k++) {
          const res = renderTrack(t, song, k, false);
          expect([...res.errors.values()], `${id}/${c.template.name}`).toEqual([]);
          played += res.notes.length;
        }
      });
      const want = file.parts.reduce((a, p) => a + p.notes.length, 0);
      expect(Math.abs(played - want) / want, `${id}: ${played} played for ${want} in the file`).toBeLessThan(0.2);
    }
  });

  it('a range of bars: only those, moved to the start, the loop as long as the range', () => {
    const file = parseMidi(kitMidi('afterhours', 2)); // four bars
    const r = midiToFunctions(file, { ...IMPORT_DEFAULTS, feel: 'exact', from: 2, to: 4 });
    expect(r.report.from).toBe(2);
    expect(r.report.bars).toBe(2);
    expect(r.report.fileBars).toBe(4);
    // bars 3–4 of the progression: VII then v
    expect(r.song.harmony).toBe('pick(bar, 6, 4)');
  });

  it('Math: pitch as a sum of sines — the right harmonics, few of them, every note exact', () => {
    // a line rocking between two notes on every fourth step is one sine, at the 4th harmonic
    const at = Array.from({ length: 32 }, (_, i) => i % 4 === 0);
    const rock = Array.from({ length: 32 }, (_, i) => (Math.floor(i / 4) % 2 ? 4 : 0));
    expect(fourierFit(rock, at, 'exact')).toEqual({ formula: '2 + 2 * sin(4 * tau * x - 1.57)', matched: 1, terms: 1 });
    // a melody that rises and falls once: one sine, exact
    const arc = Array.from({ length: 32 }, (_, i) => 3 * Math.sin((2 * Math.PI * i) / 32));
    expect(fourierFit(arc, at, 'exact')!.terms).toBe(1);
    // asked for one term where the line needs more: one term, as close as it gets, and says how close
    const busy = arc.map((v, i) => v + (i % 8 === 4 ? 3 : 0));
    const one = fourierFit(busy, at, 1)!;
    expect(one.terms).toBe(1);
    expect(one.matched).toBeLessThan(1);
    expect(fourierFit(busy, at, 'exact')!.matched).toBe(1);
  });

  for (const id of ['cruisecontrol', 'aguadecoco', 'fogline', 'dustyfingers']) {
    it(`Math round-trips the ${id} kit: every line a sum of sines, every note back`, () => {
      const { r, out, want } = rendered(kitMidi(id), { math: { terms: 'exact', glide: false } });
      const lines = r.channels.filter((c) => c.kind === 'melody' || c.kind === 'voice');
      expect(lines.length).toBeGreaterThan(0);
      for (const c of lines) {
        expect(c.formulas.pitch, `${id}/${c.template.name}`).not.toMatch(/pick\(/);
        expect(c.match, `${id}/${c.template.name}`).toBe(1);
      }
      const pool = sortNotes(out);
      const misses = sortNotes(want).filter((w) => {
        const i = pool.findIndex((g) => g.midi === w.midi && Math.abs(g.beat - w.beat) < 0.02);
        if (i >= 0) pool.splice(i, 1);
        return i < 0;
      });
      expect(misses.length, `${id}: notes missing`).toBe(0);
    });
  }

  it('Math with a glide line: the line passes through every note, as a glide', () => {
    const file = parseMidi(kitMidi('fogline'));
    const r = midiToFunctions(file, { ...IMPORT_DEFAULTS, feel: 'exact', math: { terms: 'exact', glide: true } });
    const song = { ...defaultProject().song, ...r.song };
    const violin = r.channels.find((c) => c.template.name === 'Violin')!;
    expect(violin.template.playMode).toBe('glide');
    const t = trackFromTemplate(violin.template, 'Violin', 0) as Track;
    const res = renderTrack(t, song, 0, false);
    expect([...res.errors.values()]).toEqual([]);
    const notes = file.parts.find((p) => p.name.includes('Violin'))!.notes;
    for (const n of notes) {
      const i = res.curve.beat.findIndex((b) => b >= n.beat - 1e-9);
      expect(Math.round(res.curve.midi[i]), `at beat ${n.beat}`).toBe(n.midi);
    }
  });

  it('Smart chords: one chord channel where the old way split everything — and every note still exact', () => {
    // C major piano: triads, one with its root doubled an octave up, a C add9, a G7, and a chromatic
    // passing note (E♭) in the top voice — the old way: the key goes chromatic and every voice splits
    const n = (beat: number, midi: number) => ({ beat, end: beat + 0.9, midi, vel: 90 });
    const notes = [
      ...[60, 64, 67].map((m) => n(0, m)),
      ...[60, 64, 67, 72].map((m) => n(1, m)), // doubled root
      ...[60, 64, 67, 74].map((m) => n(2, m)), // add9
      ...[55, 59, 62, 65].map((m) => n(3, m)), // G7
      ...[57, 60, 64].map((m) => n(4, m)),
      n(4.5, 63), // E♭: a stray
      ...[53, 57, 60].map((m) => n(5, m)),
      ...[55, 59, 62].map((m) => n(6, m)),
      ...[60, 64, 67].map((m) => n(7, m)),
    ];
    const file = { name: 'piano', bpm: 100, tempoChanges: 1, timeSig: [4, 4] as [number, number], keySig: null, parts: [{ name: 'Piano', channel: 0, program: 0, notes }] };
    const old = midiToFunctions(file, { ...IMPORT_DEFAULTS, feel: 'exact' });
    expect(old.song.scale).toBe('chromatic');
    expect(old.channels.length).toBeGreaterThan(2);

    const smart = midiToFunctions(file, { ...IMPORT_DEFAULTS, feel: 'exact', smartChords: true });
    expect(smart.song.scale).toBe('major');
    expect(smart.channels[0].kind).toBe('chords');
    expect(smart.channels[0].template.name).toBe('Piano');
    // only the doubled C, the 9th and the E♭ are left over: one small extra line
    expect(smart.channels).toHaveLength(2);
    expect(smart.report.extraNotes).toBe(3);
    expect(smart.channels[1].formulas.bend).toBeDefined();

    // every note comes back, the stray through its bend
    const song = { ...defaultProject().song, ...smart.song };
    const got: [number, number][] = [];
    smart.channels.forEach((c, i) => {
      const t = trackFromTemplate(c.template, c.template.name, i) as Track;
      for (const x of renderTrack(t, song, 0, false).notes) got.push([Math.round(x.beat * 100) / 100, x.midi + Math.round(x.expr?.bend[0] ?? 0)]);
    });
    const want = notes.map((x) => [x.beat, x.midi] as [number, number]);
    const key = (xs: [number, number][]) => xs.map(([b, m]) => `${b}:${m}`).sort();
    expect(key(got)).toEqual(key(want));
  });

  for (const id of ['sundaypocket', 'afterhours', 'aguadecoco']) {
    it(`Smart chords round-trips the ${id} kit note for note`, () => {
      const { out, want, errors } = rendered(kitMidi(id), { smartChords: true });
      expect(errors).toEqual([]);
      expect(out.length, id).toBe(want.length);
    });
  }
});

