/**
 * The Scope view: the track as something to watch. Four styles, all drawn around the
 * centre of the view:
 *   pond    — every note drops a stone: rings spread from its place on the circle of notes
 *   sand    — sand on a vibrating plate: each note shakes the plate in its own mode and the
 *             grains gather on the lines that stay still (Chladni figures)
 *   halo    — the live waveform bent into a ring
 *   phase   — the waveform against itself a moment later: a Lissajous phase portrait
 * Pond and Sand read the score (Sand's figure follows the notes, the sound shakes it); Halo and
 * Phase read the sound. (The code still calls the view "ripple": saved settings keep working.)
 */
import type { Note, Track } from '../engine/project';

export type RippleStyle = 'pond' | 'sand' | 'halo' | 'phase';
export const RIPPLE_STYLES: { value: RippleStyle; label: string; hint: string }[] = [
  { value: 'pond', label: 'Pond', hint: 'every note drops a stone on the circle of notes' },
  { value: 'sand', label: 'Sand', hint: 'sand on a vibrating plate — each note shakes out its own figure' },
  { value: 'halo', label: 'Halo', hint: 'the live waveform bent into a ring' },
  { value: 'phase', label: 'Phase', hint: 'the wave against itself a moment later — a Lissajous figure' },
];

export interface RippleOptions {
  style: RippleStyle;
  /** older frames linger and fade */
  trails: boolean;
  /** channels' own colours, or one ink */
  colour: 'channels' | 'ink';
}
export const RIPPLE_DEFAULTS: RippleOptions = { style: 'pond', trails: true, colour: 'channels' };

export interface RippleScore {
  melodic: { track: Track; notes: Note[]; glide: [number, number, number][] }[];
  drums: { track: Track; notes: Note[] }[];
  total: number;
}

export interface RippleFrame {
  wave: Float32Array | null;
  /** the playhead within the pass, in beats (null when stopped) */
  playBeat: number | null;
  secPerBeat: number;
  score: RippleScore;
  /** seconds, for idle motion */
  now: number;
}

interface Palette {
  ink: string;
  ink3: string;
  rake: string;
  accent: string;
  glow: number;
}

/** what persists between frames: the trails */
export class RippleMemory {
  waves: Float32Array[] = [];
  /** the recent loudest sample: quiet music is scaled up so the figures keep their size */
  level = 0.05;
  /** Sand's plate: the grains and the mode it rings in */
  sand: Sand | null = null;
  push(w: Float32Array, keep: number) {
    this.waves.unshift(w);
    if (this.waves.length > keep) this.waves.length = keep;
  }
}

