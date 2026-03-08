// VersionDiff.js — Semantic diff between two saved pipeline versions

import { useState, useRef, useCallback } from 'react';
import { useStore } from './store';
import { useClickOutside } from './useClickOutside';

const fmt = (ts) => ts
  ? new Date(ts).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
  : '—';

// ── Compute diff ──────────────────────────────────────────────────
const computeDiff = (vA, vB) => {
  const nodesA = vA.nodes ?? [];
  const nodesB = vB.nodes ?? [];
  const edgesA = vA.edges ?? [];
  const edgesB = vB.edges ?? [];

  const mapA = Object.fromEntries(nodesA.map((n) => [n.id, n]));
  const mapB = Object.fromEntries(nodesB.map((n) => [n.id, n]));

  const addedNodes    = nodesB.filter((n) => !mapA[n.id]);
  const removedNodes  = nodesA.filter((n) => !mapB[n.id]);
  const modifiedNodes = nodesB.filter((n) => {
    if (!mapA[n.id]) return false;
    return n.type !== mapA[n.id].type ||
      JSON.stringify(n.data ?? {}) !== JSON.stringify(mapA[n.id].data ?? {});
  });

  const edgeKeyA = new Set(edgesA.map((e) => `${e.source}→${e.target}`));
  const edgeKeyB = new Set(edgesB.map((e) => `${e.source}→${e.target}`));
  const addedEdges   = edgesB.filter((e) => !edgeKeyA.has(`${e.source}→${e.target}`));
  const removedEdges = edgesA.filter((e) => !edgeKeyB.has(`${e.source}→${e.target}`));

  return { addedNodes, removedNodes, modifiedNodes, addedEdges, removedEdges, mapA };
};

const getChangedFields = (nodeA, nodeB) => {
  const changes = [];
  if (nodeA.type !== nodeB.type) changes.push({ field:'type', from: nodeA.type, to: nodeB.type });
  const dataA = nodeA.data ?? {};
  const dataB = nodeB.data ?? {};
  const allKeys = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);
  allKeys.forEach((k) => {
    if (JSON.stringify(dataA[k]) !== JSON.stringify(dataB[k]))
      changes.push({ field: k, from: dataA[k], to: dataB[k] });
  });
  return changes;
};

const TYPE_COLORS = {
  customInput:'#3b82f6', llm:'#8b5cf6', customOutput:'#10b981',
  text:'#f59e0b', filter:'#ec4899', merge:'#06b6d4',
  api:'#f97316', transform:'#a855f7', condition:'#f43f5e',
  timer:'#0ea5e9', note:'#fbbf24',
};

const NodeChip = ({ node, variant }) => {
  const color = variant === 'added' ? '#10b981' : variant === 'removed' ? '#f43f5e' : '#f59e0b';
  const tc    = TYPE_COLORS[node.type] ?? '#64748b';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'5px 8px', borderRadius:'7px', marginBottom:'4px', background:`${color}0e`, border:`1px solid ${color}30` }}>
      <span style={{ fontSize:'10px', fontWeight:700, color, minWidth:'12px' }}>{variant === 'added' ? '+' : variant === 'removed' ? '−' : '~'}</span>
      <span style={{ fontSize:'9px', fontWeight:700, padding:'1px 6px', borderRadius:'4px', background:`${tc}22`, color: tc, border:`1px solid ${tc}44` }}>{node.type}</span>
      <span style={{ fontSize:'10px', color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {node.data?.label ?? node.data?.inputName ?? node.data?.outputName ?? node.id}
      </span>
    </div>
  );
};

const EdgeChip = ({ edge, variant }) => {
  const color = variant === 'added' ? '#10b981' : '#f43f5e';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 8px', borderRadius:'6px', marginBottom:'3px', background:`${color}0e`, border:`1px solid ${color}30`, fontSize:'10px', color:'var(--text-dim)' }}>
      <span style={{ color, fontWeight:700 }}>{variant === 'added' ? '+' : '−'}</span>
      <span style={{ color:'var(--text-secondary)', fontFamily:'monospace', fontSize:'9px' }}>{edge.source} → {edge.target}</span>
    </div>
  );
};

