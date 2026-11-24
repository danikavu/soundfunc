import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../engine/audio';
import { audibleTracks, isDrum, keyLabel, patternBeats, songBeats, stretchOf, type Track } from '../engine/project';
import { compose, toSource, toTex } from '../engine/symbolic';
import { useStore } from '../state/store';
import { sparkHead } from './fuse';
import { toast } from './TopBar';
import { Icon, Seg, TextField, download, fileSafe, getRender } from './ui';
import { Visualizer } from './Visualizer';
import { mathImage, preloadMath } from './mathSvg';

/**
 * Video mode: the visualizer, every channel's functions and the sound, recorded together as a clip
 * sized for socials. The frame is composed on a canvas — a title, the Score (or Function view) drawn
 * fresh at the video's own size, the functions lighting up as their channels play — and recorded
 * with the mix, from the top of the song, for as many loops as you choose.
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

/** a channel's lines for the frame: its name and its formulas (drums: just when they hit) */
/** a channel's formulas as LaTeX, one per input, written out whole */
function channelTex(track: Track): string[] {
  const outs = compose(track, true).math.outputs;
  const ports = isDrum(track.waveform) ? ['velocity'] : ['pitch', 'velocity'];
  return outs.filter((o) => ports.includes(o.port)).map((o) => `\\mathrm{${o.port}} = ${toTex(o.ast)}`);
}