const TAU = Math.PI * 2;
const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** the colours to draw with: the audible channels', or the one ink */
function colours(frame: RippleFrame, opts: RippleOptions, P: Palette): string[] {
  if (opts.colour === 'ink') return [P.accent];
  const cs = [...frame.score.melodic, ...frame.score.drums].map((it) => it.track.color);
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

function backdrop(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, P: Palette, now: number, rings = 7, width = 1) {
  g.save();
  g.strokeStyle = P.rake;
  g.lineWidth = width;
  // raked sand: rings that breathe very slightly
  for (let i = 1; i <= rings; i++) {
    const r = R * (0.18 + (i / rings) * 0.95) + Math.sin(now * 0.6 + i * 0.8) * 1.2;
    g.globalAlpha = 0.35 + 0.4 * (1 - i / rings);
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.stroke();
  }
  g.restore();
}

// ---------- pond: notes as stones ----------

function pond(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, P: Palette, f: RippleFrame, opts: RippleOptions) {
  backdrop(g, cx, cy, R, P, f.now, 5, 0.5);
  // the circle of notes: C at the top, a semitone every 30°
  g.save();
  g.font = '10.5px Doto, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = P.ink3;
  for (let pc = 0; pc < 12; pc++) {
    const a = (pc / 12) * TAU - Math.PI / 2;
    g.globalAlpha = 0.55;
    g.fillText(NOTE_NAMES[pc], cx + Math.cos(a) * (R * 1.16), cy + Math.sin(a) * (R * 1.16));
    g.globalAlpha = 0.25;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2);
    g.lineTo(cx + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 1.05);
    g.strokeStyle = P.rake;
    g.lineWidth = 0.5;
    g.stroke();
  }
  g.restore();

  // the register sets how far out a stone lies: low notes near the centre
  let lo = 127, hi = 0;
  for (const it of f.score.melodic) {
    for (const n of it.notes) (lo = Math.min(lo, n.midi)), (hi = Math.max(hi, n.midi));
    for (const [, m, v] of it.glide) if (v >= 0.01) (lo = Math.min(lo, m)), (hi = Math.max(hi, m));
  }
  if (lo > hi) (lo = 48), (hi = 72);
  const place = (midi: number) => {
    const a = ((((midi % 12) + 12) % 12) / 12) * TAU - Math.PI / 2;
    const r = R * (0.3 + 0.68 * ((midi - lo) / Math.max(1, hi - lo)));
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };
  const total = f.score.total;
  const life = opts.trails ? 2.6 : 1.4; // seconds a ripple spreads for
  const ageOf = (beat: number) => {
    if (f.playBeat === null) return Infinity;
    let age = (f.playBeat - beat) * f.secPerBeat;
    if (age < 0) age += total * f.secPerBeat;
    return age;
  };
  const colourOf = (track: Track) => (opts.colour === 'ink' ? P.accent : track.color);

  const ring = (x: number, y: number, t: number, size: number, colour: string, weight: number) => {
    for (const lag of opts.trails ? [0, 0.18, 0.36] : [0]) {
      const tt = t - lag;
      if (tt <= 0 || tt >= 1) continue;
      g.globalAlpha = (1 - tt) * (1 - lag) * 0.75 * weight;
      g.strokeStyle = colour;
      g.lineWidth = 0.45 + (1 - tt) * 0.35; // hairlines: the rings stay fine as they spread
      g.beginPath();
      g.arc(x, y, 3 + tt * size, 0, TAU);
      g.stroke();
    }
  };

  g.save();
  if (P.glow > 0) g.shadowBlur = 8 * P.glow;
  for (const { track, notes, glide } of f.score.melodic) {
    const c = colourOf(track);
    if (P.glow > 0) g.shadowColor = c;
    // a glide: a comet tracing its pitch round the circle
    if (glide.length) {
      if (f.playBeat === null) continue;
      g.strokeStyle = c;
      g.lineCap = 'round';
      let prev: readonly [number, number] | null = null;
      for (const [b, m, v] of glide) {
        const age = ageOf(b);
        if (age > (opts.trails ? 1.6 : 0.6) || v < 0.01) {
          prev = null;
          continue;
        }
        const p = place(m);
        if (prev) {
          g.globalAlpha = (1 - age / (opts.trails ? 1.6 : 0.6)) * 0.9;
          g.lineWidth = 0.5 + 0.7 * (1 - age / 1.6);
          g.beginPath();
          g.moveTo(prev[0], prev[1]);
          g.lineTo(p[0], p[1]);
          g.stroke();
        }
        prev = p;
      }
      continue;
    }
    for (const n of notes) {
      const [x, y] = place(n.midi);
      const age = ageOf(n.beat);
      const sounding = f.playBeat !== null && f.playBeat >= n.beat && f.playBeat < n.beat + Math.max(n.duration, 0.05);
      // the stone itself: faint when silent, lit while it sounds
      g.globalAlpha = sounding ? 1 : f.playBeat === null ? 0.5 : 0.18;
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, sounding ? 4.5 : 2.6, 0, TAU);
      g.fill();
      if (age < life) ring(x, y, age / life, R * 0.42 * (0.5 + n.velocity), c, 0.5 + n.velocity * 0.5);
    }
  }
  // drums splash at the centre: the kick widest, hats as a ripple of sparks on the inner ring
  for (const { track, notes } of f.score.drums) {
    const c = colourOf(track);
    if (P.glow > 0) g.shadowColor = c;
    const w = track.waveform;
    for (const n of notes) {
      const age = ageOf(n.beat);
      if (age >= life) continue;
      const t = age / life;
      if (w === 'kick' || w === 'tom') ring(cx, cy, t, R * (w === 'kick' ? 1.1 : 0.7), c, n.velocity);
      else if (w === 'snare' || w === 'clap') ring(cx, cy, t, R * 0.8, c, n.velocity * 0.8);
      else {
        const a = (n.step * 2.39996) % TAU; // golden angle: sparks never stack
        ring(cx + Math.cos(a) * R * 0.22, cy + Math.sin(a) * R * 0.22, t, R * 0.18, c, n.velocity * 0.7);
      }
    }
  }
  g.restore();
}

