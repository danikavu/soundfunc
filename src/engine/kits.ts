/**
 * Planting kits and sizing channels to the song — shared by the app and the Max for Live
 * device, so a kit loads the same way in both.
 */
import { harmonyCycleBars, songGridLength, type Song, type Track } from './project';
import { applyGrid, fixedLengthFor, gridOf } from './steps';
import type { Kit } from './presets';

/** with a fixed song length, a channel is re-gridded to fill it exactly; a free song leaves it as it is */
export function fitToSong(t: Track, song: Song): Track {
  const L = songGridLength(song);
  return L === null ? t : { ...t, ...applyGrid(gridOf(t), {}, L) };
}

/**
 * The song a kit plants into (replacing the track): channels that share a length make a fixed
 * song long enough for the progression too; channels of different lengths (polyrhythms) make
 * a free song.
 */
export function kitSong(kit: Kit, tracks: Track[], current: Song): Song {
  const song: Song = { ...current, ...kit.song };
  const lengths = tracks.map((t) => t.steps * t.stepBeats);
  const same = lengths.every((l) => Math.abs(l - lengths[0]) < 1e-9);
  const cycle = harmonyCycleBars(song);
  return same
    ? { ...song, lengthMode: 'fixed', lengthBeats: fixedLengthFor(Math.max(lengths[0], cycle < 16 ? cycle * 4 : 0)) }
    : { ...song, lengthMode: 'free', lengthBeats: fixedLengthFor(Math.max(...lengths)) };
}
