// ExecutionPreview.js — n8n-style execution preview with pre-validation

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStore }       from './store';
import { shallow }        from 'zustand/shallow';
import { analyzeGraph }   from './graphAnalytics';

const NODE_LABELS = {
  customInput: 'Input', llm: 'LLM', customOutput: 'Output',
  text: 'Text', filter: 'Filter', merge: 'Merge',
  api: 'API Call', transform: 'Transform', condition: 'Condition',
  timer: 'Timer', note: 'Note',
};
const NODE_ICONS = {
  customInput: '📥', llm: '🤖', customOutput: '📤', text: '📝',
  filter: '🔍', merge: '🔗', api: '🌐', transform: '⚙️',
  condition: '🔀', timer: '⏱️', note: '📌',
};

// Required input handles per node type — these MUST be connected to run
// 'customInput' and 'timer' have no required inputs (they are trigger/source nodes)
const REQUIRED_HANDLES = {
  llm:          ['prompt'],          // system is optional
  filter:       ['data'],
  transform:    ['input'],
  condition:    ['input'],
  api:          ['body'],            // headers optional
  merge:        null,                // dynamic — checked separately
  customOutput: ['value'],
  text:         null,                // dynamic — checked via {{vars}}
  customInput:  [],                  // trigger node — no required inputs
  timer:        [],                  // trigger node — no required inputs
};

const VAR_REGEX = /\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\}/g;
const getTextVars = (node) => {
  if (node?.type !== 'text') return [];
  const text = node.data?.text || '';
  const vars = []; let m;
  const re = new RegExp(VAR_REGEX.source, 'g');
  while ((m = re.exec(text)) !== null) {
    if (!vars.includes(m[1])) vars.push(m[1]);
  }
  return vars;
};

const selector = (s) => ({ nodes: s.nodes, edges: s.edges, setNodeStatus: s.setNodeStatus });

