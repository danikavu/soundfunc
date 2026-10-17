# SoundFunc 音 · 数

Sonification in a zen garden: build melodies from mathematical functions with a node editor, hear them live, watch them as stones on raked sand, and export to MIDI.

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests
npm run build
```

## Using it

- **Space** plays / stops. **⌘Z / ⇧⌘Z** undo / redo. Edits are heard live while playing.
- **Plant a function** (left) adds a track from a preset: Fibonacci, logistic-map chaos, golden ratio, digits of π, Collatz, Lissajous, Euclidean rhythms…
- **Node editor** (bottom): double-click the canvas or press *Add node*. Drag a wire into empty space to add a node that's already connected. Every node shows a sparkline of its output over the pattern.
- **Note Out** decides what you hear each step: `pitch` (mapped onto the key & scale), `velocity` (0 = rest), `length` (in steps).
- **Formula** nodes accept expressions like `3*sin(tau*x) + (k % 3)` using inputs `a b c` and the clock `n x t k`. See the *Guide* tab for every function.
- **Visualizer** (top): *Score* (all tracks), *Function* (the raw curve of the selected track), *Ripple* (live waveform).
- **Export**: MIDI (multi-track, tempo + key signature, GM instruments), note data CSV (pitch, MIDI number, frequency, velocity, key, timing), or the project as JSON. Projects also autosave to the browser.

## Structure

```
src/engine/   framework-free core (unit-tested)
  expr.ts       safe expression parser → closures, math/music function library
  graph.ts      node definitions + graph compiler (topological, cycle-safe)
  music.ts      scales (incl. Hirajōshi, In Sen, Iwato, Yo), degree/semitone mapping
  project.ts    tracks, songs, note generation
  audio.ts      Web Audio scheduler + synth voices (bell FM, koto pluck, pad, shakuhachi…)
  midi.ts       Standard MIDI File writer + CSV export
  presets.ts    default functions
src/state/    zustand store (persisted, undo/redo)
src/components/ React UI (React Flow node editor, canvas visualizer)
```

Adding a node type is just a new entry in `NODE_DEFS` in `graph.ts`. The UI, palette and evaluator pick it up automatically.
