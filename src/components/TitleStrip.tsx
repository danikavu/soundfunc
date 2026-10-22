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

/** The instrument's nameplate: its name, and the time. */
export function TitleStrip() {
  return (
    <div className="title-strip">
      <div className="title-plate title-main">
        <b>SoundFunc</b>
      </div>
      <div className="title-plate">
        <Clock />
      </div>
    </div>
  );
}
