export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type ScaleGroup = 'none' | 'western' | 'modes' | 'japanese' | 'world' | 'symmetric';

export const SCALE_GROUPS: Record<ScaleGroup, string> = {
  none: 'No scale',
  western: 'Major, minor & pentatonic',
  modes: 'Modes',
  japanese: 'Japanese',
  world: 'From around the world',
  symmetric: 'Symmetric',
};

export const SCALES: Record<string, { label: string; steps: number[]; group: ScaleGroup; hint?: string }> = {
  chromatic: { label: 'None', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], group: 'none', hint: 'every semitone — degrees are semitones' },

  major: { label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11], group: 'western' },
  minor: { label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10], group: 'western' },
  harmonicMinor: { label: 'Harmonic Minor', steps: [0, 2, 3, 5, 7, 8, 11], group: 'western' },
  melodicMinor: { label: 'Melodic Minor', steps: [0, 2, 3, 5, 7, 9, 11], group: 'western' },
  harmonicMajor: { label: 'Harmonic Major', steps: [0, 2, 4, 5, 7, 8, 11], group: 'western' },
  pentatonic: { label: 'Pentatonic', steps: [0, 2, 4, 7, 9], group: 'western' },
  minorPentatonic: { label: 'Minor Pentatonic', steps: [0, 3, 5, 7, 10], group: 'western' },
  blues: { label: 'Blues', steps: [0, 3, 5, 6, 7, 10], group: 'western' },
  majorBlues: { label: 'Major Blues', steps: [0, 2, 3, 4, 7, 9], group: 'western' },
  bebopDominant: { label: 'Bebop Dominant', steps: [0, 2, 4, 5, 7, 9, 10, 11], group: 'western' },
  bebopMajor: { label: 'Bebop Major', steps: [0, 2, 4, 5, 7, 8, 9, 11], group: 'western' },

  dorian: { label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], group: 'modes' },
  phrygian: { label: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], group: 'modes' },
  lydian: { label: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], group: 'modes' },
  mixolydian: { label: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], group: 'modes' },
  locrian: { label: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10], group: 'modes' },
  phrygianDominant: { label: 'Phrygian Dominant', steps: [0, 1, 4, 5, 7, 8, 10], group: 'modes', hint: 'maqam Hijaz · Freygish' },
  lydianDominant: { label: 'Lydian Dominant', steps: [0, 2, 4, 6, 7, 9, 10], group: 'modes' },
  dorianSharp4: { label: 'Dorian ♯4', steps: [0, 2, 3, 6, 7, 9, 10], group: 'modes' },
  superLocrian: { label: 'Altered', steps: [0, 1, 3, 4, 6, 8, 10], group: 'modes', hint: 'super-Locrian' },

  hirajoshi: { label: 'Hirajōshi', steps: [0, 2, 3, 7, 8], group: 'japanese' },
  inSen: { label: 'In Sen', steps: [0, 1, 5, 7, 10], group: 'japanese' },
  iwato: { label: 'Iwato', steps: [0, 1, 5, 6, 10], group: 'japanese' },
  yo: { label: 'Yo', steps: [0, 2, 5, 7, 9], group: 'japanese', hint: 'also Javanese sléndro' },
  kumoi: { label: 'Kumoi', steps: [0, 2, 3, 7, 9], group: 'japanese' },
  ryukyu: { label: 'Ryūkyū', steps: [0, 4, 5, 7, 11], group: 'japanese', hint: 'Okinawan' },
  miyakoBushi: { label: 'Miyako-bushi', steps: [0, 1, 5, 7, 8], group: 'japanese' },

  doubleHarmonic: { label: 'Double Harmonic', steps: [0, 1, 4, 5, 7, 8, 11], group: 'world', hint: 'Byzantine · raga Bhairav · maqam Hijaz Kar' },
  hungarianMinor: { label: 'Hungarian Minor', steps: [0, 2, 3, 6, 7, 8, 11], group: 'world' },
  neapolitanMinor: { label: 'Neapolitan Minor', steps: [0, 1, 3, 5, 7, 8, 11], group: 'world' },
  persian: { label: 'Persian', steps: [0, 1, 4, 5, 6, 8, 11], group: 'world' },
  egyptian: { label: 'Egyptian', steps: [0, 2, 5, 7, 10], group: 'world' },
  pelog: { label: 'Pélog', steps: [0, 1, 3, 7, 8], group: 'world', hint: 'Balinese gamelan (12-tone)' },
  todi: { label: 'Todi', steps: [0, 1, 3, 6, 7, 8, 11], group: 'world', hint: 'Indian raga' },
  chinese: { label: 'Chinese', steps: [0, 4, 6, 7, 11], group: 'world' },
  enigmatic: { label: 'Enigmatic', steps: [0, 1, 4, 6, 8, 10, 11], group: 'world', hint: 'Verdi' },
  prometheus: { label: 'Prometheus', steps: [0, 2, 4, 6, 9, 10], group: 'world', hint: 'Scriabin' },

  wholeTone: { label: 'Whole Tone', steps: [0, 2, 4, 6, 8, 10], group: 'symmetric' },
  octatonic: { label: 'Octatonic (half–whole)', steps: [0, 1, 3, 4, 6, 7, 9, 10], group: 'symmetric', hint: 'diminished' },
  octatonicWH: { label: 'Octatonic (whole–half)', steps: [0, 2, 3, 5, 6, 8, 9, 11], group: 'symmetric' },
  augmented: { label: 'Augmented', steps: [0, 3, 4, 7, 8, 11], group: 'symmetric' },
  tritone: { label: 'Tritone', steps: [0, 1, 4, 6, 7, 10], group: 'symmetric' },
  fifths: { label: 'Fifths only', steps: [0, 7], group: 'symmetric', hint: 'root and fifth — power chords' },
};

