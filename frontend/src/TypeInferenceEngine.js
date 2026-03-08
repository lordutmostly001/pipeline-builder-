// TypeInferenceEngine.js — Type checking on connections + AI-powered mismatch detection

import { useRef } from 'react';
import { generateJSON, MODELS }        from './OllamaClient';
import { HANDLE_TYPES, TYPE_COLORS }   from './graphAnalytics';

// ── Static type compatibility rules (fast, no AI) ─────────────────
const COMPAT = {
  any:     ['any','string','json','number','boolean','file'],
  string:  ['any','string'],
  json:    ['any','json','string'],
  number:  ['any','number','string'],
  boolean: ['any','boolean','string'],
  file:    ['any','file'],
};

export const checkTypeCompat = (sourceNodeType, sourceHandle, targetNodeType, targetHandle) => {
  const srcType = HANDLE_TYPES[sourceNodeType]?.outputs?.[sourceHandle] ?? 'any';
  const tgtType = HANDLE_TYPES[targetNodeType]?.inputs?.[targetHandle]  ?? 'any';
  const compatible = COMPAT[srcType]?.includes(tgtType) ?? true;
  return { compatible, srcType, tgtType };
};

// ── Inline type badge on handles ─────────────────────────────────
export const TypeBadge = ({ dataType }) => {
  const color = TYPE_COLORS[dataType] ?? TYPE_COLORS.any;
  return (
    <span style={{
      fontSize:'7px', fontWeight:700, padding:'1px 4px',
      background:`${color}22`, border:`1px solid ${color}66`,
      borderRadius:'4px', color, fontFamily:'monospace',
      userSelect:'none', pointerEvents:'none',
    }}>
      {dataType ?? 'any'}
    </span>
  );
};

// ── Connection mismatch warning toast ─────────────────────────────
export const useMismatchWarning = () => {
  const pendingRef = useRef(null);

  const checkConnection = async ({ sourceType, sourceHandle, targetType, targetHandle, onWarning }) => {
    const { compatible, srcType, tgtType } = checkTypeCompat(sourceType, sourceHandle, targetType, targetHandle);
    if (compatible) return;

    // Quick static warning
    onWarning?.({
      srcType, tgtType,
      message: `Type mismatch: ${sourceType} outputs ${srcType} but ${targetType} expects ${tgtType}`,
      suggestion: null,
      loading: true,
    });

    // AI-powered suggestion
    clearTimeout(pendingRef.current);
    pendingRef.current = setTimeout(async () => {
      try {
        const result = await generateJSON({
          model: MODELS.FAST,
          prompt: `A pipeline connection has a type mismatch.
Source node: ${sourceType}, output type: ${srcType}
Target node: ${targetType}, expected input type: ${tgtType}

Suggest the best fix in JSON:
{ "suggestion": "one sentence fix", "insertNode": "transform|null" }`,
        });
        onWarning?.({
          srcType, tgtType,
          message: `Type mismatch: ${srcType} → ${tgtType}`,
          suggestion: result?.suggestion ?? null,
          insertNode: result?.insertNode ?? null,
          loading: false,
        });
      } catch {
        onWarning?.({ srcType, tgtType, message: `Type mismatch: ${srcType} → ${tgtType}`, suggestion: null, loading: false });
      }
    }, 400);
  };

  return { checkConnection };
};

// ── Mismatch warning overlay ───────────────────────────────────────
export const MismatchWarning = ({ warning, onDismiss, onInsertNode }) => {
  if (!warning) return null;
  return (
    <div style={{
      position:'fixed', bottom:'80px', left:'50%', transform:'translateX(-50%)',
      zIndex:9500, background:'#1a1a2e', border:'1px solid #f59e0b66',
      borderRadius:'12px', padding:'12px 16px', maxWidth:'380px',
      boxShadow:'0 8px 32px #0007', fontFamily:"'DM Sans',sans-serif",
      display:'flex', gap:'10px', alignItems:'flex-start',
    }}>
      <span style={{ fontSize:'18px', flexShrink:0 }}>⚠️</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'#f59e0b', marginBottom:'3px' }}>Type Mismatch</div>
        <div style={{ fontSize:'11px', color:'var(--text-secondary)', marginBottom: warning.suggestion ? '6px' : '0' }}>{warning.message}</div>
        {warning.loading && <div style={{ fontSize:'10px', color:'var(--text-dim)' }}>AI analysing fix…</div>}
        {warning.suggestion && <div style={{ fontSize:'11px', color:'#60a5fa', background:'#60a5fa11', border:'1px solid #60a5fa33', borderRadius:'6px', padding:'5px 8px' }}>💡 {warning.suggestion}</div>}
        {warning.insertNode && warning.insertNode !== 'null' && (
          <button onClick={() => onInsertNode?.(warning.insertNode)}
            style={{ marginTop:'6px', background:'#f59e0b', border:'none', borderRadius:'6px', color:'#000', fontSize:'10px', fontWeight:700, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit' }}>
            + Insert {warning.insertNode} node
          </button>
        )}
      </div>
      <button onClick={onDismiss} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'16px', flexShrink:0, padding:0 }}>×</button>
    </div>
  );
};