// toolbar.js

import { useRef, useState, useEffect } from 'react';
import { useReactFlow }     from 'reactflow';
import { DraggableNode }    from './draggableNode';
import { useStore }         from './store';
import { shallow }          from 'zustand/shallow';
import { ConfirmBanner }    from './ConfirmBanner';
import { NotificationDrawer } from './NotificationDrawer';
import { toast }            from './Toast';

const NODE_DEFS = [
  { type: 'customInput',  label: 'Input',     icon: '📥', color: '#3b82f6' },
  { type: 'llm',          label: 'LLM',       icon: '🤖', color: '#8b5cf6' },
  { type: 'customOutput', label: 'Output',    icon: '📤', color: '#10b981' },
  { type: 'text',         label: 'Text',      icon: '📝', color: '#f59e0b' },
  { type: 'filter',       label: 'Filter',    icon: '🔍', color: '#ec4899' },
  { type: 'merge',        label: 'Merge',     icon: '🔗', color: '#06b6d4' },
  { type: 'api',          label: 'API Call',  icon: '🌐', color: '#f97316' },
  { type: 'transform',    label: 'Transform', icon: '⚙️', color: '#a855f7' },
  { type: 'condition',    label: 'Condition', icon: '🔀', color: '#f43f5e' },
  { type: 'timer',        label: 'Timer',     icon: '⏱️', color: '#0ea5e9' },
  { type: 'note',         label: 'Note',      icon: '📌', color: '#fbbf24' },
];

const selector = (s) => ({
  nodeCount:      s.nodes.length,
  edgeCount:      s.edges.length,
  clearCanvas:    s.clearCanvas,
  exportJSON:     s.exportJSON,
  exportYAML:     s.exportYAML,
  exportGraphviz: s.exportGraphviz,
  exportImage:    s.exportImage,
  autoLayout:     s.autoLayout,
  importJSON:     s.importJSON,
  toggleTheme:    s.toggleTheme,
  theme:          s.theme,
});

