import { compileGraph, type Graph } from './graph';
import { parse, renameVariable, tryCompile, type Compiled } from './expr';
import { FIXED_LENGTHS, fixedLengthFor, type LengthMode } from './steps';
import type { DrumParams, SynthParams } from './synth';
import { chordTones, DEFAULT_PITCH_RANGE, limitPitch, midiToDegree, midiToFreq, midiToName, NOTE_NAMES, SCALES, valueToMidi, valueToPitch, type PitchMode, type PitchRange } from './music';

export type DrumVoice = 'kick' | 'snare' | 'hat' | 'openhat' | 'clap' | 'rim' | 'tom' | 'crash';
export type Waveform =
  | 'sine'
  | 'triangle'
  | 'square'
  | 'sawtooth'
  | 'bell'
  | 'pluck'
  | 'pad'
  | 'flute'
  | 'reese'
  | 'custom'
  | 'supersaw'
  | 'keys'
  | 'brass'
  | 'acid'
  | DrumVoice;

export const WAVEFORMS: Record<Exclude<Waveform, DrumVoice>, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  square: 'Square',
  sawtooth: 'Sawtooth',
  bell: 'Temple Bell',
  pluck: 'Koto Pluck',
  pad: 'Mist Pad',
  flute: 'Shakuhachi',
  reese: 'Reese Bass',
  supersaw: 'Supersaw',
  keys: 'E-Piano',
  brass: 'Brass',
  acid: 'Acid',
  custom: 'f(p) Custom',
};

/** Drum voices and their General MIDI percussion note. */
export const DRUMS: Record<DrumVoice, { label: string; gm: number }> = {
  kick: { label: 'Kick', gm: 36 },
  snare: { label: 'Snare', gm: 38 },
  hat: { label: 'Closed Hat', gm: 42 },
  openhat: { label: 'Open Hat', gm: 46 },
  clap: { label: 'Clap', gm: 39 },
  rim: { label: 'Rim', gm: 37 },
  tom: { label: 'Tom', gm: 45 },
  crash: { label: 'Crash', gm: 49 },
};

export const isDrum = (w: Waveform): w is DrumVoice => w in DRUMS;

export const voiceLabel = (w: Waveform) => (isDrum(w) ? DRUMS[w].label : WAVEFORMS[w]);

/** Waveforms that can hold one continuous, sliding voice. */
export const GLIDE_WAVEFORMS: Waveform[] = ['sine', 'triangle', 'square', 'sawtooth', 'pad', 'flute', 'reese', 'custom', 'supersaw', 'brass', 'acid'];

export type PlayMode = 'notes' | 'glide';

export interface Track {
  id: string;
  name: string;
  color: string;
  graph: Graph;
  steps: number;
  /** step length in beats (0.25 = sixteenth) */
  stepBeats: number;
  /**
   * time stretch: the channel's function keeps its shape (it reads the same n, x, t, k)
   * but plays out over stretch × as long — 2 = twice as long and slow, 0.5 = twice as fast
   */
  stretch: number;
  octave: number;
  pitchMode: PitchMode;
  waveform: Waveform;
  /** custom waveform: one cycle as f(p), p = 0 → 1 */
  timbre: string;
  volume: number;
  pan: number;
  attack: number;
  release: number;
  /** reverb send 0..1 */
  send: number;
  /** delay every other step by this fraction of a step */
  swing: number;
  /** notes = discrete steps; glide = one continuous voice following the curve */
  playMode: PlayMode;
  /** glide: snap the continuous pitch to the scale */
  quantize: boolean;
  /** glide: portamento time in seconds */
  glide: number;
  muted: boolean;
  solo: boolean;
  /** this channel's changes to its voice's sound (synth settings, or drum tone / decay / drive) — on top of the voice's patch */
  synth?: Partial<SynthParams> & Partial<DrumParams>;
  /** named constants this track's formulas read, Desmos-style — each track has its own */
  sliders: Slider[];
}

export const TRACK_DEFAULTS: Omit<Track, 'id' | 'name' | 'color' | 'graph'> = {
  steps: 16,
  stepBeats: 0.25,
  stretch: 1,
  octave: 4,
  pitchMode: 'degree',
  waveform: 'sine',
  timbre: 'sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)',
  sliders: [],
  volume: 0.8,
  pan: 0,
  attack: 0.01,
  release: 0.4,
  send: 1,
  swing: 0,
  playMode: 'notes',
  quantize: true,
  glide: 0.03,
  muted: false,
  solo: false,
};

