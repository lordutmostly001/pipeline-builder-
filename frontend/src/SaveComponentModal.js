// SaveComponentModal.js — Dialog to name and save a subgraph as a component

import { useState, useRef, useEffect } from 'react';

export const SaveComponentModal = ({ nodeIds, onSave, onCancel }) => {
  const [name, setName] = useState('My Component');
  const [desc, setDesc] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.select(), 30); }, []);

  return (
    <div style={{ position:'fixed',inset:0,background:'#000a',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999 }} onClick={onCancel}>
      <div onClick={(e)=>e.stopPropagation()} style={{ background:'var(--bg-modal)',border:'1px solid var(--border)',borderRadius:16,padding:'28px',width:360,boxShadow:'var(--shadow-panel)',fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ fontSize:15,fontWeight:800,color:'var(--text-primary)',marginBottom:4 }}>🧩 Save as Component</div>
        <div style={{ fontSize:12,color:'var(--text-dim)',marginBottom:20 }}>{nodeIds.length} nodes will be saved</div>

        <label style={{ fontSize:11,fontWeight:700,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6 }}>Name</label>
        <input
          ref={inputRef}
          value={name} onChange={(e)=>setName(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==='Enter'&&name.trim()) onSave(name.trim(), desc.trim()); if(e.key==='Escape') onCancel(); }}
          style={{ width:'100%',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text-primary)',fontSize:13,fontWeight:600,padding:'8px 12px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:14 }}
        />

        <label style={{ fontSize:11,fontWeight:700,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6 }}>Description (optional)</label>
        <textarea
          value={desc} onChange={(e)=>setDesc(e.target.value)} rows={2}
          placeholder="What does this component do?"
          style={{ width:'100%',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text-primary)',fontSize:12,padding:'8px 12px',outline:'none',fontFamily:'inherit',boxSizing:'border-box',resize:'none',lineHeight:1.5,marginBottom:20 }}
        />

        <div style={{ display:'flex',gap:10 }}>
          <button onClick={()=>name.trim()&&onSave(name.trim(),desc.trim())} disabled={!name.trim()} style={{ flex:1,padding:'9px',background:'#6366f1',border:'none',borderRadius:8,color:'#fff',fontSize:12,fontWeight:700,cursor:name.trim()?'pointer':'not-allowed',fontFamily:'inherit',opacity:name.trim()?1:0.5 }}>
            Save Component
          </button>
          <button onClick={onCancel} style={{ padding:'9px 18px',background:'var(--bg-hover)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text-secondary)',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};