// NodeComment.js — Comment bubble anchored inside the node via absolute positioning.
// Rendered as a child of BaseNode so it follows the node automatically with pan/zoom.

import { useState, useRef, useEffect } from 'react';
import { useStore } from './store';

// Bubble rendered to the right of the node, anchored at top-right corner
export const NodeCommentBubble = ({ nodeId, onDelete }) => {
  const comment       = useStore((s) => s.comments?.[nodeId] ?? '');
  const setComment    = useStore((s) => s.setComment);
  const deleteComment = useStore((s) => s.deleteComment);
  const [editing, setEditing] = useState(!comment);
  const [draft,   setDraft]   = useState(comment);
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = () => {
    if (draft.trim()) { setComment(nodeId, draft.trim()); setEditing(false); }
    else              { deleteComment(nodeId); onDelete?.(); }
  };

  const handleDelete = () => { deleteComment(nodeId); onDelete?.(); };

  return (
    <div
      style={{
        position: 'absolute',
        left: 'calc(100% + 14px)',
        top: '8px',
        zIndex: 20,
        pointerEvents: 'all',
        fontFamily: "'DM Sans',sans-serif",
      }}
      // Prevent clicks inside bubble from propagating to the node (drag, select, etc.)
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Tail pointing left */}
      <div style={{
        position: 'absolute', left: '-8px', top: '14px',
        width: 0, height: 0,
        borderTop: '6px solid transparent',
        borderBottom: '6px solid transparent',
        borderRight: '8px solid var(--bg-hover)',
      }} />

      <div style={{
        background: 'var(--bg-hover)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '8px 10px',
        minWidth: '140px',
        maxWidth: '200px',
        boxShadow: 'var(--shadow-panel)',
        position: 'relative',
      }}>
        {editing ? (
          <>
            <textarea
              ref={ref}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              rows={3}
              placeholder="Add a comment…"
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '11px', color: 'var(--text-primary)', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', marginTop: '4px' }}>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-dim)', fontSize: '9px', padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={save}                   style={{ background: '#3b82f6', border: 'none', borderRadius: '5px', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{comment}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', marginTop: '5px' }}>
              <button onClick={() => { setDraft(comment); setEditing(true); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-dim)', fontSize: '9px', padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
              <button onClick={handleDelete} style={{ background: 'none', border: '1px solid #f43f5e44', borderRadius: '5px', color: '#f43f5e', fontSize: '9px', padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// "Add comment" button shown on selected node — also anchored inside node
export const AddCommentBtn = ({ nodeId, onAdd }) => {
  return (
    <div
      style={{ position: 'absolute', left: 'calc(100% + 14px)', top: '8px', zIndex: 20, pointerEvents: 'all' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={onAdd}
        title="Add comment"
        style={{
          background: 'var(--bg-hover)', border: '1px solid var(--border)',
          borderRadius: '20px', color: '#60a5fa', fontSize: '11px',
          padding: '3px 10px', cursor: 'pointer',
          fontFamily: "'DM Sans',sans-serif",
          boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap',
        }}
      >
        💬 Add comment
      </button>
    </div>
  );
};