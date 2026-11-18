/**
 * The backdrop behind the Score and Function views: the live sound as a figure filling the whole view.
 *   halo   — the waveform bent into a ring, stretched to the view, its trails spreading to the edges
 *   phase  — the waveform against itself a moment later: a Lissajous figure, scaled to the edges
 * Drawn faint, under the notes, and in the channels' colours.
 */
import type { Track } from '../engine/project';

export type BackdropStyle = 'off' | 'halo' | 'phase';
export const BACKDROP_STYLES: { value: BackdropStyle; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'no backdrop' },
  { value: 'halo', label: 'Halo', hint: 'the live waveform as a ring across the whole view' },
  { value: 'phase', label: 'Phase', hint: 'the live Lissajous figure across the whole view' },
];

export interface BackdropFrame {
  wave: Float32Array | null;
  /** the channels you hear: their colours paint the figure */
  tracks: Track[];
  /** seconds, for idle motion */
  now: number;
}

interface Palette {
  accent: string;
  glow: number;
}

/** how many frames linger and fade */
const TRAILS = 7;

/** what persists between frames: the trails, and the level the wave is scaled to */
export class BackdropMemory {
  waves: Float32Array[] = [];
  /** the recent loudest sample: quiet music is scaled up so the figures keep their size */
  level = 0.05;
  push(w: Float32Array) {
    this.waves.unshift(w);
    if (this.waves.length > TRAILS) this.waves.length = TRAILS;
  }
}

const TAU = Math.PI * 2;

/** the colours to draw with: the audible channels' */
function colours(f: BackdropFrame, P: Palette): string[] {
  const cs = f.tracks.map((t) => t.color);
  return cs.length ? cs : [P.accent];
}

/** a sweep through the colours, all the way round the centre */
function ringPaint(g: CanvasRenderingContext2D, cx: number, cy: number, cs: string[], turn = 0): string | CanvasGradient {
  if (cs.length < 2 || typeof g.createConicGradient !== 'function') return cs[0];
  const grad = g.createConicGradient(turn - Math.PI / 2, cx, cy);
  cs.forEach((c, i) => grad.addColorStop(i / cs.length, c));
  grad.addColorStop(1, cs[0]);
  return grad;
}

/** a rising zero crossing, so a periodic wave holds still from frame to frame */
function steady(w: Float32Array, span: number): number {
  for (let i = 1; i < w.length - span; i++) if (w[i - 1] < 0 && w[i] >= 0) return i;
  return 0;
}

const quiet = (w: Float32Array | null) => {
  if (!w) return true;
  let m = 0;
  for (let i = 0; i < w.length; i += 8) m = Math.max(m, Math.abs(w[i]));
  return m < 1e-3;
};

/** a running average over `n` samples: the wave's shape without its fizz */
function smooth(w: Float32Array, n: number): Float32Array {
  const out = new Float32Array(w.length);
  let sum = 0;
  for (let i = 0; i < w.length; i++) {
    sum += w[i];
    if (i >= n) sum -= w[i - n];
    out[i] = sum / Math.min(i + 1, n);
  }
  return out;
}

/** this frame's wave, steadied and scaled, pushed onto the trails */
function takeWave(f: BackdropFrame, mem: BackdropMemory) {
  const span = 1024;
  const copy = new Float32Array(span);
  if (quiet(f.wave) || !f.wave) {
    // silence: a slow breath, so the view is never dead
    for (let i = 0; i < span; i++) copy[i] = 0.035 * Math.sin((i / span) * TAU * 3 + f.now * 1.3);
  } else {
    const s = steady(f.wave, span);
    copy.set(f.wave.subarray(s, s + span));
    // automatic gain: follow the peaks quickly up, slowly down
    let peak = 0;
    for (let i = 0; i < span; i += 2) peak = Math.max(peak, Math.abs(copy[i]));
    mem.level = Math.max(peak, mem.level * 0.985, 0.04);
    const k = Math.min(6, 0.6 / mem.level);
    for (let i = 0; i < span; i++) copy[i] *= k;
  }
  mem.push(copy);
}

/** the wave bent round an ellipse rx × ry, pushed out by the samples (amp is a share of each radius) */
function waveRing(g: CanvasRenderingContext2D, w: Float32Array, cx: number, cy: number, rx: number, ry: number, amp: number, N: number) {
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // mirrored: the wave runs out and back, so the two ends meet without a seam
    const k = u < 0.5 ? u * 2 : (1 - u) * 2;
    const s = w[Math.min(w.length - 1, Math.floor(k * (N - 1)))] ?? 0;
    const a = -Math.PI / 2 + TAU * u;
    const r = 1 + s * amp;
    const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
}

function halo(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, P: Palette, f: BackdropFrame, mem: BackdropMemory) {
  const cs = colours(f, P);
  const paint = ringPaint(g, cx, cy, cs, f.now * 0.15);
  g.save();
  g.lineJoin = 'round';
  if (P.glow > 0) (g.shadowBlur = 10 * P.glow), (g.shadowColor = cs[0]);
  mem.waves.forEach((w, i) => {
    g.globalAlpha = i === 0 ? 0.95 : 0.5 * (1 - i / mem.waves.length);
    g.lineWidth = i === 0 ? 1.8 : 1;
    g.strokeStyle = paint;
    // older frames sit further out, like rings spreading to the edges
    const k = 0.55 + i * 0.12;
    waveRing(g, w, cx, cy, rx * k, ry * k, 0.4, 512);
    g.stroke();
  });
  g.restore();
}

function phase(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, P: Palette, f: BackdropFrame, mem: BackdropMemory) {
  const cs = colours(f, P);
  const paint = ringPaint(g, cx, cy, cs, f.now * 0.2);
  g.save();
  g.lineJoin = 'round';
  if (P.glow > 0) (g.shadowBlur = 10 * P.glow), (g.shadowColor = cs[0]);
  mem.waves.forEach((raw, h) => {
    // smoothed, so drums and noise flow as curves instead of scribbling over the notes
    const w = smooth(raw, 10);
    // x = the wave now, y = the wave a quarter of a cycle later: a sine draws a circle, harmonics knot it
    const d = 24;
    g.globalAlpha = h === 0 ? 0.95 : 0.3 * (1 - h / mem.waves.length);
    g.lineWidth = h === 0 ? 1.2 : 0.8;
    g.strokeStyle = paint;
    g.beginPath();
    const len = Math.min(w.length - d, 900);
    // each frame scaled to reach the edges, however small the wave
    let peak = 1e-3;
    for (let i = 0; i < len + d; i += 2) peak = Math.max(peak, Math.abs(w[i]));
    for (let i = 0; i < len; i++) {
      const x = cx + (w[i] / peak) * rx, y = cy - (w[i + d] / peak) * ry;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  });
  g.restore();
}

/** One backdrop frame filling W × H. */
export function drawBackdrop(g: CanvasRenderingContext2D, W: number, H: number, P: Palette, f: BackdropFrame, style: Exclude<BackdropStyle, 'off'>, mem: BackdropMemory) {
  takeWave(f, mem);
  const cx = W / 2, cy = H / 2;
  if (style === 'halo') halo(g, cx, cy, W / 2, H / 2, P, f, mem);
  else phase(g, cx, cy, W * 0.46, H * 0.46, P, f, mem);
}
