// StatsPanel.js — Full graph analytics panel

import { useState, useMemo, useRef } from 'react';
import { useClickOutside } from './useClickOutside';
import { useStore }          from './store';
import { shallow }           from 'zustand/shallow';
import { NODE_COLORS }       from './store';
import { analyzeGraph, lintPipeline, computeHealthScore } from './graphAnalytics';

const NODE_LABELS = {
  customInput:'Input', llm:'LLM', customOutput:'Output', text:'Text',
  filter:'Filter', merge:'Merge', api:'API', transform:'Transform',
  condition:'Condition', timer:'Timer', note:'Note',
};

const selector = (s) => ({ nodes: s.nodes, edges: s.edges });

const Chip = ({ label, value, color, sub }) => (
  <div style={{ flex:1, background:'var(--bg-card)', border:`1px solid ${color}33`, borderRadius:'8px', padding:'6px 4px', textAlign:'center' }}>
    <div style={{ fontSize:'15px', fontWeight:800, color, lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize:'7px', color, opacity:0.6, marginTop:'1px' }}>{sub}</div>}
    <div style={{ fontSize:'8px', color:'var(--text-dim)', marginTop:'2px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
  </div>
);

export const StatsPanel = () => {
  const { nodes, edges } = useStore(selector, shallow);
  const [open, setOpen]  = useState(false);
  const [tab,  setTab]   = useState('stats');
  const panelRef = useRef(null);
  useClickOutside(panelRef, () => setOpen(false), open); // 'stats' | 'path'

  const a = useMemo(() => analyzeGraph(nodes, edges), [nodes, edges]);
  const dagColor  = !a ? 'var(--text-dim)' : a.isDAG ? '#10b981' : '#f43f5e';
  const warnings     = useMemo(() => lintPipeline(nodes, edges), [nodes, edges]);
  const health       = useMemo(() => computeHealthScore(a, warnings), [a, warnings]);
  const errCount  = warnings.filter((w) => w.level === 'error').length;
  const warnCount = warnings.filter((w) => w.level === 'warning').length;
  const infoCount = warnings.filter((w) => w.level === 'info').length;

  // Critical path ordered node list
  const criticalPathNodes = useMemo(() => {
    if (!a?.criticalPath?.nodeIds?.size) return [];
    return (a.topoOrder ?? [])
      .filter((id) => a.criticalPath.nodeIds.has(id))
      .map((id) => nodes.find((n) => n.id === id))
      .filter(Boolean);
  }, [a, nodes]);

  return (
    <div ref={panelRef} style={{ position:'fixed', right:-1, top:'50%', transform:'translateY(-50%)', zIndex:50, display:'flex', alignItems:'center' }}>

      {/* Panel */}
      <div style={{ width: open ? '210px' : '0px', overflow:'hidden', transition:'width 0.28s cubic-bezier(0.4,0,0.2,1)', flexShrink:0, marginRight: open ? '0px' : '-1px' }}>
        <div style={{ width:'210px', background:'var(--bg-card)', backdropFilter:'blur(14px)', border:'1px solid var(--border)', borderRight:'none', borderRadius:'12px 0 0 12px', padding:'14px 12px', fontFamily:"'DM Sans','Segoe UI',sans-serif", boxShadow:'-4px 0 24px #0006' }}>

          {/* Tab bar */}
          <div style={{ display:'flex', gap:'4px', marginBottom:'10px' }}>
            {[
              { id:'stats',  label:'📊' },
              { id:'path',   label:'⚡' },
              { id:'health', label: !health ? '❤️' : health.score >= 90 ? '💚' : health.score >= 60 ? '💛' : '❤️' },
              { id:'lint',   label: errCount > 0 ? '🔴' : warnCount > 0 ? '🟡' : '🟢' },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex:1, padding:'4px', fontSize:'10px', fontWeight:700, background: tab===id ? 'var(--bg-hover)' : 'transparent', border:`1px solid ${tab===id ? 'var(--border)' : 'transparent'}`, borderRadius:'6px', color: tab===id ? 'var(--text-primary)' : 'var(--text-dim)', cursor:'pointer', fontFamily:'inherit' }}>
                {label}
              </button>
            ))}
          </div>

          {!a ? (
            <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'12px 0' }}>No nodes yet</div>
          ) : tab === 'health' ? (
            /* Health Score tab */
            <>
              {!health ? (
                <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'20px 0' }}>Add nodes to compute health</div>
              ) : (
                <>
                  {/* Big score ring */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0 8px' }}>
                    <div style={{ position:'relative', width:'90px', height:'90px' }}>
                      <svg width="90" height="90" style={{ transform:'rotate(-90deg)' }}>
                        <circle cx="45" cy="45" r="36" fill="none" stroke="var(--border)" strokeWidth="7" />
                        <circle cx="45" cy="45" r="36" fill="none" stroke={health.color} strokeWidth="7"
                          strokeDasharray={`${2 * Math.PI * 36 * health.score / 100} ${2 * Math.PI * 36}`}
                          strokeLinecap="round" style={{ transition:'stroke-dasharray 0.6s ease' }}
                        />
                      </svg>
                      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:'22px', fontWeight:900, color:health.color, lineHeight:1 }}>{health.score}</span>
                        <span style={{ fontSize:'9px', fontWeight:700, color:health.color, opacity:0.8 }}>{health.grade}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:'13px', fontWeight:800, color:health.color, marginTop:'6px' }}>{health.label}</div>
                  </div>

                  {/* Issues list */}
                  {health.issues.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginTop:'4px' }}>
                      <div style={{ fontSize:'8px', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'2px' }}>Deductions</div>
                      {health.issues.map((iss, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'10px', color:'var(--text-secondary)', padding:'4px 8px', background:'var(--bg-node)', borderRadius:'6px', border:'1px solid var(--border)' }}>
                          <span style={{ color:'#f43f5e' }}>−</span>{iss}
                        </div>
                      ))}
                    </div>
                  )}
                  {health.issues.length === 0 && (
                    <div style={{ textAlign:'center', fontSize:'11px', color:'#10b981', padding:'8px 0' }}>✓ No issues found</div>
                  )}
                </>
              )}
            </>
          ) : tab === 'lint' ? (
            /* Lint tab */
            <>
              <div style={{ fontSize:'8px', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px' }}>🔍 Pipeline Linter</div>

              {/* Summary */}
              <div style={{ display:'flex', gap:'4px', marginBottom:'8px', flexWrap:'wrap' }}>
                {errCount  > 0 && <span style={{ fontSize:'10px', fontWeight:700, color:'#f43f5e', background:'#f43f5e15', border:'1px solid #f43f5e33', borderRadius:'5px', padding:'2px 7px' }}>✕ {errCount}</span>}
                {warnCount > 0 && <span style={{ fontSize:'10px', fontWeight:700, color:'#f59e0b', background:'#f59e0b15', border:'1px solid #f59e0b33', borderRadius:'5px', padding:'2px 7px' }}>⚠ {warnCount}</span>}
                {infoCount > 0 && <span style={{ fontSize:'10px', fontWeight:700, color:'#60a5fa', background:'#60a5fa15', border:'1px solid #60a5fa33', borderRadius:'5px', padding:'2px 7px' }}>ℹ {infoCount}</span>}
                {warnings.length === 0 && <span style={{ fontSize:'10px', color:'#10b981' }}>✓ All clear</span>}
              </div>

              {/* Warning list */}
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', maxHeight:'280px', overflowY:'auto' }}>
                {warnings.map((w) => {
                  const lc = { error:'#f43f5e', warning:'#f59e0b', info:'#60a5fa' }[w.level];
                  const li = { error:'✕', warning:'⚠', info:'ℹ' }[w.level];
                  return (
                    <div key={w.id} style={{ display:'flex', alignItems:'flex-start', gap:'7px', padding:'6px 8px', background:`${lc}0d`, border:`1px solid ${lc}33`, borderRadius:'7px' }}>
                      <span style={{ color:lc, fontWeight:800, fontSize:'10px', flexShrink:0, marginTop:'1px' }}>{li}</span>
                      <span style={{ fontSize:'10px', color:'var(--text-secondary)', lineHeight:1.4 }}>{w.msg}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : tab === 'stats' ? (
            <>
              {/* Row 1 */}
              <div style={{ display:'flex', gap:'4px', marginBottom:'5px' }}>
                <Chip label="Nodes"  value={a.nodeCount} color="#3b82f6" />
                <Chip label="Edges"  value={a.edgeCount} color="#8b5cf6" />
                <Chip label="DAG"    value={a.isDAG?'✓':'✗'} color={dagColor} />
              </div>
              {/* Row 2 */}
              <div style={{ display:'flex', gap:'4px', marginBottom:'10px' }}>
                <Chip label="Depth"    value={a.depth}    color="#f59e0b" sub="steps" />
                <Chip label="Sources"  value={a.sources}  color="#10b981" />
                <Chip label="Sinks"    value={a.sinks}    color="#ec4899" />
                <Chip label="Branches" value={a.branches} color="#06b6d4" />
              </div>

              {/* Complexity badge */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-card)', border:`1px solid ${a.complexityColor}44`, borderRadius:'8px', padding:'6px 10px', marginBottom:'8px' }}>
                <span style={{ fontSize:'10px', color:'var(--text-dim)', fontWeight:600 }}>Complexity</span>
                <span style={{ fontSize:'11px', fontWeight:800, color: a.complexityColor }}>{a.complexity}</span>
              </div>

              {/* Est. runtime */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'8px', padding:'6px 10px', marginBottom:'10px' }}>
                <span style={{ fontSize:'10px', color:'var(--text-dim)', fontWeight:600 }}>Est. Runtime</span>
                <span style={{ fontSize:'11px', fontWeight:800, color:'#60a5fa' }}>{a.estimatedLabel}</span>
              </div>

              {/* Bottlenecks */}
              {a.articulationPoints.size > 0 && (
                <div style={{ marginBottom:'8px' }}>
                  <div style={{ fontSize:'8px', fontWeight:700, color:'#f97316', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>⚠ Bottlenecks ({a.articulationPoints.size})</div>
                  {[...a.articulationPoints].map((id) => {
                    const n = nodes.find((nd) => nd.id === id);
                    return (
                      <div key={id} style={{ fontSize:'10px', color:'#f97316', background:'#f9731610', border:'1px solid #f9731633', borderRadius:'5px', padding:'3px 7px', marginBottom:'3px' }}>
                        {NODE_LABELS[n?.type] ?? n?.type} · <span style={{ fontFamily:'monospace', fontSize:'9px' }}>{id}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dead nodes */}
              {a.deadNodes.length > 0 && (
                <div style={{ marginBottom:'8px' }}>
                  <div style={{ fontSize:'8px', fontWeight:700, color:'#f43f5e', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>💀 Dead Nodes ({a.deadNodes.length})</div>
                  {a.deadNodes.map((n) => (
                    <div key={n.id} style={{ fontSize:'10px', color:'#f43f5e', background:'#f43f5e10', border:'1px solid #f43f5e33', borderRadius:'5px', padding:'3px 7px', marginBottom:'3px' }}>
                      {NODE_LABELS[n.type] ?? n.type} · <span style={{ fontFamily:'monospace', fontSize:'9px' }}>{n.id}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Node type breakdown */}
              {Object.keys(a.typeCounts).length > 0 && (
                <>
                  <div style={{ fontSize:'8px', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'5px' }}>Node Usage</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    {Object.entries(a.typeCounts).map(([type, count]) => (
                      <div key={type} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: NODE_COLORS[type]??'var(--text-dim)', flexShrink:0 }} />
                        <div style={{ flex:1, height:'4px', background:'var(--border)', borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ width:`${(count/a.nodeCount)*100}%`, height:'100%', background: NODE_COLORS[type]??'var(--text-dim)', borderRadius:'2px', transition:'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize:'10px', color:'var(--text-secondary)', minWidth:'52px', textAlign:'right' }}>{NODE_LABELS[type]??type}</span>
                        <span style={{ fontSize:'10px', fontWeight:700, color:'var(--text-primary)', minWidth:'10px', textAlign:'right' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            /* Critical Path tab */
            <>
              <div style={{ fontSize:'8px', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'8px' }}>
                ⚡ Critical Path · {a.estimatedLabel}
              </div>
              {criticalPathNodes.length === 0 ? (
                <div style={{ fontSize:'11px', color:'var(--text-hint)', textAlign:'center', padding:'12px 0' }}>
                  {a.isDAG ? 'Add connected nodes' : 'Cycle detected'}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                  {criticalPathNodes.map((n, i) => {
                    const latency = { customInput:50, llm:2000, customOutput:50, text:100, filter:150, merge:100, api:500, transform:200, condition:100, timer:300, note:0 }[n.type] ?? 100;
                    const color = NODE_COLORS[n.type] ?? '#4a5878';
                    return (
                      <div key={n.id}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 8px', background:`${color}11`, border:`1px solid ${color}33`, borderRadius:'7px' }}>
                          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:color, flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:'11px', fontWeight:700, color:'var(--text-primary)' }}>{NODE_LABELS[n.type]??n.type}</div>
                            <div style={{ fontSize:'9px', color:'var(--text-dim)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.id}</div>
                          </div>
                          <span style={{ fontSize:'9px', color, fontWeight:700, flexShrink:0 }}>{latency}ms</span>
                        </div>
                        {i < criticalPathNodes.length - 1 && (
                          <div style={{ display:'flex', justifyContent:'center', height:'12px', alignItems:'center' }}>
                            <div style={{ width:'1px', height:'100%', background:'var(--border-subtle)' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ marginTop:'8px', padding:'6px 8px', background:'#60a5fa11', border:'1px solid #60a5fa33', borderRadius:'7px', display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'10px', color:'var(--text-dim)' }}>Total latency</span>
                    <span style={{ fontSize:'11px', fontWeight:800, color:'#60a5fa' }}>{a.estimatedLabel}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pull tab */}
      <div
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Collapse insights' : 'Pipeline insights'}
        style={{ cursor:'pointer', background:'var(--bg-card)', backdropFilter:'blur(10px)', border:'1px solid var(--border)', borderRight:'none', borderRadius:'8px 0 0 8px', width:'18px', height:'80px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'3px', flexShrink:0, transition:'background 0.15s', boxShadow:'-2px 0 12px #0004', marginLeft:'-1px' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
      >
        {[0,1,2].map((i) => <div key={i} style={{ width:'3px', height:'3px', borderRadius:'50%', background: open?'#60a5fa':'var(--text-dim)', transition:'background 0.2s' }} />)}
        <div style={{ fontSize:'8px', color: open?'#60a5fa':'var(--text-dim)', marginTop:'3px', transition:'transform 0.25s, color 0.2s', transform: open?'rotate(0deg)':'rotate(180deg)' }}>‹</div>
      </div>
    </div>
  );
};