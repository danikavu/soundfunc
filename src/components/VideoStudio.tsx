import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { engine } from '../engine/audio';
import { BEATS_PER_BAR, audibleTracks, groupRuns, isDrum, keyLabel, patternBeats, songBeats, stretchOf, type Track } from '../engine/project';
import { compose, texVariants, toSource } from '../engine/symbolic';
import { useStore } from '../state/store';
import { sparkHead } from './fuse';
import { toast } from './TopBar';
import { Icon, Seg, Slider, TextField, download, fileSafe, getRender } from './ui';
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
/** after the last loop nothing new sounds: what rings fades smoothly to silence over this (seconds)… */
const RING = 1.6;
/** …and the clip ends a breath after that */
const TAIL = RING + 0.3;
/** the hush before a take that starts from the top: nothing from before it is left to hear */
const HUSH = 0.12;
/** the Length that has no end: the take runs until it is stopped */
const FREE = 0;
/** the Length of a build-up: a loop for each channel */
const AUTO = -1;
/** how the channels come in during a take: as they are switched by hand, or one more each loop */
type Build = 'off' | 'order' | 'random';

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

/** a channel's place in a shuffle: the same shuffle always gives it the same one */
function shuffleRank(id: string, shuffle: number): number {
  let h = 2166136261 ^ shuffle;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * The quake: the sound's low end, as a level that jumps up at once on a hit and settles back — kept
 * for a moment, so a hit can be read a little later higher up the picture, as it travels up.
 */
const spectrum = new Uint8Array(1024);
const quake = { bass: 0, mid: 0, past: [] as { t: number; k: number }[] };
function quakeLevel(now: number): number {
  if (engine.position() === null || !engine.spectrum(spectrum)) {
    quake.bass *= 0.85;
    quake.mid *= 0.85;
  } else {
    const hz = engine.sampleRate / 2048;
    const band = (lo: number, hi: number) => {
      let sum = 0, n = 0;
      for (let i = Math.max(1, Math.round(lo / hz)); i <= Math.round(hi / hz); i++, n++) sum += spectrum[i];
      return n ? sum / n / 255 : 0;
    };
    // only what stands out of the quiet counts, and loud counts more
    const bass = Math.max(0, band(25, 140) - 0.3) / 0.7, mid = Math.max(0, band(140, 400) - 0.35) / 0.65;
    quake.bass = Math.max(bass * bass, quake.bass * 0.86);
    quake.mid = Math.max(mid * mid, quake.mid * 0.75);
  }
  const k = Math.min(1.2, quake.bass + 0.15 * quake.mid);
  quake.past.push({ t: now, k });
  while (quake.past.length && quake.past[0].t < now - 0.5) quake.past.shift();
  return k;
}
/** the level as it was `ago` seconds back */
const quakeAgo = (now: number, ago: number) => {
  const p = quake.past;
  for (let i = p.length - 1; i >= 0; i--) if (p[i].t <= now - ago) return p[i].k;
  return p[0]?.k ?? 0;
};
/** how many bands the picture is cut into: each sways on its own */
const QUAKE_BANDS = 64;
/** how long a hit takes to travel from the bottom of the picture to the top (seconds) */
const QUAKE_RISE = 0.22;

/**
 * Draw the picture shaken: the bottom wiggles hardest and the top not at all, each band thrown
 * sideways by the hit as it reaches it — the quake rises through the picture.
 */
function drawQuake(g: CanvasRenderingContext2D, src: HTMLCanvasElement, box: Box, amount: number, now: number) {
  quakeLevel(now);
  const sh = src.height / QUAKE_BANDS, bh = box.h / QUAKE_BANDS;
  for (let i = 0; i < QUAKE_BANDS; i++) {
    const up = 1 - (i + 0.5) / QUAKE_BANDS; // 0 at the bottom, 1 at the top
    const weight = Math.max(0, 1 - up / 0.85) ** 2;
    const k = weight > 0 ? amount * weight * quakeAgo(now, up * QUAKE_RISE) : 0;
    // a hard, fast wiggle, its phase climbing with the band
    const t = now - up * QUAKE_RISE;
    const dx = 70 * k * (Math.sin(t * 57) * 0.6 + Math.sin(t * 91 + 1.1) * 0.4);
    g.drawImage(src, 0, i * sh, src.width, sh + 1, box.x + dx, box.y + i * bh, box.w, bh + 1);
  }
}

/** what a build-up brings in at a time: a channel, or a whole group */
interface Unit {
  id: string;
  name: string;
  tracks: Track[];
}

const shuffled = <T extends { id: string }>(tracks: T[], shuffle: number) => [...tracks].sort((a, b) => shuffleRank(a.id, shuffle) - shuffleRank(b.id, shuffle));

/** a shuffle that puts the channels in another order than they are in now (where there is one) */
function reshuffle(now: { id: string }[], shuffle: number): number {
  let next = shuffle;
  for (let i = 0; i < 20; i++) {
    next = Math.floor(Math.random() * 1e9);
    if (shuffled(now, next).some((t, k) => t !== now[k])) break;
  }
  return next;
}

/** the first bar line of the song after the beat heard now (bars are counted from the start of each loop) */
function nextBar(loopBeats: number): number {
  let at = engine.position() ?? 0;
  do {
    const start = Math.floor(at / loopBeats + 1e-9) * loopBeats;
    const bar = Math.floor((at - start) / BEATS_PER_BAR + 1e-9);
    at = Math.min(start + (bar + 1) * BEATS_PER_BAR, start + loopBeats);
  } while (engine.secondsTo(at) < 0.3);
  return at;
}

/** the first beat of the song's next loop */
function nextLoop(loopBeats: number): number {
  let n = Math.floor((engine.position() ?? 0) / loopBeats + 1e-9) + 1;
  while (engine.secondsTo(n * loopBeats) < 0.3) n++;
  return n * loopBeats;
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
  const [length, setLength] = useState(2);
  const [build, setBuild] = useState<Build>('off');
  /** which shuffle the random order is */
  const [shuffle, setShuffle] = useState(1);
  const [title, setTitle] = useState('');
  /** what is recorded: the composed frame, or the whole app filling the screen */
  const [source, setSource] = useState<'frame' | 'app'>('frame');
  /** the studio steps aside while the whole app is recorded */
  const [hidden, setHidden] = useState(false);
  const [mathView, setMathView] = useState<MathView>('formulas');
  /** the quake: 0 off, else how hard the picture trembles with the sound (the low end most) */
  const [quakeOn, setQuakeOn] = useState(false);
  const [quakeAmount, setQuakeAmount] = useState(0.5);
  const shake = quakeOn ? quakeAmount : 0;
  /** the quake grows over the take: a step each loop, from 1/n of its strength to all of it in the last loop */
  const [quakeRise, setQuakeRise] = useState(false);
  /** notes and lines tremble while they sound */
  const [trembleOn, setTrembleOn] = useState(false);
  const [trembleAmount, setTrembleAmount] = useState(0.5);
  const tremble = trembleOn ? trembleAmount : 0;
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
  /** Free: Stop waits for the end of the loop */
  const [stopAtLoop, setStopAtLoop] = useState(false);
  /** …the beat it waits for */
  const [stopping, setStopping] = useState<number | null>(null);
  /** the beat of the song the take began on */
  const takeFrom = useRef(0);
  /** Stop: at once — or, in Free with the box ticked, at the end of the loop it is in (pressed again: at once) */
  const stopTake = () => {
    const pos = engine.position();
    if (loops !== FREE || !stopAtLoop || stopping !== null || pos === null) return finish();
    const from = takeFrom.current;
    let end = from + Math.ceil((pos - from) / loopBeats + 1e-9) * loopBeats;
    while (engine.secondsTo(end) < 0.3) end += loopBeats;
    engine.endAt(end);
    setStopping(end);
  };
  /** the take is ringing out */
  const ending = useRef(false);
  /** between pressing Record and the take: a second press does nothing */
  const preparing = useRef(false);

  const F = FORMATS[format];
  const L = useMemo(() => layoutOf(format, showFns), [format, showFns]);
  const tracks = useMemo(() => audibleTracks(project.tracks), [project.tracks]);
  const loopBeats = songBeats(tracks, project.song);
  /** the channels a build-up brings in, in turn: every one, the switched-off ones too */
  /** the groups, as the studio plays them: only the channels that sound */
  const groups = useMemo(
    () =>
      groupRuns(project)
        .map((r) => ({ group: r.group, tracks: r.tracks.filter((t) => tracks.includes(t)) }))
        .filter((r) => r.tracks.length),
    [project, tracks],
  );
  /** a build-up brings in a whole group at a time */
  const [byGroup, setByGroup] = useState(true);
  const units = useMemo<Unit[]>(
    () => groups.flatMap((r) => (r.group && byGroup ? [{ id: r.group.id, name: r.group.name, tracks: r.tracks }] : r.tracks.map((t) => ({ id: t.id, name: t.name, tracks: [t] })))),
    [groups, byGroup],
  );
  const buildOrder = useMemo(() => (build === 'random' ? shuffled(units, shuffle) : units), [units, build, shuffle]);
  /** during a take: the order it was started with */
  const [running, setRunning] = useState<Unit[] | null>(null);
  const order = running ?? buildOrder;
  const building = build !== 'off' && order.length > 0;
  const loops = length === AUTO ? Math.max(1, order.length) : length;
  const seconds = (loops * loopBeats * 60) / project.song.bpm;
  const mime = useMemo(pickMime, []);
  const onCanvas = useCallback((c: HTMLCanvasElement | null) => {
    stageCanvas.current = c;
  }, []);
  const stage = useMemo(() => ({ view, pixelRatio: RATIO, onCanvas, level: (id: string) => engine.levelOf(id), tremble }), [view, onCanvas, tremble]);

  /** fade a channel out, or back in, over the chosen length — the sound and the picture together */
  const downRef = useRef(new Set<string>());
  const markDown = (id: string, out: boolean) => {
    const d = new Set(downRef.current);
    if (out) d.add(id);
    else d.delete(id);
    downRef.current = d;
    setDown(d);
  };
  const toggleChannel = useCallback((id: string) => {
    const out = !downRef.current.has(id);
    markDown(id, out);
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
  /** a group's key: off, if any of it is on; otherwise all of it back on */
  const toggleMany = useCallback(
    (ids: string[]) => {
      const up = ids.filter((id) => !downRef.current.has(id));
      for (const id of up.length ? up : ids) toggleChannel(id);
    },
    [toggleChannel],
  );
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
    setLiveFades(open ? { down: [...down], cued: [...cued], toggle: toggleChannel, toggleMany } : null);
  }, [open, down, cued, toggleChannel, toggleMany, setLiveFades]);
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
      /** how far the quake has grown: by the loop of the take (or of the playing, before one) */
      const riseAt = () => {
        if (!quakeRise) return 1;
        const pos = engine.position();
        const steps = loops === FREE ? 4 : loops;
        if (pos === null || !(loopBeats > 0)) return 1 / steps;
        const from = recorder.current?.state === 'recording' ? takeFrom.current : 0;
        return Math.min(1, (Math.floor(Math.max(0, pos - from) / loopBeats + 1e-9) + 1) / steps);
      };
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
      g.fillText(`${project.song.bpm} bpm · ${keyLabel(project.song)}`, head.x, head.y + head.h * 0.6, head.w);
      // the visualizer, drawn for this frame size
      const s = stageCanvas.current;
      if (s && s.width) {
        // the quake shakes the picture, not the words around it
        if (shake > 0) drawQuake(g, s, L.viz, shake * riseAt(), now);
        else g.drawImage(s, L.viz.x, L.viz.y, L.viz.w, L.viz.h);
      }
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
      g.textAlign = 'center';
      g.fillText('SoundFunc', foot.x + foot.w / 2, foot.y + foot.h / 2, foot.w);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [open, hidden, shake, quakeRise, loops, loopBeats, F, L, fnLayout, title, project, renders, mathView, texBlocks]);

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

  /** a build-up's channels, while one runs, and which were switched off before it */
  const buildRef = useRef<{ order: Unit[]; before: Set<string> } | null>(null);
  /** switch to its first channel alone — at the start of the next loop, when the song is playing */
  const beginBuild = (onLoop: boolean) => {
    if (buildRef.current) return;
    buildRef.current = { order, before: new Set(downRef.current) };
    setRunning(order);
    setCued(new Set());
    order.forEach((u, i) =>
      u.tracks.forEach((t) => {
        if (downRef.current.has(t.id) === i > 0) return;
        markDown(t.id, i > 0);
        engine.fadeChannel(t.id, i ? 0 : 1, CUT, onLoop);
      }),
    );
  };
  /** every channel is as it was before it */
  const endBuild = () => {
    const run = buildRef.current;
    if (!run) return;
    for (const t of run.order.flatMap((u) => u.tracks)) {
      markDown(t.id, run.before.has(t.id));
      engine.fadeChannel(t.id, run.before.has(t.id) ? 0 : 1, CUT);
    }
    buildRef.current = null;
    setRunning(null);
    setCued(new Set());
  };

  /** back to the studio without a take */
  const disarm = () => {
    cueing.current++;
    setCueAt(null);
    engine.cutAt(null);
    if (recorder.current?.state !== 'recording') endBuild();
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
    if (cueAt !== null) {
      engine.cutAt(null);
      endBuild();
      return setCueAt(null);
    }
    let at: number | null = null;
    if (useStore.getState().playing && engine.position() !== null) {
      // a build-up begins with a loop: its channels come in on the one
      at = building ? nextLoop(loopBeats) : nextBar(loopBeats);
      setCueAt(at);
      // whatever sounds before it — held notes, echoes, reverb — is not in the take
      engine.cutAt(at);
      let ready = !building;
      for (let wait = engine.secondsTo(at); wait > 0.02; wait = engine.secondsTo(at)) {
        await new Promise((r) => setTimeout(r, Math.min(50, (wait - 0.01) * 1000)));
        if (turn !== cueing.current) return;
        if (engine.position() === null) {
          endBuild();
          return setCueAt(null);
        }
        if (!ready && engine.secondsTo(at) < 0.25) {
          ready = true;
          beginBuild(true);
        }
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
    if (building) beginBuild(false);
    // from the top: silence first, so no echo or reverb of what was playing is in it
    if (at === null) {
      if (useStore.getState().playing) stopPlayback();
      engine.hush();
      await new Promise((r) => setTimeout(r, HUSH * 1000));
      if (cancelled.current || (app && session.current !== src)) return;
    }
    const stream = src.stream;
    for (const t of engine.audioStream().getAudioTracks()) stream.addTrack(t);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: app ? 14_000_000 : 10_000_000, audioBitsPerSecond: 192_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      takeTimers.current.forEach((t) => clearTimeout(t));
      takeTimers.current = [];
      engine.ring = 0;
      setStopping(null);
      stream.getVideoTracks().forEach((t) => t.stop());
      session.current = null;
      src.done();
      setHidden(false);
      if (cancelled.current) return;
      endBuild();
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      setResult({ url: URL.createObjectURL(blob), name, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm', bytes: blob.size });
      setPhase('done');
    };
    recorder.current = rec;
    ending.current = false;
    takeFrom.current = at ?? 0;
    setStopping(null);
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
    // however the music stops from here on, it rings out
    engine.ring = RING;
    const end = loops === FREE ? null : (at ?? 0) + loops * loopBeats;
    if (end !== null) engine.endAt(end);
    // the end is a beat of the song, not a moment: a tempo changed during the take still ends on it
    let loop = -1;
    const tick = () => {
      if (rec.state !== 'recording') return;
      // a build-up: as each loop begins, the next channel is cued for the one after
      const now = Math.floor(((engine.position() ?? 0) - (at ?? 0)) / loopBeats + 1e-6);
      if (buildRef.current && now > loop && engine.secondsTo((at ?? 0) + now * loopBeats) < 0) {
        loop = now;
        const next = buildRef.current.order[loop + 1];
        if (next && (loops === FREE || loop + 1 < loops)) for (const t of next.tracks) if (downRef.current.has(t.id)) toggleChannel(t.id);
      }
      setElapsed((performance.now() - began) / 1000);
      // the last loop is over — or the music was stopped by hand (Space), which ends the take too
      if (engine.position() === null) finish();
      else later(tick, end === null ? 100 : Math.min(100, Math.max(5, engine.secondsTo(end) * 1000)));
    };
    tick();
  };

  /** end the take: the music rings out into the clip — unless the picture is already gone (`now`): a quick fade */
  const finish = (now = false) => {
    // already ringing out: let it
    if (ending.current && !now) return;
    ending.current = true;
    takeTimers.current.forEach((t) => clearTimeout(t));
    takeTimers.current = [];
    const rec = recorder.current;
    if (now) engine.ring = 0;
    if (useStore.getState().playing || engine.playing) stopPlayback();
    else if (now) engine.hush();
    if (rec?.state === 'recording') later(() => rec.state === 'recording' && rec.stop(), now ? 350 : TAIL * 1000);
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
      if (recorder.current?.state === 'recording') recorder.current.stop();
      endBuild();
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
  // how many channels each loop has: 1-2-3-3
  const pattern = Array.from({ length: Math.max(0, loops) }, (_, i) => Math.min(i + 1, order.length)).join('-');
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
              <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }} title="The bass shakes the picture like a quake: the bottom wiggles hardest, the top not at all, each hit rising through it">
                <input type="checkbox" checked={quakeOn} onChange={(e) => setQuakeOn(e.target.checked)} /> Quake — the bass shakes the picture, bottom up
              </label>
              {quakeOn && <Slider label="Strength" value={quakeAmount} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={setQuakeAmount} reset={0.5} />}
              {quakeOn && (
                <>
                  <Seg<boolean>
                    value={quakeRise}
                    onChange={setQuakeRise}
                    options={[
                      { value: false, label: 'Steady' },
                      { value: true, label: 'Builds each loop' },
                    ]}
                  />
                  {quakeRise && (
                    <small className="muted">
                      {(() => {
                        const n = loops === FREE ? 4 : loops;
                        const steps = Array.from({ length: Math.min(n, 8) }, (_, i) => `${Math.round(((i + 1) / n) * 100)}%`);
                        return `${steps.join(' → ')}${n > 8 ? ' …' : ''}${loops === FREE ? ', then stays' : ''} of the strength, a step each loop`;
                      })()}
                    </small>
                  )}
                </>
              )}
              <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }} title="Each note trembles while it sounds, and a gliding line or the function's curve vibrates behind the playhead like a plucked string">
                <input type="checkbox" checked={trembleOn} onChange={(e) => setTrembleOn(e.target.checked)} /> Tremble — notes and lines shiver as they sound
              </label>
              {trembleOn && <Slider label="Strength" value={trembleAmount} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={setTrembleAmount} reset={0.5} />}
              <small className="muted">The backdrop, its strength and the fuse follow the main view.</small>
            </div>
            <div className="field">
              <span>Channels — on and off, live (keys 1–9)</span>
              <div className="video-channels">
                {groups.map((r) => {
                  const keys = r.tracks.map((t) => {
                    const i = tracks.indexOf(t);
                    return (
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
                    );
                  });
                  if (!r.group) return keys;
                  // a group: one key for all of it, its channels beside it
                  const ids = r.tracks.map((t) => t.id);
                  const off = ids.every((id) => down.has(id));
                  return (
                    <div key={r.group.id} className="video-group">
                      <button className={`btn small video-ch video-group-key ${off ? 'off' : 'on'} ${ids.some((id) => cued.has(id)) ? 'cued' : ''}`} aria-pressed={!off} onClick={() => toggleMany(ids)} title={off ? `Bring in ${r.group.name} at the start of the next loop` : `Switch off all of ${r.group.name}`}>
                        {r.group.name}
                      </button>
                      {keys}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <span>Smart channels — one more each loop</span>
              <div className="row" style={{ gap: 'var(--sp-2)' }}>
                <Seg<Build>
                  value={build}
                  onChange={(b) => {
                    if (busy) return;
                    setBuild(b);
                    if (b === 'random') setShuffle(reshuffle(buildOrder, shuffle));
                    // a loop for each channel, until another length is chosen
                    if (b === 'off') setLength((n) => (n === AUTO ? 2 : n));
                    else if (build === 'off') setLength(AUTO);
                  }}
                  options={[
                    { value: 'off', label: 'Off' },
                    { value: 'order', label: 'In order' },
                    { value: 'random', label: build === 'random' ? 'Shuffle' : 'Random' },
                  ]}
                />
              </div>
              {building && groups.some((r) => r.group) && (
                <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }} title="A group comes in all at once, as one step">
                  <input type="checkbox" checked={byGroup} disabled={busy} onChange={(e) => setByGroup(e.target.checked)} /> a group at a time
                </label>
              )}
              {building && (
                <small className="muted">
                  {order.map((t, i) => (
                    <span key={t.id} className={loops === FREE || i < loops ? '' : 'build-out'}>
                      {i ? ' → ' : ''}
                      {t.name}
                    </span>
                  ))}
                  {loops !== FREE && loops < order.length ? ` · ${loops} of ${order.length} come in` : ''}
                </small>
              )}
            </div>
            <div className="field">
              <span>Length</span>
              <Seg<number> value={length} onChange={(n) => !busy && setLength(n)} options={[...(build === 'off' ? [] : [{ value: AUTO, label: `Auto · ${order.length}` }]), ...[1, 2, 4, 8].map((n) => ({ value: n, label: build === 'off' ? `${n} loop${n > 1 ? 's' : ''}` : String(n) })), { value: FREE, label: 'Free' }]} />
              {loops === FREE && (
                <label className="row" style={{ gap: 6, fontSize: 'var(--fs-md)' }} title="Off: Stop ends the take at once. On: it plays to the end of the loop first (press Stop again to end it at once)">
                  <input type="checkbox" checked={stopAtLoop} onChange={(e) => setStopAtLoop(e.target.checked)} /> Stop at the end of the loop
                </label>
              )}
              <small className="muted">{loops === FREE ? (stopping !== null ? 'Stopping at the end of this loop…' : 'Records until you stop it') : `${build === 'off' ? '' : `${loops} loop${loops > 1 ? 's' : ''} · `}${building ? `${pattern} · ` : ''}${fmtTime(seconds)} · ${fits}`}</small>
            </div>
            {!mime && <p className="import-warn">This browser can’t record video. Try Chrome, Edge or Safari.</p>}
            {mime && !mime.startsWith('video/mp4') && <p className="import-warn">This browser records WebM. Most platforms take it; for Instagram, convert it to MP4 first.</p>}
            <div className="video-actions">
              {busy ? (
                <button className="btn" onClick={stopTake} title={stopping !== null ? 'Stops at the end of this loop — press to stop now' : undefined}>
                  <Icon name="stop" size={12} /> {stopping !== null ? 'Stop now' : loops === FREE ? 'Stop' : 'Stop here'}
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
              <button className={`btn ${stopping !== null ? 'cued' : ''}`} onClick={stopTake} title={stopping !== null ? 'Stops at the end of this loop — press to stop now' : undefined}>
                <Icon name="stop" size={12} /> {stopping !== null ? 'Stop now' : 'Stop'}
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
