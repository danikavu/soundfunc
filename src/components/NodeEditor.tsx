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
import { CATEGORY_LABELS, NODE_DEFS, type Category, type GEdge, type GNode, type Graph } from '../engine/graph';
import { blockFromSelection, collapseNodes, explodeFormula, freeSpot, insertBlock, type Block, type EditResult } from '../engine/graphEdit';
import { BLOCKS } from '../engine/blocks';
import { useLibrary } from '../state/library';
import { nodeHeight, uid } from '../engine/presets';
import { DEFAULT_CHAOS, useSelectedTrack, useStore } from '../state/store';
import { FuncNode, GraphContext, CATEGORY_COLORS } from './FuncNode';
import { Icon, Info, Seg, getRender } from './ui';
import { ScoreMath, useScoreMath } from './ScoreMath';
import { toast } from './TopBar';
import { SlidersBar } from './SlidersBar';
import { Dropdown } from './Dropdown';

const nodeTypes = Object.fromEntries(Object.keys(NODE_DEFS).map((k) => [k, FuncNode]));

interface PaletteState {
  screen: { x: number; y: number };
  flow: { x: number; y: number };
  /** when opened by dropping a wire on empty canvas */
  from?: { node: string; handle: string | null; type: 'source' | 'target' };
}

type PaletteItem = { kind: 'node'; type: string } | { kind: 'block'; block: Block; mine: boolean };

