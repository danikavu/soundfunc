import { compileGraph, type Graph } from './graph';
import { midiToFreq, midiToName, NOTE_NAMES, valueToMidi, type PitchMode } from './music';

export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'bell' | 'pluck' | 'pad' | 'flute';

export const WAVEFORMS: Record<Waveform, string> = {
  sine: 'Sine',
  triangle: 'Triangle',
  square: 'Square',
  sawtooth: 'Sawtooth',
  bell: 'Temple Bell',
  pluck: 'Koto Pluck',
  pad: 'Mist Pad',
  flute: 'Shakuhachi',
};

export interface Track {
  id: string;
  name: string;
  color: string;
  graph: Graph;
  steps: number;
  /** step length in beats (0.25 = sixteenth) */
  stepBeats: number;
  octave: number;
  pitchMode: PitchMode;
  waveform: Waveform;
  volume: number;
  pan: number;
  attack: number;
  release: number;
  muted: boolean;
  solo: boolean;
}

export interface Song {
  bpm: number;
  root: number;
  scale: string;
  reverb: number;
  /** how many times the longest pattern repeats on MIDI export */
  exportLoops: number;
}

export interface Project {
  name: string;
  song: Song;
  tracks: Track[];
}

/** A generated note — everything needed for playback, visuals and export. */
export interface Note {
  step: number;
  loop: number;
  /** start time in beats from the start of the loop pass */
  beat: number;
  /** duration in beats */
  duration: number;
  midi: number;
  name: string;
  freq: number;
  velocity: number;
  /** raw value fed into the pitch input before mapping */
  raw: number;
  key: string;
}

export interface TrackRender {
  notes: Note[];
  /** raw per-step pitch value, including rests */
  pitchCurve: number[];
  velocityCurve: number[];
  /** per-node sparkline values */
  traces: Map<string, number[]>;
  errors: Map<string, string>;
  hasOutput: boolean;
}

export function keyLabel(song: Song): string {
  return `${NOTE_NAMES[song.root]} ${song.scale}`;
}

export function renderTrack(track: Track, song: Song, loop = 0, withTraces = true): TrackRender {
  const program = compileGraph(track.graph);
  const traces = withTraces ? new Map<string, number[]>() : undefined;
  const notes: Note[] = [];
  const pitchCurve: number[] = [];
  const velocityCurve: number[] = [];
  const key = keyLabel(song);
  let hasOutput = true;

  for (let n = 0; n < track.steps; n++) {
    const ctx = { n, x: n / track.steps, t: n * track.stepBeats, k: loop, steps: track.steps };
    const out = program.run(ctx, traces);
    if (!out) {
      hasOutput = false;
      break;
    }
    pitchCurve.push(out.pitch);
    const vel = Math.max(0, Math.min(1, out.velocity));
    velocityCurve.push(vel);
    if (vel < 0.01) continue;
    const midi = valueToMidi(out.pitch, track.pitchMode, song.root, song.scale, track.octave);
    const len = Math.max(0.05, Math.min(64, out.length));
    notes.push({
      step: n,
      loop,
      beat: n * track.stepBeats,
      duration: len * track.stepBeats,
      midi,
      name: midiToName(midi),
      freq: midiToFreq(midi),
      velocity: vel,
      raw: out.pitch,
      key,
    });
  }
  return { notes, pitchCurve, velocityCurve, traces: traces ?? new Map(), errors: program.errors, hasOutput };
}

export function patternBeats(track: Track): number {
  return track.steps * track.stepBeats;
}

export function audibleTracks(tracks: Track[]): Track[] {
  const anySolo = tracks.some((t) => t.solo);
  return tracks.filter((t) => (anySolo ? t.solo : !t.muted));
}
