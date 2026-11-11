import { tryCompile } from './expr';
import type { SynthParams } from './synth';

export const TIMBRE_VARS = ['p'] as const;

/**
 * The Sonic Menagerie: ten finished custom voices — one cycle of f(p) (most of them phase
 * modulation folded into a single cycle), with the envelope and the Shape settings that make
 * it a whole instrument. Picking one sets all of it; the wave stays yours to edit and mutate.
 */
export interface WaveVoice {
  id: string;
  /** short, for the row of waves under the formula */
  label: string;
  /** full, for the Voice menu */
  name: string;
  hint: string;
  timbre: string;
  attack: number;
  release: number;
  synth: Partial<SynthParams>;
}

export const WAVE_VOICES: WaveVoice[] = [
  {
    id: 'neonmantis',
    label: 'Mantis',
    name: 'Neon Mantis',
    hint: 'riddim razor — snarling FM, a wah that snaps shut',
    timbre: '0.72*sin(tau*p + 5.7*sin(3*tau*p + 1.9*sin(7*tau*p))) + 0.21*sin(11*tau*p + 1.2*sin(2*tau*p))',
    attack: 0.004,
    release: 0.19,
    synth: { unison: 2, detune: 5.4, width: 0.28, sub: 0.44, filter: 'lowpass', cutoff: 0.63, resonance: 0.47, envAmount: 0.58, envDecay: 0.13, keyTrack: 0.45, decay: 0.32, sustain: 0.72, drive: 0.76, chorus: 0.08, delay: 0.17, delayTime: 0.5, sauce: 0.79, gain: 1.0 },
  },
  {
    id: 'glasscathedral',
    label: 'Glass',
    name: 'Glass Cathedral',
    hint: 'shimmer bells — glassy partials ringing into a dotted echo',
    timbre: '0.76*sin(tau*p) + 0.31*sin(3*tau*p + 0.6*sin(2*tau*p)) + 0.16*sin(8*tau*p) + 0.09*sin(13*tau*p)',
    attack: 0.008,
    release: 1.8,
    synth: { unison: 3, detune: 8.7, width: 0.81, sub: 0.03, filter: 'lowpass', cutoff: 0.91, resonance: 0.22, envAmount: 0.31, envDecay: 0.55, keyTrack: 0.7, decay: 2.4, sustain: 0.1, drive: 0.08, chorus: 0.44, delay: 0.61, delayTime: 0.75, sauce: 0.28, gain: 1.0 },
  },
  {
    id: 'bowstorm',
    label: 'Violin',
    name: 'Bowstorm',
    hint: 'electric violin — bowed swell, rosin, vibrato that blooms',
    timbre: '0.54*sin(tau*p) + 0.33*sin(2*tau*p + 0.15*sin(tau*p)) + 0.25*sin(3*tau*p) + 0.18*sin(4*tau*p) + 0.11*sin(5*tau*p) + 0.075*sin(7*tau*p) + 0.04*sin(9*tau*p)',
    attack: 0.095,
    release: 0.68,
    synth: { unison: 3, detune: 3.2, width: 0.65, sub: 0.11, noise: 0.035, filter: 'lowpass', cutoff: 0.69, resonance: 0.14, envAmount: 0.23, envDecay: 0.37, keyTrack: 0.85, decay: 0.6, sustain: 0.86, drive: 0.16, vibrato: 0.38, chorus: 0.3, delay: 0.14, delayTime: 0.75, sauce: 0.24, gain: 1.05 },
  },
  {
    id: 'bronzetitan',
    label: 'Titan',
    name: 'Bronze Titan',
    hint: 'cinematic brass — the filter blares open and settles',
    timbre: '0.46*sin(tau*p + 0.72*sin(tau*p)) + 0.38*sin(2*tau*p) + 0.30*sin(3*tau*p) + 0.22*sin(4*tau*p) + 0.15*sin(5*tau*p) + 0.09*sin(7*tau*p)',
    attack: 0.038,
    release: 0.36,
    synth: { unison: 4, detune: 6.5, width: 0.76, sub: 0.23, filter: 'lowpass', cutoff: 0.59, resonance: 0.2, envAmount: 0.74, envDecay: 0.3, keyTrack: 0.7, decay: 0.7, sustain: 0.8, drive: 0.37, vibrato: 0.12, chorus: 0.13, delay: 0.1, delayTime: 0.75, sauce: 0.42, gain: 1.1 },
  },
  {
    id: 'phantomvowel',
    label: 'Vowel',
    name: 'Phantom Vowel',
    hint: 'talking bass — a resonant filter that says “wow”',
    timbre: '0.62*sin(tau*p + 3.6*sin(2*tau*p + 1.4*sin(5*tau*p))) + 0.28*sin(5*tau*p + 2.1*sin(tau*p)) + 0.1*sin(9*tau*p)',
    attack: 0.012,
    release: 0.29,
    synth: { unison: 1, detune: 0, width: 0.16, sub: 0.53, filter: 'lowpass', cutoff: 0.48, resonance: 0.73, envAmount: 0.82, envDecay: 0.31, keyTrack: 0.4, decay: 0.45, sustain: 0.75, drive: 0.58, chorus: 0.11, delay: 0.26, delayTime: 0.5, sauce: 0.71, gain: 0.75 },
  },
  {
    id: 'moonreed',
    label: 'Reed',
    name: 'Moon Reed',
    hint: 'haunted clarinet — hollow odd harmonics, breath and a slow waver',
    timbre: '0.84*sin(tau*p) + 0.34*sin(3*tau*p + 0.12*sin(2*tau*p)) + 0.17*sin(5*tau*p) + 0.085*sin(7*tau*p) + 0.035*sin(9*tau*p)',
    attack: 0.065,
    release: 0.55,
    synth: { unison: 2, detune: 2.1, width: 0.32, sub: 0.08, noise: 0.05, filter: 'lowpass', cutoff: 0.56, resonance: 0.32, envAmount: 0.18, envDecay: 0.28, keyTrack: 0.9, decay: 0.4, sustain: 0.95, drive: 0.04, vibrato: 0.22, chorus: 0.2, delay: 0.35, delayTime: 0.75, sauce: 0.17, gain: 0.8 },
  },
  {
    id: 'voidengine',
    label: 'Void',
    name: 'Void Engine',
    hint: 'subharmonic growl — a sub under a driven, grinding FM core',
    timbre: '0.8*sin(tau*p + 4.4*sin(2*tau*p + 1.6*sin(5*tau*p))) + 0.15*sin(3*tau*p) + 0.05*sin(12*tau*p)',
    attack: 0.003,
    release: 0.24,
    synth: { unison: 1, detune: 0, width: 0.1, sub: 0.82, filter: 'lowpass', cutoff: 0.4, resonance: 0.52, envAmount: 0.67, envDecay: 0.19, keyTrack: 0.3, decay: 0.35, sustain: 0.82, drive: 0.88, chorus: 0.02, delay: 0.08, delayTime: 0.5, sauce: 0.91, gain: 0.9 },
  },
  {
    id: 'prismchoir',
    label: 'Prism',
    name: 'Prism Choir',
    hint: 'celestial pad — six voices, wide, breathing in slowly',
    timbre: '0.67*sin(tau*p) + 0.3*sin(2*tau*p + 0.8*sin(3*tau*p)) + 0.18*sin(4*tau*p) + 0.12*sin(6*tau*p + 0.4*sin(tau*p)) + 0.07*sin(10*tau*p)',
    attack: 1.1,
    release: 2.5,
    synth: { unison: 6, detune: 14.2, width: 0.98, sub: 0.16, noise: 0.025, filter: 'lowpass', cutoff: 0.66, resonance: 0.19, envAmount: 0.25, envDecay: 0.88, keyTrack: 0.4, decay: 1, sustain: 1, drive: 0.06, vibrato: 0.08, chorus: 0.79, delay: 0.56, delayTime: 0.75, sauce: 0.3, gain: 0.85 },
  },
  {
    id: 'arcadeplasma',
    label: 'Plasma',
    name: 'Arcade Plasma',
    hint: 'bitcrushed laser — a bright zap that snaps off into echoes',
    timbre: '0.56*sin(tau*p + 2.8*sin(4*tau*p)) + 0.27*sin(9*tau*p + 1.7*sin(3*tau*p)) + 0.17*sin(17*tau*p)',
    attack: 0.001,
    release: 0.11,
    synth: { unison: 2, detune: 12.5, width: 0.62, sub: 0.12, filter: 'lowpass', cutoff: 0.94, resonance: 0.36, envAmount: 0.44, envDecay: 0.08, keyTrack: 0.6, decay: 0.16, sustain: 0.4, drive: 0.69, chorus: 0.05, delay: 0.38, delayTime: 0.5, sauce: 0.86, gain: 1.2 },
  },
  {
    id: 'undertow',
    label: 'Neuro',
    name: 'Undertow',
    hint: 'liquid neuro — rolling, resonant, pulled under',
    timbre: '0.68*sin(tau*p + 3.9*sin(tau*p + 1.8*sin(4*tau*p + 0.7*sin(7*tau*p)))) + 0.22*sin(6*tau*p + 1.5*sin(2*tau*p)) + 0.1*sin(13*tau*p)',
    attack: 0.016,
    release: 0.41,
    synth: { unison: 2, detune: 4.8, width: 0.39, sub: 0.57, filter: 'lowpass', cutoff: 0.51, resonance: 0.61, envAmount: 0.77, envDecay: 0.42, keyTrack: 0.4, decay: 0.5, sustain: 0.72, drive: 0.63, chorus: 0.22, delay: 0.28, delayTime: 0.75, sauce: 0.74, gain: 0.82 },
  },
];