export interface Song {
  bpm: number;
  root: number;
  scale: string;
  reverb: number;
  /** how many times the longest pattern repeats on MIDI export */
  exportLoops: number;
  /** chord progression: the chord's scale degree as a function of `bar` (and `k`) */
  harmony: string;
  /** keep the progression when mutating the whole garden */
  harmonyLocked?: boolean;
  /** where pitches may go: wrap by octaves (default), clamp, or off */
  pitchRange: PitchRange;
  /**
   * fixed: every track is exactly lengthBeats (4/8/16/32/64) long ·
   * free: each track loops on its own (steps × step length); the song is the longest
   */
  lengthMode: LengthMode;
  lengthBeats: number;
  /**
   * evolve: time keeps running from pass to pass — k, bar and the harmony move on ·
   * exact: every pass of the song starts the clock again, so it repeats note for note
   */
  repeat: RepeatMode;
  /** MIDI export of glides: simplified (fewest points that redraw the curve) or every sample */
  exportCurves: 'simple' | 'full';
  /** MIDI export: standard channels, or MPE — each note on its own channel with its own bend, pressure and slide */
  exportMidi: 'standard' | 'mpe';
  /**
   * pitch-bend range written into exports, in semitones: a MIDI file only carries −8192…8191,
   * the receiving instrument decides what that spans — so this must match its setting
   */
  bendRange: number;
  /** the same for MPE exports (MPE's default is 48) */
  mpeBendRange: number;
}

export type RepeatMode = 'evolve' | 'exact';

/** the length every track fills, or null when the song is free */
export const songGridLength = (song: Song): number | null => (song.lengthMode === 'free' ? null : song.lengthBeats);

export interface Slider {
  name: string;
  value: number;
  min: number;
  max: number;
}

export const sliderNames = (track: Track) => (track.sliders ?? []).map((s) => s.name);
export const sliderValues = (track: Track): Record<string, number> => Object.fromEntries((track.sliders ?? []).map((s) => [s.name, s.value]));

export const SONG_DEFAULTS: Song = { bpm: 90, root: 0, scale: 'major', reverb: 0.3, exportLoops: 4, harmony: '0', pitchRange: DEFAULT_PITCH_RANGE, lengthMode: 'fixed', lengthBeats: 16, repeat: 'evolve', exportCurves: 'simple', exportMidi: 'standard', bendRange: 24, mpeBendRange: 48 };
export const BEATS_PER_BAR = 4;

const harmonyCache = new Map<string, Compiled | null>();
function harmonyFn(src: string): Compiled | null {
  if (!harmonyCache.has(src)) {
    if (harmonyCache.size > 64) harmonyCache.clear();
    harmonyCache.set(src, tryCompile(src, HARMONY_VARS).fn);
  }
  return harmonyCache.get(src)!;
}

/** what the harmony formula can read — it belongs to the song, so no track's sliders */
export const HARMONY_VARS = ['bar', 'k', 'L', 'beat'] as const;

/** The chord (scale degree) sounding at an absolute beat of the song. */
export function harmonyAt(song: Song, beat: number): number {
  const fn = harmonyFn(song.harmony ?? '0');
  if (!fn) return 0;
  // chords can change on any beat: pick(floor(beat / 2), …) is two chords a bar
  const v = fn({ bar: Math.floor(beat / BEATS_PER_BAR + 1e-9), k: 0, L: scaleLength(song), beat: Math.floor(beat + 1e-9) });
  return Number.isFinite(v) ? Math.round(v) : 0;
}

export const scaleLength = (song: Song) => (SCALES[song.scale] ?? SCALES.major).steps.length;

export interface Project {
  name: string;
  song: Song;
  tracks: Track[];
}

