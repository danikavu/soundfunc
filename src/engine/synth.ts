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
  /** tape wow, 0 – 1: a slow drift of pitch (up to ±14 cents) that every note on the channel shares */
  wow: number;
  /** channel effects, 0 – 1 */
  chorus: number;
  delay: number;
  /** delay time in beats */
  delayTime: number;
  /** the macro: one knob that adds unison, width, chorus, warmth, a little drive and delay */
  sauce: number;
  /** the patch's own level, so every voice arrives about as loud as the others */
  gain: number;
  /** a stock voice's own one cycle of f(p), played when its wave is 'custom' (otherwise the channel's f(p) is) */
  shape?: string;
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
  wow: 0,
  chorus: 0,
  delay: 0,
  delayTime: 0.75,
  sauce: 0,
  gain: 1,
};

const patch = (p: Partial<SynthParams>): SynthParams => ({ ...BASE, ...p });

/** one cycle of a string plucked a fifth of the way along: every fifth harmonic missing, the koto's hollow ring */
const KOTO = 'sin(tau*p) + 0.729*sin(2*tau*p) + 0.457*sin(3*tau*p) + 0.203*sin(4*tau*p) - 0.127*sin(6*tau*p) - 0.173*sin(7*tau*p) - 0.148*sin(8*tau*p) - 0.08*sin(9*tau*p) + 0.063*sin(11*tau*p) + 0.093*sin(12*tau*p) + 0.085*sin(13*tau*p) + 0.048*sin(14*tau*p) - 0.041*sin(16*tau*p) - 0.062*sin(17*tau*p) - 0.058*sin(18*tau*p) - 0.034*sin(19*tau*p)';
/** a saw with its top rolled off (1/n^1.45): full and soft, nothing to scratch */
const MIST = 'sin(tau*p) + 0.366*sin(2*tau*p) + 0.203*sin(3*tau*p) + 0.134*sin(4*tau*p) + 0.097*sin(5*tau*p) + 0.074*sin(6*tau*p) + 0.06*sin(7*tau*p) + 0.049*sin(8*tau*p) + 0.041*sin(9*tau*p) + 0.035*sin(10*tau*p) + 0.031*sin(11*tau*p) + 0.027*sin(12*tau*p)';
/** nearly a sine, with the faint second and third partials of air across a bamboo edge */
const BAMBOO = 'sin(tau*p) + 0.16*sin(2*tau*p + 0.4) + 0.07*sin(3*tau*p) + 0.025*sin(4*tau*p)';
/** a saw with a formant lifted around the 3rd–5th harmonics: the bark of a brass section */
const BRASS = 'sin(tau*p) + 0.589*sin(2*tau*p) + 0.47*sin(3*tau*p) + 0.381*sin(4*tau*p) + 0.282*sin(5*tau*p) + 0.196*sin(6*tau*p) + 0.143*sin(7*tau*p) + 0.115*sin(8*tau*p) + 0.1*sin(9*tau*p) + 0.09*sin(10*tau*p) + 0.081*sin(11*tau*p) + 0.075*sin(12*tau*p) + 0.069*sin(13*tau*p) + 0.064*sin(14*tau*p) + 0.06*sin(15*tau*p)';

/**
 * The factory sound of each melodic voice. The four plain waves stay plain (subs and whistles
 * are built on them); the named voices are whole instruments — their own wave where it helps,
 * a filter that moves, a real amp shape, and the room they belong in.
 */
