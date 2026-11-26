/**
 * A note that sounds burns like a fuse: a spark runs along it from its start to its end, spraying,
 * with an ember glowing just behind it and the cord charred where it has passed; a note too short for
 * a run (a drum hit) catches with a small burst. Pure drawing, driven by the time, so it never stores anything.
 */

/** a deterministic 0…1 for a whole number: the same spark always flies the same way */
const rnd = (n: number) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

const HOT = '#fff4cf';
const FLAME = ['#ffd27a', '#ffa64a', '#ff7a30'];

/**
 * The cord behind the spark: charred from the start of the note to the head, the last stretch an
 * ember fading from orange into the char. Draw it over the note.
 */
export function burnCord(g: CanvasRenderingContext2D, x0: number, y: number, h: number, head: number, round: number) {
  if (head <= x0 + 0.5) return;
  g.save();
  g.beginPath();
  g.roundRect(x0, y, head - x0, h, Math.min(round, h / 2, (head - x0) / 2));
  g.clip();
  g.globalAlpha = 0.5;
  g.fillStyle = '#120a06';
  g.fillRect(x0, y, head - x0, h);
  const ember = Math.min(18, head - x0);
  const grad = g.createLinearGradient(head - ember, 0, head, 0);
  grad.addColorStop(0, 'rgba(255,120,40,0)');
  grad.addColorStop(1, 'rgba(255,150,60,0.95)');
  g.globalAlpha = 1;
  g.fillStyle = grad;
  g.fillRect(head - ember, y, ember, h);
  g.restore();
}

/** the spark at the head of the fuse: a hot, flickering core and a spray of sparks thrown up and back */
export function sparkHead(g: CanvasRenderingContext2D, x: number, y: number, now: number, seed: number, colour: string, size = 1) {
  g.save();
  const flick = 0.8 + 0.2 * Math.sin(now * 47 + seed * 3.1) * Math.sin(now * 23 + seed);
  const r = 7 * size * flick;
  const core = g.createRadialGradient(x, y, 0, x, y, r);
  core.addColorStop(0, HOT);
  core.addColorStop(0.35, FLAME[0]);
  core.addColorStop(0.7, colour);
  core.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = core;
  g.globalAlpha = 0.95;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  // the spray: each spark lives a moment, flies out on its own line and falls a little
  const N = 9;
  for (let i = 0; i < N; i++) {
    const clock = now * 2.6 + i / N + seed * 0.37;
    const life = clock - Math.floor(clock);
    const id = Math.floor(clock) * 31 + i * 7 + seed;
    // mostly up and back, the way a fuse throws them
    const a = -Math.PI / 2 - 0.4 + (rnd(id) - 0.5) * 2.6;
    const speed = (10 + 16 * rnd(id + 1)) * size;
    const px = x + Math.cos(a) * speed * life;
    const py = y + Math.sin(a) * speed * life + 16 * size * life * life;
    g.globalAlpha = (1 - life) * 0.95;
    g.fillStyle = life < 0.25 ? HOT : FLAME[Math.floor(rnd(id + 2) * FLAME.length)];
    const s = Math.max(0.8, 2 * size * (1 - life));
    g.fillRect(px - s / 2, py - s / 2, s, s);
  }
  g.restore();
}

/** a short note catching: a flash and a ring of sparks over its first moment (age in seconds) */
export const POP_SECONDS = 0.4;
export function pop(g: CanvasRenderingContext2D, x: number, y: number, age: number, seed: number, colour: string, size = 1) {
  if (age < 0 || age > POP_SECONDS) return;
  const t = age / POP_SECONDS;
  g.save();
  if (t < 0.3) {
    const r = (5 + 6 * t) * size;
    const flash = g.createRadialGradient(x, y, 0, x, y, r);
    flash.addColorStop(0, HOT);
    flash.addColorStop(0.5, colour);
    flash.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 1 - t / 0.3;
    g.fillStyle = flash;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const N = 10;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (rnd(seed + i) - 0.5) * 0.6;
    const d = (6 + 10 * rnd(seed + i + 40)) * size * (1 - (1 - t) * (1 - t));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + 6 * size * t * t;
    g.globalAlpha = (1 - t) * 0.95;
    g.fillStyle = t < 0.2 ? HOT : FLAME[i % FLAME.length];
    const s = Math.max(0.8, 1.8 * size * (1 - t));
    g.fillRect(px - s / 2, py - s / 2, s, s);
  }
  g.restore();
}
