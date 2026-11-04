/**
 * The function library: piecewise rave riffs, wild glide curves and more, made in SoundFunc and
 * saved from My functions (generated from a soundfunc-functions.json export). Each is a whole
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
    id: "hardstyle-euclid",
    name: "Hardstyle Euclid",
    group: "rave",
    description:
      "A falling kick on every beat, then a riff on a Euclidean 5-in-16 grid that climbs in thirds. All one piecewise function.",
    formula:
      "y = fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(5 * (floor(4 * t) + 1) / 16) > floor(5 * floor(4 * t) / 16) && fract(4 * t) < 0.8 ? -1 + round(12 * (3 * (floor(4 * t) % 7)) / 7) / 12 + exp(-10 * fract(4 * t)) / 4 : fract(t) >= 0.75 && fract(t) < 0.82 ? 2 : 0",
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
                "fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(5 * (floor(4 * t) + 1) / 16) > floor(5 * floor(4 * t) / 16) && fract(4 * t) < 0.8 ? -1 + round(12 * (3 * (floor(4 * t) % 7)) / 7) / 12 + exp(-10 * fract(4 * t)) / 4 : fract(t) >= 0.75 && fract(t) < 0.82 ? 2 : 0",
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
              formula:
                "0.8 * (fract(t) < 0.25 ? 1 : floor(5 * (floor(4 * t) + 1) / 16) > floor(5 * floor(4 * t) / 16) && fract(4 * t) < 0.8 ? 1 : fract(t) >= 0.75 && fract(t) < 0.82 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
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
    id: "hardstyle-answer",
    name: "Hardstyle Answer",
    group: "rave",
    description:
      "Kick on the beat, sixteenth riff between, and a high answer at the end of every second beat that steps round the scale.",
    formula:
      "y = fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : fract(t) >= 0.75 && floor(t) % 2 == 1 && fract(t) < 0.82 ? 2 - round(12 * ((3 * floor(t / 2) + 5) % 7) / 7) / 12 : fract(4 * t) < 0.75 ? -1 + round(12 * (floor(4 * t) % 7) / 7) / 12 + (floor(4 * t) % 4 == 3) + exp(-12 * fract(4 * t)) / 6 : 0",
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
                "fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : fract(t) >= 0.75 && floor(t) % 2 == 1 && fract(t) < 0.82 ? 2 - round(12 * ((3 * floor(t / 2) + 5) % 7) / 7) / 12 : fract(4 * t) < 0.75 ? -1 + round(12 * (floor(4 * t) % 7) / 7) / 12 + (floor(4 * t) % 4 == 3) + exp(-12 * fract(4 * t)) / 6 : 0",
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
                "0.8 * (fract(t) < 0.25 ? 1 : fract(t) >= 0.75 && floor(t) % 2 == 1 && fract(t) < 0.82 ? 1 : fract(4 * t) < 0.75 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
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
    id: "hard-groove",
    name: "Hard Groove",
    group: "rave",
    description:
      "Kick on the beat, a slide down on every third sixteenth, short low stabs in between: a rolling three-against-four.",
    formula:
      "y = fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4 * t) % 3 == 0 ? 0.6 + round(12 * (floor(4 * t) % 7) / 7) / 12 - 1.6 * fract(4 * t) : fract(4 * t) < 0.8 ? -1 + exp(-12 * fract(4 * t)) / 6 : 0",
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
                "fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4 * t) % 3 == 0 ? 0.6 + round(12 * (floor(4 * t) % 7) / 7) / 12 - 1.6 * fract(4 * t) : fract(4 * t) < 0.8 ? -1 + exp(-12 * fract(4 * t)) / 6 : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 27,
            },
            data: {
              formula:
                "0.8 * (fract(t) < 0.25 ? 1 : floor(4 * t) % 3 == 0 ? 1 : fract(4 * t) < 0.8 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 17,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 50,
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
    id: "mad-man",
    name: "Mad Man",
    group: "rave",
    description:
      "Four beats of kick and stabs, then a sawtooth climb that never stops, faster and higher to the end. A build in one formula.",
    formula:
      "y = fract(t / 2) < 0.125 ? -2 + 3 * exp(-20 * fract(t)) : t >= 4 ? (t - 4) / 4 + 0.2 - 1.2 * fract(4 * t) : fract(4 * t) < 0.8 ? 1.5833 - log(2 * (1 + floor(4 * t) % 6)) / 2.3026 : 0",
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
                "fract(t / 2) < 0.125 ? -2 + 3 * exp(-20 * fract(t)) : t >= 4 ? (t - 4) / 4 + 0.2 - 1.2 * fract(4 * t) : fract(4 * t) < 0.8 ? 1.5833 - log(2 * (1 + floor(4 * t) % 6)) / 2.3026 : 0",
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
              formula:
                "0.8 * (fract(t / 2) < 0.125 ? 1 : t >= 4 ? 1 : fract(4 * t) < 0.8 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 8,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 41,
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
    id: "hardstyle-fifths",
    name: "Hardstyle Fifths",
    group: "rave",
    description:
      "Kick, then a riff that walks the circle of fifths, a lift on every third sixteenth and a falling zap closing each six.",
    formula:
      "y = fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4 * t) % 6 == 5 ? 1.4 - 2 * fract(4 * t) : fract(4 * t) < 0.85 ? -1 + round(12 * (5 * (floor(4 * t) % 7)) / 7) / 12 + (floor(4 * t) % 3 == 0) + 3 * exp(-9 * fract(4 * t)) / 10 : 0",
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
                "fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4 * t) % 6 == 5 ? 1.4 - 2 * fract(4 * t) : fract(4 * t) < 0.85 ? -1 + round(12 * (5 * (floor(4 * t) % 7)) / 7) / 12 + (floor(4 * t) % 3 == 0) + 3 * exp(-9 * fract(4 * t)) / 10 : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 36,
            },
            data: {
              formula:
                "0.8 * (fract(t) < 0.25 ? 1 : floor(4 * t) % 6 == 5 ? 1 : fract(4 * t) < 0.85 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 26,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 59,
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
    id: "hardstyle-mirror",
    name: "Hardstyle Mirror",
    group: "rave",
    description:
      "Hardstyle Fifths with a twist: the zaps flip up and down every bar, and every third beat runs the riff backwards.",
    formula:
      "y = fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4 * t) % 6 == 5 ? 0.4 + (1 - 2 * fract(4 * t)) * (-1)^floor(t / 4) : fract(4 * t) < 0.85 ? -1 + round(12 * (5 * floor(4 * t) * (1 - 2 * (floor(t) % 3 == 2)) % 7 + 4) / 7) / 12 + (floor(4 * t) % 3 == 0) + 3 * exp(-9 * fract(4 * t)) / 10 : 0",
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
                "fract(t) < 0.25 ? -2 + 3 * exp(-20 * fract(t)) : floor(4 * t) % 6 == 5 ? 0.4 + (1 - 2 * fract(4 * t)) * (-1)^floor(t / 4) : fract(4 * t) < 0.85 ? -1 + round(12 * (5 * floor(4 * t) * (1 - 2 * (floor(t) % 3 == 2)) % 7 + 4) / 7) / 12 + (floor(4 * t) % 3 == 0) + 3 * exp(-9 * fract(4 * t)) / 10 : 0",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 54,
            },
            data: {
              formula:
                "0.8 * (fract(t) < 0.25 ? 1 : floor(4 * t) % 6 == 5 ? 1 : fract(4 * t) < 0.85 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
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
    id: "step-wave",
    name: "Step Wave",
    group: "curves",
    description:
      "Two beats of rising steps, a deep sine dive, then a jittery hum: three moods in a four-beat cycle.",
    formula:
      "y = t % 4 < 2 ? floor(4 * (t % 4)) - 7 : t % 4 < 3 ? -1 - 23 * sin(pi * (t % 4 - 2) / 2)^2 : -24 + 12 * sin(pi * (t % 4 - 3))^2",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 7,
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
                "t % 4 < 2 ? floor(4 * (t % 4)) - 7 : t % 4 < 3 ? -1 - 23 * sin(pi * (t % 4 - 2) / 2)^2 : -24 + 12 * sin(pi * (t % 4 - 3))^2",
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
    id: "block-steps",
    name: "Block Steps",
    group: "curves",
    description:
      "Two notes trading on the sixteenths, the pair dropping to a lower register every four beats. Blocky and hypnotic.",
    formula:
      "y = t < 4 ? 2 + 2 * (floor(4 * t) % 2) : t < 8 ? 0.5 + 2 * (floor(4 * t) % 2) : -1 + 2 * (floor(4 * t) % 2)",
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
                "t < 4 ? 2 + 2 * (floor(4 * t) % 2) : t < 8 ? 0.5 + 2 * (floor(4 * t) % 2) : -1 + 2 * (floor(4 * t) % 2)",
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
    id: "mock-kicks",
    name: "Mock Kicks",
    group: "rave",
    description:
      "Two beats of fast sine wobble, then a slower, fading one: kick-like pulses drawn with sines.",
    formula:
      "y = t % 4 < 2 ? 2.2 * sin(6 * pi * (t % 2)) * (1 - 0.3 * (t % 2)) : 2.5 * sin(16 * pi * (t % 1)) * exp(-0.8 * (t % 2))",
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
                "t % 4 < 2 ? 2.2 * sin(6 * pi * (t % 2)) * (1 - 0.3 * (t % 2)) : 2.5 * sin(16 * pi * (t % 1)) * exp(-0.8 * (t % 2))",
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
    id: "harudu",
    name: "Harudu",
    group: "rave",
    description:
      "A short kick drop on every beat, a low pulse, and a squiggly lead that bursts out at the end of each bar.",
    formula:
      "y = fract(t) < 0.2 ? 1.5 * exp(-18 * fract(t)) - 1.65 : t % 4 < 2.5 ? -1.35 + 0.55 * exp(-10 * fract(4 * t)) : (1 + 3 * (floor(8 * t) % 4) + 5 * (floor(2 * t) % 2)) / 12 + 0.22 * sin(36 * t)",
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
                "fract(t) < 0.2 ? 1.5 * exp(-18 * fract(t)) - 1.65 : t % 4 < 2.5 ? -1.35 + 0.55 * exp(-10 * fract(4 * t)) : (1 + 3 * (floor(8 * t) % 4) + 5 * (floor(2 * t) % 2)) / 12 + 0.22 * sin(36 * t)",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 54,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 17,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 50,
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
    id: "donk-dance",
    name: "Donk Dance",
    group: "rave",
    description:
      "A low thud on the one of every four sixteenths, a bouncing high note on every third: the bouncy donk.",
    formula:
      "y = floor(4 * t) % 4 == 0 ? -1.25 : floor(4 * t) % 3 == 0 ? (1 + 6 * (floor(2 * t) % 2) + 10 * exp(-7 * fract(4 * t))) / 12 : (-6 + 12 * (floor(4 * t) % 2)) / 12",
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
                "floor(4 * t) % 4 == 0 ? -1.25 : floor(4 * t) % 3 == 0 ? (1 + 6 * (floor(2 * t) % 2) + 10 * exp(-7 * fract(4 * t))) / 12 : (-6 + 12 * (floor(4 * t) % 2)) / 12",
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
    id: "cyberpunk",
    name: "Cyberpunk",
    group: "rave",
    description:
      "A square-wave growl: a hard drop every bar, then a buzzing riff that decays and builds again.",
    formula:
      "y = t % 4 < 0.45 ? 3.2 * exp(-14 * (t % 4)) - 1.75 : t % 4 < 2 ? -0.75 + 1.15 * sin(6 * pi * t) + 0.22 * sin(30 * pi * t) : t % 4 < 2.45 ? 2.2 * cos(38 * t) * exp(-3.5 * (t % 1)) : -1.45 + 2.4 * sin(12 * pi * t) * (1 - 0.2 * (t % 2))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 3,
      pitchMode: "semitone",
      waveform: "square",
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
                "t % 4 < 0.45 ? 3.2 * exp(-14 * (t % 4)) - 1.75 : t % 4 < 2 ? -0.75 + 1.15 * sin(6 * pi * t) + 0.22 * sin(30 * pi * t) : t % 4 < 2.45 ? 2.2 * cos(38 * t) * exp(-3.5 * (t % 1)) : -1.45 + 2.4 * sin(12 * pi * t) * (1 - 0.2 * (t % 2))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 63,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 26,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 59,
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
    id: "tsiki",
    name: "Tsiki",
    group: "rave",
    description:
      "Sharp spikes every two beats over a quiet ticking bed, square and short. More rhythm than melody.",
    formula:
      "y = t % 2 < (0.017) ? 2.679 * exp(-4 * (t % 2)) + 1.093 : t % 2 < 6 ? 0.596 + (-0.013) * cos(4 * pi * t) + (-0.19) * sin(3 * pi * t) : t % 32 < 0.567 ? 3.651 * cos(47 * t) * exp(-4.705 * (t % 2)) : -4.764 - 2.285 * cos(48 * pi * t) * ((-2) - 0.259 * (t % 8))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "semitone",
      waveform: "square",
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
                "t % 2 < (0.017) ? 2.679 * exp(-4 * (t % 2)) + 1.093 : t % 2 < 6 ? 0.596 + (-0.013) * cos(4 * pi * t) + (-0.19) * sin(3 * pi * t) : t % 32 < 0.567 ? 3.651 * cos(47 * t) * exp(-4.705 * (t % 2)) : -4.764 - 2.285 * cos(48 * pi * t) * ((-2) - 0.259 * (t % 8))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 63,
            },
            data: {
              formula: "0.378 * (fract(t / 0.25) < 0.323)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 26,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 473,
              y: -141,
            },
            data: {
              op: "mul",
              b: 6,
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
    id: "tea-spoon",
    name: "Tea Spoon",
    group: "rave",
    description:
      "Little upward flicks in pairs: a spoon tapping the cup, on a square wave.",
    formula:
      "y = t % 2 < (0.962) ? 0.341 * exp(-12 * (t % 2)) + 0.223 : t % 2 < 4 ? (2.203) + (-0.278) * cos(2 * pi * t) + (0.788) * sin(3 * pi * t) : t % 64 < 1.189 ? 3.833 * cos(50 * t) * exp(-1.191 * (t % 2)) : -1.382 - 27.198 * sin(48 * pi * t) * ((-24) - 0.03 * (t % 12))",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 2,
      pitchMode: "semitone",
      waveform: "square",
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
                "t % 2 < (0.962) ? 0.341 * exp(-12 * (t % 2)) + 0.223 : t % 2 < 4 ? (2.203) + (-0.278) * cos(2 * pi * t) + (0.788) * sin(3 * pi * t) : t % 64 < 1.189 ? 3.833 * cos(50 * t) * exp(-1.191 * (t % 2)) : -1.382 - 27.198 * sin(48 * pi * t) * ((-24) - 0.03 * (t % 12))",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 63,
            },
            data: {
              formula: "0.378 * (fract(t / 0.25) < 0.323)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 26,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 473,
              y: -141,
            },
            data: {
              op: "mul",
              b: 6,
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
    id: "stair-riser",
    name: "Stair Riser",
    group: "fx",
    description:
      "A note that climbs a step at a time over a held low pedal: a riser played as notes.",
    formula:
      "y = 0.5 * t * (4 * abs(t - floor(t + 0.75) + 0.25) - 1)^2 * (4 * abs(t * (4 * abs(t - floor(t + 0.75) + 0.25) - 1) - floor(t * (4 * abs(t - floor(t + 0.75) + 0.25) - 1) + 0.75) + 0.25) - 1)^2",
    track: {
      steps: 64,
      stepBeats: 0.25,
      stretch: 1,
      octave: 1,
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
                "0.5 * t * (4 * abs(t - floor(t + 0.75) + 0.25) - 1)^2 * (4 * abs(t * (4 * abs(t - floor(t + 0.75) + 0.25) - 1) - floor(t * (4 * abs(t - floor(t + 0.75) + 0.25) - 1) + 0.75) + 0.25) - 1)^2",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 54,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
            },
          },
          {
            id: "out",
            type: "output",
            position: {
              x: 840,
              y: 17,
            },
            data: {},
          },
          {
            id: "oct",
            type: "math",
            position: {
              x: 560,
              y: 50,
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
    id: "chirp",
    name: "Chirp",
    group: "rave",
    description:
      "A bird-like chirp at the top of every few bars over low ticks.",
    formula:
      "y = (t + 8) % 16 < 0.25 ? -2.34 + 1.88 * exp(-15.4 * ((t + 8) % 16)) + 0.938 * sin(31.4 * ((t + 8) % 16)) : (t + 1) % 2 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 1) % 2)) : (t + 0.5) % 8 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 0.5) % 8)) : t % 2 < 1 ? -4.69 + 2.5 * exp(-8.7 * (t % 2)) : 0",
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
              formula:
                "(t + 8) % 16 < 0.25 ? -2.34 + 1.88 * exp(-15.4 * ((t + 8) % 16)) + 0.938 * sin(31.4 * ((t + 8) % 16)) : (t + 1) % 2 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 1) % 2)) : (t + 0.5) % 8 < 0.125 ? 1.98 + 1.25 * exp(-50 * ((t + 0.5) % 8)) : t % 2 < 1 ? -4.69 + 2.5 * exp(-8.7 * (t % 2)) : 0",
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
                "0.8 * ((t + 8) % 16 < 0.25 ? 1 : (t + 1) % 2 < 0.125 ? 1 : (t + 0.5) % 8 < 0.125 ? 1 : t % 2 < 1 ? 1 : 0) * (fract(t / 0.25) < 0.85)",
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
    id: "trrr-pow-pow-pow",
    name: "Trrr Pow Pow Pow",
    group: "rave",
    description:
      "A fast drum-roll zigzag, then three long falling “pows”. Say the name out loud and you know it.",
    formula:
      "y = floor(t) % 16 == 0 ? 2.5 - 5 * (5 * t % 1) : -2 <= t && t < 0 || 14 <= t && t < 16 ? 2.3 - 4.6 * (t % 1) : 2.3 - 4.6 * (t / 2 % 1)",
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
              formula:
                "floor(t) % 16 == 0 ? 2.5 - 5 * (5 * t % 1) : -2 <= t && t < 0 || 14 <= t && t < 16 ? 2.3 - 4.6 * (t % 1) : 2.3 - 4.6 * (t / 2 % 1)",
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
    id: "runaway-riser",
    name: "Runaway Riser",
    group: "fx",
    description:
      "A kick, a ripple and a riser that grows as x², fitted into three octaves so the whole climb is heard.",
    formula:
      "y = 0.002354 * (t / 0.25 % 1 >= 0.55 ? 1.25 * (t / 0.25)^2 - 5 : t / 0.25 % 1.6 < 0.8 ? 1.49 * tanh(5 * sin(pi * (t / 0.25) / 2)) + 0.91 : -2.4 + 2.98 * sqrt(max(0, 1 - 3.11 * (t / 0.25 % 2 - 1)^2))) - 1.489",
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
              y: 15,
            },
            data: {
              formula:
                "0.002354 * (t / 0.25 % 1 >= 0.55 ? 1.25 * (t / 0.25)^2 - 5 : t / 0.25 % 1.6 < 0.8 ? 1.49 * tanh(5 * sin(pi * (t / 0.25) / 2)) + 0.91 : -2.4 + 2.98 * sqrt(max(0, 1 - 3.11 * (t / 0.25 % 2 - 1)^2))) - 1.489",
            },
          },
          {
            id: "v",
            type: "expr",
            position: {
              x: 280,
              y: 69,
            },
            data: {
              formula: "0.8 * (fract(t / 0.25) < 0.85)",
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
];
