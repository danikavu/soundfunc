import { midiToFreq } from './music';
import { audibleTracks, patternBeats, renderTrack, type Note, type Project, type Track } from './project';

const LOOKAHEAD_SEC = 0.12;
const TICK_MS = 25;

interface Bus {
  gain: GainNode;
  pan: StereoPannerNode;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private analyser!: AnalyserNode;
  private noise!: AudioBuffer;
  private buses = new Map<string, Bus>();

  private project: Project | null = null;
  private noteCache = new Map<string, Note[]>();
  private timer: number | null = null;
  private originTime = 0;
  private originBeat = 0;
  private scheduledBeat = 0;
  private bpm = 90;
  playing = false;

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = this.makeImpulse(3.6);

    this.dry.connect(comp);
    this.wet.connect(verb).connect(comp);
    comp.connect(this.master).connect(this.analyser).connect(ctx.destination);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  private makeImpulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  private bus(track: Track): Bus {
    const ctx = this.ensure();
    let b = this.buses.get(track.id);
    if (!b) {
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      gain.connect(pan);
      pan.connect(this.dry);
      pan.connect(this.wet);
      b = { gain, pan };
      this.buses.set(track.id, b);
    }
    b.gain.gain.setTargetAtTime(track.volume, ctx.currentTime, 0.02);
    b.pan.pan.setTargetAtTime(track.pan, ctx.currentTime, 0.02);
    return b;
  }

  setProject(project: Project) {
    if (this.project && this.ctx && project.song.bpm !== this.bpm) {
      // re-anchor so tempo changes don't jump the playhead
      this.originBeat = this.beatAt(this.ctx.currentTime);
      this.originTime = this.ctx.currentTime;
    }
    this.project = project;
    this.bpm = project.song.bpm;
    this.noteCache.clear();
    if (this.ctx) {
      const r = project.song.reverb;
      this.wet.gain.setTargetAtTime(r * 0.9, this.ctx.currentTime, 0.05);
      this.dry.gain.setTargetAtTime(1 - r * 0.45, this.ctx.currentTime, 0.05);
      for (const t of project.tracks) if (this.buses.has(t.id)) this.bus(t);
    }
  }

  private beatAt(time: number): number {
    return this.originBeat + ((time - this.originTime) * this.bpm) / 60;
  }

  private timeAt(beat: number): number {
    return this.originTime + ((beat - this.originBeat) * 60) / this.bpm;
  }

  /** Current beat position (since play started), or null when stopped. */
  position(): number | null {
    if (!this.playing || !this.ctx) return null;
    return Math.max(0, this.beatAt(this.ctx.currentTime - (this.ctx.outputLatency || 0)));
  }

