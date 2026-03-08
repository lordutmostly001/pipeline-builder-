// ShortcutsModal.js — Keyboard shortcuts cheat-sheet with Framer Motion.

import { motion, AnimatePresence } from 'framer-motion';

const isMac = navigator.platform.toUpperCase().includes('MAC');
const mod   = isMac ? '⌘' : 'Ctrl';

const GROUPS = [
  { title: 'History',   items: [{ keys: [mod,'Z'], label:'Undo' }, { keys:[mod,'Y'], label:'Redo' }] },
  { title: 'Selection', items: [
    { keys:[mod,'A'],    label:'Select all nodes' },
    { keys:[mod,'D'],    label:'Duplicate selected' },
    { keys:['Del'], alt:['⌫'], label:'Delete selected' },
    { keys:['Esc'],      label:'Deselect / close modal' },
  ]},
  { title: 'Canvas', items: [
    { keys:[mod,'K'],        label:'Node spotlight search' },
    { keys:[mod,'L'],        label:'Auto-layout pipeline' },
    { keys:[mod,'⇧','F'],  label:'Fit view' },
    { keys:[mod,'Enter'],    label:'Submit pipeline' },
  ]},
  { title: 'File', items: [
    { keys:[mod,'E'],      label:'Export pipeline JSON' },
    { keys:['⇧','drag'],  label:'Multi-select nodes' },
  ]},
  { title: 'Help', items: [{ keys:['?'], label:'Toggle this panel' }] },
];

const Kbd = ({ children }) => (
  <kbd style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:'22px', height:'22px', padding:'0 6px', background:'var(--bg-input)', border:'1px solid #2a3a55', borderBottom:'2px solid #1a2a40', borderRadius:'5px', fontSize:'11px', fontWeight:700, color:'#7a9cc0', lineHeight:1, fontFamily:"'DM Sans',sans-serif" }}>
    {children}
  </kbd>
);

const KeyCombo = ({ keys }) => (
  <div style={{ display:'flex', gap:'3px', alignItems:'center' }}>
    {keys.map((k,i) => (
      <span key={i} style={{ display:'flex', alignItems:'center', gap:'3px' }}>
        {i > 0 && <span style={{ color:'var(--text-hint)', fontSize:'10px' }}>+</span>}
        <Kbd>{k}</Kbd>
      </span>
    ))}
  </div>
);

export const ShortcutsModal = ({ onClose }) => (
  <AnimatePresence>
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'#000a', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}
    >
      <motion.div
        key="panel"
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type:'spring', stiffness:380, damping:30 }}
        onClick={(e) => e.stopPropagation()}
        style={{ background:'var(--bg-modal)', border:'1px solid var(--border)', borderRadius:'16px', padding:'24px 28px', width:'420px', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 24px 64px #000c', fontFamily:"'DM Sans','Segoe UI',sans-serif" }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <div style={{ fontSize:'16px', fontWeight:800, color:'var(--text-primary)' }}>⌨️ Keyboard Shortcuts</div>
            <div style={{ fontSize:'11px', color:'var(--text-dim)', marginTop:'2px' }}>Press <strong style={{ color:'#5a6a8a' }}>?</strong> to toggle</div>
          </div>
          <button onClick={onClose} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text-secondary)', cursor:'pointer', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>✕</button>
        </div>

        {GROUPS.map((group) => (
          <div key={group.title} style={{ marginBottom:'14px' }}>
            <div style={{ fontSize:'9px', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:'6px' }}>{group.title}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              {group.items.map(({ keys, alt, label }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', background:'var(--bg-card)', border:'1px solid #1a2540', borderRadius:'8px' }}>
                  <span style={{ fontSize:'12px', color:'#8899bb' }}>{label}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <KeyCombo keys={keys} />
                    {alt && <><span style={{ fontSize:'10px', color:'var(--text-hint)' }}>or</span><KeyCombo keys={alt} /></>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginTop:'8px', fontSize:'11px', color:'var(--text-hint)', textAlign:'center' }}>Click outside to close</div>
      </motion.div>
    </motion.div>
  </AnimatePresence>
);