import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { engine } from './engine/audio';
import { useStore } from './state/store';
import { togglePlay } from './state/transport';
import { toggleRecord } from './state/jam';
import { withAudition } from './state/audition';
import { TopBar } from './components/TopBar';
import { TitleStrip } from './components/TitleStrip';
import { Sidebar } from './components/Sidebar';
import { Visualizer } from './components/Visualizer';
import { NodeEditor, copySelected, pasteInto, runMutate, toggleLockSelected } from './components/NodeEditor';
import { Inspector } from './components/Inspector';
import { FunctionSheet } from './components/FunctionSheet';
import { ImportSheet } from './components/ImportSheet';
import { VideoStudio } from './components/VideoStudio';
import { MidiDropOverlay, MidiImportSheet, isMidiFile, openMidiFile, useMidiImport } from './components/MidiImportSheet';
import { saveGarden } from './components/GardenMenu';
import { paintOverlays } from './components/overlays';

// a tick box or a slider isn't typing: Space still plays
const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['TEXTAREA', 'SELECT'].includes(t.tagName) || (t instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'button'].includes(t.type)));

// development only: lets in-browser checks listen to the very engine that is playing
if (import.meta.env.DEV) (window as unknown as { __engine: typeof engine }).__engine = engine;

export function App() {
  const theme = useStore((s) => s.theme);
  const project = useStore((s) => s.project);
  const audition = useStore((s) => s.audition);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    void paintOverlays(theme);
  }, [theme]);

  // the engine always plays the latest project — edits are heard live
  useEffect(() => {
    engine.setProject(withAudition(project, audition));
  }, [project, audition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘S saves even while typing in a field
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveGarden(e.shiftKey);
        return;
      }
      if (e.key === 'Escape' && useStore.getState().audition) {
        useStore.getState().setAudition(null);
        return;
      }
      if (isTyping(e.target)) return;
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        useStore.getState().setShowFunction(!useStore.getState().showFunction);
      } else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (toggleLockSelected()) e.preventDefault();
      } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        runMutate(e.shiftKey ? 'garden' : 'track');
      } else if (e.key.toLowerCase() === 'j' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        void toggleRecord();
      } else if (e.code === 'Space') {
        e.preventDefault();
        void togglePlay();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'c') {
        if (copySelected()) e.preventDefault();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'v') {
        if (pasteInto()) e.preventDefault();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // a MIDI file dropped anywhere on the window becomes channels of functions
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      useMidiImport.setState({ dragging: true });
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) useMidiImport.setState({ dragging: false });
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      useMidiImport.setState({ dragging: false });
      const f = [...(e.dataTransfer?.files ?? [])].find(isMidiFile);
      if (f) void openMidiFile(f);
      else if (e.dataTransfer?.files.length) void import('./components/TopBar').then((m) => m.toast('Drop a MIDI file (.mid) to turn it into functions'));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <div className="app">
      <TitleStrip />
      <TopBar />
      <div className="main">
        <Sidebar />
        <div className="center">
          <Visualizer />
          <ReactFlowProvider>
            <NodeEditor />
          </ReactFlowProvider>
        </div>
        <Inspector />
      </div>
      <FunctionSheet />
      <ImportSheet />
      <VideoStudio />
      <MidiImportSheet />
      <MidiDropOverlay />
    </div>
  );
}
