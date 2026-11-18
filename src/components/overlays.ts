/**
 * The math sketches laid faintly over the chrome — title, top bar, side panels, toolbar, sheets —
 * never over the screens (the score / function view and the node board).
 *
 * The drawings are black ink on transparent. For each theme they are re-inked here in the case's
 * --sketch-ink at --sketch-strength (both in retro.css, beside the palette), once, and handed to CSS
 * as --func-overlay-1 / --func-overlay-2 — faint print on the calculator's body.
 */
import sketch1 from '../assets/overlays/funcbg1.png';
import sketch2 from '../assets/overlays/funcbg2.png';

/** if the stylesheet doesn't say: how strongly the ink shows — enough to notice, never enough to read over */
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
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--sketch-ink').trim() || css.getPropertyValue('--ink').trim() || (theme === 'dark' ? '#ebe5d8' : '#2b2a27');
  const strength = Number(css.getPropertyValue('--sketch-strength')) || STRENGTH[theme];
  try {
    const next = await Promise.all([sketch1, sketch2].map((s) => inked(s, ink, strength)));
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
