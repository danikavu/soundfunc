import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { engine } from '../engine/audio';
import { BEATS_PER_BAR, audibleTracks, isDrum, keyLabel, patternBeats, songBeats, stretchOf, type Track } from '../engine/project';
import { compose, texVariants, toSource } from '../engine/symbolic';
import { useStore } from '../state/store';
import { sparkHead } from './fuse';
import { toast } from './TopBar';
import { Icon, Seg, TextField, download, fileSafe, getRender } from './ui';
import { Visualizer } from './Visualizer';
import { mathImage, mathPending, preloadMath } from './mathSvg';

/**
 * Video mode: the visualizer, every channel's functions and the sound, recorded together as a clip
 * sized for socials. The frame is composed on a canvas — a title, the Score (or Function view) drawn
 * fresh at the video's own size, the functions lighting up as their channels play — and recorded
 * with the mix, from the top of the song, for as many loops as you choose — or until you stop it. The
 * whole app can be recorded instead: it fills the screen and waits for Record.
 */

type Format = 'story' | 'square' | 'wide';
const FORMATS: Record<Format, { w: number; h: number; label: string; hint: string }> = {
  story: { w: 1080, h: 1920, label: '9:16', hint: 'Reels, TikTok, Shorts, Stories' },
  square: { w: 1080, h: 1080, label: '1:1', hint: 'Instagram and X feeds' },
  wide: { w: 1920, h: 1080, label: '16:9', hint: 'YouTube, X, LinkedIn' },
};
type View = 'score' | 'function';
/** how the functions are written in the frame: SoundFunc formulas, or typeset math */
type MathView = 'formulas' | 'latex';
/** switching a channel is a click-free cut, not a fade (seconds) */
const CUT = 0.006;
/** the stage's pixel ratio: the visualizer is drawn as on a 2× screen, whatever this one is */
const RATIO = 2;
const FPS = 30;
/** the ring of reverb after the last loop, in seconds, kept in the clip */
const TAIL = 0.9;
/** the Length that has no end: the take runs until it is stopped */
const FREE = 0;
/** a take's last loop stops this much before the next one's first beat could sound (seconds) */
const EARLY = 0.06;

/** what a take records, and how to let go of it */
interface Source {
  stream: MediaStream;
  /** the control bar is left out of the picture */
  clean: boolean;
  done: () => void;
}

/**
 * Leave everything but the app itself out of a capture of this tab — the control bar floats outside
 * it. Chrome and Edge can; where a browser can't, the bar is in the picture.
 */
async function onlyTheApp(track: MediaStreamTrack): Promise<boolean> {
  const R = (window as unknown as { RestrictionTarget?: { fromElement(el: Element): Promise<unknown> } }).RestrictionTarget;
  const t = track as MediaStreamTrack & { restrictTo?: (target: unknown) => Promise<void> };
  const root = document.getElementById('root');
  if (!R || !t.restrictTo || !root) return false;
  try {
    await t.restrictTo(await R.fromElement(root));
    return true;
  } catch {
    return false;
  }
}

/** the first bar line of the song after the beat heard now (bars are counted from the start of each loop) */
function nextBar(loopBeats: number): number {
  let at = engine.position() ?? 0;
  do {
    const start = Math.floor(at / loopBeats + 1e-9) * loopBeats;
    const bar = Math.floor((at - start) / BEATS_PER_BAR + 1e-9);
    at = Math.min(start + (bar + 1) * BEATS_PER_BAR, start + loopBeats);
  } while (engine.secondsTo(at) < 0.1);
  return at;
}