export type PitchMode = 'degree' | 'semitone' | 'normalized';

export const PITCH_MODES: Record<PitchMode, string> = {
  degree: 'Scale degree (0, 1, 2…)',
  semitone: 'Semitones from root',
  normalized: 'Range −1…1 → 2 octaves',
};

/** Convert a scale degree (any integer, negative allowed) to a MIDI note. */
export function degreeToMidi(degree: number, root: number, scale: number[], octave: number): number {
  const d = Math.round(degree);
  const len = scale.length;
  const oct = Math.floor(d / len);
  const idx = ((d % len) + len) % len;
  return 12 * (octave + 1) + root + oct * 12 + scale[idx];
}

/** Snap a MIDI note number to the nearest note in the scale. */
export function snapToScale(midi: number, root: number, scale: number[]): number {
  const m = Math.round(midi);
  for (let off = 0; off < 12; off++) {
    for (const cand of [m - off, m + off]) {
      const pc = (((cand - root) % 12) + 12) % 12;
      if (scale.includes(pc)) return cand;
    }
  }
  return m;
}

export function valueToMidi(
  value: number,
  mode: PitchMode,
  root: number,
  scaleKey: string,
  octave: number,
  /** false: leave the result outside 0…127 so a pitch range can fold it back by octaves */
  clampToMidi = true,
): number {
  const scale = (SCALES[scaleKey] ?? SCALES.major).steps;
  let midi: number;
  if (mode === 'degree') {
    midi = degreeToMidi(value, root, scale, octave);
  } else if (mode === 'semitone') {
    midi = snapToScale(12 * (octave + 1) + root + value, root, scale);
  } else {
    // -1..1 maps to ± one octave worth of scale degrees
    midi = degreeToMidi(value * scale.length, root, scale, octave);
  }
  return clampToMidi ? Math.max(0, Math.min(127, midi)) : midi;
}

/**
 * Continuous version for glide tracks: fractional values slide smoothly between
 * scale notes instead of snapping. With `quantize` it snaps like valueToMidi.
 */
export function valueToPitch(
  value: number,
  mode: PitchMode,
  root: number,
  scaleKey: string,
  octave: number,
  quantize: boolean,
  clampToMidi = true,
): number {
  if (quantize) return valueToMidi(value, mode, root, scaleKey, octave, clampToMidi);
  const scale = (SCALES[scaleKey] ?? SCALES.major).steps;
  let midi: number;
  if (mode === 'semitone') {
    midi = 12 * (octave + 1) + root + value;
  } else {
    const d = mode === 'degree' ? value : value * scale.length;
    const lo = Math.floor(d);
    const a = degreeToMidi(lo, root, scale, octave);
    const b = degreeToMidi(lo + 1, root, scale, octave);
    midi = a + (b - a) * (d - lo);
  }
  return clampToMidi ? Math.max(0, Math.min(127, midi)) : midi;
}

// ---------- pitch range ----------

export type RangeMode = 'wrap' | 'clamp' | 'off';

export interface PitchRange {
  mode: RangeMode;
  /** lowest and highest MIDI note */
  low: number;
  high: number;
}

export const DEFAULT_PITCH_RANGE: PitchRange = { mode: 'wrap', low: 24, high: 96 };

export const RANGE_PRESETS: { label: string; low: number; high: number }[] = [
  { label: 'Comfortable', low: 24, high: 96 },
  { label: 'Piano', low: 21, high: 108 },
  { label: 'Bass', low: 24, high: 60 },
  { label: 'Voice', low: 48, high: 84 },
  { label: 'Bright', low: 60, high: 96 },
];

/**
 * Keep a pitch inside the range: 'wrap' moves it by whole octaves (it keeps its
 * note name), 'clamp' pins it to the nearest edge. Always ends inside MIDI 0…127.
 */
