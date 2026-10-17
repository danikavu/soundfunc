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
import { Icon, getRender } from './ui';

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

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => save(applyNodeChanges(changes, nodes), edges, changes.some((c) => c.type === 'remove')),
    [nodes, edges, save],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => save(nodes, applyEdgeChanges(changes, edges), changes.some((c) => c.type === 'remove')),
    [nodes, edges, save],
  );

  const connect = useCallback(
    (c: Connection, baseNodes = nodes, baseEdges = edges) => {
      // one wire per input: a new connection replaces the old one
      const kept = baseEdges.filter((e) => !(e.target === c.target && e.targetHandle === c.targetHandle));
      const edge: Edge = { id: `${c.source}.${c.sourceHandle}-${c.target}.${c.targetHandle}`, ...c };
      save(baseNodes, [...kept, edge], true);
    },
    [nodes, edges, save],
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
    const nextNodes = [...(nodes as GNode[]).map((n) => ({ ...n, selected: false })), { ...node, selected: true }] as Node[];
    setPalette(null);
    if (from?.type === 'source' && def.inputs[0]) {
      connect({ source: from.node, sourceHandle: from.handle, target: node.id, targetHandle: def.inputs[0].id }, nextNodes);
    } else if (from?.type === 'target' && def.outputs[0]) {
      connect({ source: node.id, sourceHandle: def.outputs[0].id, target: from.node, targetHandle: from.handle }, nextNodes);
    } else {
      save(nextNodes, edges, true);
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
        <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>
          double-click canvas · drag a wire into space · ⌫ deletes
        </span>
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
