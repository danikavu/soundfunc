import { useEffect, useRef } from 'react';

/** one dot of the fire, in CSS px (a pixel of gap is left between dots) */
const DOT = 3;
/** heat levels: 0 is cold, LEVELS the white-hot base */
const LEVELS = 24;
/** the fire's palette, cold to hot: deep red, orange, yellow, nearly white */
const STOPS: [number, number, number][] = [
  [90, 10, 6],
  [190, 40, 10],
  [235, 110, 20],
  [250, 190, 50],
  [255, 245, 190],
];
const PALETTE = Array.from({ length: LEVELS + 1 }, (_, i) => {
  if (!i) return '';
  const t = (i / LEVELS) * (STOPS.length - 1);
  const k = Math.min(STOPS.length - 2, Math.floor(t)), u = t - k;
  const [r, g, b] = STOPS[k].map((c, j) => Math.round(c + (STOPS[k + 1][j] - c) * u));
  // faint when cool, so the flames fade out into the key rather than ending in a hard edge
  return `rgba(${r},${g},${b},${(0.1 + 0.32 * (i / LEVELS)).toFixed(3)})`;
});
const TAU = Math.PI * 2;
/** the fire moves at a steady, retro rate */
const TICK = 1 / 30;

/**
 * Pixel flames behind the Sauce knob: none at 0; a little sauce gives low flames along the bottom,
 * full sauce flames about two thirds of the way up with the tips licking higher. The classic
 * demo-scene fire: each dot takes the heat of a dot below it, nudged sideways, a little cooler; the
 * base burns hotter in a few patches that wander, so the fire has tongues rather than a flat top.
 */
export function SauceFlames({ amount }: { amount: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const amountRef = useRef(amount);
  amountRef.current = amount;
  const running = useRef<(() => void) | null>(null);

  useEffect(() => {
    // already burning: it reads the new amount as it goes
    if (running.current || amount <= 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d')!;
    let heat = new Uint8Array(0), cw = 0, ch = 0;
    let raf = 0, last = performance.now(), clock = 0;

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cw = Math.max(1, Math.ceil(w / DOT));
      ch = Math.max(1, Math.ceil(h / DOT));
      heat = new Uint8Array(cw * ch);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    let t = 0;
    const step = () => {
      const a = amountRef.current;
      t += TICK;
      // the base row: hot in proportion to the sauce, in patches that wander, flickering
      const base = (ch - 1) * cw;
      const hot = a > 0 ? LEVELS * (0.45 + 0.55 * a) : 0;
      for (let x = 0; x < cw; x++) {
        const u = x / cw;
        const patch = 0.6 + 0.25 * Math.sin(TAU * (u * 2.3 + t * 0.35)) + 0.15 * Math.sin(TAU * (u * 5.1 - t * 0.6));
        heat[base + x] = Math.max(0, Math.min(LEVELS, Math.round(hot * patch * (0.8 + 0.2 * Math.random()))));
      }
      // heat rises, drifting a dot sideways, and cools by a random amount: the flames reach about
      // (0.2 + 0.45 × sauce) of the height on average, the luckiest tongues higher
      const reach = Math.max(1, ch * (0.2 + 0.45 * a));
      const cool = hot / reach;
      for (let y = 0; y < ch - 1; y++) {
        for (let x = 0; x < cw; x++) {
          const below = heat[(y + 1) * cw + x];
          const drift = Math.floor(Math.random() * 3) - 1;
          const to = y * cw + Math.min(cw - 1, Math.max(0, x + drift));
          heat[to] = Math.max(0, below - Math.floor(Math.random() * (2 * cool + 1)));
        }
      }
    };

    const draw = () => {
      g.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (let level = 1; level <= LEVELS; level++) {
        g.fillStyle = PALETTE[level];
        g.beginPath();
        for (let i = 0; i < heat.length; i++) if (heat[i] === level) g.rect((i % cw) * DOT, Math.floor(i / cw) * DOT, DOT - 1, DOT - 1);
        g.fill();
      }
    };

    const frame = (now: number) => {
      clock += Math.min(0.25, (now - last) / 1000);
      last = now;
      let changed = false;
      while (clock >= TICK) {
        clock -= TICK;
        step();
        changed = true;
      }
      if (changed) draw();
      // turned down to nothing: let the last flames die out, then stop
      if (amountRef.current <= 0 && !heat.some((v) => v > 0)) {
        stop();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      g.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      running.current = null;
    };
    running.current = stop;
    raf = requestAnimationFrame(frame);
  }, [amount]);

  // gone with the panel: put the fire out
  useEffect(() => () => running.current?.(), []);

  return <canvas ref={ref} className="sauce-flames" aria-hidden />;
}
