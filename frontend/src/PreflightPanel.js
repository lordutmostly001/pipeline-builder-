// PreflightPanel.js — Pre-flight check panel before execution
// Shows complexity forecast, cost estimate, API calls, runtime, and issues.

import { useMemo, useState } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';
import { analyzeGraph, lintPipeline, computeHealthScore } from './graphAnalytics';
import { useClickOutside } from './useClickOutside';
import { useRef } from 'react';

const selector = (s) => ({ nodes: s.nodes, edges: s.edges });

// Token cost estimates per LLM model (per 1K tokens, in USD)
const MODEL_COSTS = {
  'gpt-4o':         { input: 0.005,  output: 0.015  },
  'gpt-4-turbo':    { input: 0.01,   output: 0.03   },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
};

// Rough token estimates per node type
const NODE_TOKEN_ESTIMATE = {
  llm: { input: 500, output: 300 },
  text: { input: 0, output: 50 },
};

const formatCost = (usd) => usd < 0.001 ? `<$0.001` : `~$${usd.toFixed(4)}`;

export const PreflightPanel = ({ onClose, onRun }) => {
  const { nodes, edges } = useStore(selector, shallow);
  const ref = useRef(null);
  useClickOutside(ref, onClose);

  const [expanded, setExpanded] = useState({ issues: true, cost: false, path: false });
  const toggle = (k) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  const analytics = useMemo(() => analyzeGraph(nodes, edges), [nodes, edges]);
  const warnings  = useMemo(() => lintPipeline(nodes, edges), [nodes, edges]);
  const health    = useMemo(() => computeHealthScore(analytics, warnings), [analytics, warnings]);

  // ── Cost estimation ────────────────────────────────────────────
  const costData = useMemo(() => {
    const llmNodes = nodes.filter((n) => n.type === 'llm');
    let totalCost = 0;
    let totalTokens = 0;

    const breakdown = llmNodes.map((n) => {
      const model = n.data?.model || 'gpt-4o';
      const rates = MODEL_COSTS[model] ?? MODEL_COSTS['gpt-4o'];
      const est   = NODE_TOKEN_ESTIMATE.llm;
      const cost  = (est.input / 1000) * rates.input + (est.output / 1000) * rates.output;
      totalCost  += cost;
      totalTokens += est.input + est.output;
      return { id: n.id, name: n.data?.customName || 'LLM', model, cost };
    });

    return { breakdown, totalCost, totalTokens, llmCount: llmNodes.length };
  }, [nodes]);

  // ── API call count ─────────────────────────────────────────────
  const apiCount  = nodes.filter((n) => n.type === 'api').length;
  const llmCount  = nodes.filter((n) => n.type === 'llm').length;
  const totalCalls = apiCount + llmCount;

  // ── Critical path ──────────────────────────────────────────────
  const critPath  = analytics?.criticalPath;
  const critNodes = critPath
    ? nodes.filter((n) => critPath.nodeIds.has(n.id))
    : [];

  // ── Issues list ────────────────────────────────────────────────
  const errors   = warnings?.filter((w) => w.level === 'error')   ?? [];
  const warns    = warnings?.filter((w) => w.level === 'warning')  ?? [];
  const allIssues = [...errors, ...warns];

  const canRun = errors.length === 0 && analytics?.isDAG;

  const NODE_ICONS = {
    customInput: '📥', llm: '🤖', customOutput: '📤', text: '📝',
    filter: '🔍', merge: '🔗', api: '🌐', transform: '⚙️',
    condition: '🔀', timer: '⏱️', note: '📌',
  };

  if (!analytics) return (
    <div ref={ref} style={panelStyle}>
      <Header onClose={onClose} />
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
        Add nodes to your pipeline to see the pre-flight report.
      </div>
    </div>
  );

  return (
    <div ref={ref} style={panelStyle}>
      <Header onClose={onClose} />

      {/* ── Score bar ── */}
      <div style={{ padding: '16px 18px 0', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
              Pipeline Health
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: health?.color ?? '#10b981', letterSpacing: '-0.02em' }}>
              {health?.score ?? 100}
              <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 4, color: 'var(--text-dim)' }}>/ 100</span>
              <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 8, color: health?.color }}>{health?.label}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: health?.color, lineHeight: 1 }}>{health?.grade}</div>
            <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 2 }}>grade</div>
          </div>
        </div>
        {/* Score bar */}
        <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${health?.score ?? 0}%`,
            background: `linear-gradient(90deg, ${health?.color ?? '#10b981'}88, ${health?.color ?? '#10b981'})`,
            borderRadius: 3, transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* ── Quick stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Est. Runtime', value: analytics.estimatedLabel, icon: '⏱', color: '#60a5fa' },
          { label: 'API/LLM Calls', value: totalCalls, icon: '📡', color: '#a78bfa' },
          { label: 'Est. Cost', value: formatCost(costData.totalCost), icon: '💰', color: '#34d399' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: 'var(--bg-modal)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{icon} {label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color, letterSpacing: '-0.01em' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>

        {/* Issues */}
        <Section
          label={`Issues ${allIssues.length > 0 ? `(${allIssues.length})` : '✓'}`}
          color={allIssues.length > 0 ? '#f87171' : '#10b981'}
          open={expanded.issues}
          onToggle={() => toggle('issues')}
        >
          {allIssues.length === 0 ? (
            <div style={{ padding: '8px 18px', fontSize: 12, color: '#10b981', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span>✓</span> No issues detected — ready to run
            </div>
          ) : (
            allIssues.map((w, i) => (
              <div key={i} style={{ padding: '6px 18px', display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
                <span style={{ color: w.level === 'error' ? '#f43f5e' : '#f59e0b', flexShrink: 0, marginTop: 1 }}>
                  {w.level === 'error' ? '✕' : '⚠'}
                </span>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{w.msg}</span>
              </div>
            ))
          )}
        </Section>

        {/* Cost breakdown */}
        <Section
          label={`Cost Estimate — ${formatCost(costData.totalCost)}/run`}
          color='#34d399'
          open={expanded.cost}
          onToggle={() => toggle('cost')}
        >
          {costData.breakdown.length === 0 ? (
            <div style={{ padding: '8px 18px', fontSize: 12, color: 'var(--text-dim)' }}>No LLM nodes — $0.00</div>
          ) : (
            <>
              {costData.breakdown.map((item, i) => (
                <div key={i} style={{ padding: '5px 18px', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>🤖 {item.name} <span style={{ color: 'var(--text-hint)', fontSize: 10 }}>({item.model})</span></span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{formatCost(item.cost)}</span>
                </div>
              ))}
              <div style={{ padding: '6px 18px', borderTop: '1px solid var(--border)', marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: 'var(--text-dim)' }}>~{costData.totalTokens.toLocaleString()} tokens</span>
                <span style={{ color: '#34d399' }}>{formatCost(costData.totalCost)} / run</span>
              </div>
            </>
          )}
        </Section>

        {/* Critical path */}
        <Section
          label={`Critical Path — ${analytics.estimatedLabel}`}
          color='#60a5fa'
          open={expanded.path}
          onToggle={() => toggle('path')}
        >
          {critNodes.length === 0 ? (
            <div style={{ padding: '8px 18px', fontSize: 12, color: 'var(--text-dim)' }}>No connected path found</div>
          ) : (
            <div style={{ padding: '8px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                {critNodes.map((n, i) => (
                  <span key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                      {NODE_ICONS[n.type]} {n.data?.customName || n.type}
                    </span>
                    {i < critNodes.length - 1 && <span style={{ color: 'var(--text-hint)', fontSize: 10 }}>→</span>}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                {analytics.complexity} topology · {analytics.nodeCount} nodes · {analytics.edgeCount} edges
              </div>
            </div>
          )}
        </Section>

      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        {canRun ? (
          <button onClick={onRun} style={{ flex: 1, ...btnStyle('#6366f1') }}>▶ Run Pipeline</button>
        ) : (
          <button disabled style={{ flex: 1, ...btnStyle('#6366f1'), opacity: 0.4, cursor: 'not-allowed' }}>
            ▶ Fix issues before running
          </button>
        )}
        <button onClick={onClose} style={btnStyle('var(--text-dim)', true)}>Close</button>
      </div>
    </div>
  );
};

// ── Sub-components ─────────────────────────────────────────────────
const Header = ({ onClose }) => (
  <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>🚀 Pre-flight Check</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>Pipeline analysis before execution</div>
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: '2px 6px', borderRadius: 4 }}>✕</button>
  </div>
);

const Section = ({ label, color, open, onToggle, children }) => (
  <div style={{ borderBottom: '1px solid var(--border)' }}>
    <button onClick={onToggle} style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer',
      fontFamily: "'DM Sans',sans-serif",
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ color: 'var(--text-hint)', fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
    </button>
    {open && children}
  </div>
);

const panelStyle = {
  position: 'fixed', right: 16, top: 70,
  width: 340, maxHeight: 'calc(100vh - 140px)',
  background: 'var(--bg-modal)', border: '1px solid var(--border)',
  borderRadius: 16, boxShadow: 'var(--shadow-panel)',
  fontFamily: "'DM Sans',sans-serif",
  display: 'flex', flexDirection: 'column',
  zIndex: 9900, overflow: 'hidden',
};

const btnStyle = (color, ghost = false) => ({
  padding: '8px 16px', background: ghost ? 'var(--bg-hover)' : color,
  color: ghost ? 'var(--text-secondary)' : '#fff',
  border: ghost ? '1px solid var(--border)' : 'none',
  borderRadius: 8, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
});