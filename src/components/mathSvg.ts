/**
 * LaTeX as plain SVG shapes (MathJax), as images a canvas can draw — so a video frame can show the
 * math typeset. Unlike KaTeX's HTML, a picture made only of paths draws into a canvas in every
 * browser without spoiling its recording. MathJax is loaded on first use.
 */

export interface MathImage {
  img: HTMLImageElement;
  /** its natural size, in ex (scale by the font size to place it) */
  wEx: number;
  hEx: number;
}

type Convert = (tex: string) => string;
let converting: Promise<Convert> | null = null;

function loadMathJax(): Promise<Convert> {
  converting ??= (async () => {
    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }, { AllPackages }] = await Promise.all([
      import('mathjax-full/js/mathjax.js'),
      import('mathjax-full/js/input/tex.js'),
      import('mathjax-full/js/output/svg.js'),
      import('mathjax-full/js/adaptors/liteAdaptor.js'),
      import('mathjax-full/js/handlers/html.js'),
      import('mathjax-full/js/input/tex/AllPackages.js'),
    ]);
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    // every glyph inside its own picture, so each one stands alone
    const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'local' }) });
    return (tex: string) => adaptor.outerHTML(adaptor.firstChild(doc.convert(tex, { display: true })) as never);
  })();
  return converting;
}

const cache = new Map<string, MathImage | 'loading' | 'failed'>();

/**
 * The math image for `tex` in `colour`, or null while it is being made (ask again next frame).
 * A formula MathJax can't read is remembered as failed, so it isn't tried every frame.
 */
export function mathImage(tex: string, colour: string): MathImage | null {
  const key = `${colour}|${tex}`;
  const hit = cache.get(key);
  if (hit && hit !== 'loading' && hit !== 'failed') return hit;
  if (hit) return null;
  cache.set(key, 'loading');
  void loadMathJax()
    .then((convert) => {
      const svg = convert(tex).replace(/currentColor/g, colour);
      const wEx = parseFloat(/width="([\d.]+)ex"/.exec(svg)?.[1] ?? '0');
      const hEx = parseFloat(/height="([\d.]+)ex"/.exec(svg)?.[1] ?? '0');
      if (!wEx || !hEx || /data-mjx-error/.test(svg)) throw new Error('unreadable');
      const img = new Image();
      img.onload = () => cache.set(key, { img, wEx, hEx });
      img.onerror = () => cache.set(key, 'failed');
      // drawn larger than its natural size, so it stays sharp wherever an SVG is turned to pixels first
      const big = svg.replace(/(width|height)="([\d.]+)ex"/g, (_m, k: string, v: string) => `${k}="${(Number(v) * 24).toFixed(1)}px"`);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(big.includes('xmlns=') ? big : big.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))}`;
    })
    .catch(() => cache.set(key, 'failed'));
  return null;
}

/** is this image still being made? */
export const mathPending = (tex: string, colour: string) => cache.get(`${colour}|${tex}`) === 'loading';

/** start loading MathJax ahead of time (the first formula then appears sooner) */
export const preloadMath = () => void loadMathJax();
