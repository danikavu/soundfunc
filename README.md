# SoundFunc 音 · 数

Sonification -> make melodies from mathematical functions with a node editor, hear them live, and export to MIDI.

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests
npm run build
npm run build:m4l   # the Max for Live device → m4l/device
```

## Max for Live

SoundFunc also runs inside Ableton Live as a **MIDI Effect**: your functions, kits and harmony in time with Live's transport, into any instrument, with this app as its editor. See [m4l/README.md](m4l/README.md) to build the device (one copy-paste in Max) and use it.

## Structure

```
src/engine/   framework-free core (unit-tested)
  expr.ts       safe expression parser → closures, math/music function library
  graph.ts      node definitions + graph compiler (topological, cycle-safe)
  music.ts      scales (incl. Hirajōshi, In Sen, Iwato, Yo), degree/semitone mapping
  project.ts    tracks, songs, note generation
  audio.ts      Web Audio scheduler + synth voices (bell FM, koto pluck, pad, shakuhachi…)
  midi.ts       MIDI events for any stretch of the song (files, MPE, the Live device) + CSV export
  kits.ts       planting kits, fitting channels to the song (shared with the Live device)
  synth.ts      the synth patches: unison, filter + envelope, drive, sauce
  timbre.ts     formula → one-cycle waveform → Fourier harmonics
  mutate.ts     the randomizer: role-aware parameter & formula mutation + musical fitness
  symbolic.ts   graph → closed-form expression → LaTeX / SoundFunc / JavaScript / Python
  importMath.ts LaTeX / Desmos / plain math → SoundFunc expression (piecewise → velocity gate)
  graphEdit.ts  explode, collapse, blocks, audition — pure graph transforms
  blocks.ts     built-in blocks
  presets.ts    default functions
src/state/    zustand store (persisted, undo/redo)
src/device.ts the editor inside the Live device: no sound, Live's playhead, project shared with the device
m4l/          the Max for Live device: host.ts (Live's transport in → MIDI out), max-entry.ts, make-patch.ts
src/components/ React UI (React Flow node editor, canvas visualizer)
```

Adding a node type is just a new entry in `NODE_DEFS` in `graph.ts`. The UI, palette and evaluator pick it up automatically.
