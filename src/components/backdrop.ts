/**
 * The backdrop behind the Score and Function views: the live sound filling the whole view,
 * drawn faint under the notes and in the channels' colours (the caller turns it into dots).
 *   waves     — smooth waves flowing across the view, one per stretch of the spectrum, swelling with it
 *   phase     — the waveform against itself a moment later: a Lissajous figure, scaled to the edges
 *   eq        — an LED spectrum analyser: lows on the left, highs on the right, peaks that hang and fall
 *   sonogram  — the spectrum painted under the playhead as it passes: bass low, hats high, pass after pass
 *   life      — Conway's Game of Life on the dots, seeded by every note as it starts
 */
import type { Track } from '../engine/project';

export type BackdropStyle = 'off' | 'waves' | 'phase' | 'eq' | 'sonogram' | 'life';
export const BACKDROP_STYLES: { value: BackdropStyle; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'no backdrop' },
  { value: 'waves', label: 'Waves', hint: 'smooth waves flowing across the view: the bass a slow swell, the highs quick ripples' },
  { value: 'phase', label: 'Phase', hint: 'the live Lissajous figure across the whole view' },
  { value: 'eq', label: 'EQ', hint: 'an LED spectrum analyser: lows on the left, highs on the right, peaks that hang and fall' },
  { value: 'sonogram', label: 'Sonogram', hint: 'the sound painted under the notes as the playhead passes: bass low, hats high' },
  { value: 'life', label: 'Life', hint: 'Conway’s Game of Life on the dots, seeded by every note as it plays' },
];

export interface BackdropFrame {
  wave: Float32Array | null;
  /** the spectrum, 0 – 255 per bin (bin i ≈ i × sampleRate / (2 × length) Hz) */
  spectrum: Uint8Array | null;
  sampleRate: number;
  /** the channels you hear: their colours paint the figure */
  tracks: Track[];
  /** seconds, for motion */
  now: number;
  /** where the music is drawn in the view, and the playhead's x there (null when stopped or out of view) */
  area: { x0: number; x1: number; y0: number; y1: number };
  playX: number | null;
  /** what sounds right now, where it is drawn: Life is seeded from it (a key is one note) */
  sparks: { key: string; x: number; y: number; color: string }[];
  /** one dot, in CSS px: the figures that live on the grid draw in whole dots */
  cell: number;
}

interface Palette {
  accent: string;
  glow: number;
}

/** how many frames of the wave linger (Phase) */
const TRAILS = 7;

