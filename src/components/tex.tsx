import { useEffect, useMemo, useState } from 'react';

export type Katex = typeof import('katex').default;

let loaded: Katex | null = null;
let loading: Promise<Katex> | null = null;

/** KaTeX is loaded on first use — it's the heaviest part of the page. */
function loadKatex(): Promise<Katex> {
  loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => (loaded = m.default));
  return loading;
}

export function useKatex(enabled = true): Katex | null {
  const [k, setK] = useState<Katex | null>(loaded);
  useEffect(() => {
    if (!enabled || k) return;
    let live = true;
    void loadKatex().then((m) => live && setK(() => m));
    return () => {
      live = false;
    };
  }, [enabled, k]);
  return k;
}

export function Tex({ tex, katex, display = true, className = 'tex' }: { tex: string; katex: Katex | null; display?: boolean; className?: string }) {
  const html = useMemo(
    () =>
      katex
        ? katex
            .renderToString(tex, { displayMode: display, throwOnError: false, strict: false })
            // KaTeX writes very tall ⌊ ⌋ / ⌈ ⌉ paths with a doubled "MM" command, which browsers reject
            .replace(/\s*MM(?=\d)/g, ' M')
        : null,
    [tex, katex, display],
  );
  return html ? <div className={className} dangerouslySetInnerHTML={{ __html: html }} /> : <code className="tex-raw">{tex}</code>;
}