const Section = ({ title, color, count, children }) => {
  const [open, setOpen] = useState(true);
  if (count === 0) return null;
  return (
    <div style={{ marginBottom:'10px' }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', padding:'4px 0', cursor:'pointer', color:'var(--text-secondary)', fontFamily:"'DM Sans',sans-serif" }}>
        <span style={{ fontSize:'10px', fontWeight:800, color, textTransform:'uppercase', letterSpacing:'0.07em' }}>{title}</span>
        <span style={{ fontSize:'10px', padding:'1px 7px', borderRadius:'10px', background:`${color}18`, color, fontWeight:700 }}>{count} {open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ marginTop:'4px' }}>{children}</div>}
    </div>
  );
};

const SummaryBar = ({ diff }) => {
  const total = diff.addedNodes.length + diff.removedNodes.length + diff.modifiedNodes.length + diff.addedEdges.length + diff.removedEdges.length;
  if (total === 0) return (
    <div style={{ textAlign:'center', padding:'16px 0', fontSize:'11px', color:'var(--text-hint)' }}>✓ Versions are identical</div>
  );
  return (
    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
      {[
        { label:'+ nodes', val: diff.addedNodes.length,    color:'#10b981' },
        { label:'− nodes', val: diff.removedNodes.length,  color:'#f43f5e' },
        { label:'~ nodes', val: diff.modifiedNodes.length, color:'#f59e0b' },
        { label:'+ edges', val: diff.addedEdges.length,    color:'#10b98188' },
        { label:'− edges', val: diff.removedEdges.length,  color:'#f43f5e88' },
      ].filter((s) => s.val > 0).map(({ label, val, color }) => (
        <span key={label} style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'10px', background:`${color}18`, color, border:`1px solid ${color}40` }}>
          {val} {label}
        </span>
      ))}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────
