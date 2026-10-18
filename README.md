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
- **Visualizer** (top): *Score* (all tracks, drums in their own lanes), *Function* (y = f(x) for the selected track; **drag across it to hear the curve**), *Ripple* (live waveform).
- **Glide mode** (Track → Play as): instead of notes, one voice slides continuously along the curve — `x`/`t` flow smoothly, `n` still ticks per step. Snap to the scale or play free pitch, with adjustable portamento. Exported to MIDI as pitch bend (±24 st) + CC11 expression.
- **f(p) Custom voice**: write one cycle of the waveform itself (`sin(tau*p + 2*sin(tau*p))`); it is turned into an oscillator via its Fourier series.
- **Drums & rhythm**: kick, snare, hats, clap, rim, tom, crash voices. The `Pattern` node takes drum-machine text (`X` accent, `x` hit, `o` ghost, `.` rest). Note Out's `shift` delays hits (swing, flams) and `ratchet` turns a step into a roll; tracks also have a swing control.
- **Rhythm kits** plant a whole groove at once: Two-Step DnB, Amen Break, Jungle Roller (generative), Four on the Floor, Trap Rolls, Polyrhythm Garden. Click replaces the garden (⌘Z undoes), ⇧-click layers it.
- **Harmony** (top bar): the song's chord progression is a function of `bar`, e.g. `pick(bar, 3, 4, 2, 5)` (王道進行 IV–V–iii–vi) or `(3 * bar) % 7` (circle of fifths). Every formula reads the current chord as `h`; `L` is the number of degrees per octave. Note Out's `chord` input stacks that many scale tones every `stack` degrees (2 = thirds, 3 = quartal), with `inversion` and `strum`.
- **Randomizer** (Mutate, or `R` / `⇧R` for the whole garden): rewrites node parameters *and formulas* — numbers move according to their role (scale degree, period, pulse count, probability), related functions swap, rhythm masks rotate or flip bits, experimental mode grafts new terms — then renders ~40 candidates and keeps the most musical (contour, chord-tone fit, density, distance from the original). The 調和 ↔ 実験 dial trades consonance for novelty; lock a node to protect it.
- **∑ Function** (toolbar, or `F`): the whole track — or the whole garden — as one closed-form function. Every node is inlined (a Wave becomes `offset + amp·sine(cycles·x)`, Steps becomes `pick(…)`, Range its clamp formula), shared parts are named in a *where* clause, constants are folded. View it as typeset **Math** (KaTeX, with the clock, harmony and degree→MIDI mapping written out), **SoundFunc** formulas (paste-ready), or standalone **JavaScript** / **Python** that reproduce the engine's numbers exactly (tested bit-for-bit, including the `rand` hash). Copy, or download as `.tex`, `.txt`, `.js`, `.py`.
- **Saving**: the book icon by the project name holds your gardens — Save (⌘S), Save as a copy (⇧⌘S), New garden, and every saved garden to open or delete; a vermilion dot means unsaved changes. **My voices** (Track tab) saves a track's sound — waveform, custom `f(p)`, attack, release — to reuse on any track in any garden. Both libraries live in the browser, separate from the open project.
- **Export**: MIDI (multi-track, tempo + key signature, GM instruments), note data CSV (pitch, MIDI number, frequency, velocity, key, timing), or the project as JSON. Projects also autosave to the browser.

## Structure

```
src/engine/   framework-free core (unit-tested)
  expr.ts       safe expression parser → closures, math/music function library
  graph.ts      node definitions + graph compiler (topological, cycle-safe)
  music.ts      scales (incl. Hirajōshi, In Sen, Iwato, Yo), degree/semitone mapping
  project.ts    tracks, songs, note generation
  audio.ts      Web Audio scheduler + synth voices (bell FM, koto pluck, pad, shakuhachi…)
  midi.ts       Standard MIDI File writer (notes, GM drums, pitch-bend glides) + CSV export
  timbre.ts     formula → one-cycle waveform → Fourier harmonics
  mutate.ts     the randomizer: role-aware parameter & formula mutation + musical fitness
  symbolic.ts   graph → closed-form expression → LaTeX / SoundFunc / JavaScript / Python
  presets.ts    default functions
src/state/    zustand store (persisted, undo/redo)
src/components/ React UI (React Flow node editor, canvas visualizer)
```

Adding a node type is just a new entry in `NODE_DEFS` in `graph.ts`. The UI, palette and evaluator pick it up automatically.
