import { createContext, Fragment, memo, useContext, useMemo, useState } from 'react';
import { Handle, Position, useNodeConnections, type NodeProps } from '@xyflow/react';
import { NODE_DEFS, sectionLengths, type Category, type NodeData, type ParamDef } from '../engine/graph';
import { useStore } from '../state/store';
import { Icon, NumberField, TextField } from './ui';
import { FormulaEditor, NODE_VARS } from './FormulaEditor';
import { explodeFormula } from '../engine/graphEdit';
import { toast } from './TopBar';
import { docFor } from '../engine/nodeDocs';
import type { Slider } from '../engine/project';

export const CATEGORY_COLORS: Record<Category, string> = {
  // bright enough to read on the node's dark screen
  source: '#4fc98a',
  math: '#6aa8ff',
  wave: '#3fd0c4',
  series: '#e8a93a',
  rhythm: '#b77ae0',
  form: '#d99a4e',
  output: '#ff5a48',
};

export interface GraphCtx {
  trackId: string;
  traces: Map<string, number[]>;
  errors: Map<string, string>;
}
export const GraphContext = createContext<GraphCtx | null>(null);

function Sparkline({ values, color, gates }: { values: number[]; color: string; gates?: boolean }) {
  if (values.length < 2) return null;
  let lo = Infinity, hi = -Infinity;
  for (const v of values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
  if (hi - lo < 1e-9) (lo -= 1), (hi += 1);
  const W = 200, H = 30;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo)) * (H - 6);
  if (gates) {
    const w = W / values.length;
    return (
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {values.map((v, i) => (
          <rect key={i} x={i * w + 1} y={v > 0 ? 6 : H - 6} width={Math.max(1, w - 2)} height={v > 0 ? H - 9 : 2} rx={1.5} fill={color} opacity={v > 0 ? 0.75 : 0.25} />
        ))}
      </svg>
    );
  }
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));

const NO_SLIDERS: Slider[] = [];

/** Formula nodes also know their track's sliders */
function NodeFormula(props: { value: string; onValue: (v: string) => void; onFocus: () => void }) {
  const trackId = useContext(GraphContext)?.trackId ?? '';
  const sliders = useStore((s) => s.project.tracks.find((t) => t.id === trackId)?.sliders ?? NO_SLIDERS);
  const vars = useMemo(() => ({ ...NODE_VARS, ...Object.fromEntries(sliders.map((sl) => [sl.name, `slider, now ${sl.value}`])) }), [sliders]);
  return <FormulaEditor {...props} vars={vars} sliders={trackId || undefined} />;
}