export function limitPitch(midi: number, range: PitchRange | undefined): number {
  let m = midi;
  if (range && range.mode !== 'off' && range.high > range.low) {
    const { low, high } = range;
    if (range.mode === 'clamp' || high - low < 12) m = Math.min(high, Math.max(low, m));
    else {
      if (m < low) m += 12 * Math.ceil((low - m) / 12);
      if (m > high) m -= 12 * Math.ceil((m - high) / 12);
    }
  }
  return Math.max(0, Math.min(127, m));
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

// ---------- chords ----------

/** Inverse of degreeToMidi: the (nearest) scale degree of a MIDI note. */
export function midiToDegree(midi: number, root: number, scale: number[], octave: number): number {
  const snapped = snapToScale(midi, root, scale);
  const rel = snapped - 12 * (octave + 1) - root;
  const oct = Math.floor(rel / 12);
  const idx = Math.max(0, scale.indexOf(((rel % 12) + 12) % 12));
  return oct * scale.length + idx;
}

/**
 * Build a chord from scale degrees: `size` tones stacked every `stack` degrees
 * (2 = thirds → triads/7ths/9ths, 3 = fourths → quartal, 1 = clusters, 4 = fifths).
 * Each inversion lifts the lowest tone an octave.
 */
export function chordTones(
  rootDegree: number,
  size: number,
  stack: number,
  inversion: number,
  root: number,
  scaleKey: string,
  octave: number,
): number[] {
  const scale = (SCALES[scaleKey] ?? SCALES.major).steps;
  size = Math.max(1, Math.min(8, Math.round(size)));
  stack = Math.max(1, Math.min(7, Math.round(stack)));
  const tones: number[] = [];
  for (let i = 0; i < size; i++) tones.push(degreeToMidi(Math.round(rootDegree) + i * stack, root, scale, octave));
  const inv = ((Math.round(inversion) % size) + size) % size;
  for (let i = 0; i < inv; i++) tones.push(tones.shift()! + 12);
  return tones.map((m) => Math.max(0, Math.min(127, m)));
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** Name of the chord built on a scale degree — "Dm", "F", "B°", "Cmaj7" — plus its roman numeral. */
export function chordName(degree: number, root: number, scaleKey: string, size = 3): { name: string; roman: string } {
  const scale = (SCALES[scaleKey] ?? SCALES.major).steps;
  const [r, third, fifth, seventh] = chordTones(degree, Math.max(3, size), 2, 0, root, scaleKey, 4);
  const t = third - r, f = fifth - r, s = seventh !== undefined ? seventh - r : -1;
  let q = '';
  if (t === 3 && f === 6) q = '°';
  else if (t === 4 && f === 8) q = '+';
  else if (t === 3) q = 'm';
  else if (t === 2) q = 'sus2';
  else if (t === 5) q = 'sus4';
  let ext = '';
  if (size >= 4 && s > 0) ext = s === 11 ? (q === 'm' ? '(maj7)' : 'maj7') : s === 10 ? '7' : '';
  if (q === '°' && ext === '7') (q = 'm'), (ext = '7♭5');
  const idx = ((Math.round(degree) % scale.length) + scale.length) % scale.length;
  const numeral = ROMAN[idx] ?? String(idx + 1);
  const lower = q === 'm' || q === '°';
  return {
    name: `${NOTE_NAMES[((r % 12) + 12) % 12]}${q}${ext}`,
    roman: (lower ? numeral.toLowerCase() : numeral) + (q === '°' ? '°' : q === '+' ? '+' : ''),
  };
}

/** Chord progressions as functions of `bar` — the song's harmony presets. */
export const PROGRESSIONS: { label: string; formula: string }[] = [
  { label: 'Pop  I–V–vi–IV', formula: 'pick(bar, 0, 4, 5, 3)' },
  { label: 'Royal Road  IV–V–iii–vi', formula: 'pick(bar, 3, 4, 2, 5)' },
  { label: 'Andalusian  i–VII–VI–V', formula: 'pick(bar, 0, -1, -2, -3)' },
  { label: 'Canon  I–V–vi–iii–IV–I–IV–V', formula: 'pick(bar, 0, 4, 5, 2, 3, 0, 3, 4)' },
  { label: 'ii–V–I', formula: 'pick(bar, 1, 4, 0, 0)' },
  { label: 'Circle of fifths', formula: '(3 * bar) % 7' },
  { label: 'Golden walk', formula: 'floor(7 * fract(bar * phi))' },
  { label: 'Drone', formula: '0' },
  { label: 'Two-chord sway', formula: 'pick(bar, 0, 5)' },
  { label: 'Random walk', formula: 'wrap(floor(4 * noise(bar * 0.7, 3)) * 2, 0, 7)' },
];
