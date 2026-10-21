import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CONSTANTS, FUNCTIONS, parse, tryCompile } from '../engine/expr';
import { toTex } from '../engine/symbolic';
import { Tex, useKatex } from './tex';
import { useStore } from '../state/store';
import { toast } from './TopBar';

export const NODE_VARS: Record<string, string> = {
  n: 'step 0, 1, 2…',
  x: 'progress through the loop, 0 → 1',
  t: 'time in beats',
  k: 'loop count',
  h: 'current chord (scale degree)',
  bar: 'bar number',
  L: 'scale degrees per octave',
  steps: 'loop length in steps',
  a: 'input a',
  b: 'input b',
  c: 'input c',
};

interface Suggestion {
  name: string;
  kind: 'fn' | 'var' | 'const';
  doc: string;
}

/** the identifier being typed just before the caret */
function wordAt(text: string, caret: number): { start: number; word: string } | null {
  const m = /[A-Za-z_][A-Za-z0-9_]*$/.exec(text.slice(0, caret));
  if (!m) return null;
  // not inside a number like 2e5 or a hex literal
  if (/[0-9.]$/.test(text.slice(0, m.index))) return null;
  return { start: m.index, word: m[0] };
}

/** the number under (or touching) the caret */
function numberAt(text: string, caret: number): { start: number; end: number; value: number; decimals: number } | null {
  const re = /\d*\.?\d+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index, end = start + m[0].length;
    if (caret >= start && caret <= end) {
      // leave hex/binary literals and identifiers like f2 alone
      if (/[A-Za-z_]$/.test(text.slice(0, start)) || /^[xXbB]/.test(text.slice(end))) return null;
      const neg = text[start - 1] === '-' && !/[\w)\]]\s*$/.test(text.slice(0, start - 1));
      const value = Number(m[0]) * (neg ? -1 : 1);
      return { start: neg ? start - 1 : start, end, value, decimals: (m[0].split('.')[1] ?? '').length };
    }
  }
  return null;
}