function channelLines(track: Track): { port: string; text: string }[] {
  const outs = compose(track, true).math.outputs;
  const ports = isDrum(track.waveform) ? ['velocity'] : ['pitch', 'velocity'];
  return outs.filter((o) => ports.includes(o.port)).map((o) => ({ port: o.port, text: toSource(o.ast) }));
}

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
  /** which channels are up (fading in or in) or down (fading out or out) */
  const [down, setDown] = useState<Set<string>>(new Set());
  /** channels brought back that are waiting for the next loop to begin */
  const [cued, setCued] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<'idle' | 'recording' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; ext: string; bytes: number; seconds: number } | null>(null);
  const frameRef = useRef<HTMLCanvasElement>(null);
  const stageCanvas = useRef<HTMLCanvasElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timers = useRef<number[]>([]);
  const cancelled = useRef(false);

  const F = FORMATS[format];
  const L = useMemo(() => layoutOf(format, showFns), [format, showFns]);
  const tracks = useMemo(() => audibleTracks(project.tracks), [project.tracks]);
  const loopSeconds = (songBeats(tracks, project.song) * 60) / project.song.bpm;
  const seconds = loops * loopSeconds;
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
  const texBlocks = useMemo(() => (mathView === 'latex' ? tracks.map((t) => ({ track: t, tex: channelTex(t) })) : []), [mathView, tracks]);

  useEffect(() => {
    if (open) setTitle((t) => t || project.name);
  }, [open, project.name]);

  // each channel's formulas, laid out to fit the functions box: as many lines each as there is room for
  const fnLayout = useMemo(() => {
    if (!L.fns) return null;
    const g = document.createElement('canvas').getContext('2d')!;
    const { mono } = themeColours();
    const box = L.fns;
    const channels = tracks.map((t) => ({ track: t, lines: channelLines(t) }));
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
  }, [L, tracks]);

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

  // compose the frame, every animation frame, while the studio is open
  useEffect(() => {
    if (!open) return;
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
        const size = mathView === 'latex' ? L.font : fnLayout.size;
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
        if (mathView === 'latex') {
          // typeset: each formula scaled to the box's width, and never taller than two and a half lines
          const exPx = size * 0.5;
          texBlocks.forEach(({ track, tex }, i) => {
            if (more) return;
            if (y + lh * 2 > box.y + box.h) {
              more = texBlocks.length - i;
              return;
            }
            const level = engine.levelOf(track.id);
            if (level < 0.02) return;
            const lit = on.has(track.id) && level > 0.1;
            head(track, lit, level);
            g.globalAlpha = (lit ? 1 : 0.55) * level;
            for (const t of tex) {
              const m = mathImage(t, T.ink);
              if (!m) continue;
              const w = m.wEx * exPx, h = m.hEx * exPx;
              const k = Math.max(0.3, Math.min(1, (box.w - indent) / w, (size * 2.6) / h));
              if (y + h * k > box.y + box.h) break;
              g.save();
              g.beginPath();
              g.rect(box.x, y, box.w, h * k + 2);
              g.clip();
              g.drawImage(m.img, box.x + indent, y, w * k, h * k);
              g.restore();
              y += h * k + lh * 0.2;
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
  }, [open, F, L, fnLayout, title, project, renders, mathView, texBlocks]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  const stopPlayback = () => {
    engine.stop();
    setPlaying(false);
  };

  /**
   * The video to record: the composed frame, or — for the whole app — this tab, captured by the
   * browser while SoundFunc fills the screen. Null when that was refused.
   */
  const videoSource = async (): Promise<{ stream: MediaStream; done: () => void } | null> => {
    if (source === 'frame') {
      const c = frameRef.current;
      return c ? { stream: c.captureStream(FPS), done: () => undefined } : null;
    }
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
      return {
        stream: new MediaStream(display.getVideoTracks()),
        done: () => {
          display.getTracks().forEach((t) => t.stop());
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        },
      };
    } catch {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      toast('Screen recording was not allowed — choose “This tab” when the browser asks');
      return null;
    }
  };

  /** record from the top: the song plays for the chosen loops, the clip ends after the reverb's tail */
  const record = async () => {
    if (!mime) return;
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setPhase('idle');
    cancelled.current = false;
    if (useStore.getState().playing) stopPlayback();
    const src = await videoSource();
    if (!src) return;
    const stream = src.stream;
    for (const t of engine.audioStream().getAudioTracks()) stream.addTrack(t);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: source === 'app' ? 14_000_000 : 10_000_000, audioBitsPerSecond: 192_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getVideoTracks().forEach((t) => t.stop());
      src.done();
      setHidden(false);
      if (cancelled.current) return;
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      setResult({ url: URL.createObjectURL(blob), ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm', bytes: blob.size, seconds: seconds + TAIL });
      setPhase('done');
    };
    // the whole app ends when the screen is let go of: Esc out of full screen, or the browser's Stop sharing
    if (source === 'app') {
      stream.getVideoTracks()[0]?.addEventListener('ended', () => finishEarly());
      const left = () => {
        if (!document.fullscreenElement) {
          document.removeEventListener('fullscreenchange', left);
          finishEarly();
        }
      };
      document.addEventListener('fullscreenchange', left);
      // the studio steps aside, so the app is what is recorded
      setHidden(true);
      await new Promise((r) => setTimeout(r, 500));
    }
    recorder.current = rec;
    // a beat of silence first, so a platform's first frame isn't mid-note
    rec.start(250);
    setPhase('recording');
    setProgress(0);
    await new Promise((r) => setTimeout(r, 250));
    await engine.play();
    setPlaying(true);
    const began = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - began) / 1000 / (seconds + TAIL));
      setProgress(p);
      if (recorder.current === rec && rec.state === 'recording') timers.current.push(window.setTimeout(tick, 200));
    };
    tick();
    timers.current.push(
      window.setTimeout(() => {
        stopPlayback();
        timers.current.push(window.setTimeout(() => rec.state === 'recording' && rec.stop(), TAIL * 1000));
      }, seconds * 1000),
    );
  };

  /** stop now: what was recorded so far becomes the clip */
  const finishEarly = () => {
    clearTimers();
    stopPlayback();
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const close = () => {
    if (phase === 'recording') {
      cancelled.current = true;
      finishEarly();
      setPhase('idle');
    }
    clearTimers();
    setOpen(false);
  };

  // closing with Esc; a finished clip's file is let go when the studio closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return hidden ? finishEarly() : close();
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

  const busy = phase === 'recording';
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const fits = seconds <= 60 ? 'fits Reels, TikTok and Shorts' : seconds <= 90 ? 'fits Reels and TikTok — over Shorts’ 60 s' : seconds <= 180 ? 'fits TikTok (and Shorts up to 3 min)' : 'longer than most short-video limits';

  return (
    <div className={`sheet-backdrop ${hidden ? 'video-away' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && !busy && close()}>
      <div className="sheet video-sheet" role="dialog" aria-label="Video">
        <header className="sheet-head">
          <div>
            <div className="eyebrow" style={{ margin: 0 }}>
              Video
            </div>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 'var(--fs-md)' }}>
              The visuals, every channel’s functions and the sound, recorded from the top of the song — sized for socials.
            </p>
          </div>
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
                <span className="video-rec-dot" /> REC {fmtTime(progress * (seconds + TAIL))} / {fmtTime(seconds + TAIL)}
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
                  SoundFunc fills the screen and records itself with the sound — the browser asks once to share this tab. Esc stops; fades (keys 1–9) still work.
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
              <small className="muted">A channel goes off at once — sound and picture — and comes back on at the start of the next loop. It's all recorded. Switch channels off before Record to bring them in during the take; muted channels start off. In a full-screen take, the channel list’s M keys do the same.</small>
            </div>
            <label className="field">
              <span>Title</span>
              <TextField className="input" value={title} onValue={setTitle} />
            </label>
            <div className="field">
              <span>Length</span>
              <Seg<number> value={loops} onChange={(n) => !busy && setLoops(n)} options={[1, 2, 4, 8].map((n) => ({ value: n, label: `${n} loop${n > 1 ? 's' : ''}` }))} />
              <small className="muted">
                {fmtTime(seconds)} · {fits}
              </small>
            </div>
            {!mime && <p className="import-warn">This browser can’t record video. Try Chrome, Edge or Safari.</p>}
            {mime && !mime.startsWith('video/mp4') && <p className="import-warn">This browser records WebM. Most platforms take it; for Instagram, convert it to MP4 first.</p>}
            <div className="video-actions">
              {busy ? (
                <button className="btn" onClick={finishEarly}>
                  <Icon name="stop" size={12} /> Stop here
                </button>
              ) : (
                <button className="btn primary" disabled={!mime} onClick={() => void record()}>
                  <span className="video-rec-dot" /> {result ? 'Record again' : 'Record'}
                </button>
              )}
              {result && phase === 'done' && (
                <button
                  className="btn primary"
                  onClick={async () => {
                    const blob = await (await fetch(result.url)).blob();
                    download(`${fileSafe(title || project.name)}-${F.label.replace(':', 'x')}.${result.ext}`, blob, blob.type);
                    toast(`Saved the video — ${(result.bytes / 1e6).toFixed(1)} MB, ${result.ext.toUpperCase()}`);
                  }}
                >
                  <Icon name="download" size={13} /> Download .{result.ext}
                </button>
              )}
            </div>
            {result && phase === 'done' && (
              <button className="btn small ghost" onClick={() => setPhase('idle')}>
                Back to the live preview
              </button>
            )}
            <small className="muted">Keep this tab in front while it records: a hidden tab stops drawing.</small>
          </div>
        </div>
        {/* the visualizer, drawn off screen at the size it fills in the frame */}
        <div className="video-stage" style={{ width: L.viz.w / RATIO, height: L.viz.h / RATIO }} aria-hidden>
          <Visualizer key={`${format}-${view}-${showFns}`} stage={stage} />
        </div>
      </div>
    </div>
  );
}
