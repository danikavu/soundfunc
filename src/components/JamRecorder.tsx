import { useEffect, useRef, useState } from 'react';
import { engine } from '../engine/audio';
import { barsOf, clock } from '../engine/jam';
import { JAM_FILES, exportJam, exportJamAll, toggleRecord, useJam } from '../state/jam';
import { Icon } from './ui';

const TITLES = {
  off: 'Record a jam (J) — everything you play and mutate, every channel, from the next bar',
  armed: 'Starts on the next bar — click to cancel',
  on: 'Recording — click (or J) to end the take on the next bar',
  ending: 'Ending on the bar…',
};

/** the record button beside Play, with the take's clock, and the card to export a finished take */
export function JamRecorder() {
  const { status, jam, panel, setPanel, discard } = useJam();
  const [secs, setSecs] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // the clock ticks while a take runs
  useEffect(() => {
    if (status === 'off') return;
    const id = window.setInterval(() => setSecs(engine.takeSeconds()), 200);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (!panel) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setPanel(false);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [panel, setPanel]);

  const channels = jam?.parts.length ?? 0;
  const tempos = jam ? new Set(jam.tempos.map((t) => t.bpm)).size : 0;

  return (
    <div className="jam" ref={ref}>
      <button className={`rec ${status}`} onClick={() => void toggleRecord()} title={TITLES[status]} aria-label={TITLES[status]} aria-pressed={status !== 'off'}>
        <span className="rec-dot" />
      </button>
      {status !== 'off' ? (
        <span className={`rec-clock ${status}`} aria-live="polite">
          {status === 'armed' ? 'next bar' : clock(secs)}
        </span>
      ) : (
        jam && (
          <button className="rec-take" onClick={() => setPanel(!panel)} title="Your last take — export it">
            {clock(jam.seconds)}
          </button>
        )
      )}
      {panel && jam && (
        <div className="jam-card" role="dialog" aria-label="Jam take">
          <div className="jam-card-head">
            <b className="serif">Jam take</b>
            <button className="icon-btn" onClick={() => setPanel(false)} aria-label="Close">
              <Icon name="close" size={12} />
            </button>
          </div>
          <p className="muted">
            {clock(jam.seconds)} · {barsOf(jam)} · {channels} channel{channels === 1 ? '' : 's'}
            {tempos > 1 ? ` · ${tempos} tempos` : ` · ${jam.tempos[0]?.bpm ?? jam.song.bpm} bpm`}
          </p>
          <div className="jam-files">
            {JAM_FILES.map((f) => (
              <button key={f.kind} className="btn small" disabled={f.kind === 'wav' && !jam.audio} onClick={() => exportJam(f.kind)} title={f.hint}>
                <Icon name="download" size={12} /> {f.label}
              </button>
            ))}
          </div>
          <div className="row jam-card-foot">
            <button className="btn small primary" onClick={exportJamAll} title="Audio, MIDI and MIDI + automation — all start on bar 1, ready to drop into a DAW">
              <Icon name="download" size={12} /> Export all
            </button>
            <button
              className="btn small ghost"
              onClick={() => {
                discard();
              }}
            >
              <Icon name="close" size={12} /> Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
