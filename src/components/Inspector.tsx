import { Fragment, useEffect, useRef, useState } from 'react';
import { engine } from '../engine/audio';
import { CONSTANTS, FUNCTIONS } from '../engine/expr';
import { PITCH_MODES, midiToName, type PitchMode } from '../engine/music';
import { CHANNEL_PALETTE, TRACK_COLORS } from '../engine/presets';
import { DRUMS, SONG_DEFAULTS, STRETCH_MAX, STRETCH_MIN, TRACK_DEFAULTS, WAVEFORMS, isDrum, keyLabel, patternBeats, stretchOf, voiceLabel, type PlayMode, type Track, type Waveform } from '../engine/project';
import { readVoiceFile, useLibrary, voiceFile, voiceOf, wearsVoice, type Voice } from '../state/library';
import { mutateTimbre } from '../engine/mutate';
import { DRUM_BASE, PATCHES, VOICE_HINTS as SYNTH_HINTS, cutoffHz, surprise, type DrumParams, type FilterKind, type MelodicVoice, type OscWave, type SynthParams } from '../engine/synth';
import { toast } from './TopBar';
import { WAVE_VOICES, timbreSamples, waveVoiceOf, type WaveVoice } from '../engine/timbre';
import { useSelectedTrack, useStore } from '../state/store';
import { Icon, Info, NumberField, Seg, Slider, Stepper, TextField, download, fileSafe, getRender } from './ui';
import { StepPicker } from './StepPicker';
import { BEND_RANGES } from '../engine/midi';
import { FormulaEditor } from './FormulaEditor';
import { Dropdown } from './Dropdown';
import { MAX_STEPS, shortBeats, stepLabel } from '../engine/steps';

type Tab = 'channel' | 'sound' | 'notes' | 'guide';