/** what persists between frames */
export class BackdropMemory {
  waves: Float32Array[] = [];
  /** the recent loudest sample: quiet music is scaled up so the figures keep their size */
  level = 0.05;
  last = 0;
  /** EQ and Waves: the bands, eased, and the peaks hanging over them */
  bands = new Float32Array(0);
  peaks = new Float32Array(0);
  held = new Float32Array(0);
  /** Waves: how far each wave has flowed */
  flow = new Float32Array(0);
  /** Sonogram: what is painted so far, one pixel per dot, and the column the playhead was in */
  sono: HTMLCanvasElement | null = null;
  sonoCol: number | null = null;
  sonoFade = 0;
  /** Life: the grid (0 = dead, else 1 + the colour it was born in), what just died, fading, and the notes seen last frame */
  life: Uint8Array | null = null;
  lifeNext: Uint8Array | null = null;
  ghost: Float32Array | null = null;
  ghostColour: Uint8Array | null = null;
  lifeW = 0;
  lifeH = 0;
  lifeClock = 0;
  sounding = new Set<string>();
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

/**
 * The spectrum in `n` bands spaced evenly in pitch, 35 Hz – 16 kHz, each 0 … 1: the analyser's bytes
 * span −100 … −30 dB, and music lives in about −65 … −25, so that window is stretched to fill 0 … 1.
 * The highs carry less energy than the lows, so they are lifted a little to read evenly.
 */
function bandLevels(f: BackdropFrame, n: number): Float32Array {
  const out = new Float32Array(n);
  const spec = f.spectrum;
  if (!spec || quiet(f.wave)) return out;
  const lo = 35, hi = 16000;
  const binHz = f.sampleRate / 2 / spec.length;
  for (let i = 0; i < n; i++) {
    const b0 = Math.floor((lo * Math.pow(hi / lo, i / n)) / binHz);
    const b1 = Math.max(b0, Math.floor((lo * Math.pow(hi / lo, (i + 1) / n)) / binHz));
    let m = 0;
    for (let b = b0; b <= b1 && b < spec.length; b++) m = Math.max(m, spec[b]);
    const v = (m / 255 - 0.5) / 0.55 + 0.18 * (i / n);
    out[i] = Math.min(1, Math.max(0, v));
  }
  return out;
}

/** frame time, in seconds (kept sane across pauses) */
function tick(f: BackdropFrame, mem: BackdropMemory): number {
  const dt = mem.last ? Math.min(0.1, Math.max(0, f.now - mem.last)) : 1 / 60;
  mem.last = f.now;
  return dt;
}

/** bands that jump up at once and fall back slowly, and peaks that hang a moment before they drop */
function easeBands(mem: BackdropMemory, lv: Float32Array, dt: number, now: number, fall: number) {
  if (mem.bands.length !== lv.length) (mem.bands = new Float32Array(lv.length)), (mem.peaks = new Float32Array(lv.length)), (mem.held = new Float32Array(lv.length));
  for (let i = 0; i < lv.length; i++) {
    mem.bands[i] = lv[i] > mem.bands[i] ? lv[i] : Math.max(lv[i], mem.bands[i] - fall * dt);
    if (mem.bands[i] >= mem.peaks[i]) (mem.peaks[i] = mem.bands[i]), (mem.held[i] = now);
    else if (now - mem.held[i] > 0.4) mem.peaks[i] = Math.max(mem.bands[i], mem.peaks[i] - 0.6 * dt);
  }
}

// ---------- waves: smooth waves flowing across the view ----------

/** the waves, lowest first: how many cycles span the view, how fast they flow, and the bands that drive them */
const WAVES = [
  { cycles: 0.8, speed: 0.35, from: 0, to: 0.12 },
  { cycles: 1.3, speed: 0.55, from: 0.12, to: 0.3 },
  { cycles: 1.9, speed: 0.8, from: 0.3, to: 0.5 },
  { cycles: 2.7, speed: 1.1, from: 0.5, to: 0.72 },
  { cycles: 3.6, speed: 1.5, from: 0.72, to: 1 },
];

function waves(g: CanvasRenderingContext2D, W: number, H: number, P: Palette, f: BackdropFrame, mem: BackdropMemory, dt: number) {
  const n = 40;
  easeBands(mem, bandLevels(f, n), dt, f.now, 0.9);
  if (mem.flow.length !== WAVES.length) mem.flow = new Float32Array(WAVES.length);
  const cs = colours(f, P);
  const cy = H / 2;
  const steps = Math.max(32, Math.ceil(W / 6));
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  WAVES.forEach((wv, k) => {
    // its stretch of the spectrum, averaged: the louder it is, the taller the wave and the faster it flows
    const b0 = Math.floor(wv.from * n), b1 = Math.max(b0 + 1, Math.floor(wv.to * n));
    let level = 0;
    for (let i = b0; i < b1; i++) level += mem.bands[i] / (b1 - b0);
    mem.flow[k] += dt * wv.speed * (1 + level * 1.5);
    // even in silence each wave keeps a gentle undulation
    const amp = H * 0.34 * (0.24 + 0.76 * level) * (1 - k * 0.08);
    const colour = cs[k % cs.length];
    // each wave rides its own line, spread about the middle, so quiet waves don't pile into one stripe
    const base = cy + (k - (WAVES.length - 1) / 2) * H * 0.09;
    const y = (x: number, lag: number) => {
      const u = x / W, t = mem.flow[k] - lag;
      // a gentle swell along the wave, calmer towards the edges
      const swell = 1 + 0.3 * Math.sin(TAU * (u * 0.5 + t * 0.13 + k * 0.7));
      const edge = 0.35 + 0.65 * Math.sin(Math.PI * u);
      return base + amp * edge * swell * Math.sin(TAU * (u * wv.cycles - t) + k * 1.9);
    };
    if (P.glow > 0) (g.shadowBlur = 6 * P.glow), (g.shadowColor = colour);
    g.strokeStyle = colour;
    // a ribbon: the wave, and fading echoes of where it just was
    for (const [lag, alpha, width] of [[0.09, 0.22, 1.2], [0.045, 0.4, 1.5], [0, 0.95, 2]] as const) {
      g.globalAlpha = alpha;
      g.lineWidth = width;
      g.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        i ? g.lineTo(x, y(x, lag)) : g.moveTo(x, y(x, lag));
      }
      g.stroke();
    }
  });
  g.restore();
}

// ---------- phase ----------

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

// ---------- eq: an LED spectrum analyser ----------

/** a fill that runs up through the colours, bottom to top */
function rising(g: CanvasRenderingContext2D, cs: string[], bottom: number, top: number): string | CanvasGradient {
  if (cs.length < 2) return cs[0];
  const grad = g.createLinearGradient(0, bottom, 0, top);
  cs.forEach((c, i) => grad.addColorStop(i / (cs.length - 1), c));
  return grad;
}

