/**
 * The editor inside the Max for Live device ([jweb]). Max gives the page `window.max`; when
 * it is there this page makes no sound (Live plays the device's MIDI), follows Live's
 * playhead, and swaps the project with the device through a Max dict.
 */
import { engine } from './engine/audio';
import { normalizeProject, type Project } from './engine/project';
import { cleanProject, readFunctionFile, useLibrary } from './state/library';
import { toast } from './components/TopBar';
import { useStore } from './state/store';

interface MaxApi {
  outlet: (...args: unknown[]) => void;
  bindInlet: (name: string, fn: (...args: unknown[]) => void) => void;
  getDict: (name: string, cb: (dict: Record<string, unknown>) => void) => void;
  setDict: (name: string, dict: Record<string, unknown>) => void;
}

const max = (window as unknown as { max?: MaxApi }).max;
/** true inside the Max for Live device */
export const inDevice = !!max;

export function connectDevice() {
  if (!max) return;
  engine.external = true;
  document.documentElement.dataset.device = 'm4l';
  let dict = '';
  /** a project arriving from the device isn't sent straight back */
  let arriving = false;

  max.bindInlet('sf_load', (name) => {
    dict = String(name);
    max.getDict(dict, (d) => {
      const json = d?.json;
      if (typeof json !== 'string') return;
      try {
        arriving = true;
        useStore.getState().loadProject(normalizeProject(JSON.parse(json) as Project), useStore.getState().currentProjectId);
      } finally {
        arriving = false;
      }
    });
  });
  max.bindInlet('sf_pos', (beat) => engine.setExternalPosition(Number(beat)));
  // a file the device imported (its Import… button): functions go to My functions, math to Paste function
  max.bindInlet('sf_import', (name) => {
    max.getDict(String(name), (d) => {
      const kind = d?.import_kind, text = d?.import_text;
      if (typeof text !== 'string') return;
      if (kind === 'functions') {
        try {
          const n = useLibrary.getState().importFunctions(readFunctionFile(text));
          toast(n ? `Imported ${n} function${n > 1 ? 's' : ''} into My functions` : 'No functions in that file');
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Could not read that file');
        }
      } else if (kind === 'math') useStore.getState().openImport(text);
    });
  });

  // every edit goes to the device — after a short pause, so dragging a slider doesn't flood it
  let timer = 0;
  useStore.subscribe((s, prev) => {
    if (s.project === prev.project || arriving || !dict) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      max.setDict(dict, { json: JSON.stringify(cleanProject(useStore.getState().project)) });
      max.outlet('changed');
    }, 200);
  });
  max.outlet('ready');
}
