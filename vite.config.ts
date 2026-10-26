import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The editor inside the Max for Live device loads as a file:// page in [jweb], and Chromium
 * won't load JavaScript modules from file:// — so for the device the app is one classic
 * script (no modules, no code-split chunks), loaded with `defer`.
 */
const forDevice = process.env.SOUNDFUNC_TARGET === 'm4l';

const classicScript: Plugin = {
  name: 'soundfunc-classic-script',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(/<script type="module" crossorigin/g, '<script defer').replace(/ crossorigin/g, '');
  },
};

export default defineConfig({
  plugins: [react(), ...(forDevice ? [classicScript] : [])],
  build: forDevice
    ? {
        modulePreload: false,
        rolldownOptions: { output: { format: 'iife', codeSplitting: false } },
      }
    : {},
});
