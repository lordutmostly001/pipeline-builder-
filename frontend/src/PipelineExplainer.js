// PipelineExplainer.js — Floating draggable AI analysis panel + failure explainer

import { useState, useCallback, useRef } from 'react';
import { useClickOutside } from './useClickOutside';
import { useStore }    from './store';
import { shallow }     from 'zustand/shallow';
import { chatStream, MODELS } from './OllamaClient';

const selector = (s) => ({ nodes: s.nodes, edges: s.edges });

// ── Build compact graph context ───────────────────────────────────
const buildCtx = (nodes, edges) => {
  const nodeList = nodes.map((n) => `  ${n.id} [${n.type}]`).join('\n');
  const edgeList = edges.map((e) => `  ${e.source} → ${e.target}`).join('\n');
  return `Nodes:\n${nodeList || '  (none)'}\nEdges:\n${edgeList || '  (none)'}`;
};

// ── Hook ─────────────────────────────────────────────────────────
export const usePipelineExplainer = () => {
  const { nodes, edges } = useStore(selector, shallow);
  const setNodeStatus    = useStore((s) => s.setNodeStatus);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const explain = useCallback(async (mode = 'summary') => {
    setLoading(true);
    const ctx = buildCtx(nodes, edges);
    const prompts = {
      summary: `Analyse this pipeline and write a clear 2–3 sentence summary of what it does in plain English. Then list the main data flow steps as a numbered list.\n\nPipeline:\n${ctx}`,
      improve: `Review this pipeline and suggest 3 specific improvements with reasoning. Focus on efficiency, error handling, and design.\n\nPipeline:\n${ctx}`,
      cost:    `Estimate the computational cost of this pipeline. For each LLM node assume ~500 tokens. For each API node assume 1 HTTP call. Give a rough cost and runtime estimate.\n\nPipeline:\n${ctx}`,
    };
    const id = Date.now();
    setResult({ type: mode, text: '', streaming: true, id });
    try {
      await chatStream({
        model: MODELS.MAIN,
        messages: [{ role:'user', content: prompts[mode] ?? prompts.summary }],
        temperature: 0.4,
        onToken: (_, full) => setResult((r) => r?.id === id ? { ...r, text: full } : r),
        onDone:  (full)    => { setResult((r) => r?.id === id ? { ...r, text: full, streaming: false } : r); setLoading(false); },
      });
    } catch (e) {
      setResult({ type: mode, text: `Error: ${e.message}`, streaming: false, id });
      setLoading(false);
    }
  }, [nodes, edges]);

  const explainError = useCallback(async (errorText, failedNodeId) => {
    // Highlight failure path on canvas
    if (failedNodeId) {
      setNodeStatus(failedNodeId, 'error');
      // Trace upstream nodes and mark them as warning
      const upstream = [];
      const adj = {};
      nodes.forEach((n) => { adj[n.id] = []; });
      edges.forEach((e) => { if (adj[e.target]) adj[e.target].push(e.source); });
      const queue = [failedNodeId];
      const visited = new Set([failedNodeId]);
      while (queue.length) {
        const cur = queue.shift();
        (adj[cur] ?? []).forEach((src) => {
          if (!visited.has(src)) { visited.add(src); upstream.push(src); queue.push(src); }
        });
      }
      upstream.forEach((id) => setNodeStatus(id, 'warning'));
    }

    setLoading(true);
    const ctx = buildCtx(nodes, edges);
    const failedNode = nodes.find((n) => n.id === failedNodeId);
    const id = Date.now();
    setResult({ type: 'error', text: '', streaming: true, id, failedNodeId });
    try {
      await chatStream({
        model: MODELS.MAIN,
        messages: [{ role:'user', content:
          `A pipeline node failed during execution.\n\nFailed node: ${JSON.stringify(failedNode ?? { id: failedNodeId })}\nError: ${errorText}\n\nPipeline:\n${ctx}\n\nExplain in plain English:\n1. What caused this error\n2. How to fix it\n3. How to prevent it in future` }],
        temperature: 0.3,
        onToken: (_, full) => setResult((r) => r?.id === id ? { ...r, text: full } : r),
        onDone:  (full)    => { setResult((r) => r?.id === id ? { ...r, text: full, streaming: false } : r); setLoading(false); },
      });
    } catch (e) {
      setResult({ type: 'error', text: `Error: ${e.message}`, streaming: false, id });
      setLoading(false);
    }
  }, [nodes, edges, setNodeStatus]);

  const clear = useCallback(() => {
    setResult(null);
    useStore.getState().clearNodeStatuses();
  }, []);

  return { result, loading, explain, explainError, clear };
};