/** Fill in fields added since a project was saved. */
export function normalizeProject(p: Project): Project {
  const { sliders: legacySliders, ...songIn } = (p.song ?? {}) as Partial<Song> & { sliders?: Slider[] };
  const song: Song = { ...SONG_DEFAULTS, ...songIn };
  // projects from before the song's length ruled every track: fixed when all tracks
  // already share one of the fixed lengths, otherwise free — so nothing gets cut
  const lengths = p.tracks.map((t) => (t.steps ?? 16) * (t.stepBeats ?? 0.25));
  if (!('lengthMode' in (p.song ?? {}))) {
    const same = lengths.length > 0 && lengths.every((l) => Math.abs(l - lengths[0]) < 1e-9) && (FIXED_LENGTHS as readonly number[]).some((f) => Math.abs(f - lengths[0]) < 1e-9);
    song.lengthMode = same ? 'fixed' : 'free';
    song.lengthBeats = same ? lengths[0] : fixedLengthFor(Math.max(1, ...lengths));
  }
  // the harmony could read the song's sliders; it keeps their values, written in
  if (legacySliders?.length) for (const sl of legacySliders) song.harmony = renameVariable(song.harmony, sl.name, sl.value < 0 ? `(${sl.value})` : String(sl.value));
  return {
    name: p.name ?? 'Untitled',
    song,
    tracks: p.tracks.map((t) => {
      // tracks used to carry their own loop length; the song's length rules now
      const { lengthMode: _m, lengthBeats: _l, ...rest } = t as Track & { lengthMode?: unknown; lengthBeats?: unknown };
      const track = { ...TRACK_DEFAULTS, ...rest };
      // the palette changed: an old colour becomes the new colour in the same place
      const old = LEGACY_COLORS.indexOf(String(track.color).toLowerCase());
      if (old >= 0) track.color = NEW_COLORS[old];
      // sliders used to belong to the whole song; each track now keeps the ones its formulas read
      if (legacySliders?.length && !t.sliders) {
        const used = formulaNames(track.graph);
        track.sliders = legacySliders.filter((sl) => used.has(sl.name)).map((sl) => ({ ...sl }));
      }
      return track;
    }),
  };
}

const LEGACY_COLORS = ['#c4583d', '#6f8a63', '#4a5d7e', '#b39561', '#8a6a7e', '#5e8a86', '#6f6a62'];
const NEW_COLORS = ['#e2483a', '#e8a93a', '#4fc98a', '#4f86d9', '#a865d6', '#3fb7b0', '#e07a3c'];

/** every name the track's formulas read */
export function formulaNames(graph: Graph): Set<string> {
  const used = new Set<string>();
  for (const n of graph.nodes) {
    if (n.type !== 'expr') continue;
    try {
      for (const v of parse(String(n.data.formula ?? '')).variables) used.add(v);
    } catch {
      /* an unfinished formula reads nothing */
    }
  }
  return used;
}

/** A generated note — everything needed for playback, visuals and export. */
export interface Note {
  step: number;
  loop: number;
  /** start time in beats from the start of the loop pass */
  beat: number;
  /** duration in beats */
  duration: number;
  midi: number;
  name: string;
  freq: number;
  velocity: number;
  /** raw value fed into the pitch input before mapping */
  raw: number;
  /** drums: tuning in semitones (from the pitch input) */
  tune: number;
  key: string;
  /** the song's chord (scale degree) when this note starts */
  h: number;
  /** per-note expression while it sounds (only when Note Out's bend / pressure / slide are wired) — shared by a chord's notes */
  expr?: NoteExpr;
}

/** a note's expression over its life: times in beats from the note's start */
export interface NoteExpr {
  at: number[];
  /** semitones */
  bend: number[];
  /** 0 → 1 */
  pressure: number[];
  /** 0 → 1 */
  slide: number[];
}

/** A finely sampled view of the function — drives glide voices and the x/y plot. */
export interface Curve {
  /** samples per step */
  res: number;
  beat: number[];
  /** continuous MIDI pitch (snapped if the track quantizes) */
  midi: number[];
  velocity: number[];
  raw: number[];
}

export interface TrackRender {
  notes: Note[];
  /** raw per-step pitch value, including rests */
  pitchCurve: number[];
  velocityCurve: number[];
  curve: Curve;
  /** per-node sparkline values */
  traces: Map<string, number[]>;
  errors: Map<string, string>;
  hasOutput: boolean;
}

