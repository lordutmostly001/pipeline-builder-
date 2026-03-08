// useKeyboardShortcuts.js — Must be called inside <ReactFlow> tree via FlowInner.

import { useEffect }   from 'react';
import { useStore }    from './store';
import { useReactFlow } from 'reactflow';
import { toast }       from './Toast';

export const useKeyboardShortcuts = ({ onSubmit, onToggleHelp, onCloseModal, onToggleSpotlight }) => {
  const undo              = useStore((s) => s.undo);
  const redo              = useStore((s) => s.redo);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const exportJSON        = useStore((s) => s.exportJSON);
  const autoLayout        = useStore((s) => s.autoLayout);
  const { fitView, setNodes } = useReactFlow();

  useEffect(() => {
    const handler = (e) => {
      const meta     = e.ctrlKey || e.metaKey;
      const key      = e.key.toLowerCase();
      const tag      = document.activeElement?.tagName ?? '';
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

      // Ctrl+Y — Redo
      if (meta && key === 'y')                         { e.preventDefault(); e.stopPropagation(); redo(); return; }
      // Ctrl+Z — Undo
      if (meta && !e.shiftKey && key === 'z')          { e.preventDefault(); e.stopPropagation(); undo(); return; }
      // Ctrl+A — Select all
      if (meta && key === 'a' && !isTyping)            { e.preventDefault(); setNodes((n) => n.map((nd) => ({ ...nd, selected: true }))); return; }
      // Ctrl+D — Duplicate
      if (meta && key === 'd' && !isTyping)            { e.preventDefault(); duplicateSelected(); return; }
      // Ctrl+L — Auto layout
      if (meta && key === 'l' && !isTyping)            { e.preventDefault(); autoLayout(); toast.success('Pipeline auto-arranged ✨'); return; }
      // Ctrl+Enter — Submit
      if (meta && e.key === 'Enter')                   { e.preventDefault(); onSubmit?.(); return; }
      // Ctrl+Shift+F — Fit view
      if (meta && e.shiftKey && key === 'f')           { e.preventDefault(); fitView({ padding: 0.15, duration: 400 }); return; }
      // Ctrl+K — Spotlight
      if (meta && key === 'k' && !isTyping)            { e.preventDefault(); onToggleSpotlight?.(); return; }
      // Ctrl+E — Export
      if (meta && key === 'e' && !isTyping)            { e.preventDefault(); exportJSON(); return; }
      // Escape
      if (e.key === 'Escape')                          { onCloseModal?.(); setNodes((n) => n.map((nd) => ({ ...nd, selected: false }))); return; }
      // ? — Help
      if (e.key === '?' && !isTyping)                  { e.preventDefault(); onToggleHelp?.(); return; }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [undo, redo, duplicateSelected, autoLayout, exportJSON, fitView, setNodes, onSubmit, onToggleHelp, onCloseModal, onToggleSpotlight]);
};