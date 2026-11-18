/**
 * The function library: curated pads, arps, call-and-response riffs, wild glide curves, rave
 * riffs and more, made in SoundFunc and saved from My functions (generated from a soundfunc-functions.json export). Each is a whole
 * channel: its nodes, sliders, grid and sound.
 */
import type { Preset } from "./presets";

export const LIBRARY_PRESETS: Preset[] = [
  {
    id: "tanh-wave",
    name: "Tanh Wave",
    group: "curves",
    description:
      "A sine squeezed through tanh: soft at k_ = 0.5, almost square at 2. Drag k_ and hear the wave harden.",
    formula: "y = tanh(k_ * sin(2 * pi * t))",
    track: {
      steps: 32,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [
        {
          name: "k_",
          value: 1.53,
          min: 0,
          max: 2,
        },
      ],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "tanh(k_ * sin(2 * pi * t))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 87,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 120,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "upperz",
    name: "Upperz",
    group: "curves",
    description:
      "Short scoops on every half beat, each starting a little higher than the last: a staircase made of slides.",
    formula:
      "y = fract(2 * t) < 0.28 ? -2 + 0.13 * floor(2 * t) + 0.55 * (floor(2 * t) % 4) + 0.95 * (1 - exp(-16 * fract(2 * t))) : 0",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "fract(2 * t) < 0.28 ? -2 + 0.13 * floor(2 * t) + 0.55 * (floor(2 * t) % 4) + 0.95 * (1 - exp(-16 * fract(2 * t))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 302,
            },
            data: {
              formula:
                "0.8 * (fract(2 * t) < 0.28 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 132,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 165,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "fibonacci-rhythm",
    name: "Fibonacci Rhythm",
    group: "math",
    description:
      "Binet’s formula for the Fibonacci numbers, folded into a few notes: a rhythm that grows like a sunflower.",
    formula:
      "y = 3 + round(1.618^floor(2 * t) / 2.2361 - (-0.618)^floor(2 * t) / 2.2361) % 7 / 12",
    track: {
      steps: 32,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "sine",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: true,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "3 + round(1.618^floor(2 * t) / 2.2361 - (-0.618)^floor(2 * t) / 2.2361) % 7 / 12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 284,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 105,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 138,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "upperdawg",
    name: "UpperDawg",
    group: "curves",
    description:
      "A sawtooth in t² that speeds up as it goes, fading slowly: the slides come faster and closer together.",
    formula: "y = 2.6 * (1 - 2 * (t^2 / 3 % 1)) * exp(-0.08 * abs(t))",
    track: {
      steps: 32,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "2.6 * (1 - 2 * (t^2 / 3 % 1)) * exp(-0.08 * abs(t))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 266,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 96,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 129,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "trippy-stairway",
    name: "Trippy Stairway",
    group: "curves",
    description:
      "Five-step stairs on the sixteenths that climb a little every two beats, with silence between the steps.",
    formula:
      "y = fract(4 * t) < 0.65 ? 0.45 * (floor(4 * t) % 5) + 0.6 * (floor(t / 2) % 4) - 1.6 : -2.4",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "fract(4 * t) < 0.65 ? 0.45 * (floor(4 * t) % 5) + 0.6 * (floor(t / 2) % 4) - 1.6 : -2.4",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 284,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 105,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 138,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "soft-growl",
    name: "Soft Growl",
    group: "melodies",
    description:
      "A triangle-shaped melody growling at 14 wobbles a beat, with a slow sine underneath. Played as notes.",
    formula:
      "y = 1.8 * abs(saw(0.5 * t)) * (1 - 4 * abs(fract(14 * t) - 0.5)) + 0.6 * sin(0.8 * t) - 0.3",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 5,
      pitchMode: "semitone",
      waveform: "sine",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "1.8 * abs(saw(0.5 * t)) * (1 - 4 * abs(fract(14 * t) - 0.5)) + 0.6 * sin(0.8 * t) - 0.3",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 284,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 105,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 138,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "the-jay",
    name: "The Jay",
    group: "melodies",
    description:
      "Mock Kicks as notes, with sliders for every number (A, B, D, F, G, E): bend it into a new riff without touching the formula.",
    formula:
      "y = t % 4 < 2 ? A * sin(F * pi * (t % 2)) * (1 - D * (t % 2)) : B * sin(G * pi * (t % 1)) * exp(-E * (t % 2))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [
        {
          name: "A",
          value: 1.27,
          min: 0,
          max: 2,
        },
        {
          name: "F",
          value: 0.62,
          min: 0,
          max: 2,
        },
        {
          name: "D",
          value: 1.53,
          min: 0,
          max: 2,
        },
        {
          name: "B",
          value: 2,
          min: 0,
          max: 2,
        },
        {
          name: "G",
          value: 0.32,
          min: 0,
          max: 2,
        },
        {
          name: "E",
          value: 0.35,
          min: 0,
          max: 2,
        },
      ],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "t % 4 < 2 ? A * sin(F * pi * (t % 2)) * (1 - D * (t % 2)) : B * sin(G * pi * (t % 1)) * exp(-E * (t % 2))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 302,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 114,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 147,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "alien",
    name: "Alien",
    group: "curves",
    description:
      "A high, fast cosine buzz on a decaying envelope every two beats: a transmission from somewhere else.",
    formula:
      "y = t % 64 < (31.411) ? -2 + 4 * exp(-2 * (t % 2)) + (3) * cos(87.625 * (t % 2)) : (t + 3) % 8 < ((-1211.244)) ? 16 - 5718.347 * exp(-2 * ((t + 2) % 3)) : (t + 48) % 16 < 48 ? -8 + (2) * exp(-2 * ((t - 32) % 24)) : t % 48 < 4 ? -12 - 12 * exp(-64 * (t % 16)) : 16",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 6,
      pitchMode: "semitone",
      waveform: "sine",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "t % 64 < (31.411) ? -2 + 4 * exp(-2 * (t % 2)) + (3) * cos(87.625 * (t % 2)) : (t + 3) % 8 < ((-1211.244)) ? 16 - 5718.347 * exp(-2 * ((t + 2) % 3)) : (t + 48) % 16 < 48 ? -8 + (2) * exp(-2 * ((t - 32) % 24)) : t % 48 < 4 ? -12 - 12 * exp(-64 * (t % 16)) : 16",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula:
                "4 * (t % 48 < (48) ? 16 : (t - 64) % 2 < ((-4.41)) ? (-64) : (t - 24) % 64 < (85.596) ? (-6) : t % 6 < 24 ? (2) : (-12)) * (fract(t / ((-0.713))) < 83.263)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 35,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 531,
              y: -144,
            },
            data: {
              op: "min",
              b: 24,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "arches",
    name: "Arches",
    group: "curves",
    description:
      "Half-circle arches (√(1 − x²)) that rise and fall every three beats, with small hills between.",
    formula:
      "y = 1.25 * sqrt(max(0, 1 - 6.25 * (t % 3 - 0.58)^2)) + 3.85 * sqrt(max(0, 1 - 5.41 * (t % 3 - 1.5)^2)) + 1.25 * sqrt(max(0, 1 - 6.25 * (t % 3 - 2.42)^2)) - 4",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "1.25 * sqrt(max(0, 1 - 6.25 * (t % 3 - 0.58)^2)) + 3.85 * sqrt(max(0, 1 - 5.41 * (t % 3 - 1.5)^2)) + 1.25 * sqrt(max(0, 1 - 6.25 * (t % 3 - 2.42)^2)) - 4",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 338,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 132,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 165,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "upside-down-y",
    name: "Upside Down Y",
    group: "curves",
    description:
      "sin(t/2) / sin(1.2t): the curve flies off to the edges where the bottom sine crosses zero, then comes back.",
    formula: "y = 1.2 * sin(t / 2) / sin(1.2 * t)",
    track: {
      steps: 32,
      stepBeats: 0.25,
      stretch: 0.125,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "1.2 * sin(t / 2) / sin(1.2 * t)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 266,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 96,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 129,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "triplet-drops",
    name: "Triplet Drops",
    group: "curves",
    description:
      "Long exponential falls in a five-in-sixteen pattern: drops that land in threes.",
    formula:
      "y = -2.46 + 1.23 * (2 * floor(5 * (floor(t) + 1) / 16) % 3) + 2.46 * exp(-1.2 * (t - ceil(3.2 * floor(5 * (floor(t) + 1) / 16)) + 1))",
    track: {
      steps: 32,
      stepBeats: 0.25,
      stretch: 0.25,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "-2.46 + 1.23 * (2 * floor(5 * (floor(t) + 1) / 16) % 3) + 2.46 * exp(-1.2 * (t - ceil(3.2 * floor(5 * (floor(t) + 1) / 16)) + 1))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "wipwopwow",
    name: "WipWopWow",
    group: "curves",
    description:
      "A sawtooth bent by a sine: it rises, wobbles and snaps back, never in the same place twice.",
    formula:
      "y = 5.8 * (t / 3 + 0.6 * sin(t) - floor(t / 3 + 0.6 * sin(t) + 0.5))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "5.8 * (t / 3 + 0.6 * sin(t) - floor(t / 3 + 0.6 * sin(t) + 0.5))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 284,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 105,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 138,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "two-saws",
    name: "Two Saws",
    group: "curves",
    description:
      "fract(t/3) − fract(t/7): two ramps at 3 and 7 beats, their difference a pattern that only repeats every 21.",
    formula: "y = fract(t / 3) - fract(t / 7)",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.25,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "fract(t / 3) - fract(t / 7)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 87,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 120,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "strum-step",
    name: "Strum Step",
    group: "melodies",
    description:
      "Smooth noise picks notes on a strummed step pattern: a wandering line that never quite repeats.",
    formula: "y = 0.35 + 0.5 * noise(n * 0.4)",
    track: {
      steps: 32,
      stepBeats: 0.5,
      stretch: 1,
      octave: 4,
      pitchMode: "degree",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.08,
      release: 0.6,
      send: 0.28,
      swing: 0,
      playMode: "notes",
      quantize: true,
      glide: 0.04,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "log",
            type: "series",
            position: {
              x: 271,
              y: 3,
            },
            data: {
              kind: "logistic",
              p: 3.7,
              modulo: 0,
            },
          },
          {
            id: "map",
            type: "map",
            position: {
              x: 560,
              y: 99,
            },
            data: {
              inMin: 0,
              inMax: 1,
              outMin: 0,
              outMax: 10,
              clamp: true,
            },
          },
          {
            id: "vel",
            type: "expr",
            position: {
              x: 0,
              y: 245,
            },
            data: {
              formula: "0.35 + 0.5 * noise(n * 0.4)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 54,
            },
            data: {},
          },
          {
            id: "number_mvjr7ral7kxc",
            type: "number",
            position: {
              x: 108,
              y: 500,
            },
            data: {
              value: 2.36,
              min: -12,
              max: 12,
            },
          },
        ],
        edges: [
          {
            id: "time.n-log.n",
            source: "time",
            sourceHandle: "n",
            target: "log",
            targetHandle: "n",
          },
          {
            id: "log.out-map.v",
            source: "log",
            sourceHandle: "out",
            target: "map",
            targetHandle: "v",
          },
          {
            id: "map.out-out.pitch",
            source: "map",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "vel.out-out.velocity",
            source: "vel",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "number_mvjr7ral7kxc.out-out.chord",
            source: "number_mvjr7ral7kxc",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "number_mvjr7ral7kxc.out-out.strum",
            source: "number_mvjr7ral7kxc",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
        ],
      },
    },
  },
  {
    id: "wahwah-wihwih",
    name: "WahWah WihWih",
    group: "curves",
    description:
      "tanh of a sine, clipped and stepped: a slide up, a hold, a slide back: a talking wah.",
    formula:
      "y = 2.4 * (min(0, tanh(4 * sin(pi * (floor(t / 2) + t % 1 / 2)))) + (1 - 0.75 * (exp(3 - min(3, max(0, floor(t / 4) + 2))) - 1) / 19.0855) * max(0, tanh(4 * sin(pi * (floor(t / 2) + t % 1 / 2)))))",
    track: {
      steps: 48,
      stepBeats: 0.16666666666666666,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 15,
            },
            data: {
              formula:
                "2.4 * (min(0, tanh(4 * sin(pi * (floor(t / 2) + t % 1 / 2)))) + (1 - 0.75 * (exp(3 - min(3, max(0, floor(t / 4) + 2))) - 1) / 19.0855) * max(0, tanh(4 * sin(pi * (floor(t / 2) + t % 1 / 2)))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              formula: "0.8 * (fract(t / 0.16666666666666666) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 0,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 65,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "downer",
    name: "Downer",
    group: "curves",
    description:
      "Falls that get longer and shallower: a curve of 1/(1 + 9x) folded back on itself.",
    formula:
      "y = (1 + 3.89 / (1 + 9 * (x / 5 % 1))) * (10 / (1 + 9 * (x / 5 % 1)) % 1) - 2.5",
    track: {
      steps: 48,
      stepBeats: 0.16666666666666666,
      stretch: 0.25,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "(1 + 3.89 / (1 + 9 * (x / 5 % 1))) * (10 / (1 + 9 * (x / 5 % 1)) % 1) - 2.5",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 284,
            },
            data: {
              formula: "0.8 * (fract(t / 0.16666666666666666) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 82,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 147,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "bell-fall",
    name: "Bell Fall",
    group: "curves",
    description:
      "A bell curve on time that speeds up exponentially: one long glide down.",
    formula:
      "y = -2.4 + 4.8 * exp(-5.75 * ((16 * (exp(1.46 * (x + 8) / 16) - 1) / 3.306 - 8) % 2 - 1)^2)",
    track: {
      steps: 48,
      stepBeats: 0.16666666666666666,
      stretch: 0.125,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula:
                "-2.4 + 4.8 * exp(-5.75 * ((16 * (exp(1.46 * (x + 8) / 16) - 1) / 3.306 - 8) % 2 - 1)^2)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 284,
            },
            data: {
              formula: "0.8 * (fract(t / 0.16666666666666666) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 82,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 147,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "golden-drill",
    name: "Golden Drill",
    group: "math",
    description: "The golden ratio as a phase picks the attacks and the scale degrees; elastic falling arcs and a restrained two-hit chirp.",
    formula: "y = ((floor(4*t)%32==29) ? (-4+21*exp(-8*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -13 : (12*floor((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))/7)+2*((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))%7)-(((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))%7)>=2)-(((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))%7)>=5))-9))+((floor(4*t)%8==0 ? 29*exp(-13*fract(4*t)) : 6*(1-fract(4*t))*(1-fract(4*t))-2*sin(6.283185307179586*fract(4*t)))))",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+3.7*sin(2*tau*p+0.65*sin(5*tau*p)))+0.09*sin(13*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.005,
      release: 0.21,
      send: 0.14,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.032,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%32==29) ? (-4+21*exp(-8*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -13 : (12*floor((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))/7)+2*((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))%7)-(((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))%7)>=2)-(((floor(14*fract((floor(4*t)+3*floor(floor(4*t)/16))*0.41421356237)))%7)>=5))-9))+((floor(4*t)%8==0 ? 29*exp(-13*fract(4*t)) : 6*(1-fract(4*t))*(1-fract(4*t))-2*sin(6.283185307179586*fract(4*t)))))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1,(((floor(4*t)%8==0 || (fract((floor(4*t)+2*floor(floor(4*t)/16))*0.61803398875)<0.24 && floor(4*t)%2==1)) && floor(4*t)%32!=29)*(0.49+0.43*(floor(4*t)%8==0)+0.08*sin(2.4*floor(4*t))*sin(2.4*floor(4*t)))*(fract(4*t)<0.89)+((floor(4*t)%32==29)*(.68)*(fract(2*fract(4*t))<0.72))))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "0.65+0.95*(floor(4*t)%8==0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 430,
              y: 180,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "euclid-orrery",
    name: "Euclid Orrery",
    group: "math",
    description: "Five-in-sixteen pulses rotate three steps each bar over a fixed heavy downbeat, through a sixteen-bar cycle.",
    formula: "y = (((floor(4*t)%16==0)||(((floor(5*(((floor(4*t)+(3*floor(t/4)))%16)+1)/16)>floor(5*((floor(4*t)+(3*floor(t/4)))%16)/16)))&&(floor(4*t)%16!=0))) ? ((floor(4*t)%16==0) ? -19+33*exp(-10*fract(4*t)) : -7+12*exp(-7*fract(4*t))+5*sin(tau*fract(4*t))) : 0)",
    track: {
      steps: 192,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+4.1*sin(2*tau*p+1.4*sin(5*tau*p)))+0.16*sin(9*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.004,
      release: 0.17,
      send: 0.12,
      swing: 0.04,
      playMode: "glide",
      quantize: false,
      glide: 0.009,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(((floor(4*t)%16==0)||(((floor(5*(((floor(4*t)+(3*floor(t/4)))%16)+1)/16)>floor(5*((floor(4*t)+(3*floor(t/4)))%16)/16)))&&(floor(4*t)%16!=0))) ? ((floor(4*t)%16==0) ? -19+33*exp(-10*fract(4*t)) : -7+12*exp(-7*fract(4*t))+5*sin(tau*fract(4*t))) : 0)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "(((floor(4*t)%16==0)||(((floor(5*(((floor(4*t)+(3*floor(t/4)))%16)+1)/16)>floor(5*((floor(4*t)+(3*floor(t/4)))%16)/16)))&&(floor(4*t)%16!=0))) ? ((floor(4*t)%16==0) ? .96*(fract(4*t)<.92) : (.48+.18*(floor(4*t)%4==0))*(fract(4*t)<.72)) : 0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 340,
              y: 100,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "cantor-cannon",
    name: "Cantor Cannon",
    group: "math",
    description: "A Cantor-set gate removes the middle third at three scales: a self-similar sparse ratchet with deep strikes.",
    formula: "y = (((floor(4*t)%16==0)||((floor(4*t)%3!=1)&&(floor(floor(4*t)/3)%3!=1)&&(floor(floor(4*t)/9)%3!=1)&&(floor(4*t)%16!=0))) ? ((floor(4*t)%16==0)? -21+36*exp(-10*fract(4*t)):(floor(4*t)%3==0 ? -8+16*exp(-8*fract(4*t)) : 3+10*exp(-5*fract(4*t)))) : 0)",
    track: {
      steps: 216,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+3.2*sin(tau*p+2.0*sin(4*tau*p)))+0.11*sin(13*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.004,
      release: 0.2,
      send: 0.12,
      swing: 0.02,
      playMode: "glide",
      quantize: false,
      glide: 0.009,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(((floor(4*t)%16==0)||((floor(4*t)%3!=1)&&(floor(floor(4*t)/3)%3!=1)&&(floor(floor(4*t)/9)%3!=1)&&(floor(4*t)%16!=0))) ? ((floor(4*t)%16==0)? -21+36*exp(-10*fract(4*t)):(floor(4*t)%3==0 ? -8+16*exp(-8*fract(4*t)) : 3+10*exp(-5*fract(4*t)))) : 0)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "(((floor(4*t)%16==0)||((floor(4*t)%3!=1)&&(floor(floor(4*t)/3)%3!=1)&&(floor(floor(4*t)/9)%3!=1)&&(floor(4*t)%16!=0))) ? ((floor(4*t)%16==0)? .96*(fract(4*t)<.96):(floor(4*t)%3==0 ? .58*(fract(4*t)<.67) : .38*(fract(4*t)<.48))) : 0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 340,
              y: 100,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "thue-morse-mirror",
    name: "Thue-Morse Mirror",
    group: "math",
    description: "A folded triangular melody in Dorian; the parity of binary digits decides the eighth-note answers.",
    formula: "y = (12*floor(((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))/7)+2*(((((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))%7)+7)%7)-(((((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))%7)+7)%7>=2)-(((((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))%7)+7)%7>=6))-7",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.88*sin(tau*p)+0.18*sin(2*tau*p)+0.07*sin(3*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.009,
      release: 0.39,
      send: 0.27,
      swing: 0.09,
      playMode: "notes",
      quantize: false,
      glide: 0,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(12*floor(((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))/7)+2*(((((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))%7)+7)%7)-(((((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))%7)+7)%7>=2)-(((((7-abs(((floor(4*t)+2*floor(floor(4*t)/16))%14)-7)+floor(floor(floor(4*t)/16)/2)%7))%7)+7)%7>=6))-7",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "((floor(4*t)%4==0||(floor(4*t)%4==2&&((floor(floor(4*t)/2)%2+floor(floor(4*t)/4)%2+floor(floor(4*t)/8)%2+floor(floor(4*t)/16)%2)%2)==0)))*(0.56+0.22*(floor(4*t)%4==0)+0.1*((floor(floor(4*t)/2)%2+floor(floor(4*t)/4)%2+floor(floor(4*t)/8)%2+floor(floor(4*t)/16)%2)%2))*(fract(4*t)<0.92)",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 460,
            },
            data: {
              formula: "1.0+0.95*(floor(4*t)%4==0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 420,
              y: 170,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "pythagoras-engine",
    name: "Pythagoras Engine",
    group: "math",
    description: "Circle-of-fifths gravity under a five-over-four upper line, with an exponential scoop into each note.",
    formula: "y = ((floor(4*t)%16==0)?(((0)*(floor(t/4)%8==0)+(7)*(floor(t/4)%8==1)+(2)*(floor(t/4)%8==2)+(9)*(floor(t/4)%8==3)+(4)*(floor(t/4)%8==4)+(11)*(floor(t/4)%8==5)+(6)*(floor(t/4)%8==6)+(1)*(floor(t/4)%8==7))-19):(((0)*(floor(t/4)%8==0)+(7)*(floor(t/4)%8==1)+(2)*(floor(t/4)%8==2)+(9)*(floor(t/4)%8==3)+(4)*(floor(t/4)%8==4)+(11)*(floor(t/4)%8==5)+(6)*(floor(t/4)%8==6)+(1)*(floor(t/4)%8==7))+(floor(12*((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))%7)/7)+((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))%7==1)+((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))%7==4)+12*floor((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))/7))+(12*(floor(4*t)%16%5==3))+(0)+((-1.9*exp(-16*fract(4*t))+0.28*sin(6.2831853*fract(4*t))))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.82*sin(tau*p)+0.19*sin(2*tau*p)+0.13*sin(3*tau*p)+0.1*sin(5*tau*p)",
      sliders: [],
      volume: 0.73,
      pan: 0,
      attack: 0.004,
      release: 0.12,
      send: 0.2,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.008,
      graph: {
        nodes: [
          {
            id: "y",
            type: "expr",
            position: {
              x: 0,
              y: 10,
            },
            data: {
              formula: "((floor(4*t)%16==0)?(((0)*(floor(t/4)%8==0)+(7)*(floor(t/4)%8==1)+(2)*(floor(t/4)%8==2)+(9)*(floor(t/4)%8==3)+(4)*(floor(t/4)%8==4)+(11)*(floor(t/4)%8==5)+(6)*(floor(t/4)%8==6)+(1)*(floor(t/4)%8==7))-19):(((0)*(floor(t/4)%8==0)+(7)*(floor(t/4)%8==1)+(2)*(floor(t/4)%8==2)+(9)*(floor(t/4)%8==3)+(4)*(floor(t/4)%8==4)+(11)*(floor(t/4)%8==5)+(6)*(floor(t/4)%8==6)+(1)*(floor(t/4)%8==7))+(floor(12*((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))%7)/7)+((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))%7==1)+((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))%7==4)+12*floor((((5*floor(4*t)+floor(floor(t/4)%8/2))%7))/7))+(12*(floor(4*t)%16%5==3))+(0)+((-1.9*exp(-16*fract(4*t))+0.28*sin(6.2831853*fract(4*t))))))/12",
            },
          },
          {
            id: "gate",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(.78)*((floor(4*t)%16==0||floor(4*t)%16%5==1||floor(4*t)%16%5==3))*(fract(4*t)<0.79)*(1)",
            },
          },
          {
            id: "semitones",
            type: "math",
            position: {
              x: 320,
              y: 15,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "y.out-semitones.a",
            source: "y",
            sourceHandle: "out",
            target: "semitones",
            targetHandle: "a",
          },
          {
            id: "semitones.out-out.pitch",
            source: "semitones",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "gate.out-out.velocity",
            source: "gate",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "unheard-choir",
    name: "Unheard Choir",
    group: "arps",
    description: "Sacred dark fantasy: long arching swells down the chord. The arpeggio’s clock is bent by a slow sine, so it rushes and drags.",
    formula: "y = h + pick((floor(n/2 + 0.9*sin(6.28318530718*n/64)) + 2*floor(n/32))%5,0,3,7,10,14) - 12*(floor(n/64)%2)",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.75*sin(tau*p)+0.27*sin(2*tau*p)+0.14*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.012,
      release: 0.46,
      send: 0.28,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.045,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: -140,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "h + pick((floor(n/2 + 0.9*sin(6.28318530718*n/64)) + 2*floor(n/32))%5,0,3,7,10,14) - 12*(floor(n/64)%2)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "(n%2==0)*(n%32!=22)*(0.41+0.23*(n%16==0)+0.10*(sin(6.28318530718*n/72)>0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 350,
            },
            data: {
              formula: "1.7+1.6*(n%32==0)+0.6*(sin(6.28318530718*n/64)>0)",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 285,
              y: -105,
            },
            data: {
              points: "0:0.50:0 0.18:0.54:0 0.52:0.53:0.4 0.78:0.46:0.6 1:0.50:0",
              repeats: 1,
              lo: -8,
              hi: 8,
            },
          },
          {
            id: "bendGate",
            type: "expr",
            position: {
              x: 285,
              y: 390,
            },
            data: {
              formula: "(n%16==0 || n%32==28)",
            },
          },
          {
            id: "bendMix",
            type: "math",
            position: {
              x: 570,
              y: 25,
            },
            data: {
              op: "mul",
              b: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 855,
              y: 130,
            },
            data: {},
          },
          {
            id: "elastic",
            type: "expr",
            position: {
              x: 280,
              y: 460,
            },
            data: {
              formula: "0.30*sin(6.28318530718*(t+0.60*sin(6.28318530718*t/9))/2.6)",
            },
          },
          {
            id: "bendSum",
            type: "math",
            position: {
              x: 560,
              y: 375,
            },
            data: {
              op: "add",
              b: 0,
            },
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
          {
            id: "bendGate.out-bendMix.b",
            source: "bendGate",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "b",
          },
          {
            id: "bendMix.out-out.bend",
            source: "bendMix",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "bend.out-bendSum.a",
            source: "bend",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "a",
          },
          {
            id: "elastic.out-bendSum.b",
            source: "elastic",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "b",
          },
          {
            id: "bendSum.out-bendMix.a",
            source: "bendSum",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "a",
          },
        ],
      },
    },
  },
  {
    id: "saturn-drift",
    name: "Saturn Drift",
    group: "arps",
    description: "Deep ambient: ornaments drift over the chord in threes, their clock bent by a slow sine.",
    formula: "y = h + pick((floor(n/3+1.1*sin(6.28318530718*n/73)) + floor(n/24))%6,0,4,7,9,12,14) - 5*(floor(n/72)%2)",
    track: {
      steps: 192,
      stepBeats: 0.5,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.86*sin(tau*p)+0.13*sin(2*tau*p)+0.035*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.07,
      release: 1.1,
      send: 0.55,
      swing: 0.01,
      playMode: "notes",
      quantize: false,
      glide: 0.11,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: -140,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "h + pick((floor(n/3+1.1*sin(6.28318530718*n/73)) + floor(n/24))%6,0,4,7,9,12,14) - 5*(floor(n/72)%2)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "(n%3==0)*(n%24!=18)*(0.35+0.16*(n%12==0)+0.10*(sin(6.28318530718*n/61)>0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 350,
            },
            data: {
              formula: "2.4+1.8*(n%24==0)+0.5*(sin(6.28318530718*n/67)>0)",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 285,
              y: -105,
            },
            data: {
              points: "0:0.38:0 0.24:0.47:0.6 0.46:0.50:0 0.85:0.50:0 1:0.50:0",
              repeats: 1,
              lo: -5,
              hi: 5,
            },
          },
          {
            id: "bendGate",
            type: "expr",
            position: {
              x: 285,
              y: 390,
            },
            data: {
              formula: "(n%12==0)",
            },
          },
          {
            id: "bendMix",
            type: "math",
            position: {
              x: 570,
              y: 25,
            },
            data: {
              op: "mul",
              b: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 855,
              y: 130,
            },
            data: {},
          },
          {
            id: "elastic",
            type: "expr",
            position: {
              x: 280,
              y: 460,
            },
            data: {
              formula: "0.18*sin(6.28318530718*(t+0.8*sin(6.28318530718*t/11))/4)",
            },
          },
          {
            id: "bendSum",
            type: "math",
            position: {
              x: 560,
              y: 375,
            },
            data: {
              op: "add",
              b: 0,
            },
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
          {
            id: "bendGate.out-bendMix.b",
            source: "bendGate",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "b",
          },
          {
            id: "bendMix.out-out.bend",
            source: "bendMix",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "bend.out-bendSum.a",
            source: "bend",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "a",
          },
          {
            id: "elastic.out-bendSum.b",
            source: "elastic",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "b",
          },
          {
            id: "bendSum.out-bendMix.a",
            source: "bendSum",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "a",
          },
        ],
      },
    },
  },
  {
    id: "crystal-siege",
    name: "Crystal Siege",
    group: "arps",
    description: "Epic fantasy: a seven-note minor arpeggio that speeds up and slows down against the beat.",
    formula: "y = h + pick((floor(n/2 + 1.4*sin(6.28318530718*n/48)) + floor(n/32))%7,0,3,7,10,12,15,19) + 2*(floor(n/64)%2)",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.54*sin(tau*p+0.55*sin(2*tau*p))+0.25*sin(3*tau*p)+0.08*sin(6*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.012,
      release: 0.46,
      send: 0.28,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.045,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: -140,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "h + pick((floor(n/2 + 1.4*sin(6.28318530718*n/48)) + floor(n/32))%7,0,3,7,10,12,15,19) + 2*(floor(n/64)%2)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "(n%2==0)*(0.51+0.22*(n%8==0)+0.09*(sin(6.28318530718*n/57)>0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 350,
            },
            data: {
              formula: "1.15+0.95*(n%16==0)+0.4*(sin(6.28318530718*n/48)>0)",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 285,
              y: -105,
            },
            data: {
              points: "0:0.28:0 0.06:0.51:0 0.18:0.60:0.3 0.33:0.50:0 1:0.50:0",
              repeats: 1,
              lo: -5,
              hi: 5,
            },
          },
          {
            id: "bendGate",
            type: "expr",
            position: {
              x: 285,
              y: 390,
            },
            data: {
              formula: "(n%8==0 || n%16==14)",
            },
          },
          {
            id: "bendMix",
            type: "math",
            position: {
              x: 570,
              y: 25,
            },
            data: {
              op: "mul",
              b: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 855,
              y: 130,
            },
            data: {},
          },
          {
            id: "elastic",
            type: "expr",
            position: {
              x: 280,
              y: 460,
            },
            data: {
              formula: "0.34*sin(6.28318530718*(t+0.48*sin(6.28318530718*t/5))/1.1)",
            },
          },
          {
            id: "bendSum",
            type: "math",
            position: {
              x: 560,
              y: 375,
            },
            data: {
              op: "add",
              b: 0,
            },
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
          {
            id: "bendGate.out-bendMix.b",
            source: "bendGate",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "b",
          },
          {
            id: "bendMix.out-out.bend",
            source: "bendMix",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "bend.out-bendSum.a",
            source: "bend",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "a",
          },
          {
            id: "elastic.out-bendSum.b",
            source: "elastic",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "b",
          },
          {
            id: "bendSum.out-bendMix.a",
            source: "bendSum",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "a",
          },
        ],
      },
    },
  },
  {
    id: "telescope-snow",
    name: "Telescope Snow",
    group: "arps",
    description: "Dream ambient: a seven-against-five arpeggio that phases slowly over the chord.",
    formula: "y = h + pick((floor(n/3+1.1*sin(6.28318530718*n/51)) + floor(n/36))%7,0,2,5,7,9,12,14) + 7*(floor(n/84)%2)",
    track: {
      steps: 224,
      stepBeats: 0.5,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.84*sin(tau*p)+0.12*sin(2*tau*p)+0.06*sin(4*tau*p)+0.035*sin(9*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.07,
      release: 1.1,
      send: 0.55,
      swing: 0.02,
      playMode: "notes",
      quantize: false,
      glide: 0.11,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: -140,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "h + pick((floor(n/3+1.1*sin(6.28318530718*n/51)) + floor(n/36))%7,0,2,5,7,9,12,14) + 7*(floor(n/84)%2)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "(n%3==0)*(n%21!=15)*(0.38+0.18*(n%21==0)+0.09*(sin(6.28318530718*n/83)>0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 350,
            },
            data: {
              formula: "2.1+1.4*(n%21==0)+0.6*(sin(6.28318530718*n/77)>0)",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 285,
              y: -105,
            },
            data: {
              points: "0:0.50:0 0.19:0.55:0.5 0.42:0.48:0.4 0.76:0.50:0 1:0.50:0",
              repeats: 1,
              lo: -5,
              hi: 5,
            },
          },
          {
            id: "bendGate",
            type: "expr",
            position: {
              x: 285,
              y: 390,
            },
            data: {
              formula: "(n%21==0)",
            },
          },
          {
            id: "bendMix",
            type: "math",
            position: {
              x: 570,
              y: 25,
            },
            data: {
              op: "mul",
              b: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 855,
              y: 130,
            },
            data: {},
          },
          {
            id: "elastic",
            type: "expr",
            position: {
              x: 280,
              y: 460,
            },
            data: {
              formula: "0.16*sin(6.28318530718*(t+0.75*sin(6.28318530718*t/13))/3.5)",
            },
          },
          {
            id: "bendSum",
            type: "math",
            position: {
              x: 560,
              y: 375,
            },
            data: {
              op: "add",
              b: 0,
            },
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
          {
            id: "bendGate.out-bendMix.b",
            source: "bendGate",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "b",
          },
          {
            id: "bendMix.out-out.bend",
            source: "bendMix",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "bend.out-bendSum.a",
            source: "bend",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "a",
          },
          {
            id: "elastic.out-bendSum.b",
            source: "elastic",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "b",
          },
          {
            id: "bendSum.out-bendMix.a",
            source: "bendSum",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "a",
          },
        ],
      },
    },
  },
  {
    id: "broken-sundial",
    name: "Broken Sundial",
    group: "arps",
    description: "A twisted fairy tale: springy three-step arcs over the chord, an octave up every other pass.",
    formula: "y = h + pick((floor(n/3+1.1*sin(6.28318530718*n/39)) + floor(n/24))%6,0,3,5,7,10,12) + 12*(floor(n/72)%2)",
    track: {
      steps: 192,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.68*sin(tau*p)+0.22*sin(2*tau*p)+0.13*sin(5*tau*p)+0.04*sin(9*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.012,
      release: 0.46,
      send: 0.28,
      swing: 0.015,
      playMode: "notes",
      quantize: false,
      glide: 0.045,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: -140,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "h + pick((floor(n/3+1.1*sin(6.28318530718*n/39)) + floor(n/24))%6,0,3,5,7,10,12) + 12*(floor(n/72)%2)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "(n%3==0 || n%24==22)*(0.45+0.17*(n%12==0)+0.08*(sin(6.28318530718*n/43)>0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 350,
            },
            data: {
              formula: "1.9+1.0*(n%24==0)+0.5*(sin(6.28318530718*n/53)>0)",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 285,
              y: -105,
            },
            data: {
              points: "0:0.29:0 0.14:0.55:0.3 0.37:0.50:0 0.74:0.58:0.4 1:0.50:0",
              repeats: 1,
              lo: -5,
              hi: 5,
            },
          },
          {
            id: "bendGate",
            type: "expr",
            position: {
              x: 285,
              y: 390,
            },
            data: {
              formula: "(n%12==0 || n%24==22)",
            },
          },
          {
            id: "bendMix",
            type: "math",
            position: {
              x: 570,
              y: 25,
            },
            data: {
              op: "mul",
              b: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 855,
              y: 130,
            },
            data: {},
          },
          {
            id: "elastic",
            type: "expr",
            position: {
              x: 280,
              y: 460,
            },
            data: {
              formula: "0.28*sin(6.28318530718*(t+0.40*sin(6.28318530718*t/5))/2)",
            },
          },
          {
            id: "bendSum",
            type: "math",
            position: {
              x: 560,
              y: 375,
            },
            data: {
              op: "add",
              b: 0,
            },
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
          {
            id: "bendGate.out-bendMix.b",
            source: "bendGate",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "b",
          },
          {
            id: "bendMix.out-out.bend",
            source: "bendMix",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "bend.out-bendSum.a",
            source: "bend",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "a",
          },
          {
            id: "elastic.out-bendSum.b",
            source: "elastic",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "b",
          },
          {
            id: "bendSum.out-bendMix.a",
            source: "bendSum",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "a",
          },
        ],
      },
    },
  },
  {
    id: "empty-seconds",
    name: "Empty Seconds",
    group: "arps",
    description: "A dark cinematic climax: the arpeggio thickens and thins as its clock bends.",
    formula: "y = h + pick((floor(n/2 + 1.4*sin(6.28318530718*n/64)) + floor(n/32))%7,0,3,7,10,12,15,19) - 5*(floor(n/128)%2)",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.56*sin(tau*p+1.1*sin(2*tau*p))+0.18*sin(3*tau*p)+0.11*sin(7*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.012,
      release: 0.46,
      send: 0.28,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.045,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: -140,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "h + pick((floor(n/2 + 1.4*sin(6.28318530718*n/64)) + floor(n/32))%7,0,3,7,10,12,15,19) - 5*(floor(n/128)%2)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "(n%2==0 || ((floor(n/64)%2)==1 && n%4==1))*(n%32!=30)*(0.46+0.18*(n%8==0)+0.10*(sin(6.28318530718*n/67)>0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 350,
            },
            data: {
              formula: "1.2+1.5*(n%32==0)+0.5*(sin(6.28318530718*n/71)>0)",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 285,
              y: -105,
            },
            data: {
              points: "0:0.34:0 0.06:0.50:0 0.23:0.64:0.2 0.41:0.50:0 0.71:0.45:0.2 1:0.50:0",
              repeats: 1,
              lo: -7,
              hi: 7,
            },
          },
          {
            id: "bendGate",
            type: "expr",
            position: {
              x: 285,
              y: 390,
            },
            data: {
              formula: "(n%8==0 || n%32==28)",
            },
          },
          {
            id: "bendMix",
            type: "math",
            position: {
              x: 570,
              y: 25,
            },
            data: {
              op: "mul",
              b: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 855,
              y: 130,
            },
            data: {},
          },
          {
            id: "elastic",
            type: "expr",
            position: {
              x: 280,
              y: 460,
            },
            data: {
              formula: "0.32*sin(6.28318530718*(t+0.58*sin(6.28318530718*t/9))/1.35)",
            },
          },
          {
            id: "bendSum",
            type: "math",
            position: {
              x: 560,
              y: 375,
            },
            data: {
              op: "add",
              b: 0,
            },
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
          {
            id: "bendGate.out-bendMix.b",
            source: "bendGate",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "b",
          },
          {
            id: "bendMix.out-out.bend",
            source: "bendMix",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "bend.out-bendSum.a",
            source: "bend",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "a",
          },
          {
            id: "elastic.out-bendSum.b",
            source: "elastic",
            sourceHandle: "out",
            target: "bendSum",
            targetHandle: "b",
          },
          {
            id: "bendSum.out-bendMix.a",
            source: "bendSum",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "a",
          },
        ],
      },
    },
  },
  {
    id: "dead-kingdom",
    name: "Dead Kingdom",
    group: "arps",
    description: "An epic fantasy ostinato: five-note sweeps that turn up, then down, travelling the harmony every two bars.",
    formula: "y = h + pick((floor(n/2)+floor(n/16)%2*(4-2*(floor(n/2)%5)))%5,0,4,7,9,12) + pick(floor(n/32)%4,0,-2,-5,-3)",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.62*sin(tau*p)+0.27*sin(2*tau*p)+0.17*sin(3*tau*p)+0.11*sin(4*tau*p)+0.08*sin(6*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.013,
      release: 0.3,
      send: 0.33,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.045,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: -140,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "h + pick((floor(n/2)+floor(n/16)%2*(4-2*(floor(n/2)%5)))%5,0,4,7,9,12) + pick(floor(n/32)%4,0,-2,-5,-3)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "(n%2==0)*(0.58+0.21*(n%8==0)+0.07*(n%16==14))*(n%32!=30)",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 350,
            },
            data: {
              formula: "1.8 + 0.35*(n%16==0)",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 285,
              y: -105,
            },
            data: {
              points: "0:0.24:0 0.14:0.57:0 0.32:0.50:0 1:0.50:0",
              repeats: 1,
              lo: -5,
              hi: 5,
            },
          },
          {
            id: "bendGate",
            type: "expr",
            position: {
              x: 285,
              y: 390,
            },
            data: {
              formula: "(n%16==0 || n%16==14)",
            },
          },
          {
            id: "bendMix",
            type: "math",
            position: {
              x: 570,
              y: 25,
            },
            data: {
              op: "mul",
              b: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 855,
              y: 130,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
          {
            id: "bend.out-bendMix.a",
            source: "bend",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "a",
          },
          {
            id: "bendGate.out-bendMix.b",
            source: "bendGate",
            sourceHandle: "out",
            target: "bendMix",
            targetHandle: "b",
          },
          {
            id: "bendMix.out-out.bend",
            source: "bendMix",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
        ],
      },
    },
  },
  {
    id: "headlight-run",
    name: "Headlight Run",
    group: "arps",
    description: "An urgent sixteenth arpeggio racing against a bass centre that turns slowly. Written for E minor.",
    formula: "y = pick((3*n+floor(n/16))%5,0,7,12,15,19) + pick(floor(n/32)%4,0,-5,-2,-7) - 7",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.64*sin(tau*p)+0.26*sin(2*tau*p)+0.19*sin(3*tau*p)+0.08*sin(4*tau*p)+0.04*sin(8*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.003,
      release: 0.11,
      send: 0.23,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick((3*n+floor(n/16))%5,0,7,12,15,19) + pick(floor(n/32)%4,0,-5,-2,-7) - 7",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "(0.49+0.15*(n%4==0)+0.11*(n%16==0))*(1-0.22*(n%32>=28))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 300,
            },
            data: {
              formula: "0.82+0.22*(n%4==0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 120,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "witching-hour",
    name: "Witching Hour",
    group: "arps",
    description: "A harmonic-minor arpeggio with an unsettling major-seventh leading tone. Written for D harmonic minor.",
    formula: "y = pick((floor(n/2)+2*floor(n/16))%5,0,3,7,11,15) + pick(floor(n/32)%4,0,-5,-7,-2)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p)+0.21*sin(2*tau*p)+0.18*sin(3*tau*p)+0.06*sin(6*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.014,
      release: 0.34,
      send: 0.48,
      swing: 0.01,
      playMode: "notes",
      quantize: false,
      glide: 0.018,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick((floor(n/2)+2*floor(n/16))%5,0,3,7,11,15) + pick(floor(n/32)%4,0,-5,-7,-2)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "(n%2==0)*(0.53+0.18*(n%8==0))*(1-0.28*(n%32>=24))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 300,
            },
            data: {
              formula: "1.72+0.30*(n%16==0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 120,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "ocean-ceiling-pad",
    name: "Ocean Ceiling Pad",
    group: "cinematic",
    description: "Abyssal ambient. A wide 4-voice pad on its own 8-bar minor progression; plant Ocean Ceiling Sub with it for the low end.",
    formula: "y = (pick(floor(n/16)%8,0,-2,-4,-1,0,-3,-1,-2))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.66*sin(tau*p)+0.26*sin(2*tau*p)+0.14*sin(3*tau*p)+0.07*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 1.15,
      release: 3.5,
      send: 0.72,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,-2,-4,-1,0,-3,-1,-2))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "floor(n/32)%2",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.08,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1.1,
              hi: 1.1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "ocean-ceiling-sub",
    name: "Ocean Ceiling Sub",
    group: "cinematic",
    description: "The low end of Ocean Ceiling Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/16)%8,0,-2,-4,-1,0,-3,-1,-2)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.92*sin(tau*p)+0.15*sin(2*tau*p)+0.06*sin(3*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,-2,-4,-1,0,-3,-1,-2)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.5",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "black-milk-pad",
    name: "Black Milk Pad",
    group: "cinematic",
    description: "A dark cosmic drone. A wide 5-voice pad on its own 8-bar minor progression; plant Black Milk Sub with it for the low end.",
    formula: "y = (pick(floor(n/16)%8,0,1,3,-2,0,2,-1,-3))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.58*sin(tau*p)+0.23*sin(2*tau*p)+0.13*sin(4*tau*p)+0.08*sin(7*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.9,
      release: 3,
      send: 0.76,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,1,3,-2,0,2,-1,-3))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 5,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "floor(n/16)%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.04,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1.3,
              hi: 1.3,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "black-milk-sub",
    name: "Black Milk Sub",
    group: "cinematic",
    description: "The low end of Black Milk Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/16)%8,0,1,3,-2,0,2,-1,-3)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.83*sin(tau*p+0.16*sin(2*tau*p))+0.17*sin(2*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,1,3,-2,0,2,-1,-3)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.2",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "sleeping-giants-pad",
    name: "Sleeping Giants Pad",
    group: "cinematic",
    description: "Epic fantasy, low and heavy. A wide 4-voice pad on its own 8-bar minor progression; plant Sleeping Giants Sub with it for the low end.",
    formula: "y = (pick(floor(n/16)%8,0,3,4,2,0,-2,3,4))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.51*sin(tau*p)+0.31*sin(2*tau*p)+0.18*sin(3*tau*p)+0.11*sin(4*tau*p)+0.07*sin(6*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.7,
      release: 2.7,
      send: 0.62,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,3,4,2,0,-2,3,4))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "(floor(n/16)+floor(n/64))%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.04,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1.5,
              hi: 1.5,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "sleeping-giants-sub",
    name: "Sleeping Giants Sub",
    group: "cinematic",
    description: "The low end of Sleeping Giants Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/16)%8,0,3,4,2,0,-2,3,4)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.78*sin(tau*p)+0.25*sin(2*tau*p)+0.13*sin(3*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,3,4,2,0,-2,3,4)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.7",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "spaceship-moss-pad",
    name: "Spaceship Moss Pad",
    group: "cinematic",
    description: "Warm, organic sci-fi. A wide 4-voice pad on its own 8-bar minor progression; plant Spaceship Moss Sub with it for the low end.",
    formula: "y = (pick(floor(n/32)%8,0,4,2,3,0,1,4,2))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.77*sin(tau*p)+0.19*sin(2*tau*p)+0.06*sin(3*tau*p)+0.045*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 1.5,
      release: 3.9,
      send: 0.8,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/32)%8,0,4,2,3,0,1,4,2))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,32))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "31.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "floor(n/64)%2",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.08,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "spaceship-moss-sub",
    name: "Spaceship Moss Sub",
    group: "cinematic",
    description: "The low end of Spaceship Moss Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/32)%8,0,4,2,3,0,1,4,2)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.96*sin(tau*p)+0.085*sin(2*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/32)%8,0,4,2,3,0,1,4,2)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,32))*(0.72+0.08*(n%64==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.4",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "velvet-pad",
    name: "Velvet Pad",
    group: "cinematic",
    description: "Sub-heavy neo-soul ambient. A wide 5-voice pad on its own 8-bar minor progression; plant Velvet Sub with it for the low end.",
    formula: "y = (pick(floor(n/16)%8,0,-3,2,4,-1,-2,3,0))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.64*sin(tau*p)+0.27*sin(2*tau*p)+0.13*sin(3*tau*p)+0.07*sin(6*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.38,
      release: 2.6,
      send: 0.56,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,-3,2,4,-1,-2,3,0))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 5,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "(floor(n/16)+floor(n/32))%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.04,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "velvet-sub",
    name: "Velvet Sub",
    group: "cinematic",
    description: "The low end of Velvet Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/16)%8,0,-3,2,4,-1,-2,3,0)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.89*sin(tau*p)+0.17*sin(2*tau*p)+0.045*sin(4*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.014,
      release: 0.25,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,-3,2,4,-1,-2,3,0)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,8))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "7.4",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "moon-engine-pad",
    name: "Moon Engine Pad",
    group: "cinematic",
    description: "Pulsing, industrial and cinematic. A wide 3-voice pad on its own 8-bar minor progression; plant Moon Engine Sub with it for the low end.",
    formula: "y = (pick(floor(n/8)%8,0,0,-2,3,0,-1,-4,2))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.46*sin(tau*p+0.6*sin(2*tau*p))+0.28*sin(2*tau*p)+0.13*sin(3*tau*p)+0.08*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.12,
      release: 1.2,
      send: 0.4,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/8)%8,0,0,-2,3,0,-1,-4,2))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,8))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "7.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 3,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "floor(n/32)%2",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.04,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -2,
              hi: 2,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "moon-engine-sub",
    name: "Moon Engine Sub",
    group: "cinematic",
    description: "The low end of Moon Engine Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/8)%8,0,0,-2,3,0,-1,-4,2)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.68*sin(tau*p+0.48*sin(2*tau*p))+0.3*sin(tau*p)+0.16*sin(3*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.014,
      release: 0.25,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/8)%8,0,0,-2,3,0,-1,-4,2)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,8))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "7.8",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "static-orchid-pad",
    name: "Static Orchid Pad",
    group: "cinematic",
    description: "A celestial glass pad. A wide 4-voice pad on its own 8-bar minor progression; plant Static Orchid Sub with it for the low end.",
    formula: "y = (pick(floor(n/16)%8,0,2,4,1,3,-2,1,0))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.84*sin(tau*p)+0.14*sin(2*tau*p)+0.085*sin(5*tau*p)+0.04*sin(9*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.95,
      release: 4.4,
      send: 0.88,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,2,4,1,3,-2,1,0))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "floor(n/16)%2",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.04,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1.6,
              hi: 1.6,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "static-orchid-sub",
    name: "Static Orchid Sub",
    group: "cinematic",
    description: "The low end of Static Orchid Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/16)%8,0,2,4,1,3,-2,1,0)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.97*sin(tau*p)+0.07*sin(3*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,2,4,1,3,-2,1,0)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.4",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "buried-sun-pad",
    name: "Buried Sun Pad",
    group: "cinematic",
    description: "Ritual horror. A wide 4-voice pad on its own 8-bar minor progression; plant Buried Sun Sub with it for the low end.",
    formula: "y = (pick(floor(n/32)%8,0,-1,-4,-2,0,1,-3,-1))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.54*sin(tau*p)+0.23*sin(2*tau*p)+0.19*sin(3*tau*p)+0.10*sin(7*tau*p)+0.04*sin(9*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 1.25,
      release: 3.2,
      send: 0.7,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/32)%8,0,-1,-4,-2,0,1,-3,-1))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,32))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "31.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "floor(n/32)%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.08,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -2.3,
              hi: 2.3,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "buried-sun-sub",
    name: "Buried Sun Sub",
    group: "cinematic",
    description: "The low end of Buried Sun Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/32)%8,0,-1,-4,-2,0,1,-3,-1)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.76*sin(tau*p)+0.3*sin(2*tau*p)+0.09*sin(5*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/32)%8,0,-1,-4,-2,0,1,-3,-1)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,32))*(0.72+0.08*(n%64==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.8",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "europa-snow-pad",
    name: "Europa Snow Pad",
    group: "cinematic",
    description: "Emotional retro-futurism. A wide 5-voice pad on its own 8-bar minor progression; plant Europa Snow Sub with it for the low end.",
    formula: "y = (pick(floor(n/16)%8,0,3,5,2,4,1,-2,0))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.68*sin(tau*p)+0.25*sin(2*tau*p)+0.12*sin(3*tau*p)+0.055*sin(6*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.62,
      release: 3,
      send: 0.77,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,3,5,2,4,1,-2,0))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.53+0.07*sin(tau*floor(n/16)/8)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 5,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "floor(n/32)%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.04,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "europa-snow-sub",
    name: "Europa Snow Sub",
    group: "cinematic",
    description: "The low end of Europa Snow Pad: the same 8-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/16)%8,0,3,5,2,4,1,-2,0)) - 0*(n%16)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.93*sin(tau*p)+0.13*sin(2*tau*p)+0.03*sin(5*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%8,0,3,5,2,4,1,-2,0)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.5",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.16:0 0.28:0.5:0.35 0.6:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "forgotten-gravity-pad",
    name: "Forgotten Gravity Pad",
    group: "cinematic",
    description: "A colossal dark-fantasy finale. A wide 5-voice pad on its own 16-bar minor progression; plant Forgotten Gravity Sub with it for the low end.",
    formula: "y = (pick(floor(n/16)%16,0,-2,-4,-1,2,3,1,-2,0,1,4,2,-3,-1,3,0))",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.47*sin(tau*p+0.28*sin(3*tau*p))+0.27*sin(2*tau*p)+0.16*sin(3*tau*p)+0.11*sin(4*tau*p)+0.055*sin(8*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.75,
      release: 4.1,
      send: 0.72,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.09,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%16,0,-2,-4,-1,2,3,1,-2,0,1,4,2,-3,-1,3,0))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.53+0.07*sin(tau*floor(n/16)/16)+0.05*(floor(n/16)%4==3))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.6",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 60,
            },
            data: {
              value: 5,
              min: 1,
              max: 8,
            },
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 180,
            },
            data: {
              formula: "(floor(n/16)+floor(n/64))%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 250,
            },
            data: {
              value: 0.04,
              min: -0.5,
              max: 0.5,
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1.7,
              hi: 1.7,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "forgotten-gravity-sub",
    name: "Forgotten Gravity Sub",
    group: "cinematic",
    description: "The low end of Forgotten Gravity Pad: the same 16-bar progression down in octave 2, with small scooping bends.",
    formula: "y = (pick(floor(n/16)%16,0,-2,-4,-1,2,3,1,-2,0,1,4,2,-3,-1,3,0)) - 0*(n%16)",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.79*sin(tau*p+0.21*sin(2*tau*p))+0.23*sin(2*tau*p)+0.08*sin(3*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.045,
      release: 0.62,
      send: 0.07,
      swing: 0,
      playMode: "notes",
      quantize: false,
      glide: 0.12,
      graph: {
        nodes: [
          {
            id: "time",
            type: "step",
            position: {
              x: 0,
              y: 0,
            },
            data: {},
          },
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 155,
            },
            data: {
              formula: "(pick(floor(n/16)%16,0,-2,-4,-1,2,3,1,-2,0,1,4,2,-3,-1,3,0)) - 0*(n%16)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 310,
            },
            data: {
              formula: "(every(n,16))*(0.72+0.08*(n%32==0))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 280,
              y: 310,
            },
            data: {
              formula: "15.7",
            },
          },
          {
            id: "bend",
            type: "curve",
            position: {
              x: 560,
              y: 30,
            },
            data: {
              points: "0:0.86:0 0.26:0.5:0.3 0.65:0.5:0 1:0.5:0",
              repeats: 1,
              lo: -1,
              hi: 1,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 112,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "bend.out-out.bend",
            source: "bend",
            sourceHandle: "out",
            target: "out",
            targetHandle: "bend",
          },
          {
            id: "time.np-bend.p",
            source: "time",
            sourceHandle: "np",
            target: "bend",
            targetHandle: "p",
          },
        ],
      },
    },
  },
  {
    id: "memory-walls",
    name: "Memory Walls",
    group: "cinematic",
    description: "An eight-bar elegy that descends, then lifts late into unresolved dread. Four-note chords on its own minor progression.",
    formula: "y = pick(floor(n / 16) % 8, 0, -2, -4, -1, 0, 2, -2, -1)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.70*sin(tau*p)+0.22*sin(2*tau*p)+0.11*sin(3*tau*p)+0.05*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.34,
      release: 2.6,
      send: 0.74,
      swing: 0,
      playMode: "notes",
      quantize: true,
      glide: 0.06,
      graph: {
        nodes: [
          {
            id: "p",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick(floor(n / 16) % 8, 0, -2, -4, -1, 0, 2, -2, -1)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "(0.700 + 0.055*sin(tau*floor(n / 16)/8)) * every(n, 16)",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 39,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "length",
            type: "number",
            position: {
              x: 280,
              y: 248,
            },
            data: {
              value: 15.55,
              min: 0,
              max: 32,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 55,
            },
            data: {},
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 410,
            },
            data: {
              formula: "floor(n/32)%2",
            },
          },
        ],
        edges: [
          {
            id: "p.out-out.pitch",
            source: "p",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
        ],
      },
    },
  },
  {
    id: "floor-zero",
    name: "Floor Zero",
    group: "cinematic",
    description: "Slow minor sevenths revolving up a ghostly staircase that never arrives. Its own eight-bar minor progression.",
    formula: "y = pick(floor(n / 16) % 8, 0, 1, 3, 2, 4, 3, 1, -1)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.62*sin(tau*p)+0.26*sin(2*tau*p)+0.14*sin(4*tau*p)+0.06*sin(7*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.52,
      release: 2.4,
      send: 0.86,
      swing: 0,
      playMode: "notes",
      quantize: true,
      glide: 0.06,
      graph: {
        nodes: [
          {
            id: "p",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick(floor(n / 16) % 8, 0, 1, 3, 2, 4, 3, 1, -1)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "(0.640 + 0.055*sin(tau*floor(n / 16)/8)) * every(n, 16)",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 39,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "length",
            type: "number",
            position: {
              x: 280,
              y: 248,
            },
            data: {
              value: 15.55,
              min: 0,
              max: 32,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 55,
            },
            data: {},
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 410,
            },
            data: {
              formula: "floor(n/16)%3",
            },
          },
        ],
        edges: [
          {
            id: "p.out-out.pitch",
            source: "p",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
        ],
      },
    },
  },
  {
    id: "other-sunday",
    name: "Other Sunday",
    group: "cinematic",
    description: "Warm memories turn alien: an uplifting sequence slips into darker roots. Five-note chords, eight bars.",
    formula: "y = pick(floor(n / 16) % 8, 0, 3, 5, 4, 2, 5, -2, 0)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.75*sin(tau*p)+0.18*sin(2*tau*p)+0.08*sin(3*tau*p)+0.035*sin(6*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.62,
      release: 3,
      send: 0.79,
      swing: 0,
      playMode: "notes",
      quantize: true,
      glide: 0.06,
      graph: {
        nodes: [
          {
            id: "p",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick(floor(n / 16) % 8, 0, 3, 5, 4, 2, 5, -2, 0)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "(0.700 + 0.055*sin(tau*floor(n / 16)/8)) * every(n, 16)",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 39,
            },
            data: {
              value: 5,
              min: 1,
              max: 8,
            },
          },
          {
            id: "length",
            type: "number",
            position: {
              x: 280,
              y: 248,
            },
            data: {
              value: 15.55,
              min: 0,
              max: 32,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 55,
            },
            data: {},
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 410,
            },
            data: {
              formula: "floor(n/32)%2",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 355,
            },
            data: {
              value: 0.02,
              min: -0.5,
              max: 0.5,
            },
          },
        ],
        edges: [
          {
            id: "p.out-out.pitch",
            source: "p",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
        ],
      },
    },
  },
  {
    id: "empty-album",
    name: "Empty Album",
    group: "cinematic",
    description: "Ninth chords drifting through eerie degree changes: tender and alien. Eight bars, minor.",
    formula: "y = pick(floor(n / 16) % 8, 0, -4, 3, -2, 1, -3, 4, 0)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.70*sin(tau*p)+0.18*sin(3*tau*p)+0.09*sin(5*tau*p)+0.04*sin(7*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.85,
      release: 3.2,
      send: 0.87,
      swing: 0,
      playMode: "notes",
      quantize: true,
      glide: 0.06,
      graph: {
        nodes: [
          {
            id: "p",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick(floor(n / 16) % 8, 0, -4, 3, -2, 1, -3, 4, 0)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "(0.700 + 0.055*sin(tau*floor(n / 16)/8)) * every(n, 16)",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 39,
            },
            data: {
              value: 5,
              min: 1,
              max: 8,
            },
          },
          {
            id: "length",
            type: "number",
            position: {
              x: 280,
              y: 248,
            },
            data: {
              value: 15.55,
              min: 0,
              max: 32,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 55,
            },
            data: {},
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 410,
            },
            data: {
              formula: "floor(n/16)%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 355,
            },
            data: {
              value: 0.02,
              min: -0.5,
              max: 0.5,
            },
          },
        ],
        edges: [
          {
            id: "p.out-out.pitch",
            source: "p",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
        ],
      },
    },
  },
  {
    id: "doorframe-ritual",
    name: "Doorframe Ritual",
    group: "cinematic",
    description: "A four-chord ritual with slowly shifting voicings and a restrained pulse.",
    formula: "y = pick(floor(n / 16) % 8, 0, -1, -3, -2, 0, -1, 2, -2)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.65*sin(tau*p+0.32*sin(tau*p))+0.19*sin(2*tau*p)+0.08*sin(4*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.25,
      release: 1.9,
      send: 0.78,
      swing: 0,
      playMode: "notes",
      quantize: true,
      glide: 0.06,
      graph: {
        nodes: [
          {
            id: "p",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick(floor(n / 16) % 8, 0, -1, -3, -2, 0, -1, 2, -2)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "(0.640 + 0.055*sin(tau*floor(n / 16)/8)) * every(n, 16)",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 39,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "length",
            type: "number",
            position: {
              x: 280,
              y: 248,
            },
            data: {
              value: 15.55,
              min: 0,
              max: 32,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 55,
            },
            data: {},
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 410,
            },
            data: {
              formula: "floor(n/32)%2",
            },
          },
        ],
        edges: [
          {
            id: "p.out-out.pitch",
            source: "p",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
        ],
      },
    },
  },
  {
    id: "last-light",
    name: "Last Light",
    group: "cinematic",
    description: "Sixteen bars: a lonely descent, false hope, and a suspended ending.",
    formula: "y = pick(floor(n / 16) % 16, 0, -2, -4, -1, 0, 3, 5, 4, 2, 1, -3, -2, 0, 4, 1, 0)",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "degree",
      waveform: "custom",
      timbre: "0.75*sin(tau*p)+0.22*sin(2*tau*p)+0.08*sin(3*tau*p)+0.05*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.65,
      release: 3.6,
      send: 0.9,
      swing: 0,
      playMode: "notes",
      quantize: true,
      glide: 0.06,
      graph: {
        nodes: [
          {
            id: "p",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "pick(floor(n / 16) % 16, 0, -2, -4, -1, 0, 3, 5, 4, 2, 1, -3, -2, 0, 4, 1, 0)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "(0.700 + 0.055*sin(tau*floor(n / 16)/16)) * every(n, 16)",
            },
          },
          {
            id: "chord",
            type: "number",
            position: {
              x: 280,
              y: 39,
            },
            data: {
              value: 4,
              min: 1,
              max: 8,
            },
          },
          {
            id: "length",
            type: "number",
            position: {
              x: 280,
              y: 248,
            },
            data: {
              value: 15.55,
              min: 0,
              max: 32,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 55,
            },
            data: {},
          },
          {
            id: "inv",
            type: "expr",
            position: {
              x: 280,
              y: 410,
            },
            data: {
              formula: "floor(n/32)%3",
            },
          },
          {
            id: "strum",
            type: "number",
            position: {
              x: 560,
              y: 355,
            },
            data: {
              value: 0.02,
              min: -0.5,
              max: 0.5,
            },
          },
        ],
        edges: [
          {
            id: "p.out-out.pitch",
            source: "p",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "chord.out-out.chord",
            source: "chord",
            sourceHandle: "out",
            target: "out",
            targetHandle: "chord",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
          {
            id: "inv.out-out.inversion",
            source: "inv",
            sourceHandle: "out",
            target: "out",
            targetHandle: "inversion",
          },
          {
            id: "strum.out-out.strum",
            source: "strum",
            sourceHandle: "out",
            target: "out",
            targetHandle: "strum",
          },
        ],
      },
    },
  },
  {
    id: "obsidian-hemiola",
    name: "Obsidian Hemiola",
    group: "callresponse",
    description: "A hard four-beat anchor under a 3–3–2 bass phrase; the eighth slot lets out a high harmonic-minor answer.",
    formula: "y = ((fract(t)<.19 ? (-27 + 37*exp(-19*fract(t))) : (floor(4*t)%8==7 && fract(8*t)<.8) ? (8 + (floor(12*(((3*floor(t/2)+floor(t/4)))%7)/7+0.5) - ((((3*floor(t/2)+floor(t/4)))%7)==5) + ((((3*floor(t/2)+floor(t/4)))%7)==6 && 1)) - 14*fract(8*t) + 2*sin(23*fract(8*t))*exp(-16*fract(8*t))) : (-15 + (floor(12*(((floor(8*t)+2*floor(t/4)))%7)/7+0.5) - ((((floor(8*t)+2*floor(t/4)))%7)==5) + ((((floor(8*t)+2*floor(t/4)))%7)==6 && 0)) + 3*(floor(8*t)%8==6) + 2.2*exp(-16*fract(8*t))))) / 12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.75*sin(tau*p)+0.31*sin(2*tau*p)+0.13*sin(5*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.006,
      release: 0.1,
      send: 0.26,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.19 ? (-27 + 37*exp(-19*fract(t))) : (floor(4*t)%8==7 && fract(8*t)<.8) ? (8 + (floor(12*(((3*floor(t/2)+floor(t/4)))%7)/7+0.5) - ((((3*floor(t/2)+floor(t/4)))%7)==5) + ((((3*floor(t/2)+floor(t/4)))%7)==6 && 1)) - 14*fract(8*t) + 2*sin(23*fract(8*t))*exp(-16*fract(8*t))) : (-15 + (floor(12*(((floor(8*t)+2*floor(t/4)))%7)/7+0.5) - ((((floor(8*t)+2*floor(t/4)))%7)==5) + ((((floor(8*t)+2*floor(t/4)))%7)==6 && 0)) + 3*(floor(8*t)%8==6) + 2.2*exp(-16*fract(8*t))))) / 12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.19 ? .95 : floor(4*t)%8==7 ? .86 : (floor(8*t)%8==0 || floor(8*t)%8==3 || floor(8*t)%8==6) ? .78 : .45) * (fract(8*t)<.76)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "concrete-canon",
    name: "Concrete Canon",
    group: "callresponse",
    description: "The opening two-beat melody comes back as a delayed, displaced high answer, each bar anchored by low impacts.",
    formula: "y = ((fract(t)<.18 ? (-29 + 34*exp(-13*fract(t)) + 1.7*sin(17*fract(t))*exp(-9*fract(t))) : fract(t/4)<.48 ? (-14+(floor(12*(((floor(4*t)+2*floor(t/4)))%7)/7+0.5) - ((((floor(4*t)+2*floor(t/4)))%7)==5) + ((((floor(4*t)+2*floor(t/4)))%7)==6 && 1))+1.8*exp(-15*fract(4*t))) : (1+(floor(12*(((floor(4*(t-1.5))+2*floor(t/4)))%7)/7+0.5) - ((((floor(4*(t-1.5))+2*floor(t/4)))%7)==5) + ((((floor(4*(t-1.5))+2*floor(t/4)))%7)==6 && 1))-2.6*(1-exp(-10*fract(4*t)))))) / 12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.70*sin(tau*p)+0.22*sin(2*tau*p)+0.14*sin(3*tau*p)+0.08*sin(6*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.006,
      release: 0.14,
      send: 0.26,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.18 ? (-29 + 34*exp(-13*fract(t)) + 1.7*sin(17*fract(t))*exp(-9*fract(t))) : fract(t/4)<.48 ? (-14+(floor(12*(((floor(4*t)+2*floor(t/4)))%7)/7+0.5) - ((((floor(4*t)+2*floor(t/4)))%7)==5) + ((((floor(4*t)+2*floor(t/4)))%7)==6 && 1))+1.8*exp(-15*fract(4*t))) : (1+(floor(12*(((floor(4*(t-1.5))+2*floor(t/4)))%7)/7+0.5) - ((((floor(4*(t-1.5))+2*floor(t/4)))%7)==5) + ((((floor(4*(t-1.5))+2*floor(t/4)))%7)==6 && 1))-2.6*(1-exp(-10*fract(4*t)))))) / 12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.18 ? .98 : (fract(4*t)<.70 && (floor(4*t)%4!=2)) ? (fract(t/4)<.48 ? .78 : .68) : 0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "dead-air",
    name: "Dead Air",
    group: "callresponse",
    description: "Sparse offbeat stabs spell a fixed 16-slot code; a long high answer cuts in just before the bar resets.",
    formula: "y = ((fract(t)<.20 && floor(t)%2==0 ? (-29 + 34*exp(-13*fract(t)) + 1.7*sin(17*fract(t))*exp(-9*fract(t))) : (floor(8*t)%16)==14 ? (6 + (floor(12*(((3*floor(t/2)+floor(t/4)))%7)/7+0.5) - ((((3*floor(t/2)+floor(t/4)))%7)==5) + ((((3*floor(t/2)+floor(t/4)))%7)==6 && 1)) - 12*fract(8*t)) : (-17 + (floor(12*(((5*floor(8*t)+floor(t/4)))%7)/7+0.5)-((((5*floor(8*t)+floor(t/4)))%7)==1)-((((5*floor(8*t)+floor(t/4)))%7)==5)) + 4*exp(-18*fract(8*t))))) / 12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.78*sin(tau*p)+0.36*sin(2*tau*p)+0.07*sin(7*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.006,
      release: 0.09,
      send: 0.18,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.20 && floor(t)%2==0 ? (-29 + 34*exp(-13*fract(t)) + 1.7*sin(17*fract(t))*exp(-9*fract(t))) : (floor(8*t)%16)==14 ? (6 + (floor(12*(((3*floor(t/2)+floor(t/4)))%7)/7+0.5) - ((((3*floor(t/2)+floor(t/4)))%7)==5) + ((((3*floor(t/2)+floor(t/4)))%7)==6 && 1)) - 12*fract(8*t)) : (-17 + (floor(12*(((5*floor(8*t)+floor(t/4)))%7)/7+0.5)-((((5*floor(8*t)+floor(t/4)))%7)==1)-((((5*floor(8*t)+floor(t/4)))%7)==5)) + 4*exp(-18*fract(8*t))))) / 12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.20 && floor(t)%2==0 ? .99 : (floor(8*t)%16)==14 && fract(8*t)<.67 ? .89 : ((floor(8*t)%16)==2 || (floor(8*t)%16)==3 || (floor(8*t)%16)==7 || (floor(8*t)%16)==10) && fract(8*t)<.68 ? .77 : 0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "midnight-sonata",
    name: "Midnight Sonata",
    group: "callresponse",
    description: "A motif mirrored every second bar, closed by a measured high answer at the end of each four beats.",
    formula: "y = ((fract(t)<.18 ? (-25 + 30*exp(-24*fract(t))) : fract(t/4)>.82 ? (8 + (floor(12*(((2*floor(t/2)+floor(t/4)))%7)/7+0.5) - ((((2*floor(t/2)+floor(t/4)))%7)==5) + ((((2*floor(t/2)+floor(t/4)))%7)==6 && 1)) - 12*(fract(t/4)-.82)) : (-10 + (floor(12*(((3*(floor(t/4)%2==0 ? (floor(4*t)%8) : (7-(floor(4*t)%8)))+floor(t/4)))%7)/7+0.5) - ((((3*(floor(t/4)%2==0 ? (floor(4*t)%8) : (7-(floor(4*t)%8)))+floor(t/4)))%7)==5) + ((((3*(floor(t/4)%2==0 ? (floor(4*t)%8) : (7-(floor(4*t)%8)))+floor(t/4)))%7)==6 && 0)) + 2.3*exp(-18*fract(4*t))))) / 12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.74*sin(tau*p)+0.30*sin(2*tau*p)+0.14*sin(4*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.006,
      release: 0.12,
      send: 0.26,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.18 ? (-25 + 30*exp(-24*fract(t))) : fract(t/4)>.82 ? (8 + (floor(12*(((2*floor(t/2)+floor(t/4)))%7)/7+0.5) - ((((2*floor(t/2)+floor(t/4)))%7)==5) + ((((2*floor(t/2)+floor(t/4)))%7)==6 && 1)) - 12*(fract(t/4)-.82)) : (-10 + (floor(12*(((3*(floor(t/4)%2==0 ? (floor(4*t)%8) : (7-(floor(4*t)%8)))+floor(t/4)))%7)/7+0.5) - ((((3*(floor(t/4)%2==0 ? (floor(4*t)%8) : (7-(floor(4*t)%8)))+floor(t/4)))%7)==5) + ((((3*(floor(t/4)%2==0 ? (floor(4*t)%8) : (7-(floor(4*t)%8)))+floor(t/4)))%7)==6 && 0)) + 2.3*exp(-18*fract(4*t))))) / 12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.18 ? .95 : fract(t/4)>.82 ? .86 : (fract(4*t)<.78 && floor(4*t)%4!=2) ? .76 : 0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "fourth-bell",
    name: "Fourth Bell",
    group: "callresponse",
    description: "Three bars of steady bass-and-melody exchange, then the fourth bursts into twelve notes a beat.",
    formula: "y = ((fract(t)<.18 ? (-30 + 36*exp(-16*fract(t))) : floor(t/4)%4==3 && fract(t/4)>.62 ? (-3 + (floor(12*(((floor(12*t)+floor(t/4)))%7)/7+0.5) - ((((floor(12*t)+floor(t/4)))%7)==5) + ((((floor(12*t)+floor(t/4)))%7)==6 && 0)) + 9*exp(-24*fract(12*t))) : fract(t/4)>.77 ? (5 + (floor(12*(((floor(t/2)+2*floor(t/4)))%7)/7+0.5) - ((((floor(t/2)+2*floor(t/4)))%7)==5) + ((((floor(t/2)+2*floor(t/4)))%7)==6 && 1)) - 10*fract(4*t)) : (-10 + (floor(12*(((floor(4*t)+floor(t/4)))%7)/7+0.5) - ((((floor(4*t)+floor(t/4)))%7)==5) + ((((floor(4*t)+floor(t/4)))%7)==6 && 0)) + 4.8*exp(-13*fract(4*t))))) / 12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p)+0.27*sin(2*tau*p)+0.19*sin(3*tau*p)+0.08*sin(8*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.006,
      release: 0.075,
      send: 0.26,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.18 ? (-30 + 36*exp(-16*fract(t))) : floor(t/4)%4==3 && fract(t/4)>.62 ? (-3 + (floor(12*(((floor(12*t)+floor(t/4)))%7)/7+0.5) - ((((floor(12*t)+floor(t/4)))%7)==5) + ((((floor(12*t)+floor(t/4)))%7)==6 && 0)) + 9*exp(-24*fract(12*t))) : fract(t/4)>.77 ? (5 + (floor(12*(((floor(t/2)+2*floor(t/4)))%7)/7+0.5) - ((((floor(t/2)+2*floor(t/4)))%7)==5) + ((((floor(t/2)+2*floor(t/4)))%7)==6 && 1)) - 10*fract(4*t)) : (-10 + (floor(12*(((floor(4*t)+floor(t/4)))%7)/7+0.5) - ((((floor(4*t)+floor(t/4)))%7)==5) + ((((floor(4*t)+floor(t/4)))%7)==6 && 0)) + 4.8*exp(-13*fract(4*t))))) / 12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.18 ? .99 : floor(t/4)%4==3 && fract(t/4)>.62 ? (.65+.22*(floor(12*t)%3==0))*(fract(12*t)<.72) : fract(t/4)>.77 ? .84 : (fract(4*t)<.72 && floor(4*t)%4!=1) ? .74 : 0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "anvil-fugue",
    name: "Anvil Fugue",
    group: "callresponse",
    description: "A retrograde canon: a four-note motif reverses every second beat, and a high imitation finishes the odd beats.",
    formula: "y = ((fract(t)<.17?(-31+39*exp(-24*fract(t))+1.6*sin(37*fract(t))*exp(-19*fract(t))): (fract(t)>.68 && floor(t)%2==1)?(2+((floor(12*((((2*floor(4*(t-.5))+floor(t/8)))%7+7)%7)/7+0.5)-(((((2*floor(4*(t-.5))+floor(t/8)))%7+7)%7)==5))+(((((2*floor(4*(t-.5))+floor(t/8)))%7+7)%7)==6))+5*exp(-9*fract(4*t))-8*fract(4*t)):(-17+((floor(12*((((2*(floor(t)%2==0 ? floor(4*t)%4 : 3-floor(4*t)%4)+floor(t/8)))%7+7)%7)/7+0.5)-(((((2*(floor(t)%2==0 ? floor(4*t)%4 : 3-floor(4*t)%4)+floor(t/8)))%7+7)%7)==5))+(((((2*(floor(t)%2==0 ? floor(4*t)%4 : 3-floor(4*t)%4)+floor(t/8)))%7+7)%7)==6))+2.7*exp(-17*fract(4*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.73*sin(tau*p)+0.36*sin(2*tau*p)+0.18*sin(3*tau*p)+0.10*sin(5*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.004,
      release: 0.12,
      send: 0.2,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17?(-31+39*exp(-24*fract(t))+1.6*sin(37*fract(t))*exp(-19*fract(t))): (fract(t)>.68 && floor(t)%2==1)?(2+((floor(12*((((2*floor(4*(t-.5))+floor(t/8)))%7+7)%7)/7+0.5)-(((((2*floor(4*(t-.5))+floor(t/8)))%7+7)%7)==5))+(((((2*floor(4*(t-.5))+floor(t/8)))%7+7)%7)==6))+5*exp(-9*fract(4*t))-8*fract(4*t)):(-17+((floor(12*((((2*(floor(t)%2==0 ? floor(4*t)%4 : 3-floor(4*t)%4)+floor(t/8)))%7+7)%7)/7+0.5)-(((((2*(floor(t)%2==0 ? floor(4*t)%4 : 3-floor(4*t)%4)+floor(t/8)))%7+7)%7)==5))+(((((2*(floor(t)%2==0 ? floor(4*t)%4 : 3-floor(4*t)%4)+floor(t/8)))%7+7)%7)==6))+2.7*exp(-17*fract(4*t)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17?.96:(fract(t)>.68 && floor(t)%2==1)?(.86*(fract(8*t)<.80)):(fract(4*t)<.72 && floor(4*t)%4!=2)? .68:0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "abyssal-answer",
    name: "Abyssal Answer",
    group: "callresponse",
    description: "A long sub-bass wave fills most of each bar; one high falling reply arrives near the end.",
    formula: "y = ((fract(t)<.17&&floor(t)%2==0?(-26+33*exp(-15*fract(t))): fract(t/4)<.70 ? (-27+6*sin(2*3.141592653589793*(fract(t/4)+.12*sin(2*3.141592653589793*fract(t/4)))) + 2.1*sin(2*3.141592653589793*t/2.4)) : (2+(floor(12*((((2*floor(t/4)+floor(t/8)))%7+7)%7)/7+0.5)-(((((2*floor(t/4)+floor(t/8)))%7+7)%7)==5))+5*exp(-7*(t%4-2.8))-4*(t%4-2.8))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.97*sin(tau*p)+0.15*sin(2*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.015,
      release: 0.36,
      send: 0.28,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17&&floor(t)%2==0?(-26+33*exp(-15*fract(t))): fract(t/4)<.70 ? (-27+6*sin(2*3.141592653589793*(fract(t/4)+.12*sin(2*3.141592653589793*fract(t/4)))) + 2.1*sin(2*3.141592653589793*t/2.4)) : (2+(floor(12*((((2*floor(t/4)+floor(t/8)))%7+7)%7)/7+0.5)-(((((2*floor(t/4)+floor(t/8)))%7+7)%7)==5))+5*exp(-7*(t%4-2.8))-4*(t%4-2.8))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17&&floor(t)%2==0?.99:fract(t/4)>.15 && fract(t/4)<.69?.81:fract(t/4)>.76 && fract(t/4)<.98?.78:0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "valve-tarantella",
    name: "Valve Tarantella",
    group: "callresponse",
    description: "Triplets dance against four heavy kicks; every sixth note folds into a falling high cadence.",
    formula: "y = ((fract(t)<.17?(-30+36*exp(-20*fract(t))): (floor(3*t)%6==5)?(5+((floor(12*((((floor(3*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(3*t)+floor(t/4)))%7+7)%7)==5))+(((((floor(3*t)+floor(t/4)))%7+7)%7)==6))-10*fract(3*t)):(-11+((floor(12*((((2*floor(3*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((2*floor(3*t)+floor(t/4)))%7+7)%7)==5))+(((((2*floor(3*t)+floor(t/4)))%7+7)%7)==6))+1.7*sin(3.141592653589793*fract(3*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.65*sin(tau*p)+0.39*sin(2*tau*p)+0.20*sin(4*tau*p)+0.08*sin(7*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.004,
      release: 0.105,
      send: 0.31,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17?(-30+36*exp(-20*fract(t))): (floor(3*t)%6==5)?(5+((floor(12*((((floor(3*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(3*t)+floor(t/4)))%7+7)%7)==5))+(((((floor(3*t)+floor(t/4)))%7+7)%7)==6))-10*fract(3*t)):(-11+((floor(12*((((2*floor(3*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((2*floor(3*t)+floor(t/4)))%7+7)%7)==5))+(((((2*floor(3*t)+floor(t/4)))%7+7)%7)==6))+1.7*sin(3.141592653589793*fract(3*t)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17?.97: (fract(3*t)<.66 && floor(3*t)%6!=2)?(.63+.15*(floor(3*t)%3==0)):0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "hemiola-foundry",
    name: "Hemiola Foundry",
    group: "callresponse",
    description: "A fixed 3–3–2 low motif meets a high answer; the centre moves by fifths every two bars.",
    formula: "y = ((fract(t)<.17?(-28+35*exp(-21*fract(t))): (floor(8*t)%8)==7?(3+((7*floor(t/8))%12)+((floor(12*((((3*floor(t/2)+floor(t/4)))%7+7)%7)/7+0.5)-(((((3*floor(t/2)+floor(t/4)))%7+7)%7)==5))+(((((3*floor(t/2)+floor(t/4)))%7+7)%7)==6))-15*fract(8*t)):(-17+((7*floor(t/8))%12)+((floor(12*((((5*floor(8*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((5*floor(8*t)+floor(t/4)))%7+7)%7)==5))-(((((5*floor(8*t)+floor(t/4)))%7+7)%7)==1))/2+3*exp(-20*fract(8*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p)+0.27*sin(2*tau*p)+0.13*sin(5*tau*p)+0.07*sin(9*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.004,
      release: 0.09,
      send: 0.2,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17?(-28+35*exp(-21*fract(t))): (floor(8*t)%8)==7?(3+((7*floor(t/8))%12)+((floor(12*((((3*floor(t/2)+floor(t/4)))%7+7)%7)/7+0.5)-(((((3*floor(t/2)+floor(t/4)))%7+7)%7)==5))+(((((3*floor(t/2)+floor(t/4)))%7+7)%7)==6))-15*fract(8*t)):(-17+((7*floor(t/8))%12)+((floor(12*((((5*floor(8*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((5*floor(8*t)+floor(t/4)))%7+7)%7)==5))-(((((5*floor(8*t)+floor(t/4)))%7+7)%7)==1))/2+3*exp(-20*fract(8*t)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17?.97: (floor(8*t)%8)==7? .83*(fract(8*t)<.70): ((floor(8*t)%8)==0||(floor(8*t)%8)==3||(floor(8*t)%8)==6)? .77*(fract(8*t)<.65):0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "blue-cathedral",
    name: "Blue Cathedral",
    group: "callresponse",
    description: "Slow legato: long arches stretch over nearly three beats before a measured fall, moving centre every two bars.",
    formula: "y = ((fract(t)<.17?(-31+39*exp(-24*fract(t))+1.6*sin(37*fract(t))*exp(-19*fract(t))): (t%4)<2.65?(-16+(floor(12*((((floor(t/8)+floor(t)))%7+7)%7)/7+0.5))+10*sin(3.141592653589793*((t%4)/2.65)) + 2*sin(2*3.141592653589793*((t%4)/2.65))): (4+(floor(12*((((floor(t/2)+floor(t/8)))%7+7)%7)/7+0.5)-(((((floor(t/2)+floor(t/8)))%7+7)%7)==5))-18*(((t%4)-2.65)/1.35)*(((t%4)-2.65)/1.35))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.86*sin(tau*p)+0.25*sin(2*tau*p)+0.18*sin(3*tau*p)+0.08*sin(4*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.019,
      release: 0.42,
      send: 0.4,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17?(-31+39*exp(-24*fract(t))+1.6*sin(37*fract(t))*exp(-19*fract(t))): (t%4)<2.65?(-16+(floor(12*((((floor(t/8)+floor(t)))%7+7)%7)/7+0.5))+10*sin(3.141592653589793*((t%4)/2.65)) + 2*sin(2*3.141592653589793*((t%4)/2.65))): (4+(floor(12*((((floor(t/2)+floor(t/8)))%7+7)%7)/7+0.5)-(((((floor(t/2)+floor(t/8)))%7+7)%7)==5))-18*(((t%4)-2.65)/1.35)*(((t%4)-2.65)/1.35))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17?.95:((t%4)>.28 && (t%4)<2.63)?.78: ((t%4)>2.67 && (t%4)<3.65)?.73:0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "semaphore",
    name: "Semaphore",
    group: "callresponse",
    description: "A five-stab off-grid Morse rhythm cuts through wide silences, with a late answering stab every two beats.",
    formula: "y = ((fract(t)<.17?(-30+36*exp(-20*fract(t))): (floor(8*t)%16)==15?(1+((floor(12*((((floor(t/2)+3*floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(t/2)+3*floor(t/4)))%7+7)%7)==5))+(((((floor(t/2)+3*floor(t/4)))%7+7)%7)==6))+7*exp(-12*fract(8*t))-12*fract(8*t)):(-19+((floor(12*((((5*floor(8*t)+2*floor(t/4)))%7+7)%7)/7+0.5)-(((((5*floor(8*t)+2*floor(t/4)))%7+7)%7)==5))-(((((5*floor(8*t)+2*floor(t/4)))%7+7)%7)==1))+2.6*exp(-16*fract(8*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.70*sin(tau*p)+0.26*sin(3*tau*p)+0.16*sin(5*tau*p)+0.08*sin(7*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.004,
      release: 0.075,
      send: 0.17,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17?(-30+36*exp(-20*fract(t))): (floor(8*t)%16)==15?(1+((floor(12*((((floor(t/2)+3*floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(t/2)+3*floor(t/4)))%7+7)%7)==5))+(((((floor(t/2)+3*floor(t/4)))%7+7)%7)==6))+7*exp(-12*fract(8*t))-12*fract(8*t)):(-19+((floor(12*((((5*floor(8*t)+2*floor(t/4)))%7+7)%7)/7+0.5)-(((((5*floor(8*t)+2*floor(t/4)))%7+7)%7)==5))-(((((5*floor(8*t)+2*floor(t/4)))%7+7)%7)==1))+2.6*exp(-16*fract(8*t)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17?.98:((floor(8*t)%16)==2||(floor(8*t)%16)==5||(floor(8*t)%16)==9||(floor(8*t)%16)==14)? .79*(fract(8*t)<.72):((floor(8*t)%16)==15)? .89*(fract(8*t)<.82):0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "machine-rubato",
    name: "Machine Rubato",
    group: "callresponse",
    description: "The kick stays put while a warped clock stretches and squeezes the sixteenth figures inside each bar.",
    formula: "y = ((fract(t)<.17?(-28+35*exp(-21*fract(t))):fract(t/4)>.79?(7+((floor(12*((((floor(t/2)+floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(t/2)+floor(t/4)))%7+7)%7)==5))+(((((floor(t/2)+floor(t/4)))%7+7)%7)==6))-14*fract(4*t)):(-16+(floor(12*((((2*(floor(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4))))+floor(t/4)))%7+7)%7)/7+0.5))+4*exp(-9*(fract(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4)))))+1.6*sin(3.141592653589793*(fract(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4))))))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p)+0.28*sin(2*tau*p)+0.17*sin(3*tau*p)+0.11*sin(4*tau*p)+0.06*sin(5*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.004,
      release: 0.115,
      send: 0.2,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17?(-28+35*exp(-21*fract(t))):fract(t/4)>.79?(7+((floor(12*((((floor(t/2)+floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(t/2)+floor(t/4)))%7+7)%7)==5))+(((((floor(t/2)+floor(t/4)))%7+7)%7)==6))-14*fract(4*t)):(-16+(floor(12*((((2*(floor(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4))))+floor(t/4)))%7+7)%7)/7+0.5))+4*exp(-9*(fract(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4)))))+1.6*sin(3.141592653589793*(fract(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4))))))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17?.97:fract(t/4)>.79?.86*(fract(4*t)<.78):((fract(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4))))<.68 && (floor(4*(t%4 + .18*sin(2*3.141592653589793*(t%4)/4))))%4!=2)? .72:0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "underpass-dialogue",
    name: "Underpass Dialogue",
    group: "callresponse",
    description: "Bass impacts on 1 and 3, a semitone melody answering on 2 and 4. The reply changes only in bar four.",
    formula: "y = ((fract(t/2)<0.11 ? -24+28*exp(-24*fract(t/2)) : fract(t)<0.48 ? -13 + 6*exp(-8*fract(t)) : (floor(t)%2==1 ? -1+3*sin(6.28318530718*fract(t)/1.8)+2*(floor(t/4)%4==3) : -15+4*exp(-12*fract(t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.38*sin(2*tau*p)+0.19*sin(3*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.003,
      release: 0.09,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<0.11 ? -24+28*exp(-24*fract(t/2)) : fract(t)<0.48 ? -13 + 6*exp(-8*fract(t)) : (floor(t)%2==1 ? -1+3*sin(6.28318530718*fract(t)/1.8)+2*(floor(t/4)%4==3) : -15+4*exp(-12*fract(t)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/0.25)<0.84)*(fract(t/2)<0.15 ? .98 : floor(t)%2==1 ? (fract(t)<0.86 ? .79 : 0) : fract(t)<.42 ? .55 : 0)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "boiler-choir",
    name: "Boiler Choir",
    group: "callresponse",
    description: "A steady spectral choir: four melodic entrances a bar, with beating tone inside each held phrase.",
    formula: "y = ((fract(t/4)<.055 ? -23+25*exp(-20*fract(t/4)*4) : -9+5*sin(6.28318530718*fract(t/4)) + 3*sin(6.28318530718*(fract(t/4)*4+.12*sin(6.28318530718*fract(t/4))))+2*(floor(t/4)%4==3)))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.31*sin(2*tau*p)+0.22*sin(3*tau*p)+0.11*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.022,
      release: 0.3,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.055 ? -23+25*exp(-20*fract(t/4)*4) : -9+5*sin(6.28318530718*fract(t/4)) + 3*sin(6.28318530718*(fract(t/4)*4+.12*sin(6.28318530718*fract(t/4))))+2*(floor(t/4)%4==3)))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.89)*(fract(t/4)<.08 ? .94 : fract(t/1)<.83 ? .68 : .15)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "black-floor",
    name: "Black Floor",
    group: "callresponse",
    description: "Heavy bass on 1 and 3, metallic falling bell chirps on 2 and 4; every fourth bar ends with an extra answer.",
    formula: "y = ((fract(t/2)<.115 ? -26+30*exp(-22*fract(t/2)) : floor(t)%2==1 ? 12+9*exp(-8*fract(t))*sin(6.28318530718*(4*fract(t)+2*fract(t)*fract(t)))-15*fract(t) : -18+2*sin(6.28318530718*fract(t))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.25*sin(2*tau*p)+0.17*sin(5*tau*p)",
      sliders: [],
      volume: 0.75,
      pan: 0,
      attack: 0.005,
      release: 0.26,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<.115 ? -26+30*exp(-22*fract(t/2)) : floor(t)%2==1 ? 12+9*exp(-8*fract(t))*sin(6.28318530718*(4*fract(t)+2*fract(t)*fract(t)))-15*fract(t) : -18+2*sin(6.28318530718*fract(t))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.83)*(fract(t/2)<.15 ? 1 : floor(t)%2==1 ? (fract(t)<.78 ? .80 : 0) : (floor(t/4)%4==3 && fract(t)<.18 ? .42 : 0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "sea-telegraph",
    name: "Sea Telegraph",
    group: "callresponse",
    description: "A low 1-and-3 sub pulse converses with coded high replies; a four-bar cycle changes which answers get out.",
    formula: "y = ((fract(t/2)<.115 ? -27+31*exp(-26*fract(t/2)) : fract(t/4)<.25 ? -18+4*exp(-13*fract(t)) : fract(t/4)<.50 ? 2+5*sin(6.28318530718*fract(4*t)/2)-4*fract(t) : fract(t/4)<.75 ? -15+5*exp(-12*fract(t)) : 6+4*sin(6.28318530718*fract(t)*2)-8*fract(t)+3*(floor(t/4)%4==3)))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.78*sin(tau*p)+0.29*sin(2*tau*p)+0.11*sin(3*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.07,
      send: 0.15,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<.115 ? -27+31*exp(-26*fract(t/2)) : fract(t/4)<.25 ? -18+4*exp(-13*fract(t)) : fract(t/4)<.50 ? 2+5*sin(6.28318530718*fract(4*t)/2)-4*fract(t) : fract(t/4)<.75 ? -15+5*exp(-12*fract(t)) : 6+4*sin(6.28318530718*fract(t)*2)-8*fract(t)+3*(floor(t/4)%4==3)))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.85)*(fract(t/2)<.145 ? .99 : fract(t/4)<.25 ? (fract(4*t)<.72 ? .52 : 0) : fract(t/4)<.5 ? ((floor(4*t)%4==1 || floor(4*t)%4==3) && fract(4*t)<.72 ? .83 : 0) : fract(t/4)<.75 ? (fract(t)<.40 ? .55 : 0) : ((floor(4*t)%4==0 || floor(t/4)%4==3) && fract(4*t)<.74 ? .79 : 0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "eight-step-hex",
    name: "Eight-Step Hex",
    group: "callresponse",
    description: "A 3+3+2 ritual rhythm under uneven steps and a pitch detour in the fourth bar.",
    formula: "y = ((fract(t/4)<.08 ? -24+30*exp(-26*fract(t)) : -14 + 4*floor(3*fract(t/4)) + 6*exp(-11*fract(2*t)) + 3*sin(6.28318530718*fract(t/4)) - 6*(fract(t/4)>.78)*fract(4*t) + 3*(floor(t/4)%4==3)))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p)+0.5*sin(2*tau*p)+0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.08,
      send: 0.15,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.08 ? -24+30*exp(-26*fract(t)) : -14 + 4*floor(3*fract(t/4)) + 6*exp(-11*fract(2*t)) + 3*sin(6.28318530718*fract(t/4)) - 6*(fract(t/4)>.78)*fract(4*t) + 3*(floor(t/4)%4==3)))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.85)*(fract(t/4)<.12 ? .99 : (fract(t/4)>.36 && fract(t/4)<.445) ? .91 : (fract(t/4)>.74 && fract(t/4)<.83) ? .85 : fract(2*t)<.62 ? .42 : 0)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "bronze-stairs",
    name: "Bronze Stairs",
    group: "callresponse",
    description: "A minor stair-step bass arpeggio with an exponential kick and a falling reply on the last beat.",
    formula: "y = ((fract(t/2)<.105 ? -27+30*exp(-25*fract(t/2)) : -12 + 3*floor(4*fract(t/4)) + 2*(floor(8*fract(t/4))%2) + 3*exp(-15*fract(2*t)) - (fract(t/4)>.75 ? 9*fract(t) : 0) + (floor(t/4)%4==3 ? -2 : 0)))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.79*sin(tau*p)+0.34*sin(2*tau*p)+0.16*sin(3*tau*p)+0.07*sin(5*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.1,
      send: 0.15,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.009,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<.105 ? -27+30*exp(-25*fract(t/2)) : -12 + 3*floor(4*fract(t/4)) + 2*(floor(8*fract(t/4))%2) + 3*exp(-15*fract(2*t)) - (fract(t/4)>.75 ? 9*fract(t) : 0) + (floor(t/4)%4==3 ? -2 : 0)))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.86)*(fract(t/2)<.14 ? 1 : fract(2*t)<.70 ? .71+.13*(floor(2*t)%4==2) : 0)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "black-key-toccata",
    name: "Black Key Toccata",
    group: "callresponse",
    description: "A motoric sixteenth arc through harmonic minor, broken by anchored bass and a falling flourish every fourth bar.",
    formula: "y = ((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((-8+pick((floor(4*t)+2*floor(fract(t/4)*2)+floor(t/4)%4)%7,0,2,3,5,7,8,11)+4*exp(-13*fract(4*t))-(floor(t/4)%4==3 ? 11*fract(t/4)*fract(t/4) : 0)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.57*sin(tau*p)+0.28*sin(2*tau*p)+0.19*sin(3*tau*p)+0.09*sin(5*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.075,
      send: 0.29,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.005,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((-8+pick((floor(4*t)+2*floor(fract(t/4)*2)+floor(t/4)%4)%7,0,2,3,5,7,8,11)+4*exp(-13*fract(4*t))-(floor(t/4)%4==3 ? 11*fract(t/4)*fract(t/4) : 0)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(4*t)<.83)*(fract(t/4)<.105 ? 1 : ((floor(4*t)%4==0 ? .94 : floor(4*t)%2==0 ? .76 : .58)))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 50,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 70,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "broken-waltz",
    name: "Broken Waltz",
    group: "callresponse",
    description: "A three-against-four waltz: oom-pah-pah inside an unbroken four-beat anchor, with a turn every fourth bar.",
    formula: "y = ((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((fract(3*t/4)<.33 ? -14+4*exp(-10*fract(3*t/4)*3) : -4+pick(floor(3*t)%6,0,3,7,10,7,3)+2*sin(6.28318530718*fract(3*t/4))) - 3*(floor(t/4)%4==3))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.64*sin(tau*p)+0.29*sin(2*tau*p)+0.09*sin(5*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.14,
      send: 0.29,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.005,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((fract(3*t/4)<.33 ? -14+4*exp(-10*fract(3*t/4)*3) : -4+pick(floor(3*t)%6,0,3,7,10,7,3)+2*sin(6.28318530718*fract(3*t/4))) - 3*(floor(t/4)%4==3))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(3*t)<.79)*(fract(t/4)<.105 ? 1 : ((fract(3*t/4)<.30 ? .91 : fract(3*t/4)<.68 ? .65 : .48)))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 50,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 70,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "voltage-passacaglia",
    name: "Voltage Passacaglia",
    group: "callresponse",
    description: "A four-beat ground bass under counter-lines that change their relationship every two bars.",
    formula: "y = ((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((fract(t/4)<.55 ? -19+pick(floor(fract(t/4)*8)%4,0,3,7,10) + 4*exp(-16*fract(2*t)) : -5+pick((floor(4*t)+2*floor(t/8))%7,0,2,3,5,7,8,10) + 2*sin(6.28318530718*fract(t/4)*2)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.78*sin(tau*p)+0.27*sin(2*tau*p)+0.15*sin(3*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.14,
      send: 0.29,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.005,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((fract(t/4)<.55 ? -19+pick(floor(fract(t/4)*8)%4,0,3,7,10) + 4*exp(-16*fract(2*t)) : -5+pick((floor(4*t)+2*floor(t/8))%7,0,2,3,5,7,8,10) + 2*sin(6.28318530718*fract(t/4)*2)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(2*t)<.79)*(fract(t/4)<.105 ? 1 : ((fract(t/4)<.55 ? (fract(2*t)<.82 ? .81 : .18) : (floor(4*t)%2==0 ? .71 : .51))))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 50,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 70,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "three-shadows",
    name: "Three Shadows",
    group: "callresponse",
    description: "A three-part canon: a melodic seed enters on three offset beats, each time in a new register and curve.",
    formula: "y = ((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((-12+pick((floor(4*t-floor(fract(t/4)*3)*3)+floor(t/16))%7,0,2,3,5,7,8,10) + 5*floor(fract(t/4)*3) - 4*fract(4*t) + 1.5*sin(6.28318530718*fract(t/4)*3)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.75*sin(tau*p)+0.20*sin(2*tau*p)+0.12*sin(3*tau*p)+0.08*sin(6*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.11,
      send: 0.29,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.005,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((-12+pick((floor(4*t-floor(fract(t/4)*3)*3)+floor(t/16))%7,0,2,3,5,7,8,10) + 5*floor(fract(t/4)*3) - 4*fract(4*t) + 1.5*sin(6.28318530718*fract(t/4)*3)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(3*t)<.76)*(fract(t/4)<.105 ? 1 : ((floor(fract(t/4)*3)==0 ? .82 : floor(fract(t/4)*3)==1 ? .72 : .61) * (fract(4*t)<.78)))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 50,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 70,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "clockwork-requiem",
    name: "Clockwork Requiem",
    group: "callresponse",
    description: "Eight bars of story: a grave low opening, counterpoint, a sweeping melody, then a driving toccata to a clear cadence.",
    formula: "y = ((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((floor(t/4)<2 ? -17+7*sin(3.14159265359*fract(t/4))+4*exp(-10*fract(t)) : floor(t/4)<4 ? -8+pick((floor(4*t)+floor(t/4))%7,0,2,3,5,7,8,10)+2*exp(-10*fract(4*t)) : floor(t/4)<6 ? -5+12*sin(3.14159265359*fract(t/4)) - 7*fract(t/4) : -9+pick((2*floor(4*t)+floor(t/4))%7,0,3,5,7,10,12,15)+4*exp(-15*fract(4*t)) - 7*(floor(t/4)==7)*fract(t/4)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.66*sin(tau*p)+0.24*sin(2*tau*p)+0.18*sin(3*tau*p)+0.07*sin(5*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.005,
      release: 0.19,
      send: 0.29,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.005,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.105 ? (-25+29*exp(-25*fract(t/4))) : ((floor(t/4)<2 ? -17+7*sin(3.14159265359*fract(t/4))+4*exp(-10*fract(t)) : floor(t/4)<4 ? -8+pick((floor(4*t)+floor(t/4))%7,0,2,3,5,7,8,10)+2*exp(-10*fract(4*t)) : floor(t/4)<6 ? -5+12*sin(3.14159265359*fract(t/4)) - 7*fract(t/4) : -9+pick((2*floor(4*t)+floor(t/4))%7,0,3,5,7,10,12,15)+4*exp(-15*fract(4*t)) - 7*(floor(t/4)==7)*fract(t/4)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "((floor(t/4)<2 ? fract(t)<.90 : floor(t/4)<4 ? fract(2*t)<.85 : floor(t/4)<6 ? fract(t/2)<.93 : fract(4*t)<.82))*(fract(t/4)<.105 ? 1 : ((floor(t/4)<2 ? .70 : floor(t/4)<4 ? (floor(4*t)%2==0 ? .89 : .62) : floor(t/4)<6 ? .76 : (floor(4*t)%3==0 ? .98 : .73))))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 50,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 70,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "subway-oracle",
    name: "Subway Oracle",
    group: "callresponse",
    description: "Kick-and-bass calls answered by rising chirps, then syncopated falling fifths: a conversational groove.",
    formula: "y = (t < 4 ? (fract(t/2)<0.11 ? -2.0+2.1*exp(-25*fract(t/2)) : fract(2*t)<0.24 ? -0.85+0.72*exp(-16*fract(2*t)) : -1.7+0.12*sin(6.28318530718*(t/2))) : (floor((t-4)/2)%2==0 ? -1.65+2.25*exp(-11*fract(2*(t-4)))+0.36*sin(6.28318530718*((t-4)/3)) : 0.35 + 0.58*floor(5*fract((t-4)/3)) -1.25*exp(-12*fract(4*(t-4))) +0.19*sin(6.28318530718*((t-4)/5))))",
    track: {
      steps: 96,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.9*sin(tau*p)+0.3*sin(2*tau*p)+0.14*sin(3*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.004,
      release: 0.075,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(t < 4 ? (fract(t/2)<0.11 ? -2.0+2.1*exp(-25*fract(t/2)) : fract(2*t)<0.24 ? -0.85+0.72*exp(-16*fract(2*t)) : -1.7+0.12*sin(6.28318530718*(t/2))) : (floor((t-4)/2)%2==0 ? -1.65+2.25*exp(-11*fract(2*(t-4)))+0.36*sin(6.28318530718*((t-4)/3)) : 0.35 + 0.58*floor(5*fract((t-4)/3)) -1.25*exp(-12*fract(4*(t-4))) +0.19*sin(6.28318530718*((t-4)/5))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "(fract(t/0.25)<0.84)*(t<4 ? (fract(t/2)<0.13 ? 0.95 : fract(2*t)<0.28 ? 0.60 : 0.20) : floor((t-4)/2)%2==0 ? (fract(2*t)<0.40 ? 0.93 : 0.16) : (fract(4*t)<0.78 ? 0.70 : 0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 290,
              y: 40,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 80,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "bronze-rain",
    name: "Bronze Rain",
    group: "callresponse",
    description: "A resonant bell-and-sub hybrid: high falling chimes answer syncopated low impacts, with real silence between.",
    formula: "y = (t<4 ? (fract(t/2)<0.14 ? -2.15+2.9*exp(-25*fract(t/2)) : -1.7) : (floor((t-4)/2)%3==2 ? (0.8+1.9*exp(-7*fract((t-4)/2))*sin(6.28318530718*(7*(t-4)))) : (-1.8+2.2*exp(-18*fract(2*(t-4)))+0.14*sin(6.28318530718*((t-4)/3)))))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.67*sin(tau*p)+0.42*sin(2*tau*p)+0.18*sin(3*tau*p)+0.10*sin(6*tau*p)",
      sliders: [],
      volume: 0.75,
      pan: 0,
      attack: 0.004,
      release: 0.075,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(t<4 ? (fract(t/2)<0.14 ? -2.15+2.9*exp(-25*fract(t/2)) : -1.7) : (floor((t-4)/2)%3==2 ? (0.8+1.9*exp(-7*fract((t-4)/2))*sin(6.28318530718*(7*(t-4)))) : (-1.8+2.2*exp(-18*fract(2*(t-4)))+0.14*sin(6.28318530718*((t-4)/3)))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "(fract(t/0.25)<.82)*(t<4 ? (fract(t/2)<.19 ? .96 : 0) : (floor((t-4)/2)%3==2 ? (fract((t-4)/2)<.72 ? .78 : 0) : (fract(2*(t-4))<.38 ? .94 : 0)))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 290,
              y: 40,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 80,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "seventh-stair",
    name: "Seventh Stair",
    group: "callresponse",
    description: "VI–VII–V–i climbing a minor staircase; every fourth bar inverts, and notes arrive on exponential curves.",
    formula: "y = ((floor(4*t)%16==0)?(((8)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(7)*(floor(t/4)%4==2)+(0)*(floor(t/4)%4==3))-19):(((8)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(7)*(floor(t/4)%4==2)+(0)*(floor(t/4)%4==3))+(floor(12*((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))%7)/7)+((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))%7==1)+((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))%7==4)+12*floor((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))/7))+(12*(floor(4*t)%16%8==7))+(0)+(1.55*exp(-13*fract(4*t))-0.12*sin(6.2831853*fract(4*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.76*sin(tau*p)+0.23*sin(2*tau*p)+0.11*sin(3*tau*p)+0.05*sin(5*tau*p)",
      sliders: [],
      volume: 0.73,
      pan: 0,
      attack: 0.004,
      release: 0.12,
      send: 0.31,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.008,
      graph: {
        nodes: [
          {
            id: "y",
            type: "expr",
            position: {
              x: 0,
              y: 10,
            },
            data: {
              formula: "((floor(4*t)%16==0)?(((8)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(7)*(floor(t/4)%4==2)+(0)*(floor(t/4)%4==3))-19):(((8)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(7)*(floor(t/4)%4==2)+(0)*(floor(t/4)%4==3))+(floor(12*((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))%7)/7)+((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))%7==1)+((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))%7==4)+12*floor((((2*floor(4*t)%16+floor(floor(4*t)%16/4)+2*(floor(t/4)%8%4==3))%7))/7))+(12*(floor(4*t)%16%8==7))+(0)+(1.55*exp(-13*fract(4*t))-0.12*sin(6.2831853*fract(4*t)))))/12",
            },
          },
          {
            id: "gate",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(.80)*((floor(4*t)%16%4!=3||floor(t/4)%8%4==3))*(fract(4*t)<0.83)*((0.94-0.16*(floor(4*t)%16%4==2)))",
            },
          },
          {
            id: "semitones",
            type: "math",
            position: {
              x: 320,
              y: 15,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "y.out-semitones.a",
            source: "y",
            sourceHandle: "out",
            target: "semitones",
            targetHandle: "a",
          },
          {
            id: "semitones.out-out.pitch",
            source: "semitones",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "gate.out-out.velocity",
            source: "gate",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "iron-lullaby",
    name: "Iron Lullaby",
    group: "callresponse",
    description: "Slow call and response: an octave-drop bass, three suspended melody notes and a late falling bell.",
    formula: "y = ((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(8)*(floor(t/4)%4==1)+(3)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(8)*(floor(t/4)%4==1)+(3)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))+(floor(12*((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))%7)/7)+((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))%7==1)+((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))%7==4)+12*floor((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))/7))+(12*(floor(4*t)%16==9))+(0)+((floor(4*t)%16==13)*(-3.2*(1-exp(-8*fract(4*t))))+0.65*exp(-14*fract(4*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.84*sin(tau*p)+0.15*sin(2*tau*p)+0.08*sin(4*tau*p)",
      sliders: [],
      volume: 0.73,
      pan: 0,
      attack: 0.011,
      release: 0.33,
      send: 0.42,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.008,
      graph: {
        nodes: [
          {
            id: "y",
            type: "expr",
            position: {
              x: 0,
              y: 10,
            },
            data: {
              formula: "((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(8)*(floor(t/4)%4==1)+(3)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(8)*(floor(t/4)%4==1)+(3)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))+(floor(12*((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))%7)/7)+((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))%7==1)+((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))%7==4)+12*floor((((floor(floor(4*t)%16/3)+2*floor(floor(t/4)%8/2))%7))/7))+(12*(floor(4*t)%16==9))+(0)+((floor(4*t)%16==13)*(-3.2*(1-exp(-8*fract(4*t))))+0.65*exp(-14*fract(4*t)))))/12",
            },
          },
          {
            id: "gate",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(.76)*((floor(4*t)%16==0||floor(4*t)%16==4||floor(4*t)%16==9||floor(4*t)%16==13))*(fract(4*t)<0.94)*(1)",
            },
          },
          {
            id: "semitones",
            type: "math",
            position: {
              x: 320,
              y: 15,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "y.out-semitones.a",
            source: "y",
            sourceHandle: "out",
            target: "semitones",
            targetHandle: "a",
          },
          {
            id: "semitones.out-out.pitch",
            source: "semitones",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "gate.out-out.velocity",
            source: "gate",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "cathedral-ratchet",
    name: "Cathedral Ratchet",
    group: "callresponse",
    description: "Asymmetric 3–3–2 accents over a turning minor progression, with one escalating ratchet in the eighth bar.",
    formula: "y = ((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(5)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(5)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))+(floor(12*((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))%7)/7)+((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))%7==1)+((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))%7==4)+12*floor((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))/7))+(12*(floor(4*t)%16>=10&&floor(t/4)%8%4==3))+(0)+(1.9*exp(-19*fract(4*t))-0.35*sin(12.56637*fract(4*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p)+0.29*sin(2*tau*p)+0.15*sin(3*tau*p)+0.08*sin(6*tau*p)",
      sliders: [],
      volume: 0.73,
      pan: 0,
      attack: 0.004,
      release: 0.12,
      send: 0.15,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.008,
      graph: {
        nodes: [
          {
            id: "y",
            type: "expr",
            position: {
              x: 0,
              y: 10,
            },
            data: {
              formula: "((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(5)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(5)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))+(floor(12*((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))%7)/7)+((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))%7==1)+((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))%7==4)+12*floor((((3*floor(floor(4*t)%16/2)+2*floor(t/4)%8+floor(floor(4*t)%16/5))%7))/7))+(12*(floor(4*t)%16>=10&&floor(t/4)%8%4==3))+(0)+(1.9*exp(-19*fract(4*t))-0.35*sin(12.56637*fract(4*t)))))/12",
            },
          },
          {
            id: "gate",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(.85)*((floor(4*t)%16%8==0||floor(4*t)%16%8==3||floor(4*t)%16%8==6||(floor(t/4)%8%4==3&&floor(4*t)%16%2==1)))*(fract(4*t)<0.78)*(1)",
            },
          },
          {
            id: "semitones",
            type: "math",
            position: {
              x: 320,
              y: 15,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "y.out-semitones.a",
            source: "y",
            sourceHandle: "out",
            target: "semitones",
            targetHandle: "a",
          },
          {
            id: "semitones.out-out.pitch",
            source: "semitones",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "gate.out-out.velocity",
            source: "gate",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "glass-fugue",
    name: "Glass Fugue",
    group: "callresponse",
    description: "Every second bar mirrors the scale movement; low questions alternate with higher imitative answers.",
    formula: "y = ((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))+(floor(12*(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))%7)/7)+(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))%7==1)+(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))%7==4)+12*floor(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))/7))+(12*(floor(4*t)%16%8>=4))+(0)+((floor(4*t)%16%8>=4)*(-1.6*exp(-9*fract(4*t)))+0.55*exp(-20*fract(4*t)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.66*sin(tau*p)+0.27*sin(2*tau*p)+0.17*sin(4*tau*p)+0.07*sin(7*tau*p)",
      sliders: [],
      volume: 0.73,
      pan: 0,
      attack: 0.004,
      release: 0.17,
      send: 0.39,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.008,
      graph: {
        nodes: [
          {
            id: "y",
            type: "expr",
            position: {
              x: 0,
              y: 10,
            },
            data: {
              formula: "((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(10)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(7)*(floor(t/4)%4==3))+(floor(12*(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))%7)/7)+(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))%7==1)+(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))%7==4)+12*floor(((((floor(t/4)%8%2==0)?((3*floor(4*t)%16+floor(floor(4*t)%16/4))%7):(((18-3*floor(4*t)%16-floor(floor(4*t)%16/4))%7+7)%7))))/7))+(12*(floor(4*t)%16%8>=4))+(0)+((floor(4*t)%16%8>=4)*(-1.6*exp(-9*fract(4*t)))+0.55*exp(-20*fract(4*t)))))/12",
            },
          },
          {
            id: "gate",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(.74)*((floor(4*t)%16%4!=2&&floor(4*t)%16!=15))*(fract(4*t)<0.82)*(1)",
            },
          },
          {
            id: "semitones",
            type: "math",
            position: {
              x: 320,
              y: 15,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "y.out-semitones.a",
            source: "y",
            sourceHandle: "out",
            target: "semitones",
            targetHandle: "a",
          },
          {
            id: "semitones.out-out.pitch",
            source: "semitones",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "gate.out-out.velocity",
            source: "gate",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "silver-triplets",
    name: "Silver Triplets",
    group: "callresponse",
    description: "Bell-like triplets against four, above a heavy sub on beat one, resolving into stable minor intervals.",
    formula: "y = ((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(3)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(10)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(3)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(10)*(floor(t/4)%4==3))+(floor(12*((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))%7)/7)+((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))%7==1)+((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))%7==4)+12*floor((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))/7))+(12*(floor(3*t)%6==5))+(0)+((0.9*exp(-11*fract(3*t))-0.3*sin(6.2831853*fract(3*t))))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.86*sin(tau*p)+0.12*sin(3*tau*p)+0.065*sin(5*tau*p)",
      sliders: [],
      volume: 0.73,
      pan: 0,
      attack: 0.004,
      release: 0.19,
      send: 0.35,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.008,
      graph: {
        nodes: [
          {
            id: "y",
            type: "expr",
            position: {
              x: 0,
              y: 10,
            },
            data: {
              formula: "((floor(4*t)%16==0)?(((0)*(floor(t/4)%4==0)+(3)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(10)*(floor(t/4)%4==3))-19):(((0)*(floor(t/4)%4==0)+(3)*(floor(t/4)%4==1)+(8)*(floor(t/4)%4==2)+(10)*(floor(t/4)%4==3))+(floor(12*((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))%7)/7)+((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))%7==1)+((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))%7==4)+12*floor((((2*floor(3*t)+floor(t/4)+floor(3*t/4))%7))/7))+(12*(floor(3*t)%6==5))+(0)+((0.9*exp(-11*fract(3*t))-0.3*sin(6.2831853*fract(3*t))))))/12",
            },
          },
          {
            id: "gate",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(.71)*((floor(4*t)%16==0||(floor(3*t)%3!=1)))*(fract(3*t)<0.73)*(1)",
            },
          },
          {
            id: "semitones",
            type: "math",
            position: {
              x: 320,
              y: 15,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "y.out-semitones.a",
            source: "y",
            sourceHandle: "out",
            target: "semitones",
            targetHandle: "a",
          },
          {
            id: "semitones.out-out.pitch",
            source: "semitones",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "gate.out-out.velocity",
            source: "gate",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "stone-velocity",
    name: "Stone Velocity",
    group: "curves",
    description: "Rhythm from the slope: where the curve falls steeply it hits hard, where it flattens it ghosts.",
    formula: "y = -0.52+0.95*exp(-8*pow(fract((t+0.16*sin(6.283185307179586*t/6))/3)-0.25,2))+0.12*sin(6.283185307179586*t/7)",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+2.8*sin(tau*p)+0.8*sin(3*tau*p))",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.002,
      release: 0.13,
      send: 0.13,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "-0.52+0.95*exp(-8*pow(fract((t+0.16*sin(6.283185307179586*t/6))/3)-0.25,2))+0.12*sin(6.283185307179586*t/7)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "(fract(t/0.25)<0.91)*(0.22+0.66*(abs(cos(6.283185307179586*t/3))>0.7))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 55,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "attractor",
    name: "Attractor",
    group: "curves",
    description: "Harmonic gravity: smooth plateaus with an elastic wobble that dies into each target note.",
    formula: "y = round(3.4*sin(6.283185307179586*t/13))/6+0.28*sin(6.283185307179586*t/2.7)*exp(-5*fract(t/1.5))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.65*sin(tau*p)+0.3*sin(2*tau*p)+0.12*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.018,
      release: 0.33,
      send: 0.36,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "round(3.4*sin(6.283185307179586*t/13))/6+0.28*sin(6.283185307179586*t/2.7)*exp(-5*fract(t/1.5))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "0.73*(fract(t/0.25)<0.9)*(0.66+0.3*(floor(4*t)%6==0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 55,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "borrowed-seconds",
    name: "Borrowed Seconds",
    group: "curves",
    description: "Bent time: twin saws drift apart as their phase is pushed, then lock back together.",
    formula: "y = 0.65*(fract((t+0.55*sin(6.283185307179586*t/7))/3)-fract((t+0.55*sin(6.283185307179586*t/7))/5))+0.13*sin(6.283185307179586*t/9)",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.25,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.7*sin(tau*p+1.2*sin(2*tau*p))+0.22*sin(3*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.004,
      release: 0.11,
      send: 0.36,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "0.65*(fract((t+0.55*sin(6.283185307179586*t/7))/3)-fract((t+0.55*sin(6.283185307179586*t/7))/5))+0.13*sin(6.283185307179586*t/9)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "0.78*(fract(t/0.25)<0.87)*(0.63+0.34*(floor(4*t)%7<2))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 55,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "avalanche-talk",
    name: "Avalanche Talk",
    group: "curves",
    description: "Call and response in two-beat halves: falls, then airborne returns.",
    formula: "y = (floor(t/2)%2==0 ? -0.7+1.4*exp(-7*fract(t/2))+0.12*sin(6.283185307179586*t/5) : 0.18+0.58*(1-cos(6.283185307179586*fract(t/2)))/2-0.18*fract(t/2))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.68*sin(tau*p+1.9*sin(tau*p))+0.22*sin(3*tau*p)+0.09*sin(7*tau*p)",
      sliders: [],
      volume: 0.72,
      pan: 0,
      attack: 0.003,
      release: 0.14,
      send: 0.13,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t/2)%2==0 ? -0.7+1.4*exp(-7*fract(t/2))+0.12*sin(6.283185307179586*t/5) : 0.18+0.58*(1-cos(6.283185307179586*fract(t/2)))/2-0.18*fract(t/2))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "(fract(t/0.25)<0.9)*((floor(t/2)%2==0)?0.79*(0.45+0.55*(floor(4*t)%4==0)):0.71*(0.45+0.55*(floor(4*t)%4==2)))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 55,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "machine-weather",
    name: "Machine Weather",
    group: "curves",
    description: "Shape morphing, bent time, harmonic targets and accents that follow the curve, all at once.",
    formula: "y = (0.5+0.5*sin(6.283185307179586*t/16))*(0.75*(fract((t+0.35*sin(6.283185307179586*t/9))/3)-fract((t+0.35*sin(6.283185307179586*t/9))/7)))+(0.5-0.5*sin(6.283185307179586*t/16))*(round(2*sin(6.283185307179586*t/5))*7/12+0.33*exp(-9*fract(t/2)))-0.14",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.65*sin(tau*p+3*sin(2*tau*p+0.5*sin(5*tau*p)))+0.23*sin(tau*p)+0.12*sin(7*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.004,
      release: 0.17,
      send: 0.13,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(0.5+0.5*sin(6.283185307179586*t/16))*(0.75*(fract((t+0.35*sin(6.283185307179586*t/9))/3)-fract((t+0.35*sin(6.283185307179586*t/9))/7)))+(0.5-0.5*sin(6.283185307179586*t/16))*(round(2*sin(6.283185307179586*t/5))*7/12+0.33*exp(-9*fract(t/2)))-0.14",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "(fract(t/0.25)<0.89)*(0.22+0.62*(abs(cos(6.283185307179586*t/3))>0.48||floor(4*t)%16==0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 300,
              y: 55,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "elastic-continuum",
    name: "Elastic Continuum",
    group: "curves",
    description: "A slowly breathing time axis stretches and squeezes interlocking arcs: broad slides and double-speed crests.",
    formula: "y = 0.65*sin(6.283185307179586*(t+0.72*sin(6.283185307179586*t/5))/4)+0.20*sin(6.283185307179586*(t+0.72*sin(6.283185307179586*t/5))/1.25)",
    track: {
      steps: 96,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.80*sin(tau*p)+0.26*sin(2*tau*p+0.35*sin(tau*p))+0.10*sin(4*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.008,
      release: 0.24,
      send: 0.13,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "0.65*sin(6.283185307179586*(t+0.72*sin(6.283185307179586*t/5))/4)+0.20*sin(6.283185307179586*(t+0.72*sin(6.283185307179586*t/5))/1.25)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "0.73*(fract(t/0.25)<0.90)*(0.68+0.32*(cos(6.283185307179586*t/5)>0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 80,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 100,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "harmonic-undertow",
    name: "Harmonic Undertow",
    group: "curves",
    description: "A deep anchor pulled up and down by slow and fast waves, briefly landing near stable notes.",
    formula: "y = 0.50*sin(6.283185307179586*(t+0.78*sin(6.283185307179586*t/6))/6)+0.22*sin(6.283185307179586*(t+0.78*sin(6.283185307179586*t/6))/2)+0.10*sin(6.283185307179586*t/12)",
    track: {
      steps: 96,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.88*sin(tau*p+0.24*sin(2*tau*p))+0.18*sin(3*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.008,
      release: 0.18,
      send: 0.13,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "0.50*sin(6.283185307179586*(t+0.78*sin(6.283185307179586*t/6))/6)+0.22*sin(6.283185307179586*(t+0.78*sin(6.283185307179586*t/6))/2)+0.10*sin(6.283185307179586*t/12)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "0.79*(fract(t/0.25)<0.91)*(0.65+0.35*(abs(sin(6.283185307179586*t/6))>0.55))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 80,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 100,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "event-horizon",
    name: "Event Horizon",
    group: "curves",
    description: "A long bass sweep cut by a fast chirp that itself speeds up as time stretches and contracts.",
    formula: "y = 0.70*sin(6.283185307179586*(t+0.87*sin(6.283185307179586*t/7))/9)+0.24*sin(6.283185307179586*(t+0.87*sin(6.283185307179586*t/7))*(0.21+0.008*t))+0.10*sin(6.283185307179586*t/3)",
    track: {
      steps: 96,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.88*sin(tau*p+0.24*sin(2*tau*p))+0.18*sin(3*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.008,
      release: 0.25,
      send: 0.13,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "0.70*sin(6.283185307179586*(t+0.87*sin(6.283185307179586*t/7))/9)+0.24*sin(6.283185307179586*(t+0.87*sin(6.283185307179586*t/7))*(0.21+0.008*t))+0.10*sin(6.283185307179586*t/3)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 250,
            },
            data: {
              formula: "0.78*(fract(t/0.25)<0.90)*(0.65+0.35*(cos(6.283185307179586*t/9)>0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 80,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 600,
              y: 100,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "higher-stair",
    name: "Higher Stair",
    group: "curves",
    description: "A strict staircase each bar: rising on the second beat, letting go on the fourth, turning round every four bars.",
    formula: "y = ((fract(t/2)<0.105 ? -23+26*exp(-25*fract(t/2)) : -15+3*floor(4*fract(t/4))+5*exp(-15*fract(4*t))-(floor(t)%4==3 ? 8*fract(t) : 0)+2*(floor(t/4)%4==3)))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.48*sin(2*tau*p)+0.17*sin(5*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.004,
      release: 0.1,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<0.105 ? -23+26*exp(-25*fract(t/2)) : -15+3*floor(4*fract(t/4))+5*exp(-15*fract(4*t))-(floor(t)%4==3 ? 8*fract(t) : 0)+2*(floor(t/4)%4==3)))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/0.25)<.84)*(fract(t/2)<.14 ? .95 : fract(4*t)<.81 ? (.65+.15*(floor(4*t)%4==0)) : 0)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "counterweight",
    name: "Counterweight",
    group: "curves",
    description: "A lift: up on beats 1–2, hang on 3, down on 4, with a bass thump as each bar opens.",
    formula: "y = ((fract(t/4)<.08 ? -25+28*exp(-28*fract(t)) : fract(t/4)<.5 ? -15+24*(1-exp(-5*fract(t/4)*2)) : fract(t/4)<.74 ? 7+1.3*sin(6.28318530718*fract(t/4)*4) : 8-26*(1-exp(-7*(fract(t/4)-.74)*4))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.28*sin(2*tau*p)+0.13*sin(3*tau*p)",
      sliders: [],
      volume: 0.79,
      pan: 0,
      attack: 0.012,
      release: 0.23,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/4)<.08 ? -25+28*exp(-28*fract(t)) : fract(t/4)<.5 ? -15+24*(1-exp(-5*fract(t/4)*2)) : fract(t/4)<.74 ? 7+1.3*sin(6.28318530718*fract(t/4)*4) : 8-26*(1-exp(-7*(fract(t/4)-.74)*4))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.88)*(fract(t/4)<.11 ? .98 : fract(t/4)<.75 ? .68 : .82)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "nested-fracture",
    name: "Nested Fracture",
    group: "curves",
    description: "Two nested falls each bar: a slow four-beat drop full of small one-beat collapses.",
    formula: "y = ((fract(t/2)<.10 ? -24+28*exp(-25*fract(t/2)) : 7-17*fract(t/4)-7*fract(t)-3*fract(4*t)+3*exp(-20*fract(4*t))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.49*sin(2*tau*p)+0.16*sin(4*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.004,
      release: 0.12,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<.10 ? -24+28*exp(-25*fract(t/2)) : 7-17*fract(t/4)-7*fract(t)-3*fract(4*t)+3*exp(-20*fract(4*t))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.86)*(fract(t/2)<.14 ? .99 : fract(t)<.85 ? .71 : .12)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "recursive-avalanche",
    name: "Recursive Avalanche",
    group: "curves",
    description: "Nested curves on three scales: a big fall made of smaller repeating falls and fine chirps.",
    formula: "y = (t<4 ? (fract(t/2)<0.13 ? -2.0+2.7*exp(-23*fract(t/2)) : -.85 + .12*sin(6.28318530718*(t))) : (0.9-1.75*fract((t-4)/6)-.79*fract((t-4)/1.5)-.26*fract(4*(t-4))+0.25*exp(-13*fract(4*(t-4)))))",
    track: {
      steps: 96,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 2,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.92*sin(tau*p)+0.29*sin(2*tau*p)+0.14*sin(3*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.004,
      release: 0.075,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(t<4 ? (fract(t/2)<0.13 ? -2.0+2.7*exp(-23*fract(t/2)) : -.85 + .12*sin(6.28318530718*(t))) : (0.9-1.75*fract((t-4)/6)-.79*fract((t-4)/1.5)-.26*fract(4*(t-4))+0.25*exp(-13*fract(4*(t-4)))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "(fract(t/0.25)<.86)*(t<4 ? (fract(t/2)<.2 ? .95 : .28) : (fract((t-4)/1.5)<.84 ? .82 : .18))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 290,
              y: 40,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 80,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "parallax-debt",
    name: "Parallax Debt",
    group: "curves",
    description: "Two unequal ramps interfere; a gentle sine rounds their corners into a drifting 3:7 groove.",
    formula: "y = 0.78*(fract(t/3)-fract(t/7))+0.13*sin(6.28318530718*t/7)",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.25,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.38*sin(2*tau*p)+0.14*sin(3*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.004,
      release: 0.19,
      send: 0.19,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "0.78*(fract(t/3)-fract(t/7))+0.13*sin(6.28318530718*t/7)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "0.78*(fract(t/0.25)<0.87)*(0.72+0.28*(floor(4*t)%4==0))",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 87,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 120,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "residual-gravity",
    name: "Residual Gravity",
    group: "curves",
    description: "Curved reciprocal falls whose depth narrows over a seven-beat cycle.",
    formula: "y = -0.75+(0.55+0.24*sin(6.28318530718*t/7))/(1+9*fract(t/2))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+0.6*sin(tau*p))+0.18*sin(3*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.004,
      release: 0.19,
      send: 0.19,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "-0.75+(0.55+0.24*sin(6.28318530718*t/7))/(1+9*fract(t/2))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "0.86*(fract(t/0.25)<0.89)*(0.85+0.15*(floor(4*t)%4==0))",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 87,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 120,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "collapse-axiom",
    name: "Collapse Axiom",
    group: "curves",
    description: "A pair of exponential dives that flip every four beats, so gravity reverses.",
    formula: "y = (1-2*(floor(t/4)%2))*(0.56*exp(-7*fract(t/2))-0.29)+0.12*sin(6.28318530718*t/8)",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.32*sin(2*tau*p)+0.19*sin(7*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.004,
      release: 0.19,
      send: 0.19,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(1-2*(floor(t/4)%2))*(0.56*exp(-7*fract(t/2))-0.29)+0.12*sin(6.28318530718*t/8)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "0.84*(fract(t/0.25)<0.88)*(floor(4*t)%8!=6)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 87,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 120,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "alien-riddim",
    name: "Alien Riddim",
    group: "rave",
    description: "An alien bass riff: a 5-in-16 Euclidean pulse, angular semitone jumps, plucked pitch and 1/64 glitch bursts at the phrase ends.",
    formula: "y = (floor(t)%8==7 && fract(16*t)<0.65) ? (0.6+0.6*exp(-32*fract(16*t))) : ((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) && fract(4*t)<0.8) ? ((-12+5*(floor(4*t)%5)+7*(floor(t/4)%2))/12 + 0.24*exp(-10*fract(4*t)) + 0.05*sin(6.2831853*fract(4*t))) : 0",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.69*sin(tau*p+4.6*sin(2*tau*p+1.7*sin(7*tau*p)))+0.22*sin(9*tau*p+1.3*sin(3*tau*p))+0.09*sin(15*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.003,
      release: 0.16,
      send: 0.29,
      swing: 0.17,
      playMode: "glide",
      quantize: false,
      glide: 0.011,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==7 && fract(16*t)<0.65) ? (0.6+0.6*exp(-32*fract(16*t))) : ((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) && fract(4*t)<0.8) ? ((-12+5*(floor(4*t)%5)+7*(floor(t/4)%2))/12 + 0.24*exp(-10*fract(4*t)) + 0.05*sin(6.2831853*fract(4*t))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 18,
            },
            data: {
              formula: "(floor(t)%8==7 && fract(16*t)<0.65) ? (0.52+0.18*(floor(16*t)%2==0)) : ((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) && fract(4*t)<0.8) ? (0.47+0.23*(floor(4*t)%4==3)+0.12*(floor(t/4)%2)) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 35,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 68,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "acid-serpent",
    name: "Acid Serpent",
    group: "rave",
    description: "A dense 11-in-16 acid line with accents, plucked pitch and a register shift every two bars.",
    formula: "y = ((floor(11*(((floor(4*t)+0)%16)+1)/16)>floor(11*((floor(4*t)+0)%16)/16)) && fract(4*t)<0.82) ? ((-12+3*(floor(4*t)%5)+12*(floor(t/8)%2))/12+0.12*exp(-14*fract(4*t))+0.03*sin(6.2831853*fract(4*t))) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p+2.1*sin(tau*p)+0.8*sin(3*tau*p))+0.21*sin(5*tau*p)+0.07*sin(9*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.002,
      release: 0.13,
      send: 0.12,
      swing: 0.1,
      playMode: "glide",
      quantize: false,
      glide: 0.023,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(11*(((floor(4*t)+0)%16)+1)/16)>floor(11*((floor(4*t)+0)%16)/16)) && fract(4*t)<0.82) ? ((-12+3*(floor(4*t)%5)+12*(floor(t/8)%2))/12+0.12*exp(-14*fract(4*t))+0.03*sin(6.2831853*fract(4*t))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 18,
            },
            data: {
              formula: "((floor(11*(((floor(4*t)+0)%16)+1)/16)>floor(11*((floor(4*t)+0)%16)/16)) && fract(4*t)<0.82) ? (0.46+0.35*(floor(4*t)%8==3 || floor(4*t)%8==7)+0.13*(floor(t/4)%4==3)) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 35,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 68,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "glitch-riot",
    name: "Glitch Riot",
    group: "rave",
    description: "A pseudo-random gate over a 5-in-16 Euclid: swept hits, and 1/64 cluster rolls closing every other phrase.",
    formula: "y = (floor(4*t)%32>=28 && fract(16*t)<0.52) ? (-0.8+2.2*exp(-28*fract(16*t))) : (((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) || (fract(sin((floor(4*t)+211)*9.719)*43758.5453)<0.27)) && fract(4*t)<0.58) ? (-1.35+1.65*exp(-22*fract(4*t))+0.38*(floor(4*t)%3==0)) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.71*sin(tau*p+2.2*sin(3*tau*p))+0.2*sin(7*tau*p)+0.09*sin(13*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.001,
      release: 0.065,
      send: 0.14,
      swing: 0.06,
      playMode: "glide",
      quantize: false,
      glide: 0.001,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(4*t)%32>=28 && fract(16*t)<0.52) ? (-0.8+2.2*exp(-28*fract(16*t))) : (((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) || (fract(sin((floor(4*t)+211)*9.719)*43758.5453)<0.27)) && fract(4*t)<0.58) ? (-1.35+1.65*exp(-22*fract(4*t))+0.38*(floor(4*t)%3==0)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 18,
            },
            data: {
              formula: "(floor(4*t)%32>=28 && fract(16*t)<0.52) ? (0.47+0.17*(floor(16*t)%2==0)) : (((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) || (fract(sin((floor(4*t)+211)*9.719)*43758.5453)<0.27)) && fract(4*t)<0.58) ? (0.52+0.35*fract(sin((floor(4*t)+211)*9.719)*43758.5453)) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 35,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 68,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "breakbeast",
    name: "Breakbeast",
    group: "rave",
    description: "Chopped jungle drums from one oscillator: syncopated kick dives, snare-like mid hits, tick hats and dense rolls at the end.",
    formula: "y = (floor(4*t)%32>=29 && fract(16*t)<0.46) ? (0.6+1.2*exp(-25*fract(16*t))) : (floor(4*t)%16==0 || floor(4*t)%16==7 || floor(4*t)%16==10 || (floor(t/4)%2==1 && floor(4*t)%16==14)) ? (-1.7+2.65*exp(-24*fract(4*t))) : (floor(4*t)%16==4 || floor(4*t)%16==12) ? (0.32+0.56*exp(-21*fract(4*t))) : (floor(4*t)%2==0 && fract(4*t)<0.32) ? 1.15 : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.56*sin(tau*p+2.7*sin(2*tau*p))+0.28*sin(5*tau*p)+0.16*sin(13*tau*p)",
      sliders: [],
      volume: 0.72,
      pan: 0,
      attack: 0.001,
      release: 0.055,
      send: 0.12,
      swing: 0.11,
      playMode: "glide",
      quantize: false,
      glide: 0.001,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(4*t)%32>=29 && fract(16*t)<0.46) ? (0.6+1.2*exp(-25*fract(16*t))) : (floor(4*t)%16==0 || floor(4*t)%16==7 || floor(4*t)%16==10 || (floor(t/4)%2==1 && floor(4*t)%16==14)) ? (-1.7+2.65*exp(-24*fract(4*t))) : (floor(4*t)%16==4 || floor(4*t)%16==12) ? (0.32+0.56*exp(-21*fract(4*t))) : (floor(4*t)%2==0 && fract(4*t)<0.32) ? 1.15 : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 18,
            },
            data: {
              formula: "(floor(4*t)%32>=29 && fract(16*t)<0.46) ? 0.52 : (floor(4*t)%16==0 || floor(4*t)%16==7 || floor(4*t)%16==10 || (floor(t/4)%2==1 && floor(4*t)%16==14)) ? 0.92 : (floor(4*t)%16==4 || floor(4*t)%16==12) ? 0.84 : (floor(4*t)%2==0 && fract(4*t)<0.32) ? (0.2+0.17*(floor(4*t)%4==2)) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 35,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 68,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "pendulum-cannon",
    name: "Pendulum Cannon",
    group: "rave",
    description: "A slow stomp under a swinging melody, with a two-pulse ratchet at the phrase edge, an exponential fall and curved lifts.",
    formula: "y = ((floor(4*t)%16==14) ? (-8+19*exp(-5*fract(2*fract(4*t)))+4*sin(6.283185307179586*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -16 : (12*floor(((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)/7)+2*(((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)%7)-((((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)%7)>=2)-((((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)%7)>=5))-8))+((floor(4*t)%8==0 ? 30*exp(-11*fract(4*t)) : 3*sin(3.141592653589793*fract(4*t))*sin(3.141592653589793*fract(4*t))-2*exp(-8*fract(4*t)))))",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+3.2*sin(2*tau*p+0.8*sin(5*tau*p)))+0.12*sin(7*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.005,
      release: 0.2,
      send: 0.14,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.022,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%16==14) ? (-8+19*exp(-5*fract(2*fract(4*t)))+4*sin(6.283185307179586*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -16 : (12*floor(((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)/7)+2*(((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)%7)-((((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)%7)>=2)-((((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14)%7)>=5))-8))+((floor(4*t)%8==0 ? 30*exp(-11*fract(4*t)) : 3*sin(3.141592653589793*fract(4*t))*sin(3.141592653589793*fract(4*t))-2*exp(-8*fract(4*t)))))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1,(((floor(4*t)%8==0 || floor(4*t)%8==3 || floor(4*t)%8==6) && floor(4*t)%16!=14)*((floor(4*t)%8==0 ? 0.95 : 0.57+0.09*(floor(4*t)%8==6)))*(fract(4*t)<0.89)+((floor(4*t)%16==14)*(0.62+0.16*(fract(2*fract(4*t))<0.12))*(fract(2*fract(4*t))<0.72))))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "floor(4*t)%8==0 ? 1.7 : 0.72",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 430,
              y: 180,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "ribbon-glissando",
    name: "Ribbon Glissando",
    group: "rave",
    description: "A scale-locked orbit with parabolic note bends and one stuttering turn every two bars.",
    formula: "y = ((floor(4*t)%32==30) ? (10-17*fract(2*fract(4*t))+3*sin(6.283185307179586*fract(2*fract(4*t)))) : ((12*floor(((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)/7)+2*(((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)%7)-((((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)%7)>=2)-((((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)%7)>=5))-10)+(5*sin(3.141592653589793*fract(4*t)/2)*sin(3.141592653589793*fract(4*t)/2)-2.5*exp(-6*fract(4*t))))",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p)+0.21*sin(2*tau*p+0.3*sin(tau*p))+0.12*sin(4*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.014,
      release: 0.32,
      send: 0.14,
      swing: 0.07,
      playMode: "glide",
      quantize: false,
      glide: 0.14,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%32==30) ? (10-17*fract(2*fract(4*t))+3*sin(6.283185307179586*fract(2*fract(4*t)))) : ((12*floor(((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)/7)+2*(((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)%7)-((((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)%7)>=2)-((((floor(5*floor(4*t)/8)+floor(floor(floor(4*t)/16)/2)*3)%21)%7)>=5))-10)+(5*sin(3.141592653589793*fract(4*t)/2)*sin(3.141592653589793*fract(4*t)/2)-2.5*exp(-6*fract(4*t))))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1,(((floor(4*t)%4==0 || floor(4*t)%8==6) && floor(4*t)%32!=30)*(0.53+0.26*(floor(4*t)%8==0)+0.1*sin(0.7*floor(4*t))*sin(0.7*floor(4*t)))*(fract(4*t)<0.89)+((floor(4*t)%32==30)*(0.43+0.19*(fract(2*fract(4*t))<0.2))*(fract(2*fract(4*t))<0.72))))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "1.1+1.2*(floor(4*t)%8==0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 430,
              y: 180,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "euclid-slingshot",
    name: "Euclid Slingshot",
    group: "rave",
    description: "A rotating 5-in-16 Euclid against an anchor every other beat, with a whip-shaped rise and an exponential dive.",
    formula: "y = ((floor(4*t)%32==15) ? (-9+14*exp(-7*fract(2*fract(4*t)))+2*sin(12.566370614359172*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -14 : (12*floor(((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)/7)+2*(((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)%7)-((((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)%7)>=2)-((((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)%7)>=5))-11))+((floor(4*t)%8==0 ? 26*exp(-12*fract(4*t)) : 7*(fract(4*t)*fract(4*t))*(1-fract(4*t))-2*exp(-9*fract(4*t)))))",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+2.7*sin(3*tau*p+0.9*sin(7*tau*p)))+0.1*sin(9*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.005,
      release: 0.19,
      send: 0.14,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.035,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%32==15) ? (-9+14*exp(-7*fract(2*fract(4*t)))+2*sin(12.566370614359172*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -14 : (12*floor(((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)/7)+2*(((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)%7)-((((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)%7)>=2)-((((3*floor(floor(4*t)/2)+floor(floor(4*t)/16))%14)%7)>=5))-11))+((floor(4*t)%8==0 ? 26*exp(-12*fract(4*t)) : 7*(fract(4*t)*fract(4*t))*(1-fract(4*t))-2*exp(-9*fract(4*t)))))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1,((((floor(5*((floor(4*t)+3*floor(floor(4*t)/16))%16+1)/16)>floor(5*((floor(4*t)+3*floor(floor(4*t)/16))%16)/16))||floor(4*t)%8==0) && floor(4*t)%16!=15)*(0.46+0.42*(floor(4*t)%8==0)+0.12*(floor(4*t)%4==3))*(fract(4*t)<0.89)+((floor(4*t)%32==15)*(0.66)*(fract(2*fract(4*t))<0.72))))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "0.78+0.85*(floor(4*t)%8==0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 430,
              y: 180,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "vocal-machine",
    name: "Vocal Machine",
    group: "rave",
    description: "Low–high call and response: mirrored scale runs curve into vowel-like slides, with rare rolls.",
    formula: "y = ((floor(4*t)%16==14) ? (-2+8*sin(3.141592653589793*fract(2*fract(4*t)))+4*exp(-8*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -14 : (12*floor(((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)/7)+2*(((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)%7)-((((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)%7)>=2)-((((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)%7)>=5))-4))+((floor(4*t)%8==0 ? 23*exp(-10*fract(4*t)) : 5*sin(6.283185307179586*fract(4*t))*sin(3.141592653589793*fract(4*t)))))",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.7*sin(tau*p+2.1*sin(tau*p+0.8*sin(3*tau*p)))+0.23*sin(5*tau*p+0.6*sin(tau*p))",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.005,
      release: 0.28,
      send: 0.14,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.075,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%16==14) ? (-2+8*sin(3.141592653589793*fract(2*fract(4*t)))+4*exp(-8*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -14 : (12*floor(((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)/7)+2*(((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)%7)-((((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)%7)>=2)-((((2*floor(floor(4*t)/4)+3*floor(floor(4*t)/16))%14)%7)>=5))-4))+((floor(4*t)%8==0 ? 23*exp(-10*fract(4*t)) : 5*sin(6.283185307179586*fract(4*t))*sin(3.141592653589793*fract(4*t)))))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1,(((floor(4*t)%8==0||floor(4*t)%8==4||floor(4*t)%8==6) && floor(4*t)%16!=14)*(0.54+0.36*(floor(4*t)%8==0)+0.1*(floor(4*t)%8==6))*(fract(4*t)<0.89)+((floor(4*t)%16==14)*(.53)*(fract(2*fract(4*t))<0.72))))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "1.3+0.7*(floor(4*t)%8==4)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 430,
              y: 180,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "reactor-opera",
    name: "Reactor Opera",
    group: "rave",
    description: "Four sections whose contours come from a triangular fold: swelling impacts, pitch bends and sparse three-part rolls.",
    formula: "y = ((floor(4*t)%32==31) ? (-12+23*exp(-6*fract(2*fract(4*t)))+2*sin(12.566370614359172*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -16 : (12*floor(((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)/7)+2*(((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)%7)-((((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)%7)>=2)-((((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)%7)>=5))-10))+((floor(4*t)%8==0 ? (26+4*(floor(floor(4*t)/16)%4))*exp(-9*fract(4*t)) : 4*sin(3.141592653589793*fract(4*t))-3*exp(-6*fract(4*t)))))",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.84*sin(tau*p+4.0*sin(2*tau*p+0.95*sin(7*tau*p)))+0.12*sin(11*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.005,
      release: 0.25,
      send: 0.14,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.028,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%32==31) ? (-12+23*exp(-6*fract(2*fract(4*t)))+2*sin(12.566370614359172*fract(2*fract(4*t)))) : ((floor(4*t)%8==0 ? -16 : (12*floor(((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)/7)+2*(((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)%7)-((((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)%7)>=2)-((((7-abs((3*floor(floor(4*t)/3)+2*floor(floor(4*t)/16))%14-7)+floor(floor(floor(4*t)/16)/4))%14)%7)>=5))-10))+((floor(4*t)%8==0 ? (26+4*(floor(floor(4*t)/16)%4))*exp(-9*fract(4*t)) : 4*sin(3.141592653589793*fract(4*t))-3*exp(-6*fract(4*t)))))",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1,(((floor(4*t)%8==0 || (floor(4*t)%8==3 && floor(floor(4*t)/16)%4!=0) || (floor(4*t)%8==6 && floor(floor(4*t)/16)%4>=2)) && floor(4*t)%16!=15)*(0.46+0.44*(floor(4*t)%8==0)+0.10*(floor(floor(4*t)/16)%4>=2))*(fract(4*t)<0.89)+((floor(4*t)%32==31)*(.6+0.15*(fract(2*fract(4*t))<0.12))*(fract(2*fract(4*t))<0.72))))",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "0.7+1.3*(floor(4*t)%8==0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 430,
              y: 180,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "fourth-bar-trap",
    name: "Fourth-Bar Trap",
    group: "rave",
    description: "Three bars of a tight, sparse 1-and-3 pattern; the fourth answers with an accelerating stutter.",
    formula: "y = ((fract(t/2)<.105 ? -24+29*exp(-25*fract(t/2)) : floor(t/4)%4==3 ? -8+9*(fract((t%4)*(2+3*fract(t/4)))-.5)+4*exp(-16*fract(6*t)) : -13+9*exp(-13*fract(2*t)) + 3*(floor(2*t)%4==3)))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.62*sin(2*tau*p)+0.29*sin(3*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.003,
      release: 0.08,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<.105 ? -24+29*exp(-25*fract(t/2)) : floor(t/4)%4==3 ? -8+9*(fract((t%4)*(2+3*fract(t/4)))-.5)+4*exp(-16*fract(6*t)) : -13+9*exp(-13*fract(2*t)) + 3*(floor(2*t)%4==3)))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.84)*(fract(t/2)<.14 ? .98 : floor(t/4)%4==3 ? (fract(6*t)<.78 ? .89 : 0) : fract(2*t)<.42 ? .77 : 0)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "ignition",
    name: "Ignition",
    group: "rave",
    description: "One bar motif grows over eight bars: anchor, melody, breath, ratchet. The downbeat never moves.",
    formula: "y = ((fract(t/2)<.10 ? -25+30*exp(-25*fract(t/2)) : floor(t/8)%4==0 ? -12+8*floor(4*fract(t/4))/3+3*exp(-12*fract(4*t)) : floor(t/8)%4==1 ? -9+12*sin(3.14159265359*fract(t/4))-8*fract(t/4) : floor(t/8)%4==2 ? -12+12*exp(-9*fract(4*t))+4*sin(6.28318530718*fract(t/4)) : -8+9*(fract(5*fract(t/4))-.5)+6*exp(-15*fract(5*fract(t/4)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p)+0.55*sin(2*tau*p)+0.22*sin(3*tau*p)",
      sliders: [],
      volume: 0.78,
      pan: 0,
      attack: 0.004,
      release: 0.11,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t/2)<.10 ? -25+30*exp(-25*fract(t/2)) : floor(t/8)%4==0 ? -12+8*floor(4*fract(t/4))/3+3*exp(-12*fract(4*t)) : floor(t/8)%4==1 ? -9+12*sin(3.14159265359*fract(t/4))-8*fract(t/4) : floor(t/8)%4==2 ? -12+12*exp(-9*fract(4*t))+4*sin(6.28318530718*fract(t/4)) : -8+9*(fract(5*fract(t/4))-.5)+6*exp(-15*fract(5*fract(t/4)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 220,
            },
            data: {
              formula: "(fract(t/.25)<.84)*(fract(t/2)<.15 ? .98 : floor(t/8)%4==0 ? (fract(4*t)<.76 ? .70 : 0) : floor(t/8)%4==1 ? .67 : floor(t/8)%4==2 ? (fract(4*t)<.62 ? .86 : 0) : (fract(5*fract(t/4))<.78 ? .88 : 0))",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 310,
              y: 10,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 620,
              y: 90,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "hardstyle-metronome",
    name: "Hardstyle Metronome",
    group: "rave",
    description: "Hardstyle stomps alternate with a riff round the circle of fifths and one mirrored downward zap.",
    formula: "y = fract(t)<0.23 ? -0.55+0.9*exp(-17*fract(t)) : floor(4*t)%8==7 ? 0.65-1.5*fract(4*t) : -0.38+round((5*(floor(4*t)%7))%7)*0.13+0.19*exp(-10*fract(4*t))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+1.3*sin(2*tau*p))+0.26*sin(4*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.004,
      release: 0.1,
      send: 0.19,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "fract(t)<0.23 ? -0.55+0.9*exp(-17*fract(t)) : floor(4*t)%8==7 ? 0.65-1.5*fract(4*t) : -0.38+round((5*(floor(4*t)%7))%7)*0.13+0.19*exp(-10*fract(4*t))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "0.82*(fract(t/0.25)<0.84)*(fract(t)<0.23 || floor(4*t)%8==7 || floor(4*t)%4!=3)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 87,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 120,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "thunder-map",
    name: "Thunder Map",
    group: "rave",
    description: "Long distorted saw descents break into a grounded four-beat impact: a muscular two-layer riff.",
    formula: "y = fract(t)<0.22 ? -0.74+1.08*exp(-22*fract(t)) : -0.5+0.8*(1-fract(t/3))-0.21*fract(t/7)",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+1.4*sin(tau*p))+0.23*sin(3*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.004,
      release: 0.1,
      send: 0.19,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "fract(t)<0.22 ? -0.74+1.08*exp(-22*fract(t)) : -0.5+0.8*(1-fract(t/3))-0.21*fract(t/7)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 248,
            },
            data: {
              formula: "0.84*(fract(t/0.25)<0.86)*(floor(4*t)%8!=5)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 87,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 120,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "dusty-backbeat",
    name: "Dusty Backbeat",
    group: "rave",
    description: "Snare-like accented hits, a low kick on the one, soft ghosts and a grace roll on the last beat.",
    formula: "y = ((floor(4*t)%64==47) ? (4+9*exp(-9*fract(2*fract(4*t)))) : (floor(4*t)%16==0 || floor(4*t)%16==4 || floor(4*t)%16==12) ? ((floor(4*t)%16==0) ? (-19+35*exp(-16*fract(4*t))) : (-3+13*exp(-11*fract(4*t))+1.5*sin(6.283185307179586*fract(4*t))*exp(-5*fract(4*t)))) : (floor(4*t)%16==10 || (floor(4*t)%16==15 && floor(t/4)%2==1)) ? ((-3+13*exp(-11*fract(4*t))+1.5*sin(6.283185307179586*fract(4*t))*exp(-5*fract(4*t)))-5) : 0)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+2.4*sin(3*tau*p))+0.12*sin(7*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.003,
      release: 0.14,
      send: 0.1,
      swing: 0.2,
      playMode: "glide",
      quantize: false,
      glide: 0.015,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%64==47) ? (4+9*exp(-9*fract(2*fract(4*t)))) : (floor(4*t)%16==0 || floor(4*t)%16==4 || floor(4*t)%16==12) ? ((floor(4*t)%16==0) ? (-19+35*exp(-16*fract(4*t))) : (-3+13*exp(-11*fract(4*t))+1.5*sin(6.283185307179586*fract(4*t))*exp(-5*fract(4*t)))) : (floor(4*t)%16==10 || (floor(4*t)%16==15 && floor(t/4)%2==1)) ? ((-3+13*exp(-11*fract(4*t))+1.5*sin(6.283185307179586*fract(4*t))*exp(-5*fract(4*t)))-5) : 0)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1, (floor(4*t)%64==47) ? (0.37 + 0.17*(fract(2*fract(4*t))<0.18))*(fract(2*fract(4*t))<0.74) : (floor(4*t)%16==0 || floor(4*t)%16==4 || floor(4*t)%16==12) ? (0.9*(floor(4*t)%16==0)+0.77*(1-(floor(4*t)%16==0))) * (fract(4*t)<0.9) : (floor(4*t)%16==10 || (floor(4*t)%16==15 && floor(t/4)%2==1)) ? 0.2*(fract(4*t)<0.62) : 0)",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "((floor(4*t)%64==47) ? 0.38 : (floor(4*t)%16==0) ? 1.35 : (floor(4*t)%16==0 || floor(4*t)%16==4 || floor(4*t)%16==12) ? 0.85 : 0.48)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 420,
              y: 200,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "pocket-stomp",
    name: "Pocket Stomp",
    group: "rave",
    description: "A heavy half-time pulse with a restrained ta-ta-ta pickup and a huge curved low resolution.",
    formula: "y = ((floor(4*t)%32==14) ? (-3+17*exp(-8*fract(2*fract(4*t)))) : (floor(4*t)%16==0 || floor(4*t)%16==8 || (floor(4*t)%16==11 && floor(t/4)%2==1)) ? ((floor(4*t)%16==0) ? (-22+42*exp(-10*fract(4*t))) : (-9+9*exp(-6*fract(4*t))-3*fract(4*t)*fract(4*t))) : (floor(4*t)%16==6 && floor(t/4)%4==3) ? ((-9+9*exp(-6*fract(4*t))-3*fract(4*t)*fract(4*t))-5) : 0)",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p+3*sin(2*tau*p+0.75*sin(5*tau*p)))+0.1*sin(9*tau*p)",
      sliders: [],
      volume: 0.77,
      pan: 0,
      attack: 0.003,
      release: 0.25,
      send: 0.1,
      swing: 0.09,
      playMode: "glide",
      quantize: false,
      glide: 0.025,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((floor(4*t)%32==14) ? (-3+17*exp(-8*fract(2*fract(4*t)))) : (floor(4*t)%16==0 || floor(4*t)%16==8 || (floor(4*t)%16==11 && floor(t/4)%2==1)) ? ((floor(4*t)%16==0) ? (-22+42*exp(-10*fract(4*t))) : (-9+9*exp(-6*fract(4*t))-3*fract(4*t)*fract(4*t))) : (floor(4*t)%16==6 && floor(t/4)%4==3) ? ((-9+9*exp(-6*fract(4*t))-3*fract(4*t)*fract(4*t))-5) : 0)",
            },
          },
          {
            id: "velocity",
            type: "expr",
            position: {
              x: 0,
              y: 210,
            },
            data: {
              formula: "min(1, (floor(4*t)%32==14) ? (0.49 + 0.17*(fract(2*fract(4*t))<0.18))*(fract(2*fract(4*t))<0.74) : (floor(4*t)%16==0 || floor(4*t)%16==8 || (floor(4*t)%16==11 && floor(t/4)%2==1)) ? (0.94*(floor(4*t)%16==0)+0.63*(1-(floor(4*t)%16==0))) * (fract(4*t)<0.9) : (floor(4*t)%16==6 && floor(t/4)%4==3) ? 0.21*(fract(4*t)<0.62) : 0)",
            },
          },
          {
            id: "length",
            type: "expr",
            position: {
              x: 0,
              y: 420,
            },
            data: {
              formula: "((floor(4*t)%32==14) ? 0.38 : (floor(4*t)%16==0) ? 1.35 : (floor(4*t)%16==0 || floor(4*t)%16==8 || (floor(4*t)%16==11 && floor(t/4)%2==1)) ? 0.85 : 0.48)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 420,
              y: 200,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "velocity.out-out.velocity",
            source: "velocity",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "length.out-out.length",
            source: "length",
            sourceHandle: "out",
            target: "out",
            targetHandle: "length",
          },
        ],
      },
    },
  },
  {
    id: "nuclear-ratchet",
    name: "Nuclear Ratchet",
    group: "rave",
    description: "Nested drill rolls accelerate into long falling impacts; a deliberate hole comes before the drop.",
    formula: "y = (((floor(4*t)%128)==9 || (floor(4*t)%128)==47 || (floor(4*t)%128)==61 || (floor(4*t)%128)==92 || (floor(4*t)%128)==111 || (floor(4*t)%128)==127) ? (26 - 38*fract(4*t) + 3*sin(10*tau*fract(4*t))) : (((floor(4*t)%128)==15 || (floor(4*t)%128)==28 || (floor(4*t)%128)==46 || (floor(4*t)%128)==63 || (floor(4*t)%128)==78 || (floor(4*t)%128)==95 || (floor(4*t)%128)==108) ? (-17 + 44*exp(-11*fract(4*t))) : (((floor(4*t)%128)==2 || (floor(4*t)%128)==3 || (floor(4*t)%128)==6 || (floor(4*t)%128)==7 || (floor(4*t)%128)==10 || (floor(4*t)%128)==11 || (floor(4*t)%128)==17 || (floor(4*t)%128)==18 || (floor(4*t)%128)==19 || (floor(4*t)%128)==22 || (floor(4*t)%128)==23 || (floor(4*t)%128)==30 || (floor(4*t)%128)==34 || (floor(4*t)%128)==37 || (floor(4*t)%128)==38 || (floor(4*t)%128)==39 || (floor(4*t)%128)==41 || (floor(4*t)%128)==42 || (floor(4*t)%128)==43 || (floor(4*t)%128)==50 || (floor(4*t)%128)==51 || (floor(4*t)%128)==53 || (floor(4*t)%128)==54 || (floor(4*t)%128)==57 || (floor(4*t)%128)==58 || (floor(4*t)%128)==59 || (floor(4*t)%128)==65 || (floor(4*t)%128)==66 || (floor(4*t)%128)==67 || (floor(4*t)%128)==70 || (floor(4*t)%128)==71 || (floor(4*t)%128)==74 || (floor(4*t)%128)==75 || (floor(4*t)%128)==81 || (floor(4*t)%128)==82 || (floor(4*t)%128)==83 || (floor(4*t)%128)==85 || (floor(4*t)%128)==86 || (floor(4*t)%128)==87 || (floor(4*t)%128)==93 || (floor(4*t)%128)==94 || (floor(4*t)%128)==97 || (floor(4*t)%128)==98 || (floor(4*t)%128)==99 || (floor(4*t)%128)==102 || (floor(4*t)%128)==103 || (floor(4*t)%128)==106 || (floor(4*t)%128)==107 || (floor(4*t)%128)==113 || (floor(4*t)%128)==114 || (floor(4*t)%128)==115 || (floor(4*t)%128)==117 || (floor(4*t)%128)==118 || (floor(4*t)%128)==119 || (floor(4*t)%128)==121 || (floor(4*t)%128)==122 || (floor(4*t)%128)==123 || (floor(4*t)%128)==125 || (floor(4*t)%128)==126) ? (-3 + 24*exp(-5*fract(4*fract(4*t))) + 9*sin(2*tau*fract(4*t))) : (((floor(4*t)%128)==13 || (floor(4*t)%128)==26 || (floor(4*t)%128)==69 || (floor(4*t)%128)==90 || (floor(4*t)%128)==110) ? (-7 + 3*(floor(4*t)%5) + 5*exp(-14*fract(4*t))) : (((floor(4*t)%128)==0 || (floor(4*t)%128)==8 || (floor(4*t)%128)==12 || (floor(4*t)%128)==16 || (floor(4*t)%128)==20 || (floor(4*t)%128)==24 || (floor(4*t)%128)==32 || (floor(4*t)%128)==36 || (floor(4*t)%128)==44 || (floor(4*t)%128)==48 || (floor(4*t)%128)==56 || (floor(4*t)%128)==60 || (floor(4*t)%128)==64 || (floor(4*t)%128)==68 || (floor(4*t)%128)==72 || (floor(4*t)%128)==76 || (floor(4*t)%128)==80 || (floor(4*t)%128)==88 || (floor(4*t)%128)==96 || (floor(4*t)%128)==100 || (floor(4*t)%128)==104 || (floor(4*t)%128)==112 || (floor(4*t)%128)==120 || (floor(4*t)%128)==124) ? (-20 + 39*exp(-16*fract(4*t))) : 0)))))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p + 6.5*sin(3*tau*p + 2*sin(7*tau*p))) + 0.15*sin(13*tau*p)",
      sliders: [],
      volume: 0.86,
      pan: 0,
      attack: 0.002,
      release: 0.075,
      send: 0.12,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(((floor(4*t)%128)==9 || (floor(4*t)%128)==47 || (floor(4*t)%128)==61 || (floor(4*t)%128)==92 || (floor(4*t)%128)==111 || (floor(4*t)%128)==127) ? (26 - 38*fract(4*t) + 3*sin(10*tau*fract(4*t))) : (((floor(4*t)%128)==15 || (floor(4*t)%128)==28 || (floor(4*t)%128)==46 || (floor(4*t)%128)==63 || (floor(4*t)%128)==78 || (floor(4*t)%128)==95 || (floor(4*t)%128)==108) ? (-17 + 44*exp(-11*fract(4*t))) : (((floor(4*t)%128)==2 || (floor(4*t)%128)==3 || (floor(4*t)%128)==6 || (floor(4*t)%128)==7 || (floor(4*t)%128)==10 || (floor(4*t)%128)==11 || (floor(4*t)%128)==17 || (floor(4*t)%128)==18 || (floor(4*t)%128)==19 || (floor(4*t)%128)==22 || (floor(4*t)%128)==23 || (floor(4*t)%128)==30 || (floor(4*t)%128)==34 || (floor(4*t)%128)==37 || (floor(4*t)%128)==38 || (floor(4*t)%128)==39 || (floor(4*t)%128)==41 || (floor(4*t)%128)==42 || (floor(4*t)%128)==43 || (floor(4*t)%128)==50 || (floor(4*t)%128)==51 || (floor(4*t)%128)==53 || (floor(4*t)%128)==54 || (floor(4*t)%128)==57 || (floor(4*t)%128)==58 || (floor(4*t)%128)==59 || (floor(4*t)%128)==65 || (floor(4*t)%128)==66 || (floor(4*t)%128)==67 || (floor(4*t)%128)==70 || (floor(4*t)%128)==71 || (floor(4*t)%128)==74 || (floor(4*t)%128)==75 || (floor(4*t)%128)==81 || (floor(4*t)%128)==82 || (floor(4*t)%128)==83 || (floor(4*t)%128)==85 || (floor(4*t)%128)==86 || (floor(4*t)%128)==87 || (floor(4*t)%128)==93 || (floor(4*t)%128)==94 || (floor(4*t)%128)==97 || (floor(4*t)%128)==98 || (floor(4*t)%128)==99 || (floor(4*t)%128)==102 || (floor(4*t)%128)==103 || (floor(4*t)%128)==106 || (floor(4*t)%128)==107 || (floor(4*t)%128)==113 || (floor(4*t)%128)==114 || (floor(4*t)%128)==115 || (floor(4*t)%128)==117 || (floor(4*t)%128)==118 || (floor(4*t)%128)==119 || (floor(4*t)%128)==121 || (floor(4*t)%128)==122 || (floor(4*t)%128)==123 || (floor(4*t)%128)==125 || (floor(4*t)%128)==126) ? (-3 + 24*exp(-5*fract(4*fract(4*t))) + 9*sin(2*tau*fract(4*t))) : (((floor(4*t)%128)==13 || (floor(4*t)%128)==26 || (floor(4*t)%128)==69 || (floor(4*t)%128)==90 || (floor(4*t)%128)==110) ? (-7 + 3*(floor(4*t)%5) + 5*exp(-14*fract(4*t))) : (((floor(4*t)%128)==0 || (floor(4*t)%128)==8 || (floor(4*t)%128)==12 || (floor(4*t)%128)==16 || (floor(4*t)%128)==20 || (floor(4*t)%128)==24 || (floor(4*t)%128)==32 || (floor(4*t)%128)==36 || (floor(4*t)%128)==44 || (floor(4*t)%128)==48 || (floor(4*t)%128)==56 || (floor(4*t)%128)==60 || (floor(4*t)%128)==64 || (floor(4*t)%128)==68 || (floor(4*t)%128)==72 || (floor(4*t)%128)==76 || (floor(4*t)%128)==80 || (floor(4*t)%128)==88 || (floor(4*t)%128)==96 || (floor(4*t)%128)==100 || (floor(4*t)%128)==104 || (floor(4*t)%128)==112 || (floor(4*t)%128)==120 || (floor(4*t)%128)==124) ? (-20 + 39*exp(-16*fract(4*t))) : 0)))))",
            },
          },
          {
            id: "vel",
            type: "expr",
            position: {
              x: 0,
              y: 270,
            },
            data: {
              formula: "(((floor(4*t)%128)==9 || (floor(4*t)%128)==47 || (floor(4*t)%128)==61 || (floor(4*t)%128)==92 || (floor(4*t)%128)==111 || (floor(4*t)%128)==127) ? (0.64 + 0.22*(fract(4*t)<0.15))*(fract(4*t)<0.65) : (((floor(4*t)%128)==15 || (floor(4*t)%128)==28 || (floor(4*t)%128)==46 || (floor(4*t)%128)==63 || (floor(4*t)%128)==78 || (floor(4*t)%128)==95 || (floor(4*t)%128)==108) ? (0.94 - 0.08*(floor(t)%2))*(fract(4*t)<0.95) : (((floor(4*t)%128)==2 || (floor(4*t)%128)==3 || (floor(4*t)%128)==6 || (floor(4*t)%128)==7 || (floor(4*t)%128)==10 || (floor(4*t)%128)==11 || (floor(4*t)%128)==17 || (floor(4*t)%128)==18 || (floor(4*t)%128)==19 || (floor(4*t)%128)==22 || (floor(4*t)%128)==23 || (floor(4*t)%128)==30 || (floor(4*t)%128)==34 || (floor(4*t)%128)==37 || (floor(4*t)%128)==38 || (floor(4*t)%128)==39 || (floor(4*t)%128)==41 || (floor(4*t)%128)==42 || (floor(4*t)%128)==43 || (floor(4*t)%128)==50 || (floor(4*t)%128)==51 || (floor(4*t)%128)==53 || (floor(4*t)%128)==54 || (floor(4*t)%128)==57 || (floor(4*t)%128)==58 || (floor(4*t)%128)==59 || (floor(4*t)%128)==65 || (floor(4*t)%128)==66 || (floor(4*t)%128)==67 || (floor(4*t)%128)==70 || (floor(4*t)%128)==71 || (floor(4*t)%128)==74 || (floor(4*t)%128)==75 || (floor(4*t)%128)==81 || (floor(4*t)%128)==82 || (floor(4*t)%128)==83 || (floor(4*t)%128)==85 || (floor(4*t)%128)==86 || (floor(4*t)%128)==87 || (floor(4*t)%128)==93 || (floor(4*t)%128)==94 || (floor(4*t)%128)==97 || (floor(4*t)%128)==98 || (floor(4*t)%128)==99 || (floor(4*t)%128)==102 || (floor(4*t)%128)==103 || (floor(4*t)%128)==106 || (floor(4*t)%128)==107 || (floor(4*t)%128)==113 || (floor(4*t)%128)==114 || (floor(4*t)%128)==115 || (floor(4*t)%128)==117 || (floor(4*t)%128)==118 || (floor(4*t)%128)==119 || (floor(4*t)%128)==121 || (floor(4*t)%128)==122 || (floor(4*t)%128)==123 || (floor(4*t)%128)==125 || (floor(4*t)%128)==126) ? (0.56 + 0.35*(fract(4*fract(4*t))<0.2))*(fract(4*fract(4*t))<0.78) : (((floor(4*t)%128)==13 || (floor(4*t)%128)==26 || (floor(4*t)%128)==69 || (floor(4*t)%128)==90 || (floor(4*t)%128)==110) ? (0.54 + 0.24*(floor(4*t)%3==0))*(fract(4*t)<0.7) : (((floor(4*t)%128)==0 || (floor(4*t)%128)==8 || (floor(4*t)%128)==12 || (floor(4*t)%128)==16 || (floor(4*t)%128)==20 || (floor(4*t)%128)==24 || (floor(4*t)%128)==32 || (floor(4*t)%128)==36 || (floor(4*t)%128)==44 || (floor(4*t)%128)==48 || (floor(4*t)%128)==56 || (floor(4*t)%128)==60 || (floor(4*t)%128)==64 || (floor(4*t)%128)==68 || (floor(4*t)%128)==72 || (floor(4*t)%128)==76 || (floor(4*t)%128)==80 || (floor(4*t)%128)==88 || (floor(4*t)%128)==96 || (floor(4*t)%128)==100 || (floor(4*t)%128)==104 || (floor(4*t)%128)==112 || (floor(4*t)%128)==120 || (floor(4*t)%128)==124) ? (0.88 + 0.11*(floor(t)%4==0))*(fract(4*t)<0.86) : 0)))))",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 100,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "vel.out-out.velocity",
            source: "vel",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "euclid-collapse",
    name: "Euclid Collapse",
    group: "rave",
    description: "Uneven interlocking rhythms break the kick grid; ratchet clusters spill into empty space before a rebound.",
    formula: "y = (((floor(4*t)%128)==15 || (floor(4*t)%128)==31 || (floor(4*t)%128)==44 || (floor(4*t)%128)==78 || (floor(4*t)%128)==93 || (floor(4*t)%128)==127) ? (26 - 38*fract(4*t) + 3*sin(10*tau*fract(4*t))) : (((floor(4*t)%128)==6 || (floor(4*t)%128)==27 || (floor(4*t)%128)==46 || (floor(4*t)%128)==63 || (floor(4*t)%128)==74 || (floor(4*t)%128)==95 || (floor(4*t)%128)==104) ? (-17 + 44*exp(-11*fract(4*t))) : (((floor(4*t)%128)==3 || (floor(4*t)%128)==7 || (floor(4*t)%128)==11 || (floor(4*t)%128)==18 || (floor(4*t)%128)==21 || (floor(4*t)%128)==26 || (floor(4*t)%128)==30 || (floor(4*t)%128)==35 || (floor(4*t)%128)==38 || (floor(4*t)%128)==43 || (floor(4*t)%128)==49 || (floor(4*t)%128)==53 || (floor(4*t)%128)==55 || (floor(4*t)%128)==62 || (floor(4*t)%128)==67 || (floor(4*t)%128)==71 || (floor(4*t)%128)==82 || (floor(4*t)%128)==86 || (floor(4*t)%128)==91 || (floor(4*t)%128)==94 || (floor(4*t)%128)==97 || (floor(4*t)%128)==99 || (floor(4*t)%128)==103 || (floor(4*t)%128)==106 || (floor(4*t)%128)==113 || (floor(4*t)%128)==114 || (floor(4*t)%128)==115 || (floor(4*t)%128)==118 || (floor(4*t)%128)==119 || (floor(4*t)%128)==121 || (floor(4*t)%128)==122 || (floor(4*t)%128)==123 || (floor(4*t)%128)==126) ? (-3 + 24*exp(-5*fract(4*fract(4*t))) + 9*sin(2*tau*fract(4*t))) : (((floor(4*t)%128)==2 || (floor(4*t)%128)==9 || (floor(4*t)%128)==22 || (floor(4*t)%128)==29 || (floor(4*t)%128)==33 || (floor(4*t)%128)==41 || (floor(4*t)%128)==52 || (floor(4*t)%128)==58 || (floor(4*t)%128)==69 || (floor(4*t)%128)==77 || (floor(4*t)%128)==81 || (floor(4*t)%128)==90 || (floor(4*t)%128)==100 || (floor(4*t)%128)==109 || (floor(4*t)%128)==117) ? (-7 + 3*(floor(4*t)%5) + 5*exp(-14*fract(4*t))) : (((floor(4*t)%128)==0 || (floor(4*t)%128)==4 || (floor(4*t)%128)==12 || (floor(4*t)%128)==16 || (floor(4*t)%128)==24 || (floor(4*t)%128)==28 || (floor(4*t)%128)==32 || (floor(4*t)%128)==36 || (floor(4*t)%128)==40 || (floor(4*t)%128)==48 || (floor(4*t)%128)==56 || (floor(4*t)%128)==60 || (floor(4*t)%128)==64 || (floor(4*t)%128)==68 || (floor(4*t)%128)==76 || (floor(4*t)%128)==80 || (floor(4*t)%128)==84 || (floor(4*t)%128)==88 || (floor(4*t)%128)==96 || (floor(4*t)%128)==108 || (floor(4*t)%128)==112 || (floor(4*t)%128)==120 || (floor(4*t)%128)==124) ? (-20 + 39*exp(-16*fract(4*t))) : 0)))))",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "sin(tau*p + 4*sin(tau*p + 2*sin(4*tau*p))) + 0.3*sin(5*tau*p + 2*sin(2*tau*p))",
      sliders: [],
      volume: 0.92,
      pan: 0,
      attack: 0.004,
      release: 0.13,
      send: 0.12,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.025,
      graph: {
        nodes: [
          {
            id: "pitch",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(((floor(4*t)%128)==15 || (floor(4*t)%128)==31 || (floor(4*t)%128)==44 || (floor(4*t)%128)==78 || (floor(4*t)%128)==93 || (floor(4*t)%128)==127) ? (26 - 38*fract(4*t) + 3*sin(10*tau*fract(4*t))) : (((floor(4*t)%128)==6 || (floor(4*t)%128)==27 || (floor(4*t)%128)==46 || (floor(4*t)%128)==63 || (floor(4*t)%128)==74 || (floor(4*t)%128)==95 || (floor(4*t)%128)==104) ? (-17 + 44*exp(-11*fract(4*t))) : (((floor(4*t)%128)==3 || (floor(4*t)%128)==7 || (floor(4*t)%128)==11 || (floor(4*t)%128)==18 || (floor(4*t)%128)==21 || (floor(4*t)%128)==26 || (floor(4*t)%128)==30 || (floor(4*t)%128)==35 || (floor(4*t)%128)==38 || (floor(4*t)%128)==43 || (floor(4*t)%128)==49 || (floor(4*t)%128)==53 || (floor(4*t)%128)==55 || (floor(4*t)%128)==62 || (floor(4*t)%128)==67 || (floor(4*t)%128)==71 || (floor(4*t)%128)==82 || (floor(4*t)%128)==86 || (floor(4*t)%128)==91 || (floor(4*t)%128)==94 || (floor(4*t)%128)==97 || (floor(4*t)%128)==99 || (floor(4*t)%128)==103 || (floor(4*t)%128)==106 || (floor(4*t)%128)==113 || (floor(4*t)%128)==114 || (floor(4*t)%128)==115 || (floor(4*t)%128)==118 || (floor(4*t)%128)==119 || (floor(4*t)%128)==121 || (floor(4*t)%128)==122 || (floor(4*t)%128)==123 || (floor(4*t)%128)==126) ? (-3 + 24*exp(-5*fract(4*fract(4*t))) + 9*sin(2*tau*fract(4*t))) : (((floor(4*t)%128)==2 || (floor(4*t)%128)==9 || (floor(4*t)%128)==22 || (floor(4*t)%128)==29 || (floor(4*t)%128)==33 || (floor(4*t)%128)==41 || (floor(4*t)%128)==52 || (floor(4*t)%128)==58 || (floor(4*t)%128)==69 || (floor(4*t)%128)==77 || (floor(4*t)%128)==81 || (floor(4*t)%128)==90 || (floor(4*t)%128)==100 || (floor(4*t)%128)==109 || (floor(4*t)%128)==117) ? (-7 + 3*(floor(4*t)%5) + 5*exp(-14*fract(4*t))) : (((floor(4*t)%128)==0 || (floor(4*t)%128)==4 || (floor(4*t)%128)==12 || (floor(4*t)%128)==16 || (floor(4*t)%128)==24 || (floor(4*t)%128)==28 || (floor(4*t)%128)==32 || (floor(4*t)%128)==36 || (floor(4*t)%128)==40 || (floor(4*t)%128)==48 || (floor(4*t)%128)==56 || (floor(4*t)%128)==60 || (floor(4*t)%128)==64 || (floor(4*t)%128)==68 || (floor(4*t)%128)==76 || (floor(4*t)%128)==80 || (floor(4*t)%128)==84 || (floor(4*t)%128)==88 || (floor(4*t)%128)==96 || (floor(4*t)%128)==108 || (floor(4*t)%128)==112 || (floor(4*t)%128)==120 || (floor(4*t)%128)==124) ? (-20 + 39*exp(-16*fract(4*t))) : 0)))))",
            },
          },
          {
            id: "vel",
            type: "expr",
            position: {
              x: 0,
              y: 270,
            },
            data: {
              formula: "(((floor(4*t)%128)==15 || (floor(4*t)%128)==31 || (floor(4*t)%128)==44 || (floor(4*t)%128)==78 || (floor(4*t)%128)==93 || (floor(4*t)%128)==127) ? (0.64 + 0.22*(fract(4*t)<0.15))*(fract(4*t)<0.65) : (((floor(4*t)%128)==6 || (floor(4*t)%128)==27 || (floor(4*t)%128)==46 || (floor(4*t)%128)==63 || (floor(4*t)%128)==74 || (floor(4*t)%128)==95 || (floor(4*t)%128)==104) ? (0.94 - 0.08*(floor(t)%2))*(fract(4*t)<0.95) : (((floor(4*t)%128)==3 || (floor(4*t)%128)==7 || (floor(4*t)%128)==11 || (floor(4*t)%128)==18 || (floor(4*t)%128)==21 || (floor(4*t)%128)==26 || (floor(4*t)%128)==30 || (floor(4*t)%128)==35 || (floor(4*t)%128)==38 || (floor(4*t)%128)==43 || (floor(4*t)%128)==49 || (floor(4*t)%128)==53 || (floor(4*t)%128)==55 || (floor(4*t)%128)==62 || (floor(4*t)%128)==67 || (floor(4*t)%128)==71 || (floor(4*t)%128)==82 || (floor(4*t)%128)==86 || (floor(4*t)%128)==91 || (floor(4*t)%128)==94 || (floor(4*t)%128)==97 || (floor(4*t)%128)==99 || (floor(4*t)%128)==103 || (floor(4*t)%128)==106 || (floor(4*t)%128)==113 || (floor(4*t)%128)==114 || (floor(4*t)%128)==115 || (floor(4*t)%128)==118 || (floor(4*t)%128)==119 || (floor(4*t)%128)==121 || (floor(4*t)%128)==122 || (floor(4*t)%128)==123 || (floor(4*t)%128)==126) ? (0.56 + 0.35*(fract(4*fract(4*t))<0.2))*(fract(4*fract(4*t))<0.78) : (((floor(4*t)%128)==2 || (floor(4*t)%128)==9 || (floor(4*t)%128)==22 || (floor(4*t)%128)==29 || (floor(4*t)%128)==33 || (floor(4*t)%128)==41 || (floor(4*t)%128)==52 || (floor(4*t)%128)==58 || (floor(4*t)%128)==69 || (floor(4*t)%128)==77 || (floor(4*t)%128)==81 || (floor(4*t)%128)==90 || (floor(4*t)%128)==100 || (floor(4*t)%128)==109 || (floor(4*t)%128)==117) ? (0.54 + 0.24*(floor(4*t)%3==0))*(fract(4*t)<0.7) : (((floor(4*t)%128)==0 || (floor(4*t)%128)==4 || (floor(4*t)%128)==12 || (floor(4*t)%128)==16 || (floor(4*t)%128)==24 || (floor(4*t)%128)==28 || (floor(4*t)%128)==32 || (floor(4*t)%128)==36 || (floor(4*t)%128)==40 || (floor(4*t)%128)==48 || (floor(4*t)%128)==56 || (floor(4*t)%128)==60 || (floor(4*t)%128)==64 || (floor(4*t)%128)==68 || (floor(4*t)%128)==76 || (floor(4*t)%128)==80 || (floor(4*t)%128)==84 || (floor(4*t)%128)==88 || (floor(4*t)%128)==96 || (floor(4*t)%128)==108 || (floor(4*t)%128)==112 || (floor(4*t)%128)==120 || (floor(4*t)%128)==124) ? (0.88 + 0.11*(floor(t)%4==0))*(fract(4*t)<0.86) : 0)))))",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 100,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "pitch.out-out.pitch",
            source: "pitch",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "vel.out-out.velocity",
            source: "vel",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "triple-detonation",
    name: "Triple Detonation",
    group: "rave",
    description: "A fast pitched roll launches three falling impacts with silence between, and a late surprise barrage.",
    formula: "y = (floor(t)%8)==0 ? (2.8-3.9*fract(8*t)+0.21*sin(6.2831853*fract(8*t))) : ((floor(t)%8)==1 || (floor(t)%8)==3 || (floor(t)%8)==5) ? (2.0-4.6*(1-exp(-4*fract(t)))) : (floor(t)%8)==7 ? (2.5-4.7*fract(12*t)) : -0.8",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.65*sin(tau*p+3.3*sin(2*tau*p+0.9*sin(7*tau*p)))+0.25*sin(5*tau*p)+0.1*sin(11*tau*p)",
      sliders: [],
      volume: 0.72,
      pan: 0,
      attack: 0.001,
      release: 0.075,
      send: 0.19,
      swing: 0.025,
      playMode: "glide",
      quantize: false,
      glide: 0.002,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8)==0 ? (2.8-3.9*fract(8*t)+0.21*sin(6.2831853*fract(8*t))) : ((floor(t)%8)==1 || (floor(t)%8)==3 || (floor(t)%8)==5) ? (2.0-4.6*(1-exp(-4*fract(t)))) : (floor(t)%8)==7 ? (2.5-4.7*fract(12*t)) : -0.8",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8)==0 ? (fract(8*t)<0.65 ? 0.75 : 0) : ((floor(t)%8)==1 || (floor(t)%8)==3 || (floor(t)%8)==5) ? (fract(4*t)<0.85 ? 0.91 : 0) : (floor(t)%8)==7 ? (fract(12*t)<0.6 ? 0.56 : 0) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "ratchet-recoil",
    name: "Ratchet Recoil",
    group: "rave",
    description: "Five ticking roll pulses, three weighty punches, a delayed last ratchet and an empty pocket.",
    formula: "y = (floor(t)%8==0 && fract(10*t)<0.6) ? (2.0-3.8*fract(10*t)) : (floor(t)%8==2 || floor(t)%8==3 || floor(t)%8==5) ? (1.7-4.1*fract(t)+0.35*(floor(t)%8==5)) : (floor(t)%8==7 && fract(16*t)<0.5) ? (1.9-3.1*fract(16*t)) : 0",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.68*sin(tau*p+2.5*sin(3*tau*p))+0.21*sin(7*tau*p)+0.11*sin(13*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.001,
      release: 0.065,
      send: 0.14,
      swing: 0.09,
      playMode: "glide",
      quantize: false,
      glide: 0.001,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0 && fract(10*t)<0.6) ? (2.0-3.8*fract(10*t)) : (floor(t)%8==2 || floor(t)%8==3 || floor(t)%8==5) ? (1.7-4.1*fract(t)+0.35*(floor(t)%8==5)) : (floor(t)%8==7 && fract(16*t)<0.5) ? (1.9-3.1*fract(16*t)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0 && fract(10*t)<0.6) ? 0.62 : (floor(t)%8==2 || floor(t)%8==3 || floor(t)%8==5) ? (0.92-0.12*(floor(t)%8==3)) : (floor(t)%8==7 && fract(16*t)<0.5) ? 0.47 : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "gatling-doom",
    name: "Gatling Doom",
    group: "rave",
    description: "1/32 ratchets burst into huge falling impacts, while 5-in-16 Euclidean metal stabs answer the silence.",
    formula: "y = (floor(t)%8==0 || floor(t)%8==4) ? (2.6-4.1*fract(8*t)) : (floor(t)%8==1 || floor(t)%8==5) ? (1.5-4.5*(1-exp(-6*fract(t)))) : (floor(t)%8==7 && fract(16*t)<0.58) ? (2.5-3.9*fract(16*t)) : ((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) && fract(4*t)<0.66 && !(floor(t)%8==0 || floor(t)%8==4) && !(floor(t)%8==1 || floor(t)%8==5)) ? ((-7+3*(floor(4*t)%5))/12+0.18*exp(-13*fract(4*t))) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.62*sin(tau*p+5.7*sin(3*tau*p+1.8*sin(7*tau*p)))+0.25*sin(11*tau*p)+0.13*sin(17*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.001,
      release: 0.09,
      send: 0.17,
      swing: 0.05,
      playMode: "glide",
      quantize: false,
      glide: 0.002,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==4) ? (2.6-4.1*fract(8*t)) : (floor(t)%8==1 || floor(t)%8==5) ? (1.5-4.5*(1-exp(-6*fract(t)))) : (floor(t)%8==7 && fract(16*t)<0.58) ? (2.5-3.9*fract(16*t)) : ((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) && fract(4*t)<0.66 && !(floor(t)%8==0 || floor(t)%8==4) && !(floor(t)%8==1 || floor(t)%8==5)) ? ((-7+3*(floor(4*t)%5))/12+0.18*exp(-13*fract(4*t))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==4) ? (fract(8*t)<0.66 ? 0.67 : 0) : (floor(t)%8==1 || floor(t)%8==5) ? 0.98 : (floor(t)%8==7 && fract(16*t)<0.58) ? 0.52 : ((floor(5*((floor(4*t)%16)+1)/16)>floor(5*(floor(4*t)%16)/16)) && fract(4*t)<0.66 && !(floor(t)%8==0 || floor(t)%8==4) && !(floor(t)%8==1 || floor(t)%8==5)) ? (0.4+0.16*(floor(4*t)%4==2)) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "reactor-stomp",
    name: "Reactor Stomp",
    group: "rave",
    description: "Driving falling kicks, three metallic replies, 1/64 machine-gun fills and a dropout every eighth bar.",
    formula: "y = (floor(t)%8==0 || floor(t)%8==2 || floor(t)%8==4 || floor(t)%8==6) ? (-1.6+2.8*exp(-21*fract(t))) : (floor(t)%8==1 || floor(t)%8==3 || floor(t)%8==5) ? (0.65+0.38*sin(6.2831853*fract(t))-1.8*fract(t)) : (floor(t)%8==7 && fract(16*t)<0.5) ? (2.1-4.5*fract(16*t)) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.68*sin(tau*p+4.4*sin(2*tau*p+1.6*sin(5*tau*p)))+0.23*sin(7*tau*p)+0.09*sin(13*tau*p)",
      sliders: [],
      volume: 0.74,
      pan: 0,
      attack: 0.001,
      release: 0.075,
      send: 0.1,
      swing: 0.015,
      playMode: "glide",
      quantize: false,
      glide: 0.001,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==2 || floor(t)%8==4 || floor(t)%8==6) ? (-1.6+2.8*exp(-21*fract(t))) : (floor(t)%8==1 || floor(t)%8==3 || floor(t)%8==5) ? (0.65+0.38*sin(6.2831853*fract(t))-1.8*fract(t)) : (floor(t)%8==7 && fract(16*t)<0.5) ? (2.1-4.5*fract(16*t)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==2 || floor(t)%8==4 || floor(t)%8==6) ? 0.95 : (floor(t)%8==1 || floor(t)%8==3 || floor(t)%8==5) ? (fract(4*t)<0.65 ? 0.57 : 0) : (floor(t)%8==7 && fract(16*t)<0.5) ? 0.55 : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "tatata-wah",
    name: "Tatata Wah",
    group: "rave",
    description: "A 7-in-16 riddim code that switches between rattling triplet rolls and hollow vowel sweeps.",
    formula: "y = (floor(t)%8==0 || floor(t)%8==6) ? (2.4-3.8*fract(12*t)) : ((floor(7*((floor(4*t)%16)+1)/16)>floor(7*(floor(4*t)%16)/16)) && fract(4*t)<0.7) ? ((-9+5*(floor(4*t)%6))/12+0.55*sin(3.14159265*fract(4*t))) : floor(t)%8==7 ? (0.8-3.2*(1-exp(-5*fract(t)))) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.7*sin(tau*p+3.9*sin(2*tau*p+1.7*sin(5*tau*p)))+0.22*sin(5*tau*p+2*sin(tau*p))+0.08*sin(9*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.003,
      release: 0.16,
      send: 0.32,
      swing: 0.18,
      playMode: "glide",
      quantize: false,
      glide: 0.012,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==6) ? (2.4-3.8*fract(12*t)) : ((floor(7*((floor(4*t)%16)+1)/16)>floor(7*(floor(4*t)%16)/16)) && fract(4*t)<0.7) ? ((-9+5*(floor(4*t)%6))/12+0.55*sin(3.14159265*fract(4*t))) : floor(t)%8==7 ? (0.8-3.2*(1-exp(-5*fract(t)))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==6) ? (fract(12*t)<0.54 ? 0.64 : 0) : ((floor(7*((floor(4*t)%16)+1)/16)>floor(7*(floor(4*t)%16)/16)) && fract(4*t)<0.7) ? (0.47+0.18*(floor(4*t)%3==0)) : floor(t)%8==7 ? 0.83 : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "final-boss",
    name: "Final Boss",
    group: "rave",
    description: "A sixteen-bar hard phrase: a gatling lead-in, pitch-dive detonations, Euclidean accents and barrages at each section end.",
    formula: "y = (floor(t)%16==0 || floor(t)%16==8) ? (3.0-5.1*fract(16*t)) : (floor(t)%16==1 || floor(t)%16==9) ? (1.6-5.5*(1-exp(-6*fract(t)))) : (floor(t)%16==15 && fract(16*t)<0.52) ? (2.8-4.8*fract(16*t)) : ((floor(7*((floor(4*t)%16)+1)/16)>floor(7*(floor(4*t)%16)/16)) && fract(4*t)<0.67) ? ((-12+5*(floor(4*t)%7)+12*(floor(t/8)%2))/12+0.25*exp(-13*fract(4*t))) : 0",
    track: {
      steps: 256,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.61*sin(tau*p+7*sin(2*tau*p+2.5*sin(5*tau*p+sin(11*tau*p))))+0.25*sin(9*tau*p+4*sin(3*tau*p))+0.14*sin(17*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.001,
      release: 0.09,
      send: 0.24,
      swing: 0.075,
      playMode: "glide",
      quantize: false,
      glide: 0.003,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%16==0 || floor(t)%16==8) ? (3.0-5.1*fract(16*t)) : (floor(t)%16==1 || floor(t)%16==9) ? (1.6-5.5*(1-exp(-6*fract(t)))) : (floor(t)%16==15 && fract(16*t)<0.52) ? (2.8-4.8*fract(16*t)) : ((floor(7*((floor(4*t)%16)+1)/16)>floor(7*(floor(4*t)%16)/16)) && fract(4*t)<0.67) ? ((-12+5*(floor(4*t)%7)+12*(floor(t/8)%2))/12+0.25*exp(-13*fract(4*t))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%16==0 || floor(t)%16==8) ? (fract(16*t)<0.58 ? (0.55+0.31*fract(t)) : 0) : (floor(t)%16==1 || floor(t)%16==9) ? 0.99 : (floor(t)%16==15 && fract(16*t)<0.52) ? 0.64 : ((floor(7*((floor(4*t)%16)+1)/16)>floor(7*(floor(4*t)%16)/16)) && fract(4*t)<0.67) ? (0.42+0.17*(floor(4*t)%4==3)) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "trrr-pow-pow-pow",
    name: "Trrr Pow Pow Pow",
    group: "rave",
    description: "A fast drum-roll zigzag, then three long falling “pows”. Say the name out loud and you know it.",
    formula: "y = floor(t) % 16 == 0 ? 2.5 - 5 * (5 * t % 1) : -2 <= t && t < 0 || 14 <= t && t < 16 ? 2.3 - 4.6 * (t % 1) : 2.3 - 4.6 * (t / 2 % 1)",
    track: {
      steps: 32,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "floor(t) % 16 == 0 ? 2.5 - 5 * (5 * t % 1) : -2 <= t && t < 0 || 14 <= t && t < 16 ? 2.3 - 4.6 * (t % 1) : 2.3 - 4.6 * (t / 2 % 1)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "tungsten-bird",
    name: "Tungsten Bird",
    group: "creatures",
    description: "Metal chirps every seven beats answer a resonator every five; bass impacts every two keep it grounded.",
    formula: "y = ((((t + 2) % 7) < 0.35) ? ((0.10 + 1.80 * exp(-11 * ((t + 2) % 7)) - 0.39 * exp(-4 * ((t + 2) % 7)) * sin(47 * ((t + 2) % 7) - 20 * ((t + 2) % 7) * ((t + 2) % 7)))) : (((((t + 1) % 5) < 0.26) ? ((-0.70 + 0.85 * exp(-7.5 * ((t + 1) % 5)) * cos(34 * ((t + 1) % 5)))) : ((-2.18 + 0.26 * sin(1.2566370614 * t) + 0.53 * exp(-9 * ((t + 0) % 2)))))))",
    track: {
      steps: 112,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.29*sin(3*tau*p) + 0.18*sin(7*tau*p)",
      sliders: [],
      volume: 0.72,
      pan: 0,
      attack: 0.004,
      release: 0.08,
      send: 0.3,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((((t + 2) % 7) < 0.35) ? ((0.10 + 1.80 * exp(-11 * ((t + 2) % 7)) - 0.39 * exp(-4 * ((t + 2) % 7)) * sin(47 * ((t + 2) % 7) - 20 * ((t + 2) % 7) * ((t + 2) % 7)))) : (((((t + 1) % 5) < 0.26) ? ((-0.70 + 0.85 * exp(-7.5 * ((t + 1) % 5)) * cos(34 * ((t + 1) % 5)))) : ((-2.18 + 0.26 * sin(1.2566370614 * t) + 0.53 * exp(-9 * ((t + 0) % 2)))))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: "0.78 * ((((t + 2) % 7) < 0.35) ? 1 : (((t + 1) % 5) < 0.26) ? 0.8 : (((t + 0) % 2) < 1.25) ? 0.73 : 0) * (fract(t / 0.25) < 0.86)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 340,
              y: 45,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 690,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "compression-choir",
    name: "Compression Choir",
    group: "creatures",
    description: "One long phrase speeds up from separate falls into tightly packed falling chirps, with bass punctuation.",
    formula: "y = ((((t + 0.5) % 8) < 1.3) ? ((-0.75 + 1.65 * exp(-1.3 * ((t + 0.5) % 8)) * (1 - 2 * fract((3.4 * ((t + 0.5) % 8) + 3.1 * ((t + 0.5) % 8) * ((t + 0.5) % 8)))) + 0.33 * exp(-2 * ((t + 0.5) % 8)) * sin(32 * ((t + 0.5) % 8)))) : (((((t + 0.75) % 2) < 0.24) ? ((-1.25 + 1.05 * exp(-14 * (((t + 0.75) % 2))) * sin(21 * (((t + 0.75) % 2)) + 0 * (((t + 0.75) % 2)) * (((t + 0.75) % 2))))) : ((-2.6 + 0.55 * exp(-9 * ((t + 0) % 1)) + .12 * sin(.7853981634 * t))))))",
    track: {
      steps: 128,
      stepBeats: 0.125,
      stretch: 0.5,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.37*sin(2*tau*p) + 0.16*sin(3*tau*p)",
      sliders: [],
      volume: 0.72,
      pan: 0,
      attack: 0.004,
      release: 0.085,
      send: 0.23,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((((t + 0.5) % 8) < 1.3) ? ((-0.75 + 1.65 * exp(-1.3 * ((t + 0.5) % 8)) * (1 - 2 * fract((3.4 * ((t + 0.5) % 8) + 3.1 * ((t + 0.5) % 8) * ((t + 0.5) % 8)))) + 0.33 * exp(-2 * ((t + 0.5) % 8)) * sin(32 * ((t + 0.5) % 8)))) : (((((t + 0.75) % 2) < 0.24) ? ((-1.25 + 1.05 * exp(-14 * (((t + 0.75) % 2))) * sin(21 * (((t + 0.75) % 2)) + 0 * (((t + 0.75) % 2)) * (((t + 0.75) % 2))))) : ((-2.6 + 0.55 * exp(-9 * ((t + 0) % 1)) + .12 * sin(.7853981634 * t))))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: ".82 * ((((t + 0.5) % 8) < 1.3) ? .94 : (((t + 0.75) % 2) < 0.24) ? .90 : (((t + 0) % 1) < 0.72) ? .66 : 0) * (fract(t / .125) < .92)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 340,
              y: 45,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 690,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "storm-ladders",
    name: "Storm Ladders",
    group: "creatures",
    description: "Bell-like chirps over long three-beat climbs that ripple, then reset into low impacts.",
    formula: "y = ((((t + 1.5) % 6) < 0.38) ? ((-1.25 + 1.75 * exp(-8 * ((t + 1.5) % 6)) + .42 * exp(-4 * ((t + 1.5) % 6)) * sin(33 * ((t + 1.5) % 6) + 12 * ((t + 1.5) % 6) * ((t + 1.5) % 6)))) : (((((t + 0) % 3) < 1.12) ? ((-2.45 + 1.6 * (((t + 0) % 3) / 3) + .20 * sin(15 * ((t + 0) % 3)) * exp(-.55 * ((t + 0) % 3)))) : ((-2.35 + .4 * exp(-9 * ((t + 0) % 1.5)))))))",
    track: {
      steps: 96,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.37*sin(2*tau*p) + 0.16*sin(3*tau*p)",
      sliders: [],
      volume: 0.72,
      pan: 0,
      attack: 0.004,
      release: 0.14,
      send: 0.23,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((((t + 1.5) % 6) < 0.38) ? ((-1.25 + 1.75 * exp(-8 * ((t + 1.5) % 6)) + .42 * exp(-4 * ((t + 1.5) % 6)) * sin(33 * ((t + 1.5) % 6) + 12 * ((t + 1.5) % 6) * ((t + 1.5) % 6)))) : (((((t + 0) % 3) < 1.12) ? ((-2.45 + 1.6 * (((t + 0) % 3) / 3) + .20 * sin(15 * ((t + 0) % 3)) * exp(-.55 * ((t + 0) % 3)))) : ((-2.35 + .4 * exp(-9 * ((t + 0) % 1.5)))))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: ".8 * ((((t + 1.5) % 6) < 0.38) ? 1 : (((t + 0) % 3) < 1.12) ? .78 : (((t + 0) % 1.5) < 0.92) ? .72 : 0) * (fract(t / .25) < .88)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 340,
              y: 45,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 690,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "reverse-menagerie",
    name: "Reverse Menagerie",
    group: "creatures",
    description: "Every other chirp flips from rising to falling; a seven-beat counter-call makes the cycle long.",
    formula: "y = ((((t + 0.4) % 2) < 0.37) ? ((-.94 + ((1 - 2 * (floor((t + .4) / 2) % 2))) * (1.45 * exp(-7 * ((t + 0.4) % 2)) + .24 * exp(-4.5 * ((t + 0.4) % 2)) * sin(24 * ((t + 0.4) % 2) + 18 * ((t + 0.4) % 2) * ((t + 0.4) % 2))))) : (((((t + 1.2) % 7) < 0.54) ? ((-1.64 + 1.35 * exp(-4 * ((t + 1.2) % 7)) * sin(15 * ((t + 1.2) % 7) + 17 * ((t + 1.2) % 7) * ((t + 1.2) % 7)))) : ((-2.38 + .5 * exp(-9 * ((t + 0) % 1)) + .1 * sin(.897597901 * t))))))",
    track: {
      steps: 112,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.37*sin(2*tau*p) + 0.16*sin(3*tau*p)",
      sliders: [],
      volume: 0.72,
      pan: 0,
      attack: 0.004,
      release: 0.09,
      send: 0.23,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.006,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((((t + 0.4) % 2) < 0.37) ? ((-.94 + ((1 - 2 * (floor((t + .4) / 2) % 2))) * (1.45 * exp(-7 * ((t + 0.4) % 2)) + .24 * exp(-4.5 * ((t + 0.4) % 2)) * sin(24 * ((t + 0.4) % 2) + 18 * ((t + 0.4) % 2) * ((t + 0.4) % 2))))) : (((((t + 1.2) % 7) < 0.54) ? ((-1.64 + 1.35 * exp(-4 * ((t + 1.2) % 7)) * sin(15 * ((t + 1.2) % 7) + 17 * ((t + 1.2) % 7) * ((t + 1.2) % 7)))) : ((-2.38 + .5 * exp(-9 * ((t + 0) % 1)) + .1 * sin(.897597901 * t))))))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 230,
            },
            data: {
              formula: ".8 * ((((t + 0.4) % 2) < 0.37) ? 1 : (((t + 1.2) % 7) < 0.54) ? .82 : (((t + 0) % 1) < 0.7) ? .68 : 0) * (fract(t / .25) < .9)",
            },
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 340,
              y: 45,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 690,
              y: 60,
            },
            data: {},
          },
        ],
        edges: [
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
        ],
      },
    },
  },
  {
    id: "chirp",
    name: "Chirp",
    group: "creatures",
    description: "A bird-like chirp at the top of every few bars over low ticks.",
    formula: "y = (t + 8) % 16 < 0.25 ? -2.34 + 1.88 * exp(-15.4 * ((t + 8) % 16)) + 0.938 * sin(31.4 * ((t + 8) % 16)) : (t + 1) % 2 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 1) % 2)) : (t + 0.5) % 8 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 0.5) % 8)) : t % 2 < 1 ? -4.69 + 2.5 * exp(-8.7 * (t % 2)) : 0",
    track: {
      steps: 32,
      stepBeats: 0.25,
      stretch: 0.5,
      octave: 4,
      pitchMode: "semitone",
      waveform: "triangle",
      timbre: "sin(tau*p) + 0.5*sin(2*tau*p) + 0.25*sin(3*tau*p)",
      sliders: [],
      volume: 0.8,
      pan: 0,
      attack: 0.004,
      release: 0.06,
      send: 0.5,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(t + 8) % 16 < 0.25 ? -2.34 + 1.88 * exp(-15.4 * ((t + 8) % 16)) + 0.938 * sin(31.4 * ((t + 8) % 16)) : (t + 1) % 2 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 1) % 2)) : (t + 0.5) % 8 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 0.5) % 8)) : t % 2 < 1 ? -4.69 + 2.5 * exp(-8.7 * (t % 2)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "0.8 * ((t + 8) % 16 < 0.25 ? 1 : (t + 1) % 2 < 0.125 ? 1 : (t + 0.5) % 8 < 0.125 ? 1 : t % 2 < 1 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "chrome-nightingale",
    name: "Chrome Nightingale",
    group: "creatures",
    description: "Huge low thuds and spacious murmurs answer a rare accelerating chirp at the end of every two beats.",
    formula: "y = ((fract(t)<.22 ? (-30 + 36*exp(-16*fract(t))) : fract(t/2)>.76 && fract(t/2)<.99 ? (14 + 16*exp(-8*(fract(t/2)-.76))*sin(15*(fract(t/2)-.76)+75*(fract(t/2)-.76)*(fract(t/2)-.76)) - 9*(fract(t/2)-.76)) : (-17 + 4*exp(-8*fract(t/2)) + (floor(12*(((2*floor(t)+floor(t/4)))%7)/7+0.5) - ((((2*floor(t)+floor(t/4)))%7)==5) + ((((2*floor(t)+floor(t/4)))%7)==6 && 0))/2))) / 12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.66*sin(tau*p)+0.24*sin(2*tau*p)+0.11*sin(5*tau*p)+0.08*sin(9*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.006,
      release: 0.095,
      send: 0.34,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.22 ? (-30 + 36*exp(-16*fract(t))) : fract(t/2)>.76 && fract(t/2)<.99 ? (14 + 16*exp(-8*(fract(t/2)-.76))*sin(15*(fract(t/2)-.76)+75*(fract(t/2)-.76)*(fract(t/2)-.76)) - 9*(fract(t/2)-.76)) : (-17 + 4*exp(-8*fract(t/2)) + (floor(12*(((2*floor(t)+floor(t/4)))%7)/7+0.5) - ((((2*floor(t)+floor(t/4)))%7)==5) + ((((2*floor(t)+floor(t/4)))%7)==6 && 0))/2))) / 12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.22 ? .98 : (fract(t/2)>.76 && fract(t/2)<.99) ? .87 : (fract(t/2)<.44 && fract(t)>.28) ? .52 : 0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "night-heron",
    name: "Night Heron",
    group: "creatures",
    description: "Deep paired impacts and short offbeat murmurs leave room for a rare chirp that scoops toward the harmony.",
    formula: "y = ((fract(t)<.17?(-26+33*exp(-15*fract(t))):(fract(t/2)>.76 && fract(t/2)<.99)?(7+((floor(12*((((3*floor(t/2)+floor(t/8)))%7+7)%7)/7+0.5)-(((((3*floor(t/2)+floor(t/8)))%7+7)%7)==5))+(((((3*floor(t/2)+floor(t/8)))%7+7)%7)==6))+11*exp(-16*(fract(t/2)-.76))*sin(19*(fract(t/2)-.76)+74*(fract(t/2)-.76)*(fract(t/2)-.76))):(-21+(floor(12*((((floor(4*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(4*t)+floor(t/4)))%7+7)%7)==5))/2+3.8*exp(-11*fract(t/2)))))/12",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.73*sin(tau*p)+0.17*sin(3*tau*p)+0.10*sin(7*tau*p)+0.06*sin(11*tau*p)",
      sliders: [],
      volume: 0.76,
      pan: 0,
      attack: 0.004,
      release: 0.105,
      send: 0.34,
      swing: 0,
      playMode: "glide",
      quantize: false,
      glide: 0.004,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "((fract(t)<.17?(-26+33*exp(-15*fract(t))):(fract(t/2)>.76 && fract(t/2)<.99)?(7+((floor(12*((((3*floor(t/2)+floor(t/8)))%7+7)%7)/7+0.5)-(((((3*floor(t/2)+floor(t/8)))%7+7)%7)==5))+(((((3*floor(t/2)+floor(t/8)))%7+7)%7)==6))+11*exp(-16*(fract(t/2)-.76))*sin(19*(fract(t/2)-.76)+74*(fract(t/2)-.76)*(fract(t/2)-.76))):(-21+(floor(12*((((floor(4*t)+floor(t/4)))%7+7)%7)/7+0.5)-(((((floor(4*t)+floor(t/4)))%7+7)%7)==5))/2+3.8*exp(-11*fract(t/2)))))/12",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 45,
            },
            data: {
              formula: "(fract(t)<.17?.96: fract(t/2)>.76 && fract(t/2)<.99?.85: (fract(4*t)<.70 && (floor(4*t)%8==2 ||floor(4*t)%8==5))?.65:0)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 44,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 77,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "engine-beast",
    name: "Engine Beast",
    group: "creatures",
    description: "Rattling motor starts fall into deep stretched engine growls, with high sputters in between.",
    formula: "y = (floor(t)%8==0 || floor(t)%8==4) ? (1.9-3.4*fract(12*t)+0.3*sin(6.2831853*fract(12*t))) : (floor(t)%8==1 || floor(t)%8==5) ? (1.3-3.9*(1-exp(-5*fract(t)))) : floor(t)%8==7 ? (1.6-2.6*fract(16*t)) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.72*sin(tau*p+4.8*sin(2*tau*p+1.6*sin(5*tau*p)))+0.19*sin(7*tau*p)+0.09*sin(13*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.001,
      release: 0.1,
      send: 0.17,
      swing: 0.035,
      playMode: "glide",
      quantize: false,
      glide: 0.002,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==4) ? (1.9-3.4*fract(12*t)+0.3*sin(6.2831853*fract(12*t))) : (floor(t)%8==1 || floor(t)%8==5) ? (1.3-3.9*(1-exp(-5*fract(t)))) : floor(t)%8==7 ? (1.6-2.6*fract(16*t)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==4) ? (fract(12*t)<0.67 ? 0.72 : 0) : (floor(t)%8==1 || floor(t)%8==5) ? 0.88 : floor(t)%8==7 ? (fract(16*t)<0.5 ? 0.48 : 0) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "laser-swarm",
    name: "Laser Swarm",
    group: "creatures",
    description: "Three high chirps answer a diving laser, with a fast swarm at each phrase boundary.",
    formula: "y = (floor(t)%8==0) ? (2.7-5.2*(1-exp(-6*fract(t)))) : (floor(t)%8==2 || floor(t)%8==3 || floor(t)%8==5) ? (2.1-2.8*fract(t)+0.55*sin(6.2831853*fract(t))) : floor(t)%8==7 ? (3.1-4.0*fract(16*t)) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.58*sin(tau*p+3.8*sin(3*tau*p))+0.28*sin(8*tau*p+sin(2*tau*p))+0.14*sin(15*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.001,
      release: 0.07,
      send: 0.36,
      swing: 0.09,
      playMode: "glide",
      quantize: false,
      glide: 0.002,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0) ? (2.7-5.2*(1-exp(-6*fract(t)))) : (floor(t)%8==2 || floor(t)%8==3 || floor(t)%8==5) ? (2.1-2.8*fract(t)+0.55*sin(6.2831853*fract(t))) : floor(t)%8==7 ? (3.1-4.0*fract(16*t)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0) ? 0.89 : (floor(t)%8==2 || floor(t)%8==3 || floor(t)%8==5) ? (fract(4*t)<0.7 ? 0.61 : 0) : floor(t)%8==7 ? (fract(16*t)<0.43 ? 0.55 : 0) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "talking-machine",
    name: "Talking Machine",
    group: "creatures",
    description: "Wah-woh-waaah: vowel-like swoops in a three-part answering phrase, nasal and robotic.",
    formula: "y = (floor(t)%8==0 || floor(t)%8==1) ? (-0.4+1.6*sin(3.14159265*fract(t))) : (floor(t)%8==3 || floor(t)%8==5) ? (0.5-1.7*fract(t)+0.2*sin(12.56637*fract(t))) : floor(t)%8==7 ? (0.3+1.1*sin(3.14159265*fract(t))) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.68*sin(tau*p+3.6*sin(2*tau*p+1.5*sin(5*tau*p)))+0.24*sin(5*tau*p+1.7*sin(tau*p))+0.08*sin(9*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.012,
      release: 0.23,
      send: 0.26,
      swing: 0.14,
      playMode: "glide",
      quantize: false,
      glide: 0.016,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==1) ? (-0.4+1.6*sin(3.14159265*fract(t))) : (floor(t)%8==3 || floor(t)%8==5) ? (0.5-1.7*fract(t)+0.2*sin(12.56637*fract(t))) : floor(t)%8==7 ? (0.3+1.1*sin(3.14159265*fract(t))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==1) ? 0.74 : (floor(t)%8==3 || floor(t)%8==5) ? 0.63 : floor(t)%8==7 ? 0.83 : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "tesla-coil",
    name: "Tesla Coil",
    group: "creatures",
    description: "Accelerating zaps give way to broken arcs and a sudden voltage drop.",
    formula: "y = (floor(t)%8==0 || floor(t)%8==4) ? (2.9-3.9*fract(18*t)) : floor(t)%8==2 ? (2.4-4.4*fract(t)+0.5*sin(18.84956*fract(t))) : floor(t)%8==7 ? (2.5-5.0*(1-exp(-7*fract(t)))) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.52*sin(tau*p+6*sin(4*tau*p+2*sin(7*tau*p)))+0.28*sin(11*tau*p)+0.2*sin(19*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.001,
      release: 0.058,
      send: 0.4,
      swing: 0.045,
      playMode: "glide",
      quantize: false,
      glide: 0.002,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==4) ? (2.9-3.9*fract(18*t)) : floor(t)%8==2 ? (2.4-4.4*fract(t)+0.5*sin(18.84956*fract(t))) : floor(t)%8==7 ? (2.5-5.0*(1-exp(-7*fract(t)))) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0 || floor(t)%8==4) ? (fract(18*t)<0.54 ? 0.66 : 0) : floor(t)%8==2 ? 0.75 : floor(t)%8==7 ? 0.93 : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "scrap-press",
    name: "Scrap Press",
    group: "creatures",
    description: "An uneven pneumatic rattle, a deep hydraulic slam and a dry metallic double clank.",
    formula: "y = (floor(t)%8==0) ? (1.3-2.8*fract(10*t)) : (floor(t)%8==2 || floor(t)%8==6) ? (0.7-3.2*(1-exp(-10*fract(t)))) : floor(t)%8==5 ? (1.9-2.9*fract(8*t)) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.64*sin(tau*p+2.6*sin(2*tau*p))+0.23*sin(6*tau*p)+0.13*sin(14*tau*p)",
      sliders: [],
      volume: 0.73,
      pan: 0,
      attack: 0.001,
      release: 0.075,
      send: 0.11,
      swing: 0.04,
      playMode: "glide",
      quantize: false,
      glide: 0.002,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%8==0) ? (1.3-2.8*fract(10*t)) : (floor(t)%8==2 || floor(t)%8==6) ? (0.7-3.2*(1-exp(-10*fract(t)))) : floor(t)%8==5 ? (1.9-2.9*fract(8*t)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%8==0) ? (fract(10*t)<0.64 ? 0.59 : 0) : (floor(t)%8==2 || floor(t)%8==6) ? 0.98 : floor(t)%8==5 ? (fract(8*t)<0.55 ? 0.63 : 0) : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
  {
    id: "void-transmission",
    name: "Void Transmission",
    group: "creatures",
    description: "Two deep falling calls with chirping offbeat replies between, then a very fast burst to close.",
    formula: "y = (floor(t)%16==0 || floor(t)%16==8) ? (2.4-5.4*(1-exp(-5*fract(t)))) : (floor(t)%16==2 || floor(t)%16==6 || floor(t)%16==10 || floor(t)%16==14) ? (0.7+0.9*sin(6.2831853*fract(4*t))-1.6*fract(t)) : (floor(t)%16==15 && fract(16*t)<0.52) ? (3.0-4.5*fract(16*t)) : 0",
    track: {
      steps: 128,
      stepBeats: 0.25,
      stretch: 1,
      octave: 4,
      pitchMode: "semitone",
      waveform: "custom",
      timbre: "0.7*sin(tau*p+4.8*sin(tau*p+1.5*sin(5*tau*p)))+0.2*sin(9*tau*p)+0.1*sin(15*tau*p)",
      sliders: [],
      volume: 0.7,
      pan: 0,
      attack: 0.003,
      release: 0.12,
      send: 0.32,
      swing: 0.12,
      playMode: "glide",
      quantize: false,
      glide: 0.008,
      graph: {
        nodes: [
          {
            id: "f",
            type: "expr",
            position: {
              x: 0,
              y: 0,
            },
            data: {
              formula: "(floor(t)%16==0 || floor(t)%16==8) ? (2.4-5.4*(1-exp(-5*fract(t)))) : (floor(t)%16==2 || floor(t)%16==6 || floor(t)%16==10 || floor(t)%16==14) ? (0.7+0.9*sin(6.2831853*fract(4*t))-1.6*fract(t)) : (floor(t)%16==15 && fract(16*t)<0.52) ? (3.0-4.5*fract(16*t)) : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 0,
              y: 320,
            },
            data: {
              formula: "(floor(t)%16==0 || floor(t)%16==8) ? (fract(4*t)<0.94 ? 0.94 : 0) : (floor(t)%16==2 || floor(t)%16==6 || floor(t)%16==10 || floor(t)%16==14) ? (fract(4*t)<0.62 ? 0.61 : 0) : (floor(t)%16==15 && fract(16*t)<0.52) ? 0.55 : 0",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 560,
              y: 123,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 280,
              y: 156,
            },
            data: {
              op: "mul",
              b: 12,
            },
          },
        ],
        edges: [
          {
            id: "v.out-out.velocity",
            source: "v",
            sourceHandle: "out",
            target: "out",
            targetHandle: "velocity",
          },
          {
            id: "f.out-oct.a",
            source: "f",
            sourceHandle: "out",
            target: "oct",
            targetHandle: "a",
          },
          {
            id: "oct.out-out.pitch",
            source: "oct",
            sourceHandle: "out",
            target: "out",
            targetHandle: "pitch",
          },
        ],
      },
    },
  },
];
