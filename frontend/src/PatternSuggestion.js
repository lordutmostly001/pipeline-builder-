// PatternSuggestion.js — Floating suggestion banner when a pattern hits threshold

import { useState, useEffect, useCallback } from 'react';
import { useStore } from './store';
import {
  checkForSuggestion, saveLearnedTemplate, dismissSuggestion,
  buildPatternTemplate, fmt,
} from './PatternTracker';

// ── Hook: watches edges for new suggestions ───────────────────────
export const usePatternSuggestion = () => {
  const edges = useStore((s) => s.edges);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    if (edges.length === 0) return;
    const s = checkForSuggestion();
    if (s) setSuggestion(s);
  }, [edges.length]); // re-check whenever edge count changes

  const dismiss = useCallback((key) => {
    dismissSuggestion(key);
    setSuggestion(null);
  }, []);

  const accept = useCallback((key, name) => {
    const { nodes, edges: currentEdges } = useStore.getState();
    const { nodes: tNodes, edges: tEdges } = buildPatternTemplate(key, nodes, currentEdges);
    saveLearnedTemplate(key, name, tNodes, tEdges);
    dismissSuggestion(key); // don't suggest same pattern again
    setSuggestion(null);
  }, []);

  return { suggestion, dismiss, accept };
};

// ── UI: suggestion banner ─────────────────────────────────────────
export const PatternSuggestionBanner = ({ suggestion, onAccept, onDismiss }) => {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (suggestion) setName(suggestion.label);
  }, [suggestion]);

  if (!suggestion) return null;

  const handleAccept = () => {
    onAccept(suggestion.key, name || suggestion.label);
  };

  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9500, width: '420px',
      background: 'linear-gradient(135deg, #1e1b4b, #1a1f3a)',
      border: '1px solid #6366f144',
      borderRadius: '14px', padding: '14px 16px',
      boxShadow: '0 8px 32px #0009, 0 0 0 1px #6366f122',
      fontFamily: "'DM Sans',sans-serif",
      animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform: translateX(-50%) translateY(20px); }
          to   { opacity:1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:'10px', marginBottom:'10px' }}>
        <div style={{ width:'32px', height:'32px', borderRadius:'9px', background:'#6366f122', border:'1px solid #6366f144', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', flexShrink:0 }}>
          🧠
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'12px', fontWeight:800, color:'#e0e7ff', marginBottom:'2px' }}>
            Pattern detected
          </div>
          <div style={{ fontSize:'11px', color:'#a5b4fc', lineHeight:1.5 }}>
            You've used{' '}
            <span style={{ color:'#c4b5fd', fontWeight:700 }}>
              {suggestion.label}
            </span>
            {' '}{suggestion.count} times. Save as a personal template?
          </div>
        </div>
        <button
          onClick={() => onDismiss(suggestion.key)}
          style={{ background:'none', border:'none', color:'#6366f188', cursor:'pointer', fontSize:'16px', lineHeight:1, padding:'2px', flexShrink:0 }}
        >×</button>
      </div>

      {/* Template name input */}
      <div style={{ marginBottom:'10px' }}>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditing(false)}
            autoFocus
            placeholder="Template name…"
            style={{
              width:'100%', background:'#ffffff0f', border:'1px solid #6366f144',
              borderRadius:'7px', padding:'6px 10px', color:'#e0e7ff',
              fontSize:'11px', fontFamily:"'DM Sans',sans-serif", outline:'none',
              boxSizing:'border-box',
            }}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{ padding:'6px 10px', background:'#ffffff08', border:'1px dashed #6366f133', borderRadius:'7px', fontSize:'11px', color:'#a5b4fc', cursor:'text', display:'flex', justifyContent:'space-between' }}
          >
            <span>{name || suggestion.label}</span>
            <span style={{ fontSize:'10px', color:'#6366f166' }}>click to rename</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display:'flex', gap:'8px' }}>
        <button
          onClick={handleAccept}
          style={{
            flex:1, padding:'8px', borderRadius:'8px', border:'none', cursor:'pointer',
            background:'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color:'#fff', fontSize:'11px', fontWeight:700,
            fontFamily:"'DM Sans',sans-serif",
            boxShadow:'0 2px 8px #6366f144',
          }}
        >
          ✓ Save as Template
        </button>
        <button
          onClick={() => onDismiss(suggestion.key)}
          style={{
            padding:'8px 14px', borderRadius:'8px', cursor:'pointer',
            background:'transparent', border:'1px solid #6366f133',
            color:'#6366f188', fontSize:'11px', fontFamily:"'DM Sans',sans-serif",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
};