export const PATCHES: Record<MelodicVoice, SynthParams> = {
  // pure: the sub under every kick and the G-funk whistle — nothing added that could smear the low end
  sine: patch({ wave: 'sine' }),
  // round and woody, a touch of decay so a bass line speaks: walking and finger basses
  triangle: patch({ gain: 1.05, wave: 'triangle', sub: 0.12, filter: 'lowpass', cutoff: 0.72, resonance: 0.12, envAmount: 0.18, envDecay: 0.25, keyTrack: 0.5, decay: 0.9, sustain: 0.82, chorus: 0.06 }),
  square: patch({ gain: 1.37, wave: 'square', unison: 2, detune: 5, width: 0.3, filter: 'lowpass', cutoff: 0.6, resonance: 0.18, envAmount: 0.3, envDecay: 0.3, keyTrack: 0.6, decay: 0.8, sustain: 0.85, chorus: 0.12 }),
  sawtooth: patch({ gain: 1.75, wave: 'sawtooth', unison: 3, detune: 9, width: 0.5, filter: 'lowpass', cutoff: 0.58, resonance: 0.22, envAmount: 0.35, envDecay: 0.35, keyTrack: 0.6, decay: 0.9, sustain: 0.85, chorus: 0.15 }),
  // struck bronze: an inharmonic FM ring that brightens with the strike, two copies a hair apart to shimmer, a long tail
  bell: patch({ gain: 1.3, wave: 'fm', fmRatio: 3.5, fmIndex: 2.6, fmDecay: 1.1, unison: 2, detune: 3.5, width: 0.45, filter: 'lowpass', cutoff: 0.86, keyTrack: 0.7, decay: 2.6, sustain: 0, chorus: 0.22, delay: 0.18, delayTime: 0.75 }),
  // koto: the plucked-at-a-fifth string, a pick of noise, the filter snapping shut, ringing out
  pluck: patch({ gain: 2.7, wave: 'custom', shape: KOTO, unison: 2, detune: 4, width: 0.35, noise: 0.03, filter: 'lowpass', cutoff: 0.36, resonance: 0.3, envAmount: 0.72, envDecay: 0.2, keyTrack: 0.85, decay: 0.9, sustain: 0, chorus: 0.16, delay: 0.12, delayTime: 0.75 }),
  // mist: five soft saws drifting on a tape, a little air, opening slowly — strings and pads that sit behind everything
  pad: patch({ gain: 0.89, wave: 'custom', shape: MIST, unison: 5, detune: 14, width: 0.9, noise: 0.02, filter: 'lowpass', cutoff: 0.52, resonance: 0.12, envAmount: 0.18, envDecay: 1.8, keyTrack: 0.4, wow: 0.18, chorus: 0.5, delay: 0.12, delayTime: 0.75 }),
  // shakuhachi: bamboo and breath, vibrato that blooms, a little room
  flute: patch({ gain: 1.05, wave: 'custom', shape: BAMBOO, noise: 0.14, filter: 'lowpass', cutoff: 0.7, resonance: 0.22, envAmount: 0.12, envDecay: 0.25, keyTrack: 0.9, vibrato: 0.42, chorus: 0.1, delay: 0.1, delayTime: 0.75 }),
  // two saws beating slowly against each other over a clean sub, a growl of drive
  reese: patch({ gain: 0.9, wave: 'sawtooth', unison: 3, detune: 18, width: 0.3, sub: 0.62, filter: 'lowpass', cutoff: 0.43, resonance: 0.28, envAmount: 0.12, envDecay: 0.5, keyTrack: 0.25, drive: 0.4 }),
  custom: patch({ wave: 'custom', chorus: 0.1 }),
  supersaw: patch({ gain: 1.9, wave: 'sawtooth', unison: 7, detune: 21, width: 1, filter: 'lowpass', cutoff: 0.7, resonance: 0.12, envAmount: 0.18, envDecay: 0.7, keyTrack: 0.5, chorus: 0.3, delay: 0.16, delayTime: 0.75 }),
  // the tine piano: FM bark on the strike falling into a sine, a slow decay, chorus and a hint of a worn tape
  keys: patch({ gain: 0.9, wave: 'fm', fmRatio: 1, fmIndex: 1.7, fmDecay: 0.55, unison: 2, detune: 2.5, width: 0.35, filter: 'lowpass', cutoff: 0.66, resonance: 0.1, keyTrack: 0.55, decay: 1.6, sustain: 0.22, drive: 0.08, wow: 0.06, chorus: 0.38 }),
  // a section: the formant saw, the filter swelling open on each note and settling, a little vibrato late
  brass: patch({ gain: 1.0, wave: 'custom', shape: BRASS, unison: 3, detune: 7, width: 0.45, filter: 'lowpass', cutoff: 0.4, resonance: 0.16, envAmount: 0.5, envDecay: 0.45, keyTrack: 0.75, decay: 0.7, sustain: 0.82, drive: 0.18, vibrato: 0.14, chorus: 0.1, delay: 0.06 }),
  acid: patch({ gain: 0.85, wave: 'sawtooth', filter: 'lowpass', cutoff: 0.3, resonance: 0.8, envAmount: 0.62, envDecay: 0.17, keyTrack: 0.3, decay: 0.3, sustain: 0.6, drive: 0.5, delay: 0.2, delayTime: 0.75 }),
};

/** a short description of each voice for the voice menu */
export const VOICE_HINTS: Record<MelodicVoice, string> = {
  sine: 'pure tone',
  triangle: 'soft, round',
  square: 'hollow, woody',
  sawtooth: 'bright, three-voice unison',
  bell: 'struck bronze, shimmering, long ring',
  pluck: 'a string plucked at a fifth, filter snapping shut',
  pad: 'five soft saws on a drifting tape, wide',
  flute: 'bamboo and breath, vibrato that blooms',
  reese: 'saws beating slowly over a clean sub',
  custom: 'your own f(p) — one cycle of the wave',
  supersaw: 'seven saws, huge and wide',
  keys: 'tine piano, chorused, a little worn',
  brass: 'a section — formant saws, filter swell',
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
