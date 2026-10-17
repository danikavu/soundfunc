import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../engine/audio';
import { SCALES, midiToName } from '../engine/music';
import { audibleTracks, patternBeats, renderTrack, type Note, type Track } from '../engine/project';
import { useSelectedTrack, useStore } from '../state/store';
import { Seg, getRender } from './ui';

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
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { paper: v('--paper'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), line: v('--line'), rake: v('--rake'), accent: v('--accent') };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** smooth curve through points (Catmull–Rom → Bézier) */
function smoothPath(g: CanvasRenderingContext2D, pts: [number, number][]) {
  if (!pts.length) return;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}

export function Visualizer() {
  const project = useStore((s) => s.project);
  const theme = useStore((s) => s.theme);
  const playing = useStore((s) => s.playing);
  const selectTrack = useStore((s) => s.selectTrack);
  const selected = useSelectedTrack();
  const [mode, setMode] = useState<Mode>('score');
  const [tip, setTip] = useState<{ x: number; y: number; text: string[] } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placedRef = useRef<Placed[]>([]);
  const hoverRef = useRef<Placed | null>(null);
  const dirty = useRef(true);
  const palette = useRef<Palette | null>(null);

  // every audible track tiled across the longest pattern — loop k matters for evolving tracks
  const score = useMemo(() => {
    const tracks = audibleTracks(project.tracks);
    const total = Math.max(1, ...tracks.map(patternBeats));
    const items: { track: Track; notes: Note[] }[] = tracks.map((track) => {
      const len = patternBeats(track);
      const notes: Note[] = [];
      const loops = Math.ceil(total / len - 1e-9);
      for (let k = 0; k < loops; k++) {
        const src = k === 0 ? getRender(track, project.song).notes : renderTrack(track, project.song, k, false).notes;
        for (const n of src) if (k * len + n.beat < total) notes.push({ ...n, beat: k * len + n.beat });
      }
      return { track, notes };
    });
    let lo = 127, hi = 0;
    for (const it of items) for (const n of it.notes) (lo = Math.min(lo, n.midi)), (hi = Math.max(hi, n.midi));
    if (lo > hi) (lo = 48), (hi = 72);
    return { items, total, lo: lo - 2, hi: hi + 2 };
  }, [project]);

  const fn = useMemo(() => (selected ? getRender(selected, project.song) : null), [selected, project.song]);

  useEffect(() => {
    palette.current = null;
    dirty.current = true;
  }, [theme]);
  useEffect(() => {
    dirty.current = true;
  }, [score, fn, mode, selected?.id]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dpr;
      canvas.height = wrap.clientHeight * dpr;
      dirty.current = true;
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // draw loop
  useEffect(() => {
    let raf = 0;
    const wave = new Float32Array(2048);
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const pos = engine.position();
      if (!dirty.current && pos === null && mode !== 'ripple') return;
      dirty.current = false;
      const canvas = canvasRef.current!;
      const g = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr, H = canvas.height / dpr;
      const P = (palette.current ??= readPalette());
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const padL = 16, padR = 16, padT = 48, padB = 18;
      const iw = W - padL - padR, ih = H - padT - padB;
      const secPerBeat = 60 / project.song.bpm;

      if (mode === 'score') {
        const { items, total, lo, hi } = score;
        const rows = hi - lo + 1;
        const rowH = ih / rows;
        const bx = (b: number) => padL + (b / total) * iw;
        const my = (m: number) => padT + (hi - m) * rowH;
        const scale = (SCALES[project.song.scale] ?? SCALES.major).steps;

        // raked sand: one line per in-scale pitch, the root a little darker
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
        // beat ticks
        g.fillStyle = P.ink3;
        for (let b = 0; b <= total; b++) {
          const x = bx(b);
          g.globalAlpha = b % 4 === 0 ? 0.5 : 0.18;
          g.fillRect(x - 0.5, H - padB + 6, 1, b % 4 === 0 ? 6 : 3);
        }
        g.globalAlpha = 1;

        const playBeat = pos === null ? null : pos % total;
        const placed: Placed[] = [];
        for (const { track, notes } of items) {
          const isSel = track.id === selected?.id;
          for (const note of notes) {
            const x = bx(note.beat), w = Math.max(3, bx(note.beat + note.duration) - x - 1.5);
            const h = Math.max(3, Math.min(rowH * 0.78, 14));
            const y = my(note.midi) + (rowH - h) / 2;
            placed.push({ track, note, x, y, w, h });
            const sounding = playBeat !== null && playBeat >= note.beat && playBeat < note.beat + note.duration;
            g.globalAlpha = (isSel ? 0.35 + 0.65 * note.velocity : 0.18 + 0.25 * note.velocity) * (sounding ? 1 : 0.92);
            g.fillStyle = track.color;
            roundRect(g, x, y - (sounding ? 1 : 0), w, h + (sounding ? 2 : 0), h / 2);
            g.fill();
            // ripples from freshly struck stones
            if (playBeat !== null) {
              let age = (playBeat - note.beat) * secPerBeat;
              if (age < 0) age += total * secPerBeat;
              if (age < 1.4) {
                const t = age / 1.4;
                g.globalAlpha = (1 - t) * 0.5 * (isSel ? 1 : 0.5);
                g.strokeStyle = track.color;
                g.lineWidth = 1;
                g.beginPath();
                g.ellipse(x + h / 2, y + h / 2, 4 + t * 26, 2 + t * 10, 0, 0, Math.PI * 2);
                g.stroke();
              }
            }
          }
        }
        g.globalAlpha = 1;
        placedRef.current = placed;
        const hov = hoverRef.current;
        if (hov) {
          g.strokeStyle = P.ink;
          g.lineWidth = 1.2;
          roundRect(g, hov.x - 1.5, hov.y - 1.5, hov.w + 3, hov.h + 3, (hov.h + 3) / 2);
          g.stroke();
        }
        if (playBeat !== null) {
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
      } else if (mode === 'function' && fn && selected) {
        placedRef.current = [];
        const curve = fn.pitchCurve, vel = fn.velocityCurve;
        const n = curve.length;
        let lo = Math.min(...curve), hi = Math.max(...curve);
        if (!isFinite(lo) || !isFinite(hi)) (lo = -1), (hi = 1);
        if (hi - lo < 1e-6) (lo -= 1), (hi += 1);
        const span = hi - lo;
        lo -= span * 0.08;
        hi += span * 0.08;
        const velH = Math.min(36, ih * 0.2);
        const ch = ih - velH - 10;
        const sx = (i: number) => padL + 34 + ((i + 0.5) / Math.max(1, n)) * (iw - 34);
        const sy = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * ch;

        // axis + zero line
        g.font = '10px JetBrains Mono, monospace';
        g.fillStyle = P.ink3;
        g.textAlign = 'right';
        for (const v of [hi, (hi + lo) / 2, lo]) {
          const y = sy(v);
          g.fillText(v.toFixed(1), padL + 26, y + 3);
          g.strokeStyle = P.rake;
          g.beginPath();
          g.moveTo(padL + 32, y);
          g.lineTo(W - padR, y);
          g.stroke();
        }
        if (lo < 0 && hi > 0) {
          g.strokeStyle = P.line;
          g.setLineDash([2, 4]);
          g.beginPath();
          g.moveTo(padL + 32, sy(0));
          g.lineTo(W - padR, sy(0));
          g.stroke();
          g.setLineDash([]);
        }

        // the function, as one ink stroke
        const pts = curve.map((v, i) => [sx(i), sy(v)] as [number, number]);
        g.strokeStyle = P.ink;
        g.lineWidth = 1.8;
        g.lineJoin = 'round';
        g.beginPath();
        smoothPath(g, pts);
        g.stroke();

        const curStep = pos === null ? -1 : Math.floor((pos % patternBeats(selected)) / selected.stepBeats);
        // samples and velocity reeds
        for (let i = 0; i < n; i++) {
          const v = vel[i];
          const x = sx(i), y = sy(curve[i]);
          const on = i === curStep;
          g.globalAlpha = v < 0.01 ? 0.25 : 1;
          g.fillStyle = v < 0.01 ? P.paper : selected.color;
          g.strokeStyle = v < 0.01 ? P.ink3 : selected.color;
          g.beginPath();
          g.arc(x, y, on ? 6 : 2.5 + v * 2.5, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.globalAlpha = 0.25 + v * 0.75;
          g.strokeStyle = on ? P.accent : P.ink2;
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x, H - padB);
          g.lineTo(x, H - padB - v * velH);
          g.stroke();
        }
        g.globalAlpha = 1;
        if (curStep >= 0) {
          g.strokeStyle = P.accent;
          g.globalAlpha = 0.35;
          g.beginPath();
          g.moveTo(sx(curStep), padT - 6);
          g.lineTo(sx(curStep), H - padB);
          g.stroke();
          g.globalAlpha = 1;
        }
      } else if (mode === 'ripple') {
        placedRef.current = [];
        const cx = W / 2, cy = padT / 2 + H / 2;
        const R = Math.min(W, H - padT) * 0.28;
        // raked rings
        g.strokeStyle = P.rake;
        g.lineWidth = 1;
        for (let i = 1; i <= 9; i++) {
          g.beginPath();
          g.arc(cx, cy, R * 0.35 + i * R * 0.17, 0, Math.PI * 2);
          g.stroke();
        }
        g.fillStyle = P.ink;
        g.beginPath();
        g.ellipse(cx, cy, R * 0.28, R * 0.22, -0.3, 0, Math.PI * 2);
        g.fill();
        if (engine.waveform(wave)) {
          // find a rising zero crossing so the shape holds still
          let start = 0;
          for (let i = 1; i < 1024; i++) if (wave[i - 1] < 0 && wave[i] >= 0) { start = i; break; }
          const N = 720;
          g.strokeStyle = P.accent;
          g.lineWidth = 1.4;
          g.beginPath();
          for (let i = 0; i <= N; i++) {
            const a = (i / N) * Math.PI * 2 - Math.PI / 2;
            const r = R * 0.75 + wave[start + (i % N)] * R * 1.1;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            i ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.stroke();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode, score, fn, selected, project.song]);

  const hit = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const placed = placedRef.current;
    // prefer the selected track when stones overlap
    let best: Placed | null = null;
    for (const p of placed) {
      if (x >= p.x - 2 && x <= p.x + p.w + 2 && y >= p.y - 3 && y <= p.y + p.h + 3) {
        if (!best || p.track.id === selected?.id) best = p;
      }
    }
    return { best, x, y };
  };

  return (
    <div className="viz" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          const { best, x } = hit(e);
          if (best !== hoverRef.current) dirty.current = true;
          hoverRef.current = best;
          setTip(
            best
              ? {
                  x,
                  y: best.y,
                  text: [
                    `${best.note.name}  ·  midi ${best.note.midi}  ·  ${best.note.freq.toFixed(1)} Hz`,
                    `vel ${(best.note.velocity * 127).toFixed(0)}  ·  ${best.note.duration.toFixed(2)} beats  ·  step ${best.note.step}`,
                    `${best.track.name}  ·  f = ${best.note.raw.toFixed(3)}`,
                  ],
                }
              : null,
          );
        }}
        onMouseLeave={() => {
          hoverRef.current = null;
          dirty.current = true;
          setTip(null);
        }}
        onClick={(e) => {
          const { best } = hit(e);
          if (best) {
            selectTrack(best.track.id);
            engine.preview(best.track, best.note.midi, best.note.velocity);
          }
        }}
        style={{ cursor: tip ? 'pointer' : 'default' }}
      />
      <div className="viz-legend">
        <h2>{mode === 'score' ? 'The Garden' : mode === 'function' ? selected?.name ?? '—' : 'Ripple'}</h2>
        <span className="muted">
          {mode === 'score' && `${score.total} beats · ${midiToName(score.lo + 2)}–${midiToName(score.hi - 2)}`}
          {mode === 'function' && 'raw function value per step · reeds show velocity'}
          {mode === 'ripple' && (playing ? 'live waveform' : 'press space to listen')}
        </span>
      </div>
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
  );
}