// ── Floating draggable panel ──────────────────────────────────────
export const ExplainerPanel = ({ result, loading, onExplain, onClose }) => {
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);
  const [pos,      setPos]      = useState({ x: 14, y: 90 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    if (e.target.closest('button')) return;
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - 340, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 480, e.clientY - dragOffset.current.y)),
    });
  };
  const onMouseUp = () => setDragging(false);

  const MODES = [
    { key:'summary', icon:'📋', label:'Summarise', color:'#3b82f6' },
    { key:'improve', icon:'⚡', label:'Improve',   color:'#f59e0b' },
    { key:'cost',    icon:'💰', label:'Cost Est.',  color:'#10b981' },
  ];

  const activeColor = result?.type === 'error' ? '#f43f5e'
    : MODES.find((m) => m.key === result?.type)?.color ?? '#8b5cf6';

  return (
    <div
      ref={panelRef}
      style={{
        position:'fixed', left:`${pos.x}px`, top:`${pos.y}px`, zIndex:8000,
        width:'340px',
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'14px', overflow:'hidden',
        boxShadow:'0 12px 40px #0009',
        fontFamily:"'DM Sans',sans-serif",
        cursor: dragging ? 'grabbing' : 'default',
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Header */}
      <div
        onMouseDown={onMouseDown}
        style={{
          padding:'12px 14px', borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          cursor: dragging ? 'grabbing' : 'grab', userSelect:'none',
          background: result?.type === 'error' ? '#f43f5e08' : 'transparent',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:`${activeColor}22`, border:`1px solid ${activeColor}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' }}>
            {result?.type === 'error' ? '🔴' : '🔮'}
          </div>
          <div>
            <div style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)' }}>
              {result?.type === 'error' ? 'Failure Analysis' : 'Pipeline Explainer'}
            </div>
            <div style={{ fontSize:'9px', color:'var(--text-dim)' }}>AI-powered analysis · drag to move</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'18px', lineHeight:1, padding:'2px' }}>×</button>
      </div>

      {/* Mode buttons — hidden in error mode */}
      {result?.type !== 'error' && (
        <div style={{ display:'flex', gap:'6px', padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
          {MODES.map(({ key, icon, label, color }) => (
            <button key={key} onClick={() => onExplain(key)} disabled={loading}
              style={{
                flex:1, padding:'7px 4px',
                background: result?.type === key ? `${color}18` : 'var(--bg-node)',
                border:`1px solid ${result?.type === key ? color : 'var(--border)'}`,
                borderRadius:'8px',
                color: result?.type === key ? color : 'var(--text-dim)',
                fontSize:'10px', fontWeight:700,
                cursor: loading ? 'wait' : 'pointer',
                fontFamily:'inherit', transition:'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}}
              onMouseLeave={(e) => {
                if (result?.type !== key) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-dim)';
                }
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      )}

      {/* Result area */}
      <div style={{ padding:'12px 14px', maxHeight:'340px', overflowY:'auto', minHeight:'80px' }}>
        {!result && !loading && (
          <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'24px 0', lineHeight:1.8 }}>
            Select an analysis mode above<br />
            <span style={{ fontSize:'10px', color:'var(--text-dim)' }}>or trigger from execution errors</span>
          </div>
        )}
        {loading && !result?.text && (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'11px', color:'var(--text-dim)', padding:'12px 0' }}>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: activeColor, animation:'pulse 1s ease infinite', flexShrink:0 }} />
            {result?.type === 'error' ? 'Analysing failure…' : 'Analysing pipeline…'}
          </div>
        )}
        {result?.text && (
          <div style={{ fontSize:'12px', color:'var(--text-secondary)', lineHeight:1.75, whiteSpace:'pre-wrap' }}>
            {result.type === 'error' && (
              <div style={{ marginBottom:'10px', padding:'6px 10px', background:'#f43f5e12', border:'1px solid #f43f5e33', borderRadius:'7px', fontSize:'10px', color:'#f87171', fontWeight:700 }}>
                ⚠ Failure path highlighted on canvas
              </div>
            )}
            {result.text}
            {result.streaming && (
              <span style={{ display:'inline-block', width:'8px', height:'12px', background: activeColor, marginLeft:'2px', animation:'blink 0.8s step-end infinite', borderRadius:'1px' }} />
            )}
          </div>
        )}
      </div>

      {/* Footer — clear button */}
      {result && !loading && (
        <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)' }}>
          <button
            onClick={onClose}
            style={{ width:'100%', padding:'6px', background:'transparent', border:'1px solid var(--border)', borderRadius:'7px', color:'var(--text-dim)', fontSize:'10px', cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#f43f5e'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            Clear &amp; Close
          </button>
        </div>
      )}
    </div>
  );
};