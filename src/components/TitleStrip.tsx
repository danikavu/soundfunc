import { useEffect, useState } from 'react';
import { FileMenu, ImportMenu } from './TopBar';
import { Icon } from './ui';
import { useStore } from '../state/store';

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

/** Video mode: record the visuals, the functions and the sound, for socials */
function VideoKey() {
  const setShowVideo = useStore((s) => s.setShowVideo);
  return (
    <button className="btn" onClick={() => setShowVideo(true)} title="Video — record the visuals, the functions and the sound as a clip for socials">
      <Icon name="film" size={14} /> Video
    </button>
  );
}

/** The instrument's nameplate: its name, the time, and on the right Video and the ways in and out — Import and Export. */
export function TitleStrip() {
  return (
    <div className="title-strip">
      <div className="title-plate title-main">
        <b>SoundFunc</b>
      </div>
      <div className="title-plate">
        <Clock />
      </div>
      <div className="title-files">
        <VideoKey />
        <ImportMenu />
        <FileMenu />
      </div>
    </div>
  );
}
