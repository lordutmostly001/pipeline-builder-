// ValidationPanel.js — silent background hook, no UI rendered
import { useEffect, useRef } from 'react';
import { useStore }          from './store';
import { shallow }           from 'zustand/shallow';
import { notify }            from './NotificationStore';

const selector = (s) => ({ nodes: s.nodes, edges: s.edges });

const computeWarnings = (nodes, edges) => {
  const warnings  = [];
  if (nodes.length === 0) return warnings;

  const connected = new Set();
  edges.forEach((e) => { connected.add(e.source); connected.add(e.target); });

  if (!nodes.some((n) => n.type === 'customInput'))
    warnings.push({ id: 'no-input',  message: 'Pipeline has no Input node' });
  if (!nodes.some((n) => n.type === 'customOutput'))
    warnings.push({ id: 'no-output', message: 'Pipeline has no Output node' });

  nodes.forEach((n) => {
    if (n.type === 'note') return;
    if (!connected.has(n.id)) {
      const label = n.type.replace('custom', '').replace(/([A-Z])/g, ' $1').trim();
      warnings.push({ id: `${n.id}-disc`, message: `${label} node is not connected` });
    }
  });

  return warnings;
};

export const ValidationPanel = () => {
  const { nodes, edges } = useStore(selector, shallow);
  const activeRef = useRef(new Set()); // currently active warning IDs

  useEffect(() => {
    const warnings   = computeWarnings(nodes, edges);
    const currentIds = new Set(warnings.map((w) => w.id));

    // 1. Instantly resolve warnings that are no longer valid
    activeRef.current.forEach((id) => {
      if (!currentIds.has(id)) {
        notify.resolve(id);
        activeRef.current.delete(id);
      }
    });

    // 2. Fire new warnings (notify._emit deduplicates by tag, so safe to call)
    warnings.forEach((w) => {
      if (!activeRef.current.has(w.id)) {
        notify.warning(w.message, w.id);
        activeRef.current.add(w.id);
      }
    });
  }, [nodes, edges]);

  return null;
};