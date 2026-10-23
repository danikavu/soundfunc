/**
 * The synth behind every melodic voice: oscillators with unison, a sub and noise, a filter
 * with its own envelope, an ADSR amp, drive and vibrato — plus a chorus and a tempo-synced
 * delay on the channel. Each voice (Mist Pad, Reese Bass…) is a patch: a full set of these
 * settings. A channel can change any of them; its changes sit on top of the voice's patch.
 */
import type { Waveform } from './project';

export type OscWave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'custom' | 'fm';
export type FilterKind = 'lowpass' | 'bandpass' | 'highpass' | 'off';

export interface SynthParams {
  /** the oscillator: a classic wave, your own f(p), or FM (two sines, one bending the other) */
  wave: OscWave;
  /** FM: the modulator's ratio to the note, and how hard it modulates (falls over `fmDecay` s) */
  fmRatio: number;
  fmIndex: number;
  fmDecay: number;
  /** how many copies of the oscillator, 1 – 7, spread over ±detune cents and across the stereo field */
  unison: number;
  detune: number;
  width: number;
  /** a sine an octave down, and noise, 0 – 1 */
  sub: number;
  noise: number;
  filter: FilterKind;
  /** 0 – 1 → 30 Hz … 17 kHz */
  cutoff: number;
  /** 0 – 1 */
  resonance: number;
  /** how far the filter opens at the start of a note (0 – 1 → up to six octaves), and how fast it falls back */
  envAmount: number;
  envDecay: number;
  /** 0 – 1: how much the cutoff follows the note (1 = higher notes are as bright as low ones) */
  keyTrack: number;
  /** the amp after the attack: falls in `decay` s to `sustain` (0 – 1) */
  decay: number;
  sustain: number;
  /** soft saturation, 0 – 1 */
  drive: number;
  /** vibrato depth, 0 – 1 (up to a third of a semitone), blooming in over the first half second */
  vibrato: number;
  /** channel effects, 0 – 1 */
  chorus: number;
  delay: number;
  /** delay time in beats */
  delayTime: number;
  /** the macro: one knob that adds unison, width, chorus, warmth, a little drive and delay */
  sauce: number;
  /** the patch's own level, so every voice arrives about as loud as the others */
  gain: number;
}

export type MelodicVoice = Exclude<Waveform, 'kick' | 'snare' | 'hat' | 'openhat' | 'clap' | 'rim' | 'tom' | 'crash'>;

const BASE: SynthParams = {
  wave: 'sine',
  fmRatio: 2,
  fmIndex: 0,
  fmDecay: 1,
  unison: 1,
  detune: 0,
  width: 0,
  sub: 0,
  noise: 0,
  filter: 'off',
  cutoff: 1,
  resonance: 0.1,
  envAmount: 0,
  envDecay: 0.3,
  keyTrack: 0.5,
  decay: 0.4,
  sustain: 1,
  drive: 0,
  vibrato: 0,
  chorus: 0,
  delay: 0,
  delayTime: 0.75,
  sauce: 0,
  gain: 1,
};

const patch = (p: Partial<SynthParams>): SynthParams => ({ ...BASE, ...p });

/** the factory sound of each melodic voice */
export const PATCHES: Record<MelodicVoice, SynthParams> = {
  sine: patch({ wave: 'sine', sub: 0, chorus: 0.1 }),
  triangle: patch({ wave: 'triangle', filter: 'lowpass', cutoff: 0.85, chorus: 0.15 }),
  square: patch({ wave: 'square', unison: 2, detune: 6, width: 0.3, filter: 'lowpass', cutoff: 0.62, resonance: 0.15, envAmount: 0.25, envDecay: 0.35, keyTrack: 0.6 }),
  sawtooth: patch({ gain: 1.3, wave: 'sawtooth', unison: 3, detune: 10, width: 0.5, filter: 'lowpass', cutoff: 0.6, resonance: 0.2, envAmount: 0.3, envDecay: 0.4, keyTrack: 0.6, chorus: 0.15 }),
  bell: patch({ gain: 1.3, wave: 'fm', fmRatio: 3.5, fmIndex: 2.2, fmDecay: 1.4, decay: 1.6, sustain: 0, chorus: 0.25, delay: 0.15 }),
  pluck: patch({ gain: 2.4, wave: 'sawtooth', unison: 2, detune: 5, width: 0.4, filter: 'lowpass', cutoff: 0.28, resonance: 0.35, envAmount: 0.75, envDecay: 0.22, keyTrack: 0.8, decay: 0.5, sustain: 0, chorus: 0.2 }),
  pad: patch({ gain: 1.9, wave: 'sawtooth', unison: 5, detune: 16, width: 0.85, filter: 'lowpass', cutoff: 0.5, resonance: 0.1, envAmount: 0.2, envDecay: 1.6, keyTrack: 0.4, chorus: 0.45, delay: 0.1 }),
  flute: patch({ wave: 'triangle', noise: 0.12, filter: 'lowpass', cutoff: 0.72, resonance: 0.2, keyTrack: 0.9, vibrato: 0.45, chorus: 0.1 }),
  reese: patch({ wave: 'sawtooth', unison: 4, detune: 24, width: 0.35, sub: 0.6, filter: 'lowpass', cutoff: 0.45, resonance: 0.3, envAmount: 0.1, envDecay: 0.6, keyTrack: 0.3, drive: 0.35 }),
  custom: patch({ wave: 'custom', chorus: 0.1 }),
  supersaw: patch({ gain: 1.9, wave: 'sawtooth', unison: 7, detune: 22, width: 1, filter: 'lowpass', cutoff: 0.7, resonance: 0.12, envAmount: 0.15, envDecay: 0.8, keyTrack: 0.5, chorus: 0.3, delay: 0.15 }),
  keys: patch({ gain: 1.2, wave: 'fm', fmRatio: 1, fmIndex: 1.1, fmDecay: 0.9, filter: 'lowpass', cutoff: 0.7, keyTrack: 0.6, decay: 1.4, sustain: 0.25, chorus: 0.4 }),
  brass: patch({ gain: 1.4, wave: 'sawtooth', unison: 3, detune: 8, width: 0.4, filter: 'lowpass', cutoff: 0.38, resonance: 0.2, envAmount: 0.45, envDecay: 0.5, keyTrack: 0.7, decay: 0.6, sustain: 0.8, drive: 0.15, vibrato: 0.15 }),
  acid: patch({ gain: 0.85, wave: 'sawtooth', filter: 'lowpass', cutoff: 0.32, resonance: 0.78, envAmount: 0.6, envDecay: 0.18, keyTrack: 0.3, decay: 0.3, sustain: 0.6, drive: 0.45, delay: 0.2 }),
};

