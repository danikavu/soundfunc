import { useEffect, useState } from 'react';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n: number) => String(n).padStart(2, '0');

/** the lab clock: 1988-11-23 WED 14:32:17 */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="title-clock" aria-label="Clock">
      {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())} <b>{DAYS[now.getDay()]}</b> {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  );
}

/** A little oscilloscope trace, drawn once. */
function Scope() {
  return (
    <svg className="title-scope" viewBox="0 0 64 18" aria-hidden>
      <path d="M0 9h10l2-5 2 10 2-12 2 14 2-9 2 4 2-2h8l2-3 2 6 2-4h22" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** The instrument's nameplate: who made it, what it is, the time — and the lab's red seal. */
export function TitleStrip() {
  return (
    <div className="title-strip">
      <div className="title-plate title-main">
        <svg className="title-mark" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3L3 20h18zM12 9l-4.5 8h9zM6 20v1.5M18 20v1.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <b>SoundFunc</b>
        <span className="title-dept">Laboratory of Mathematical Acoustics</span>
        <span className="title-sub">Formula Music Workstation</span>
        <span className="title-ver">Ver 1.10</span>
      </div>
      <div className="title-plate title-model">
        <Scope />
        <span>
          <b>MATHMUSIC-88</b>
          <small>Faculty of Engineering · Sound &amp; Number</small>
        </span>
      </div>
      <div className="title-plate">
        <Clock />
      </div>
      <div className="title-seal" aria-hidden title="音数楽学 — sound, number, music, study">
        <span>音</span>
        <span>数</span>
        <span>楽</span>
        <span>学</span>
      </div>
    </div>
  );
}
