// PipelineShare.js — Serialize pipeline into a shareable URL (no backend)

import { useState, useRef } from 'react';
import { useClickOutside } from './useClickOutside';
import { useStore } from './store';
import { shallow }  from 'zustand/shallow';
import { toast }    from './Toast';

const compress = (obj) => {
  try {
    const json    = JSON.stringify(obj);
    const encoded = btoa(encodeURIComponent(json));
    return encoded;
  } catch { return null; }
};

const decompress = (str) => {
  try { return JSON.parse(decodeURIComponent(atob(str))); }
  catch { return null; }
};

export const usePipelineShare = () => {
  const { nodes, edges } = useStore((s) => ({ nodes: s.nodes, edges: s.edges }), shallow);
  const importJSON       = useStore((s) => s.importJSON);

  // Generate share URL
  const getShareURL = () => {
    const data = compress({ nodes, edges });
    if (!data) { toast.error('Failed to encode pipeline'); return null; }
    const url = `${window.location.origin}${window.location.pathname}?pipeline=${data}`;
    return url;
  };

  const copyShareURL = () => {
    const url = getShareURL();
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      toast.success('Share link copied to clipboard!');
    }).catch(() => {
      toast.warning('Copy manually: ' + url.slice(0, 60) + '…');
    });
  };

  // Load pipeline from URL on mount
  const loadFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    const data   = params.get('pipeline');
    if (!data) return false;
    const obj = decompress(data);
    if (!obj?.nodes) { toast.error('Invalid pipeline URL'); return false; }
    importJSON(JSON.stringify(obj));
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    toast.success(`Loaded shared pipeline — ${obj.nodes.length} nodes`);
    return true;
  };

  return { copyShareURL, getShareURL, loadFromURL };
};

// ── Share panel UI ────────────────────────────────────────────────
export const SharePanel = ({ onClose }) => {
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);
  const { copyShareURL, getShareURL } = usePipelineShare();
  const [copied, setCopied] = useState(false);
  const [url,    setUrl]    = useState('');

  const handleGenerate = () => {
    const u = getShareURL();
    if (u) { setUrl(u); setCopied(false); }
  };

  const handleCopy = () => {
    copyShareURL();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={panelRef} style={{
      position:'fixed', top:'60px', right:'14px', zIndex:9000,
      width:'300px', background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:'12px', padding:'16px', fontFamily:"'DM Sans',sans-serif",
      boxShadow:'0 12px 40px #0008',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <span style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)' }}>🔗 Share Pipeline</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'16px' }}>×</button>
      </div>

      <div style={{ fontSize:'11px', color:'var(--text-dim)', marginBottom:'12px', lineHeight:1.5 }}>
        Share your entire pipeline as a URL. Anyone with the link can open it instantly — no account needed.
      </div>

      {!url ? (
        <button onClick={handleGenerate}
          style={{ width:'100%', padding:'10px', background:'linear-gradient(135deg,#6366f1,#3b82f6)', border:'none', borderRadius:'9px', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Generate Share Link
        </button>
      ) : (
        <>
          <div style={{ background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'8px', padding:'8px 10px', fontSize:'10px', color:'var(--text-dim)', fontFamily:'monospace', wordBreak:'break-all', marginBottom:'8px', maxHeight:'70px', overflowY:'auto' }}>
            {url}
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            <button onClick={handleCopy}
              style={{ flex:1, padding:'8px', background: copied ? '#10b981' : 'linear-gradient(135deg,#6366f1,#3b82f6)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'background 0.2s' }}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
            <button onClick={handleGenerate}
              style={{ padding:'8px 12px', background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text-dim)', fontSize:'11px', cursor:'pointer', fontFamily:'inherit' }}>
              ↺
            </button>
          </div>
        </>
      )}

      <div style={{ marginTop:'10px', fontSize:'9px', color:'var(--text-hint)', textAlign:'center' }}>
        Pipeline data is encoded directly in the URL — no server required
      </div>
    </div>
  );
};