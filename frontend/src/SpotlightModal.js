// SpotlightModal.js — Ctrl+K command palette
// Built manually (no cmdk dependency) for full control over
// keyboard navigation and node-adding behavior.

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence }                  from 'framer-motion';
import { useStore }                                 from './store';
import { useReactFlow }                             from 'reactflow';
import { toast } from './NotificationStore';

const NODE_DEFS = [
  { type:'customInput',  label:'Input',     icon:'📥', color:'#3b82f6', desc:'Pipeline entry point' },
  { type:'llm',          label:'LLM',       icon:'🤖', color:'#8b5cf6', desc:'Language model node' },
  { type:'customOutput', label:'Output',    icon:'📤', color:'#10b981', desc:'Pipeline exit point' },
  { type:'text',         label:'Text',      icon:'📝', color:'#f59e0b', desc:'Text with {{variables}}' },
  { type:'filter',       label:'Filter',    icon:'🔍', color:'#ec4899', desc:'Filter data by condition' },
  { type:'merge',        label:'Merge',     icon:'🔗', color:'#06b6d4', desc:'Combine multiple inputs' },
  { type:'api',          label:'API Call',  icon:'🌐', color:'#f97316', desc:'HTTP request node' },
  { type:'transform',    label:'Transform', icon:'⚙️', color:'#a855f7', desc:'Convert between formats' },
  { type:'condition',    label:'Condition', icon:'🔀', color:'#f43f5e', desc:'If/else branching' },
  { type:'timer',        label:'Timer',     icon:'⏱️', color:'#0ea5e9', desc:'Delay or schedule' },
  { type:'note',         label:'Note',      icon:'📌', color:'#fbbf24', desc:'Annotation / comment' },
];

const ACTIONS = [
  { label:'Fit view',     icon:'🎯', desc:'Zoom to fit all nodes',    id:'fit'   },
  { label:'Export JSON',  icon:'⬇️', desc:'Download pipeline file',   id:'export'},
  { label:'Toggle theme', icon:'🎨', desc:'Switch dark / light mode', id:'theme' },
  { label:'Clear canvas', icon:'🗑', desc:'Remove all nodes & edges', id:'clear' },
];

export const SpotlightModal = ({ onClose }) => {
  const [query,  setQuery]  = useState('');
  const [active, setActive] = useState(0);
  const inputRef            = useRef(null);
  const listRef             = useRef(null);

  const addNode    = useStore((s) => s.addNode);
  const getNodeID  = useStore((s) => s.getNodeID);
  const clearCanvas = useStore((s) => s.clearCanvas);
  const exportJSON  = useStore((s) => s.exportJSON);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const { fitView, project } = useReactFlow();

  // Build flat filtered list
  const q = query.toLowerCase();
  const filteredNodes = NODE_DEFS.filter(
    (n) => n.label.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q)
  );
  const filteredActions = ACTIONS.filter(
    (a) => a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
  );
  const allItems = [
    ...filteredNodes.map((n) => ({ ...n, kind: 'node' })),
    ...filteredActions.map((a) => ({ ...a, kind: 'action' })),
  ];

  // Reset active when query changes
  useEffect(() => { setActive(0); }, [query]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runItem = useCallback((item) => {
    if (item.kind === 'node') {
      const nodeID   = getNodeID(item.type);
      const position = project({ x: window.innerWidth / 2 - 130, y: window.innerHeight / 2 - 70 });
      addNode({ id: nodeID, type: item.type, position, data: { id: nodeID, nodeType: item.type } });
      toast.success(`Added ${item.label} node`);
      onClose();
    } else {
      if (item.id === 'fit')    { fitView({ padding: 0.15, duration: 400 }); onClose(); }
      if (item.id === 'export') { exportJSON(); onClose(); }
      if (item.id === 'theme')  { toggleTheme(); onClose(); }
      if (item.id === 'clear')  { clearCanvas(); toast.success('Canvas cleared'); onClose(); }
    }
  }, [addNode, getNodeID, project, fitView, exportJSON, toggleTheme, clearCanvas, onClose]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, allItems.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (allItems[active]) runItem(allItems[active]); }
    if (e.key === 'Escape')    { onClose(); }
  };

  const ItemRow = ({ item, index }) => {
    const isActive = index === active;
    return (
      <div
        data-index={index}
        onClick={() => runItem(item)}
        onMouseEnter={() => setActive(index)}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         '12px',
          padding:     '9px 14px',
          cursor:      'pointer',
          borderRadius:'7px',
          background:  isActive ? '#1e2d45' : 'transparent',
          borderLeft:  isActive ? `3px solid ${item.color ?? '#60a5fa'}` : '3px solid transparent',
          transition:  'background 0.1s',
        }}
      >
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#ccd6f6' }}>{item.label}</div>
          <div style={{ fontSize: '11px', color: '#4a5878' }}>{item.desc}</div>
        </div>
        {item.color && (
          <div style={{ fontSize: '10px', fontWeight: 700, color: item.color, background: `${item.color}18`, border: `1px solid ${item.color}33`, borderRadius: '4px', padding: '2px 7px', flexShrink: 0 }}>
            {isActive ? '↵' : 'node'}
          </div>
        )}
      </div>
    );
  };

  const GroupLabel = ({ label }) => (
    <div style={{ fontSize: '9px', fontWeight: 700, color: '#4a5878', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '8px 14px 4px' }}>
      {label}
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: '#000c', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh', zIndex: 9999 }}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: -16 }}
          animate={{ scale: 1,    opacity: 1, y: 0    }}
          exit={{    scale: 0.94, opacity: 0, y: -16  }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          style={{ width: '460px', background: '#111827', border: '1px solid #2a3a55', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 32px 80px #000e', fontFamily: "'DM Sans',sans-serif" }}
        >
          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1e2d45', gap: '10px' }}>
            <span style={{ fontSize: '15px', opacity: 0.4 }}>⌘</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search nodes or actions..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#ccd6f6', fontSize: '14px', fontFamily: 'inherit' }}
            />
            <kbd style={{ background: '#0d1221', border: '1px solid #2a3a55', borderRadius: '5px', padding: '2px 7px', fontSize: '10px', color: '#4a5878' }}>Esc</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} style={{ maxHeight: '360px', overflowY: 'auto', padding: '6px' }}>
            {allItems.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#2a3a55', fontSize: '13px' }}>
                No results for "{query}"
              </div>
            )}
            {filteredNodes.length > 0 && (
              <>
                <GroupLabel label="Add Node" />
                {filteredNodes.map((n, i) => <ItemRow key={n.type} item={{ ...n, kind: 'node' }} index={i} />)}
              </>
            )}
            {filteredActions.length > 0 && (
              <>
                <GroupLabel label="Actions" />
                {filteredActions.map((a, i) => <ItemRow key={a.id} item={{ ...a, kind: 'action' }} index={filteredNodes.length + i} />)}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid #1e2d45', display: 'flex', gap: '14px' }}>
            {[['↑↓', 'navigate'], ['↵', 'select'], ['Esc', 'close']].map(([k, v]) => (
              <span key={k} style={{ fontSize: '10px', color: '#2a3a55' }}>
                <kbd style={{ background: '#0d1221', border: '1px solid #1e2d45', borderRadius: '4px', padding: '1px 5px', marginRight: '4px', fontSize: '10px', color: '#4a5878' }}>{k}</kbd>
                {v}
              </span>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};