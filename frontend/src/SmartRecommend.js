// SmartRecommend.js — "What comes next?" suggestions after placing/selecting a node

import { useStore } from './store';

const RECOMMENDATIONS = {
  customInput:  ['llm', 'transform', 'filter'],
  llm:          ['customOutput', 'transform', 'condition'],
  filter:       ['transform', 'llm', 'merge'],
  transform:    ['llm', 'customOutput', 'api'],
  api:          ['transform', 'llm', 'customOutput'],
  merge:        ['llm', 'transform', 'customOutput'],
  condition:    ['llm', 'transform', 'customOutput'],
  timer:        ['api', 'llm', 'customOutput'],
  text:         ['llm', 'transform', 'customOutput'],
  customOutput: [],
  note:         [],
};

const NODE_DEFS = {
  customInput:  { label:'Input',     icon:'📥', color:'#3b82f6' },
  llm:          { label:'LLM',       icon:'🤖', color:'#8b5cf6' },
  customOutput: { label:'Output',    icon:'📤', color:'#10b981' },
  text:         { label:'Text',      icon:'📝', color:'#f59e0b' },
  filter:       { label:'Filter',    icon:'🔍', color:'#ec4899' },
  merge:        { label:'Merge',     icon:'🔗', color:'#06b6d4' },
  api:          { label:'API',       icon:'🌐', color:'#f97316' },
  transform:    { label:'Transform', icon:'⚙️', color:'#a855f7' },
  condition:    { label:'Condition', icon:'🔀', color:'#f43f5e' },
  timer:        { label:'Timer',     icon:'⏱️', color:'#0ea5e9' },
};

export const SmartRecommend = ({ nodeId, nodeType, position, onDismiss }) => {
  const addNode = useStore((s) => s.addNode);
  const recs    = RECOMMENDATIONS[nodeType] ?? [];

  if (!recs.length) return null;

  return (
    <div style={{
      position:'absolute',
      left: position.x + 270,
      top:  position.y + 40,
      zIndex:10, pointerEvents:'all',
      fontFamily:"'DM Sans',sans-serif",
    }}>
      <div style={{
        background:'var(--bg-card)', border:'1px solid var(--border)',
        borderRadius:'10px', padding:'8px',
        boxShadow:'0 8px 24px #0008',
        minWidth:'150px',
      }}>
        <div style={{ fontSize:'8px', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'6px', paddingLeft:'4px' }}>
          ✨ What's next?
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          {recs.map((type) => {
            const def = NODE_DEFS[type];
            if (!def) return null;
            return (
              <button
                key={type}
                onClick={() => {
                  addNode(type, { x: position.x + 320, y: position.y + 40 });
                  onDismiss?.();
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${def.color}22`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display:'flex', alignItems:'center', gap:'8px',
                  background:'transparent', border:'none', borderRadius:'7px',
                  padding:'6px 8px', cursor:'pointer', width:'100%',
                  fontFamily:'inherit', textAlign:'left',
                }}
              >
                <span style={{ fontSize:'13px' }}>{def.icon}</span>
                <span style={{ fontSize:'11px', fontWeight:600, color:'var(--text-primary)' }}>{def.label}</span>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:def.color, marginLeft:'auto', flexShrink:0 }} />
              </button>
            );
          })}
        </div>
        <button onClick={onDismiss} style={{ width:'100%', marginTop:'4px', background:'none', border:'none', color:'var(--text-hint)', fontSize:'9px', cursor:'pointer', fontFamily:'inherit', padding:'3px' }}>Dismiss</button>
      </div>
    </div>
  );
};