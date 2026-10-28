import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './retro.css';
import { App } from './App';
import { restorePresetFolder } from './state/presetFolder';

// the presets folder chosen last time, if the browser still lets the page in
void restorePresetFolder();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
