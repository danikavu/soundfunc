import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { CATEGORY_LABELS, NODE_DEFS, type Category, type GEdge, type GNode } from '../engine/graph';
import { uid } from '../engine/presets';
import { useSelectedTrack, useStore } from '../state/store';
import { FuncNode, GraphContext, CATEGORY_COLORS } from './FuncNode';
import { Icon, Seg, getRender } from './ui';
import { toast } from './TopBar';

const nodeTypes = Object.fromEntries(Object.keys(NODE_DEFS).map((k) => [k, FuncNode]));

interface PaletteState {
  screen: { x: number; y: number };
  flow: { x: number; y: number };
  /** when opened by dropping a wire on empty canvas */
  from?: { node: string; handle: string | null; type: 'source' | 'target' };
}

function Palette({ state, hasOutput, onPick, onClose }: { state: PaletteState; hasOutput: boolean; onPick: (type: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return Object.values(NODE_DEFS).filter((d) => {
      if (d.type === 'output' && hasOutput) return false;
      // a wire dragged out of an output needs something with inputs, and vice versa
      if (state.from?.type === 'source' && d.inputs.length === 0) return false;
      if (state.from?.type === 'target' && d.outputs.length === 0) return false;
      return !needle || `${d.label} ${d.hint} ${d.type}`.toLowerCase().includes(needle);
    });
  }, [q, hasOutput, state.from]);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as globalThis.Node) && onClose();
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [onClose]);

  const cats = [...new Set(items.map((d) => d.category))] as Category[];
  let i = 0;
  return (
    <div className="palette" ref={ref} style={{ left: state.screen.x, top: state.screen.y }}>
      <input
        autoFocus
        placeholder="Find a node…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setHl(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowDown') setHl((h) => Math.min(items.length - 1, h + 1));
          if (e.key === 'ArrowUp') setHl((h) => Math.max(0, h - 1));
          if (e.key === 'Enter' && items[hl]) onPick(items[hl].type);
        }}
      />
      {cats.map((c) => (
        <div key={c}>
          <h4>{CATEGORY_LABELS[c]}</h4>
          {items
            .filter((d) => d.category === c)
            .map((d) => {
              const idx = i++;
              return (
                <button key={d.type} className={idx === hl ? 'hl' : ''} onMouseEnter={() => setHl(idx)} onClick={() => onPick(d.type)}>
                  <span style={{ color: CATEGORY_COLORS[c] }}>●</span> {d.label}
                  <small>{d.hint}</small>
                </button>
              );
            })}
        </div>
      ))}
      {items.length === 0 && <p className="muted" style={{ padding: 8 }}>Nothing matches.</p>}
    </div>
  );
}

/** The randomizer: one button, one dial from 調和 harmonious to 実験 experimental. */
export function runMutate(scope: 'track' | 'garden') {
  const { mutate, chaos } = useStore.getState();
  const r = mutate(scope);
  const mood = chaos < 0.35 ? 'harmonious' : chaos < 0.7 ? 'adventurous' : 'experimental';
  toast(
    r.tracks
      ? `${scope === 'garden' ? `Mutated ${r.tracks} tracks${useStore.getState().project.song.harmonyLocked ? '' : ' and the harmony'}` : 'Mutated'} · ${mood} · best of ${r.tried} candidates — ⌘Z to undo`
      : 'Nothing to mutate — every node is locked',
  );
}

function Mutator() {
  const chaos = useStore((s) => s.chaos);
  const setChaos = useStore((s) => s.setChaos);
  const [scope, setScope] = useState<'track' | 'garden'>('track');
  return (
    <div className="mutator">
      <button className="btn" onClick={() => runMutate(scope)} title="Mutate parameters & formulas, keep the most musical of many candidates (R)">
        <Icon name="dice" size={14} /> Mutate
      </button>
      <label className="chaos" title="How far the randomizer may wander">
        <span className="serif">調和</span>
        <input type="range" min={0} max={1} step={0.01} value={chaos} onChange={(e) => setChaos(Number(e.target.value))} aria-label="Harmonious to experimental" />
        <span className="serif">実験</span>
      </label>
      <Seg<'track' | 'garden'>
        value={scope}
        onChange={setScope}
        options={[
          { value: 'track', label: 'Track' },
          { value: 'garden', label: 'Garden' },
        ]}
      />
    </div>
  );
}