// ---------- halo / phase: the live waveform ----------

function waveRing(g: CanvasRenderingContext2D, w: Float32Array, start: number, cx: number, cy: number, r0: number, amp: number, from: number, to: number, mirror: boolean, N: number) {
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // mirrored: the wave runs out and back, so the two ends meet without a seam
    const k = mirror ? (u < 0.5 ? u * 2 : (1 - u) * 2) : u;
    const s = w[start + Math.min(w.length - start - 1, Math.floor(k * (N - 1)))] ?? 0;
    const a = from + (to - from) * u;
    const r = r0 + s * amp;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
}

function halo(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, P: Palette, f: RippleFrame, opts: RippleOptions, mem: RippleMemory) {
  backdrop(g, cx, cy, R, P, f.now);
  const cs = colours(f, opts, P);
  const paint = ringPaint(g, cx, cy, cs, f.now * 0.15);
  const frames = mem.waves.length ? mem.waves : [];
  g.save();
  g.lineJoin = 'round';
  if (P.glow > 0) (g.shadowBlur = 10 * P.glow), (g.shadowColor = cs[0]);
  frames.forEach((w, i) => {
    g.globalAlpha = i === 0 ? 0.95 : 0.5 * (1 - i / frames.length);
    g.lineWidth = i === 0 ? 1.8 : 1;
    g.strokeStyle = paint;
    // older frames sit a little further out, like rings spreading
    waveRing(g, w, 0, cx, cy, R * (0.72 + i * 0.045), R * 0.45, -Math.PI / 2, TAU - Math.PI / 2, true, 512);
    g.stroke();
  });
  g.restore();
}

function phase(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, P: Palette, f: RippleFrame, opts: RippleOptions, mem: RippleMemory) {
  // axes: a quiet cross and a unit circle
  g.save();
  g.strokeStyle = P.rake;
  g.globalAlpha = 0.7;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - R * 1.15, cy);
  g.lineTo(cx + R * 1.15, cy);
  g.moveTo(cx, cy - R * 1.15);
  g.lineTo(cx, cy + R * 1.15);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.stroke();
  g.restore();
  const cs = colours(f, opts, P);
  const paint = ringPaint(g, cx, cy, cs, f.now * 0.2);
  g.save();
  g.lineJoin = 'round';
  if (P.glow > 0) (g.shadowBlur = 10 * P.glow), (g.shadowColor = cs[0]);
  mem.waves.forEach((w, h) => {
    // x = the wave now, y = the wave a quarter of a cycle later: a sine draws a circle, harmonics knot it
    const d = 24;
    g.globalAlpha = h === 0 ? 0.95 : 0.45 * (1 - h / mem.waves.length);
    g.lineWidth = h === 0 ? 1.4 : 1;
    g.strokeStyle = paint;
    g.beginPath();
    const len = Math.min(w.length - d, 900);
    for (let i = 0; i < len; i++) {
      const x = cx + w[i] * R * 1.5, y = cy - w[i + d] * R * 1.5;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  });
  g.restore();
}

// ---------- sand: Chladni figures on a vibrating plate ----------

/** a plate mode: n × m half-waves, the two degenerate shapes added (+1) or taken apart (−1) */
type Mode = readonly [n: number, m: number, sign: 1 | -1];
/** every mode up to 8 half-waves (beyond that the figures turn to noise), simplest first — a note picks one by its pitch */
const MODES: Mode[] = (() => {
  const out: Mode[] = [];
  for (let n = 1; n <= 8; n++) for (let m = n + 1; m <= 8; m++) for (const sg of [-1, 1] as const) out.push([n, m, sg]);
  return out.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]) || a[2] - b[2]);
})();
/** the lowest note that has its own figure; each semitone up is the next mode */
const SAND_LOW = 33;
const GRAINS = 5200;