function eq(g: CanvasRenderingContext2D, W: number, H: number, P: Palette, f: BackdropFrame, mem: BackdropMemory, dt: number) {
  const c = f.cell;
  // each bar two dots wide, one dot apart, across the whole view
  const step = c * 3;
  const n = Math.max(8, Math.floor(W / step));
  easeBands(mem, bandLevels(f, n), dt, f.now, 1.4);
  const x0 = Math.floor((W - n * step + c) / 2 / c) * c;
  const floor = Math.floor(H / c) * c - c;
  const span = floor - H * 0.06;
  const snap = (v: number) => Math.round(v / c) * c;
  const cs = colours(f, P);
  g.save();
  if (P.glow > 0) (g.shadowBlur = 6 * P.glow), (g.shadowColor = cs[0]);
  g.fillStyle = rising(g, cs, floor, floor - span);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    const h = snap(mem.bands[i] * span);
    // a row of dim dots along the floor, so the analyser is there even in silence
    g.globalAlpha = 0.35;
    g.fillRect(x, floor, c * 2, c);
    if (h > 0) {
      g.globalAlpha = 0.9;
      g.fillRect(x, floor - h, c * 2, h);
    }
    const p = snap(mem.peaks[i] * span);
    if (p > c) {
      g.globalAlpha = 1;
      g.fillRect(x, floor - p - c * 2, c * 2, c);
    }
  }
  g.restore();
}

// ---------- sonogram: the spectrum painted under the playhead ----------

function sonogram(g: CanvasRenderingContext2D, W: number, H: number, P: Palette, f: BackdropFrame, mem: BackdropMemory, dt: number) {
  const c = f.cell;
  const cw = Math.ceil(W / c), ch = Math.ceil(H / c);
  if (!mem.sono || mem.sono.width !== cw || mem.sono.height !== ch) {
    mem.sono = document.createElement('canvas');
    mem.sono.width = cw;
    mem.sono.height = ch;
    mem.sonoCol = null;
  }
  const s = mem.sono.getContext('2d')!;
  // what was painted fades slowly, so a stopped or quieter loop gives way
  mem.sonoFade += dt;
  if (mem.sonoFade > 0.5) {
    s.globalCompositeOperation = 'destination-out';
    s.fillStyle = 'rgba(0,0,0,0.06)';
    s.fillRect(0, 0, cw, ch);
    s.globalCompositeOperation = 'source-over';
    mem.sonoFade = 0;
  }
  const cs = colours(f, P);
  if (f.playX !== null) {
    const r0 = Math.ceil(f.area.y0 / c), r1 = Math.floor(f.area.y1 / c);
    const rows = Math.max(1, r1 - r0);
    const col = Math.floor(f.playX / c);
    // carry on from the last column; a new pass, a jump or a fresh start begins where the playhead is
    const from = mem.sonoCol === null || col < mem.sonoCol || col - mem.sonoCol > 24 ? col : mem.sonoCol + 1;
    if (col >= from) {
      const lv = bandLevels(f, rows);
      // this pass paints over the last one
      s.clearRect(from, r0, col - from + 1, rows);
      for (let r = 0; r < rows; r++) {
        const v = lv[r];
        if (v < 0.05) continue;
        // bass at the bottom, the highs at the top, through the channels' colours
        s.fillStyle = cs[Math.min(cs.length - 1, Math.floor((r / rows) * cs.length))];
        s.globalAlpha = Math.min(1, 0.08 + v * v * 0.55);
        s.fillRect(from, r1 - 1 - r, col - from + 1, 1);
      }
      s.globalAlpha = 1;
    }
    mem.sonoCol = col;
  } else mem.sonoCol = null;
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(mem.sono, 0, 0, cw, ch, 0, 0, cw * c, ch * c);
  g.restore();
}

// ---------- life: Conway's Game of Life on the dots ----------

