/**
 * Plain-language help for every node's ports and settings, shown when you hover a
 * port or setting in the node editor, and in the node's "?" guide.
 * Keys are "<node type>.<port or setting id>".
 */
export const NODE_DOCS: Record<string, string> = {
  // the clock
  'step.n': 'n — the step number: 0, 1, 2… counting through the loop, then starting again',
  'step.x': 'x — how far through the loop: 0 at the start, rising to 1 at the end',
  'step.t': 't — time in beats since the loop started (a beat is a quarter note)',
  'step.k': 'k — the loop count: 0 the first time round, then 1, 2, 3… — use it to change each pass',
  'step.h': 'h — the chord the song’s Harmony is on right now, as a scale degree (0 = the key’s root)',
  'step.bar': 'bar — the bar number since the song began (4 beats per bar)',

  'number.out': 'The number you set',
  'number.value': 'A constant — drag the slider or type a value',

  'expr.a': 'a — whatever is wired in here; use it in the formula as a',
  'expr.b': 'b — whatever is wired in here; use it in the formula as b',
  'expr.c': 'c — whatever is wired in here; use it in the formula as c',
  'expr.out': 'The formula’s value, once per step',
  'expr.formula': 'Any expression — the clock (n, x, t, k, h, bar), inputs a b c, sliders, and every function in the Guide',

  'math.a': 'a — the first value',
  'math.b': 'b — the second value (or the number below, if nothing is wired in)',
  'math.op': 'How a and b combine',
  'math.out': 'a and b, combined',

  'func.x': 'x — the value to transform (the loop’s progress x, if nothing is wired in)',
  'func.fn': 'The function applied to x',
  'func.out': 'fn(x)',

  'map.v': 'The value to rescale',
  'map.inMin': 'Values this low…',
  'map.inMax': '…to this high',
  'map.outMin': '…come out this low…',
  'map.outMax': '…to this high',
  'map.out': 'The rescaled value',

  'wave.p': 'phase — where along the wave (the loop’s progress x, if nothing is wired in)',
  'wave.shape': 'The wave’s shape',
  'wave.cycles': 'How many times the wave repeats over the loop',
  'wave.amp': 'How far the wave swings up and down',
  'wave.offset': 'Where the middle of the wave sits',
  'wave.out': 'offset + amp × wave(cycles × phase)',

  'series.n': 'Which term of the sequence (the step n, if nothing is wired in)',
  'series.kind': 'The number sequence',
  'series.p': 'A setting some sequences use (the logistic map’s r, the random seed, the Sierpiński row)',
  'series.modulo': 'Wrap the result into 0 … mod − 1 (0 = don’t wrap)',
  'series.out': 'The nth term',

  'euclid.n': 'Which step (the step n, if nothing is wired in)',
  'euclid.pulses': 'How many hits',
  'euclid.length': '…spread as evenly as possible over this many steps',
  'euclid.rotate': 'Shift the rhythm by this many steps',
  'euclid.out': '1 on a hit, 0 on a rest — wire it to velocity',

  'chance.n': 'Which step (n + loop × steps if nothing is wired in, so it changes every loop)',
  'chance.p': 'The probability of a hit, 0 … 1',
  'chance.seed': 'Change it for a different, repeatable random pattern',
  'chance.out': '1 or 0 — the same every time you play',

  'pattern.n': 'Which step (the step n, if nothing is wired in)',
  'pattern.pattern': 'One character per step: X accent · x hit · o ghost · 1–9 loudness · . rest',
  'pattern.rotate': 'Shift the pattern by this many steps',
  'pattern.out': 'The velocity for this step',

  'list.n': 'Which step (the step n, if nothing is wired in)',
  'list.values': 'The values to step through, in order — then round again',
  'list.every': 'Hold each value for this many steps',
  'list.out': 'The current value',

  'compare.a': 'a — the value on the left',
  'compare.b': 'b — the value on the right (or the number below, if nothing is wired in)',
  'compare.op': 'The comparison',
  'compare.out': '1 when the comparison holds, otherwise 0',

  'switch.cond': 'if — any value except 0 counts as true',
  'switch.then': 'then — the result when the condition is true',
  'switch.else': 'else — the result when it is false',
  'switch.out': 'then or else',

  'sections.A': 'What plays during section A (and E, I…)',
  'sections.B': 'What plays during section B',
  'sections.C': 'What plays during section C',
  'sections.D': 'What plays during section D',
  'sections.lengths': 'How long each section lasts, in order — e.g. 8 8 16',
  'sections.unit': 'Whether the lengths are beats or bars',
  'sections.out': 'The value of whichever section is playing',
  'sections.section': 'Which section is playing: 0, 1, 2…',
  'sections.local': 'How far through the current section: 0 → 1',

  // what you hear
  'output.pitch': 'pitch — which note. A scale degree by default (0 = the key’s root, 2 = a third up, 7 = an octave in a 7-note scale)',
  'output.velocity': 'velocity — how loud, 0 … 1. 0 means rest: no note on this step',
  'output.length': 'length — how long the note lasts, in steps (1 = until the next step, 2 = two steps…)',
  'output.shift': 'shift — play the note late by part of a step (0 … 0.95): swing, flams, laid-back feel',
  'output.ratchet': 'ratchet — repeat the note 2–8 times inside its step: rolls and stutters',
  'output.chord': 'chord — how many notes to stack (1 = a single note, 3 = a triad, 4 = a seventh chord)',
  'output.stack': 'stack — scale steps between chord notes: 2 = thirds (ordinary chords), 3 = fourths (open, modal), 1 = clusters',
  'output.inversion': 'inversion — lift the lowest chord notes an octave (0, 1, 2…) so the voicing changes shape',
  'output.strum': 'strum — spread the chord’s notes in time, in steps (0.05 = a quick strum; negative strums downward)',
};

/** help for a port or setting, or nothing */
export function docFor(type: string, id: string): string | undefined {
  return NODE_DOCS[`${type}.${id}`] || undefined;
}