interface Sand {
  x: Float32Array;
  y: Float32Array;
  px: Float32Array;
  py: Float32Array;
  /** the figure now, and the one it is leaving (blended over a moment) */
  mode: [Mode, Mode | null, number];
  prev: [Mode, Mode | null, number] | null;
  blend: number;
  /** how hard the plate shakes, 0 … 1 */
  shake: number;
  last: number;
  lastHit: number;
  label: string;
}

/** the plate's displacement at (u, v) in −1 … 1 for one mode */
function modeAt(md: Mode, u: number, v: number): number {
  const a = (Math.PI * (u + 1)) / 2, b = (Math.PI * (v + 1)) / 2;
  return (Math.cos(md[0] * a) * Math.cos(md[1] * b) + md[2] * Math.cos(md[1] * a) * Math.cos(md[0] * b)) * 0.5;
}
function figureAt(fig: [Mode, Mode | null, number], u: number, v: number): number {
  const a = modeAt(fig[0], u, v);
  return fig[1] ? (a + fig[2] * modeAt(fig[1], u, v)) / (1 + fig[2]) : a;
}
const modeFor = (midi: number) => MODES[Math.max(0, Math.min(MODES.length - 1, Math.round(midi) - SAND_LOW))];

/**
 * One step per grain. Sand on a ringing plate is thrown about where the plate moves and left alone
 * where it doesn't, so it drifts down the slope of the motion (f²) onto the still lines, with a jitter
 * as big as the motion under it — on a line the jitter is gone and the grain stays put.
 */
function shakeGrains(s: Sand, fig: (u: number, v: number) => number, drift: number, jitter: number) {
  const e = 0.006;
  for (let i = 0; i < GRAINS; i++) {
    let x = s.x[i], y = s.y[i];
    const f0 = fig(x, y);
    const fx = fig(x + e, y) - fig(x - e, y), fy = fig(x, y + e) - fig(x, y - e);
    // ∇(f²) = 2 f ∇f; the gradient is normalised so steep figures and gentle ones settle alike
    const gl = Math.hypot(fx, fy) || 1;
    const amp = Math.abs(f0);
    // one grain in sixteen is a stray that barely settles
    const stray = (i & 15) === 0;
    const d = drift * Math.sign(f0) * Math.min(1, amp * 6) * (stray ? 0.25 : 1);
    x -= d * (fx / gl);
    y -= d * (fy / gl);
    // a little scatter even on a line, so it reads as sand, not ink
    const j = jitter * (amp * 1.6 + (stray ? 0.5 : 0.05));
    x += (Math.random() - 0.5) * j;
    y += (Math.random() - 0.5) * j;
    // the plate's free edges: grains bounce back in
    if (x < -1) x = -2 - x;
    if (x > 1) x = 2 - x;
    if (y < -1) y = -2 - y;
    if (y > 1) y = 2 - y;
    s.x[i] = x;
    s.y[i] = y;
  }
}

function newSand(): Sand {
  const s: Sand = {
    x: new Float32Array(GRAINS), y: new Float32Array(GRAINS), px: new Float32Array(GRAINS), py: new Float32Array(GRAINS),
    mode: [MODES[9], null, 0], prev: null, blend: 1, shake: 0, last: 0, lastHit: -1, label: '',
  };
  for (let i = 0; i < GRAINS; i++) (s.x[i] = Math.random() * 2 - 1), (s.y[i] = Math.random() * 2 - 1);
  // settle once, so the plate already shows a figure before anything plays
  const fig = s.mode;
  for (let it = 0; it < 90; it++) shakeGrains(s, (u, v) => figureAt(fig, u, v), 0.012, 0.05);
  s.px.set(s.x);
  s.py.set(s.y);
  return s;
}