function TimbreEditor() {
  const track = useSelectedTrack()!;
  const { updateTrack, checkpoint } = useStore();
  const samples = timbreSamples(track.timbre, 128);
  const d = samples ? Array.from(samples, (v, i) => `${i ? 'L' : 'M'}${((i / 127) * 200).toFixed(1)},${(22 - v * 18).toFixed(1)}`).join('') : '';
  return (
    <div style={{ marginTop: 10 }}>
      <div className="field">
        <span>
          One cycle of the wave, <code className="mono">f(p)</code> with p = 0 → 1
        </span>
        <FormulaEditor
          value={track.timbre}
          vars={{ p: 'phase through one cycle, 0 → 1' }}
          onFocus={checkpoint}
          onValue={(timbre) => updateTrack(track.id, { timbre }, false)}
        />
      </div>
      <svg className="spark" viewBox="0 0 200 44" preserveAspectRatio="none" style={{ height: 44 }}>
        <line x1="0" x2="200" y1="22" y2="22" stroke="var(--line)" strokeDasharray="2 4" />
        {d && <path d={d} fill="none" stroke="var(--wave-preview)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* the Sonic Menagerie: each a whole voice — wave, envelope and Shape */}
      <div className="wave-voices">
        {WAVE_VOICES.map((v) => (
          <button
            key={v.id}
            className={v.timbre === track.timbre ? 'on' : ''}
            onClick={() => {
              updateTrack(track.id, wearWaveVoice(v));
              toast(`${v.name} — ${v.hint.split(' — ')[0]}. ⌘Z to go back`);
            }}
            title={`${v.name}: ${v.hint}`}
          >
            <WaveGlyph formula={v.timbre} color="currentColor" />
            <span>{v.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** everything a wave voice sets on a channel */
const wearWaveVoice = (v: WaveVoice) => ({ waveform: 'custom' as Waveform, timbre: v.timbre, attack: v.attack, release: v.release, synth: { ...v.synth } });

function WaveGlyph({ formula, color }: { formula: string; color: string }) {
  const s = timbreSamples(formula, 48);
  if (!s) return null;
  const d = Array.from(s, (v, i) => `${i ? 'L' : 'M'}${((i / 47) * 26).toFixed(1)},${(7 - v * 5.5).toFixed(1)}`).join('');
  return (
    <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.3} />
    </svg>
  );
}

const VOICE_HINTS: Record<string, string> = {
  ...SYNTH_HINTS,
  kick: 'swept sub, thump and click',
  snare: 'two tones and bright noise',
  hat: 'six metallic squares and air, short',
  openhat: 'metallic, long',
  clap: 'three quick bursts and a room',
  rim: 'short wooden click',
  tom: 'pitched sweep',
  crash: 'metal and noise, long',
};
const GLYPH_FORMULA: Partial<Record<Waveform, string>> = { sine: 'sin(tau*p)', triangle: 'tri(p)', square: 'sqr(p)', sawtooth: 'saw(p)' };

type TrackPatch = Parameters<ReturnType<typeof useStore.getState>['updateTrack']>[1];
/**
 * Every voice a channel can step through with ‹ ›, in the Voice menu's order: a drum channel
 * through the drums; a melodic one through your voices, the Sonic Menagerie, then the stock voices.
 */
function voiceSteps(track: Track, voices: Voice[]): { key: string; label: string; patch: TrackPatch }[] {
  if (isDrum(track.waveform)) return (Object.keys(DRUMS) as Waveform[]).map((w) => ({ key: w, label: voiceLabel(w), patch: { waveform: w, synth: undefined } }));
  return [
    ...voices.filter((v) => !isDrum(v.waveform)).map((v) => ({ key: `mine:${v.id}`, label: v.name, patch: { waveform: v.waveform, timbre: v.timbre, attack: v.attack, release: v.release, synth: v.synth ? { ...v.synth } : undefined } })),
    ...WAVE_VOICES.map((v) => ({ key: `menagerie:${v.id}`, label: v.name, patch: wearWaveVoice(v) })),
    ...(Object.keys(WAVEFORMS) as Waveform[]).map((w) => ({ key: w, label: voiceLabel(w), patch: { waveform: w, synth: undefined } })),
  ];
}
/** where the channel is in that list: the voice it wears, else its plain voice */
function voiceStepAt(track: Track, voices: Voice[]): string {
  const mine = voices.find((v) => wearsVoice(track, v));
  if (mine) return `mine:${mine.id}`;
  const m = waveVoiceOf(track);
  return m ? `menagerie:${m.id}` : track.waveform;
}

/** One dropdown for the sound: melodic voices, drums, and voices you saved. */
function VoicePicker() {
  const track = useSelectedTrack()!;
  const updateTrack = useStore((s) => s.updateTrack);
  const { voices, deleteVoice } = useLibrary();
  const up = (patch: Parameters<typeof updateTrack>[1]) => updateTrack(track.id, patch);
  const glyph = (w: Waveform, timbre?: string) =>
    w === 'custom' && timbre ? <WaveGlyph formula={timbre} color="currentColor" /> : GLYPH_FORMULA[w] ? <WaveGlyph formula={GLYPH_FORMULA[w]!} color="currentColor" /> : <span className={`voice-dot ${isDrum(w) ? 'drum' : ''}`} />;
  const mine = voices.find((v) => wearsVoice(track, v));
  const menagerie = mine ? undefined : waveVoiceOf(track);
  return (
    <Dropdown
      label="Voice"
      value={
        <>
          <span className="dropdown-glyph">{glyph(track.waveform, track.timbre)}</span>
          <b>{mine ? mine.name : menagerie ? menagerie.name : voiceLabel(track.waveform)}</b>
          <small>{mine ? `my voice · ${voiceLabel(track.waveform)}` : menagerie ? menagerie.hint.split(' — ')[0] : VOICE_HINTS[track.waveform]}</small>
        </>
      }
      groups={[
        {
          title: 'My voices',
          items: voices.map((v) => ({
            key: v.id,
            label: v.name,
            hint: `${voiceLabel(v.waveform)}${v.waveform === 'custom' ? ` · ${v.timbre}` : ''} · ${Math.round(v.attack * 1000)} ms in · ${v.release.toFixed(2)} s out`,
            glyph: glyph(v.waveform, v.timbre),
            selected: mine?.id === v.id,
            onSelect: () => up({ waveform: v.waveform, timbre: v.timbre, attack: v.attack, release: v.release, synth: v.synth ? { ...v.synth } : undefined }),
            onDelete: () => (deleteVoice(v.id), toast(`Deleted the voice “${v.name}” — channels using it keep their sound`)),
          })),
        },
        {
          title: 'Sonic Menagerie',
          items: WAVE_VOICES.map((v) => ({
            key: `menagerie:${v.id}`,
            label: v.name,
            hint: v.hint,
            glyph: glyph('custom', v.timbre),
            selected: menagerie?.id === v.id,
            onSelect: () => up(wearWaveVoice(v)),
          })),
        },
        {
          title: 'Melodic',
          items: (Object.keys(WAVEFORMS) as Waveform[]).map((w) => ({
            key: w,
            label: WAVEFORMS[w as keyof typeof WAVEFORMS],
            hint: VOICE_HINTS[w],
            glyph: glyph(w, w === 'custom' ? track.timbre : undefined),
            selected: !mine && !menagerie && track.waveform === w,
            // a new voice starts from its own patch — the channel's changes were for the old one
            onSelect: () => up({ waveform: w, synth: undefined }),
          })),
        },
        {
          title: 'Drums',
          items: (Object.keys(DRUMS) as Waveform[]).map((w) => ({
            key: w,
            label: voiceLabel(w),
            hint: VOICE_HINTS[w],
            glyph: glyph(w),
            selected: !mine && track.waveform === w,
            onSelect: () => up({ waveform: w, synth: undefined }),
          })),
        },
      ]}
    />
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`);
const hz = (v: number) => {
  const f = cutoffHz(v);
  return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`;
};

/**
 * Shape the sound: one Sauce knob for instant width, shimmer and grit, and the detail behind it
 * — oscillator, filter, amp and effects — in four short tabs. Every change sits on top of the
 * voice's own patch; Reset takes them all away.
 */
function SoundPanel() {
  const track = useSelectedTrack()!;
  const updateTrack = useStore((s) => s.updateTrack);
  const checkpoint = useStore((s) => s.checkpoint);
  const [tab, setTab] = useState<'osc' | 'filter' | 'amp' | 'fx'>('osc');
  const changes = track.synth ?? {};
  const changed = Object.keys(changes).length > 0;
  const set = (patch: Partial<SynthParams & DrumParams>, record = false) => updateTrack(track.id, { synth: { ...changes, ...patch } }, record);
  const reset = () => updateTrack(track.id, { synth: undefined });
  // one knob back to the voice's own setting
  const unset = (key: keyof (SynthParams & DrumParams)) => {
    const { [key]: _gone, ...rest } = changes;
    updateTrack(track.id, { synth: Object.keys(rest).length ? rest : undefined }, false);
  };
  const knob = (label: string, key: keyof (SynthParams & DrumParams), min: number, max: number, value: number, format: (v: number) => string = pct, step = 0.01) => (
    <div onPointerDown={checkpoint}>
      <Slider label={label} value={value} min={min} max={max} step={step} format={format} onChange={(v) => set({ [key]: v })} reset={() => unset(key)} />
    </div>
  );

  if (isDrum(track.waveform)) {
    const d = { ...DRUM_BASE, ...changes };
    return (
      <div className="sound-panel">
        <div className="sauce-row">
          {knob('Sauce', 'sauce', 0, 1, d.sauce)}
          {changed && (
            <button className="btn small ghost" onClick={reset} title="Back to the drum as it was">
              Reset
            </button>
          )}
        </div>
        {knob('Tone', 'tone', -1, 1, d.tone, (v) => (Math.abs(v) < 0.02 ? 'even' : v < 0 ? `darker ${Math.round(-v * 100)}` : `brighter ${Math.round(v * 100)}`))}
        {knob('Decay', 'decay', 0.25, 3, d.decay, (v) => `×${v.toFixed(2)}`)}
        {knob('Drive', 'drive', 0, 1, d.drive)}
      </div>
    );
  }

  const p = { ...(PATCHES[track.waveform as MelodicVoice] ?? PATCHES.sine), ...changes };
  return (
    <div className="sound-panel">
      <div className="sauce-row">
        {knob('Sauce', 'sauce', 0, 1, p.sauce)}
        <div className="sauce-actions">
        <button
          className="btn small ghost"
          title="A tasteful variation of this sound — same kind of voice, moved around (⌘Z to undo)"
          onClick={() => {
            checkpoint();
            set(surprise(p));
          }}
        >
          <Icon name="dice" size={12} /> Surprise me
        </button>
        {changed && (
          <button className="btn small ghost" onClick={reset} title="Back to the voice’s own patch">
            Reset
          </button>
        )}
        </div>
        <Info>
          Sauce thickens and widens the sound in one move: more unison voices and detune, stereo width, chorus, a touch of drive and delay, a brighter
          filter. Shape below sets the detail. Every change sits on top of the voice’s own patch — Reset takes them away, Save voice keeps them.
        </Info>
      </div>
      <Seg<'osc' | 'filter' | 'amp' | 'fx'>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'osc', label: 'Oscillator' },
          { value: 'filter', label: 'Filter' },
          { value: 'amp', label: 'Amp' },
          { value: 'fx', label: 'Effects' },
        ]}
      />
      <div className="sound-tab">
        {tab === 'osc' && (
          <>
            {track.waveform !== 'custom' && (
              <div className="row sound-wave">
                <Seg<OscWave>
                  value={p.wave}
                  onChange={(wave) => (checkpoint(), set({ wave }))}
                  options={[
                    // a voice with its own wave (Koto, Mist Pad…) can go back to it
                    ...(PATCHES[track.waveform as MelodicVoice]?.shape ? [{ value: 'custom' as OscWave, label: 'Own' }] : []),
                    { value: 'sine', label: 'Sine' },
                    { value: 'triangle', label: 'Tri' },
                    { value: 'sawtooth', label: 'Saw' },
                    { value: 'square', label: 'Square' },
                    { value: 'fm', label: 'FM' },
                  ]}
                />
              </div>
            )}
            {p.wave === 'fm' ? (
              <>
                {knob('FM ratio', 'fmRatio', 0.5, 8, p.fmRatio, (v) => `×${v.toFixed(2)}`, 0.25)}
                {knob('FM depth', 'fmIndex', 0, 6, p.fmIndex, (v) => v.toFixed(1), 0.05)}
                {knob('FM fall', 'fmDecay', 0.05, 4, p.fmDecay, secs)}
              </>
            ) : null}
            {knob('Unison', 'unison', 1, 7, p.unison, (v) => `×${Math.round(v)}`, 1)}
            {knob('Detune', 'detune', 0, 40, p.detune, (v) => `${Math.round(v)}¢`, 0.5)}
            {knob('Width', 'width', 0, 1, p.width)}
            {knob('Sub', 'sub', 0, 1, p.sub)}
            {knob('Noise', 'noise', 0, 1, p.noise)}
          </>
        )}
        {tab === 'filter' && (
          <>
            <div className="row sound-wave">
              <Seg<FilterKind>
                value={p.filter}
                onChange={(filter) => (checkpoint(), set({ filter }))}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'lowpass', label: 'Low-pass' },
                  { value: 'bandpass', label: 'Band' },
                  { value: 'highpass', label: 'High-pass' },
                ]}
              />
            </div>
            {p.filter !== 'off' && (
              <>
                {knob('Cutoff', 'cutoff', 0, 1, p.cutoff, hz)}
                {knob('Resonance', 'resonance', 0, 1, p.resonance)}
                {knob('Env amount', 'envAmount', 0, 1, p.envAmount)}
                {knob('Env fall', 'envDecay', 0.02, 2, p.envDecay, secs)}
                {knob('Key track', 'keyTrack', 0, 1, p.keyTrack)}
              </>
            )}
          </>
        )}
        {tab === 'amp' && (
          <>
            <div onPointerDown={checkpoint}>
              <Slider label="Attack" value={track.attack} min={0.003} max={1.5} format={secs} onChange={(attack) => updateTrack(track.id, { attack }, false)} reset={TRACK_DEFAULTS.attack} />
            </div>
            {knob('Decay', 'decay', 0.02, 3, p.decay, secs)}
            {knob('Sustain', 'sustain', 0, 1, p.sustain)}
            <div onPointerDown={checkpoint}>
              <Slider label="Release" value={track.release} min={0.02} max={3} format={secs} onChange={(release) => updateTrack(track.id, { release }, false)} reset={TRACK_DEFAULTS.release} />
            </div>
          </>
        )}
        {tab === 'fx' && (
          <>
            {knob('Drive', 'drive', 0, 1, p.drive)}
            {knob('Chorus', 'chorus', 0, 1, p.chorus)}
            {knob('Delay', 'delay', 0, 1, p.delay)}
            <div className="row sound-wave seg-tight">
              <span className="muted" style={{ fontSize: 'var(--fs-sm)', width: 64 }}>Delay time</span>
              <Seg<number>
                value={p.delayTime}
                onChange={(delayTime) => (checkpoint(), set({ delayTime }))}
                options={[
                  { value: 0.5, label: '1/8' },
                  { value: 0.75, label: '3/16' },
                  { value: 1, label: '1/4' },
                  { value: 1.5, label: '3/8' },
                ]}
              />
            </div>
            {knob('Vibrato', 'vibrato', 0, 1, p.vibrato)}
            {knob('Wow', 'wow', 0, 1, p.wow)}
          </>
        )}
      </div>
    </div>
  );
}

/** Keep the current sound as a named voice — and bring voices in from, or take them out to, a file. */
/**
 * The voice's tools, icons only, under the Voice menu: for a custom wave its own Mutate and the
 * lock against the channel's Mutate; then save, import, export all, export this sound. Save lights
 * up (and flashes on every change) while the sound differs from any voice you have or preset.
 */
function VoiceTools() {
  const track = useSelectedTrack()!;
  const updateTrack = useStore((s) => s.updateTrack);
  const chaos = useStore((s) => s.chaos);
  const { voices, saveVoice, importVoices } = useLibrary();
  const [naming, setNaming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // a stock voice with nothing changed is already in the Voice menu: nothing to save
  const savable = track.waveform === 'custom' || Object.keys(track.synth ?? {}).length > 0;
  // the saved voice this channel sounds like, if any — its name is the one you gave it
  const worn = voices.find((v) => wearsVoice(track, v));
  // changed from every preset and saved voice: worth saving
  const dirty = savable && !worn && !waveVoiceOf(track);
  const sound = JSON.stringify([track.waveform, track.timbre, track.attack, track.release, track.synth]);
  const custom = track.waveform === 'custom';
  const unlocked = !!track.timbreUnlocked;
  const fresh = () => {
    const preset = WAVE_VOICES.find((v) => v.timbre === track.timbre);
    return track.waveform === 'custom' ? (preset?.name ?? (track.name.trim() || 'My wave')) : voiceLabel(track.waveform);
  };
  const suggest = () => {
    if (worn) return worn.name;
    const base = fresh();
    let name = base, i = 2;
    while (voices.some((v) => v.name === name)) name = `${base} ${i++}`;
    return name;
  };
  const save = () => {
    const name = (naming ?? '').trim();
    if (!name) return setNaming(null);
    const replacing = voices.some((v) => v.name === name);
    saveVoice(voiceOf(track, name));
    setNaming(null);
    toast(`${replacing ? 'Updated' : 'Saved'} voice “${name}” — it is in the Voice menu, in every track`);
  };
  if (naming === null)
    return (
      <div className="row voice-tools">
        <span className="row voice-tool-group">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              className="icon-btn voice-step"
              onClick={() => {
                const list = voiceSteps(track, voices);
                const at = list.findIndex((x) => x.key === voiceStepAt(track, voices));
                const next = list[(Math.max(0, at) + dir + list.length) % list.length];
                updateTrack(track.id, next.patch);
                toast(next.label);
              }}
              title={dir < 0 ? 'Previous voice' : 'Next voice'}
              aria-label={dir < 0 ? 'Previous voice' : 'Next voice'}
            >
              {dir < 0 ? '<' : '>'}
            </button>
          ))}
        </span>
        {custom && (
          <span className="row voice-tool-group">
            <button
              className="icon-btn"
              onClick={() => {
                if (track.locked) return toast('This channel is locked — unlock it (the padlock beside M / S) to mutate its wave');
                const timbre = mutateTimbre(track.timbre, chaos);
                if (!timbre) return toast('No new wave found from this one — try again, or turn Mutate towards Wild');
                updateTrack(track.id, { timbre });
                toast('Mutated the wave — ⌘Z to bring the old one back');
              }}
              title="Mutate wave: a new f(p) grown from this one (only the wave changes; how far follows Mutate’s Safe ↔ Wild)"
              aria-label="Mutate wave"
            >
              <Icon name="dice" size={14} />
            </button>
            <button
              className={`icon-btn wave-lock ${unlocked ? '' : 'on'}`}
              aria-pressed={!unlocked}
              onClick={() => {
                updateTrack(track.id, { timbreUnlocked: !unlocked });
                toast(unlocked ? 'Wave locked — Mutate leaves it as it is' : 'Wave unlocked — Mutate (R / ⇧R) may change it too');
              }}
              title={unlocked ? 'Unlocked: Mutate (R / ⇧R) may change this wave too — click to lock it' : 'Locked: Mutate (R / ⇧R) leaves this wave alone — click to let it change the wave too'}
              aria-label={unlocked ? 'Wave unlocked' : 'Wave locked'}
            >
              <Icon name={unlocked ? 'unlock' : 'lock'} size={14} />
            </button>
          </span>
        )}
        <span className="row voice-tool-group">
          {savable && (
            <button
              // a new key on every change while unsaved restarts the flash
              key={dirty ? sound : 'saved'}
              className={`icon-btn voice-save ${dirty ? 'dirty' : ''}`}
              onClick={() => setNaming(suggest())}
              title={dirty ? 'Changed — save this sound as a voice (waveform, f(p), attack, release and its Shape)' : 'Save this sound as a voice (waveform, f(p), attack, release and its Shape)'}
              aria-label={dirty ? 'Save voice (changed)' : 'Save voice'}
            >
              <Icon name="save" size={14} />
            </button>
          )}
          <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Import voices from a .json file — they join My voices in the Voice menu" aria-label="Import voices">
            <Icon name="upload" size={14} />
          </button>
          <button
            className="icon-btn"
            disabled={!voices.length}
            onClick={() => download('soundfunc-voices.json', JSON.stringify(voiceFile(voices), null, 2), 'application/json')}
            title={voices.length ? `Export all ${voices.length} of your voices as one file` : 'Save a voice first — then you can export your voices'}
            aria-label="Export all voices"
          >
            <Icon name="download" size={14} />
          </button>
          {savable && (
            <button
              className="icon-btn"
              onClick={() => {
                const voice = worn ?? voiceOf(track, fresh());
                download(`${fileSafe(voice.name)}.soundfunc-voice.json`, JSON.stringify(voiceFile([voice]), null, 2), 'application/json');
              }}
              title={worn ? `Export “${worn.name}” as a voice file` : 'Export this sound as a voice file (without saving it)'}
              aria-label="Export this sound"
            >
              <Icon name="send" size={14} />
            </button>
          )}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const n = importVoices(readVoiceFile(await f.text()));
              toast(n ? `Imported ${n} voice${n > 1 ? 's' : ''} — under My voices in the Voice menu` : 'No voices in that file');
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Could not read that file');
            }
          }}
        />
      </div>
    );
  return (
    <div className="save-voice">
      <input
        className="input"
        autoFocus
        value={naming}
        onChange={(e) => setNaming(e.target.value)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') setNaming(null);
        }}
        aria-label="Voice name"
      />
      <button className="btn small primary" onClick={save}>
        Save
      </button>
      <button className="btn small ghost" onClick={() => setNaming(null)}>
        Cancel
      </button>
    </div>
  );
}

