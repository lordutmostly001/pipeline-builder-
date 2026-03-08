// NodeGenealogy.js — Upstream/downstream lineage view for a selected node

import { useMemo, useRef } from 'react';
import { useStore } from './store';
import { shallow }  from 'zustand/shallow';
import { NODE_COLORS } from './store';
import { useClickOutside } from './useClickOutside';

const NODE_LABELS = { customInput:'Input', llm:'LLM', customOutput:'Output', text:'Text', filter:'Filter', merge:'Merge', api:'API', transform:'Transform', condition:'Condition', timer:'Timer', note:'Note' };
const selector    = (s) => ({ nodes: s.nodes, edges: s.edges });

const traceUp = (nodeId, nodes, edges) => {
  const visited = new Set();
  const queue   = [nodeId];
  while (queue.length) {
    const cur = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    edges.filter((e) => e.target === cur).forEach((e) => queue.push(e.source));
  }
  visited.delete(nodeId);
  return visited;
};

const traceDown = (nodeId, nodes, edges) => {
  const visited = new Set();
  const queue   = [nodeId];
  while (queue.length) {
    const cur = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    edges.filter((e) => e.source === cur).forEach((e) => queue.push(e.target));
  }
  visited.delete(nodeId);
  return visited;
};

export const NodeGenealogy = ({ nodeId, onClose }) => {
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose);
  const { nodes, edges } = useStore(selector, shallow);
  const node = nodes.find((n) => n.id === nodeId);

  const { upstream, downstream } = useMemo(() => ({
    upstream:   [...traceUp(nodeId,   nodes, edges)].map((id) => nodes.find((n) => n.id === id)).filter(Boolean),
    downstream: [...traceDown(nodeId, nodes, edges)].map((id) => nodes.find((n) => n.id === id)).filter(Boolean),
  }), [nodeId, nodes, edges]);

  if (!node) return null;

  const NodePill = ({ n, dim }) => (
    <div style={{ display:'flex', alignItems:'center', gap:'7px', padding:'5px 9px', background: dim ? 'transparent' : `${NODE_COLORS[n.type] ?? '#4a5878'}11`, border:`1px solid ${NODE_COLORS[n.type] ?? '#4a5878'}${dim ? '22' : '44'}`, borderRadius:'7px', opacity: dim ? 0.5 : 1 }}>
      <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: NODE_COLORS[n.type] ?? '#4a5878', flexShrink:0 }} />
      <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text-primary)', flex:1 }}>{NODE_LABELS[n.type] ?? n.type}</span>
      <span style={{ fontSize:'9px', color:'var(--text-dim)', fontFamily:'monospace' }}>{n.id}</span>
    </div>
  );

  return (
    <div ref={panelRef} style={{
      position:'fixed', left:'14px', bottom:'14px', zIndex:8500,
      width:'260px', background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:'13px', padding:'14px', fontFamily:"'DM Sans',sans-serif",
      boxShadow:'0 12px 40px #0008',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <span style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)' }}>🧬 Node Lineage</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'16px' }}>×</button>
      </div>

      {/* Focus node */}
      <div style={{ padding:'7px 10px', background:`${NODE_COLORS[node.type]}22`, border:`2px solid ${NODE_COLORS[node.type]}88`, borderRadius:'8px', marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ width:'9px', height:'9px', borderRadius:'50%', background: NODE_COLORS[node.type] ?? '#4a5878' }} />
        <span style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)' }}>{NODE_LABELS[node.type] ?? node.type}</span>
        <span style={{ fontSize:'9px', color:'var(--text-dim)', fontFamily:'monospace', marginLeft:'auto' }}>{node.id}</span>
      </div>

      {/* Upstream */}
      {upstream.length > 0 && (
        <div style={{ marginBottom:'8px' }}>
          <div style={{ fontSize:'8px', fontWeight:700, color:'#3b82f6', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'5px' }}>▲ Upstream ({upstream.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            {upstream.map((n) => <NodePill key={n.id} n={n} />)}
          </div>
        </div>
      )}

      {/* Downstream */}
      {downstream.length > 0 && (
        <div>
          <div style={{ fontSize:'8px', fontWeight:700, color:'#10b981', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'5px' }}>▼ Downstream ({downstream.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            {downstream.map((n) => <NodePill key={n.id} n={n} />)}
          </div>
        </div>
      )}

      {upstream.length === 0 && downstream.length === 0 && (
        <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'10px 0' }}>No connected nodes</div>
      )}
    </div>
  );
};