/** generations per second */
const LIFE_RATE = 12;
/** what a note drops: an R-pentomino, a glider, an acorn — small patterns that grow for a long while */
const SEEDS: [number, number][][] = [
  [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function life(g: CanvasRenderingContext2D, W: number, H: number, P: Palette, f: BackdropFrame, mem: BackdropMemory, dt: number) {
  const c = f.cell;
  const cw = Math.ceil(W / c), ch = Math.ceil(H / c);
  const cs = colours(f, P);
  if (!mem.life || mem.lifeW !== cw || mem.lifeH !== ch) {
    mem.life = new Uint8Array(cw * ch);
    mem.lifeNext = new Uint8Array(cw * ch);
    mem.ghost = new Float32Array(cw * ch);
    mem.ghostColour = new Uint8Array(cw * ch);
    mem.lifeW = cw;
    mem.lifeH = ch;
    // a thin soup to start from, so the grid is alive before anything plays
    for (let i = 0; i < mem.life.length; i++) if (Math.random() < 0.06) mem.life[i] = 1 + (i % cs.length);
  }
  let grid = mem.life;
  const ghost = mem.ghost!, ghostColour = mem.ghostColour!;
  const idx = (x: number, y: number) => ((y + ch) % ch) * cw + ((x + cw) % cw);

  // seed: each note, as it starts, drops a small pattern where it is drawn, in its channel's colour
  const now = new Set<string>();
  for (const sp of f.sparks) {
    now.add(sp.key);
    if (mem.sounding.has(sp.key)) continue;
    const h = hash(sp.key);
    const shape = SEEDS[h % SEEDS.length];
    const flipX = h & 8 ? -1 : 1, flipY = h & 16 ? -1 : 1, swap = (h & 32) !== 0;
    const colour = 1 + Math.max(0, cs.indexOf(sp.color));
    const gx = Math.floor(sp.x / c), gy = Math.floor(sp.y / c);
    for (const [a, b] of shape) {
      const [dx, dy] = swap ? [b, a] : [a, b];
      grid[idx(gx + dx * flipX, gy + dy * flipY)] = colour;
    }
  }
  mem.sounding = now;

  // step the generations at a steady rate
  mem.lifeClock += dt;
  let steps = 0;
  while (mem.lifeClock >= 1 / LIFE_RATE && steps < 3) {
    mem.lifeClock -= 1 / LIFE_RATE;
    steps++;
    const next = mem.lifeNext!;
    for (let y = 0; y < ch; y++) {
      // the rows above and below, wrapping round the edges
      const up = ((y + ch - 1) % ch) * cw, row = y * cw, down = ((y + 1) % ch) * cw;
      for (let x = 0; x < cw; x++) {
        const l = x ? x - 1 : cw - 1, r = x + 1 < cw ? x + 1 : 0;
        const n0 = grid[up + l], n1 = grid[up + x], n2 = grid[up + r], n3 = grid[row + l];
        const n4 = grid[row + r], n5 = grid[down + l], n6 = grid[down + x], n7 = grid[down + r];
        const count = (n0 ? 1 : 0) + (n1 ? 1 : 0) + (n2 ? 1 : 0) + (n3 ? 1 : 0) + (n4 ? 1 : 0) + (n5 ? 1 : 0) + (n6 ? 1 : 0) + (n7 ? 1 : 0);
        const i = row + x;
        const alive = grid[i];
        // B3/S23; a newborn takes a parent's colour
        if (alive ? count === 2 || count === 3 : count === 3) next[i] = alive || n0 || n1 || n2 || n3 || n4 || n5 || n6 || n7;
        else {
          next[i] = 0;
          if (alive) (ghost[i] = 1), (ghostColour[i] = alive);
        }
      }
    }
    // the new generation becomes the grid; the old buffer is reused for the next
    mem.lifeNext = grid;
    mem.life = next;
    grid = next;
  }
  mem.lifeClock = Math.min(mem.lifeClock, 1 / LIFE_RATE);

  // draw: the living in full, the just-dead fading behind them; one path per colour
  const live: Path2D[] = cs.map(() => new Path2D());
  const dying: Path2D[] = cs.map(() => new Path2D());
  for (let i = 0; i < grid.length; i++) {
    const x = (i % cw) * c, y = Math.floor(i / cw) * c;
    if (grid[i]) live[(grid[i] - 1) % cs.length].rect(x, y, c, c);
    else if (ghost[i] > 0) {
      ghost[i] = Math.max(0, ghost[i] - dt * 1.6);
      if (ghost[i] > 0.4) dying[(ghostColour[i] - 1) % cs.length].rect(x, y, c, c);
    }
  }
  g.save();
  cs.forEach((col, k) => {
    g.fillStyle = col;
    g.globalAlpha = 0.25;
    g.fill(dying[k]);
    g.globalAlpha = 0.95;
    g.fill(live[k]);
  });
  g.restore();
}

/** One backdrop frame filling W × H. */
export function drawBackdrop(g: CanvasRenderingContext2D, W: number, H: number, P: Palette, f: BackdropFrame, style: Exclude<BackdropStyle, 'off'>, mem: BackdropMemory) {
  takeWave(f, mem);
  const dt = tick(f, mem);
  const cx = W / 2, cy = H / 2;
  if (style === 'waves') waves(g, W, H, P, f, mem, dt);
  else if (style === 'phase') phase(g, cx, cy, W * 0.46, H * 0.46, P, f, mem);
  else if (style === 'eq') eq(g, W, H, P, f, mem, dt);
  else if (style === 'sonogram') sonogram(g, W, H, P, f, mem, dt);
  else life(g, W, H, P, f, mem, dt);
}
