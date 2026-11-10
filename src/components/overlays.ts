/**
 * The math sketches laid faintly over the chrome — title, top bar, side panels, toolbar, sheets —
 * never over the screens (the score / function / ripple view and the node board).
 *
 * The drawings are black ink on transparent. For each theme they are re-inked here in the theme's
 * own --ink at a low opacity, once, and handed to CSS as --func-overlay-1 / --func-overlay-2.
 */
import sketch1 from '../assets/overlays/funcbg1.png';
import sketch2 from '../assets/overlays/funcbg2.png';

/** how strongly the ink shows, per theme: enough to notice, never enough to read over */
const STRENGTH = { light: 0.075, dark: 0.06 };

const urls: string[] = [];
let painting = 0;

async function inked(src: string, ink: string, alpha: number): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d')!;
  g.globalAlpha = alpha;
  g.drawImage(img, 0, 0);
  // keep the drawing's shape, take the theme's colour
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = ink;
  g.fillRect(0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/webp', 0.9));
  return blob ? URL.createObjectURL(blob) : c.toDataURL();
}

/** re-ink both sketches for the theme now showing (call after data-theme is set) */
export async function paintOverlays(theme: 'light' | 'dark') {
  const run = ++painting;
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || (theme === 'dark' ? '#ebe5d8' : '#2b2a27');
  try {
    const next = await Promise.all([sketch1, sketch2].map((s) => inked(s, ink, STRENGTH[theme])));
    // a newer theme switch won: drop these
    if (run !== painting) return next.forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
    const root = document.documentElement.style;
    next.forEach((u, i) => root.setProperty(`--func-overlay-${i + 1}`, `url("${u}")`));
    urls.splice(0).forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
    urls.push(...next);
  } catch {
    // no sketches is fine: the chrome looks as it always did
  }
}