export function FormulaEditor({
  value,
  onValue,
  vars = NODE_VARS,
  onFocus,
  className = '',
  /** show typeset math while not editing */
  pretty = true,
  /** Alt+S turns the number under the caret into a song slider */
  sliders,
}: {
  value: string;
  onValue: (v: string) => void;
  vars?: Record<string, string>;
  onFocus?: () => void;
  className?: string;
  pretty?: boolean;
  /** the track whose sliders this formula reads — enables Alt+S */
  sliders?: string;
}) {
  const [editing, setEditing] = useState(false);
  // the text belongs to the box while it is being edited (see TextField in ui.tsx)
  const [draft, setDraft] = useState(value);
  const pendingCaret = useRef<number | null>(null);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });
  const [menu, setMenu] = useState<{ items: Suggestion[]; start: number; word: string; hl: number } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { error } = tryCompile(editing ? draft : value, Object.keys(vars));
  const katex = useKatex(pretty);
  const tex = useMemo(() => {
    if (!pretty || error) return null;
    try {
      return toTex(parse(value).ast);
    } catch {
      return null;
    }
  }, [value, error, pretty]);

  const all = useMemo<Suggestion[]>(
    () => [
      ...Object.entries(vars).map(([name, doc]) => ({ name, kind: 'var' as const, doc })),
      ...Object.keys(CONSTANTS).map((name) => ({ name, kind: 'const' as const, doc: CONSTANTS[name].toFixed(4) })),
      ...Object.entries(FUNCTIONS).map(([name, f]) => ({ name, kind: 'fn' as const, doc: f.doc })),
    ],
    [vars],
  );

  const refreshMenu = (text: string, caret: number) => {
    const w = wordAt(text, caret);
    if (!w) return setMenu(null);
    const q = w.word.toLowerCase();
    const items = all
      .filter((s) => s.name.toLowerCase().startsWith(q) && s.name !== w.word)
      .concat(all.filter((s) => !s.name.toLowerCase().startsWith(q) && s.doc.toLowerCase().includes(q) && q.length > 2))
      .slice(0, 7);
    setMenu(items.length ? { items, start: w.start, word: w.word, hl: 0 } : null);
  };

  const replace = (start: number, end: number, insert: string, caret: number) => {
    const next = draft.slice(0, start) + insert + draft.slice(end);
    setDraft(next);
    onValue(next);
    pendingCaret.current = caret;
  };

  const accept = (s: Suggestion) => {
    if (!menu) return;
    const end = menu.start + menu.word.length;
    const insert = s.kind === 'fn' ? `${s.name}(` : s.name;
    replace(menu.start, end, insert, menu.start + insert.length);
    setMenu(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation(); // keep React Flow's ⌫ and the app's shortcuts out of the text box
    if (menu) {
      if (e.key === 'ArrowDown') return e.preventDefault(), setMenu({ ...menu, hl: (menu.hl + 1) % menu.items.length });
      if (e.key === 'ArrowUp') return e.preventDefault(), setMenu({ ...menu, hl: (menu.hl - 1 + menu.items.length) % menu.items.length });
      if (e.key === 'Tab' || e.key === 'Enter') return e.preventDefault(), accept(menu.items[menu.hl]);
      if (e.key === 'Escape') return e.preventDefault(), setMenu(null);
    }
    // Alt+S: this number becomes a named slider you can perform with
    if (sliders && e.altKey && e.code === 'KeyS') {
      const el = e.currentTarget;
      const num = numberAt(draft, el.selectionStart);
      e.preventDefault();
      if (!num) return toast('Put the cursor on a number, then Alt+S makes it a slider');
      const name = useStore.getState().addSlider(sliders, num.value);
      replace(num.start, num.end, name, num.start + name.length);
      toast(`“${name}” is now a slider on this channel — rename or play it in the Sliders bar`);
      return;
    }
    // Alt+↑/↓ nudges the number under the caret — Shift ×10, Ctrl/⌘ ×0.1
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const el = e.currentTarget;
      const num = numberAt(draft, el.selectionStart);
      if (!num) return;
      e.preventDefault();
      let step = num.decimals ? 10 ** -num.decimals : 1;
      if (e.shiftKey) step *= 10;
      if (e.metaKey || e.ctrlKey) step /= 10;
      const decimals = Math.max(num.decimals, e.metaKey || e.ctrlKey ? num.decimals + 1 : 0);
      const next = Number((num.value + (e.key === 'ArrowUp' ? step : -step)).toFixed(decimals));
      const text = next < 0 && num.start > 0 && /[\w)\]]\s*$/.test(draft.slice(0, num.start)) ? `(${next})` : String(next);
      replace(num.start, num.end, text, num.start + text.length);
    }
  };

  if (pretty && !editing && tex) {
    return (
      <div
        className={`formula formula-math nodrag ${className}`}
        role="button"
        tabIndex={0}
        title="Click to edit"
        onClick={() => {
          setEditing(true);
          requestAnimationFrame(() => ref.current?.focus());
        }}
        onFocus={() => {
          setEditing(true);
          requestAnimationFrame(() => ref.current?.focus());
        }}
      >
        <Tex tex={tex} katex={katex} display={false} className="tex-inline" />
      </div>
    );
  }

  return (
    <div className="formula-edit">
      <textarea
        ref={ref}
        className={`formula nodrag nowheel ${error ? 'bad' : ''} ${className}`}
        value={draft}
        spellCheck={false}
        rows={1}
        onFocus={() => {
          setEditing(true);
          onFocus?.();
        }}
        onBlur={() => {
          setEditing(false);
          setMenu(null);
        }}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          onValue(v);
          refreshMenu(v, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onClick={(e) => refreshMenu(draft, e.currentTarget.selectionStart)}
      />
      {menu && (
        <div className="ac-menu nowheel" onMouseDown={(e) => e.preventDefault()}>
          {menu.items.map((s, i) => (
            <button key={s.name} className={i === menu.hl ? 'hl' : ''} onMouseEnter={() => setMenu({ ...menu, hl: i })} onClick={() => accept(s)}>
              <code>
                {s.name}
                {s.kind === 'fn' ? '(…)' : ''}
              </code>
              <small>{s.doc}</small>
            </button>
          ))}
          <div className="ac-hint">Tab to insert · Alt+↑↓ nudges numbers{sliders ? ' · Alt+S makes a slider' : ''}</div>
        </div>
      )}
      {error && <div className="fnode-error">{error}</div>}
    </div>
  );
}