/** the wave voice a channel is wearing — wave, envelope and every Shape setting just as the voice sets them */
export function waveVoiceOf(t: { waveform: string; timbre: string; attack: number; release: number; synth?: Partial<SynthParams> }): WaveVoice | undefined {
  if (t.waveform !== 'custom') return undefined;
  return WAVE_VOICES.find(
    (v) => v.timbre === t.timbre && Math.abs(v.attack - t.attack) < 1e-6 && Math.abs(v.release - t.release) < 1e-6 && JSON.stringify(t.synth ?? {}) === JSON.stringify(v.synth),
  );
}

/** One cycle of f(p), p in [0, 1). Returns null if the formula doesn't parse. */
export function timbreSamples(formula: string, n = 256): Float32Array | null {
  const { fn } = tryCompile(formula, TIMBRE_VARS);
  if (!fn) return null;
  const out = new Float32Array(n);
  const scope = { p: 0 };
  let peak = 0;
  for (let i = 0; i < n; i++) {
    scope.p = i / n;
    const v = fn(scope);
    out[i] = Number.isFinite(v) ? v : 0;
  }
  // remove DC offset so the speaker doesn't get pushed, then normalize
  const mean = out.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs((out[i] -= mean)));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak;
  return out;
}

/** Fourier coefficients of one cycle — feeds AudioContext.createPeriodicWave. */
export function timbreHarmonics(formula: string, harmonics = 64): { real: Float32Array; imag: Float32Array } | null {
  const N = 2048;
  const s = timbreSamples(formula, N);
  if (!s) return null;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) {
    let re = 0, im = 0;
    const w = (2 * Math.PI * k) / N;
    for (let i = 0; i < N; i++) {
      re += s[i] * Math.cos(w * i);
      im += s[i] * Math.sin(w * i);
    }
    real[k] = (2 * re) / N;
    imag[k] = (2 * im) / N;
  }
  return { real, imag };
}