function Palette({ state, hasOutput, onPick, onClose }: { state: PaletteState; hasOutput: boolean; onPick: (item: PaletteItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const myBlocks = useLibrary((s) => s.blocks);
  const deleteBlock = useLibrary((s) => s.deleteBlock);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (text: string) => !needle || text.toLowerCase().includes(needle);
    // a wire dragged out of an output needs something with inputs, and vice versa
    const fitsWire = (b: Block) => (state.from?.type === 'source' ? !!b.inlet : state.from?.type === 'target' ? !!b.outlet : true);
    const nodes = Object.values(NODE_DEFS).filter((d) => {
      if (d.type === 'output' && hasOutput) return false;
      if (state.from?.type === 'source' && d.inputs.length === 0) return false;
      if (state.from?.type === 'target' && d.outputs.length === 0) return false;
      return match(`${d.label} ${d.hint} ${d.type}`);
    });
    const out: { title: string; color?: string; items: { item: PaletteItem; label: string; hint: string }[] }[] = [];
    const mine = myBlocks.filter((b) => fitsWire(b) && match(`${b.name} ${b.description}`));
    if (mine.length) out.push({ title: 'My blocks', items: mine.map((b) => ({ item: { kind: 'block', block: b, mine: true }, label: b.name, hint: b.description })) });
    const built = BLOCKS.filter((b) => fitsWire(b) && match(`${b.name} ${b.description}`));
    if (built.length) out.push({ title: 'Blocks', items: built.map((b) => ({ item: { kind: 'block', block: b, mine: false }, label: b.name, hint: b.description })) });
    for (const c of [...new Set(nodes.map((d) => d.category))] as Category[]) {
      out.push({
        title: CATEGORY_LABELS[c],
        color: CATEGORY_COLORS[c],
        items: nodes.filter((d) => d.category === c).map((d) => ({ item: { kind: 'node', type: d.type }, label: d.label, hint: d.hint })),
      });
    }
    return out;
  }, [q, hasOutput, state.from, myBlocks]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as globalThis.Node) && onClose();
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [onClose]);

  let i = 0;
  return (
    <div className="palette" ref={ref} style={{ left: state.screen.x, top: state.screen.y }}>
      <input
        autoFocus
        placeholder="Find a node or block…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setHl(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'ArrowDown') setHl((h) => Math.min(flat.length - 1, h + 1));
          if (e.key === 'ArrowUp') setHl((h) => Math.max(0, h - 1));
          if (e.key === 'Enter' && flat[hl]) onPick(flat[hl].item);
        }}
      />
      {groups.map((g) => (
        <div key={g.title}>
          <h4>{g.title}</h4>
          {g.items.map(({ item, label, hint }) => {
            const idx = i++;
            return (
              <div key={item.kind === 'node' ? item.type : item.block.id} className="palette-row">
                <button className={idx === hl ? 'hl' : ''} onMouseEnter={() => setHl(idx)} onClick={() => onPick(item)}>
                  <span style={{ color: g.color ?? 'var(--accent)' }}>{item.kind === 'block' ? '◆' : '●'}</span> {label}
                  <small>{hint}</small>
                </button>
                {item.kind === 'block' && item.mine && (
                  <button
                    className="icon-btn palette-del"
                    title={`Delete block “${item.block.name}”`}
                    onClick={() => (deleteBlock(item.block.id), toast(`Deleted the block “${item.block.name}”`))}
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {flat.length === 0 && <p className="muted" style={{ padding: 8 }}>Nothing matches.</p>}
    </div>
  );
}

/** The randomizer: one button, one dial from safe (harmonious) to wild (experimental). */
export function runMutate(scope: 'track' | 'garden') {
  const { mutate, chaos } = useStore.getState();
  const r = mutate(scope);
  const mood = chaos < 0.35 ? 'harmonious' : chaos < 0.7 ? 'adventurous' : 'experimental';
  const skipped = scope === 'garden' && r.locked ? ` (${r.locked} locked left alone)` : '';
  toast(
    r.tracks
      ? `${scope === 'garden' ? `Mutated ${r.tracks} channels${skipped}${useStore.getState().project.song.harmonyLocked ? '' : ' and the harmony'}` : r.tracks > 1 ? `Mutated ${r.tracks} channels` : 'Mutated'} · ${mood} · best of ${r.tried} candidates — ⌘Z to undo`
      : r.locked && scope === 'track'
        ? 'This channel is locked — unlock it (the padlock beside M / S) to mutate it'
        : r.locked
          ? 'Nothing to mutate — every channel is locked'
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
        <span>Safe</span>
        <input type="range" min={0} max={1} step={0.01} value={chaos} onChange={(e) => setChaos(Number(e.target.value))} onDoubleClick={() => setChaos(DEFAULT_CHAOS)} aria-label="Harmonious to experimental" />
        <span>Wild</span>
      </label>
      <Seg<'track' | 'garden'>
        value={scope}
        onChange={setScope}
        options={[
          { value: 'track', label: 'Channel' },
          { value: 'garden', label: 'Track' },
        ]}
      />
    </div>
  );
}

/** Lock the selected nodes (or unlock them if they are all locked already). */
/** ⌘C: copy the selected nodes of the open track */
export function copySelected(): boolean {
  const { project, selectedTrackId, copyNodes } = useStore.getState();
  const track = project.tracks.find((t) => t.id === selectedTrackId) ?? project.tracks[0];
  const ids = track?.graph.nodes.filter((n) => (n as { selected?: boolean }).selected && n.type !== 'output').map((n) => n.id) ?? [];
  if (!track || !ids.length) return false;
  const n = copyNodes(track.id, ids);
  if (n) toast(`Copied ${n} node${n > 1 ? 's' : ''} — select any channel and press ⌘V`);
  return n > 0;
}

/** ⌘V: paste copied nodes into a track (the open one by default) */
export function pasteInto(trackId?: string): boolean {
  const { project, selectedTrackId, pasteNodes, clipboard } = useStore.getState();
  const id = trackId ?? selectedTrackId ?? project.tracks[0]?.id;
  if (!id || !clipboard) return false;
  const r = pasteNodes(id);
  const name = project.tracks.find((t) => t.id === id)?.name;
  toast(typeof r === 'string' ? r : `Pasted ${r} node${r === 1 ? '' : 's'} into ${name}${clipboard.sliders.length ? ' · with their sliders' : ''}`);
  return typeof r !== 'string';
}

/** how to work the node board — behind one ⓘ instead of a line of text */
function NodeTips() {
  return (
    <Info label="Node board tips">
      Select nodes to explode, collapse, copy, save as a block or lock them (shift-click or drag to select several). Double-click the board to add a
      node · drag a wire into empty space to add one there · ⌫ deletes · ⌘C / ⌘V copy and paste · R mutates the channel, ⇧R the track · F shows the
      function.
    </Info>
  );
}

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

const isSelected = (n: GNode) => !!(n as { selected?: boolean }).selected;

/** What you can do with the selected nodes: explode, collapse, save as block, lock, listen. */
function SelectionTools() {
  const track = useSelectedTrack();
  const setLocked = useStore((s) => s.setLocked);
  const applyGraphEdit = useStore((s) => s.applyGraphEdit);
  const setAudition = useStore((s) => s.setAudition);
  const audition = useStore((s) => s.audition);
  const saveBlock = useLibrary((s) => s.saveBlock);
  const clipboard = useStore((s) => s.clipboard);
  useStore((s) => s.project.tracks.length); // keep "Copy to…" in step with the tracks
  const [naming, setNaming] = useState<string | null>(null);
  if (!track) return null;
  const selected = track.graph.nodes.filter((n) => isSelected(n) && n.type !== 'output');
  const lockable = track.graph.nodes.filter((n) => NODE_DEFS[n.type]?.params.length);
  const locked = lockable.filter((n) => n.data.locked).length;
  const run = (fn: (g: Graph) => EditResult, done: string) => {
    const err = applyGraphEdit(track.id, fn);
    toast(err ?? done);
  };
  const ids = selected.map((n) => n.id);
  const others = useStore.getState().project.tracks.filter((t) => t.id !== track.id);

  if (naming !== null) {
    const commitName = () => {
      const name = naming.trim();
      setNaming(null);
      if (!name) return;
      const b = blockFromSelection(track.graph, ids, name);
      if ('error' in b) return toast(b.error);
      saveBlock(b);
      toast(`Saved block “${name}” — find it under My blocks in Add node`);
    };
    return (
      <div className="lock-status">
        <input
          className="input"
          autoFocus
          value={naming}
          onChange={(e) => setNaming(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commitName();
            if (e.key === 'Escape') setNaming(null);
          }}
          style={{ width: 150, fontSize: 'var(--fs-md)' }}
          aria-label="Block name"
        />
        <button className="btn small primary" onClick={commitName}>
          Save block
        </button>
        <button className="btn small ghost tool" onClick={() => setNaming(null)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="lock-status">
      {selected.length === 1 && selected[0].type === 'expr' && (
        <button className="btn small ghost tool" aria-label="Explode" onClick={() => run((g) => explodeFormula(g, ids[0]), 'Exploded — repeat on the new formulas to go deeper')} title="Explode — split the formula’s outermost operation into a node">
          <Icon name="split" size={14} />
        </button>
      )}
      {selected.length >= 2 && (
        <button className="btn small ghost tool" onClick={() => run((g) => collapseNodes(g, ids), `Collapsed ${ids.length} nodes into one formula`)} title="Collapse — merge the selected nodes into one Formula node" aria-label="Collapse">
          <Icon name="merge" size={14} />
        </button>
      )}
      {selected.length >= 1 && (
        <>
          <button className="btn small ghost tool" onClick={() => setNaming(selected.length === 1 ? NODE_DEFS[selected[0].type].label : `${track.name} block`)} title="Save as block — keep these nodes and their wires to reuse in any channel" aria-label="Save as block">
            <Icon name="bookmark" size={14} />
          </button>
          {selected.length === 1 && (
            <button
              className={`btn small ghost tool ${audition?.nodeId === ids[0] ? 'on' : ''}`}
              title="Listen — hear this node alone"
              aria-label="Listen"
              onClick={() => setAudition(audition?.nodeId === ids[0] ? null : { trackId: track.id, nodeId: ids[0] })}
            >
              <Icon name="headphones" size={14} />
            </button>
          )}
          <button className="btn small ghost tool" onClick={copySelected} title="Copy — the selected nodes and their wires (⌘C); paste into any channel with ⌘V" aria-label="Copy">
            <Icon name="copy" size={14} />
          </button>
          {others.length > 0 && (
            <Dropdown
              compact
              label="Copy to channel"
              value={
                <span className="copy-to" title="Copy to another channel">
                  <Icon name="send" size={14} />
                </span>
              }
              groups={[
                {
                  title: 'Copy the selection into',
                  items: others.map((o) => ({
                    key: o.id,
                    label: o.name,
                    glyph: <span className="stone" style={{ background: o.color }} />,
                    onSelect: () => {
                      if (useStore.getState().copyNodes(track.id, ids)) pasteInto(o.id);
                    },
                  })),
                },
              ]}
            />
          )}
          <button
            className="btn small ghost tool"
            onClick={toggleLockSelected}
            title={selected.every((n) => n.data.locked) ? 'Unlock the selected nodes (L)' : 'Lock the selected nodes against Mutate (L)'}
            aria-label={selected.every((n) => n.data.locked) ? 'Unlock' : 'Lock'}
          >
            <Icon name={selected.every((n) => n.data.locked) ? 'unlock' : 'lock'} size={14} />
          </button>
        </>
      )}
      {selected.length === 0 &&
        (audition ? (
          <span>
            <b>Listening</b> to one node — Esc to stop
          </span>
        ) : locked > 0 ? (
          <>
            <span>
              <b>{locked}</b> of {lockable.length} locked
            </span>
            <button className="btn small ghost" onClick={() => setLocked(track.id, 'all', false)}>
              Unlock all
            </button>
          </>
        ) : clipboard ? (
          <>
            <NodeTips />
            <button className="btn small ghost" onClick={() => pasteInto(track.id)} title="Paste the copied nodes here (⌘V)">
              <Icon name="copy" size={12} /> Paste {clipboard.block.nodes.length} node{clipboard.block.nodes.length > 1 ? 's' : ''}
            </button>
          </>
        ) : (
          <NodeTips />
        ))}
    </div>
  );
}

export function NodeEditor() {
  const track = useSelectedTrack();
  // the area shows the node board, or every channel you can hear written as math (remembered)
  const [math, setMath] = useScoreMath();
  const onMathZoom = useCallback((zoom: number) => setMath({ zoom }), [setMath]);
  const showMath = math.open;
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

  // refit whenever we switch tracks, and after structural edits (explode, collapse, blocks)
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400, maxZoom: 1 }), 30);
    return () => clearTimeout(t);
  }, [track?.id, fitView]);
  useEffect(() => {
    const refit = () => setTimeout(() => fitView({ padding: 0.2, duration: 350, maxZoom: 1 }), 40);
    window.addEventListener('sf-fit', refit);
    return () => window.removeEventListener('sf-fit', refit);
  }, [fitView]);

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

  const addItem = (item: PaletteItem) => {
    if (!palette || !track) return;
    const from = palette.from;
    setPalette(null);
    if (item.kind === 'block') {
      const g = live();
      const at = from?.type === 'target' ? { x: palette.flow.x - 260, y: palette.flow.y } : palette.flow;
      const r = insertBlock({ nodes: g.nodes as GNode[], edges: g.edges as GEdge[] }, item.block, at);
      if (from?.type === 'source' && r.inlet) {
        connect({ source: from.node, sourceHandle: from.handle, target: r.inlet.node, targetHandle: r.inlet.handle }, r.graph.nodes as Node[], r.graph.edges as Edge[]);
      } else if (from?.type === 'target' && r.outlet) {
        connect({ source: r.outlet.node, sourceHandle: r.outlet.handle, target: from.node, targetHandle: from.handle }, r.graph.nodes as Node[], r.graph.edges as Edge[]);
      } else save(r.graph.nodes as Node[], r.graph.edges as Edge[], true);
      window.dispatchEvent(new CustomEvent('sf-fit'));
      toast(`Added ${item.block.name}`);
      return;
    }
    const def = NODE_DEFS[item.type];
    // when wiring backwards into an input, place the new node to the left of the drop point
    const want = from?.type === 'target' ? { x: palette.flow.x - 220, y: palette.flow.y } : palette.flow;
    const draft: GNode = { id: uid(item.type), type: item.type, position: want, data: { ...def.defaults } };
    const node: GNode = { ...draft, position: freeSpot(live().nodes as GNode[], want.x, want.y, nodeHeight(draft)) };
    const nextNodes = [...(live().nodes as GNode[]).map((n) => ({ ...n, selected: false })), { ...node, selected: true }] as Node[];
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
        {!showMath && (
        <button
          className="btn"
          title="Add a node (or double-click the board)"
          aria-label="Add node"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const w = wrapRef.current!.getBoundingClientRect();
            setPalette({
              screen: { x: r.left - w.left, y: r.bottom - w.top + 6 },
              flow: screenToFlowPosition({ x: w.left + w.width / 2 - 90, y: w.top + w.height / 2 - 60 }),
            });
          }}
        >
          <Icon name="plus" size={14} /> <span className="tb-label">Add node</span>
        </button>
        )}
        <button className="btn" onClick={() => useStore.getState().setShowFunction(true)} title="See the whole channel as one function — math, SoundFunc, JavaScript, Python (F)" aria-label="Function">
          <Icon name="sigma" size={14} /> <span className="tb-label">Function</span>
        </button>
        <button
          className="btn"
          title="Add a slider to this channel — a named constant its formulas can use (or Alt+S on a number in a formula)"
          aria-label="Slider"
          onClick={() => {
            const name = useStore.getState().addSlider(track.id, 0.5);
            toast(`Added slider “${name}” to ${track.name} — type its name in any of its formulas`);
          }}
        >
          <Icon name="sliders" size={14} /> <span className="tb-label">Slider</span>
        </button>
        <Mutator />
        {!showMath && <SelectionTools />}
        <button
          className={`btn func-view-toggle ${showMath ? 'on' : ''}`}
          aria-pressed={showMath}
          onClick={() => setMath({ open: !showMath })}
          title={showMath ? 'Back to the node board' : 'Func View: every channel you can hear, written as math, in the node board’s place'}
        >
          <span className="fx-glyph">ƒ</span> Func View
        </button>
      </div>
      <SlidersBar track={track} />
      {/* Functions: the math takes the board's place; the board stays mounted underneath, so its view and selection survive */}
      {showMath && <ScoreMath detail={math.detail} onDetail={(detail) => setMath({ detail })} zoom={math.zoom} onZoom={onMathZoom} />}
      <div className="nodes-canvas" style={showMath ? { display: 'none' } : undefined}>
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
      </div>
      {!render.hasOutput && !showMath && (
        <div className="viz-tip" style={{ left: '50%', top: 70, transform: 'translateX(-50%)', color: 'var(--accent)' }}>
          Add a “Note Out” node — it decides what you hear.
        </div>
      )}
      {palette && <Palette state={palette} hasOutput={render.hasOutput} onPick={addItem} onClose={() => setPalette(null)} />}
    </div>
  );
}
