// ContextMenu.js — Right-click context menu with Framer Motion.

import { useEffect, useRef }        from 'react';
import { motion }                   from 'framer-motion';
import { useStore }                 from './store';
import { useReactFlow }             from 'reactflow';

export const ContextMenu = ({ nodeId, x, y, onClose, onSaveComponent }) => {
  const ref               = useRef(null);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const onNodesChange     = useStore((s) => s.onNodesChange);
  const toggleCollapsed   = useStore((s) => s.toggleNodeCollapsed);
  const nodes             = useStore((s) => s.nodes);
  const { fitView }       = useReactFlow();

  const node      = nodes.find((n) => n.id === nodeId);
  const collapsed = node?.data?.collapsed ?? false;

  const selectedNodes = nodes.filter((n) => n.selected);
  const canSaveGroup  = selectedNodes.length >= 2;

  useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key   = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', click);
    window.addEventListener('keydown',   key);
    return () => { window.removeEventListener('mousedown', click); window.removeEventListener('keydown', key); };
  }, [onClose]);

  const menuW = 200, menuH = 260;
  const cx = Math.min(x, window.innerWidth  - menuW - 8);
  const cy = Math.min(y, window.innerHeight - menuH - 8);

  const actions = [
    { icon:'📋', label:'Duplicate',  action:() => { onNodesChange([{ type:'select', id:nodeId, selected:true }]); setTimeout(() => { duplicateSelected(); onClose(); }, 0); } },
    { icon: collapsed ? '▶' : '▼',  label: collapsed ? 'Expand' : 'Collapse', action:() => { toggleCollapsed(nodeId); onClose(); } },
    { icon:'🎯', label:'Focus node', action:() => { fitView({ nodes:[{ id:nodeId }], padding:0.5, duration:400 }); onClose(); } },
    { divider: true },
    canSaveGroup
      ? { icon:'🧩', label:`Save ${selectedNodes.length} nodes as Component`, action:() => { onSaveComponent?.(selectedNodes.map((n) => n.id)); onClose(); } }
      : { icon:'🧩', label:'Save as Component', action:() => { onSaveComponent?.([nodeId]); onClose(); } },
    { divider: true },
    { icon:'🗑', label:'Delete', danger:true, action:() => { onNodesChange([{ type:'remove', id:nodeId }]); onClose(); } },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ scale:0.9, opacity:0, y:-8 }}
      animate={{ scale:1,   opacity:1, y:0  }}
      transition={{ type:'spring', stiffness:500, damping:30 }}
      style={{ position:'fixed', left:cx, top:cy, zIndex:99999, background:'var(--bg-modal)', border:'1px solid var(--border)', borderRadius:'10px', padding:'4px', minWidth:`${menuW}px`, boxShadow:'var(--shadow-panel)', fontFamily:"'DM Sans','Segoe UI',sans-serif" }}
    >
      {actions.map((a, i) =>
        a.divider ? (
          <div key={i} style={{ height:'1px', background:'var(--border)', margin:'4px 0' }} />
        ) : (
          <motion.button
            key={a.label}
            onClick={a.action}
            whileHover={{ backgroundColor: a.danger ? '#f43f5e18' : 'var(--bg-hover)' }}
            whileTap={{ scale: 0.97 }}
            style={{ display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'8px 12px', background:'transparent', border:'none', borderRadius:'7px', color: a.danger ? '#f87171' : 'var(--text-primary)', cursor:'pointer', fontSize:'13px', fontFamily:'inherit', textAlign:'left' }}
            aria-label={a.label}
          >
            <span style={{ fontSize:'14px', width:'18px', textAlign:'center' }}>{a.icon}</span>
            {a.label}
          </motion.button>
        )
      )}
    </motion.div>
  );
};