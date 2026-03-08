// BookmarkPanel.js — Canvas viewport bookmarks

import { useState, useRef } from 'react';
import { useClickOutside } from './useClickOutside';
import { useStore } from './store';
import { shallow }  from 'zustand/shallow';
import { useReactFlow } from 'reactflow';

const selector = (s) => ({ bookmarks: s.bookmarks, addBookmark: s.addBookmark, deleteBookmark: s.deleteBookmark });

export const BookmarkPanel = ({ onClose }) => {
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);
  const { bookmarks, addBookmark, deleteBookmark } = useStore(selector, shallow);
  const { getViewport, setViewport } = useReactFlow();
  const [name, setName] = useState('');

  const handleSave = () => {
    const { x, y, zoom } = getViewport();
    addBookmark({ name: name.trim() || `View ${bookmarks.length + 1}`, x, y, zoom });
    setName('');
  };

  return (
    <div ref={panelRef} style={{
      position:'fixed', top:'60px', right:'14px', zIndex:9000,
      width:'240px', background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:'12px', padding:'14px', fontFamily:"'DM Sans',sans-serif",
      boxShadow:'0 12px 40px #0008',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <span style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)' }}>🔖 Bookmarks</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'16px' }}>×</button>
      </div>

      <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          placeholder="Bookmark name…"
          style={{ flex:1, background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'7px', padding:'6px 10px', fontSize:'11px', color:'var(--text-primary)', outline:'none', fontFamily:'inherit' }}
        />
        <button onClick={handleSave} style={{ background:'#f59e0b', border:'none', borderRadius:'7px', color:'#000', fontSize:'11px', fontWeight:700, padding:'6px 10px', cursor:'pointer', fontFamily:'inherit' }}>
          Save
        </button>
      </div>

      {bookmarks.length === 0 ? (
        <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'12px 0' }}>No bookmarks yet — pan to a spot and save</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
          {bookmarks.map((b) => (
            <div key={b.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 10px', background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'8px' }}>
              <span style={{ fontSize:'12px' }}>📍</span>
              <span style={{ flex:1, fontSize:'12px', fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.name}</span>
              <button onClick={() => setViewport({ x: b.x, y: b.y, zoom: b.zoom }, { duration: 500 })} style={{ background:'#f59e0b22', border:'1px solid #f59e0b44', borderRadius:'5px', color:'#f59e0b', fontSize:'10px', fontWeight:700, padding:'2px 8px', cursor:'pointer', fontFamily:'inherit' }}>Go</button>
              <button onClick={() => deleteBookmark(b.id)} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'13px' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};