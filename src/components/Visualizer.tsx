import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../engine/audio';
import { SCALES, chordName, limitPitch, midiToName, valueToPitch } from '../engine/music';
import { BEATS_PER_BAR, audibleTracks, harmonyAt, isDrum, patternBeats, renderTrack, scaleLength, songBeats, stretchOf, voiceLabel, type Note, type Song, type Track, type TrackRender } from '../engine/project';
import { useSelectedTrack, useStore } from '../state/store';
import { Icon, Seg, getRender } from './ui';
import { RangeControl } from './RangeControl';
import { ScoreMath, useScoreMath } from './ScoreMath';
import { RIPPLE_DEFAULTS, RIPPLE_STYLES, RippleMemory, drawRipple, type RippleOptions, type RippleStyle } from './ripple';

/** the header's height: Ripple centres its figure in the space below it */
const RIPPLE_TOP = 40;
/** …and the options bar's, at the bottom */
const RIPPLE_BOTTOM = 46;
const RIPPLE_KEY = 'sf-ripple';
function loadRipple(): RippleOptions {
  try {
    const saved = { ...RIPPLE_DEFAULTS, ...JSON.parse(localStorage.getItem(RIPPLE_KEY) ?? '{}') };
    // a style that has since been retired falls back to Pond
    if (!RIPPLE_STYLES.some((r) => r.value === saved.style)) saved.style = RIPPLE_DEFAULTS.style;
    return saved;
  } catch {
    return RIPPLE_DEFAULTS;
  }
}

type Mode = 'score' | 'function' | 'ripple';

interface Placed {
  track: Track;
  note: Note;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Palette {
  paper: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  rake: string;
  accent: string;
  /** how much notes glow (0 = none), and how round they are (0.5 = pills, 0 = bars) */
  glow: number;
  round: number;
}

/** the view's colours come from its own element, so the screen can have a palette of its own */
function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  const num = (n: string, d: number) => (v(n) === '' || !Number.isFinite(Number(v(n))) ? d : Number(v(n)));
  return { paper: v('--paper'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), line: v('--line'), rake: v('--rake'), accent: v('--accent'), glow: num('--viz-glow', 0), round: num('--viz-note-round', 0.5) };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/**
 * A thin ink line with a soft glow in the track's colour: the halo is one blurred,
 * translucent pass under the line. Points come in as one continuous run.
 */
function glowLine(g: CanvasRenderingContext2D, pts: [number, number][], ink: string, color: string, opts: { width: number; glow: number; alpha?: number }) {
  if (pts.length < 2) return;
  const trace = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  };
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (opts.glow > 0) {
    g.save();
    trace();
    g.strokeStyle = color;
    g.globalAlpha = 0.32 * opts.glow;
    g.lineWidth = opts.width + 2.6;
    g.shadowColor = color;
    g.shadowBlur = 9 * opts.glow;
    g.stroke();
    g.restore();
  }
  trace();
  g.strokeStyle = ink;
  g.globalAlpha = opts.alpha ?? 1;
  g.lineWidth = opts.width;
  g.stroke();
  g.globalAlpha = 1;
}

interface ScoreItem {
  track: Track;
  notes: Note[];
  /** glide tracks: continuous [beat, midi, velocity] */
  glide: [number, number, number][];
}

/**
 * One pass of the song, as playback hears it: the track's loops k that overlap
 * [offset, offset + total) — loop count, bar and harmony keep running from pass to pass.
 * `at` maps each loop to its start within the pass (it can be negative when lengths don't divide).
 */
function passLoops(track: Track, song: Song, offset: number, total: number, withTraces?: TrackRender) {
  const len = patternBeats(track);
  const out: { k: number; at: number; r: TrackRender }[] = [];
  if (len <= 0) return out;
  for (let k = Math.floor(offset / len + 1e-9); k * len < offset + total - 1e-9; k++) {
    out.push({ k, at: k * len - offset, r: k === 0 && withTraces ? withTraces : renderTrack(track, song, k, false) });
  }
  return out;
}

// plot layout for the Function view, shared by drawing and scrubbing
const PLOT = { padL: 54, padR: 46, padT: 48, padB: 18 };