  async play() {
    const ctx = this.ensure();
    if (ctx.state !== 'running') await ctx.resume();
    if (this.project) this.setProject(this.project);
    this.originTime = ctx.currentTime + 0.05;
    this.originBeat = 0;
    this.scheduledBeat = 0;
    this.playing = true;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.ctx) {
      // quick fade so ringing voices don't click
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.08);
      this.master.gain.setValueAtTime(0.8, now + 0.25);
      // detach the old buses (and every voice already scheduled on them) once faded
      const old = [...this.buses.values()];
      this.buses.clear();
      window.setTimeout(() => old.forEach((b) => b.pan.disconnect()), 150);
    }
  }

  private notesFor(track: Track, loop: number): Note[] {
    const key = `${track.id}:${loop}`;
    let notes = this.noteCache.get(key);
    if (!notes) {
      notes = renderTrack(track, this.project!.song, loop, false).notes;
      this.noteCache.set(key, notes);
      if (this.noteCache.size > 256) this.noteCache.delete(this.noteCache.keys().next().value!);
    }
    return notes;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.project) return;
    const from = this.scheduledBeat;
    const to = this.beatAt(ctx.currentTime + LOOKAHEAD_SEC);
    if (to <= from) return;
    this.scheduledBeat = to;
    const secPerBeat = 60 / this.bpm;

    for (const track of audibleTracks(this.project.tracks)) {
      const len = patternBeats(track);
      if (len <= 0) continue;
      const bus = this.bus(track);
      for (let k = Math.floor(from / len); k * len < to; k++) {
        for (const note of this.notesFor(track, k)) {
          const beat = k * len + note.beat;
          if (beat < from || beat >= to) continue;
          this.voice(track, bus, this.timeAt(beat), note.duration * secPerBeat, note.freq, note.velocity);
        }
      }
    }
  }

  preview(track: Track, midi: number, velocity = 0.8) {
    const ctx = this.ensure();
    if (ctx.state !== 'running') void ctx.resume();
    if (this.project) this.setProject(this.project);
    this.voice(track, this.bus(track), ctx.currentTime + 0.01, 0.35, midiToFreq(midi), velocity);
  }

  waveform(out: Float32Array<ArrayBuffer>): boolean {
    if (!this.ctx) return false;
    this.analyser.getFloatTimeDomainData(out);
    return true;
  }

  // ---------- voices ----------

  private voice(track: Track, bus: Bus, when: number, dur: number, freq: number, vel: number) {
    const ctx = this.ctx!;
    const amp = ctx.createGain();
    amp.connect(bus.gain);
    const peak = 0.32 * vel;
    const a = Math.max(0.003, track.attack);
    const r = Math.max(0.02, track.release);
    const nodes: AudioScheduledSourceNode[] = [];
    let end = when + dur + r;

    const osc = (type: OscillatorType, f: number, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      nodes.push(o);
      return o;
    };
    const lowpass = (f: number, q = 0.7) => {
      const l = ctx.createBiquadFilter();
      l.type = 'lowpass';
      l.frequency.value = f;
      l.Q.value = q;
      return l;
    };
    const sustainEnv = (level: number) => {
      amp.gain.setValueAtTime(0, when);
      amp.gain.linearRampToValueAtTime(level, when + a);
      amp.gain.setValueAtTime(level, Math.max(when + a, when + dur));
      amp.gain.setTargetAtTime(0, Math.max(when + a, when + dur), r / 4);
    };

    switch (track.waveform) {
      case 'bell': {
        // FM: inharmonic modulator gives the struck-metal shimmer
        const car = osc('sine', freq);
        const mod = osc('sine', freq * 3.5);
        const idx = ctx.createGain();
        idx.gain.setValueAtTime(freq * 2.2, when);
        idx.gain.exponentialRampToValueAtTime(freq * 0.05, when + 1.4);
        mod.connect(idx).connect(car.frequency);
        car.connect(amp);
        const tail = Math.max(1.6, dur + r);
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(peak, when + 0.004);
        amp.gain.exponentialRampToValueAtTime(0.0001, when + tail);
        end = when + tail;
        break;
      }
      case 'pluck': {
        const o = osc('sawtooth', freq);
        const o2 = osc('square', freq, 5);
        const lp = lowpass(freq * 10, 2);
        lp.frequency.setValueAtTime(Math.min(16000, freq * 10), when);
        lp.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 1.1), when + 0.35);
        const mix = ctx.createGain();
        mix.gain.value = 0.5;
        o.connect(lp);
        o2.connect(mix).connect(lp);
        lp.connect(amp);
        const tail = Math.min(2.2, dur + r + 0.4);
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(peak * 0.9, when + 0.003);
        amp.gain.exponentialRampToValueAtTime(0.0001, when + tail);
        end = when + tail;
        break;
      }
      case 'pad': {
        const lp = lowpass(Math.min(2400, freq * 4), 0.5);
        for (const d of [-9, 0, 8]) osc('sawtooth', freq, d).connect(lp);
        osc('sine', freq / 2).connect(lp);
        lp.connect(amp);
        const level = peak * 0.42;
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(level, when + Math.max(a, 0.25));
        amp.gain.setValueAtTime(level, Math.max(when + 0.25, when + dur));
        amp.gain.setTargetAtTime(0, Math.max(when + 0.25, when + dur), Math.max(r, 0.4) / 3);
        end = when + Math.max(0.25, dur) + Math.max(r, 0.4) * 2;
        break;
      }
      case 'flute': {
        const o = osc('sine', freq);
        const o2 = osc('triangle', freq * 2);
        const h = ctx.createGain();
        h.gain.value = 0.12;
        o2.connect(h).connect(amp);
        // vibrato that blooms in
        const lfo = osc('sine', 5.2);
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, when);
        depth.gain.linearRampToValueAtTime(freq * 0.006, when + 0.4);
        lfo.connect(depth).connect(o.frequency);
        o.connect(amp);
        // breath
        const n = ctx.createBufferSource();
        n.buffer = this.noise;
        n.loop = true;
        nodes.push(n);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq * 2;
        bp.Q.value = 1.5;
        const ng = ctx.createGain();
        ng.gain.value = 0.25;
        n.connect(bp).connect(ng).connect(amp);
        const fa = Math.max(a, 0.06);
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(peak * 0.8, when + fa);
        amp.gain.setValueAtTime(peak * 0.8, Math.max(when + fa, when + dur));
        amp.gain.setTargetAtTime(0, Math.max(when + fa, when + dur), r / 4);
        break;
      }
      case 'square':
      case 'sawtooth': {
        const lp = lowpass(Math.min(9000, freq * 8));
        osc(track.waveform, freq).connect(lp).connect(amp);
        sustainEnv(peak * 0.45);
        break;
      }
      default: {
        osc(track.waveform as OscillatorType, freq).connect(amp);
        sustainEnv(peak);
      }
    }

    for (const n of nodes) {
      n.start(when);
      n.stop(end + 0.05);
    }
    nodes[0].onended = () => amp.disconnect();
  }
}

export const engine = new AudioEngine();