/** Lock the selected nodes (or unlock them if they are all locked already). */
export function toggleLockSelected(): boolean {
  const { project, selectedTrackId, setLocked } = useStore.getState();
  const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0];
  const sel = track?.graph.nodes.filter((n) => (n as { selected?: boolean }).selected && NODE_DEFS[n.type]?.params.length);
  if (!track || !sel?.length) return false;
  const lock = !sel.every((n) => n.data.locked);
  setLocked(track.id, sel.map((n) => n.id), lock);
  toast(`${lock ? 'Locked' : 'Unlocked'} ${sel.length} node${sel.length > 1 ? 's' : ''}`);
  return true;
}

function LockStatus() {
  const track = useSelectedTrack();
  const setLocked = useStore((s) => s.setLocked);
  if (!track) return null;
  const lockable = track.graph.nodes.filter((n) => NODE_DEFS[n.type]?.params.length);
  const locked = lockable.filter((n) => n.data.locked).length;
  const selected = lockable.filter((n) => (n as { selected?: boolean }).selected);
  return (
    <div className="lock-status">
      {selected.length > 0 && (
        <button className="btn small ghost" onClick={toggleLockSelected} title="Lock / unlock the selected nodes (L)">
          <Icon name={selected.every((n) => n.data.locked) ? 'unlock' : 'lock'} size={12} />
          {selected.every((n) => n.data.locked) ? 'Unlock' : 'Lock'} {selected.length} selected
        </button>
      )}
      {locked > 0 ? (
        <>
          <span>
            <b>{locked}</b> of {lockable.length} locked
          </span>
          <button className="btn small ghost" onClick={() => setLocked(track.id, 'all', false)}>
            Unlock all
          </button>
        </>
      ) : (
        selected.length === 0 && <span>click a node’s lock (or select + L) to protect it</span>
      )}
    </div>
  );
}

