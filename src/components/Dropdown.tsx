import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui';

export interface DropdownItem {
  key: string;
  label: ReactNode;
  hint?: string;
  glyph?: ReactNode;
  selected?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

export interface DropdownGroup {
  title: string;
  items: DropdownItem[];
}

/**
 * A quiet field that opens a grouped list: arrow keys move, Enter picks, Esc closes.
 * `footer` is for anything extra under the list (a custom value, a hint).
 */
export function Dropdown({ value, groups, footer, label, compact = false }: { value: ReactNode; groups: DropdownGroup[]; footer?: ReactNode; label: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    if (!open) return;
    setHl(Math.max(0, flat.findIndex((i) => i.selected)));
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  // keep the highlighted row in view
  useEffect(() => {
    // scroll the list itself — never the panel or the page behind it
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-i="${hl}"]`);
    if (!list || !row) return;
    const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
    if (rr.top < lr.top) list.scrollTop -= lr.top - rr.top;
    else if (rr.bottom > lr.bottom) list.scrollTop += rr.bottom - lr.bottom;
  }, [hl]);

  const pick = (i: number) => {
    flat[i]?.onSelect();
    setOpen(false);
  };

  let i = 0;
  return (
    <div className={`dropdown ${compact ? 'compact' : ''}`} ref={ref}>
      <button
        className={`dropdown-field ${open ? 'open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
            return;
          }
          if (!open) return;
          if (e.key === 'Escape') setOpen(false);
          else if (e.key === 'ArrowDown') (e.preventDefault(), setHl((h) => Math.min(flat.length - 1, h + 1)));
          else if (e.key === 'ArrowUp') (e.preventDefault(), setHl((h) => Math.max(0, h - 1)));
          else if (e.key === 'Enter') (e.preventDefault(), pick(hl));
        }}
      >
        <span className="dropdown-value">{value}</span>
        <span className="dropdown-chevron" aria-hidden>
          ⌄
        </span>
      </button>
      {open && (
        <div className="dropdown-pop" role="listbox" ref={listRef}>
          {groups.map((g) =>
            g.items.length ? (
              <div key={g.title}>
                <h4>{g.title}</h4>
                {g.items.map((it) => {
                  const idx = i++;
                  return (
                    <div key={it.key} className={`dropdown-row ${it.selected ? 'on' : ''} ${idx === hl ? 'hl' : ''}`} data-i={idx}>
                      <button role="option" aria-selected={!!it.selected} onMouseEnter={() => setHl(idx)} onClick={() => pick(idx)}>
                        {it.glyph && <span className="dropdown-glyph">{it.glyph}</span>}
                        <span className="dropdown-text">
                          <span className="dropdown-label">{it.label}</span>
                          {it.hint && <small>{it.hint}</small>}
                        </span>
                      </button>
                      {it.onDelete && (
                        <button className="icon-btn dropdown-del" title="Delete" onClick={it.onDelete}>
                          <Icon name="close" size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null,
          )}
          {footer && <div className="dropdown-footer">{footer}</div>}
        </div>
      )}
    </div>
  );
}
