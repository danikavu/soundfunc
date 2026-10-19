import { Fragment, useState } from 'react';
import { engine } from '../engine/audio';
import { CONSTANTS, FUNCTIONS } from '../engine/expr';
import { PITCH_MODES, midiToName, type PitchMode } from '../engine/music';
import { TRACK_COLORS } from '../engine/presets';
import { DRUMS, WAVEFORMS, isDrum, keyLabel, voiceLabel, type PlayMode, type Waveform } from '../engine/project';
import { useLibrary, voiceOf, wearsVoice } from '../state/library';
import { toast } from './TopBar';
import { TIMBRE_PRESETS, timbreSamples } from '../engine/timbre';
import { useSelectedTrack, useStore } from '../state/store';
import { Icon, Seg, Slider, TextField, getRender } from './ui';
import { FormulaEditor } from './FormulaEditor';
import { Dropdown } from './Dropdown';
import { stepLabel } from '../engine/steps';

type Tab = 'sound' | 'notes' | 'guide';


function TimbreEditor() {
  const track = useSelectedTrack()!;
  const { updateTrack, checkpoint } = useStore();
  const samples = timbreSamples(track.timbre, 128);
  const d = samples ? Array.from(samples, (v, i) => `${i ? 'L' : 'M'}${((i / 127) * 200).toFixed(1)},${(22 - v * 18).toFixed(1)}`).join('') : '';
  return (
    <div style={{ marginTop: 12 }}>
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
        {d && <path d={d} fill="none" stroke={track.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="seg" style={{ marginTop: 6 }}>
        {TIMBRE_PRESETS.map((t) => (
          <button key={t.label} className={t.formula === track.timbre ? 'on' : ''} onClick={() => updateTrack(track.id, { timbre: t.formula })}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  sine: 'pure tone, no overtones',
  triangle: 'soft, flute-like',
  square: 'hollow, woody, 8-bit',
  sawtooth: 'bright and buzzy',
  bell: 'FM metal, long ring',
  pluck: 'koto — sharp attack, filter falls',
  pad: 'three detuned saws, slow swell',
  flute: 'shakuhachi — breath and vibrato',
  reese: 'detuned saws beating, with a sub',
  custom: 'your own f(p) — one cycle of the wave',
  kick: 'sine sweep and click',
  snare: 'tone and filtered noise',
  hat: 'six metallic squares, short',
  openhat: 'metallic, long',
  clap: 'three quick noise bursts',
  rim: 'short click',
  tom: 'tuned sine sweep',
  crash: 'long metallic wash',
};
const GLYPH_FORMULA: Partial<Record<Waveform, string>> = { sine: 'sin(tau*p)', triangle: 'tri(p)', square: 'sqr(p)', sawtooth: 'saw(p)' };

/** One dropdown for the sound: melodic voices, drums, and voices you saved. */
function VoicePicker() {
  const track = useSelectedTrack()!;
  const updateTrack = useStore((s) => s.updateTrack);
  const { voices, deleteVoice } = useLibrary();
  const up = (patch: Parameters<typeof updateTrack>[1]) => updateTrack(track.id, patch);
  const glyph = (w: Waveform, timbre?: string) =>
    w === 'custom' && timbre ? <WaveGlyph formula={timbre} color="currentColor" /> : GLYPH_FORMULA[w] ? <WaveGlyph formula={GLYPH_FORMULA[w]!} color="currentColor" /> : <span className={`voice-dot ${isDrum(w) ? 'drum' : ''}`} />;
  const mine = voices.find((v) => wearsVoice(track, v));
  return (
    <Dropdown
      label="Voice"
      value={
        <>
          <span className="dropdown-glyph">{glyph(track.waveform, track.timbre)}</span>
          <b>{mine ? mine.name : voiceLabel(track.waveform)}</b>
          <small>{mine ? `my voice · ${voiceLabel(track.waveform)}` : VOICE_HINTS[track.waveform]}</small>
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
            onSelect: () => up({ waveform: v.waveform, timbre: v.timbre, attack: v.attack, release: v.release }),
            onDelete: () => confirm(`Delete the voice “${v.name}”? Tracks using it keep their sound.`) && deleteVoice(v.id),
          })),
        },
        {
          title: 'Melodic',
          items: (Object.keys(WAVEFORMS) as Waveform[]).map((w) => ({
            key: w,
            label: WAVEFORMS[w as keyof typeof WAVEFORMS],
            hint: VOICE_HINTS[w],
            glyph: glyph(w, w === 'custom' ? track.timbre : undefined),
            selected: !mine && track.waveform === w,
            onSelect: () => up({ waveform: w }),
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
            onSelect: () => up({ waveform: w }),
          })),
        },
      ]}
    />
  );
}

/** Keep the current sound as a named voice. */
function SaveVoice() {
  const track = useSelectedTrack()!;
  const { voices, saveVoice } = useLibrary();
  const [naming, setNaming] = useState<string | null>(null);
  const suggest = () => {
    const preset = TIMBRE_PRESETS.find((p) => p.formula === track.timbre);
    const base = track.waveform === 'custom' ? (preset?.label ?? 'My wave') : voiceLabel(track.waveform);
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
    toast(`${replacing ? 'Updated' : 'Saved'} voice “${name}” — it is in the Voice menu, in every garden`);
  };
  if (naming === null)
    return (
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small ghost" onClick={() => setNaming(suggest())} title="Keep this sound — waveform, custom f(p), attack, release">
          <Icon name="bookmark" size={11} /> Save voice
        </button>
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

function SoundTab() {
  const track = useSelectedTrack()!;
  const { project, updateTrack, setSong, duplicateTrack, removeTrack, checkpoint } = useStore();
  const up = (patch: Parameters<typeof updateTrack>[1]) => updateTrack(track.id, patch);
  const render = getRender(track, project.song);
  const drum = isDrum(track.waveform);
  const glide = track.playMode === 'glide' && !drum;

  return (
    <>
      <TextField className="track-title" value={track.name} onFocus={checkpoint} onValue={(name) => updateTrack(track.id, { name }, false)} />
      <div className="row" style={{ gap: 6, marginBottom: 4 }}>
        {TRACK_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => up({ color: c })}
            className="stone"
            style={{ background: c, border: 'none', cursor: 'pointer', width: 16, height: 13, outline: c === track.color ? '1.5px solid var(--ink)' : 'none', outlineOffset: 2 }}
            aria-label={`color ${c}`}
          />
        ))}
      </div>
      <div className="muted" style={{ fontSize: 11 }}>
        {glide ? 'continuous glide' : `${render.notes.length} ${drum ? 'hits' : 'notes'}`} · {keyLabel(project.song)}
      </div>

      <div className="eyebrow">Voice</div>
      <VoicePicker />
      {track.waveform === 'custom' && <TimbreEditor />}
      <SaveVoice />

      {!drum && (
        <>
          <div className="eyebrow">Play as</div>
          <Seg<PlayMode>
            value={track.playMode}
            onChange={(playMode) => up({ playMode })}
            options={[
              { value: 'notes', label: 'Notes' },
              { value: 'glide', label: 'Glide — follow the curve' },
            ]}
          />
          {glide && (
            <>
              <p className="muted" style={{ fontSize: 11, margin: '10px 0 4px' }}>
                One voice slides continuously along f(x). Velocity shapes its volume. Exports as MIDI pitch bend.
              </p>
              <div style={{ marginTop: 6 }}>
                <Seg<boolean>
                  value={track.quantize}
                  onChange={(quantize) => up({ quantize })}
                  options={[
                    { value: true, label: 'Snap to scale' },
                    { value: false, label: 'Free pitch' },
                  ]}
                />
              </div>
              <Slider label="Portamento" value={track.glide} min={0} max={0.5} format={(v) => `${Math.round(v * 1000)}ms`} onChange={(g) => up({ glide: g })} />
            </>
          )}
        </>
      )}

      <div className="eyebrow">Mix</div>
      <Slider label="Volume" value={track.volume} min={0} max={1} onChange={(volume) => up({ volume })} />
      <Slider label="Pan" value={track.pan} min={-1} max={1} format={(v) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} onChange={(pan) => up({ pan })} />
      <Slider label="Space" value={track.send} min={0} max={1} format={(v) => `${Math.round(v * 100)}%`} onChange={(send) => up({ send })} />
      {!drum && (
        <>
          <Slider label="Attack" value={track.attack} min={0.003} max={1.5} format={(v) => `${Math.round(v * 1000)}ms`} onChange={(attack) => up({ attack })} />
          <Slider label="Release" value={track.release} min={0.02} max={3} format={(v) => `${v.toFixed(2)}s`} onChange={(release) => up({ release })} />
        </>
      )}

      <div className="eyebrow">Pattern</div>
      <p className="muted" style={{ fontSize: 11, margin: '0 0 8px' }}>
        {track.steps} steps of {stepLabel(track.stepBeats)} ={' '}
        {track.lengthMode === 'fixed' ? `${track.lengthBeats} beats (fixed)` : `${Number((track.steps * track.stepBeats).toFixed(3))} beats (free)`}
        {drum ? '' : `, octave ${track.octave}`} — set in the top bar.
      </p>
      {!glide && <Slider label="Swing" value={track.swing} min={0} max={0.6} format={(v) => `${Math.round(v * 100)}%`} onChange={(swing) => up({ swing })} />}
      {drum ? (
        <p className="muted" style={{ fontSize: 11 }}>
          On drums, <b>pitch</b> tunes the hit in semitones. <b>ratchet</b> turns a step into a roll.
        </p>
      ) : (
        <label className="field" style={{ marginTop: 12 }}>
          <span>Pitch means</span>
          <select className="select" value={track.pitchMode} onChange={(e) => up({ pitchMode: e.target.value as PitchMode })}>
            {Object.entries(PITCH_MODES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="eyebrow">Export</div>
      <Slider label="Loops" value={project.song.exportLoops} min={1} max={32} step={1} format={(v) => `×${v}`} onChange={(exportLoops) => setSong({ exportLoops })} />

      <div className="row" style={{ marginTop: 22, flexWrap: 'wrap' }}>
        <button className="btn small" onClick={() => duplicateTrack(track.id)}>
          <Icon name="copy" size={12} /> Duplicate
        </button>
        <button className="btn small ghost" onClick={() => removeTrack(track.id)}>
          <Icon name="trash" size={12} /> Remove
        </button>
      </div>
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
      <p className="muted" style={{ marginTop: 0, fontSize: 11.5 }}>
        <b className="serif">{track.name}</b> glides instead of playing notes: {curve.midi.length} pitch samples per pass
        {lo <= hi && ` between ${midiToName(Math.round(lo))} and ${midiToName(Math.round(hi))}`}. The CSV export holds every sample, and MIDI export
        writes them as pitch bend (±24 semitones) with CC11 expression for volume.
      </p>
    );
  }
  return (
    <>
      <p className="muted" style={{ marginTop: 0, fontSize: 11.5 }}>
        One pass of <b className="serif">{track.name}</b> in {keyLabel(song)}. Click a row to hear it. Export the full data as CSV or MIDI from the top bar.
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
        <b>shift</b> delays a hit by part of a step (swing, flams). <b>ratchet</b> repeats it 2–8× inside the step (rolls). In <b>Glide</b> mode the track
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
        <b>Mutate</b> (R, or ⇧R for the whole garden) rewrites parameters and formulas, renders ~40 candidates and keeps the one that scores best on
        melodic contour, chord-tone fit, rhythmic density and distance from the original. The 調和 ↔ 実験 dial trades consonance for novelty. Lock a node
        (hover its header) to protect it.
      </p>
      <div className="eyebrow">Building & experimenting</div>
      <p style={{ margin: 0 }}>
        <b>Explode</b> (✂ on a Formula) splits its outermost operation into a node — conditions become If / else, comparisons and logic become
        Compare, and any other function gets its arguments as separate formulas. Repeat to go deeper. Select nodes and <b>Collapse</b> to merge them back
        into one formula. <b>Save as block</b> keeps selected nodes for any track; blocks live in Add node. <b>🎧</b> listens to one node alone (Esc stops).
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
  const [tab, setTab] = useState<Tab>('sound');
  return (
    <aside className="panel">
      <div style={{ marginBottom: 18 }}>
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sound', label: 'Track' },
            { value: 'notes', label: 'Notes' },
            { value: 'guide', label: 'Guide' },
          ]}
        />
      </div>
      {tab === 'guide' ? <GuideTab /> : !track ? <p className="empty">No track selected.</p> : tab === 'sound' ? <SoundTab /> : <NotesTab />}
    </aside>
  );
}
