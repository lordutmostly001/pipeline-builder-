// EdgeContextMenu.js — Right-click context menu for edges

import { useEffect, useRef } from 'react';
import { useStore }          from './store';

export const EdgeContextMenu = ({ edgeId, x, y, onClose }) => {
  const ref           = useRef(null);
  const edges         = useStore((s) => s.edges);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const updateEdge    = useStore((s) => s.updateEdge);

  const edge = edges.find((e) => e.id === edgeId);

  useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key   = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', click);
    window.addEventListener('keydown',   key);
    return () => {
      window.removeEventListener('mousedown', click);
      window.removeEventListener('keydown',   key);
    };
  }, [onClose]);

  if (!edge) return null;

  const menuW = 190;
  const cx = Math.min(x, window.innerWidth  - menuW - 8);
  const cy = Math.min(y, window.innerHeight - 200  - 8);

  const isStraight = edge.type === 'straight';

  const actions = [
    {
      icon: isStraight ? '〰️' : '📐',
      label: isStraight ? 'Curved edge' : 'Straight edge',
      action: () => {
        updateEdge(edgeId, { type: isStraight ? 'default' : 'straight' });
        onClose();
      },
    },
    {
      icon: '📋',
      label: 'Copy connection',
      action: () => {
        navigator.clipboard?.writeText(`${edge.source} → ${edge.target}`).catch(() => {});
        onClose();
      },
    },
    { divider: true },
    {
      icon: '🗑',
      label: 'Delete edge',
      danger: true,
      action: () => {
        onEdgesChange([{ type: 'remove', id: edgeId }]);
        onClose();
      },
    },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: cx, top: cy, zIndex: 99999,
        background: 'var(--bg-modal)',
        border: '1px solid var(--border)', borderRadius: '10px',
        padding: '4px', minWidth: `${menuW}px`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
      }}
    >
      <div style={{ padding: '6px 12px 4px', fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Edge · {edge.source} → {edge.target}
      </div>
      <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0 4px' }} />

      {actions.map((a, i) =>
        a.divider ? (
          <div key={i} style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
        ) : (
          <button
            key={a.label}
            onClick={a.action}
            onMouseEnter={(e) => { e.currentTarget.style.background = a.danger ? '#f43f5e18' : 'var(--border)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '8px 12px',
              background: 'transparent', border: 'none', borderRadius: '7px',
              color: a.danger ? '#f87171' : 'var(--text-primary)',
              cursor: 'pointer', fontSize: '13px',
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{a.icon}</span>
            {a.label}
          </button>
        )
      )}
    </div>
  );
};