const fmtX = (v: number) => (Number.isInteger(v) ? String(v) : v < 1 && Number.isInteger(1 / v) ? `1/${1 / v}` : String(Number(v.toFixed(3))));

/** Stretch the channel in time: ÷2, ×2, or any factor — the function keeps its shape and plays out slower or faster. */
function StretchField() {
  const track = useSelectedTrack()!;
  const updateTrack = useStore((s) => s.updateTrack);
  const s = stretchOf(track);
  const set = (v: number) => updateTrack(track.id, { stretch: Math.min(STRETCH_MAX, Math.max(STRETCH_MIN, v)) });
  return (
    <label className="field stretch-field">
      <span>
        Stretch
        {s !== 1 && (
          <button type="button" className="stretch-reset" onClick={(e) => (e.preventDefault(), set(1))} title="Back to ×1" aria-label="Reset stretch">
            reset
          </button>
        )}
      </span>
      <div className="stretch-ctl">
        <button type="button" className="stretch-btn" onClick={(e) => (e.preventDefault(), set(s / 2))} disabled={s <= STRETCH_MIN} title="Half as long — twice as fast" aria-label="Stretch ÷2">
          ÷2
        </button>
        <span className="stretch-x">×</span>
        <NumberField
          className="input num stretch-input"
          min={STRETCH_MIN}
          max={STRETCH_MAX}
          value={s}
          onValue={set}
          aria-label="Stretch"
          title={`×${fmtX(s)} — 2 = twice as long and slow, 0.5 = twice as fast (1/16 … 16)`}
        />
        <button type="button" className="stretch-btn" onClick={(e) => (e.preventDefault(), set(s * 2))} disabled={s >= STRETCH_MAX} title="Twice as long — half as fast" aria-label="Stretch ×2">
          ×2
        </button>
      </div>
    </label>
  );
}