/** where the song is: the bar, the beat within it, and the loop — of the take, once it records */
function BarCount({ loopBeats, from, loops }: { loopBeats: number; from: number | null; loops: number }) {
  const [at, setAt] = useState<{ bar: number; beat: number; loop: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pos = engine.position();
      const inLoop = pos === null ? 0 : pos % loopBeats;
      const next = pos === null ? null : { bar: Math.floor(inLoop / BEATS_PER_BAR) + 1, beat: Math.floor(inLoop % BEATS_PER_BAR), loop: Math.floor(Math.max(0, pos - (from ?? 0)) / loopBeats) + 1 };
      setAt((p) => (p && next && p.bar === next.bar && p.beat === next.beat && p.loop === next.loop ? p : next));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [loopBeats, from]);
  const bars = Math.ceil(loopBeats / BEATS_PER_BAR);
  const counted = from !== null && loops !== FREE;
  return (
    <span className={`bar-count ${at ? '' : 'idle'}`}>
      <b>
        Bar {at ? at.bar : '–'} / {bars}
      </b>
      <span className="bar-beats" aria-hidden>
        {Array.from({ length: BEATS_PER_BAR }, (_, i) => (
          <i key={i} className={at?.beat === i ? 'on' : ''} />
        ))}
      </span>
      <span>
        Loop {at ? (counted ? Math.min(at.loop, loops) : at.loop) : '–'}
        {counted ? ` / ${loops}` : ''}
      </span>
    </span>
  );
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** where everything sits in a frame */
function layoutOf(format: Format, fns: boolean): { head: Box; viz: Box; fns: Box | null; foot: Box; font: number } {
  if (format === 'story')
    return {
      head: { x: 64, y: 70, w: 952, h: 170 },
      viz: { x: 32, y: 260, w: 1016, h: fns ? 900 : 1520 },
      fns: fns ? { x: 64, y: 1200, w: 952, h: 600 } : null,
      foot: { x: 64, y: 1840, w: 952, h: 50 },
      font: 28,
    };
  if (format === 'square')
    return {
      head: { x: 56, y: 44, w: 968, h: 120 },
      viz: { x: 28, y: 170, w: 1024, h: fns ? 540 : 820 },
      fns: fns ? { x: 56, y: 730, w: 968, h: 290 } : null,
      foot: { x: 56, y: 1032, w: 968, h: 36 },
      font: 21,
    };
  return {
    head: { x: 60, y: 40, w: 1800, h: 110 },
    viz: fns ? { x: 28, y: 160, w: 1240, h: 860 } : { x: 28, y: 160, w: 1864, h: 860 },
    fns: fns ? { x: 1300, y: 176, w: 580, h: 830 } : null,
    foot: { x: 60, y: 1032, w: 1800, h: 36 },
    font: 21,
  };
}

/** the recording formats to try, best for socials first: MP4 (H.264 + AAC) where the browser can write it */
const MIMES = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const pickMime = () => (typeof MediaRecorder === 'undefined' ? null : MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null);

/** what is written for a channel: pitch and velocity (drums: just when they hit), or pitch alone (no drums) */
function channelOutputs(track: Track, pitchOnly: boolean) {
  const ports = isDrum(track.waveform) ? (pitchOnly ? [] : ['velocity']) : pitchOnly ? ['pitch'] : ['pitch', 'velocity'];
  return ports.length ? compose(track, true).math.outputs.filter((o) => ports.includes(o.port)) : [];
}

/** a channel's formulas as LaTeX, one per input: each in the ways it may be broken over lines */
const channelTex = (track: Track, pitchOnly: boolean): string[][] => channelOutputs(track, pitchOnly).map((o) => texVariants(o.port, o.ast));

/** the most and the least the typeset math is scaled (it grows only while every formula still fits the width) */
const MATH_MOST = 1.4;
const MATH_LEAST = 0.6;

/**
 * Typeset every channel's formulas as large as the box allows: at each size, a formula takes the
 * shortest of its forms that fits the width — or, when none does, the one shrunk the least. The
 * names shrink with it, so more channels fit.
 */
function setMath(blocks: { track: Track; tex: string[][] }[], box: Box, font: number, ink: string) {
  const forms = blocks.map(({ track, tex }) => ({
    track,
    formulas: tex.map((v) => v.map((t) => mathImage(t, ink)).filter((m) => m !== null).sort((p, q) => p.hEx - q.hEx || p.wEx - q.wEx)).filter((f) => f.length),
  }));
  for (let scale = MATH_MOST; ; scale -= 0.05) {
    const size = font * Math.min(1, Math.max(0.65, scale)), lh = Math.round(size * 1.35);
    const ex = font * 0.5 * scale, room = box.w - size * 1.6;
    let shrunk = false;
    const set = forms.map(({ track, formulas }) => {
      const lines = formulas.map((f) => {
        // none fits: the narrowest, unless that barely helps
        const narrow = f.reduce((p, q) => (q.wEx < p.wEx * 0.9 ? q : p));
        const m = f.find((x) => x.wEx * ex <= room) ?? narrow;
        const k = Math.min(ex, room / m.wEx);
        if (k < ex) shrunk = true;
        return { img: m.img, w: m.wEx * k, h: m.hEx * k };
      });
      return { track, lines, h: lh + lines.reduce((n, l) => n + l.h + lh * 0.2, 0) };
    });
    const total = set.reduce((n, b) => n + b.h + lh * 0.35, -lh * 0.35);
    if (scale <= MATH_LEAST || (total <= box.h && (scale <= 1 || !shrunk))) return { set, size };
  }
}

/** a channel's formulas as SoundFunc writes them */
const channelLines = (track: Track, pitchOnly: boolean): { port: string; text: string }[] => channelOutputs(track, pitchOnly).map((o) => ({ port: o.port, text: toSource(o.ast) }));

/** break text into lines no wider than `max`, at spaces where it can, anywhere where it must */
function wrapText(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/(?<=[ ,])/)) {
    if (g.measureText(line + word).width <= max) {
      line += word;
      continue;
    }
    if (line) out.push(line.trimEnd());
    line = '';
    let w = word;
    while (g.measureText(w).width > max) {
      let cut = w.length;
      while (cut > 1 && g.measureText(w.slice(0, cut)).width > max) cut--;
      out.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    line = w;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out;
}

/** the colours of the screen, read from the page so a video looks like the app */
function themeColours() {
  // the screen's own ink (light on the dark display), read where the visualizer reads it
  const viz = document.querySelector('.viz') ?? document.documentElement;
  const root = getComputedStyle(viz);
  const v = (n: string, d: string) => root.getPropertyValue(n).trim() || d;
  // the screen's own background: the first colour up from the visualizer that isn't see-through
  let bg = '';
  for (let el: Element | null = document.querySelector('.viz'); el && !bg; el = el.parentElement) {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) bg = c;
  }
  return { bg: bg || v('--lcd', '#0d1513'), ink: v('--ink', '#e8e4d8'), ink2: v('--ink-2', '#b8b2a4'), ink3: v('--ink-3', '#7d786c'), accent: v('--accent', '#e8742c'), mono: v('--mono', 'monospace'), sans: v('--sans', 'sans-serif') };
}

