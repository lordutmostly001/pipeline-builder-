// ComponentLibrary.js — Side panel for saved pipeline components
// Shows saved components, lets you drag them onto canvas, and manage them.

import { useState } from 'react';
import { useRef } from 'react';
import { useStore } from './store';
import { useClickOutside } from './useClickOutside';
import { loadComponents, saveComponents } from './componentStore';

const COLOR = '#64748b';

const TYPE_COLORS = {
  customInput:'#3b82f6',llm:'#8b5cf6',customOutput:'#10b981',text:'#f59e0b',
  filter:'#ec4899',merge:'#06b6d4',api:'#f97316',transform:'#a855f7',
  condition:'#f43f5e',timer:'#0ea5e9',
};

export const useComponents = () => {
  const [components, setComponents] = useState(() => loadComponents());

  const addComponent = (component) => {
    setComponents((prev) => {
      const next = [...prev, { ...component, id: `comp-${Date.now()}`, createdAt: Date.now() }];
      saveComponents(next);
      return next;
    });
  };

  const deleteComponent = (id) => {
    setComponents((prev) => { const next = prev.filter((c) => c.id !== id); saveComponents(next); return next; });
  };

  const renameComponent = (id, name) => {
    setComponents((prev) => { const next = prev.map((c) => c.id === id ? { ...c, name } : c); saveComponents(next); return next; });
  };

  return { components, addComponent, deleteComponent, renameComponent };
};

export const ComponentLibrary = ({ onClose, components, onDelete, onRename }) => {
  const ref = useRef(null);
  useClickOutside(ref, onClose);

  const addNode  = useStore((s) => s.addNode);
  const getNodeID = useStore((s) => s.getNodeID);

  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const filtered = components.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const placeComponent = (comp) => {
    const id = getNodeID('component');
    addNode({
      id,
      type: 'component',
      position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 100 },
      data: {
        componentId:   comp.id,
        componentName: comp.name,
        description:   comp.description || '',
        inputs:        comp.ports?.inputs  ?? [],
        outputs:       comp.ports?.outputs ?? [],
        nodeTypes:     comp.nodeTypes ?? [],
        // Store the internal graph for potential expansion
        internalNodes: comp.nodes,
        internalEdges: comp.edges,
      },
    });
    onClose();
  };

  return (
    <div ref={ref} style={{
      position: 'fixed', right: 16, top: 70,
      width: 300, maxHeight: 'calc(100vh - 140px)',
      background: 'var(--bg-modal)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: 'var(--shadow-panel)',
      fontFamily: "'DM Sans',sans-serif",
      display: 'flex', flexDirection: 'column',
      zIndex: 9900, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>🧩 Component Library</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{components.length} saved component{components.length !== 1 ? 's' : ''}</div>
        </div>
        <button onClick={onClose} style={{ background:'none',border:'none',color:'var(--text-dim)',cursor:'pointer',fontSize:16,padding:'2px 6px',borderRadius:4 }}>✕</button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components…"
          style={{ width:'100%', background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text-primary)',fontSize:12,padding:'6px 10px',outline:'none',boxSizing:'border-box',fontFamily:'inherit' }}
        />
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding: '8px 0' }}>
        {filtered.length === 0 ? (
          <div style={{ padding:'32px 20px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:10 }}>🧩</div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-dim)', marginBottom:6 }}>
              {search ? 'No matches' : 'No components yet'}
            </div>
            <div style={{ fontSize:11, color:'var(--text-hint)', lineHeight:1.6 }}>
              Select nodes on the canvas, then right-click → "Save as Component"
            </div>
          </div>
        ) : (
          filtered.map((comp) => (
            <div key={comp.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', gap:10 }}>
              {/* Icon */}
              <div style={{ width:34,height:34,borderRadius:9,background:`${COLOR}18`,border:`1px solid ${COLOR}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>
                🧩
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                {editId === comp.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => { onRename(comp.id, editName); setEditId(null); }}
                    onKeyDown={(e) => { if(e.key==='Enter'){onRename(comp.id,editName);setEditId(null);} if(e.key==='Escape')setEditId(null); }}
                    autoFocus
                    style={{ width:'100%',background:'var(--bg-input)',border:'1px solid #6366f166',borderRadius:4,color:'var(--text-primary)',fontSize:12,fontWeight:700,padding:'2px 6px',outline:'none',fontFamily:'inherit',boxSizing:'border-box' }}
                  />
                ) : (
                  <div
                    onDoubleClick={() => { setEditId(comp.id); setEditName(comp.name); }}
                    style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:3, overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}
                  >
                    {comp.name}
                  </div>
                )}

                {/* Node type dots */}
                <div style={{ display:'flex', gap:3, marginBottom:4 }}>
                  {(comp.nodeTypes ?? []).slice(0,8).map((t,i) => (
                    <span key={i} style={{ width:6,height:6,borderRadius:'50%',background:TYPE_COLORS[t]??COLOR,flexShrink:0 }} title={t} />
                  ))}
                  {(comp.nodeTypes??[]).length > 8 && <span style={{ fontSize:9,color:'var(--text-hint)' }}>+{comp.nodeTypes.length-8}</span>}
                </div>

                <div style={{ fontSize:10,color:'var(--text-hint)' }}>
                  {comp.ports?.inputs?.length??0}→{comp.ports?.outputs?.length??0} ports · {comp.nodes?.length??0} nodes
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                <button
                  onClick={() => placeComponent(comp)}
                  title="Place on canvas"
                  style={{ padding:'4px 10px',background:'#6366f1',border:'none',borderRadius:6,color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}
                >
                  + Place
                </button>
                <button
                  onClick={() => onDelete(comp.id)}
                  title="Delete component"
                  style={{ padding:'4px 10px',background:'none',border:'1px solid var(--border)',borderRadius:6,color:'var(--text-hint)',fontSize:10,cursor:'pointer',fontFamily:'inherit' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};