/** The selected channel's grid: steps × step length, stretch, octave. (Glide all / Snap all are in the top bar.) */
function ChannelGrid() {
  const track = useSelectedTrack()!;
  const song = useStore((s) => s.project.song);
  const tracks = useStore((s) => s.project.tracks);
  const { updateTrack, setGrid, setStepBeatsAll } = useStore();
  const free = song.lengthMode === 'free';
  const drum = isDrum(track.waveform);
  return (
    <>
      <div className="eyebrow eyebrow-info">
        Grid
        <Info>
          {track.steps} steps of {stepLabel(track.stepBeats)} = {shortBeats(track.steps * track.stepBeats)}
          {free ? ' — the song is free, so this channel loops on its own.' : ` — the song’s Length (${song.lengthBeats} beats): change the steps or the step length and the other follows.`}{' '}
          Stretch plays the channel out over more or less time without changing its shape: ×2 is twice as long and slow, ×0.5 twice as fast
          {stretchOf(track) !== 1 ? ` — now one pass lasts ${shortBeats(patternBeats(track))}` : ''}
          {!free && stretchOf(track) > 1 ? ', longer than the song, so it plays across passes (with Repeats exactly, only its start is heard)' : ''}. Octave sets
          where pitch 0 sits: 4 is middle C’s octave.
        </Info>
      </div>
      <div className="channel-grid">
        <label className="field">
          <span>Steps</span>
          <div className="row" style={{ gap: 6 }}>
            <NumberField className="input num" integer min={1} max={MAX_STEPS} value={track.steps} onValue={(steps) => setGrid(track.id, { steps })} aria-label="Steps" />
            <span className="muted">×</span>
            <StepPicker
              compact
              value={track.stepBeats}
              onChange={(stepBeats) => setGrid(track.id, { stepBeats })}
              onApplyAll={
                tracks.length > 1
                  ? () => {
                      setStepBeatsAll(track.stepBeats);
                      toast(`Every channel now steps in ${stepLabel(track.stepBeats)} — ⌘Z to undo`);
                    }
                  : undefined
              }
            />
          </div>
        </label>
        <StretchField />
        {!drum && (
          <label className="field">
            <span>Octave</span>
            <Stepper label="Octave" min={-4} max={9} value={track.octave} onValue={(octave) => updateTrack(track.id, { octave })} />
          </label>
        )}
      </div>
    </>
  );
}

