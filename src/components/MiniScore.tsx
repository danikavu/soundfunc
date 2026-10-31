import { memo, useEffect, useRef, useState } from 'react';
import { cachedMini, miniScore, rememberMini, songKey, MINI_H, MINI_W, type MiniScore as Mini } from '../engine/preview';
import type { Track } from '../engine/project';
import { fitToSong, useStore } from '../state/store';

// ---------- one IntersectionObserver for every row ----------

const watchers = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | null = null;
function watch(el: Element, cb: (visible: boolean) => void) {
  // a little ahead of the scroll, so previews are drawn by the time they're seen
  observer ??= new IntersectionObserver((entries) => entries.forEach((e) => watchers.get(e.target)?.(e.isIntersecting)), { rootMargin: '120px 0px' });
  watchers.set(el, cb);
  observer.observe(el);
  return () => {
    watchers.delete(el);
    observer?.unobserve(el);
  };
}

// ---------- drawing in idle time, a few at a time ----------

type Job = { run: () => void; alive: boolean };
const queue: Job[] = [];
let pending = false;
const idle: (fn: (deadline?: IdleDeadline) => void) => void =
  typeof requestIdleCallback === 'function' ? (fn) => requestIdleCallback(fn, { timeout: 200 }) : (fn) => setTimeout(fn, 16);
function enqueue(run: () => void): Job {
  const job = { run, alive: true };
  queue.push(job);
  if (!pending) {
    pending = true;
    idle(drain);
  }
  return job;
}
function drain(deadline?: IdleDeadline) {
  const until = performance.now() + 6; // never hold the main thread long enough to drop a frame
  while (queue.length && (deadline ? deadline.timeRemaining() > 1 || deadline.didTimeout : true) && performance.now() < until) {
    const job = queue.shift()!;
    if (job.alive) job.run();
  }
  if (queue.length) idle(drain);
  else pending = false;
}

/**
 * A small drawing of what a function plays — rendered with the song's key, scale, harmony and
 * Length, only once its row is on screen, in idle time, and cached per song setting.
 * `id` names the drawing (a preset id, or a saved function's id + save time); `make` builds its
 * track only when it is needed.
 */
export const MiniScore = memo(function MiniScore({ id, make, color }: { id: string; make: () => Track; color: string }) {
  const key = useStore((s) => songKey(s.project.song)); // a string: tempo or volume changes don't re-render
  const [mini, setMini] = useState<Mini | undefined>(() => cachedMini(id, key));
  const [visible, setVisible] = useState(false);
  const ref = useRef<SVGSVGElement>(null);
  const makeRef = useRef(make);
  makeRef.current = make;

  useEffect(() => (ref.current ? watch(ref.current, setVisible) : undefined), []);

  useEffect(() => {
    const hit = cachedMini(id, key);
    if (hit) return setMini(hit);
    if (!visible) return;
    const job = enqueue(() => {
      let m: Mini;
      try {
        const song = useStore.getState().project.song;
        m = miniScore(fitToSong(makeRef.current(), song), song);
      } catch {
        m = { kind: 'silent', bars: [], path: '' };
      }
      rememberMini(id, key, m);
      setMini(m);
    });
    return () => void (job.alive = false);
  }, [id, key, visible]);

  return (
    <svg ref={ref} className={`mini-score ${mini ? '' : 'loading'}`} viewBox={`0 0 ${MINI_W} ${MINI_H}`} preserveAspectRatio="none" aria-hidden style={{ color }}>
      {mini?.kind === 'glide' && <path d={mini.path} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />}
      {mini?.bars.map(([x, y, w, h, o], i) => <rect key={i} x={x} y={y} width={w} height={h} rx={0.6} fill="currentColor" opacity={o} />)}
      {mini?.kind === 'silent' && <line x1={4} x2={MINI_W - 4} y1={MINI_H / 2} y2={MINI_H / 2} stroke="currentColor" strokeDasharray="2 4" opacity={0.4} />}
    </svg>
  );
});
