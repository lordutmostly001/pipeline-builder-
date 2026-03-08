// submit.js
// ─────────────────────────────────────────────────────────────────
// SubmitButton reads the current pipeline from the Zustand store,
// POSTs it to the FastAPI backend, and displays the result in a
// styled modal.
//
// externalTrigger — incremented by the keyboard shortcut (Ctrl+Enter)
//   to programmatically fire a submit without clicking the button.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { toast } from './Toast';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';

const selector = (state) => ({ nodes: state.nodes, edges: state.edges });

// ── Stat card ────────────────────────────────────────────────────
const StatCard = ({ label, value, color }) => (
  <div style={{
    flex: 1, background: 'var(--bg-card)',
    border: `1px solid ${color}44`, borderRadius: '10px',
    padding: '14px 10px', textAlign: 'center',
  }}>
    <div style={{ fontSize: '28px', fontWeight: 800, color, lineHeight: 1, marginBottom: '6px' }}>
      {value}
    </div>
    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
      {label}
    </div>
  </div>
);

// ── Results modal ────────────────────────────────────────────────
const ResultModal = ({ result, error, onClose }) => {
  const isDAG = result?.is_dag;

  // Close on Escape is handled globally in useKeyboardShortcuts,
  // but we pass onClose down so the modal's own ✕ button works too.
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0,
      background: '#000a', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, animation: 'fadeIn 0.15s ease both',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background:   'var(--bg-modal)',
        border:       '1px solid var(--border)',
        borderRadius: '16px',
        padding:      '28px 28px 24px',
        width:        '360px',
        boxShadow:    '0 24px 64px #000c',
        animation:    'modalSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
        fontFamily:   "'DM Sans','Segoe UI',sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {error ? '⚠️ Connection Error' : '📊 Pipeline Analysis'}
            </div>
            {!error && <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>Results from backend</div>}
          </div>
          <button onClick={onClose} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '16px',
            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            background: '#f4303014', border: '1px solid #f4303044',
            borderRadius: '10px', padding: '14px',
            color: '#f87171', fontSize: '13px', lineHeight: 1.6,
          }}>
            {error}
            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              Make sure the FastAPI server is running on port 8000.
            </div>
          </div>
        )}

        {/* Success state */}
        {result && !error && (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <StatCard label="Nodes" value={result.num_nodes} color="#3b82f6" />
              <StatCard label="Edges" value={result.num_edges} color="#8b5cf6" />
            </div>
            <div style={{
              background: isDAG ? '#10b98114' : '#f4303014',
              border: `1px solid ${isDAG ? '#10b98144' : '#f4303044'}`,
              borderRadius: '10px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span style={{ fontSize: '24px' }}>{isDAG ? '✅' : '❌'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: isDAG ? '#34d399' : '#f87171', marginBottom: '2px' }}>
                  {isDAG ? 'Valid DAG' : 'Cycle Detected'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {isDAG
                    ? 'Pipeline has no cycles — safe to execute.'
                    : 'Pipeline contains a loop — execution would be infinite.'}
                </div>
              </div>
            </div>
          </>
        )}

        <button onClick={onClose} style={{
          marginTop: '20px', width: '100%', padding: '10px',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          color: '#fff', border: 'none', borderRadius: '8px',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em',
        }}>
          Close  <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '6px' }}>Esc</span>
        </button>
      </div>
    </div>
  );
};

// ── Submit button ────────────────────────────────────────────────
export const SubmitButton = ({ externalTrigger = 0, onResult }) => {
  const { nodes, edges } = useStore(selector, shallow);
  const [loading,   setLoading]  = useState(false);
  const [result,    setResult]   = useState(null);
  const [error,     setError]    = useState(null);
  const [showModal, setModal]    = useState(false);
  const prevTrigger = useRef(0);

  // Fire submit when keyboard shortcut increments the trigger
  useEffect(() => {
    if (externalTrigger > 0 && externalTrigger !== prevTrigger.current) {
      prevTrigger.current = externalTrigger;
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTrigger]);

  const handleSubmit = async () => {
    if (nodes.length === 0) {
      toast.warning('Add at least one node before submitting.');
      return;
    }

    setLoading(true);
    let failedNodeId = null;
    try {
      const response = await fetch('http://localhost:8000/pipelines/parse', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nodes, edges }),
      });

      if (!response.ok) {
        let msg = `Server error ${response.status}`;
        try {
          const errBody = await response.json();
          failedNodeId = errBody?.failed_node_id ?? null;
          msg = errBody?.detail ?? errBody?.error ?? msg;
        } catch (_) { /* non-JSON error body */ }
        throw new Error(msg);
      }

      const data = await response.json();
      setResult(data);
      setError(null);
      onResult?.({ success: true, data });
    } catch (err) {
      setResult(null);
      setError(err.message);
      onResult?.({ success: false, error: err.message, failed_node_id: failedNodeId });
    } finally {
      setLoading(false);
      setModal(true);
    }
  };

  return (
    <>
      {showModal && (
        <ResultModal
          result={result}
          error={error}
          onClose={() => setModal(false)}
        />
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '6px', padding: '10px',
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding:    '9px 36px',
            background: loading ? 'var(--bg-hover)' : 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color:      '#fff',
            border:     'none',
            borderRadius: '8px',
            fontSize:   '14px',
            fontWeight: 700,
            fontFamily: "'DM Sans','Segoe UI',sans-serif",
            cursor:     loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.03em',
            transition: 'transform 0.1s, box-shadow 0.15s',
            boxShadow:  loading ? 'none' : '0 4px 16px #3b82f644',
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          {loading ? '⏳ Analysing...' : '⚡ Submit Pipeline'}
          {!loading && (
            <span style={{ opacity: 0.45, fontSize: '11px', marginLeft: '10px' }}>⌘↵</span>
          )}
        </button>
      </div>
    </>
  );
};