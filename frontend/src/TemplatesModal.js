// TemplatesModal.js — Static + learned personal templates

import { useState }                from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEMPLATES }               from './templates';
import { useStore }                from './store';
import { ConfirmBanner }           from './ConfirmBanner';
import {
  getLearnedTemplates, deleteLearnedTemplate,
  incrementLearnedUse, fmt,
} from './PatternTracker';

const TAB_STYLE = (active) => ({
  flex:1, padding:'7px', background: active ? '#6366f122' : 'transparent',
  border: `1px solid ${active ? '#6366f144' : 'transparent'}`,
  borderRadius:'8px', color: active ? '#a5b4fc' : 'var(--text-dim)',
  fontSize:'11px', fontWeight:700, cursor:'pointer',
  fontFamily:"'DM Sans',sans-serif", transition:'all 0.15s',
});

const PatternChip = ({ label }) => (
  <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
    {label.split(' → ').map((part, i, arr) => (
      <span key={i} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
        <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 7px', borderRadius:'4px', background:'#6366f122', color:'#a5b4fc', border:'1px solid #6366f133' }}>
          {part}
        </span>
        {i < arr.length - 1 && <span style={{ color:'var(--text-hint)', fontSize:'10px' }}>→</span>}
      </span>
    ))}
  </div>
);

export const TemplatesModal = ({ onClose }) => {
  const loadTemplate = useStore((s) => s.loadTemplate);
  const nodeCount    = useStore((s) => s.nodes.length);
  const [pending,  setPending]  = useState(null);
  const [tab,      setTab]      = useState('static'); // 'static' | 'learned'
  const [learned,  setLearned]  = useState(() => getLearnedTemplates());

  const handleSelect = (t) => {
    if (nodeCount > 0) { setPending(t); }
    else { loadTemplate(t); onClose(); }
  };

  const handleConfirm = () => {
    if (!pending) return;
    if (pending._learned) incrementLearnedUse(pending.id);
    loadTemplate(pending);
    onClose();
  };

  const handleDeleteLearned = (e, id) => {
    e.stopPropagation();
    deleteLearnedTemplate(id);
    setLearned(getLearnedTemplates());
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'#000b', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
      >
        <motion.div
          initial={{ scale:0.92, opacity:0, y:20 }}
          animate={{ scale:1,    opacity:1, y:0  }}
          exit={{    scale:0.92, opacity:0, y:20 }}
          transition={{ type:'spring', stiffness:380, damping:30 }}
          onClick={(e) => e.stopPropagation()}
          style={{ background:'var(--bg-modal)', border:'1px solid var(--border)', borderRadius:'16px', padding:'24px 28px', width:'480px', maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px #000c', fontFamily:"'DM Sans','Segoe UI',sans-serif" }}
        >
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexShrink:0 }}>
            <div>
              <div style={{ fontSize:'16px', fontWeight:800, color:'var(--text-primary)' }}>🗂 Pipeline Templates</div>
              <div style={{ fontSize:'11px', color:'var(--text-dim)', marginTop:'2px' }}>Start from a pre-built or learned pipeline</div>
            </div>
            <button onClick={onClose} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text-secondary)', cursor:'pointer', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexShrink:0 }}>
            <button style={TAB_STYLE(tab === 'static')}  onClick={() => setTab('static')}>
              📦 Built-in ({TEMPLATES.length})
            </button>
            <button style={TAB_STYLE(tab === 'learned')} onClick={() => setTab('learned')}>
              🧠 Learned ({learned.length})
            </button>
          </div>

          {pending && (
            <div style={{ marginBottom:'12px', flexShrink:0 }}>
              <ConfirmBanner
                message={`Loading "${pending.name}" will replace your current pipeline.`}
                onConfirm={handleConfirm}
                onCancel={() => setPending(null)}
              />
            </div>
          )}

          {/* Scrollable list */}
          <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'10px' }}>
            {tab === 'static' && TEMPLATES.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity:0, x:-16 }}
                animate={{ opacity:1, x:0 }}
                transition={{ delay: i * 0.05, type:'spring', stiffness:400, damping:30 }}
                onClick={() => handleSelect(t)}
                whileHover={{ scale:1.01, backgroundColor:'var(--bg-toolbar)' }}
                whileTap={{ scale:0.99 }}
                style={{ background: pending?.id === t.id ? 'var(--border)' : 'var(--bg-card)', border:`1px solid ${pending?.id === t.id ? '#3b82f644' : 'var(--border)'}`, borderRadius:'10px', padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:'14px', flexShrink:0 }}
              >
                <span style={{ fontSize:'28px' }}>{t.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'13px', color:'var(--text-primary)', marginBottom:'3px' }}>{t.name}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-dim)' }}>{t.description}</div>
                </div>
                <div style={{ fontSize:'11px', color:'var(--text-hint)', whiteSpace:'nowrap' }}>{t.nodes.length} nodes →</div>
              </motion.div>
            ))}

            {tab === 'learned' && learned.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text-hint)', fontSize:'12px', lineHeight:2 }}>
                <div style={{ fontSize:'32px', marginBottom:'8px' }}>🧠</div>
                No learned templates yet.<br />
                <span style={{ fontSize:'11px', color:'var(--text-dim)' }}>
                  Connect the same node pattern {5} times<br />and we'll suggest saving it.
                </span>
              </div>
            )}

            {tab === 'learned' && learned.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity:0, x:-16 }}
                animate={{ opacity:1, x:0 }}
                transition={{ delay: i * 0.05, type:'spring', stiffness:400, damping:30 }}
                onClick={() => handleSelect({ ...t, _learned: true })}
                whileHover={{ scale:1.01 }}
                whileTap={{ scale:0.99 }}
                style={{ background: pending?.id === t.id ? '#6366f115' : 'var(--bg-card)', border:`1px solid ${pending?.id === t.id ? '#6366f144' : '#6366f122'}`, borderRadius:'10px', padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}
              >
                <span style={{ fontSize:'24px' }}>🧠</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:'13px', color:'var(--text-primary)', marginBottom:'5px' }}>{t.name}</div>
                  <PatternChip label={t.patternKey.split('→').map(fmt).join(' → ')} />
                  <div style={{ fontSize:'10px', color:'var(--text-hint)', marginTop:'4px' }}>
                    Used {t.useCount ?? 0} time{t.useCount !== 1 ? 's' : ''} · {t.nodes?.length ?? 0} nodes
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteLearned(e, t.id)}
                  title="Delete template"
                  style={{ background:'none', border:'1px solid #f43f5e33', borderRadius:'6px', color:'#f43f5e88', cursor:'pointer', fontSize:'12px', padding:'4px 8px', flexShrink:0, transition:'all 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f43f5e18'; e.currentTarget.style.color = '#f87171'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#f43f5e88'; }}
                >
                  🗑
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};