export function NodeEditor() {
  const track = useSelectedTrack();
  const song = useStore((s) => s.project.song);
  const setGraph = useStore((s) => s.setGraph);
  const checkpoint = useStore((s) => s.checkpoint);
  const theme = useStore((s) => s.theme);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<PaletteState | null>(null);

  const render = track ? getRender(track, song) : null;
  const nodes = (track?.graph.nodes ?? []) as Node[];
  const edges = (track?.graph.edges ?? []) as Edge[];

  // refit whenever we switch tracks
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400, maxZoom: 1 }), 30);
    return () => clearTimeout(t);
  }, [track?.id, fitView]);

  const save = useCallback(
    (n: Node[], e: Edge[], record = false) => track && setGraph(track.id, n as GNode[], e as GEdge[], record),
    [track, setGraph],
  );

  /**
   * Always start from the store's current graph: React Flow can fire a selection
   * change in the same click as an edit inside a node (e.g. the lock button), and
   * the props captured at render time would overwrite that edit.
   */
  const live = useCallback(() => {
    const t = useStore.getState().project.tracks.find((x) => x.id === track?.id);
    return { nodes: (t?.graph.nodes ?? []) as Node[], edges: (t?.graph.edges ?? []) as Edge[] };
  }, [track?.id]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const g = live();
      save(applyNodeChanges(changes, g.nodes), g.edges, changes.some((c) => c.type === 'remove'));
    },
    [live, save],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const g = live();
      save(g.nodes, applyEdgeChanges(changes, g.edges), changes.some((c) => c.type === 'remove'));
    },
    [live, save],
  );

  const connect = useCallback(
    (c: Connection, baseNodes = live().nodes, baseEdges = live().edges) => {
      // one wire per input: a new connection replaces the old one
      const kept = baseEdges.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle));
      const edge: Edge = { id: `${c.source}.${c.sourceHandle}-${c.target}.${c.targetHandle}`, ...c };
      save(baseNodes, [...kept, edge], true);
    },
    [live, save],
  );

  const openPalette = (clientX: number, clientY: number, from?: PaletteState['from']) => {
    const r = wrapRef.current!.getBoundingClientRect();
    setPalette({
      screen: { x: Math.min(clientX - r.left, r.width - 240), y: Math.min(clientY - r.top, r.height - 300) },
      flow: screenToFlowPosition({ x: clientX, y: clientY }),
      from,
    });
  };

  const onConnectEnd = (e: MouseEvent | TouchEvent, s: FinalConnectionState) => {
    if (s.isValid || !s.fromNode || !s.fromHandle) return;
    const p = 'changedTouches' in e ? e.changedTouches[0] : e;
    openPalette(p.clientX, p.clientY, { node: s.fromNode.id, handle: s.fromHandle.id ?? null, type: s.fromHandle.type });
  };

  const addNode = (type: string) => {
    if (!palette || !track) return;
    const def = NODE_DEFS[type];
    const from = palette.from;
    // when wiring backwards into an input, place the new node to the left of the drop point
    const position = from?.type === 'target' ? { x: palette.flow.x - 220, y: palette.flow.y } : palette.flow;
    const node: GNode = { id: uid(type), type, position, data: { ...def.defaults } };
    const nextNodes = [...(live().nodes as GNode[]).map((n) => ({ ...n, selected: false })), { ...node, selected: true }] as Node[];
    setPalette(null);
    if (from?.type === 'source' && def.inputs[0]) {
      connect({ source: from.node, sourceHandle: from.handle, target: node.id, targetHandle: def.inputs[0].id }, nextNodes);
    } else if (from?.type === 'target' && def.outputs[0]) {
      connect({ source: node.id, sourceHandle: def.outputs[0].id, target: from.node, targetHandle: from.handle }, nextNodes);
    } else {
      save(nextNodes, live().edges, true);
    }
  };

  if (!track || !render) {
    return <div className="nodes empty">Plant a function from the left to begin.</div>;
  }

  return (
    <div
      className="nodes"
      ref={wrapRef}
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('react-flow__pane')) openPalette(e.clientX, e.clientY);
      }}
    >
      <div className="toolbar">
        <button
          className="btn"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const w = wrapRef.current!.getBoundingClientRect();
            setPalette({
              screen: { x: r.left - w.left, y: r.bottom - w.top + 6 },
              flow: screenToFlowPosition({ x: w.left + w.width / 2 - 90, y: w.top + w.height / 2 - 60 }),
            });
          }}
        >
          <Icon name="plus" size={14} /> Add node
        </button>
        <button className="btn" onClick={() => useStore.getState().setShowFunction(true)} title="See the whole track as one function — math, SoundFunc, JavaScript, Python (F)">
          <span className="serif" style={{ fontSize: 14, lineHeight: 1 }}>∑</span> Function
        </button>
        <Mutator />
        <LockStatus />
      </div>
      <div className="nodes-canvas">
        <GraphContext.Provider value={{ trackId: track.id, traces: render.traces, errors: render.errors }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={(c) => connect(c)}
            onConnectEnd={onConnectEnd}
            onNodeDragStart={checkpoint}
            isValidConnection={(c) => c.source !== c.target}
            colorMode={theme}
            zoomOnDoubleClick={false}
            deleteKeyCode={['Backspace', 'Delete']}
            minZoom={0.25}
            maxZoom={2}
            defaultEdgeOptions={{ type: 'default' }}
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="var(--line)" />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </GraphContext.Provider>
        <span className="muted nodes-hint">double-click canvas · drag a wire into space · ⌫ deletes · R mutates · F shows the function</span>
      </div>
      {!render.hasOutput && (
        <div className="viz-tip" style={{ left: '50%', top: 70, transform: 'translateX(-50%)', color: 'var(--accent)' }}>
          Add a “Note Out” node — it decides what you hear.
        </div>
      )}
      {palette && <Palette state={palette} hasOutput={render.hasOutput} onPick={addNode} onClose={() => setPalette(null)} />}
    </div>
  );
}
