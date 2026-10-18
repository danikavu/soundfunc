import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { engine } from './engine/audio';
import { useStore } from './state/store';
import { togglePlay } from './state/transport';
import { withAudition } from './state/audition';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Visualizer } from './components/Visualizer';
import { NodeEditor, runMutate, toggleLockSelected } from './components/NodeEditor';
import { Inspector } from './components/Inspector';
import { FunctionSheet } from './components/FunctionSheet';
import { ImportSheet } from './components/ImportSheet';
import { saveGarden } from './components/GardenMenu';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function App() {
  const theme = useStore((s) => s.theme);
  const project = useStore((s) => s.project);
  const audition = useStore((s) => s.audition);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
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
      } else if (e.code === 'Space') {
        e.preventDefault();
        void togglePlay();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
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
    </div>
  );
}
