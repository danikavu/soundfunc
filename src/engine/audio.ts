import { midiToFreq } from './music';
import { audibleTracks, isDrum, patternBeats, renderTrack, songBeats, songWindows, type Note, type Project, type Track, type TrackRender } from './project';
import { timbreHarmonics } from './timbre';

const LOOKAHEAD_SEC = 0.12;
const TICK_MS = 25;

interface Bus {
  gain: GainNode;
  pan: StereoPannerNode;
  send: GainNode;
}

/** A single sustained voice whose pitch and level follow a glide track's curve. */
interface GlideVoice {
  key: string;
  amp: GainNode;
  /** each oscillator's frequency param and its ratio to the played pitch */
  freqs: { param: AudioParam; ratio: number }[];
  nodes: AudioScheduledSourceNode[];
  lastMidi: number;
  lastVel: number;
}

const glideKey = (t: Track) => `${t.waveform}|${t.waveform === 'custom' ? t.timbre : ''}`;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private analyser!: AnalyserNode;
  private noise!: AudioBuffer;
  private buses = new Map<string, Bus>();
  private glides = new Map<string, GlideVoice>();
  private waves = new Map<string, PeriodicWave | null>();

  private project: Project | null = null;
  private renderCache = new Map<string, TrackRender>();
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

  private periodicWave(formula: string): PeriodicWave | null {
    if (!this.waves.has(formula)) {
      const h = timbreHarmonics(formula);
      this.waves.set(formula, h ? this.ctx!.createPeriodicWave(h.real, h.imag) : null);
    }
    return this.waves.get(formula)!;
  }

  private bus(track: Track): Bus {
    const ctx = this.ensure();
    let b = this.buses.get(track.id);
    if (!b) {
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const send = ctx.createGain();
      gain.connect(pan);
      pan.connect(this.dry);
      pan.connect(send).connect(this.wet);
      b = { gain, pan, send };
      this.buses.set(track.id, b);
    }
    const now = ctx.currentTime;
    b.gain.gain.setTargetAtTime(track.volume, now, 0.02);
    b.pan.pan.setTargetAtTime(track.pan, now, 0.02);
    b.send.gain.setTargetAtTime(track.send, now, 0.02);
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
    this.renderCache.clear();
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
      for (const id of [...this.glides.keys()]) this.killGlide(id, 0.08);
      // detach the old buses (and every voice already scheduled on them) once faded
      const old = [...this.buses.values()];
      this.buses.clear();
      window.setTimeout(() => old.forEach((b) => b.pan.disconnect()), 150);
    }
  }

  private renderFor(track: Track, loop: number): TrackRender {
    const key = `${track.id}:${loop}`;
    let r = this.renderCache.get(key);
    if (!r) {
      r = renderTrack(track, this.project!.song, loop, false);
      this.renderCache.set(key, r);
      if (this.renderCache.size > 256) this.renderCache.delete(this.renderCache.keys().next().value!);
    }
    return r;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.project) return;
    const from = this.scheduledBeat;
    const to = this.beatAt(ctx.currentTime + LOOKAHEAD_SEC);
    if (to <= from) return;
    this.scheduledBeat = to;
    const secPerBeat = 60 / this.bpm;
    const live = new Set<string>();
    const tracks = audibleTracks(this.project.tracks);
    // song time: with "repeat exactly" every pass starts the clock again
    const windows = songWindows(this.project.song, songBeats(tracks, this.project.song), from, to);

    for (const track of tracks) {
      const len = patternBeats(track);
      if (len <= 0) continue;
      const bus = this.bus(track);
      const glide = track.playMode === 'glide' && !isDrum(track.waveform);
      if (glide) live.add(track.id);
      for (const w of windows) {
        for (let k = Math.floor(w.from / len + 1e-9); k * len < w.to; k++) {
          const render = this.renderFor(track, k);
          if (glide) {
            this.scheduleGlide(track, bus, render, w.base + k * len, w.base + w.from, w.base + w.to);
            continue;
          }
          for (const note of render.notes) {
            const beat = k * len + note.beat;
            if (beat < w.from || beat >= w.to) continue;
            const freq = isDrum(track.waveform) ? Math.pow(2, note.tune / 12) : note.freq;
            this.voice(track, bus, this.timeAt(w.base + beat), note.duration * secPerBeat, freq, note.velocity, voiceExpr(note, secPerBeat));
          }
        }
      }
    }
    // silence glide voices whose track was muted, removed or switched back to notes
    for (const id of [...this.glides.keys()]) if (!live.has(id)) this.killGlide(id, 0.15);
  }

  // ---------- glide (continuous) voices ----------

  private scheduleGlide(track: Track, bus: Bus, render: TrackRender, offset: number, from: number, to: number) {
    const { curve } = render;
    let v = this.glides.get(track.id);
    if (v && v.key !== glideKey(track)) {
      this.killGlide(track.id, 0.05);
      v = undefined;
    }
    if (!v) {
      v = this.makeGlide(track, bus);
      this.glides.set(track.id, v);
    }
    const tau = Math.max(0.004, track.glide / 3);
    for (let i = 0; i < curve.beat.length; i++) {
      const beat = offset + curve.beat[i];
      if (beat < from || beat >= to) continue;
      const time = this.timeAt(beat);
      const midi = curve.midi[i], vel = curve.velocity[i];
      if (Math.abs(midi - v.lastMidi) > 0.001) {
        const f = midiToFreq(midi);
        for (const { param, ratio } of v.freqs) {
          // the very first pitch jumps into place instead of sweeping from the 440 Hz default
          if (v.lastMidi < 0) param.setValueAtTime(f * ratio, time);
          else param.setTargetAtTime(f * ratio, time, tau);
        }
        v.lastMidi = midi;
      }
      if (Math.abs(vel - v.lastVel) > 0.002) {
        const ampTau = vel > v.lastVel ? Math.max(0.004, track.attack / 3) : Math.max(0.006, track.release / 4);
        v.amp.gain.setTargetAtTime(vel * 0.3, time, ampTau);
        v.lastVel = vel;
      }
    }
  }

  private makeGlide(track: Track, bus: Bus): GlideVoice {
    const ctx = this.ctx!;
    const amp = ctx.createGain();
    amp.gain.value = 0;
    amp.connect(bus.gain);
    const v: GlideVoice = { key: glideKey(track), amp, freqs: [], nodes: [], lastMidi: -1, lastVel: 0 };
    const osc = (type: OscillatorType | 'custom', ratio = 1, detune = 0, out: AudioNode = amp, level = 1) => {
      const o = ctx.createOscillator();
      const wave = type === 'custom' ? this.periodicWave(track.timbre) : null;
      if (wave) o.setPeriodicWave(wave);
      else o.type = type === 'custom' ? 'sine' : type;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(out);
      v.freqs.push({ param: o.frequency, ratio });
      v.nodes.push(o);
      return o;
    };
    const lowpass = (f: number, q = 0.7) => {
      const l = ctx.createBiquadFilter();
      l.type = 'lowpass';
      l.frequency.value = f;
      l.Q.value = q;
      l.connect(amp);
      return l;
    };
    switch (track.waveform) {
      case 'reese': {
        const lp = lowpass(900, 1.5);
        osc('sawtooth', 1, -14, lp, 0.5);
        osc('sawtooth', 1, 14, lp, 0.5);
        osc('sine', 0.5, 0, amp, 0.6);
        break;
      }
      case 'pad': {
        const lp = lowpass(1800, 0.5);
        for (const d of [-9, 0, 8]) osc('sawtooth', 1, d, lp, 0.35);
        break;
      }
      case 'flute': {
        osc('sine');
        osc('triangle', 2, 0, amp, 0.12);
        break;
      }
      case 'square':
      case 'sawtooth':
        osc(track.waveform, 1, 0, lowpass(5000), 0.5);
        break;
      case 'custom':
        osc('custom', 1, 0, amp, 0.8);
        break;
      default:
        osc(track.waveform as OscillatorType);
    }
    const now = ctx.currentTime;
    for (const n of v.nodes) n.start(now);
    return v;
  }

  private killGlide(id: string, fade: number) {
    const v = this.glides.get(id);
    if (!v || !this.ctx) return;
    this.glides.delete(id);
    const now = this.ctx.currentTime;
    v.amp.gain.cancelScheduledValues(now);
    v.amp.gain.setTargetAtTime(0, now, fade / 3);
    for (const n of v.nodes) n.stop(now + fade * 3);
    v.nodes[0].onended = () => v.amp.disconnect();
  }

  // ---------- scrubbing: drag along the plot to hear the curve ----------

  private scrubVoice: GlideVoice | null = null;

  scrub(track: Track, midi: number, velocity: number) {
    const ctx = this.ensure();
    if (ctx.state !== 'running') void ctx.resume();
    if (this.project) this.setProject(this.project);
    if (!this.scrubVoice || this.scrubVoice.key !== glideKey(track)) {
      this.scrubEnd();
      // drums have no sustained voice; scrub them with a sine
      this.scrubVoice = this.makeGlide(isDrum(track.waveform) ? { ...track, waveform: 'sine' } : track, this.bus(track));
    }
    const v = this.scrubVoice;
    const now = ctx.currentTime;
    const f = midiToFreq(midi);
    for (const { param, ratio } of v.freqs) {
      if (v.lastMidi < 0) param.setValueAtTime(f * ratio, now);
      else param.setTargetAtTime(f * ratio, now, 0.015);
    }
    v.lastMidi = midi;
    v.amp.gain.setTargetAtTime(Math.max(0.15, velocity) * 0.3, now, 0.02);
  }

  scrubEnd() {
    const v = this.scrubVoice;
    if (!v || !this.ctx) return;
    this.scrubVoice = null;
    const now = this.ctx.currentTime;
    v.amp.gain.cancelScheduledValues(now);
    v.amp.gain.setTargetAtTime(0, now, 0.05);
    for (const n of v.nodes) n.stop(now + 0.4);
    v.nodes[0].onended = () => v.amp.disconnect();
  }

  preview(track: Track, midi: number, velocity = 0.8) {
    const ctx = this.ensure();
    if (ctx.state !== 'running') void ctx.resume();
    if (this.project) this.setProject(this.project);
    const freq = isDrum(track.waveform) ? 1 : midiToFreq(midi);
    this.voice(track, this.bus(track), ctx.currentTime + 0.01, 0.35, freq, velocity);
  }

  waveform(out: Float32Array<ArrayBuffer>): boolean {
    if (!this.ctx) return false;
    this.analyser.getFloatTimeDomainData(out);
    return true;
  }

  // ---------- drums ----------

  /** `tune` is a frequency ratio (2 = an octave up). */
  private drum(track: Track, out: AudioNode, when: number, dur: number, tune: number, vel: number) {
    const ctx = this.ctx!;
    const nodes: AudioScheduledSourceNode[] = [];
    const amp = ctx.createGain();
    amp.connect(out);
    const peak = vel * 0.9;
    const env = (g: AudioParam, level: number, decay: number, start = when) => {
      g.setValueAtTime(0, start);
      g.linearRampToValueAtTime(level, start + 0.001);
      g.exponentialRampToValueAtTime(0.0001, start + decay);
    };
    const noise = (filter: BiquadFilterType, f: number, q: number, level: number, decay: number, start = when) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      n.playbackRate.value = 0.9 + Math.random() * 0.2;
      const bq = ctx.createBiquadFilter();
      bq.type = filter;
      bq.frequency.value = f * tune;
      bq.Q.value = q;
      const g = ctx.createGain();
      env(g.gain, level, decay, start);
      n.connect(bq).connect(g).connect(amp);
      n.start(start, Math.random());
      n.stop(start + decay + 0.02);
      nodes.push(n);
    };
    const tone = (type: OscillatorType, f0: number, f1: number, sweep: number, level: number, decay: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * tune, when);
      o.frequency.exponentialRampToValueAtTime(f1 * tune, when + sweep);
      const g = ctx.createGain();
      env(g.gain, level, decay);
      o.connect(g).connect(amp);
      o.start(when);
      o.stop(when + decay + 0.02);
      nodes.push(o);
    };
    /** six detuned squares at inharmonic ratios — the 808 cymbal recipe */
    const metal = (decay: number, level: number) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 10000;
      bp.Q.value = 0.8;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      const g = ctx.createGain();
      env(g.gain, level, decay);
      bp.connect(hp).connect(g).connect(amp);
      for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 40 * r * tune;
        o.connect(bp);
        o.start(when);
        o.stop(when + decay + 0.02);
        nodes.push(o);
      }
    };

    switch (track.waveform) {
      case 'kick':
        tone('sine', 160, 42, 0.11, peak, 0.5);
        tone('triangle', 900, 120, 0.012, peak * 0.35, 0.02); // click
        break;
      case 'snare':
        tone('triangle', 240, 170, 0.05, peak * 0.55, 0.12);
        noise('bandpass', 2200, 0.6, peak * 0.9, 0.2);
        noise('highpass', 5000, 0.7, peak * 0.4, 0.12);
        break;
      case 'hat':
        metal(0.045 + dur * 0.05, peak * 0.55);
        break;
      case 'openhat':
        metal(Math.max(0.25, Math.min(0.9, dur)), peak * 0.5);
        break;
      case 'clap':
        for (const d of [0, 0.011, 0.022]) noise('bandpass', 1300, 1.2, peak * 0.8, 0.03, when + d);
        noise('bandpass', 1200, 0.9, peak * 0.7, 0.22, when + 0.03);
        break;
      case 'rim':
        tone('square', 1700, 1600, 0.01, peak * 0.3, 0.035);
        noise('bandpass', 3500, 2, peak * 0.4, 0.025);
        break;
      case 'tom':
        tone('sine', 190, 95, 0.25, peak, 0.45);
        break;
      case 'crash':
        metal(1.8, peak * 0.45);
        noise('highpass', 6000, 0.5, peak * 0.3, 1.4);
        break;
    }
    nodes[0].onended = () => amp.disconnect();
  }

  // ---------- melodic voices ----------

  private voice(track: Track, bus: Bus, when: number, dur: number, freq: number, vel: number, expr?: VoiceExpr) {
    if (isDrum(track.waveform)) return this.drum(track, bus.gain, when, dur, freq, vel);
    const ctx = this.ctx!;
    const amp = ctx.createGain();
    // pressure: a second gain after the envelope, following the note's pressure curve
    let press: GainNode | null = null;
    if (expr?.pressure) {
      press = ctx.createGain();
      press.connect(bus.gain);
      amp.connect(press);
      press.gain.setValueAtTime(expr.pressure[0], when);
      for (let i = 1; i < expr.at.length; i++) press.gain.linearRampToValueAtTime(expr.pressure[i], when + expr.at[i]);
    } else amp.connect(bus.gain);
    /** oscillators that sound at the note's pitch — these follow the bend (an LFO doesn't) */
    const pitched: OscillatorNode[] = [];
    const peak = 0.32 * vel;
    const a = Math.max(0.003, track.attack);
    const r = Math.max(0.02, track.release);
    const nodes: AudioScheduledSourceNode[] = [];
    let end = when + dur + r;

    const osc = (type: OscillatorType, f: number, detune = 0, followsPitch = true) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      nodes.push(o);
      if (followsPitch) pitched.push(o);
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
      case 'reese': {
        // two detuned saws beating against each other, plus a sub
        const lp = lowpass(Math.min(1400, freq * 6), 1.5);
        lp.frequency.setValueAtTime(Math.min(1400, freq * 6), when);
        lp.frequency.linearRampToValueAtTime(Math.min(700, freq * 3), when + Math.max(0.1, dur));
        osc('sawtooth', freq, -14).connect(lp);
        osc('sawtooth', freq, 14).connect(lp);
        const sub = ctx.createGain();
        sub.gain.value = 1.2;
        osc('sine', freq / 2).connect(sub).connect(amp);
        lp.connect(amp);
        sustainEnv(peak * 0.5);
        break;
      }
      case 'custom': {
        const o = osc('sine', freq);
        const wave = this.periodicWave(track.timbre);
        if (wave) o.setPeriodicWave(wave);
        o.connect(amp);
        sustainEnv(peak * 0.8);
        break;
      }
      case 'flute': {
        const o = osc('sine', freq);
        const o2 = osc('triangle', freq * 2);
        const h = ctx.createGain();
        h.gain.value = 0.12;
        o2.connect(h).connect(amp);
        // vibrato that blooms in
        const lfo = osc('sine', 5.2, 0, false);
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

    // bend: every pitched oscillator's detune follows the note's bend curve (in cents)
    if (expr?.bend) {
      for (const o of pitched) {
        const base = o.detune.value;
        o.detune.setValueAtTime(base + expr.bend[0] * 100, when);
        for (let i = 1; i < expr.at.length; i++) o.detune.linearRampToValueAtTime(base + expr.bend[i] * 100, when + expr.at[i]);
      }
    }
    for (const n of nodes) {
      n.start(when);
      n.stop(end + 0.05);
    }
    nodes[0].onended = () => (amp.disconnect(), press?.disconnect());
  }
}

export const engine = new AudioEngine();

/** a note's bend and pressure for one voice, times in seconds from its start (only what is wired) */
interface VoiceExpr {
  at: number[];
  bend?: number[];
  pressure?: number[];
}

function voiceExpr(note: Note, secPerBeat: number): VoiceExpr | undefined {
  const e = note.expr;
  if (!e || !e.at.length) return undefined;
  const bends = e.bend.some((b) => b !== 0);
  const presses = e.pressure.some((p) => p !== 1);
  if (!bends && !presses) return undefined;
  return { at: e.at.map((a) => a * secPerBeat), bend: bends ? e.bend : undefined, pressure: presses ? e.pressure : undefined };
}
