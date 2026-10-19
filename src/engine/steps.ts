import { tryCompile } from './expr';

/** A step length, in beats (a quarter note = 1 beat). */
export interface StepLength {
  beats: number;
  label: string;
  hint: string;
}

export interface StepGroup {
  title: string;
  items: StepLength[];
}

const s = (beats: number, label: string, hint: string): StepLength => ({ beats, label, hint });

export const STEP_GROUPS: StepGroup[] = [
  {
    title: 'Straight',
    items: [
      s(1 / 16, '1/64', '64 per bar'),
      s(1 / 8, '1/32', '32 per bar'),
      s(1 / 4, '1/16', '16 per bar — the usual grid'),
      s(1 / 2, '1/8', '8 per bar'),
      s(1, '1/4', 'one per beat'),
      s(2, '1/2', 'two per bar'),
      s(4, '1', 'one per bar'),
      s(8, '2 bars', 'very slow'),
    ],
  },
  {
    title: 'Triplets',
    items: [
      s(1 / 12, '1/32t', '48 per bar'),
      s(1 / 6, '1/16t', '24 per bar — rolls, trap hats'),
      s(1 / 3, '1/8t', '12 per bar — shuffle, swing'),
      s(2 / 3, '1/4t', '6 per bar'),
      s(4 / 3, '1/2t', '3 per bar'),
    ],
  },
  {
    title: 'Dotted',
    items: [
      s(3 / 16, '1/32.', 'dotted thirty-second'),
      s(3 / 8, '1/16.', 'dotted sixteenth — 3 against 4'),
      s(3 / 4, '1/8.', 'dotted eighth — the classic delay feel'),
      s(3 / 2, '1/4.', 'dotted quarter'),
      s(3, '1/2.', 'dotted half'),
    ],
  },
  {
    title: 'Tuplets',
    items: [
      s(1 / 5, '1/16 ×5', 'quintuplet — 5 per beat'),
      s(2 / 5, '1/8 ×5', 'quintuplet — 5 per 2 beats'),
      s(1 / 7, '1/16 ×7', 'septuplet — 7 per beat'),
      s(2 / 7, '1/8 ×7', 'septuplet — 7 per 2 beats'),
      s(1 / 9, '1/32 ×9', 'nonuplet — 9 per beat'),
    ],
  },
  {
    title: 'Free',
    items: [
      s((Math.sqrt(5) - 1) / 2, 'φ⁻¹ beat', 'golden — never lines up with the bar'),
      s(Math.PI / 8, 'π/8 beat', 'irrational drift against the grid'),
      s(Math.SQRT2 / 4, '√2/4 beat', 'another irrational pulse'),
    ],
  },
];

export const ALL_STEPS = STEP_GROUPS.flatMap((g) => g.items);

/** "1/16", "1/8t", or "0.3 beats" for a length that has no name */
export function stepLabel(beats: number): string {
  const named = ALL_STEPS.find((x) => Math.abs(x.beats - beats) < 1e-9);
  if (named) return named.label;
  return `${Number(beats.toFixed(4))} beats`;
}

/** steps per 4-beat bar, for display */
export const perBar = (beats: number) => {
  const v = 4 / beats;
  return Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : v.toFixed(2);
};

/**
 * A step length typed by hand, in beats: "0.3", "3/20", "1/5", "phi/4" — anything the
 * formula language can compute. Note names like "1/16" are read as note values instead.
 */
export function parseStepLength(text: string): number | null {
  const t = text.trim();
  const named = ALL_STEPS.find((x) => x.label.toLowerCase() === t.toLowerCase());
  if (named) return named.beats;
  const { fn } = tryCompile(t, []);
  if (!fn) return null;
  const v = fn({});
  return Number.isFinite(v) && v >= 1 / 64 && v <= 32 ? v : null;
}