function Param({ p, data, onChange, onFocus, doc }: { p: ParamDef; data: NodeData; onChange: (patch: NodeData) => void; onFocus: () => void; doc?: string }) {
  if (p.kind === 'formula') return <NodeFormula value={String(data[p.key] ?? '')} onValue={(v) => onChange({ [p.key]: v })} onFocus={onFocus} />;
  if (p.kind === 'text') {
    return (
      <label className="fnode-param">
        <span data-tip={doc}>{p.label}</span>
        <TextField
          className="input mono nodrag"
          value={String(data[p.key] ?? '')}
          placeholder={p.placeholder}
          spellCheck={false}
          onFocus={onFocus}
          onValue={(v) => onChange({ [p.key]: v })}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </label>
    );
  }
  if (p.kind === 'select') {
    return (
      <label className="fnode-param">
        <span data-tip={doc}>{p.label}</span>
        <select className="select nodrag" value={String(data[p.key])} onFocus={onFocus} onChange={(e) => onChange({ [p.key]: e.target.value })}>
          {p.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="fnode-param">
      <span data-tip={doc}>{p.label}</span>
      <NumberField
        className="input nodrag"
        step={p.step ?? 0.1}
        min={p.min}
        max={p.max}
        value={Number(data[p.key] ?? 0)}
        onFocus={onFocus}
        onValue={(v) => onChange({ [p.key]: v })}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </label>
  );
}

/** the Sections node drawn as a timeline: one block per section, labelled with its input */
function Timeline({ data }: { data: NodeData }) {
  const lens = sectionLengths(data);
  const total = lens.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let x = 0;
  return (
    <svg className="timeline" viewBox="0 0 200 22" preserveAspectRatio="none">
      {lens.map((l, i) => {
        const w = (l / total) * 200;
        const el = (
          <g key={i}>
            <rect x={x + 0.5} y={1} width={Math.max(1, w - 1)} height={20} rx={4} fill={CATEGORY_COLORS.form} opacity={0.12 + (i % 4) * 0.1} />
            <text x={x + w / 2} y={14.5} textAnchor="middle" fontSize={9} fill="var(--ink-2)">
              {'ABCD'[i % 4]}
            </text>
          </g>
        );
        x += w;
        return el;
      })}
    </svg>
  );
}

/** the node's purpose, then what each input and output means */
function NodeGuide({ type }: { type: string }) {
  const def = NODE_DEFS[type];
  const rows = [...def.inputs.map((p) => ({ dir: 'in', p })), ...def.outputs.map((p) => ({ dir: 'out', p }))].map(({ dir, p }) => ({
    dir,
    label: p.label,
    doc: docFor(type, p.id),
  }));
  return (
    <div className="node-guide nodrag nowheel">
      <p>{def.hint}</p>
      {rows.length > 0 && (
        <dl>
          {rows.map((r) => (
            <Fragment key={`${r.dir}-${r.label}`}>
              <dt>
                <span className="muted">{r.dir === 'in' ? '→' : '←'}</span> {r.label}
              </dt>
              <dd>{r.doc ? r.doc.replace(/^[^—]*—\s*/, '') : ''}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

function InputPort({ id, label, doc }: { id: string; label: string; doc?: string }) {
  const connected = useNodeConnections({ handleType: 'target', handleId: id }).length > 0;
  return (
    <div className="port in" data-tip={doc}>
      <Handle type="target" position={Position.Left} id={id} className={connected ? 'connected' : ''} />
      {label}
    </div>
  );
}

export const FuncNode = memo(function FuncNode({ id, type, data }: NodeProps) {
  const ctx = useContext(GraphContext);
  const updateNodeData = useStore((s) => s.updateNodeData);
  const checkpoint = useStore((s) => s.checkpoint);
  const setLocked = useStore((s) => s.setLocked);
  const mutateNode = useStore((s) => s.mutateNode);
  const chaos = useStore((s) => s.chaos);
  const setAudition = useStore((s) => s.setAudition);
  const applyGraphEdit = useStore((s) => s.applyGraphEdit);
  const listening = useStore((s) => s.audition?.nodeId === id);
  const [helpOpen, setHelpOpen] = useState(false);
  const def = NODE_DEFS[type];
  if (!def || !ctx) return null;
  const d = data as NodeData;
  const color = CATEGORY_COLORS[def.category];
  const trace = ctx.traces.get(id) ?? [];
  const error = ctx.errors.get(id);
  const onChange = (patch: NodeData) => updateNodeData(ctx.trackId, id, patch);
  let lo = Infinity, hi = -Infinity;
  for (const v of trace) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));

  return (
    <div className={`fnode ${error ? 'err' : ''} ${d.locked ? 'locked' : ''} ${listening ? 'listening' : ''}`} title={def.hint}>
      <div className="fnode-head">
        <span className="dot" style={{ background: color }} />
        <b>{def.label}</b>
        {trace.length > 0 && <span className="val">{lo === hi ? fmt(lo) : `${fmt(lo)} … ${fmt(hi)}`}</span>}
        <button className={`lock nodrag help ${helpOpen ? 'on' : ''}`} title="What this node does" aria-pressed={helpOpen} onClick={() => setHelpOpen((o) => !o)}>
          ?
        </button>
        {type !== 'output' && (
          <button
            className={`lock nodrag listen ${listening ? 'on' : ''}`}
            title={listening ? 'Listening — click or Esc to stop' : `Listen to this node alone (${def.category === 'rhythm' ? 'as velocity' : 'as pitch'})`}
            aria-pressed={listening}
            onClick={() => setAudition(listening ? null : { trackId: ctx.trackId, nodeId: id })}
          >
            <Icon name="headphones" size={12} />
          </button>
        )}
        {type === 'expr' && (
          <button
            className="lock nodrag"
            title="Explode: split the outermost operation into its own node (repeat to go deeper)"
            onClick={() => {
              const err = applyGraphEdit(ctx.trackId, (g) => explodeFormula(g, id));
              if (err) toast(err);
            }}
          >
            <Icon name="split" size={12} />
          </button>
        )}
        {def.params.length > 0 && (
          <button
            className="lock nodrag dice"
            disabled={!!d.locked}
            title={
              d.locked
                ? 'Locked — unlock to mutate it'
                : `Mutate just this node — ${chaos < 0.35 ? 'harmonious' : chaos < 0.7 ? 'adventurous' : 'experimental'}, by the Mutate dial`
            }
            onClick={(e) => {
              const btn = e.currentTarget;
              btn.classList.remove('rolled');
              void btn.offsetWidth; // restart the roll
              btn.classList.add('rolled');
              if (!mutateNode(ctx.trackId, id)) toast('No change found for this node — try again, or turn the dial up');
            }}
          >
            <Icon name="dice" size={12} />
          </button>
        )}
        {def.params.length > 0 && (
          <button
            className={`lock nodrag ${d.locked ? 'on' : ''}`}
            title={d.locked ? 'Locked — Mutate leaves this node alone. Click (or L) to unlock' : 'Lock against Mutate (L)'}
            aria-pressed={!!d.locked}
            onClick={() => setLocked(ctx.trackId, [id], !d.locked)}
          >
            <Icon name={d.locked ? 'lock' : 'unlock'} size={12} />
            {d.locked && <span className="serif">固</span>}
          </button>
        )}
      </div>
      {helpOpen && <NodeGuide type={type} />}
      <div className="fnode-body">
        {def.inputs.length > 0 && (
          <div className="ports">
            {def.inputs.map((p) => (
              <InputPort key={p.id} id={p.id} label={p.label} doc={docFor(type, p.id)} />
            ))}
          </div>
        )}
        {type === 'number' && (
          <input
            className="nodrag"
            type="range"
            min={Number(d.min ?? -12)}
            max={Number(d.max ?? 12)}
            step={0.01}
            value={Number(d.value ?? 0)}
            onPointerDown={checkpoint}
            onChange={(e) => onChange({ value: Number(e.target.value) })}
          />
        )}
        {type === 'sections' && <Timeline data={d} />}
        {def.params.map((p) => (
          <Param key={p.key} p={p} data={d} onChange={onChange} onFocus={checkpoint} doc={docFor(type, p.key)} />
        ))}
        {/* formula nodes already show their own parse error under the text box */}
        {error && type !== 'expr' && <div className="fnode-error">{error}</div>}
        {def.outputs.length > 0 && (
          <div className="ports">
            {def.outputs.map((p) => (
              <div key={p.id} className="port out" data-tip={docFor(type, p.id)}>
                {p.label}
                <Handle type="source" position={Position.Right} id={p.id} />
              </div>
            ))}
          </div>
        )}
        {type !== 'step' && <Sparkline values={trace} color={color} gates={def.category === 'rhythm'} />}
      </div>
    </div>
  );
});
