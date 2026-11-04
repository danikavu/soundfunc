import { create } from 'zustand';
import { engine } from '../engine/audio';
import { barsOf, clock, jamMidi, jamWav, type Jam } from '../engine/jam';
import { download, fileSafe } from '../components/ui';
import { toast } from '../components/TopBar';
import { useStore } from './store';

/**
 * The jam recorder: one button records everything that plays — every channel, through every
 * mutation and tweak — from a bar line to a bar line, then hands you the take as audio and MIDI.
 */
interface JamState {
  status: 'off' | 'armed' | 'on' | 'ending';
  /** the last finished take, until the next one replaces it */
  jam: Jam | null;
  /** when it was recorded, for its file names */
  at: Date | null;
  /** the take's export card is showing */
  panel: boolean;
  setPanel: (on: boolean) => void;
  discard: () => void;
}

export const useJam = create<JamState>()((set) => ({
  status: 'off',
  jam: null,
  at: null,
  panel: false,
  setPanel: (panel) => set({ panel }),
  discard: () => set({ jam: null, at: null, panel: false }),
}));

engine.onTake = (e) => {
  switch (e.kind) {
    case 'armed':
      useJam.setState({ status: 'armed' });
      break;
    case 'recording':
      useJam.setState({ status: 'on' });
      break;
    case 'ending':
      useJam.setState({ status: 'ending' });
      break;
    case 'discarded':
      useJam.setState({ status: 'off' });
      break;
    case 'done': {
      const { jam } = e;
      if (!jam.parts.length && !jam.audio?.frames) {
        useJam.setState({ status: 'off' });
        toast('Nothing played during that take');
        break;
      }
      useJam.setState({ status: 'off', jam, at: new Date(), panel: true });
      toast(`Jam recorded — ${clock(jam.seconds)}, ${barsOf(jam)}. Export it from the card`);
    }
  }
};

/** the record button: start (playing from the top if stopped), or end the take on the next bar */
export async function toggleRecord() {
  const { status } = useJam.getState();
  const { playing, setPlaying } = useStore.getState();
  if (status === 'off') {
    if (!playing) {
      await engine.play(true);
      setPlaying(true);
    } else await engine.record();
  } else if (status === 'armed' || status === 'on') engine.stopRecording();
}

export type JamFile = 'wav' | 'midi' | 'automation';

export const JAM_FILES: { kind: JamFile; label: string; hint: string }[] = [
  { kind: 'wav', label: 'Audio', hint: 'WAV of the mix, 16-bit stereo' },
  { kind: 'midi', label: 'MIDI', hint: 'every channel’s notes and the tempo changes — glides become stepped notes' },
  { kind: 'automation', label: 'MIDI + automation', hint: 'notes plus glides and bends as pitch bend, volume as expression' },
];

const stamp = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;

/** download the last take as one kind of file */
export function exportJam(kind: JamFile) {
  const { jam, at } = useJam.getState();
  if (!jam) return;
  const base = `${fileSafe(jam.name)}-jam-${stamp(at ?? new Date())}`;
  if (kind === 'wav') {
    if (!jam.audio) return toast('This take has no audio — your browser could not record it');
    download(`${base}.wav`, jamWav(jam.audio) as BlobPart, 'audio/wav');
  } else download(`${base}${kind === 'automation' ? '-automation' : ''}.mid`, jamMidi(jam, kind === 'midi' ? 'notes' : 'standard') as BlobPart, 'audio/midi');
}

/** every file of the take, one after another (browsers may ask once to allow several downloads) */
export function exportJamAll() {
  JAM_FILES.forEach((f, i) => setTimeout(() => exportJam(f.kind), i * 250));
}