/** a short description of each voice for the voice menu */
export const VOICE_HINTS: Record<MelodicVoice, string> = {
  sine: 'pure tone',
  triangle: 'soft, round',
  square: 'hollow, woody',
  sawtooth: 'bright, three-voice unison',
  bell: 'FM metal, long ring',
  pluck: 'filter snaps shut — koto, harp',
  pad: 'five detuned saws, wide and slow',
  flute: 'breath and blooming vibrato',
  reese: 'detuned saws beating, sub, driven',
  custom: 'your own f(p) — one cycle of the wave',
  supersaw: 'seven saws, huge and wide',
  keys: 'FM electric piano, chorused',
  brass: 'saws through a swelling filter',
  acid: 'resonant squelch, driven',
};

/** settings that make sense to change on a drum */
export interface DrumParams {
  /** −1 … 1: darker … brighter */
  tone: number;
  /** × how long the hit rings */
  decay: number;
  drive: number;
  sauce: number;
}
export const DRUM_BASE: DrumParams = { tone: 0, decay: 1, drive: 0, sauce: 0 };

/**
 * The macro. Sauce 0 is the patch as written; turning it up widens and thickens the sound
 * (more unison voices, more detune and stereo width), adds chorus, a touch of warmth (drive)
 * and air (a little delay, a brighter filter). It never takes anything away.
 */
export function applySauce(p: SynthParams): SynthParams {
  const s = Math.max(0, Math.min(1, p.sauce));
  if (!s) return p;
  const thick = p.wave === 'sawtooth' || p.wave === 'square' || p.wave === 'custom' || p.wave === 'triangle';
  return {
    ...p,
    unison: thick ? Math.max(p.unison, Math.round(1 + s * 4)) : p.unison,
    detune: p.detune + s * (thick ? 14 : 6),
    width: Math.max(p.width, s * 0.85),
    chorus: Math.min(1, p.chorus + s * 0.45),
    drive: Math.min(1, p.drive + s * 0.22),
    delay: Math.min(1, p.delay + s * 0.22),
    cutoff: Math.min(1, p.cutoff + s * 0.08),
    sub: p.sub,
  };
}

/** the sound a melodic channel makes: its voice's patch, its own changes on top, the sauce applied */
export function synthOf(waveform: Waveform, changes?: Partial<SynthParams>): SynthParams {
  const base = PATCHES[waveform as MelodicVoice] ?? PATCHES.sine;
  return applySauce({ ...base, ...(changes ?? {}) });
}

export function drumOf(changes?: Partial<DrumParams>): DrumParams {
  const d = { ...DRUM_BASE, ...(changes ?? {}) };
  const s = Math.max(0, Math.min(1, d.sauce));
  // drum sauce: a little longer, warmer and punchier
  return { ...d, decay: d.decay * (1 + s * 0.35), drive: Math.min(1, d.drive + s * 0.4), tone: Math.max(-1, Math.min(1, d.tone + s * 0.15)) };
}

/** 0 – 1 → 30 Hz … 17 kHz, exponentially, so the slider feels even */
export const cutoffHz = (c: number) => 30 * Math.pow(2, Math.max(0, Math.min(1, c)) * 9.15);

/** "Surprise me": a tasteful variation of a patch — the same kind of sound, moved */
export function surprise(p: SynthParams, rng: () => number = Math.random): Partial<SynthParams> {
  const j = (v: number, amt: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Math.round((v + (rng() * 2 - 1) * amt) * 100) / 100));
  return {
    unison: p.wave === 'fm' || p.wave === 'sine' ? p.unison : Math.max(1, Math.min(7, p.unison + Math.round((rng() * 2 - 1) * 2))),
    detune: j(p.detune, 8, 0, 40),
    width: j(p.width, 0.3),
    cutoff: j(p.cutoff, 0.15, 0.1, 1),
    resonance: j(p.resonance, 0.2, 0, 0.85),
    envAmount: j(p.envAmount, 0.25),
    envDecay: j(p.envDecay, 0.2, 0.05, 2),
    drive: j(p.drive, 0.2, 0, 0.8),
    chorus: j(p.chorus, 0.25),
    delay: j(p.delay, 0.2, 0, 0.6),
    sub: j(p.sub, 0.2),
    ...(p.wave === 'fm' ? { fmIndex: j(p.fmIndex, 0.8, 0.2, 5), fmRatio: [1, 2, 3, 3.5, 4, 5][Math.floor(rng() * 6)] } : {}),
  };
}
