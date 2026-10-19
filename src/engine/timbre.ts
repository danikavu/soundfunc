import { tryCompile } from './expr';

export const TIMBRE_VARS = ['p'] as const;

export const TIMBRE_PRESETS: { label: string; formula: string }[] = [
  { label: 'Organ', formula: 'sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)' },
  { label: 'Hollow', formula: 'sin(tau*p) + 0.3*sin(3*tau*p) + 0.15*sin(5*tau*p)' },
  { label: 'Folded', formula: 'sin(tau*p + 2*sin(tau*p))' },
  { label: 'Pulse 25%', formula: 'p < 0.25 ? 1 : -1' },
  { label: 'Parabola', formula: '1 - 8*(p - 0.5)^2' },
  { label: 'Steps', formula: 'floor(saw(p) * 4) / 4' },
  { label: 'Bitcrush', formula: 'round(sine(p) * 3) / 3' },
];

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
