import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './retro.css';
import { App } from './App';
import { connectDevice } from './device';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// inside the Max for Live device: no sound here, Live's playhead, the project shared with the device
connectDevice();
