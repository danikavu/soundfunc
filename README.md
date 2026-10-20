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
- **Visualizer** (top): *Score* (all tracks, drums in their own lanes), *Function* (y = f(x) for the selected track across the whole loop — shorter tracks repeat with their loop count `k`, so evolving tracks show every pass; **drag across it to hear the curve**), *Ripple* (live waveform). **Zoom** with ⌘/Ctrl + scroll or a trackpad pinch (around the pointer), scroll to pan, the − / + / fit buttons, or double-click to see the whole loop again; while playing zoomed in, the view follows the playhead.
- **Top bar — the whole song**: **Tempo**, **Length**, **Key**, **Scale**, **Harmony** and **Space**. **Length** is 4, 8, 16, 32 or 64 beats — *every* track is exactly that long; the step length you pick fits as many steps as it takes (an irrational step is nudged to land on the beat), up to 1024 steps — or **Free**, where each track loops on its own (steps × step length, for polyrhythms) and the song is its longest track. The Score, the Function view and MIDI export use it; the chord progression repeats or carries on inside it. Kits whose tracks share a length plant fixed; polyrhythm kits plant free.
- **Top bar — the selected track**, in its own panel: steps × step length and **Octave**.
- **Voice** and **Step length** are dropdowns. Voices: melodic, drums and your saved voices, each with a one-line description. Step lengths: straight (1/64 … 2 bars), triplets, dotted, quintuplets/septuplets/nonuplets, free (φ⁻¹, π/8, √2/4 beats) — or type any length in beats (`3/20`, `0.3`, `phi/4`).
- **Pitch range** (the *Pitch* pill in the Score/Function views), on by default: every note you hear and export stays within C1–C7 (or a range you choose — presets for piano, bass, voice…). *Wrap* moves a stray note by whole octaves so it keeps its note name — a function that outputs −8373 still plays a real, in-key note; *Clamp* pins it to the edge; *Off* lets it go anywhere MIDI allows. Drums are left alone. The Function view stays scaled to the range and marks its edges.
- **Clear** (sidebar → Tracks) removes every track at once — ⌘Z brings them back.
- **Glide mode** (Track → Play as): instead of notes, one voice slides continuously along the curve — `x`/`t` flow smoothly, `n` still ticks per step. Snap to the scale or play free pitch, with adjustable portamento. Exported to MIDI as pitch bend (±24 st) + CC11 expression.
- **f(p) Custom voice**: write one cycle of the waveform itself (`sin(tau*p + 2*sin(tau*p))`); it is turned into an oscillator via its Fourier series.
- **Drums & rhythm**: kick, snare, hats, clap, rim, tom, crash voices. The `Pattern` node takes drum-machine text (`X` accent, `x` hit, `o` ghost, `.` rest). Note Out's `shift` delays hits (swing, flams) and `ratchet` turns a step into a roll; tracks also have a swing control.
- **Rhythm kits** (sidebar): one picker for Two-Step DnB, Amen Break, Jungle Roller, Four on the Floor, Trap Rolls, Royal Road Ballad and Polyrhythm Garden. Replace the garden with a kit, layer the whole kit, add **percussion only**, or add single tracks (just the Amen snare…) to the garden you're working on — at your tempo, or the kit's if you tick “use kit tempo & key”.
- **Harmony** (top bar): the song's chord progression is a function of `bar`, e.g. `pick(bar, 3, 4, 2, 5)` (王道進行 IV–V–iii–vi) or `(3 * bar) % 7` (circle of fifths). Every formula reads the current chord as `h`; `L` is the number of degrees per octave. Note Out's `chord` input stacks that many scale tones every `stack` degrees (2 = thirds, 3 = quartal), with `inversion` and `strum`.
- **Randomizer** (Mutate, or `R` / `⇧R` for the whole garden): rewrites node parameters *and formulas* — numbers move according to their role (scale degree, period, pulse count, probability), related functions swap, rhythm masks rotate or flip bits, experimental mode grafts new terms — then renders ~40 candidates and keeps the most musical (contour, chord-tone fit, density, distance from the original). The 調和 ↔ 実験 dial trades consonance for novelty; lock a node to protect it.
- **Paste function** (sidebar → Tracks): paste LaTeX (Desmos copies it with ⌘C), `\begin{cases}`, plain math with ⌊ ⌋, mod, frac, ≥ — or several lines with helper definitions (`g(x) = …`) and `IF … AND …:` / `ELSE IF` / `OTHERWISE` blocks, nested as deep as you like. “mod” in a sum reads as `(a + b) mod n` by default (switchable); **x starts at** handles functions that begin at negative x. It shows how it read your function — typeset, plus a plot — before planting it as a track; undefined piecewise regions become silence. It reads LaTeX the way Desmos does: Greek letters and subscripted names (`\sigma`, `p_0`, `t_{max}`) are ordinary names; `p = …`, `t_i = …`, `g(x) = …` name the function; every name other than the time variable becomes a **slider** (a line like `k = 2.5` sets its starting value, `c = 2a` is written in); the time variable is x, else t, else the one name left over — and you can pick another; trailing conditions like `, \sigma > 0` are noted, not played. Names SoundFunc already uses (k, h, t…) are renamed, k → k_. Choose what x means (beats / steps / the loop) and y (octaves / semitones / scale degrees). See `examples/graphed-melodies.md`.
- **Help in the nodes**: hover any port or setting for what it means (n step, t beats, k loop, strum, ratchet, stack…); the **?** on a node opens a short guide to all of it.
- **Formula editing**: formulas show as typeset math until you click them. While typing, autocomplete offers every function and variable with a description (Tab inserts); **Alt+↑/↓** nudges the number under the caret (Shift ×10, Ctrl/⌘ ×0.1) — live while it plays.
- **Explode / Collapse**: the ✂ on a Formula node splits its outermost operation into a node — Math, Function, Wave, Euclid, Sequence, Steps, Chance, **Compare** (`<`, `≤`, `=`, `≠`, `and`, `or`, `!`) and **If / else** (`cond ? a : b`); any other function call has its arguments pulled out into their own formulas (`rand(n + 16k, 3)` → `rand(a, 3)` fed by `n + 16·k`). Repeat to go deeper. Select nodes and **Collapse** to merge them into one Formula (outside wires become `a b c`). Both are tested to leave the sound unchanged.
- **Sections** node: a piecewise function over time — inputs A–D, lengths like `8 8 16` (beats or bars), drawn as a timeline; also outputs which section is playing and how far through it.
- **Listen** (🎧 on any node): hear one node alone — it drives the pitch (rhythm nodes drive velocity), small ranges are stretched over an octave. Esc stops.
- **Blocks**: ready-made groups of wired nodes in Add node (arpeggio, octave-drop bass, pitch hook, Euclid gate, chord on the harmony, ghost notes, humanize, roll, slow wave, A/B sections). Select any nodes → **Save as block** to keep your own (My blocks, in every garden).
- **Sliders**: named constants every formula and the harmony can read, shown in a bar above the nodes. **Alt+S** on a number in a formula turns it into one; rename it and every formula follows; remove it and its value is written back. The Math/JS/Python views declare them.
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
  importMath.ts LaTeX / Desmos / plain math → SoundFunc expression (piecewise → velocity gate)
  graphEdit.ts  explode, collapse, blocks, audition — pure graph transforms
  blocks.ts     built-in blocks
  presets.ts    default functions
src/state/    zustand store (persisted, undo/redo)
src/components/ React UI (React Flow node editor, canvas visualizer)
```

Adding a node type is just a new entry in `NODE_DEFS` in `graph.ts`. The UI, palette and evaluator pick it up automatically.
