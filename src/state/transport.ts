import { engine } from '../engine/audio';
import { useStore } from './store';

export async function togglePlay() {
  const { playing, setPlaying } = useStore.getState();
  if (playing) {
    engine.stop();
    setPlaying(false);
  } else {
    await engine.play();
    setPlaying(true);
  }
}
