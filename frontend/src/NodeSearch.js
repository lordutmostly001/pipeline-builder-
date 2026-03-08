// NodeSearch.js — Ctrl+F node search with jump-to

import { useState, useEffect, useRef, useMemo } from 'react';
import { useReactFlow }                          from 'reactflow';
import { useStore }                              from './store';

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

export const NodeSearch = ({ onClose }) => {
  const nodes         = useStore((s) => s.nodes);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const [query, setQuery] = useState('');
  const inputRef          = useRef(null);
  const { setCenter }     = useReactFlow();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const base = nodes.filter((n) => n.type !== 'note');
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((n) => {
      const label = (NODE_LABELS[n.type] ?? n.type).toLowerCase();
      const id    = n.id.toLowerCase();
      const text  = (n.data?.text ?? n.data?.inputName ?? n.data?.outputName ?? '').toLowerCase();
      return label.includes(q) || id.includes(q) || text.includes(q);
    });
  }, [query, nodes]);

  const jumpTo = (node) => {
    setCenter(node.position.x + 120, node.position.y + 60, { duration: 500, zoom: 1.2 });
    onNodesChange([{ type: 'select', id: node.id, selected: true }]);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', zIndex: 9997, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '120px' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '380px', background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: 'var(--shadow-panel)', fontFamily: "'DM Sans',sans-serif" }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '14px' }}>🔎</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && results.length) jumpTo(results[0]);
            }}
            placeholder="Search nodes by type or name..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit' }}
          />
          <kbd style={{ fontSize: '10px', color: 'var(--text-dim)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 5px' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-hint)', fontSize: '12px' }}>No nodes found</div>
          ) : (
            results.map((node) => (
              <div
                key={node.id}
                onClick={() => jumpTo(node)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '16px' }}>{NODE_ICONS[node.type] ?? '📦'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {NODE_LABELS[node.type] ?? node.type}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {node.id}
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-hint)' }}>↵ jump</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-hint)', display: 'flex', gap: '12px' }}>
          <span><kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 4px' }}>↵</kbd> jump to first</span>
          <span><kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 4px' }}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};