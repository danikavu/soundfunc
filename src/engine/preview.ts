/**
 * Mini scores: a small drawing of what a channel plays — for the Function presets and My
 * functions lists. Made from the real render (renderTrack, with the song's key, scale, harmony
 * and pitch range), so a preview always matches what planting it gives.
 *
 * The drawing is plain geometry in a W × H box (no React), cached by what it depends on, so
 * the list only ever renders a function once per song setting.
 */
import { DEFAULT_PITCH_RANGE } from './music';
import { isDrum, patternBeats, renderTrack, type Song, type Track } from './project';

export const MINI_W = 120;
export const MINI_H = 24;

export interface MiniScore {
  kind: 'notes' | 'glide' | 'drums' | 'silent';
  /** notes and drum hits: x, y, width, height, opacity */
  bars: [number, number, number, number, number][];
  /** glide: one polyline, broken where it rests */
  path: string;
}

/** the song settings a render depends on — not tempo, volume or reverb, which don't change the notes */
export function songKey(song: Song): string {
  const r = song.pitchRange ?? DEFAULT_PITCH_RANGE;
  return [song.root, song.scale, song.harmony, song.lengthMode, song.lengthBeats, r.mode, r.low, r.high].join('|');
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** draw one pass of `track` (already fitted to the song, as planting would) */
export function miniScore(track: Track, song: Song, W = MINI_W, H = MINI_H): MiniScore {
  const length = patternBeats(track);
  const { notes, curve } = renderTrack(track, song, 0, false);
  const drum = isDrum(track.waveform);
  const xOf = (beat: number) => (beat / length) * W;
  if (!(length > 0)) return { kind: 'silent', bars: [], path: '' };

  if (track.playMode === 'glide' && !drum) {
    let lo = Infinity, hi = -Infinity;
    curve.midi.forEach((m, i) => curve.velocity[i] >= 0.01 && ((lo = Math.min(lo, m)), (hi = Math.max(hi, m))));
    if (!Number.isFinite(lo)) return { kind: 'silent', bars: [], path: '' };
    const mid = (lo + hi) / 2, half = Math.max(3, (hi - lo) / 2);
    const yOf = (m: number) => H - 2 - ((m - (mid - half)) / (2 * half)) * (H - 4);
    // about one point per unit of width: plenty for the eye, a short path for the DOM
    const stride = Math.max(1, Math.floor(curve.midi.length / W));
    let path = '', pen = false;
    for (let i = 0; i < curve.midi.length; i += stride) {
      if (curve.velocity[i] < 0.01) {
        pen = false;
        continue;
      }
      path += `${pen ? 'L' : 'M'}${r1(xOf(curve.beat[i]))},${r1(yOf(curve.midi[i]))}`;
      pen = true;
    }
    return { kind: 'glide', bars: [], path };
  }

  if (!notes.length) return { kind: 'silent', bars: [], path: '' };
  const minW = 1.2;
  if (drum) {
    // hits: a bar from the floor, as tall as it is loud
    return {
      kind: 'drums',
      bars: notes.map((n) => {
        const h = 4 + n.velocity * (H - 6);
        return [r1(xOf(n.beat)), r1(H - 1 - h), Math.max(minW, r1(Math.min(xOf(n.duration), W / 32))), r1(h), 0.45 + n.velocity * 0.55];
      }),
      path: '',
    };
  }
  let lo = Infinity, hi = -Infinity;
  for (const n of notes) (lo = Math.min(lo, n.midi)), (hi = Math.max(hi, n.midi));
  // at least an octave tall, so a three-note riff doesn't fill the box
  const span = Math.max(12, hi - lo + 1), base = (lo + hi) / 2 - span / 2;
  const noteH = Math.max(1.5, Math.min(3, (H - 2) / span));
  const yOf = (m: number) => H - 1 - ((m - base + 0.5) / span) * (H - 2) - noteH / 2;
  return {
    kind: 'notes',
    // a note ringing past the pass ends at the box's edge
    bars: notes.map((n) => [r1(xOf(n.beat)), r1(yOf(n.midi)), Math.max(minW, r1(Math.min(xOf(n.duration), W - xOf(n.beat)) - 0.4)), noteH, 0.4 + n.velocity * 0.6]),
    path: '',
  };
}

// ---------- the cache ----------

const CAP = 400;
const cache = new Map<string, MiniScore>();

/** the drawing for `id` under this song, if it's been made */
export const cachedMini = (id: string, key: string) => cache.get(`${id}#${key}`);

export function rememberMini(id: string, key: string, mini: MiniScore) {
  const k = `${id}#${key}`;
  cache.delete(k);
  cache.set(k, mini);
  // the oldest go first
  while (cache.size > CAP) cache.delete(cache.keys().next().value!);
}
