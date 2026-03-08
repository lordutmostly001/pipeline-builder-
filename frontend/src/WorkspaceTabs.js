// WorkspaceTabs.js — Multi-pipeline tab bar
// Sits between the toolbar and the canvas. Each tab is a pipeline workspace.

import { useState, useRef } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';

const selector = (s) => ({
  workspaces:       s.workspaces,
  activeId:         s.activeId,
  switchWorkspace:  s.switchWorkspace,
  createWorkspace:  s.createWorkspace,
  renameWorkspace:  s.renameWorkspace,
  deleteWorkspace:  s.deleteWorkspace,
  duplicateWorkspace: s.duplicateWorkspace,
  nodes:            s.nodes,
  edges:            s.edges,
});

export const WorkspaceTabs = () => {
  const {
    workspaces, activeId, switchWorkspace, createWorkspace,
    renameWorkspace, deleteWorkspace, duplicateWorkspace,
  } = useStore(selector, shallow);

  const [editingId,  setEditingId]  = useState(null);
  const [editName,   setEditName]   = useState('');
  const [contextId,  setContextId]  = useState(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef(null);

  const startRename = (ws, e) => {
    e.stopPropagation();
    setEditingId(ws.id);
    setEditName(ws.name);
    setTimeout(() => inputRef.current?.select(), 20);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) renameWorkspace(editingId, editName.trim());
    setEditingId(null);
  };

  const openContext = (ws, e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextId(ws.id);
    setContextPos({ x: e.clientX, y: e.clientY });
  };

  const closeContext = () => setContextId(null);

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--bg-toolbar)', borderBottom: '1px solid var(--border)',
        height: 34, overflowX: 'auto', overflowY: 'hidden',
        scrollbarWidth: 'none',
        fontFamily: "'DM Sans',sans-serif",
        position: 'relative',
        flexShrink: 0,
      }}>
        <style>{`
          .ws-tabs::-webkit-scrollbar { display: none; }
          .ws-tab { transition: background 0.15s, color 0.15s; }
          .ws-tab:hover { background: var(--bg-hover) !important; }
        `}</style>

        <div className="ws-tabs" style={{ display: 'flex', alignItems: 'stretch', flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          {workspaces.map((ws, i) => {
            const isActive = ws.id === activeId;
            const isEditing = editingId === ws.id;

            return (
              <div
                key={ws.id}
                className="ws-tab"
                onClick={() => !isActive && switchWorkspace(ws.id)}
                onContextMenu={(e) => openContext(ws, e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 12px 0 14px',
                  borderRight: '1px solid var(--border)',
                  background: isActive ? 'var(--bg-app)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                  cursor: isActive ? 'default' : 'pointer',
                  position: 'relative',
                  minWidth: 100, maxWidth: 180,
                  userSelect: 'none',
                  flexShrink: 0,
                  borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {/* Active indicator dot */}
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: isActive ? '#6366f1' : 'var(--text-hint)',
                  boxShadow: isActive ? '0 0 6px #6366f1' : 'none',
                  transition: 'all 0.2s',
                }} />

                {/* Name (editable on double-click) */}
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1, background: 'var(--bg-input)', border: '1px solid #6366f166',
                      borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
                      padding: '1px 6px', outline: 'none', fontFamily: 'inherit', minWidth: 0,
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startRename(ws, e)}
                    style={{
                      fontSize: 11, fontWeight: isActive ? 700 : 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}
                  >
                    {ws.name}
                  </span>
                )}

                {/* Node count badge */}
                {ws.nodes?.length > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: isActive ? '#6366f199' : 'var(--text-hint)',
                    background: isActive ? '#6366f111' : 'transparent',
                    padding: '1px 5px', borderRadius: 8, flexShrink: 0,
                  }}>
                    {ws.nodes.length}
                  </span>
                )}

                {/* Close button (only if >1 workspace) */}
                {workspaces.length > 1 && !isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); }}
                    title="Close pipeline"
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-hint)',
                      cursor: 'pointer', fontSize: 12, padding: '0 0 0 2px', lineHeight: 1,
                      flexShrink: 0, opacity: 0, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* New tab button */}
          <button
            onClick={() => createWorkspace()}
            title="New pipeline (Ctrl+T)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 14px', background: 'none', border: 'none',
              color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16,
              borderRight: '1px solid var(--border)', flexShrink: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            +
          </button>
        </div>
      </div>

      {/* Context menu */}
      {contextId && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={closeContext} />
          <div style={{
            position: 'fixed', left: contextPos.x, top: contextPos.y,
            background: 'var(--bg-modal)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow-panel)',
            zIndex: 9999, padding: '4px 0', minWidth: 170,
            fontFamily: "'DM Sans',sans-serif",
          }}>
            {[
              { label: '✏ Rename',    action: () => { const ws = workspaces.find((w) => w.id === contextId); if (ws) { setEditingId(ws.id); setEditName(ws.name); } } },
              { label: '⎘ Duplicate', action: () => duplicateWorkspace(contextId) },
              null,
              { label: '🗑 Delete',   action: () => deleteWorkspace(contextId), danger: true },
            ].map((item, i) => item === null ? (
              <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            ) : (
              <button
                key={i}
                onClick={() => { item.action(); closeContext(); }}
                style={{
                  width: '100%', display: 'block', padding: '7px 14px',
                  background: 'none', border: 'none', textAlign: 'left',
                  color: item.danger ? '#f87171' : 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};