// ── CSS ───────────────────────────────────────────────────────────
const STYLE_ID = 'exec-preview-styles';
const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes execPulse {
      0%   { box-shadow: 0 0 0 0px rgba(99,102,241,0.8), 0 0 0 0px rgba(99,102,241,0.4); }
      50%  { box-shadow: 0 0 0 6px rgba(99,102,241,0.4), 0 0 0 12px rgba(99,102,241,0.1); }
      100% { box-shadow: 0 0 0 0px rgba(99,102,241,0), 0 0 0 0px rgba(99,102,241,0); }
    }
    @keyframes execSuccess {
      0%   { box-shadow: 0 0 0 0px rgba(16,185,129,0.9); }
      60%  { box-shadow: 0 0 0 10px rgba(16,185,129,0.2); }
      100% { box-shadow: 0 0 0 4px rgba(16,185,129,0.35); }
    }
    @keyframes edgeExecFlow { to { stroke-dashoffset: -20; } }
    .exec-running > div {
      outline: 2px solid #6366f1 !important; outline-offset: 3px;
      animation: execPulse 0.9s ease-in-out infinite !important;
    }
    .exec-success > div {
      outline: 2px solid #10b981 !important; outline-offset: 3px;
      animation: execSuccess 0.4s ease-out forwards !important;
    }
    .exec-pending > div { opacity: 0.35; transition: opacity 0.3s; }
    .exec-issue > div {
      outline: 2px solid #f43f5e !important; outline-offset: 3px;
      box-shadow: 0 0 0 4px #f43f5e33, 0 0 16px #f43f5e44 !important;
    }
    .exec-edge-active path.react-flow__edge-path {
      stroke: #6366f1 !important; stroke-width: 3 !important;
      stroke-dasharray: 6 4 !important;
      animation: edgeExecFlow 0.5s linear infinite !important;
      filter: drop-shadow(0 0 6px #6366f1) !important;
    }
    .exec-edge-done path.react-flow__edge-path {
      stroke: #10b981 !important; stroke-width: 2.5 !important;
      stroke-dasharray: 6 4 !important;
      animation: edgeExecFlow 1.2s linear infinite !important;
      filter: drop-shadow(0 0 4px #10b98188) !important;
    }
  `;
  document.head.appendChild(el);
};
const removeStyles = () => { document.getElementById(STYLE_ID)?.remove(); };

export const ExecutionPreview = ({ onClose }) => {
  const { nodes, edges, setNodeStatus } = useStore(selector, shallow);
  const analytics   = analyzeGraph(nodes, edges);
  const rawTopoOrder = analytics?.topoOrder ?? nodes.map((n) => n.id);

  // Only nodes that appear in at least one edge
  const connectedNodeIds = useMemo(() => {
    const s = new Set();
    edges.forEach((e) => { s.add(e.source); s.add(e.target); });
    return s;
  }, [edges]);

  const topoOrder = useMemo(() =>
    rawTopoOrder.filter((id) => connectedNodeIds.has(id)),
    [rawTopoOrder, connectedNodeIds]
  );

  // ── Pre-validate: find ALL issues before running ──────────────────
  const issues = useMemo(() => {
    // Build map: nodeId → Set of connected targetHandles
    const handleMap = {};
    edges.forEach((e) => {
      if (!handleMap[e.target]) handleMap[e.target] = new Set();
      if (e.targetHandle) handleMap[e.target].add(e.targetHandle);
    });

    const result = []; // { nodeId, message }

    topoOrder.forEach((id) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;

      const connected = handleMap[id] ?? new Set();

      if (node.type === 'text') {
        // Check every {{var}} has a connected handle
        const vars = getTextVars(node);
        vars.forEach((v) => {
          if (!connected.has(`${id}-${v}`)) {
            result.push({ nodeId: id, message: `{{${v}}} not connected` });
          }
        });
      } else if (node.type === 'merge') {
        // Merge: check all dynamic input-N handles
        const inputCount = node.data?.inputCount ?? 2;
        for (let i = 0; i < inputCount; i++) {
          if (!connected.has(`input-${i}`)) {
            result.push({ nodeId: id, message: `in ${i + 1} not connected` });
          }
        }
      } else {
        const required = REQUIRED_HANDLES[node.type] ?? [];
        required.forEach((h) => {
          if (!connected.has(h)) {
            result.push({ nodeId: id, message: `"${h}" not connected` });
          }
        });
      }
    });
    return result;
  }, [topoOrder, nodes, edges]);

  const issueNodeIds = useMemo(() => new Set(issues.map((i) => i.nodeId)), [issues]);

  const [phase,     setPhase]     = useState('idle'); // idle | previewing | running | done
  const [activeIdx, setActiveIdx] = useState(-1);
  const [doneIds,   setDoneIds]   = useState(new Set());
  const cancelRef = useRef(false);

  useEffect(() => {
    injectStyles();
    return () => {
      removeStyles();
      nodes.forEach((n) => setNodeStatus(n.id, 'idle')); // eslint-disable-line react-hooks/exhaustive-deps
      clearAllClasses();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When issues change while previewing, re-mark them
  useEffect(() => {
    if (phase === 'previewing') showIssues();
  }, [issues]); // eslint-disable-line react-hooks/exhaustive-deps

  const getNodeEl = (id) => document.querySelector(`.react-flow__node[data-id="${id}"]`);
  const getEdgeEl = (id) =>
    document.querySelector(`.react-flow__edge[data-testid="rf__edge-${id}"]`) ??
    document.querySelector(`.react-flow__edge[id="${id}"]`);

  const clearAllClasses = () => {
    document.querySelectorAll('.exec-running,.exec-success,.exec-pending,.exec-issue').forEach((el) =>
      el.classList.remove('exec-running', 'exec-success', 'exec-pending', 'exec-issue')
    );
    document.querySelectorAll('.exec-edge-active,.exec-edge-done').forEach((el) =>
      el.classList.remove('exec-edge-active', 'exec-edge-done')
    );
  };

  // Show issues on canvas — dim all nodes, highlight broken ones red
  const showIssues = useCallback(() => {
    clearAllClasses();
    topoOrder.forEach((id) => {
      const el = getNodeEl(id);
      if (!el) return;
      if (issueNodeIds.has(id)) {
        el.classList.add('exec-issue');
        setNodeStatus(id, 'error');
      } else {
        el.classList.add('exec-pending');
      }
    });
  }, [topoOrder, issueNodeIds, setNodeStatus]);

  const markPending = useCallback(() => {
    topoOrder.forEach((id) => {
      const el = getNodeEl(id);
      if (el) { el.classList.remove('exec-running', 'exec-success', 'exec-issue'); el.classList.add('exec-pending'); }
    });
  }, [topoOrder]);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const run = useCallback(async () => {
    cancelRef.current = false;
    setPhase('running');
    clearAllClasses();
    markPending();
    const newDone = new Set();

    // Build incoming source map for gate checks
    const incomingSourceMap = {};
    edges.forEach((e) => {
      if (!incomingSourceMap[e.target]) incomingSourceMap[e.target] = [];
      incomingSourceMap[e.target].push(e.source);
    });

    for (let i = 0; i < topoOrder.length; i++) {
      if (cancelRef.current) break;
      const id = topoOrder[i];
      setActiveIdx(i);

      // Gate: all source nodes must be done (handles trigger nodes with no sources correctly)
      const requiredSources = incomingSourceMap[id] ?? [];
      const unsatisfied = requiredSources.filter((srcId) => !newDone.has(srcId));
      if (unsatisfied.length > 0) break; // upstream was blocked, stop silently

      const nodeEl = getNodeEl(id);
      if (nodeEl) { nodeEl.classList.remove('exec-pending', 'exec-success'); nodeEl.classList.add('exec-running'); }
      setNodeStatus(id, 'running');

      // Animate incoming edges
      edges.filter((e) => e.target === id && newDone.has(e.source)).forEach((e) => {
        const edgeEl = getEdgeEl(e.id);
        if (edgeEl) { edgeEl.classList.remove('exec-edge-done'); edgeEl.classList.add('exec-edge-active'); }
      });

      await sleep(700);
      if (cancelRef.current) break;

      if (nodeEl) { nodeEl.classList.remove('exec-running'); nodeEl.classList.add('exec-success'); }
      setNodeStatus(id, 'success');
      newDone.add(id);
      setDoneIds(new Set(newDone));

      edges.filter((e) => e.target === id).forEach((e) => {
        const edgeEl = getEdgeEl(e.id);
        if (edgeEl) { edgeEl.classList.remove('exec-edge-active'); edgeEl.classList.add('exec-edge-done'); }
      });

      await sleep(200);
    }

    // Final outgoing edges of last node
    if (!cancelRef.current && topoOrder.length > 0) {
      const lastId = topoOrder[topoOrder.length - 1];
      edges.filter((e) => e.source === lastId).forEach((e) => {
        const edgeEl = getEdgeEl(e.id);
        if (edgeEl) edgeEl.classList.add('exec-edge-done');
      });
    }

    if (!cancelRef.current) setPhase('done');
  }, [topoOrder, edges, setNodeStatus, markPending]);

  const reset = useCallback(() => {
    cancelRef.current = true;
    clearAllClasses();
    nodes.forEach((n) => setNodeStatus(n.id, 'idle'));
    setPhase('idle');
    setActiveIdx(-1);
    setDoneIds(new Set());
  }, [nodes, setNodeStatus]);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const handleOpen = useCallback(() => {
    if (issues.length > 0) {
      setPhase('previewing');
      showIssues();
    } else {
      run();
    }
  }, [issues, showIssues, run]);

  const progress = topoOrder.length ? (doneIds.size / topoOrder.length) * 100 : 0;
  const activeNode = activeIdx >= 0 ? nodes.find((n) => n.id === topoOrder[activeIdx]) : null;
  const skipped = nodes.filter((n) => n.type !== 'note' && !connectedNodeIds.has(n.id)).length;

  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9990,
      background: 'var(--bg-modal)', border: `1px solid ${issues.length > 0 && phase === 'previewing' ? '#f43f5e44' : 'var(--border)'}`,
      borderRadius: '14px', boxShadow: 'var(--shadow-panel)',
      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
      fontFamily: "'DM Sans',sans-serif", minWidth: '440px',
      backdropFilter: 'blur(16px)',
      transition: 'border-color 0.3s',
    }}>

      {/* Status */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          {/* Phase indicator dot */}
          {phase === 'running'    && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px #6366f1', animation: 'execPulse 0.9s ease-in-out infinite', flexShrink: 0 }} />}
          {phase === 'done'       && <span style={{ color: '#10b981', fontSize: 14 }}>✓</span>}
          {phase === 'idle'       && <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>◎</span>}
          {phase === 'previewing' && <span style={{ color: '#f43f5e', fontSize: 13 }}>⚠</span>}

          <span style={{ fontSize: 12, fontWeight: 700, color: phase === 'previewing' ? '#f87171' : 'var(--text-primary)', flex: 1, minWidth: 0 }}>
            {phase === 'idle'       && 'Execution Preview'}
            {phase === 'running'    && (activeNode ? `Running: ${NODE_ICONS[activeNode.type] ?? ''} ${NODE_LABELS[activeNode.type] ?? activeNode.type}` : 'Starting…')}
            {phase === 'done'       && `✓ Completed — ${doneIds.size} node${doneIds.size !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} disconnected skipped)` : ''}`}
            {phase === 'previewing' && `${issues.length} issue${issues.length !== 1 ? 's' : ''} found — fix before running`}
          </span>
        </div>

        {/* Issues list */}
        {phase === 'previewing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
            {issues.slice(0, 3).map((issue, i) => {
              const n = nodes.find((nd) => nd.id === issue.nodeId);
              const label = n?.data?.customName || NODE_LABELS[n?.type] || issue.nodeId;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 11, color: '#f87171' }}>
                  <span style={{ opacity: 0.6 }}>↳</span>
                  <span style={{ fontWeight: 600 }}>{NODE_ICONS[n?.type] ?? ''} {label}</span>
                  <span style={{ color: '#f8717188' }}>— {issue.message}</span>
                </div>
              );
            })}
            {issues.length > 3 && (
              <div style={{ fontSize: 10, color: '#f8717166', marginTop: 1 }}>+{issues.length - 3} more issues</div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {(phase === 'running' || phase === 'done') && (
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', width: '100%', marginTop: 2 }}>
            <div style={{
              height: '100%', width: `${phase === 'idle' ? 0 : progress}%`,
              background: phase === 'done' ? '#10b981' : 'linear-gradient(90deg,#6366f1,#8b5cf6)',
              borderRadius: 2, transition: 'width 0.35s ease, background 0.3s',
            }} />
          </div>
        )}

        {/* Step counter */}
        {(phase === 'running' || phase === 'done') && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            Step {Math.min(doneIds.size + (phase === 'running' ? 1 : 0), topoOrder.length)} of {topoOrder.length}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        {phase === 'idle' && (
          <button onClick={handleOpen} style={btnStyle('#6366f1')}>▶ Run</button>
        )}
        {phase === 'previewing' && (
          <button onClick={() => { reset(); run(); }} style={btnStyle('#6366f1')}>▶ Run anyway</button>
        )}
        {phase === 'running' && (
          <button onClick={reset} style={btnStyle('#f43f5e')}>■ Stop</button>
        )}
        {phase === 'done' && (
          <>
            <button onClick={reset} style={btnStyle('var(--text-dim)', true)}>↺ Reset</button>
            <button onClick={() => { reset(); setTimeout(() => run(), 50); }} style={btnStyle('#6366f1')}>▶ Replay</button>
          </>
        )}
        <button onClick={handleClose} style={{ ...btnStyle('var(--text-dim)', true), padding: '6px 10px' }}>✕</button>
      </div>
    </div>
  );
};

const btnStyle = (color, ghost = false) => ({
  padding: '7px 16px',
  background: ghost ? 'var(--bg-hover)' : color,
  color: ghost ? 'var(--text-secondary)' : '#fff',
  border: ghost ? '1px solid var(--border)' : 'none',
  borderRadius: '8px', fontSize: '12px', fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  transition: 'opacity 0.15s',
});