function sand(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, P: Palette, f: RippleFrame, opts: RippleOptions, mem: RippleMemory, loud: number) {
  const s = (mem.sand ??= newSand());
  const dt = Math.min(0.1, Math.max(0, f.now - s.last || 1 / 60));
  s.last = f.now;

  // which notes sound now: the two strongest set the figure
  const sounding: { midi: number; vel: number; colour: string }[] = [];
  if (f.playBeat !== null) {
    const pb = f.playBeat;
    for (const { track, notes, glide } of f.score.melodic) {
      for (const n of notes) if (pb >= n.beat && pb < n.beat + Math.max(n.duration, 0.05)) sounding.push({ midi: n.midi, vel: n.velocity, colour: track.color });
      if (glide.length) {
        let best: [number, number, number] | null = null;
        for (const p of glide) if (p[0] <= pb && (!best || p[0] > best[0])) best = p;
        if (best && best[2] >= 0.01) sounding.push({ midi: best[1], vel: best[2], colour: track.color });
      }
    }
    // a kick or a snare jolts the plate
    for (const { track, notes } of f.score.drums)
      for (const n of notes)
        if (pb >= n.beat && pb < n.beat + 0.06 && n.beat !== s.lastHit && (track.waveform === 'kick' || track.waveform === 'snare' || track.waveform === 'clap' || track.waveform === 'tom')) {
          s.lastHit = n.beat;
          s.shake = Math.min(1, s.shake + 0.35 * n.velocity);
        }
  }
  // the melody leads: the highest note sets the figure, the next one down shades it
  sounding.sort((a, b) => b.midi - a.midi);
  const top = sounding.filter((x, i) => sounding.findIndex((y) => Math.round(y.midi) === Math.round(x.midi)) === i).slice(0, 2);
  if (top.length) {
    const next: [Mode, Mode | null, number] = [modeFor(top[0].midi), top[1] ? modeFor(top[1].midi) : null, top[1] ? Math.min(1, top[1].vel / Math.max(0.01, top[0].vel)) * 0.35 : 0];
    if (next[0] !== s.mode[0] || next[1] !== s.mode[1]) {
      s.prev = s.blend < 1 && s.prev ? s.prev : s.mode;
      s.mode = next;
      s.blend = 0;
    }
    s.label = top.map((t) => midiName(t.midi)).join(' + ');
  }
  // the music stops: the second note lets go and the plate resolves into the melody's own, symmetric figure
  if (f.playBeat === null && s.mode[1]) {
    s.prev = s.mode;
    s.mode = [s.mode[0], null, 0];
    s.blend = 0;
    s.label = s.label.split(' + ')[0];
  }
  s.blend = Math.min(1, s.blend + dt / 0.35);

  // how hard it shakes: the sound's level, eased; it settles when the music stops
  const target = f.playBeat === null ? 0 : Math.min(1, loud * 2.2);
  s.shake += (target - s.shake) * Math.min(1, dt * (target > s.shake ? 12 : 2.2));

  const cur = s.mode, prev = s.prev, t = s.blend * s.blend * (3 - 2 * s.blend);
  const fig = prev && t < 1 ? (u: number, v: number) => (1 - t) * figureAt(prev, u, v) + t * figureAt(cur, u, v) : (u: number, v: number) => figureAt(cur, u, v);
  s.px.set(s.x);
  s.py.set(s.y);
  // always a gentle settle, so a figure left half-made when the music stops still finishes, like a plate ringing down;
  // the shake adds the throw and the jitter on top
  const steps = 2, k = Math.min(1.5, dt * 60);
  for (let i = 0; i < steps; i++) shakeGrains(s, fig, (0.003 + 0.01 * s.shake) * k, (0.03 + 0.1 * s.shake) * k);

  // the plate: a square of brushed metal on a hairline frame
  const half = R * 1.12;
  g.save();
  const plate = g.createRadialGradient(cx, cy - half * 0.3, half * 0.1, cx, cy, half * 1.5);
  plate.addColorStop(0, P.rake);
  plate.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = plate;
  g.fillRect(cx - half, cy - half, half * 2, half * 2);
  g.strokeStyle = P.ink3;
  g.globalAlpha = 0.5;
  g.lineWidth = 0.6;
  g.strokeRect(cx - half + 0.5, cy - half + 0.5, half * 2 - 1, half * 2 - 1);
  // the post it is clamped on, at the centre
  g.globalAlpha = 0.35;
  g.beginPath();
  g.arc(cx, cy, 2.2, 0, TAU);
  g.fillStyle = P.ink3;
  g.fill();

  // the grains: one colour each (the channels', or the ink), drawn in batches
  const cs = opts.colour === 'ink' ? [P.ink] : top.length ? top.map((x) => x.colour) : colours(f, opts, P);
  const size = Math.max(1.1, R / 190);
  if (P.glow > 0) (g.shadowBlur = 3 * P.glow), (g.shadowColor = cs[0]);
  for (let c = 0; c < cs.length; c++) {
    g.fillStyle = cs[c];
    g.strokeStyle = cs[c];
    g.globalAlpha = 0.9;
    g.beginPath();
    for (let i = c; i < GRAINS; i += cs.length) {
      const x = cx + s.x[i] * half, y = cy + s.y[i] * half;
      g.rect(x - size / 2, y - size / 2, size, size);
    }
    g.fill();
    // trails: each grain's hop this frame, as a faint streak
    if (opts.trails && s.shake > 0.05) {
      g.globalAlpha = 0.25;
      g.lineWidth = size * 0.6;
      g.beginPath();
      for (let i = c; i < GRAINS; i += cs.length) {
        g.moveTo(cx + s.px[i] * half, cy + s.py[i] * half);
        g.lineTo(cx + s.x[i] * half, cy + s.y[i] * half);
      }
      g.stroke();
    }
  }
  g.shadowBlur = 0;
  // what rings the plate: the note(s) and their mode, quietly under it
  g.globalAlpha = 0.6;
  g.fillStyle = P.ink3;
  g.font = '10px Doto, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  const m = s.mode[0];
  g.fillText(`${s.label ? `${s.label}  ·  ` : ''}mode ${m[0]}, ${m[1]}${m[2] < 0 ? ' −' : ' +'}`, cx, cy + half + 8);
  g.restore();
}

