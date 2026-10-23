import { useMemo, useRef, useState } from 'react';
import { bendCurve } from '../engine/expr';
import { formatCurve, parseCurve, type CurvePoint } from '../engine/graph';

const W = 220, H = 96, PAD = 6;
/** where points snap across a repeat (Shift for free placement) */
const SNAP = 16;
const HIT = 7;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Drag =
  | { kind: 'point'; i: number }
  | { kind: 'bend'; i: number; startY: number; startB: number; moved: boolean; at: { x: number; y: number } }
  | { kind: 'add'; at: { x: number; y: number } };

/**
 * Draw an automation curve, Ableton-style: points sit only on the corners, and the
 * segments between them bend.
 * - click empty space: add a point (snapped to 1/16 of a repeat; Shift places it freely)
 * - drag a point: move it (it stays between its neighbours)
 * - drag a segment up or down: bend it
 * - double-click a point: remove it
 */
export function CurveEditor({ value, onChange, onStart, color }: { value: string; onChange: (v: string) => void; onStart: () => void; color: string }) {
  const pts = useMemo(() => parseCurve(value), [value]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [hover, setHover] = useState<{ point: number | null; seg: number | null }>({ point: null, seg: null });

  const sx = (x: number) => PAD + x * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - y * (H - 2 * PAD);
  /** pointer → curve space (0 → 1 both ways) and pixels */
  const at = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    return { px, py, x: clamp((px - PAD) / (W - 2 * PAD), 0, 1), y: clamp((H - PAD - py) / (H - 2 * PAD), 0, 1), h: r.height };
  };
  const pointAt = (px: number, py: number) => pts.findIndex((p) => Math.hypot(sx(p.x) - px, sy(p.y) - py) <= HIT);
  const segAt = (x: number) => {
    for (let i = 0; i < pts.length - 1; i++) if (x >= pts[i].x && x < pts[i + 1].x) return i;
    return null;
  };
  const snapX = (x: number, free: boolean) => (free ? x : Math.round(x * SNAP) / SNAP);
  const save = (next: CurvePoint[]) => onChange(formatCurve(next));

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const p = at(e);
    const i = pointAt(p.px, p.py);
    onStart();
    svg.current!.setPointerCapture(e.pointerId);
    if (i >= 0) drag.current = { kind: 'point', i };
    else {
      const s = segAt(p.x);
      drag.current = s === null ? { kind: 'add', at: p } : { kind: 'bend', i: s, startY: e.clientY, startB: pts[s].b, moved: false, at: p };
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const p = at(e);
    const d = drag.current;
    if (!d) {
      const i = pointAt(p.px, p.py);
      setHover({ point: i >= 0 ? i : null, seg: i >= 0 ? null : segAt(p.x) });
      return;
    }
    if (d.kind === 'point') {
      const next = pts.map((q) => ({ ...q }));
      const lo = d.i > 0 ? next[d.i - 1].x : 0, hi = d.i < next.length - 1 ? next[d.i + 1].x : 1;
      next[d.i].x = clamp(snapX(p.x, e.shiftKey), lo, hi);
      next[d.i].y = Math.round(p.y * 1000) / 1000;
      save(next);
    } else if (d.kind === 'bend') {
      const dyPx = d.startY - e.clientY;
      if (!d.moved && Math.abs(dyPx) < 3) return;
      d.moved = true;
      const a = pts[d.i], c = pts[d.i + 1];
      const dir = Math.sign(c.y - a.y);
      if (!dir) return; // a flat segment has nothing to bend
      // dragging up lifts the middle of the segment: on a rising segment that means a faster start
      const up = dyPx / p.h;
      const next = pts.map((q) => ({ ...q }));
      next[d.i].b = clamp(Math.round((d.startB - up * 3 * dir) * 1000) / 1000, -1, 1);
      save(next);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    svg.current?.releasePointerCapture(e.pointerId);
    if (!d || d.kind === 'point' || (d.kind === 'bend' && d.moved)) return;
    // a click, not a drag: add a point there
    const x = snapX(d.at.x, e.shiftKey);
    if (pts.some((q) => Math.abs(q.x - x) < 1e-9)) return;
    save([...pts, { x, y: Math.round(d.at.y * 1000) / 1000, b: 0 }]);
  };

  const onDouble = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = at(e);
    const i = pointAt(p.px, p.py);
    if (i < 0 || pts.length <= 2) return;
    onStart();
    save(pts.filter((_, j) => j !== i));
  };

  // the drawn line: flat before the first point and after the last, bent in between
  const line = useMemo(() => {
    const out: string[] = [`M${sx(0)},${sy(pts[0].y)}`, `L${sx(pts[0].x)},${sy(pts[0].y)}`];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], c = pts[i + 1];
      for (let k = 1; k <= 24; k++) {
        const t = k / 24;
        out.push(`L${sx(a.x + (c.x - a.x) * t)},${sy(a.y + (c.y - a.y) * bendCurve(t, a.b))}`);
      }
    }
    out.push(`L${sx(1)},${sy(pts[pts.length - 1].y)}`);
    return out.join('');
  }, [pts]);

  return (
    <svg
      ref={svg}
      className="curve-editor nodrag nowheel nopan"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={() => !drag.current && setHover({ point: null, seg: null })}
      onDoubleClick={onDouble}
      role="img"
      aria-label="Curve — click to add a point, drag a point to move it, drag a segment to bend it, double-click a point to remove it"
      style={{ cursor: hover.point !== null ? 'grab' : hover.seg !== null ? 'ns-resize' : 'crosshair' }}
    >
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} className="curve-grid" x1={sx(g)} x2={sx(g)} y1={PAD} y2={H - PAD} />
      ))}
      <line className="curve-grid" x1={PAD} x2={W - PAD} y1={sy(0.5)} y2={sy(0.5)} />
      <rect className="curve-frame" x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} />
      <path d={`${line}L${sx(1)},${sy(0)}L${sx(0)},${sy(0)}Z`} fill={color} opacity={0.18} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" className="curve-line" />
      {hover.seg !== null && pts[hover.seg].y !== pts[hover.seg + 1].y && (
        <circle className="curve-bend-hint" cx={sx((pts[hover.seg].x + pts[hover.seg + 1].x) / 2)} cy={sy(pts[hover.seg].y + (pts[hover.seg + 1].y - pts[hover.seg].y) * bendCurve(0.5, pts[hover.seg].b))} r={3} />
      )}
      {pts.map((p, i) => (
        <rect key={i} className={`curve-point ${hover.point === i ? 'on' : ''}`} x={sx(p.x) - 3.5} y={sy(p.y) - 3.5} width={7} height={7} stroke={color} />
      ))}
    </svg>
  );
}