const swatch = (c: string, on: boolean) => ({ background: c, border: 'none', cursor: 'pointer', width: 16, height: 13, outline: on ? '1.5px solid var(--ink)' : 'none', outlineOffset: 2 });

/** The basic colours, the channel's own colour if it is another, and a palette with every colour — plus any colour at all. */
function ColorRow({ color, onColor }: { color: string; onColor: (c: string) => void }) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const lower = color.toLowerCase();
  const isBasic = TRACK_COLORS.includes(lower);
  useEffect(() => {
    if (!pos) return;
    const close = (e: MouseEvent) => !pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node) && setPos(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [pos]);
  const open = () => {
    const r = btn.current!.getBoundingClientRect();
    const W = 236;
    setPos({ left: Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8), top: r.bottom + 8 });
  };
  return (
    <div className="row color-row" style={{ gap: 6, marginBottom: 4 }}>
      {TRACK_COLORS.map((c) => (
        <button key={c} onClick={() => onColor(c)} className="stone" style={swatch(c, c === lower)} aria-label={`color ${c}`} />
      ))}
      {!isBasic && <button className="stone" style={swatch(color, true)} aria-label={`color ${color} (this channel's)`} title="This channel’s colour" />}
      <button ref={btn} className={`color-more ${pos ? 'on' : ''}`} onClick={() => (pos ? setPos(null) : open())} aria-label="More colours" aria-expanded={!!pos} title="More colours">
        <Icon name="plus" size={11} />
      </button>
      {pos && (
        <div ref={pop} className="color-pop" style={{ left: pos.left, top: pos.top }} role="dialog" aria-label="Colour palette">
          <div className="color-grid">
            {CHANNEL_PALETTE.map((c) => (
              <button
                key={c}
                className={`color-cell ${c === lower ? 'on' : ''}`}
                style={{ background: c }}
                aria-label={`color ${c}`}
                onClick={() => {
                  onColor(c);
                  setPos(null);
                }}
              />
            ))}
          </div>
          <label className="color-custom">
            <span>Any colour</span>
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#888888'} onChange={(e) => onColor(e.target.value)} aria-label="Pick any colour" />
          </label>
        </div>
      )}
    </div>
  );
}