// ── Export Dropdown ───────────────────────────────────────────────
const ExportDropdown = ({ exportJSON, exportYAML, exportGraphviz, exportImage, importJSON, nodeCount }) => {
  const [open, setOpen]  = useState(false);
  const ref              = useRef(null);
  const fileInputRef     = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  const items = [
    { icon:'⬇️', label:'Export JSON',     sub:'Full pipeline state',  action: () => { exportJSON();     toast.success('Exported pipeline.json');  setOpen(false); } },
    { icon:'📄', label:'Export YAML',     sub:'Human-readable format', action: () => { exportYAML();     toast.success('Exported pipeline.yaml');  setOpen(false); } },
    { icon:'🕸',  label:'Export Graphviz', sub:'.dot graph format',    action: () => { exportGraphviz(); toast.success('Exported pipeline.dot');   setOpen(false); } },
    { icon:'🖼',  label:'Export PNG',      sub:'Canvas as image',      action: () => { exportImage();                                              setOpen(false); } },
    { divider: true },
    { icon:'⬆️', label:'Import JSON',     sub:'Load a saved pipeline', action: () => { fileInputRef.current?.click(); setOpen(false); } },
  ];

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Export / Import"
        style={{
          display:'flex', alignItems:'center', gap:'5px',
          background: open ? 'var(--bg-hover)' : 'transparent',
          border:'1px solid var(--border)', borderRadius:'7px',
          color:'var(--text-dim)', cursor:'pointer',
          fontSize:'12px', fontWeight:700,
          padding:'0 10px', height:'30px',
          fontFamily:"'DM Sans',sans-serif",
          transition:'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? 'var(--bg-hover)' : 'transparent'; }}
      >
        <span>⬇️</span>
        <span style={{ fontSize:'10px' }}>Export</span>
        <span style={{ fontSize:'9px', opacity:0.6, marginLeft:'1px', transform: open ? 'rotate(180deg)' : 'none', display:'inline-block', transition:'transform 0.2s' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'36px', right:0, zIndex:9999,
          background:'var(--bg-card)', border:'1px solid var(--border)',
          borderRadius:'10px', padding:'4px', minWidth:'200px',
          boxShadow:'0 8px 32px #0008', fontFamily:"'DM Sans',sans-serif",
        }}>
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} style={{ height:'1px', background:'var(--border)', margin:'4px 0' }} />
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display:'flex', alignItems:'center', gap:'10px',
                  width:'100%', padding:'8px 12px',
                  background:'transparent', border:'none', borderRadius:'7px',
                  color:'var(--text-primary)', cursor:'pointer',
                  fontFamily:'inherit', textAlign:'left',
                }}
              >
                <span style={{ fontSize:'14px', width:'20px', textAlign:'center' }}>{item.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', fontWeight:600 }}>{item.label}</div>
                  <div style={{ fontSize:'9px', color:'var(--text-dim)' }}>{item.sub}</div>
                </div>
              </button>
            )
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".json" style={{ display:'none' }}
        onChange={(e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => { importJSON(ev.target.result); toast.success(`Imported "${file.name}"`); };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

export const PipelineToolbar = ({ onToggleHelp, onToggleTemplates, onExecPreview, onPreflight, onNodeSearch, onToggleVersions, onToggleBookmarks, onToggleAI, onToggleShare, onToggleExplainer, onToggleComponents, showAI }) => {
  const { nodeCount, edgeCount, clearCanvas, exportJSON, exportYAML, exportGraphviz, exportImage, importJSON, toggleTheme, theme, autoLayout } = useStore(selector, shallow);
  const { fitView } = useReactFlow();
  const [confirmClear, setConfirmClear] = useState(false);
  const isDark = theme === 'dark';

  const IconBtn = ({ onClick, title, children, danger, disabled, active }) => (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        background: active ? 'var(--bg-hover)' : 'transparent',
        border:'1px solid var(--border)', borderRadius:'7px',
        color: disabled ? 'var(--text-hint)' : danger ? '#f87171' : 'var(--text-dim)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize:'13px', fontWeight:700, width:'30px', height:'30px',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:"'DM Sans',sans-serif", transition:'color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = danger ? '#f8717122' : 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'var(--bg-hover)' : 'transparent'; }}
    >{children}</button>
  );

  return (
    <div style={{ background:'var(--bg-toolbar)', borderBottom:'1px solid var(--border)', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ padding:'8px 16px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>

        {/* Brand */}
        <div style={{ color:'var(--text-primary)', fontWeight:800, fontSize:'15px', whiteSpace:'nowrap' }}>⚡ Pipeline</div>
        <div style={{ width:'1px', height:'30px', background:'var(--border)' }} />

        {/* Node palette */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', flex:1 }}>
          {NODE_DEFS.map((n) => <DraggableNode key={n.type} {...n} />)}
        </div>

        <div style={{ width:'1px', height:'30px', background:'var(--border)' }} />

        {/* Live counter */}
        <div style={{ display:'flex', gap:'10px', alignItems:'center', whiteSpace:'nowrap', fontSize:'12px', fontWeight:600 }}>
          <span style={{ color:'#3b82f6' }}><span style={{ color:'var(--text-dim)', marginRight:'4px' }}>Nodes</span>{nodeCount}</span>
          <span style={{ color:'var(--border)' }}>|</span>
          <span style={{ color:'#8b5cf6' }}><span style={{ color:'var(--text-dim)', marginRight:'4px' }}>Edges</span>{edgeCount}</span>
        </div>

        <div style={{ width:'1px', height:'30px', background:'var(--border)' }} />

        {/* Actions */}
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          <IconBtn onClick={onToggleTemplates}                                             title="Templates">🗂</IconBtn>
          <IconBtn onClick={() => { autoLayout(); setTimeout(() => fitView({ padding:0.18, duration:500 }), 80); toast.success('Layout applied ✨'); }} title="Auto layout (Ctrl+L)" disabled={nodeCount===0}>⊞</IconBtn>
          <IconBtn onClick={onNodeSearch}      title="Search nodes (Ctrl+F)">🔎</IconBtn>
          <IconBtn onClick={onExecPreview}     title="Execution preview">▶</IconBtn>
          <IconBtn onClick={onToggleVersions}  title="Pipeline versions">🕐</IconBtn>
          <IconBtn onClick={onToggleBookmarks} title="Canvas bookmarks">🔖</IconBtn>

          {/* AI buttons */}
          <div style={{ display:'flex', gap:'4px', padding:'0 4px', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)' }}>
            <IconBtn onClick={onToggleAI} title="AI Pipeline Assistant (Ctrl+I)" active={showAI}>🤖</IconBtn>
            <IconBtn onClick={onToggleExplainer} title="Pipeline Explainer">🔮</IconBtn>
            <IconBtn onClick={onPreflight} title="Pre-flight Check">🚀</IconBtn>
            <IconBtn onClick={onToggleComponents} title="Component Library">🧩</IconBtn>
            <IconBtn onClick={onToggleShare} title="Share Pipeline">🔗</IconBtn>
          </div>

          {/* Export dropdown */}
          <ExportDropdown
            exportJSON={exportJSON} exportYAML={exportYAML}
            exportGraphviz={exportGraphviz} exportImage={exportImage}
            importJSON={importJSON} nodeCount={nodeCount}
          />

          <IconBtn onClick={toggleTheme}         title="Toggle theme">{isDark ? '☀️' : '🌙'}</IconBtn>
          <NotificationDrawer />
          <IconBtn onClick={onToggleHelp}        title="Shortcuts (?)">?</IconBtn>
          <IconBtn onClick={() => { if (nodeCount>0) setConfirmClear(true); }} title="Clear canvas" danger disabled={nodeCount===0}>🗑</IconBtn>
        </div>
      </div>

      {confirmClear && (
        <div style={{ padding:'0 16px 10px' }}>
          <ConfirmBanner
            message="This will remove all nodes and edges."
            onConfirm={() => { clearCanvas(); setConfirmClear(false); toast.success('Canvas cleared.'); }}
            onCancel={() => setConfirmClear(false)}
          />
        </div>
      )}
    </div>
  );
};