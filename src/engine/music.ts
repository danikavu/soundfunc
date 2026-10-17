export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const SCALES: Record<string, { label: string; steps: number[] }> = {
  major: { label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { label: 'Pentatonic', steps: [0, 2, 4, 7, 9] },
  minorPentatonic: { label: 'Minor Pentatonic', steps: [0, 3, 5, 7, 10] },
  hirajoshi: { label: 'Hirajōshi', steps: [0, 2, 3, 7, 8] },
  inSen: { label: 'In Sen', steps: [0, 1, 5, 7, 10] },
  iwato: { label: 'Iwato', steps: [0, 1, 5, 6, 10] },
  yo: { label: 'Yo', steps: [0, 2, 5, 7, 9] },
  dorian: { label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  lydian: { label: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { label: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10] },
  harmonicMinor: { label: 'Harmonic Minor', steps: [0, 2, 3, 5, 7, 8, 11] },
  wholeTone: { label: 'Whole Tone', steps: [0, 2, 4, 6, 8, 10] },
  blues: { label: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
  chromatic: { label: 'Chromatic', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
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
  return Math.max(0, Math.min(127, midi));
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