export function keyLabel(song: Song): string {
  return `${NOTE_NAMES[song.root]} ${song.scale}`;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** samples per step: glide tracks are sampled finely enough for smooth bends */
export const curveRes = (track: Track) => (track.playMode === 'glide' ? 16 : Math.max(1, Math.min(16, Math.floor(1024 / track.steps))));

export function renderTrack(track: Track, song: Song, loop = 0, withTraces = true): TrackRender {
  const program = compileGraph(track.graph, sliderNames(track));
  const vars = sliderValues(track);
  const traces = withTraces ? new Map<string, number[]>() : undefined;
  const notes: Note[] = [];
  const pitchCurve: number[] = [];
  const velocityCurve: number[] = [];
  const key = keyLabel(song);
  const drum = isDrum(track.waveform) ? DRUMS[track.waveform] : null;
  const glide = track.playMode === 'glide' && !drum;
  let hasOutput = true;
  const L = scaleLength(song);
  const loopBeat = loop * patternBeats(track);
  /** a step's length in real beats — the grid's, stretched */
  const sb = track.stepBeats * stretchOf(track);
  /** clock for a (possibly fractional) step position u: the function's own time t, and the song's real beat */
  const clock = (u: number, np = 0) => {
    const t = u * track.stepBeats;
    const beat = loopBeat + u * sb;
    return { n: Math.floor(u), x: u / track.steps, t, k: loop, steps: track.steps, h: harmonyAt(song, beat), bar: Math.floor(beat / BEATS_PER_BAR + 1e-9), L, beat, vars, np };
  };
  const { expression } = program;
  const expressive = expression.bend || expression.pressure || expression.slide;
  /** sample a note's expression across its life: 16 times a step, np running 0 → 1 */
  const noteExpr = (u0: number, lenSteps: number): NoteExpr => {
    const count = Math.max(2, Math.min(256, Math.ceil(lenSteps * 16) + 1));
    const e: NoteExpr = { at: [], bend: [], pressure: [], slide: [] };
    for (let i = 0; i < count; i++) {
      // np runs 0 → 1 but never reaches it: shapes that repeat (fract) would wrap back to their start at the note's last instant
      const np = (i / (count - 1)) * (1 - 1e-9);
      const o = program.run(clock(u0 + np * lenSteps, np));
      if (!o) break;
      e.at.push(np * lenSteps * sb);
      e.bend.push(clamp(o.bend, -48, 48));
      e.pressure.push(clamp(o.pressure, 0, 1));
      e.slide.push(clamp(o.slide, 0, 1));
    }
    return e;
  };

  for (let n = 0; n < track.steps; n++) {
    const ctx = clock(n);
    const out = program.run(ctx, traces);
    if (!out) {
      hasOutput = false;
      break;
    }
    pitchCurve.push(out.pitch);
    const vel = clamp(out.velocity, 0, 1);
    velocityCurve.push(vel);
    if (vel < 0.01 || glide) continue;

    const range = song.pitchRange ?? DEFAULT_PITCH_RANGE;
    const rootMidi = drum ? drum.gm : limitPitch(valueToMidi(out.pitch, track.pitchMode, song.root, song.scale, track.octave, false), range);
    // chords: stack scale degrees on top of the pitch
    const size = drum ? 1 : clamp(Math.round(out.chord), 1, 8);
    const scale = (SCALES[song.scale] ?? SCALES.major).steps;
    const tones =
      size > 1
        ? chordTones(midiToDegree(rootMidi, song.root, scale, track.octave), size, out.stack, out.inversion, song.root, song.scale, track.octave).map((m) => limitPitch(m, range))
        : [rootMidi];
    const strum = clamp(out.strum, -0.5, 0.5);
    const tune = drum ? clamp(out.pitch, -24, 24) : 0;
    const ratchet = clamp(Math.round(out.ratchet), 1, 8);
    const shift = clamp(clamp(out.shift, 0, 0.95) + (n % 2 === 1 ? track.swing : 0), 0, 0.95);
    const len = clamp(out.length, 0.05, 64);
    for (let r = 0; r < ratchet; r++) {
      // one expression per strike, shared by the chord's notes
      const u0 = n + Math.min(0.97, shift) + r / ratchet;
      const expr = expressive ? noteExpr(u0, ratchet > 1 ? 0.9 / ratchet : Math.max(0.05, len)) : undefined;
      tones.forEach((midi, i) => {
        // negative strum rolls the chord downward
        const roll = (strum >= 0 ? i : tones.length - 1 - i) * Math.abs(strum);
        notes.push({
          step: n,
          loop,
          beat: (n + Math.min(0.97, shift + roll) + r / ratchet) * sb,
          duration: ratchet > 1 ? (sb / ratchet) * 0.9 : Math.max(0.05, len - roll) * sb,
          midi,
          name: drum ? drum.label : midiToName(midi),
          freq: midiToFreq(midi),
          velocity: (ratchet > 1 && r > 0 ? vel * (0.7 + (0.3 * r) / ratchet) : vel) * (i === 0 ? 1 : 0.85),
          raw: out.pitch,
          tune,
          key,
          h: ctx.h,
          expr,
        });
      });
    }
  }

  // continuous pass: n still ticks per step, but x and t flow between steps
  const res = hasOutput ? curveRes(track) : 1;
  const curve: Curve = { res, beat: [], midi: [], velocity: [], raw: [] };
  if (hasOutput) {
    for (let i = 0; i < track.steps * res; i++) {
      const u = i / res;
      // a glide is one long note: np is the phase within each step, and bend / pressure shape the slide itself
      const out = program.run(clock(u, u - Math.floor(u)))!;
      curve.beat.push(u * sb);
      curve.raw.push(out.pitch);
      curve.velocity.push(clamp(out.velocity, 0, 1) * (glide && expression.pressure ? clamp(out.pressure, 0, 1) : 1));
      curve.midi.push(
        drum
          ? drum.gm + clamp(out.pitch, -24, 24)
          : limitPitch(valueToPitch(out.pitch, track.pitchMode, song.root, song.scale, track.octave, !glide || track.quantize, false), song.pitchRange ?? DEFAULT_PITCH_RANGE) +
              (glide && expression.bend ? clamp(out.bend, -48, 48) : 0),
      );
    }
  }

  return { notes, pitchCurve, velocityCurve, curve, traces: traces ?? new Map(), errors: program.errors, hasOutput };
}

/** Bars until the progression repeats (1 for a drone), found by comparing the first 32 bars. */
export function harmonyCycleBars(song: Song): number {
  const at = (bar: number) => harmonyAt(song, bar * BEATS_PER_BAR);
  for (const p of [1, 2, 3, 4, 6, 8, 12, 16]) {
    let ok = true;
    for (let b = 0; b < 32 && ok; b++) ok = at(b) === at(b + p);
    if (ok) return p;
  }
  return 16;
}

/**
 * One full cycle of the song: its length — or, when the song is free, its longest
 * track. (The progression doesn't stretch it: it repeats, or keeps going, inside.)
 */
export function songBeats(tracks: Track[], song: Song): number {
  if (song.lengthMode !== 'free') return song.lengthBeats ?? 16;
  return Math.max(1, ...tracks.map(patternBeats));
}

/**
 * Split a stretch of play time [from, to) into pieces of song time: with `repeat: 'exact'`
 * each pass of the song starts again at 0; otherwise song time is play time.
 * `base` is where the piece's song time 0 sits in play time.
 */
export function songWindows(song: Song, songLength: number, from: number, to: number): { base: number; from: number; to: number }[] {
  if (song.repeat !== 'exact' || !(songLength > 0)) return [{ base: 0, from, to }];
  const out: { base: number; from: number; to: number }[] = [];
  for (let p = Math.floor(from / songLength + 1e-9); p * songLength < to - 1e-9; p++) {
    const base = p * songLength;
    out.push({ base, from: Math.max(0, from - base), to: Math.min(songLength, to - base) });
  }
  return out;
}

/** how long one pass of the channel lasts, in beats — its grid, stretched */
export function patternBeats(track: Track): number {
  return track.steps * track.stepBeats * stretchOf(track);
}

export const STRETCH_MIN = 1 / 16;
export const STRETCH_MAX = 16;
export const stretchOf = (track: Track) => {
  const s = track.stretch;
  return Number.isFinite(s) && s > 0 ? Math.min(STRETCH_MAX, Math.max(STRETCH_MIN, s)) : 1;
};

export function audibleTracks(tracks: Track[]): Track[] {
  const anySolo = tracks.some((t) => t.solo);
  return tracks.filter((t) => (anySolo ? t.solo : !t.muted));
}
