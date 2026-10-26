import { engine } from '../engine/audio';
import { useStore } from './store';
import { toast } from '../components/TopBar';

export async function togglePlay() {
  // inside Live, Live's transport plays the device
  if (engine.external) return void toast('In Live: press play in Live — this device follows Live’s transport');
  const { playing, setPlaying } = useStore.getState();
  if (playing) {
    engine.stop();
    setPlaying(false);
  } else {
    await engine.play();
    setPlaying(true);
  }
}