const midiName = (m: number) => `${NOTE_NAMES[((Math.round(m) % 12) + 12) % 12]}${Math.floor(Math.round(m) / 12) - 1}`;

/**
 * Draw one frame centred in a W × H canvas, below `top` px of header.
 * Returns false when there is nothing live to show (silent), so the caller can say so.
 */
export function drawRipple(g: CanvasRenderingContext2D, W: number, H: number, top: number, bottom: number, P: Palette, f: RippleFrame, opts: RippleOptions, mem: RippleMemory): boolean {
  // the centre of the space between the header and the options bar, so the figure sits in the middle of what you see
  const cx = W / 2, cy = top + (H - top - bottom) / 2;
  const R = Math.max(20, Math.min(W * 0.5, H - top - bottom) * 0.38);
  const silent = quiet(f.wave);
  // the raw level (before the automatic gain), for how hard Sand's plate shakes
  let loud = 0;
  if (f.wave && !silent) {
    let sum = 0;
    for (let i = 0; i < f.wave.length; i += 4) sum += f.wave[i] * f.wave[i];
    loud = Math.sqrt(sum / (f.wave.length / 4)) * 3;
  }
  // keep a steady copy of this frame's wave for the trails
  const span = 1024;
  const copy = new Float32Array(span);
  if (silent || !f.wave) {
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
  mem.push(copy, opts.trails ? 7 : 1);
  switch (opts.style) {
    case 'pond':
      pond(g, cx, cy, R, P, f, opts);
      return f.playBeat !== null;
    case 'sand':
      sand(g, cx, cy, R, P, f, opts, mem, loud);
      return f.playBeat !== null;
    case 'halo':
      halo(g, cx, cy, R, P, f, opts, mem);
      break;
    case 'phase':
      phase(g, cx, cy, R, P, f, opts, mem);
      break;
  }
  return !silent;
}