export const VersionDiff = ({ onClose }) => {
  const versions = useStore((s) => s.versions);
  const nodes    = useStore((s) => s.nodes);
  const edges    = useStore((s) => s.edges);

  // Build options fresh each render — use `timestamp` (what store actually saves)
  const allOptions = [
    { id: '__current__', label: `Current canvas · ${nodes.length}n` },
    ...versions.map((v) => ({
      id:    String(v.id),
      label: `${v.name ?? fmt(v.timestamp)} · ${v.nodes?.length ?? 0}n`,
    })),
  ];

  // Default: left = current, right = first saved version (or second option)
  const [selA, setSelA] = useState('__current__');
  const [selB, setSelB] = useState(() => String(versions[0]?.id ?? '__current__'));

  // Swap B away if user picks same as A (and vice versa) — no stale closure
  const handleSelA = useCallback((id) => {
    setSelA(id);
    setSelB((prev) => prev === id
      ? allOptions.find((o) => o.id !== id)?.id ?? prev
      : prev
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.length]);

  const handleSelB = useCallback((id) => {
    setSelB(id);
    setSelA((prev) => prev === id
      ? allOptions.find((o) => o.id !== id)?.id ?? prev
      : prev
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versions.length]);

  // Resolve version data by id
  const getVersionData = useCallback((id) => {
    if (id === '__current__') return { nodes, edges };
    const v = versions.find((v) => String(v.id) === id);
    return v ?? null;
  }, [nodes, edges, versions]);

  const vA   = getVersionData(selA);
  const vB   = getVersionData(selB);
  const diff = vA && vB && selA !== selB ? computeDiff(vA, vB) : null;

  // Drag
  const [pos,      setPos]      = useState({ x: Math.max(0, window.innerWidth / 2 - 210), y: 90 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x:0, y:0 });
  const panelRef   = useRef(null);
  useClickOutside(panelRef, onClose);

  const onMouseDown = (e) => {
    if (e.target.closest('button,select')) return;
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - 420, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 560, e.clientY - dragOffset.current.y)),
    });
  };
  const onMouseUp = () => setDragging(false);

  const selectStyle = {
    background:'var(--bg-node)', border:'1px solid var(--border)',
    borderRadius:'7px', color:'var(--text-secondary)', fontSize:'10px',
    padding:'5px 8px', cursor:'pointer', flex:1,
    fontFamily:"'DM Sans',sans-serif", outline:'none',
  };

  return (
    <div
      ref={panelRef}
      style={{
        position:'fixed', left:`${pos.x}px`, top:`${pos.y}px`, zIndex:8500,
        width:'420px', background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'14px', overflow:'hidden', boxShadow:'0 16px 50px #000a',
        fontFamily:"'DM Sans',sans-serif", cursor: dragging ? 'grabbing' : 'default',
      }}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
    >
      {/* Header */}
      <div onMouseDown={onMouseDown} style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'10px', cursor: dragging ? 'grabbing' : 'grab', userSelect:'none' }}>
        <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#6366f122', border:'1px solid #6366f144', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', flexShrink:0 }}>⚖️</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'12px', fontWeight:800, color:'var(--text-primary)' }}>Version Diff</div>
          <div style={{ fontSize:'9px', color:'var(--text-dim)' }}>Compare any two saved versions · drag to move</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>×</button>
      </div>

      {/* Selectors */}
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
        {versions.length === 0 ? (
          <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'8px 0' }}>
            No saved versions yet — save one with Ctrl+S
          </div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <select value={selA} onChange={(e) => handleSelA(e.target.value)} style={selectStyle}>
                {allOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <span style={{ fontSize:'12px', color:'var(--text-dim)', fontWeight:700, flexShrink:0 }}>vs</span>
              <select value={selB} onChange={(e) => handleSelB(e.target.value)} style={selectStyle}>
                {allOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            {selA === selB && (
              <div style={{ marginTop:'8px', fontSize:'10px', color:'#f59e0b', textAlign:'center' }}>
                ⚠ Select two different versions to compare
              </div>
            )}
          </>
        )}
      </div>

      {/* Diff results */}
      {diff && (
        <div style={{ padding:'12px 14px', maxHeight:'400px', overflowY:'auto' }}>
          <SummaryBar diff={diff} />
          <Section title="Added nodes"    color="#10b981"   count={diff.addedNodes.length}>
            {diff.addedNodes.map((n) => <NodeChip key={n.id} node={n} variant="added" />)}
          </Section>
          <Section title="Removed nodes"  color="#f43f5e"   count={diff.removedNodes.length}>
            {diff.removedNodes.map((n) => <NodeChip key={n.id} node={n} variant="removed" />)}
          </Section>
          <Section title="Modified nodes" color="#f59e0b"   count={diff.modifiedNodes.length}>
            {diff.modifiedNodes.map((n) => {
              const origNode = diff.mapA[n.id];
              const changes  = origNode ? getChangedFields(origNode, n) : [];
              return (
                <div key={n.id} style={{ marginBottom:'6px' }}>
                  <NodeChip node={n} variant="modified" />
                  {changes.map(({ field, from, to }) => (
                    <div key={field} style={{ marginLeft:'20px', marginBottom:'3px', fontSize:'10px', color:'var(--text-dim)', display:'flex', gap:'6px', alignItems:'baseline' }}>
                      <span style={{ color:'#f59e0b', fontWeight:700 }}>{field}:</span>
                      <span style={{ color:'#f43f5e99', textDecoration:'line-through', fontFamily:'monospace', maxWidth:'110px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(from ?? '—').slice(0,30)}</span>
                      <span style={{ color:'var(--text-hint)' }}>→</span>
                      <span style={{ color:'#10b98199', fontFamily:'monospace', maxWidth:'110px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(to ?? '—').slice(0,30)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </Section>
          <Section title="Added edges"   color="#10b98188" count={diff.addedEdges.length}>
            {diff.addedEdges.map((e, i) => <EdgeChip key={i} edge={e} variant="added" />)}
          </Section>
          <Section title="Removed edges" color="#f43f5e88" count={diff.removedEdges.length}>
            {diff.removedEdges.map((e, i) => <EdgeChip key={i} edge={e} variant="removed" />)}
          </Section>
        </div>
      )}
    </div>
  );
};