function ChannelTab() {
  const track = useSelectedTrack()!;
  const { project, updateTrack, setSong, duplicateTrack, removeTrack, checkpoint } = useStore();
  const up = (patch: Parameters<typeof updateTrack>[1]) => updateTrack(track.id, patch);
  const render = getRender(track, project.song);
  const drum = isDrum(track.waveform);
  const glide = track.playMode === 'glide' && !drum;

  return (
    <>
      <TextField className="track-title" value={track.name} onFocus={checkpoint} onValue={(name) => updateTrack(track.id, { name }, false)} />
      <ColorRow color={track.color} onColor={(color) => up({ color })} />
      <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
        {glide ? 'continuous glide' : `${render.notes.length} ${drum ? 'hits' : 'notes'}`} · {keyLabel(project.song)}
      </div>

      <ChannelGrid />

      {!drum && (
        <>
          <div className="eyebrow eyebrow-info">
            Play as
            <Info>Glide: one voice slides continuously along f(x); velocity shapes its volume. It exports as MIDI pitch bend. Snap to scale keeps the slide on the scale’s notes; free pitch goes anywhere between them.</Info>
          </div>
          <Seg<PlayMode>
            value={track.playMode}
            onChange={(playMode) => up({ playMode })}
            options={[
              { value: 'notes', label: 'Notes' },
              { value: 'glide', label: 'Glide' },
            ]}
          />
          {glide && (
            <>
              <div style={{ marginTop: 8 }}>
                <Seg<boolean>
                  value={track.quantize}
                  onChange={(quantize) => up({ quantize })}
                  options={[
                    { value: true, label: 'Snap to scale' },
                    { value: false, label: 'Free pitch' },
                  ]}
                />
              </div>
              <Slider label="Portamento" value={track.glide} min={0} max={0.5} format={(v) => `${Math.round(v * 1000)}ms`} onChange={(g) => up({ glide: g })} reset={TRACK_DEFAULTS.glide} />
            </>
          )}
        </>
      )}

      <div className="eyebrow">Feel</div>
      {!glide && <Slider label="Swing" value={track.swing} min={0} max={0.6} format={(v) => `${Math.round(v * 100)}%`} onChange={(swing) => up({ swing })} reset={TRACK_DEFAULTS.swing} />}
      {drum ? (
        <p className="muted row" style={{ fontSize: 'var(--fs-sm)', gap: 6 }}>
          Drum channel
          <Info>On drums, pitch tunes the hit in semitones, and ratchet turns a step into a roll.</Info>
        </p>
      ) : (
        <div className="field pitch-means" style={{ marginTop: 12 }}>
          <span>Pitch means</span>
          {/* the same LCD dropdown as the top bar's Key and Scale: "Scale degree (0, 1, 2…)" → name + hint */}
          <Dropdown
            compact
            label="Pitch means"
            value={<b>{PITCH_MODES[track.pitchMode].replace(/\s*\(.*\)$/, '')}</b>}
            groups={[
              {
                title: 'What the pitch input means',
                items: (Object.entries(PITCH_MODES) as [PitchMode, string][]).map(([k, v]) => {
                  const [, name = v, hint] = v.match(/^(.*?)\s*(?:\((.*)\))?$/) ?? [];
                  return { key: k, label: name, hint, selected: track.pitchMode === k, onSelect: () => up({ pitchMode: k }) };
                }),
              },
            ]}
          />
        </div>
      )}

      <div className="eyebrow">Export</div>
      <Slider label="Loops" value={project.song.exportLoops} min={1} max={32} step={1} format={(v) => `×${v}`} onChange={(exportLoops) => setSong({ exportLoops })} reset={SONG_DEFAULTS.exportLoops} />
      <div className="eyebrow-sub row" style={{ gap: 6, marginTop: 14, alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Pitch-bend range</span>
        <Info>
          A MIDI file only says how far a bend goes from −8192 to +8191; the instrument that plays it decides how many semitones that is — its
          pitch-bend range. If the two differ, bends come out bigger or smaller than you hear here (half the size when SoundFunc writes ±24 and the
          instrument is set to ±12). Set this to your instrument’s range — or set the instrument to this one (in Ableton: the instrument’s Pitch Bend
          Range / PB setting). Glides that slide further than the range start a new note on the way.
        </Info>
      </div>
      <div className="row export-curves seg-tight" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
        <Seg<number>
          value={project.song.bendRange ?? 24}
          onChange={(bendRange) => setSong({ bendRange })}
          options={BEND_RANGES.map((r) => ({ value: r, label: `±${r}` }))}
        />
      </div>
      <div className="eyebrow-sub row" style={{ gap: 6, marginTop: 14, alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Curves</span>
        <Info>
          For the automation export (Export → MIDI + automation): glides and note bends go out as pitch bend, volume as
          expression or pressure. Simplified keeps only the points that redraw each curve when a DAW joins them with straight lines — corners stay,
          straight runs collapse to their two ends (within 3 cents of pitch). Every sample writes all of them, 16 per step.
        </Info>
      </div>
      <div className="row export-curves" style={{ gap: 8, marginTop: 6, alignItems: 'center' }}>
        <Seg<'simple' | 'full'>
          value={project.song.exportCurves ?? 'simple'}
          onChange={(exportCurves) => setSong({ exportCurves })}
          options={[
            { value: 'simple', label: 'Simplified' },
            { value: 'full', label: 'Every sample' },
          ]}
        />
      </div>

      <div className="row" style={{ marginTop: 22, flexWrap: 'wrap' }}>
        <button className="btn small" onClick={() => duplicateTrack(track.id)}>
          <Icon name="copy" size={12} /> Duplicate
        </button>
        <button className="btn small ghost" onClick={() => removeTrack(track.id)}>
          <Icon name="close" size={12} /> Remove
        </button>
      </div>
    </>
  );
}

/** The channel's sound: its place in the mix first, then the voice that plays it. */
function SoundTab() {
  const track = useSelectedTrack()!;
  const { updateTrack } = useStore();
  const up = (patch: Parameters<typeof updateTrack>[1]) => updateTrack(track.id, patch);

  return (
    <>
      <div className="sound-tab-head">
        <span className="kit-swatch" style={{ background: track.color }} aria-hidden />
        <b>{track.name}</b>
      </div>
      <div className="eyebrow">Mix</div>
      <Slider label="Volume" value={track.volume} min={0} max={1} onChange={(volume) => up({ volume })} reset={TRACK_DEFAULTS.volume} />
      <Slider label="Pan" value={track.pan} min={-1} max={1} format={(v) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} onChange={(pan) => up({ pan })} reset={TRACK_DEFAULTS.pan} />
      <Slider label="Reverb" value={track.send} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} onChange={(send) => up({ send })} reset={TRACK_DEFAULTS.send} />

      <div className="eyebrow">Voice</div>
      <VoicePicker />
      <VoiceTools />
      {track.waveform === 'custom' && <TimbreEditor />}
      <SoundPanel />

    </>
  );
}

function NotesTab() {
  const track = useSelectedTrack()!;
  const song = useStore((s) => s.project.song);
  const { notes, curve } = getRender(track, song);
  if (track.playMode === 'glide' && !isDrum(track.waveform)) {
    let lo = 127, hi = 0;
    curve.midi.forEach((m, i) => curve.velocity[i] >= 0.01 && ((lo = Math.min(lo, m)), (hi = Math.max(hi, m))));
    return (
      <p className="muted row" style={{ marginTop: 0, fontSize: 'var(--fs-sm)', gap: 6 }}>
        {curve.midi.length} pitch samples{lo <= hi && ` · ${midiToName(Math.round(lo))}–${midiToName(Math.round(hi))}`}
        <Info>
          {track.name} glides instead of playing notes. The CSV export holds every sample, and MIDI export writes them as pitch bend (±24 semitones) with
          CC11 expression for volume.
        </Info>
      </p>
    );
  }
  return (
    <>
      <p className="muted row" style={{ marginTop: 0, fontSize: 'var(--fs-sm)', gap: 6 }}>
        One pass · {keyLabel(song)}
        <Info>Every note of one pass of {track.name}. Click a row to hear it. Export the full data as CSV or MIDI from the top bar.</Info>
      </p>
      <table className="notes-table">
        <thead>
          <tr>
            <th>step</th>
            <th>note</th>
            <th>midi</th>
            <th>vel</th>
            <th>len</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((n) => (
            <tr key={n.step} onClick={() => engine.preview(track, n.midi, n.velocity)}>
              <td className="muted">{n.step}</td>
              <td>{n.name}</td>
              <td>{n.midi}</td>
              <td>
                <span className="vel-bar" style={{ width: 4 + n.velocity * 26, opacity: 0.3 + n.velocity * 0.7 }} /> {Math.round(n.velocity * 127)}
              </td>
              <td>{n.duration.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notes.length === 0 && <p className="empty">Silence. Every velocity is zero.</p>}
    </>
  );
}

function GuideTab() {
  return (
    <div className="ref">
      <div className="eyebrow">How it flows</div>
      <p style={{ marginTop: 0 }}>
        Each step, the graph runs once. Whatever reaches <b>Note Out</b> becomes a note: <code>pitch</code> is mapped onto the key & scale,{' '}
        <code>velocity</code> 0 means rest, and <code>length</code> is measured in steps.
      </p>
      <p>
        <b>shift</b> delays a hit by part of a step (swing, flams). <b>ratchet</b> repeats it 2–8× inside the step (rolls). In <b>Glide</b> mode the channel
        is one sliding voice: <code>x</code> and <code>t</code> flow smoothly while <code>n</code> still ticks per step.
      </p>
      <div className="eyebrow">Chords</div>
      <p style={{ margin: 0 }}>
        The top bar’s <b>Harmony</b> is a function of <code>bar</code> giving the chord’s scale degree, e.g. <code>pick(bar, 0, 4, 5, 3)</code> = I–V–vi–IV.
        Any formula reads it as <code>h</code>: <code>h + pick(n, 0, 2, 4)</code> arpeggiates the current chord. On Note Out, <code>chord</code> = number of
        tones, <code>stack</code> = degrees between them (2 thirds, 3 fourths), <code>inversion</code> rotates the voicing, <code>strum</code> rolls it
        (negative = downward).
      </p>
      <div className="eyebrow">Randomizer</div>
      <p style={{ margin: 0 }}>
        <b>Mutate</b> (R, or ⇧R for the whole track) rewrites parameters and formulas, renders ~40 candidates and keeps the one that scores best on
        melodic contour, chord-tone fit, rhythmic density and distance from the original. The Safe ↔ Wild dial trades consonance for novelty. Lock a node
        (hover its header) to protect it.
      </p>
      <div className="eyebrow">Building & experimenting</div>
      <p style={{ margin: 0 }}>
        <b>Explode</b> (✂ on a Formula) splits its outermost operation into a node — conditions become If / else, comparisons and logic become
        Compare, and any other function gets its arguments as separate formulas. Repeat to go deeper. Select nodes and <b>Collapse</b> to merge them back
        into one formula. <b>Save as block</b> keeps selected nodes for any channel; blocks live in Add node. <b>🎧</b> listens to one node alone (Esc stops).
        <b> Sliders</b> are named constants for every formula: Alt+S on a number in a formula makes one. <b>Sections</b> plays A, B, C… in turn.
      </p>
      <div className="eyebrow">Pattern notation</div>
      <p style={{ margin: 0 }}>
        <code>X</code> accent · <code>x</code> hit · <code>o</code> ghost · <code>1–9</code> velocity · <code>.</code> rest · <code>|</code> and spaces are
        ignored. Binary works in formulas too: <code>bits(0b1000100010001000, n)</code>.
      </p>
      <div className="eyebrow">Variables</div>
      <dl>
        <dt><code>n</code></dt><dd>step index 0, 1, 2…</dd>
        <dt><code>x</code></dt><dd>progress through pattern 0 → 1</dd>
        <dt><code>t</code></dt><dd>time in beats</dd>
        <dt><code>k</code></dt><dd>loop count — evolve over time</dd>
        <dt><code>steps</code></dt><dd>pattern length</dd>
        <dt><code>h</code></dt><dd>current chord of the song’s Harmony, as a scale degree</dd>
        <dt><code>bar</code></dt><dd>bar number since the song began</dd>
        <dt><code>L</code></dt><dd>degrees per octave (7, or 5 for pentatonic)</dd>
        <dt><code>beat</code></dt><dd>beats since the song began</dd>
        <dt><code>a b c</code></dt><dd>Formula node inputs</dd>
        {Object.keys(CONSTANTS).map((c) => (
          <Fragment key={c}><dt><code>{c}</code></dt><dd>{CONSTANTS[c].toFixed(4)}</dd></Fragment>
        ))}
      </dl>
      <div className="eyebrow">Operators</div>
      <p style={{ margin: 0 }}>
        <code>+ − * / % ^</code> · <code>&lt; &gt; == != &amp;&amp; ||</code> · <code>cond ? a : b</code> · implicit <code>2pi</code>
      </p>
      <div className="eyebrow">Functions</div>
      <dl>
        {Object.entries(FUNCTIONS).map(([k, f]) => (
          <Fragment key={k}><dt><code>{k}</code></dt><dd>{f.doc}</dd></Fragment>
        ))}
      </dl>
    </div>
  );
}

export function Inspector() {
  const track = useSelectedTrack();
  const [tab, setTab] = useState<Tab>('channel');
  return (
    <aside className="panel">
      <div style={{ marginBottom: 18 }}>
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'channel', label: 'Channel' },
            { value: 'sound', label: 'Sound' },
            { value: 'notes', label: 'Notes' },
            { value: 'guide', label: 'Guide' },
          ]}
        />
      </div>
      {tab === 'guide' ? <GuideTab /> : !track ? <p className="empty">No channel selected.</p> : tab === 'channel' ? <ChannelTab /> : tab === 'sound' ? <SoundTab /> : <NotesTab />}
    </aside>
  );
}