export function Visualizer() {
  const project = useStore((s) => s.project);
  const theme = useStore((s) => s.theme);
  const playing = useStore((s) => s.playing);
  const selectTrack = useStore((s) => s.selectTrack);
  const selected = useSelectedTrack();
  const [mode, setMode] = useState<Mode>('score');
  const [math, setMath] = useScoreMath();
  const [tip, setTip] = useState<{ x: number; y: number; text: string[] } | null>(null);
  /** Ripple's look, remembered between visits */
  const [ripple, setRippleState] = useState<RippleOptions>(loadRipple);
  const rippleRef = useRef(ripple);
  rippleRef.current = ripple;
  const rippleMem = useRef(new RippleMemory());
  const rippleHeard = useRef(false);
  const [rippleLive, setRippleLive] = useState(false);
  const setRipple = (patch: Partial<RippleOptions>) =>
    setRippleState((r) => {
      const next = { ...r, ...patch };
      try {
        localStorage.setItem(RIPPLE_KEY, JSON.stringify(next));
      } catch {
        /* just not remembered */
      }
      return next;
    });

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placedRef = useRef<Placed[]>([]);
  const hoverRef = useRef<Placed | null>(null);
  const scrubRef = useRef<number | null>(null);
  const dirty = useRef(true);
  const palette = useRef<Palette | null>(null);
  /** the visible stretch of the song, in beats; span 0 = the whole loop */
  const viewRef = useRef({ start: 0, span: 0 });
  /** where the plot sits on the canvas, for mapping the pointer (set while drawing) */
  const geom = useRef({ padL: 16, iw: 1 });
  const [, setViewTick] = useState(0);
  /** which pass of the song the playhead is in (0 when stopped) — the views draw what is playing */
  const [pass, setPass] = useState(0);
  const passRef = useRef(0);
  /**
   * the pitch span seen so far this play-through, so the views keep their scale from pass
   * to pass and only ever widen; it starts again when you stop or change the garden
   */
  const spanRef = useRef<{ score?: { of: unknown; lo: number; hi: number }; fn?: { of: unknown; lo: number; hi: number } }>({});
  const sticky = (which: 'score' | 'fn', of: unknown, lo: number, hi: number) => {
    const prev = spanRef.current[which];
    if (pass > 0 && prev && prev.of === of) (lo = Math.min(lo, prev.lo)), (hi = Math.max(hi, prev.hi));
    spanRef.current[which] = { of, lo, hi };
    return [lo, hi];
  };

  // every audible track tiled across the longest pattern — loop k matters for evolving tracks
  const songTotal = songBeats(audibleTracks(project.tracks), project.song);
  /** where this pass starts, in beats since play began */
  const offset = pass * songTotal;
  const score = useMemo(() => {
    const tracks = audibleTracks(project.tracks);
    const total = songTotal;
    const items: ScoreItem[] = tracks.map((track) => {
      const notes: Note[] = [];
      const glide: ScoreItem['glide'] = [];
      const isGlide = track.playMode === 'glide' && !isDrum(track.waveform);
      for (const { at, r } of passLoops(track, project.song, offset, total, getRender(track, project.song))) {
        const inPass = (b: number) => at + b >= -1e-9 && at + b < total - 1e-9;
        if (isGlide) {
          r.curve.beat.forEach((b, i) => inPass(b) && glide.push([at + b, r.curve.midi[i], r.curve.velocity[i]]));
        } else for (const n of r.notes) if (inPass(n.beat)) notes.push({ ...n, beat: at + n.beat });
      }
      return { track, notes, glide };
    });
    const melodic = items.filter((it) => !isDrum(it.track.waveform));
    const drums = items.filter((it) => isDrum(it.track.waveform));
    let lo = 127, hi = 0;
    for (const it of melodic) {
      for (const n of it.notes) (lo = Math.min(lo, n.midi)), (hi = Math.max(hi, n.midi));
      for (const [, m, v] of it.glide) if (v >= 0.01) (lo = Math.min(lo, Math.floor(m))), (hi = Math.max(hi, Math.ceil(m)));
    }
    if (lo > hi) (lo = 48), (hi = 72);
    [lo, hi] = sticky('score', project, lo, hi);
    return { melodic, drums, total, lo: lo - 2, hi: hi + 2 };
  }, [project, songTotal, offset]);

  const fn = useMemo(() => (selected ? getRender(selected, project.song) : null), [selected, project.song]);

  // the selected track across the whole song loop (as long as the Score), loop k included
  const fnFull = useMemo(() => {
    if (!selected || !fn) return null;
    const total = score.total;
    const raw: number[] = [], vel: number[] = [], midi: number[] = [];
    const steps: { beat: number; raw: number; vel: number }[] = [];
    const inPass = (b: number) => b >= -1e-9 && b < total - 1e-9;
    for (const { at, r } of passLoops(selected, project.song, offset, total, fn)) {
      r.curve.beat.forEach((b, i) => {
        if (!inPass(at + b)) return;
        raw.push(r.curve.raw[i]);
        vel.push(r.curve.velocity[i]);
        midi.push(r.curve.midi[i]);
      });
      r.pitchCurve.forEach((v, n) => {
        const beat = at + n * selected.stepBeats * stretchOf(selected);
        if (inPass(beat)) steps.push({ beat, raw: v, vel: r.velocityCurve[n] });
      });
    }
    // curve samples are evenly spaced: dt beats apart
    return { raw, vel, midi, steps, dt: (selected.stepBeats * stretchOf(selected)) / fn.curve.res, total };
  }, [selected, fn, project.song, score.total, offset]);

  /** the visible window, clamped to the song */
  const view = () => {
    const total = score.total;
    const span = viewRef.current.span > 0 ? Math.min(viewRef.current.span, total) : total;
    const start = Math.min(Math.max(0, viewRef.current.start), total - span);
    return { start, span, total, zoomed: span < total - 1e-9 };
  };
  const setView = (start: number, span: number) => {
    viewRef.current = { start, span };
    dirty.current = true;
    setViewTick((t) => t + 1);
  };
  /** zoom by a factor around a point given as a fraction (0…1) across the plot */
  const zoomAt = (factor: number, fx = 0.5) => {
    const v = view();
    const span = Math.min(v.total, Math.max(0.5, v.span * factor));
    const anchor = v.start + fx * v.span;
    setView(span >= v.total ? 0 : anchor - fx * span, span >= v.total ? 0 : span);
  };

  useEffect(() => {
    palette.current = null;
    dirty.current = true;
  }, [theme]);
  useEffect(() => {
    dirty.current = true;
  }, [score, fn, fnFull, mode, selected?.id]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    // the canvas, not the frame: the Score's functions can take room under it
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      dirty.current = true;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // y-range of the Function plot (raw values), shared with scrubbing
  // y-range of the Function plot (raw values). With a pitch range on, the plot
  // stays within the values that range allows, so a stray −8373 can't flatten it.
  const fnRange = useMemo(() => {
    const out = { lo: -1, hi: 1, edges: null as null | { lo: number; hi: number }, outside: 0 };
    if (!fnFull || !selected) return out;
    let lo = Infinity, hi = -Infinity;
    for (const v of fnFull.raw) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
    if (!isFinite(lo) || !isFinite(hi)) (lo = -1), (hi = 1);
    [lo, hi] = sticky('fn', fn, lo, hi);
    const range = project.song.pitchRange;
    if (range && range.mode !== 'off' && !isDrum(selected.waveform)) {
      // the raw values that land on the range's edges, for this track's pitch mapping
      const base = 12 * (selected.octave + 1) + project.song.root;
      const L = scaleLength(project.song);
      const toRaw = (m: number) => (selected.pitchMode === 'semitone' ? m - base : selected.pitchMode === 'degree' ? ((m - base) * L) / 12 : (m - base) / 12);
      const eLo = toRaw(range.low), eHi = toRaw(range.high);
      out.edges = { lo: eLo, hi: eHi };
      out.outside = fnFull.raw.filter((v, i) => fnFull.vel[i] >= 0.01 && (v < eLo - 1e-9 || v > eHi + 1e-9)).length / Math.max(1, fnFull.vel.filter((v) => v >= 0.01).length);
      lo = Math.max(lo, eLo);
      hi = Math.min(hi, eHi);
      if (lo > hi) (lo = eLo), (hi = eHi);
    }
    if (hi - lo < 1e-6) (lo -= 1), (hi += 1);
    const span = hi - lo;
    return { ...out, lo: lo - span * 0.08, hi: hi + span * 0.08 };
  }, [fnFull, selected, project.song, fn]);

  // ⌘/Ctrl + scroll (or a trackpad pinch) zooms around the pointer; scrolling pans while zoomed
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      if (mode === 'ripple') return;
      const r = canvas.getBoundingClientRect();
      const fx = Math.min(1, Math.max(0, (e.clientX - r.left - geom.current.padL) / geom.current.iw));
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(Math.exp(e.deltaY * 0.01), fx);
        return;
      }
      const v = view();
      if (!v.zoomed) return;
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setView(v.start + (d / geom.current.iw) * v.span, v.span);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  });

  // draw loop
  useEffect(() => {
    let raf = 0;
    const wave = new Float32Array(2048);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const pos = engine.position();
      // repeating exactly, every pass is the first one
      const nowPass = pos === null || !(songTotal > 0) || project.song.repeat === 'exact' ? 0 : Math.floor(pos / songTotal + 1e-9);
      if (nowPass !== passRef.current) {
        passRef.current = nowPass;
        setPass(nowPass);
      }
      if (!dirty.current && pos === null && mode !== 'ripple') return;
      dirty.current = false;
      const canvas = canvasRef.current!;
      const g = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr, H = canvas.height / dpr;
      const P = (palette.current ??= readPalette(wrapRef.current!));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const secPerBeat = 60 / project.song.bpm;
      // follow the playhead while zoomed in: turn the page when it runs off the edge
      let vw = view();
      if (pos !== null && vw.zoomed && mode !== 'ripple') {
        const pb = pos % vw.total;
        if (pb < vw.start || pb > vw.start + vw.span) {
          viewRef.current = { start: Math.floor(pb / vw.span) * vw.span, span: vw.span };
          vw = view();
          setViewTick((t) => t + 1); // keep the "bars a–b" label in step
        }
      }
      const offsetBars = Math.round(offset / BEATS_PER_BAR);
      /** bar ticks and numbers along the bottom, spaced to the zoom */
      const timeAxis = (bx: (b: number) => number, y: number, left: number, right: number) => {
        const ppb = (right - left) / vw.span;
        g.fillStyle = P.ink3;
        g.font = '10.5px Doto, monospace';
        g.textAlign = 'left';
        const labelEvery = Math.max(1, Math.ceil(36 / (ppb * BEATS_PER_BAR)));
        for (let b = Math.floor(vw.start); b <= vw.start + vw.span + 1e-9; b++) {
          const x = bx(b);
          if (x < left - 1 || x > right + 1) continue;
          const isBar = b % BEATS_PER_BAR === 0;
          if (!isBar && ppb < 7) continue;
          g.globalAlpha = isBar ? 0.5 : 0.18;
          g.fillRect(x - 0.5, y, 1, isBar ? 6 : 3);
          const bar = b / BEATS_PER_BAR;
          if (isBar && bar % labelEvery === 0) {
            g.globalAlpha = 0.65;
            g.fillText(String(bar + offsetBars + 1), x + 3, y + 13);
          }
        }
        g.globalAlpha = 1;
      };

      if (mode === 'score') {
        const padL = 16, padR = 16, padT = 66, padB = 24;
        const iw = W - padL - padR;
        geom.current = { padL, iw };
        const { melodic, drums, total, lo, hi } = score;
        const laneH = drums.length ? Math.min(18, (H - padT - padB) * 0.4 / drums.length) : 0;
        const drumTop = H - padB - laneH * drums.length;
        const rows = hi - lo + 1;
        const rowH = (drumTop - padT - (drums.length ? 10 : 0)) / rows;
        const bx = (b: number) => padL + ((b - vw.start) / vw.span) * iw;
        const visible = (b0: number, b1: number) => b1 >= vw.start && b0 <= vw.start + vw.span;
        const my = (m: number) => padT + (hi - m) * rowH;
        const scale = (SCALES[project.song.scale] ?? SCALES.major).steps;
        const playBeat = pos === null ? null : pos % total;
        const placed: Placed[] = [];

        // raked sand: one line per in-scale pitch, the root a little darker
        if (melodic.length) {
          for (let m = lo; m <= hi; m++) {
            const pc = (((m - project.song.root) % 12) + 12) % 12;
            if (!scale.includes(pc)) continue;
            g.strokeStyle = pc === 0 ? P.line : P.rake;
            g.lineWidth = 1;
            g.beginPath();
            const y = my(m) + rowH / 2;
            g.moveTo(padL, y);
            g.lineTo(W - padR, y);
            g.stroke();
          }
        }
        // harmony band: the chord of each bar, written only where it changes
        {
          const song = project.song;
          let prev = '';
          g.font = '11px Doto, monospace';
          g.textAlign = 'left';
          const first = Math.max(0, Math.floor(vw.start / BEATS_PER_BAR));
          const ppb = (bx(BEATS_PER_BAR) - bx(0)) / BEATS_PER_BAR;
          let lastX = -Infinity;
          for (let bar = first; bar * BEATS_PER_BAR < Math.min(total, vw.start + vw.span); bar++) {
            const x0 = bx(bar * BEATS_PER_BAR);
            if (bar % 2 === 1) {
              const x = Math.max(padL, x0);
              g.fillStyle = P.rake;
              g.fillRect(x, padT - 14, Math.min(W - padR, bx((bar + 1) * BEATS_PER_BAR)) - x, H - padB - padT + 14);
            }
            // chords may change on any beat: write each where it starts (the first visible one always)
            for (let b = 0; b < BEATS_PER_BAR; b++) {
              const beat = bar * BEATS_PER_BAR + b;
              if (beat >= total) break;
              const c = chordName(harmonyAt(song, offset + beat), song.root, song.scale);
              const label = `${c.roman}  ${c.name}`;
              const x = Math.max(padL, bx(beat));
              if ((label !== prev || (bar === first && b === 0)) && x - lastX > Math.min(56, ppb * 2 - 4)) {
                g.fillStyle = P.ink2;
                g.globalAlpha = 0.85;
                g.fillText(b ? c.name : label, x + 4, padT - 18);
                g.globalAlpha = 1;
                lastX = x;
              }
              prev = label;
            }
          }
        }
        timeAxis(bx, H - padB + 4, padL, W - padR);
        // keep notes inside the plot when zoomed
        g.save();
        g.beginPath();
        g.rect(padL - 2, 0, iw + 4, H);
        g.clip();

        const stone = (track: Track, note: Note, x: number, y: number, w: number, h: number, isSel: boolean) => {
          placed.push({ track, note, x, y, w, h });
          const sounding = playBeat !== null && playBeat >= note.beat && playBeat < note.beat + Math.max(note.duration, 0.05);
          // on a lit screen notes read like a display: brighter, even when not selected
          g.globalAlpha = P.glow > 0 ? (isSel ? 0.55 + 0.45 * note.velocity : 0.35 + 0.35 * note.velocity) : isSel ? 0.35 + 0.65 * note.velocity : 0.2 + 0.3 * note.velocity;
          g.fillStyle = track.color;
          if (P.glow > 0) {
            g.shadowColor = track.color;
            g.shadowBlur = P.glow * (sounding ? 14 : 7);
          }
          roundRect(g, x, y - (sounding ? 1 : 0), w, h + (sounding ? 2 : 0), h * P.round);
          g.fill();
          g.shadowBlur = 0;
          // a note that bends: draw the bend as a line leaving the note (a semitone per row)
          const e = note.expr;
          if (e && e.bend.some((b) => Math.abs(b) > 1e-3) && note.duration > 0) {
            g.globalAlpha = isSel ? 0.95 : 0.55;
            g.strokeStyle = track.color;
            g.lineWidth = 1.4;
            g.beginPath();
            e.at.forEach((a, i) => {
              const px = x + (a / note.duration) * w, py = y + h / 2 - e.bend[i] * rowH;
              if (i) g.lineTo(px, py);
              else g.moveTo(px, py);
            });
            g.stroke();
          }
          // ripples from freshly struck stones
          if (playBeat !== null) {
            let age = (playBeat - note.beat) * secPerBeat;
            if (age < 0) age += total * secPerBeat;
            if (age < 1.2) {
              const t = age / 1.2;
              g.globalAlpha = (1 - t) * 0.45 * (isSel ? 1 : 0.5);
              g.strokeStyle = track.color;
              g.lineWidth = 1;
              g.beginPath();
              g.ellipse(x + h / 2, y + h / 2, 4 + t * 22, 2 + t * 8, 0, 0, Math.PI * 2);
              g.stroke();
            }
          }
        };

        for (const { track, notes, glide } of melodic) {
          const isSel = track.id === selected?.id;
          if (glide.length) {
            // a glide track is one fine, glowing line per sounding stretch
            let run: [number, number][] = [];
            const flush = () => {
              glowLine(g, run, track.color, track.color, { width: isSel ? 1.3 : 0.9, glow: isSel ? 1 : 0.45, alpha: isSel ? 0.95 : 0.5 });
              run = [];
            };
            for (const [b, m, v] of glide) {
              if (v < 0.01 || !visible(b, b)) {
                flush();
                continue;
              }
              run.push([bx(b), my(m) + rowH / 2]);
            }
            flush();
            continue;
          }
          for (const note of notes) {
            if (!visible(note.beat, note.beat + note.duration)) continue;
            const x = bx(note.beat), w = Math.max(3, bx(note.beat + note.duration) - x - 1.5);
            const h = Math.max(3, Math.min(rowH * 0.78, 14));
            stone(track, note, x, my(note.midi) + (rowH - h) / 2, w, h, isSel);
          }
        }

        // drum lanes
        drums.forEach(({ track, notes }, li) => {
          const isSel = track.id === selected?.id;
          const y0 = drumTop + li * laneH;
          g.globalAlpha = 1;
          g.fillStyle = P.ink3;
          g.font = '9.5px Doto, monospace';
          g.textAlign = 'left';
          g.strokeStyle = P.rake;
          g.beginPath();
          g.moveTo(padL, y0 + laneH / 2);
          g.lineTo(W - padR, y0 + laneH / 2);
          g.stroke();
          const h = Math.max(3, laneH * 0.62);
          for (const note of notes) {
            if (!visible(note.beat, note.beat + note.duration)) continue;
            const x = bx(note.beat);
            const w = Math.max(h * 0.8, Math.min(bx(note.beat + note.duration) - x - 1, h * 1.4));
            stone(track, note, x, y0 + (laneH - h) / 2, w, h, isSel);
          }
        });

        g.restore();
        g.globalAlpha = 1;
        placedRef.current = placed;
        const hov = hoverRef.current;
        if (hov) {
          g.strokeStyle = P.ink;
          g.lineWidth = 1.2;
          roundRect(g, hov.x - 1.5, hov.y - 1.5, hov.w + 3, hov.h + 3, (hov.h + 3) / 2);
          g.stroke();
        }
        if (playBeat !== null && visible(playBeat, playBeat)) {
          const x = bx(playBeat);
          g.strokeStyle = P.accent;
          g.globalAlpha = 0.7;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x, padT - 8);
          g.lineTo(x, H - padB);
          g.stroke();
          g.globalAlpha = 1;
        }
      } else if (mode === 'function' && fnFull && selected) {
        placedRef.current = [];
        const { padL, padR, padT, padB } = PLOT;
        const iw = W - padL - padR;
        geom.current = { padL, iw };
        const glide = selected.playMode === 'glide' && !isDrum(selected.waveform);
        const N = fnFull.raw.length;
        const dt = fnFull.dt;
        const { lo, hi } = fnRange;
        const velH = Math.min(34, (H - padT - padB) * 0.2);
        const ch = H - padT - padB - velH - 12;
        const sx = (beat: number) => padL + ((beat - vw.start) / vw.span) * iw;
        // values beyond the plot (outside the pitch range) ride along its edge
        const sy = (v: number) => padT + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * ch;
        const vBase = H - padB;

        // axes: raw value on the left, the note it becomes on the right, x along the bottom
        g.font = '11px Doto, monospace';
        let lastNote = '';
        for (let i = 0; i <= 4; i++) {
          const v = lo + ((hi - lo) * i) / 4;
          const y = sy(v);
          g.strokeStyle = P.rake;
          g.beginPath();
          g.moveTo(padL, y);
          g.lineTo(W - padR, y);
          g.stroke();
          g.fillStyle = P.ink3;
          g.textAlign = 'right';
          g.fillText(v.toFixed(1), padL - 8, y + 3);
          if (!isDrum(selected.waveform)) {
            // the note you will hear at this height — after the pitch range
            const m = limitPitch(valueToPitch(v, selected.pitchMode, project.song.root, project.song.scale, selected.octave, !glide || selected.quantize, false), project.song.pitchRange);
            const name = midiToName(Math.round(m));
            g.textAlign = 'left';
            if (name !== lastNote) g.fillText(name, W - padR + 8, y + 3);
            lastNote = name;
          }
        }
        if (lo < 0 && hi > 0) {
          g.strokeStyle = P.line;
          g.setLineDash([2, 4]);
          g.beginPath();
          g.moveTo(padL, sy(0));
          g.lineTo(W - padR, sy(0));
          g.stroke();
          g.setLineDash([]);
        }
        timeAxis(sx, padT + ch + 3, padL, W - padR);
        if (fnRange.edges) {
          g.strokeStyle = P.accent;
          g.globalAlpha = 0.35;
          g.setLineDash([4, 4]);
          for (const e of [fnRange.edges.lo, fnRange.edges.hi]) {
            if (e < lo || e > hi) continue;
            g.beginPath();
            g.moveTo(padL, sy(e));
            g.lineTo(W - padR, sy(e));
            g.stroke();
          }
          g.setLineDash([]);
          g.globalAlpha = 1;
        }
        g.fillStyle = P.ink3;
        g.textAlign = 'left';
        g.fillText('y', padL - 30, padT - 14);
        // pattern boundaries, when the track is shorter than the loop
        const len = patternBeats(selected);
        if (len < fnFull.total - 1e-9) {
          g.strokeStyle = P.line;
          g.setLineDash([1, 5]);
          for (let b = Math.ceil(offset / len + 1e-9) * len - offset; b < fnFull.total; b += len) {
            if (b < 1e-9 || b < vw.start || b > vw.start + vw.span) continue;
            g.beginPath();
            g.moveTo(sx(b), padT);
            g.lineTo(sx(b), padT + ch);
            g.stroke();
          }
          g.setLineDash([]);
        }
        g.save();
        g.beginPath();
        g.rect(padL - 1, 0, iw + 2, H);
        g.clip();

        // the function, as one ink stroke — gaps where it is silent
        g.lineJoin = 'round';
        g.lineCap = 'round';
        const i0 = Math.max(1, Math.floor(vw.start / dt)), i1 = Math.min(N, Math.ceil((vw.start + vw.span) / dt) + 2);
        // when zoomed far out, draw at most ~2 segments per pixel
        const stride = Math.max(1, Math.floor((i1 - i0) / (iw * 2)));
        // one path per stretch: sounding stretches glow, silent ones are a faint hairline
        let run: [number, number][] = [];
        let runSilent: boolean | null = null;
        const flush = () => {
          if (runSilent) glowLine(g, run, P.ink3, selected.color, { width: 0.8, glow: 0, alpha: 0.4 });
          else glowLine(g, run, P.ink, selected.color, { width: 1.1, glow: 1 });
        };
        for (let i = Math.max(0, i0 - stride); i < i1; i += stride) {
          const silent = fnFull.vel[i] < 0.01;
          const pt: [number, number] = [sx(i * dt), sy(fnFull.raw[i])];
          if (runSilent !== null && silent !== runSilent) {
            run.push(pt); // join the stretches
            flush();
            run = [];
          }
          runSilent = silent;
          run.push(pt);
        }
        flush();
        g.globalAlpha = 1;

        // velocity: a continuous wash in glide mode, reeds per step in notes mode
        if (glide) {
          g.fillStyle = selected.color;
          g.globalAlpha = 0.18;
          g.beginPath();
          g.moveTo(sx(0), vBase);
          for (let i = 0; i < N; i++) g.lineTo(sx(i * dt), vBase - fnFull.vel[i] * velH);
          g.lineTo(sx(N * dt), vBase);
          g.fill();
          g.globalAlpha = 1;
        } else {
          const ppb = iw / vw.span;
          for (const st of fnFull.steps) {
            if (st.beat < vw.start - 1 || st.beat > vw.start + vw.span + 1) continue;
            const v = st.vel;
            const x = sx(st.beat), y = sy(st.raw);
            if (ppb * selected.stepBeats * stretchOf(selected) < 2 && v < 0.01) continue; // too dense to show rests
            g.globalAlpha = v < 0.01 ? 0.25 : 1;
            g.fillStyle = v < 0.01 ? P.paper : selected.color;
            g.strokeStyle = v < 0.01 ? P.ink3 : selected.color;
            g.lineWidth = 1.2;
            g.beginPath();
            g.arc(x, y, 2.5 + v * 2.5, 0, Math.PI * 2);
            g.fill();
            g.stroke();
            g.globalAlpha = 0.25 + v * 0.75;
            g.strokeStyle = P.ink2;
            g.lineWidth = 1.5;
            g.beginPath();
            g.moveTo(x, vBase);
            g.lineTo(x, vBase - v * velH);
            g.stroke();
          }
          g.globalAlpha = 1;
        }

        g.restore();
        // the playhead (or the scrub cursor) rides the curve
        const beat = scrubRef.current ?? (pos === null ? null : pos % fnFull.total);
        if (beat !== null && beat >= vw.start && beat <= vw.start + vw.span) {
          const i = Math.min(N - 1, Math.floor(beat / dt));
          const x = sx(beat), y = sy(fnFull.raw[i]);
          g.strokeStyle = P.accent;
          g.globalAlpha = 0.35;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x, padT - 6);
          g.lineTo(x, vBase);
          g.stroke();
          g.globalAlpha = 0.18;
          g.fillStyle = P.accent;
          g.beginPath();
          g.arc(x, y, 12, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          g.beginPath();
          g.arc(x, y, 4.5, 0, Math.PI * 2);
          g.fill();
        }
      } else if (mode === 'ripple') {
        placedRef.current = [];
        const live = engine.waveform(wave);
        const heard = drawRipple(
          g,
          W,
          H,
          RIPPLE_TOP,
          RIPPLE_BOTTOM,
          P,
          {
            wave: live ? wave : null,
            playBeat: pos === null ? null : pos % score.total,
            secPerBeat,
            score,
            now: performance.now() / 1000,
          },
          rippleRef.current,
          rippleMem.current,
        );
        if (heard !== rippleHeard.current) {
          rippleHeard.current = heard;
          setRippleLive(heard);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode, score, fnFull, fnRange, selected, project.song, offset]);

  const hit = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    // prefer the selected track when stones overlap
    let best: Placed | null = null;
    for (const p of placedRef.current) {
      if (x >= p.x - 2 && x <= p.x + p.w + 2 && y >= p.y - 3 && y <= p.y + p.h + 3) {
        if (!best || p.track.id === selected?.id) best = p;
      }
    }
    return { best, x };
  };

  /** Function view: map the pointer's x onto the curve and sound it */
  const scrubAt = (e: React.PointerEvent) => {
    if (!fnFull || !selected) return;
    const r = canvasRef.current!.getBoundingClientRect();
    const v = view();
    const fx = Math.min(0.9999, Math.max(0, (e.clientX - r.left - PLOT.padL) / (r.width - PLOT.padL - PLOT.padR)));
    const beat = v.start + fx * v.span;
    const i = Math.min(fnFull.raw.length - 1, Math.floor(beat / fnFull.dt));
    scrubRef.current = beat;
    dirty.current = true;
    engine.scrub(selected, fnFull.midi[i], fnFull.vel[i]);
    const bar0 = Math.floor(beat / BEATS_PER_BAR), inBar = beat - bar0 * BEATS_PER_BAR;
    const bar = bar0 + Math.round(offset / BEATS_PER_BAR) + 1;
    setTip({
      x: e.clientX - r.left,
      y: 64,
      text: [
        `bar ${bar} · beat ${(inBar + 1).toFixed(2)}  ·  y ${fnFull.raw[i].toFixed(3)}`,
        isDrum(selected.waveform) ? voiceLabel(selected.waveform) : `${midiToName(Math.round(fnFull.midi[i]))}  ·  ${fnFull.midi[i].toFixed(2)}`,
      ],
    });
  };
  const endScrub = () => {
    if (scrubRef.current === null) return;
    scrubRef.current = null;
    dirty.current = true;
    engine.scrubEnd();
    setTip(null);
  };

  return (
    <>
      <div className="viz" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={(e) => {
            if (mode !== 'function') return;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            scrubAt(e);
          }}
          onPointerMove={(e) => {
            if (mode === 'function') {
              if (scrubRef.current !== null) scrubAt(e);
              return;
            }
            if (mode !== 'score') return;
            const { best, x } = hit(e);
            if (best !== hoverRef.current) dirty.current = true;
            hoverRef.current = best;
            setTip(
              best
                ? {
                    x,
                    y: best.y,
                    text: isDrum(best.track.waveform)
                      ? [`${best.note.name}  ·  vel ${Math.round(best.note.velocity * 127)}  ·  step ${best.note.step}`, `${best.track.name}${best.note.tune ? `  ·  tune ${best.note.tune.toFixed(1)}` : ''}`]
                      : [
                          `${best.note.name}  ·  midi ${best.note.midi}  ·  ${best.note.freq.toFixed(1)} Hz`,
                          `vel ${(best.note.velocity * 127).toFixed(0)}  ·  ${best.note.duration.toFixed(2)} beats  ·  step ${best.note.step}`,
                          `${best.track.name}  ·  f = ${best.note.raw.toFixed(3)}  ·  chord ${chordName(best.note.h, project.song.root, project.song.scale).name}`,
                        ],
                  }
                : null,
            );
          }}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onPointerLeave={() => {
            if (mode === 'function') return;
            hoverRef.current = null;
            dirty.current = true;
            setTip(null);
          }}
          onDoubleClick={() => mode !== 'ripple' && setView(0, 0)}
          onClick={(e) => {
            if (mode !== 'score') return;
            const { best } = hit(e);
            if (best) {
              selectTrack(best.track.id);
              engine.preview(best.track, best.note.midi, best.note.velocity);
            }
          }}
          style={{ cursor: mode === 'function' ? 'ew-resize' : tip ? 'pointer' : 'default', touchAction: 'none' }}
        />
        <div className="viz-legend">
          <h2>{mode === 'score' ? 'The Track' : mode === 'function' ? selected?.name ?? '—' : 'Ripple'}</h2>
          <span className="muted">
            {mode !== 'ripple' && (project.song.repeat === 'exact' ? '⟲ repeats exactly · ' : pass > 0 ? `pass ${pass + 1} · ` : '')}
            {mode === 'score' && `${Number(score.total.toFixed(3))} beats · ${midiToName(score.lo + 2)}–${midiToName(score.hi - 2)}${score.drums.length ? ` · ${score.drums.length} drum lanes` : ''}`}
            {mode === 'function' &&
              `y = f(x) · ${Number(score.total.toFixed(3))} beats · drag to hear it${
                fnRange.outside > 0
                  ? ` · ${Math.max(1, Math.round(fnRange.outside * 100))}% ${project.song.pitchRange.mode === 'wrap' ? 'wrapped' : 'clamped'} into ${midiToName(project.song.pitchRange.low)}–${midiToName(project.song.pitchRange.high)}`
                  : ''
              }`}
            {mode === 'ripple' && `${RIPPLE_STYLES.find((x) => x.value === ripple.style)?.hint ?? ''}${playing || rippleLive ? '' : ' · press space to listen'}`}
          </span>
        </div>
        {mode !== 'ripple' && <RangeControl />}
        {mode !== 'ripple' && (
          <div className="viz-zoom">
            {view().zoomed && (
              <span className="muted">
                bars {Math.floor((offset + view().start) / BEATS_PER_BAR) + 1}–{Math.ceil((offset + view().start + view().span) / BEATS_PER_BAR)}
              </span>
            )}
            {mode === 'score' && (
              <button
                className={`icon-btn ${math.open ? 'on' : ''}`}
                aria-pressed={math.open}
                onClick={() => setMath({ open: !math.open })}
                title={math.open ? 'Hide the functions' : 'Show the function of every channel you can hear, as math, over the score'}
                aria-label="Functions"
              >
                <span className="fx-glyph">ƒ</span>
              </button>
            )}
            <button className="icon-btn" onClick={() => zoomAt(1 / 1.6)} title="Zoom in (⌘/Ctrl + scroll, or pinch)">
              <Icon name="plus" size={13} />
            </button>
            <button className="icon-btn" onClick={() => zoomAt(1.6)} title="Zoom out">
              <Icon name="minus" size={13} />
            </button>
            <button className="icon-btn" onClick={() => setView(0, 0)} title="Show the whole loop (double-click the view)" disabled={!view().zoomed}>
              <Icon name="fit" size={13} />
            </button>
          </div>
        )}
        {mode === 'ripple' && (
          <div className="ripple-opts">
            <Seg<RippleStyle> value={ripple.style} onChange={(style) => setRipple({ style })} options={RIPPLE_STYLES.map(({ value, label }) => ({ value, label }))} />
            <span className="ripple-opts-row">
              <button className={`btn small ghost ${ripple.trails ? 'on' : ''}`} aria-pressed={ripple.trails} onClick={() => setRipple({ trails: !ripple.trails })} title="Older frames linger and fade">
                Trails
              </button>
              <button
                className={`btn small ghost ${ripple.colour === 'channels' ? 'on' : ''}`}
                aria-pressed={ripple.colour === 'channels'}
                onClick={() => setRipple({ colour: ripple.colour === 'channels' ? 'ink' : 'channels' })}
                title={ripple.colour === 'channels' ? 'In the channels’ colours — click for one ink' : 'In one ink — click for the channels’ colours'}
              >
                Colours
              </button>
            </span>
          </div>
        )}
        <div className="viz-tabs">
          <Seg<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'score', label: 'Score' },
              { value: 'function', label: 'Function' },
              { value: 'ripple', label: 'Ripple' },
            ]}
          />
        </div>
        {tip && (
          <div className="viz-tip" style={{ left: tip.x, top: tip.y }}>
            {tip.text.map((t) => (
              <div key={t}>{t}</div>
            ))}
          </div>
        )}
      </div>
      {/* the functions take their own row under the score, never its room */}
      {mode === 'score' && math.open && <ScoreMath detail={math.detail} onDetail={(detail) => setMath({ detail })} />}
    </>
  );
}