export function VideoStudio() {
  const open = useStore((s) => s.showVideo);
  const setOpen = useStore((s) => s.setShowVideo);
  const project = useStore((s) => s.project);
  const setPlaying = useStore((s) => s.setPlaying);
  const [format, setFormat] = useState<Format>('story');
  const [view, setView] = useState<View>('score');
  const [showFns, setShowFns] = useState(true);
  const [loops, setLoops] = useState(2);
  const [title, setTitle] = useState('');
  /** what is recorded: the composed frame, or the whole app filling the screen */
  const [source, setSource] = useState<'frame' | 'app'>('frame');
  /** the studio steps aside while the whole app is recorded */
  const [hidden, setHidden] = useState(false);
  const [mathView, setMathView] = useState<MathView>('formulas');
  /** write only the pitch functions: no velocities, and so no drums */
  const [pitchOnly, setPitchOnly] = useState(false);
  /** which channels are up (fading in or in) or down (fading out or out) */
  const [down, setDown] = useState<Set<string>>(new Set());
  /** channels brought back that are waiting for the next loop to begin */
  const [cued, setCued] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<'idle' | 'armed' | 'recording' | 'done'>('idle');
  /** the take so far, in seconds, and the beat of the song it began on */
  const [elapsed, setElapsed] = useState(0);
  const [from, setFrom] = useState<number | null>(null);
  /** full screen, with the song playing: the beat the take will begin on */
  const [cueAt, setCueAt] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; ext: string; bytes: number } | null>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const stageCanvas = useRef<HTMLCanvasElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);
  const takeTimers = useRef<number[]>([]);
  /** full screen: the capture, held from stepping aside until the take is done */
  const session = useRef<Source | null>(null);
  /** which wait for a bar line is current (a newer number cancels the older) */
  const cueing = useRef(0);
  const [clean, setClean] = useState(true);
  /** where the control bar was dragged to, from its place */
  const [barAt, setBarAt] = useState({ x: 0, y: 0 });
  const cancelled = useRef(false);
  /** between pressing Record and the take: a second press does nothing */
  const preparing = useRef(false);

  const F = FORMATS[format];
  const L = useMemo(() => layoutOf(format, showFns), [format, showFns]);
  const tracks = useMemo(() => audibleTracks(project.tracks), [project.tracks]);
  const loopBeats = songBeats(tracks, project.song);
  const seconds = (loops * loopBeats * 60) / project.song.bpm;
  const mime = useMemo(pickMime, []);
  const onCanvas = useCallback((c: HTMLCanvasElement | null) => {
    stageCanvas.current = c;
  }, []);
  const stage = useMemo(() => ({ view, pixelRatio: RATIO, onCanvas, level: (id: string) => engine.levelOf(id) }), [view, onCanvas]);

  /** fade a channel out, or back in, over the chosen length — the sound and the picture together */
  const downRef = useRef(new Set<string>());
  const toggleChannel = useCallback((id: string) => {
    const d = new Set(downRef.current);
    const out = !d.has(id);
    if (out) d.add(id);
    else d.delete(id);
    downRef.current = d;
    setDown(d);
    // off: at once; back on: on the first beat of the next loop — no fades either way
    const wait = engine.fadeChannel(id, out ? 0 : 1, CUT, !out);
    setCued((c) => {
      const n = new Set(c);
      if (!out && wait > 0.02) n.add(id);
      else n.delete(id);
      return n;
    });
    if (!out && wait > 0.02) timers.current.push(window.setTimeout(() => setCued((c) => (c.has(id) ? new Set([...c].filter((x) => x !== id)) : c)), wait * 1000));
  }, []);
  /**
   * Opening: every channel up, except the muted ones — they join the studio faded out, so they can
   * be brought in. Closing: the ones that were muted and are still out are muted again.
   */
  useEffect(() => {
    engine.resetFades();
    const muted = new Set<string>();
    if (open) {
      const { project: p, updateTrack } = useStore.getState();
      for (const t of p.tracks)
        if (t.muted) {
          muted.add(t.id);
          engine.fadeChannel(t.id, 0, CUT);
        }
      for (const id of muted) updateTrack(id, { muted: false }, false);
    }
    downRef.current = new Set(muted);
    setDown(new Set(muted));
    setCued(new Set());
    return () => {
      if (open) {
        const st = useStore.getState();
        for (const id of muted) if (downRef.current.has(id) && st.project.tracks.some((t) => t.id === id)) st.updateTrack(id, { muted: true }, false);
      }
      engine.resetFades();
    };
  }, [open]);
  // the channel list's M keys fade too, while the studio is open (in a full-screen take, they are the way to play it)
  const setLiveFades = useStore((st) => st.setLiveFades);
  useEffect(() => {
    setLiveFades(open ? { down: [...down], cued: [...cued], toggle: toggleChannel } : null);
  }, [open, down, cued, toggleChannel, setLiveFades]);
  useEffect(() => () => setLiveFades(null), [setLiveFades]);
  useEffect(() => {
    if (open && mathView === 'latex') preloadMath();
  }, [open, mathView]);
  const texBlocks = useMemo(() => (mathView === 'latex' ? tracks.map((t) => ({ track: t, tex: channelTex(t, pitchOnly) })).filter((x) => x.tex.length) : []), [mathView, tracks, pitchOnly]);

  // the title is the project's name until it is changed here; renaming or opening a project sets it again
  const projectId = useStore((st) => st.currentProjectId);
  useEffect(() => setTitle(project.name), [project.name, projectId]);
  // a change to the frame is seen at once: a finished clip gives way to the live frame (it is kept)
  useEffect(() => setPhase((ph) => (ph === 'done' ? 'idle' : ph)), [title, format, view, showFns, mathView, pitchOnly]);

  // each channel's formulas, laid out to fit the functions box: as many lines each as there is room for
  const fnLayout = useMemo(() => {
    if (!L.fns) return null;
    const g = document.createElement('canvas').getContext('2d')!;
    const { mono } = themeColours();
    const box = L.fns;
    const channels = tracks.map((t) => ({ track: t, lines: channelLines(t, pitchOnly) })).filter((x) => x.lines.length);
    for (let size = L.font; size >= 13; size -= 1) {
      g.font = `400 ${size}px ${mono}`;
      const lh = Math.round(size * 1.35);
      const room = Math.floor(box.h / lh);
      // as many channels as fit (each needs its name and a line), then a share of the room for each one's formulas
      const count = Math.max(1, Math.min(channels.length, Math.floor((room + 0.35) / 2.35)));
      const shown = channels.slice(0, count);
      const extra = channels.length > count ? 1 : 0;
      const perChannel = Math.max(1, Math.floor((room - extra - count * 1.35 + 0.35) / count));
      const blocks = shown.map(({ track, lines }) => {
        const text: string[] = [];
        for (const l of lines) for (const w of wrapText(g, `${l.port} = ${l.text}`, box.w - size * 1.6)) text.push(w);
        const kept = text.slice(0, perChannel);
        if (text.length > perChannel && kept.length) kept[kept.length - 1] = `${kept[kept.length - 1].slice(0, -1)}…`;
        return { track, text: kept };
      });
      const used = (blocks.reduce((n, b) => n + 1 + b.text.length, 0) + extra) * lh + (blocks.length - 1) * lh * 0.35;
      if ((used <= box.h && count === channels.length) || size === 13 || (used <= box.h && size <= L.font * 0.75)) return { size, lh, blocks, more: channels.length - shown.length };
    }
    return null;
  }, [L, tracks, pitchOnly]);

  // which channels sound right now, from the first pass of each (as the Score shows it)
  const renders = useMemo(() => tracks.map((t) => ({ track: t, r: getRender(t, project.song), len: patternBeats(t) })), [tracks, project.song]);
  const sounding = (pos: number | null): Set<string> => {
    const out = new Set<string>();
    if (pos === null) return out;
    for (const { track, r, len } of renders) {
      if (!(len > 0)) continue;
      const pb = pos % len;
      if (track.playMode === 'glide' && !isDrum(track.waveform)) {
        const sb = track.stepBeats * stretchOf(track);
        const i = Math.min(r.curve.velocity.length - 1, Math.max(0, Math.floor((pb / sb) * r.curve.res)));
        if (r.curve.velocity[i] >= 0.01) out.add(track.id);
      } else if (r.notes.some((n) => pb >= n.beat && pb < n.beat + Math.max(n.duration, 0.08))) out.add(track.id);
    }
    return out;
  };

  // compose the frame, every animation frame, while the studio is open (and not stepped aside)
  useEffect(() => {
    if (!open || hidden) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = frameRef.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const T = themeColours();
      const now = performance.now() / 1000;
      g.fillStyle = T.bg;
      g.fillRect(0, 0, F.w, F.h);
      // the title, and the song under it
      const { head, foot } = L;
      g.textBaseline = 'top';
      g.fillStyle = T.accent;
      g.font = `700 ${Math.round(head.h * 0.42)}px ${T.mono}`;
      g.fillText(title || project.name, head.x, head.y, head.w);
      g.fillStyle = T.ink3;
      g.font = `400 ${Math.round(head.h * 0.2)}px ${T.mono}`;
      g.fillText(`${project.song.bpm} bpm · ${keyLabel(project.song)} · harmony ${project.song.harmony}`, head.x, head.y + head.h * 0.6, head.w);
      // the visualizer, drawn for this frame size
      const s = stageCanvas.current;
      if (s && s.width) g.drawImage(s, L.viz.x, L.viz.y, L.viz.w, L.viz.h);
      // the functions: each channel's name in its colour (a spark while it sounds), its formulas under it,
      // faded as far as the channel is
      if (L.fns && fnLayout) {
        const on = sounding(engine.position());
        const box = L.fns;
        const math = mathView === 'latex' ? setMath(texBlocks, L.fns, L.font, T.ink) : null;
        const size = math ? math.size : fnLayout.size;
        const lh = Math.round(size * 1.35);
        const indent = size * 1.6;
        let y = box.y;
        g.textBaseline = 'middle';
        const head = (track: Track, lit: boolean, level: number) => {
          g.globalAlpha = (lit ? 1 : 0.7) * level;
          g.fillStyle = track.color;
          g.font = `700 ${size}px ${T.mono}`;
          g.fillText(track.name, box.x + indent, y + lh / 2);
          if (lit) sparkHead(g, box.x + size * 0.6, y + lh / 2, now, track.id.length * 7, track.color, size / 22);
          else {
            g.beginPath();
            g.arc(box.x + size * 0.6, y + lh / 2, size * 0.18, 0, Math.PI * 2);
            g.fill();
          }
          y += lh;
        };
        let more = 0;
        if (math) {
          const shown = math.set.filter(({ track }) => engine.levelOf(track.id) >= 0.02);
          shown.forEach(({ track, lines, h }, i) => {
            if (more) return;
            // what doesn't fit even at the smallest size is counted, with a line kept for saying so
            if (y + h > box.y + box.h - (i < shown.length - 1 ? lh : 0) && i > 0) {
              more = shown.length - i;
              return;
            }
            const level = engine.levelOf(track.id);
            const lit = on.has(track.id) && level > 0.1;
            head(track, lit, level);
            g.globalAlpha = (lit ? 1 : 0.55) * level;
            for (const l of lines) {
              g.drawImage(l.img, box.x + indent, y, l.w, l.h);
              y += l.h + lh * 0.2;
            }
            y += lh * 0.35;
          });
        } else {
          for (const { track, text } of fnLayout.blocks) {
            const level = engine.levelOf(track.id);
            if (level < 0.02) continue;
            const lit = on.has(track.id) && level > 0.1;
            head(track, lit, level);
            g.font = `400 ${size}px ${T.mono}`;
            g.fillStyle = T.ink;
            g.globalAlpha = (lit ? 0.95 : 0.5) * level;
            for (const line of text) {
              g.fillText(line, box.x + indent, y + lh / 2);
              y += lh;
            }
            y += lh * 0.35;
          }
          more = fnLayout.more;
        }
        if (more > 0) {
          g.globalAlpha = 0.6;
          g.fillStyle = T.ink3;
          g.font = `400 ${size}px ${T.mono}`;
          g.fillText(`+ ${more} more channel${more > 1 ? 's' : ''}`, box.x + indent, Math.min(y, box.y + box.h - lh) + lh / 2);
        }
        g.globalAlpha = 1;
      }
      // the maker's mark
      g.textBaseline = 'middle';
      g.fillStyle = T.ink3;
      g.globalAlpha = 0.8;
      g.font = `400 ${Math.round(foot.h * 0.55)}px ${T.mono}`;
      g.fillText('made with SoundFunc — music written as functions', foot.x, foot.y + foot.h / 2, foot.w);
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [open, hidden, F, L, fnLayout, title, project, renders, mathView, texBlocks]);

  const clearTimers = () => {
    for (const list of [timers, takeTimers]) {
      list.current.forEach((t) => clearTimeout(t));
      list.current = [];
    }
  };
  const later = (f: () => void, ms: number) => takeTimers.current.push(window.setTimeout(f, ms));

  const stopPlayback = () => {
    engine.stop();
    setPlaying(false);
  };

  /** this tab, captured by the browser while SoundFunc fills the screen — null when that was refused */
  const appSource = async (): Promise<Source | null> => {
    const leaveFull = () => {
      document.documentElement.classList.remove('capturing');
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
    // both asked for at once, while the click still counts: full screen, then this tab
    const full = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: FPS, displaySurface: 'browser' },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
      } as DisplayMediaStreamOptions);
      await full;
      document.documentElement.classList.add('capturing');
      const track = display.getVideoTracks()[0];
      const isClean = await onlyTheApp(track);
      // the screen let go of — Esc out of full screen, or the browser's Stop sharing — ends it all
      const left = () => !document.fullscreenElement && leave();
      document.addEventListener('fullscreenchange', left);
      track.addEventListener('ended', leave);
      return {
        stream: new MediaStream([track]),
        clean: isClean,
        done: () => {
          document.removeEventListener('fullscreenchange', left);
          display.getTracks().forEach((t) => t.stop());
          leaveFull();
        },
      };
    } catch {
      leaveFull();
      toast('Screen recording was not allowed — choose “This tab” when the browser asks');
      return null;
    }
  };

  /** record the composed frame, from the top */
  const record = async () => {
    if (!mime || preparing.current) return;
    preparing.current = true;
    forgetClip();
    if (useStore.getState().playing) stopPlayback();
    // the math is all typeset before the take, so nothing pops in during it
    if (showFns && mathView === 'latex') {
      const ink = themeColours().ink;
      for (let i = 0; i < 50 && texBlocks.some((b) => b.tex.some((v) => v.some((t) => mathPending(t, ink)))); i++) await new Promise((r) => setTimeout(r, 100));
    }
    preparing.current = false;
    const c = frameRef.current;
    if (c) await take({ stream: c.captureStream(FPS), clean: true, done: () => undefined }, F.label.replace(':', 'x'));
  };

  /** the whole app: fill the screen, step aside, and wait for Record */
  const arm = async () => {
    if (!mime || preparing.current) return;
    preparing.current = true;
    const src = await appSource();
    preparing.current = false;
    if (!src) return;
    session.current = src;
    setClean(src.clean);
    setBarAt({ x: 0, y: 0 });
    setFrom(null);
    setHidden(true);
    setPhase('armed');
  };

  /** back to the studio without a take */
  const disarm = () => {
    cueing.current++;
    setCueAt(null);
    const src = session.current;
    if (!src) return;
    session.current = null;
    src.done();
    setHidden(false);
    setPhase('idle');
  };

  /**
   * Record, in full screen: from the top of the song — or, when it is already playing, from the next
   * bar line, without stopping it. Pressed again while it waits, it waits no more.
   */
  const recordApp = async () => {
    const src = session.current;
    if (!src || preparing.current) return;
    const turn = ++cueing.current;
    if (cueAt !== null) return setCueAt(null);
    let at: number | null = null;
    if (useStore.getState().playing && engine.position() !== null) {
      at = nextBar(loopBeats);
      setCueAt(at);
      for (let wait = engine.secondsTo(at); wait > 0.02; wait = engine.secondsTo(at)) {
        await new Promise((r) => setTimeout(r, Math.min(50, (wait - 0.01) * 1000)));
        if (turn !== cueing.current) return;
        if (engine.position() === null) return setCueAt(null);
      }
      setCueAt(null);
    }
    preparing.current = true;
    forgetClip();
    await take(src, 'screen', at);
    preparing.current = false;
  };

  const forgetClip = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setPhase((ph) => (ph === 'done' ? 'idle' : ph));
    cancelled.current = false;
  };

  /** record `src` — from the top, or from beat `at` of the song that is playing — for the Length chosen */
  const take = async (src: Source, suffix: string, at: number | null = null) => {
    if (!mime) return;
    // the file is named after the take, whatever is changed afterwards
    const name = `${fileSafe(title || project.name)}-${suffix}`;
    const app = src === session.current;
    const stream = src.stream;
    for (const t of engine.audioStream().getAudioTracks()) stream.addTrack(t);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: app ? 14_000_000 : 10_000_000, audioBitsPerSecond: 192_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      takeTimers.current.forEach((t) => clearTimeout(t));
      takeTimers.current = [];
      stream.getVideoTracks().forEach((t) => t.stop());
      session.current = null;
      src.done();
      setHidden(false);
      if (cancelled.current) return;
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      setResult({ url: URL.createObjectURL(blob), name, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm', bytes: blob.size });
      setPhase('done');
    };
    recorder.current = rec;
    rec.start(250);
    setElapsed(0);
    setFrom(at ?? 0);
    setPhase('recording');
    const began = performance.now();
    if (at === null) {
      // a beat of silence first, so a platform's first frame isn't mid-note
      await new Promise((r) => setTimeout(r, 250));
      if (rec.state !== 'recording') return;
      if (useStore.getState().playing) stopPlayback();
      await engine.play();
      setPlaying(true);
    }
    const end = loops === FREE ? null : (at ?? 0) + loops * loopBeats;
    // the end is a beat of the song, not a moment: a tempo changed during the take still ends on it
    const tick = () => {
      if (rec.state !== 'recording') return;
      setElapsed((performance.now() - began) / 1000);
      const left = end === null ? Infinity : engine.secondsTo(end) - EARLY;
      // stopped by hand (Space) ends the take too
      if (left <= 0 || engine.position() === null) finish();
      else later(tick, Math.min(100, left * 1000));
    };
    tick();
  };

  /** end the take: the music stops, and the clip keeps its ring — unless the picture is already gone (`now`) */
  const finish = (now = false) => {
    takeTimers.current.forEach((t) => clearTimeout(t));
    takeTimers.current = [];
    const rec = recorder.current;
    if (engine.position() !== null) stopPlayback();
    if (rec?.state !== 'recording') return;
    if (now) rec.stop();
    else later(() => rec.state === 'recording' && rec.stop(), TAIL * 1000);
  };

  /** the screen was let go of */
  const leave = () => {
    if (recorder.current?.state === 'recording') finish(true);
    else disarm();
  };

  const close = () => {
    if (phase === 'recording') {
      cancelled.current = true;
      finish(true);
      setPhase('idle');
    }
    disarm();
    clearTimers();
    setOpen(false);
  };

  /** drag the control bar out of the way */
  const dragBar = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button')) return;
    const el = e.currentTarget;
    const x0 = e.clientX - barAt.x, y0 = e.clientY - barAt.y;
    const move = (m: PointerEvent) => setBarAt({ x: m.clientX - x0, y: m.clientY - y0 });
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.setPointerCapture(e.pointerId);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  // closing with Esc; a finished clip's file is let go when the studio closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return hidden ? leave() : close();
      // 1–9 fade the channels in and out, as you play — unless you're typing
      const typing = e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      const n = Number(e.key);
      if (!typing && !e.metaKey && !e.ctrlKey && n >= 1 && n <= 9 && tracks[n - 1]) {
        e.preventDefault();
        toggleChannel(tracks[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => {
    if (open) return;
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setPhase('idle');
  }, [open]);

  if (!open) return null;

  const busy = phase === 'recording' || phase === 'armed';
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const recTime = `${fmtTime(elapsed)}${loops === FREE ? '' : ` / ${fmtTime(seconds)}`}`;
  const fits = seconds <= 60 ? 'fits Reels, TikTok and Shorts' : seconds <= 90 ? 'fits Reels and TikTok — over Shorts’ 60 s' : seconds <= 180 ? 'fits TikTok (and Shorts up to 3 min)' : 'longer than most short-video limits';

  return (
    <div className={`sheet-backdrop ${hidden ? 'video-away' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && !busy && close()}>
      <div className="sheet video-sheet" role="dialog" aria-label="Video">
        <header className="sheet-head">
          {/* the clip's name, as written in the frame and on the file: click to change it */}
          <TextField className="video-title" value={title} onValue={setTitle} placeholder={project.name} aria-label="Video title" title="The video’s title — click to change it" spellCheck={false} readOnly={busy} />
          <button className="icon-btn" onClick={close} title="Close (Esc)">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body video-body">
          <div className={`video-preview ${format}`}>
            {/* the frame stays mounted under a finished clip, so Record again can draw it */}
            <canvas ref={frameRef} className="video-frame" width={F.w} height={F.h} hidden={!!result && phase === 'done'} />
            {result && phase === 'done' && <video className="video-frame" src={result.url} controls playsInline />}
            {busy && (
              <div className="video-rec">
                <span className="video-rec-dot" /> REC {recTime}
                <BarCount loopBeats={loopBeats} from={from} loops={loops} />
              </div>
            )}
          </div>
          <div className="video-options">
            <div className="field">
              <span>Record</span>
              <Seg<'frame' | 'app'>
                value={source}
                onChange={(v) => !busy && setSource(v)}
                options={[
                  { value: 'frame', label: 'Video frame' },
                  { value: 'app', label: 'Whole app, full screen' },
                ]}
              />
              {source === 'app' && (
                <small className="muted">
                  SoundFunc fills the screen — the browser asks once to share this tab — and waits: press Record there when you’re ready. Stopped, the take starts from the top; playing, it starts at the next bar. Esc comes back here.
                </small>
              )}
            </div>
            {source === 'frame' && (
            <div className="field">
              <span>Format</span>
              <Seg<Format> value={format} onChange={(f) => !busy && setFormat(f)} options={(Object.keys(FORMATS) as Format[]).map((f) => ({ value: f, label: FORMATS[f].label }))} />
              <small className="muted">{F.hint} · {F.w}×{F.h}</small>
            </div>
            )}
            <div className="field">
              <span>Show</span>
              <Seg<View>
                value={view}
                onChange={(v) => !busy && setView(v)}
                options={[
                  { value: 'score', label: 'Score' },
                  { value: 'function', label: 'Function' },
                ]}
              />
              <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }}>
                <input type="checkbox" checked={showFns} disabled={busy} onChange={(e) => setShowFns(e.target.checked)} /> the functions, lighting up as they play
              </label>
              {showFns && (
                <Seg<MathView>
                  value={mathView}
                  onChange={setMathView}
                  options={[
                    { value: 'formulas', label: 'Formulas' },
                    { value: 'latex', label: 'LaTeX math' },
                  ]}
                />
              )}
              {showFns && (
                <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }} title="Leave out the velocities — and the drums, which have no pitch function">
                  <input type="checkbox" checked={pitchOnly} onChange={(e) => setPitchOnly(e.target.checked)} /> only the pitch functions
                </label>
              )}
              <small className="muted">The backdrop, its strength and the fuse follow the main view.</small>
            </div>
            <div className="field">
              <span>Channels — on and off, live (keys 1–9)</span>
              <div className="video-channels">
                {tracks.map((t, i) => (
                  <button
                    key={t.id}
                    className={`btn small video-ch ${down.has(t.id) ? 'off' : 'on'} ${cued.has(t.id) ? 'cued' : ''}`}
                    aria-pressed={!down.has(t.id)}
                    onClick={() => toggleChannel(t.id)}
                    title={`${cued.has(t.id) ? `${t.name} comes in at the start of the next loop` : `${down.has(t.id) ? 'Bring in' : 'Switch off'} ${t.name}`}${i < 9 ? ` (key ${i + 1})` : ''}`}
                  >
                    <i style={{ background: t.color }} />
                    {i < 9 && <small>{i + 1}</small>} {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Length</span>
              <Seg<number> value={loops} onChange={(n) => !busy && setLoops(n)} options={[...[1, 2, 4, 8].map((n) => ({ value: n, label: `${n} loop${n > 1 ? 's' : ''}` })), { value: FREE, label: 'Free' }]} />
              <small className="muted">{loops === FREE ? 'Records until you stop it' : `${fmtTime(seconds)} · ${fits}`}</small>
            </div>
            {!mime && <p className="import-warn">This browser can’t record video. Try Chrome, Edge or Safari.</p>}
            {mime && !mime.startsWith('video/mp4') && <p className="import-warn">This browser records WebM. Most platforms take it; for Instagram, convert it to MP4 first.</p>}
            <div className="video-actions">
              {busy ? (
                <button className="btn" onClick={() => finish()}>
                  <Icon name="stop" size={12} /> {loops === FREE ? 'Stop' : 'Stop here'}
                </button>
              ) : (
                <button className="btn primary" disabled={!mime} onClick={() => void (source === 'app' ? arm() : record())}>
                  <span className="video-rec-dot" /> {source === 'app' ? 'Go full screen' : result ? 'Record again' : 'Record'}
                </button>
              )}
              {result && !busy && (
                <button
                  className="btn primary"
                  onClick={async () => {
                    const blob = await (await fetch(result.url)).blob();
                    download(`${result.name}.${result.ext}`, blob, blob.type);
                    toast(`Saved the video — ${(result.bytes / 1e6).toFixed(1)} MB, ${result.ext.toUpperCase()}`);
                  }}
                >
                  <Icon name="download" size={13} /> Download .{result.ext}
                </button>
              )}
            </div>
            {result && !busy && (
              <button className="btn small ghost" onClick={() => setPhase(phase === 'done' ? 'idle' : 'done')}>
                {phase === 'done' ? 'Back to the live preview' : 'Show the recorded clip'}
              </button>
            )}
            <small className="muted">Keep this tab in front while it records: a hidden tab stops drawing.</small>
          </div>
        </div>
        {/* the visualizer, drawn off screen at the size it fills in the frame */}
        <div className="video-stage" style={{ width: L.viz.w / RATIO, height: L.viz.h / RATIO }} aria-hidden>
          {!hidden && <Visualizer key={`${format}-${view}-${showFns}`} stage={stage} />}
        </div>
      </div>
      {/* full screen: the take's controls, outside the app so they stay out of the picture */}
      {hidden &&
        createPortal(
          <div className="take-bar" role="toolbar" aria-label="Recording" style={{ translate: `${barAt.x}px ${barAt.y}px` }} onPointerDown={dragBar} onMouseDown={(e) => e.preventDefault()} title={clean ? 'Not in the video — drag it out of the way' : 'This browser can’t leave this out of the video — drag it out of the way'}>
            {phase === 'recording' ? (
              <button className="btn" onClick={() => finish()}>
                <Icon name="stop" size={12} /> Stop
              </button>
            ) : (
              <button className={`btn primary ${cueAt !== null ? 'cued' : ''}`} onClick={() => void recordApp()} title={cueAt !== null ? 'Press again to cancel' : 'From the top — or, while the song plays, from the next bar'}>
                <span className="video-rec-dot" /> {cueAt !== null ? `Starts at bar ${Math.floor(((cueAt + 1e-6) % loopBeats) / BEATS_PER_BAR + 1e-6) + 1}…` : 'Record'}
              </button>
            )}
            <BarCount loopBeats={loopBeats} from={from} loops={loops} />
            <span className="take-time">{phase === 'recording' ? recTime : loops === FREE ? 'Free' : fmtTime(seconds)}</span>
            {phase !== 'recording' && (
              <button className="icon-btn" onClick={disarm} title="Back to the studio (Esc)">
                <Icon name="close" />
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
