import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { compose, describeTrack, trackCode, trackDocument, trackFormulas, trackSource, trackTex } from '../engine/symbolic';
import { useSelectedTrack, useStore } from '../state/store';
import { toast } from './TopBar';
import { Icon, Seg, download, fileSafe } from './ui';
import { Tex, useKatex } from './tex';

type Tab = 'math' | 'source' | 'js' | 'py';
type Scope = 'track' | 'garden';

/** a light touch of colour for code: comments, strings, keywords, numbers */
function highlight(code: string, lang: 'js' | 'py'): (string | ReactNode)[] {
  const kw = lang === 'js' ? 'export|function|const|let|return|for|while|if|else|new' : 'def|return|import|for|while|if|else|in|and|or|not|lambda';
  const re = new RegExp(`(${lang === 'js' ? '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' : '#[^\\n]*|"""[\\s\\S]*?"""'})|("(?:[^"\\\\]|\\\\.)*")|\\b(${kw})\\b|\\b(0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b`, 'g');
  const out: (string | ReactNode)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-kw' : 'c-num';
    out.push(
      <span key={i++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  out.push(code.slice(last));
  return out;
}

export function FunctionSheet() {
  const open = useStore((s) => s.showFunction);
  const setOpen = useStore((s) => s.setShowFunction);
  const project = useStore((s) => s.project);
  const selectTrack = useStore((s) => s.selectTrack);
  const selected = useSelectedTrack();
  const [tab, setTab] = useState<Tab>('math');
  const [scope, setScope] = useState<Scope>('track');
  const katex = useKatex();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const tracks = useMemo(() => (scope === 'garden' ? project.tracks : selected ? [selected] : []), [scope, project.tracks, selected]);
  const composed = useMemo(() => tracks.map((t) => compose(t)), [tracks]);
  const inlined = useMemo(() => tracks.map((t) => compose(t, true)), [tracks]);
  const code = useMemo(() => (tab === 'js' || tab === 'py' ? trackCode(composed, project.song, tab) : ''), [tab, composed, project.song]);

  if (!open) return null;

  // the plain-text form of whatever is showing, for Copy and Download
  const asText = (): { text: string; ext: string; mime: string } => {
    if (tab === 'js') return { text: code, ext: 'js', mime: 'text/javascript' };
    if (tab === 'py') return { text: code, ext: 'py', mime: 'text/x-python' };
    // both paste back into Paste function as the channels they came from
    if (tab === 'source') return { text: trackFormulas(inlined, project.song), ext: 'txt', mime: 'text/plain' };
    return { text: trackDocument(composed, project.song), ext: 'tex', mime: 'application/x-tex' };
  };

  const name = scope === 'garden' ? fileSafe(project.name) : fileSafe(selected?.name ?? 'track');

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="sheet" role="dialog" aria-label="The function in full">
        <header className="sheet-head">
          <div>
            <div className="eyebrow" style={{ margin: 0 }}>
              The function, in full
            </div>
            <div className="row" style={{ gap: 12, marginTop: 6 }}>
              {scope === 'track' ? (
                <select className="select sheet-track" value={selected?.id ?? ''} onChange={(e) => selectTrack(e.target.value)}>
                  {project.tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="serif sheet-title">{project.name}</h2>
              )}
              <Seg<Scope>
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'track', label: 'Channel' },
                  { value: 'garden', label: 'Track' },
                ]}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Seg<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'math', label: 'Math' },
                { value: 'source', label: 'SoundFunc' },
                { value: 'js', label: 'JavaScript' },
                { value: 'py', label: 'Python' },
              ]}
            />
            <button className="icon-btn" onClick={() => setOpen(false)} title="Close (Esc)">
              <Icon name="close" />
            </button>
          </div>
        </header>

        <div className="sheet-body">
          {tab === 'math' &&
            composed.map((c) => (
              <section key={c.track.id} className="fn-track">
                {scope === 'garden' && <h3 className="serif">{c.track.name}</h3>}
                <p className="muted fn-desc">{describeTrack(c.track, project.song)}</p>
                {trackTex(c, project.song).map((l, i) => (
                  <div key={i} className="fn-line">
                    <span className="fn-label">{l.label}</span>
                    <Tex tex={l.tex} katex={katex} />
                  </div>
                ))}
              </section>
            ))}

          {tab === 'source' &&
            inlined.map((c) => (
              <section key={c.track.id} className="fn-track">
                {scope === 'garden' && <h3 className="serif">{c.track.name}</h3>}
                <p className="muted fn-desc">
                  Each line is complete — shared parts are written out — so it can be pasted straight into a Formula node.
                </p>
                {trackSource(c, project.song).map((l) => (
                  <div key={l.label} className="fn-line">
                    <span className="fn-label">{l.label}</span>
                    <div className="fn-code">
                      <code>{l.code}</code>
                      <button
                        className="icon-btn"
                        title="Copy"
                        onClick={() => {
                          void navigator.clipboard.writeText(l.code);
                          toast(`Copied ${l.label}`);
                        }}
                      >
                        <Icon name="copy" size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            ))}

          {(tab === 'js' || tab === 'py') && <pre className="fn-pre">{highlight(code, tab)}</pre>}
        </div>

        <footer className="sheet-foot">
          <span className="muted">
            {tab === 'math' && 'Exact: every node inlined, shared parts named, constants folded.'}
            {tab === 'source' && 'SoundFunc formula syntax.'}
            {(tab === 'js' || tab === 'py') && 'Standalone — includes only the helpers it uses, and reproduces the engine’s numbers exactly.'}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard.writeText(asText().text);
                toast('Copied to clipboard');
              }}
            >
              <Icon name="copy" size={13} /> Copy {tab === 'math' ? 'LaTeX' : ''}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                const t = asText();
                download(`${name}.${t.ext}`, t.text, t.mime);
              }}
            >
              <Icon name="download" size={13} /> Download .{asText().ext}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
