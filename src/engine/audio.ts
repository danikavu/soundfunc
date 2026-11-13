import { midiToFreq } from './music';
import { audibleTracks, isDrum, patternBeats, renderTrack, songBeats, songWindows, type Note, type Project, type Track, type TrackRender } from './project';
import { timbreHarmonics } from './timbre';
import { cutoffHz, drumOf, synthOf, type OscWave, type SynthParams } from './synth';
import { AudioTap, MAX_TAKE_SECONDS, Take, type Jam } from './jam';

const LOOKAHEAD_SEC = 0.12;
const TICK_MS = 25;

/**
 * A channel's strip: voices play into `gain`; a chorus (two modulated delays, left and right)
 * and a tempo-synced delay with feedback join them; then pan, the dry mix and the reverb send.
 */
interface Bus {
  gain: GainNode;
  pan: StereoPannerNode;
  send: GainNode;
  chorusWet: GainNode;
  delay: DelayNode;
  delayWet: GainNode;
  feedback: GainNode;
}

/** A single sustained voice whose pitch and level follow a glide track's curve. */
interface GlideVoice {
  key: string;
  amp: GainNode;
  /** each oscillator's frequency param and its ratio to the played pitch */
  freqs: { param: AudioParam; ratio: number }[];
  nodes: AudioScheduledSourceNode[];
  /** the filter follows the note (key tracking) as the glide moves */
  filter?: { param: AudioParam; base: number; keyTrack: number };
  /** level for a velocity of 1 */
  level: number;
  lastMidi: number;
  lastVel: number;
}

/** what a jam take is doing, for the record button */
export type TakeEvent = { kind: 'armed' } | { kind: 'recording' } | { kind: 'ending' } | { kind: 'done'; jam: Jam } | { kind: 'discarded' };

/** takes start and end on a bar line (4 beats from the play start) */
const BAR = 4;
const nextBar = (beat: number) => Math.ceil(beat / BAR - 1e-9) * BAR;

const glideKey = (t: Track) => `${t.waveform}|${t.waveform === 'custom' ? t.timbre : ''}|${JSON.stringify(t.synth ?? {})}`;

/** how loud each oscillator is at full level, so voices come out evenly */
const WAVE_LEVEL: Record<OscWave, number> = { sine: 1, triangle: 0.95, sawtooth: 0.5, square: 0.45, custom: 0.8, fm: 0.8 };

