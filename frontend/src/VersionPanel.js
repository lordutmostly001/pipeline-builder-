// VersionPanel.js — Save/load named pipeline versions

import { useState, useRef, useEffect } from 'react';
import { useClickOutside } from './useClickOutside';
import { useStore } from './store';
import { shallow }  from 'zustand/shallow';

const selector = (s) => ({
  versions:      s.versions,
  saveVersion:   s.saveVersion,
  loadVersion:   s.loadVersion,
  deleteVersion: s.deleteVersion,
});

const fmt = (ts) => new Date(ts).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

export const VersionPanel = ({ onClose, onDiff }) => {
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);

  const { versions, saveVersion, loadVersion, deleteVersion } = useStore(selector, shallow);
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div ref={panelRef} style={{
      position:'fixed', top:'60px', right:'14px', zIndex:9000,
      width:'260px', background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:'12px', padding:'14px', fontFamily:"'DM Sans',sans-serif",
      boxShadow:'0 12px 40px #0008',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <span style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)' }}>🕐 Versions</span>
        <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
          {onDiff && versions.length >= 1 && (
            <button onClick={onDiff} title="Compare versions" style={{ background:'#6366f118', border:'1px solid #6366f133', borderRadius:'5px', color:'#818cf8', cursor:'pointer', fontSize:'10px', fontWeight:700, padding:'2px 8px', fontFamily:"'DM Sans',sans-serif" }}>
              ⚖️ Diff
            </button>
          )}
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'16px', padding:'0 2px' }}>×</button>
        </div>
      </div>

      {/* Save new version */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { saveVersion(name.trim()); setName(''); } }}
          placeholder={`v${versions.length + 1} — name this version`}
          style={{ flex:1, background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'7px', padding:'6px 10px', fontSize:'11px', color:'var(--text-primary)', outline:'none', fontFamily:'inherit' }}
        />
        <button
          onClick={() => { if (name.trim()) { saveVersion(name.trim()); setName(''); } else saveVersion(''); }}
          style={{ background:'#3b82f6', border:'none', borderRadius:'7px', color:'#fff', fontSize:'11px', fontWeight:700, padding:'6px 10px', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}
        >
          Save
        </button>
      </div>

      {/* Version list */}
      {versions.length === 0 ? (
        <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'16px 0' }}>No saved versions yet</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'300px', overflowY:'auto' }}>
          {[...versions].reverse().map((v) => (
            <div key={v.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 10px', background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'8px' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.name}</div>
                <div style={{ fontSize:'9px', color:'var(--text-dim)', marginTop:'1px' }}>{fmt(v.timestamp)} · {v.nodes.length}n {v.edges.length}e</div>
              </div>
              <button onClick={() => { loadVersion(v.id); onClose(); }} style={{ background:'#3b82f611', border:'1px solid #3b82f633', borderRadius:'5px', color:'#60a5fa', fontSize:'10px', fontWeight:700, padding:'3px 8px', cursor:'pointer', fontFamily:'inherit' }}>Load</button>
              <button onClick={() => deleteVersion(v.id)} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'13px', padding:'0 2px' }} title="Delete">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};