/** the top bar's Volume (0…1, default 0.8) → the master gain: a gentle curve, so the slider's lower half stays useful */
export const masterLevel = (v: number | undefined) => Math.pow(Math.min(1, Math.max(0, v ?? 0.8)), 1.5) / Math.pow(0.8, 1.5) * 0.8;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private analyser!: AnalyserNode;
  /** the mix before the master volume: what a jam take records */
  private mix!: DynamicsCompressorNode;
  private tap: AudioTap | null = null;
  private take: Take | null = null;
  private takeLive = false;
  /** told when a take is armed, starts, is ending, is done or discarded */
  onTake: ((e: TakeEvent) => void) | null = null;
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
  /** the master gain the top bar's Volume sets */
  private volume = masterLevel(undefined);
  private fadeUntil = 0;
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
    this.master.gain.value = this.volume;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = this.makeImpulse(3.6);

    this.dry.connect(comp);
    this.wet.connect(verb).connect(comp);
    comp.connect(this.master).connect(this.analyser).connect(ctx.destination);
    this.mix = comp;

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
      // chorus: two short delays swaying at different rates, one hard left, one hard right
      const chorusWet = ctx.createGain();
      chorusWet.gain.value = 0;
      const merge = ctx.createChannelMerger(2);
      [
        [0.012, 0.31, 0],
        [0.017, 0.47, 1],
      ].forEach(([time, rate, side]) => {
        const d = ctx.createDelay(0.05);
        d.delayTime.value = time;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = rate;
        const depth = ctx.createGain();
        depth.gain.value = 0.0025;
        lfo.connect(depth).connect(d.delayTime);
        lfo.start();
        gain.connect(d).connect(merge, 0, side);
      });
      merge.connect(chorusWet).connect(pan);
      // delay: tempo-synced, darkening as it repeats
      const delay = ctx.createDelay(4);
      const feedback = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 3800;
      const delayWet = ctx.createGain();
      delayWet.gain.value = 0;
      gain.connect(delay);
      delay.connect(tone).connect(feedback).connect(delay);
      tone.connect(delayWet).connect(pan);
      pan.connect(this.dry);
      pan.connect(send).connect(this.wet);
      b = { gain, pan, send, chorusWet, delay, delayWet, feedback };
      this.buses.set(track.id, b);
    }
    const now = ctx.currentTime;
    b.gain.gain.setTargetAtTime(track.volume, now, 0.02);
    b.pan.pan.setTargetAtTime(track.pan, now, 0.02);
    b.send.gain.setTargetAtTime(track.send, now, 0.02);
    const fx = isDrum(track.waveform) ? { chorus: 0, delay: 0, delayTime: 0.75 } : synthOf(track.waveform, track.synth);
    b.chorusWet.gain.setTargetAtTime(fx.chorus * 0.7, now, 0.05);
    b.delayWet.gain.setTargetAtTime(fx.delay * 0.5, now, 0.05);
    b.feedback.gain.setTargetAtTime(0.25 + fx.delay * 0.3, now, 0.05);
    b.delay.delayTime.setTargetAtTime(Math.min(3.9, (fx.delayTime * 60) / this.bpm), now, 0.05);
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
    if (this.take && this.ctx) {
      const t = this.take, now = this.ctx.currentTime;
      t.tempo(Math.max(t.start, this.beatAt(now)), this.bpm);
      // the bar lines not reached yet move with the tempo
      if (now < t.startTime) t.startTime = this.timeAt(t.start);
      if (Number.isFinite(t.end) && now < t.endTime) t.endTime = this.timeAt(t.end);
    }
    this.volume = masterLevel(project.song.volume);
    this.renderCache.clear();
    if (this.ctx) {
      const r = project.song.reverb;
      this.wet.gain.setTargetAtTime(r * 0.9, this.ctx.currentTime, 0.05);
      this.dry.gain.setTargetAtTime(1 - r * 0.45, this.ctx.currentTime, 0.05);
      // after a stop's fade-out, never in the middle of it
      this.master.gain.setTargetAtTime(this.volume, Math.max(this.ctx.currentTime, this.fadeUntil), 0.03);
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

  /** start playing — and, with `record`, recording a take from the very first beat */
  async play(record = false) {
    const ctx = this.ensure();
    if (ctx.state !== 'running') await ctx.resume();
    if (record) await this.connectTap();
    if (this.project) this.setProject(this.project);
    this.originTime = ctx.currentTime + 0.05;
    this.originBeat = 0;
    this.scheduledBeat = 0;
    this.playing = true;
    if (record) this.beginTake(0);
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop() {
    // a take ends with the music: cut where it stopped (or dropped, if it never began)
    if (this.take && this.ctx) {
      const now = this.ctx.currentTime;
      if (now < this.take.startTime) this.discardTake();
      else {
        this.take.end = Math.min(this.take.end, this.beatAt(now));
        this.take.endTime = Math.min(this.take.endTime, now);
        void this.finishTake();
      }
    }
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.ctx) {
      // quick fade so ringing voices don't click
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(0, now + 0.08);
      this.master.gain.setValueAtTime(this.volume, now + 0.25);
      this.fadeUntil = now + 0.25;
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
    this.watchTake(ctx.currentTime);
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
            this.take?.note(track, w.base + beat, note);
            const freq = isDrum(track.waveform) ? Math.pow(2, note.tune / 12) : note.freq;
            this.voice(track, bus, this.timeAt(w.base + beat), note.duration * secPerBeat, freq, note.velocity, voiceExpr(note, secPerBeat));
          }
        }
      }
    }
    // silence glide voices whose track was muted, removed or switched back to notes
    for (const id of [...this.glides.keys()]) if (!live.has(id)) this.killGlide(id, 0.15);
  }

  // ---------- jam takes: record what plays ----------

  private async connectTap() {
    const ctx = this.ensure();
    this.tap ??= new AudioTap(ctx);
    await this.tap.connect(this.mix);
  }

  private beginTake(start: number) {
    const p = this.project!;
    this.take = new Take(start, p.name, p.song);
    this.take.startTime = this.timeAt(start);
    this.takeLive = false;
    this.tap?.start();
    this.onTake?.({ kind: 'armed' });
    this.watchTake(this.ctx!.currentTime);
  }

  /** arm a take: it starts on the next bar line not yet played (call while playing) */
  async record() {
    if (!this.playing || this.take) return;
    await this.connectTap();
    if (!this.playing || this.take) return;
    this.beginTake(nextBar(this.scheduledBeat));
  }

  /** end the take on the next bar line (or drop it, if it hasn't started yet) */
  stopRecording() {
    const t = this.take;
    if (!t || !this.ctx || Number.isFinite(t.end)) return;
    if (this.ctx.currentTime < t.startTime) return this.discardTake();
    t.end = Math.max(t.start + BAR, nextBar(this.scheduledBeat));
    t.endTime = this.timeAt(t.end);
    this.onTake?.({ kind: 'ending' });
  }

  get recording(): 'off' | 'armed' | 'on' | 'ending' {
    const t = this.take;
    if (!t) return 'off';
    return Number.isFinite(t.end) ? 'ending' : this.takeLive ? 'on' : 'armed';
  }

  /** seconds into the take (0 until it starts) */
  takeSeconds(): number {
    if (!this.take || !this.ctx) return 0;
    return Math.max(0, Math.min(this.ctx.currentTime, this.take.endTime) - this.take.startTime);
  }

  private watchTake(now: number) {
    const t = this.take;
    if (!t) return;
    if (!this.takeLive && now >= t.startTime) {
      this.takeLive = true;
      this.onTake?.({ kind: 'recording' });
    }
    // too long to keep in memory: end it on the next bar
    if (this.takeLive && !Number.isFinite(t.end) && now - t.startTime > MAX_TAKE_SECONDS) this.stopRecording();
    if (Number.isFinite(t.end) && now >= t.endTime) void this.finishTake();
  }

  private discardTake() {
    this.take = null;
    void this.tap?.stop(0, 0);
    this.onTake?.({ kind: 'discarded' });
  }

  private async finishTake() {
    const t = this.take;
    if (!t) return;
    this.take = null;
    const audio = this.tap ? await this.tap.stop(t.startTime, t.endTime) : null;
    this.onTake?.({ kind: 'done', jam: t.finish(t.end, t.endTime - t.startTime, audio) });
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
      this.take?.glide(track, beat, midi, vel);
      if (Math.abs(midi - v.lastMidi) > 0.001) {
        const f = midiToFreq(midi);
        for (const { param, ratio } of v.freqs) {
          // the very first pitch jumps into place instead of sweeping from the 440 Hz default
          if (v.lastMidi < 0) param.setValueAtTime(f * ratio, time);
          else param.setTargetAtTime(f * ratio, time, tau);
        }
        if (v.filter) v.filter.param.setTargetAtTime(Math.min(18000, Math.max(20, v.filter.base * Math.pow(f / 261.6, v.filter.keyTrack))), time, tau);
        v.lastMidi = midi;
      }
      if (Math.abs(vel - v.lastVel) > 0.002) {
        const ampTau = vel > v.lastVel ? Math.max(0.004, track.attack / 3) : Math.max(0.006, track.release / 4);
        v.amp.gain.setTargetAtTime(vel * v.level, time, ampTau);
        v.lastVel = vel;
      }
    }
  }

  private makeGlide(track: Track, bus: Bus): GlideVoice {
    const ctx = this.ctx!;
    const p = synthOf(track.waveform, track.synth);
    const now = ctx.currentTime;
    const amp = ctx.createGain();
    amp.gain.value = 0;
    amp.connect(bus.gain);
    // one long voice: the same oscillators, drive and filter as a note — only the envelope is the slide's
    const { input, filter } = this.chain(p, amp, 261.6, now, Infinity);
    const bank = this.oscBank(p, track.timbre, 261.6, input, amp, now);
    if (p.vibrato > 0) bank.nodes.push(this.vibrato(p, bank.oscs.map((o) => o.o), now));
    if (p.wow > 0) bank.nodes.push(this.wow(p, bank.oscs.map((o) => o.o), now));
    const v: GlideVoice = {
      key: glideKey(track),
      amp,
      freqs: bank.oscs.map(({ o, ratio }) => ({ param: o.frequency, ratio })),
      nodes: bank.nodes,
      filter: filter ? { param: filter.frequency, base: cutoffHz(p.cutoff), keyTrack: p.keyTrack } : undefined,
      level: 0.3 * p.gain,
      lastMidi: -1,
      lastVel: 0,
    };
    for (const n of v.nodes) n.start(now);
    return v;
  }

  // ---------- the synth voice ----------

  private curves = new Map<number, Float32Array<ArrayBuffer>>();
  /** a soft-clipping curve: tanh(k·x) / tanh(k) — more k, more grit */
  private driveCurve(k: number): Float32Array<ArrayBuffer> {
    const key = Math.round(k * 100);
    let c = this.curves.get(key);
    if (!c) {
      c = new Float32Array(1024);
      for (let i = 0; i < c.length; i++) {
        const x = (i / (c.length - 1)) * 2 - 1;
        c[i] = Math.tanh(k * x) / Math.tanh(k);
      }
      this.curves.set(key, c);
    }
    return c;
  }

  /**
   * The path after the oscillators: drive, then the filter (with its envelope, which opens
   * at `when` and falls back), into `out`. Returns where the oscillators should connect.
   */
  private chain(p: SynthParams, out: AudioNode, freq: number, when: number, dur: number): { input: AudioNode; filter: BiquadFilterNode | null } {
    const ctx = this.ctx!;
    let head: AudioNode = out;
    let filter: BiquadFilterNode | null = null;
    if (p.filter !== 'off') {
      filter = ctx.createBiquadFilter();
      filter.type = p.filter;
      const f0 = Math.min(18000, Math.max(20, cutoffHz(p.cutoff) * Math.pow(freq / 261.6, p.keyTrack)));
      filter.Q.value = p.filter === 'bandpass' ? 0.8 + p.resonance * 10 : 0.7 + p.resonance * p.resonance * 16;
      filter.frequency.setValueAtTime(f0, when);
      if (p.envAmount > 0 && Number.isFinite(dur)) {
        const top = Math.min(18000, f0 * Math.pow(2, p.envAmount * 6));
        filter.frequency.linearRampToValueAtTime(top, when + 0.004);
        filter.frequency.setTargetAtTime(f0, when + 0.004, Math.max(0.01, p.envDecay) / 3);
      }
      filter.connect(head);
      head = filter;
    }
    if (p.drive > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.driveCurve(1 + p.drive * 8);
      shaper.oversample = '2x';
      const trim = ctx.createGain();
      trim.gain.value = 1 / (1 + p.drive * 0.6);
      shaper.connect(trim).connect(head);
      head = shaper;
    }
    return { input: head, filter };
  }

  /**
   * The oscillators: `unison` copies spread over ±detune cents and across the stereo field
   * (or an FM pair), a sine an octave down into `subOut`, and noise.
   */
  private oscBank(p: SynthParams, timbre: string, freq: number, out: AudioNode, subOut: AudioNode, when: number) {
    const ctx = this.ctx!;
    const oscs: { o: OscillatorNode; ratio: number }[] = [];
    const nodes: AudioScheduledSourceNode[] = [];
    const n = Math.max(1, Math.min(7, Math.round(p.unison)));
    const each = WAVE_LEVEL[p.wave] / Math.sqrt(n);
    // a stock voice may bring its own one-cycle wave; otherwise the channel's f(p)
    const wave = p.wave === 'custom' ? this.periodicWave(p.shape ?? timbre) : null;
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? 0 : -1 + (2 * i) / (n - 1);
      const o = ctx.createOscillator();
      if (p.wave === 'fm' || p.wave === 'sine') o.type = 'sine';
      else if (p.wave === 'custom') wave ? o.setPeriodicWave(wave) : (o.type = 'sine');
      else o.type = p.wave;
      o.frequency.value = freq;
      o.detune.value = spread * p.detune;
      const g = ctx.createGain();
      g.gain.value = each;
      const panner = ctx.createStereoPanner();
      panner.pan.value = spread * p.width;
      o.connect(g).connect(panner).connect(out);
      oscs.push({ o, ratio: 1 });
      nodes.push(o);
      if (p.wave === 'fm') {
        // FM: a modulator at fmRatio × the note bends the carrier; its depth falls over fmDecay
        const m = ctx.createOscillator();
        m.frequency.value = freq * p.fmRatio;
        m.detune.value = o.detune.value;
        const idx = ctx.createGain();
        idx.gain.setValueAtTime(freq * p.fmIndex, when);
        idx.gain.setTargetAtTime(freq * p.fmIndex * 0.06, when, Math.max(0.05, p.fmDecay) / 3);
        m.connect(idx).connect(o.frequency);
        oscs.push({ o: m, ratio: p.fmRatio });
        nodes.push(m);
      }
    }
    if (p.sub > 0) {
      const o = ctx.createOscillator();
      o.frequency.value = freq / 2;
      const g = ctx.createGain();
      g.gain.value = p.sub * 0.7;
      o.connect(g).connect(subOut);
      oscs.push({ o, ratio: 0.5 });
      nodes.push(o);
    }
    if (p.noise > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = p.noise * 0.35;
      src.connect(g).connect(out);
      nodes.push(src);
    }
    return { oscs, nodes };
  }

  /** vibrato that blooms in over half a second, on every pitched oscillator */
  private vibrato(p: SynthParams, targets: OscillatorNode[], when: number) {
    const ctx = this.ctx!;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, when);
    depth.gain.linearRampToValueAtTime(p.vibrato * 35, when + 0.5);
    lfo.connect(depth);
    for (const o of targets) depth.connect(o.detune);
    return lfo; // started (and stopped) with the voice's other sources
  }

  /**
   * Tape wow: a slow drift of pitch (two rates, up to ±14 cents), its phase taken from the clock
   * rather than the note, so every note on the channel — a whole chord — wavers together.
   */
  private wow(p: SynthParams, targets: OscillatorNode[], when: number) {
    const ctx = this.ctx!;
    const RATE = 0.55;
    const phase = (2 * Math.PI * RATE * when) % (2 * Math.PI);
    // sin(ωt + φ) plus a little of its third partial, so the drift isn't a perfect sine
    const real = new Float32Array([0, Math.sin(phase), 0, 0.3 * Math.sin(3 * phase)]);
    const imag = new Float32Array([0, Math.cos(phase), 0, 0.3 * Math.cos(3 * phase)]);
    const lfo = ctx.createOscillator();
    lfo.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
    lfo.frequency.value = RATE;
    const depth = ctx.createGain();
    depth.gain.value = p.wow * 14;
    lfo.connect(depth);
    for (const o of targets) depth.connect(o.detune);
    return lfo;
  }

  private killGlide(id: string, fade: number) {
    const v = this.glides.get(id);
    if (!v || !this.ctx) return;
    this.glides.delete(id);
    const now = this.ctx.currentTime;
    this.take?.hush(id, this.beatAt(now));
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
    if (v.filter) v.filter.param.setTargetAtTime(Math.min(18000, Math.max(20, v.filter.base * Math.pow(f / 261.6, v.filter.keyTrack))), now, 0.015);
    v.lastMidi = midi;
    v.amp.gain.setTargetAtTime(Math.max(0.15, velocity) * v.level, now, 0.02);
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

  /** the output's spectrum right now, 0 – 255 per bin (bin i ≈ i × sampleRate / 2048 Hz); false before any sound */
  spectrum(out: Uint8Array<ArrayBuffer>): boolean {
    if (!this.ctx) return false;
    this.analyser.getByteFrequencyData(out);
    return true;
  }

  /** the output's sample rate, for reading the spectrum's bins as frequencies */
  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  // ---------- drums ----------

  /** `tune` is a frequency ratio (2 = an octave up). Tone, decay and drive come from the channel's drum settings. */
  private drum(track: Track, out: AudioNode, when: number, dur: number, tune: number, vel: number) {
    const ctx = this.ctx!;
    const dp = drumOf(track.synth);
    const bright = Math.pow(2, dp.tone * 1.2);
    const long = Math.max(0.25, dp.decay);
    const nodes: AudioScheduledSourceNode[] = [];
    const amp = ctx.createGain();
    // drive: the kick and snare get a little by nature; the channel's Drive adds more
    const grit = Math.min(1, dp.drive + (track.waveform === 'kick' ? 0.18 : track.waveform === 'snare' ? 0.1 : 0));
    if (grit > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = this.driveCurve(1 + grit * 6);
      const trim = ctx.createGain();
      trim.gain.value = 1 / (1 + grit * 0.5);
      amp.connect(shaper).connect(trim).connect(out);
    } else amp.connect(out);
    const peak = vel * 0.9;
    const env = (g: AudioParam, level: number, decay: number, start = when) => {
      g.setValueAtTime(0, start);
      g.linearRampToValueAtTime(level, start + 0.001);
      g.exponentialRampToValueAtTime(0.0001, start + decay * long);
    };
    const noise = (filter: BiquadFilterType, f: number, q: number, level: number, decay: number, start = when) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      n.playbackRate.value = 0.9 + Math.random() * 0.2;
      const bq = ctx.createBiquadFilter();
      bq.type = filter;
      bq.frequency.value = Math.min(18000, f * tune * bright);
      bq.Q.value = q;
      const g = ctx.createGain();
      env(g.gain, level, decay, start);
      n.connect(bq).connect(g).connect(amp);
      n.start(start, Math.random());
      n.stop(start + decay * long + 0.02);
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
      o.stop(when + decay * long + 0.02);
      nodes.push(o);
    };
    /** six detuned squares at inharmonic ratios — the 808 cymbal recipe — plus a breath of noise on top */
    const metal = (decay: number, level: number) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = Math.min(16000, 10000 * bright);
      bp.Q.value = 0.8;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = Math.min(14000, 7000 * bright);
      const g = ctx.createGain();
      env(g.gain, level, decay);
      bp.connect(hp).connect(g).connect(amp);
      for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 40 * r * tune;
        o.connect(bp);
        o.start(when);
        o.stop(when + decay * long + 0.02);
        nodes.push(o);
      }
      noise('highpass', 9000, 0.7, level * 0.35, decay * 0.8);
    };

    switch (track.waveform) {
      case 'kick':
        // body: a fast sweep into a round sub; punch: a short mid thump; click: a filtered tick
        tone('sine', 180, 46, 0.08, peak, 0.55);
        tone('sine', 95, 50, 0.04, peak * 0.45, 0.12);
        noise('highpass', 3500, 0.8, peak * 0.25, 0.008);
        break;
      case 'snare':
        tone('triangle', 260, 180, 0.04, peak * 0.5, 0.11);
        tone('sine', 330, 220, 0.03, peak * 0.3, 0.08);
        noise('bandpass', 2400, 0.7, peak * 0.85, 0.22);
        noise('highpass', 6000, 0.7, peak * 0.4, 0.16);
        break;
      case 'hat':
        metal(0.045 + dur * 0.05, peak * 0.55);
        break;
      case 'openhat':
        metal(Math.max(0.25, Math.min(0.9, dur)), peak * 0.5);
        break;
      case 'clap':
        for (const d of [0, 0.01, 0.021]) noise('bandpass', 1300, 1.3, peak * 0.8, 0.028, when + d);
        noise('bandpass', 1150, 0.9, peak * 0.7, 0.26, when + 0.031);
        noise('highpass', 4000, 0.6, peak * 0.2, 0.12, when + 0.031);
        break;
      case 'rim':
        tone('square', 1750, 1650, 0.01, peak * 0.28, 0.03);
        tone('triangle', 520, 480, 0.01, peak * 0.3, 0.05);
        noise('bandpass', 3600, 2, peak * 0.4, 0.025);
        break;
      case 'tom':
        tone('sine', 200, 98, 0.22, peak, 0.45);
        tone('triangle', 400, 200, 0.05, peak * 0.2, 0.08);
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
    const p = synthOf(track.waveform, track.synth);
    const peak = 0.3 * vel * p.gain;
    const a = Math.max(0.003, track.attack);
    const r = Math.max(0.02, track.release);
    // the amp: attack to the peak, fall to sustain over `decay`, release when the note ends
    const end = when + Math.max(dur, a);
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(peak, when + a);
    if (p.sustain < 1) amp.gain.setTargetAtTime(peak * p.sustain, when + a, Math.max(0.01, p.decay) / 3);
    amp.gain.setTargetAtTime(0, end, r / 4);
    // a sound that falls silent by itself (no sustain) can stop once it has
    const stop = p.sustain > 0 ? end + r * 1.6 : Math.min(end + r * 1.6, when + a + Math.max(0.01, p.decay) * 2.5);

    const { input } = this.chain(p, amp, freq, when, dur);
    const bank = this.oscBank(p, track.timbre, freq, input, amp, when);
    const nodes: AudioScheduledSourceNode[] = [...bank.nodes];
    /** oscillators that sound at the note's pitch — these follow the bend (an LFO doesn't) */
    const pitched: OscillatorNode[] = bank.oscs.map((x) => x.o);
    if (p.vibrato > 0) nodes.push(this.vibrato(p, pitched, when));
    if (p.wow > 0) nodes.push(this.wow(p, pitched, when));

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
      n.stop(Math.max(stop, when + 0.01) + 0.05);
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
