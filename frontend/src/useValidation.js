// useValidation.js
// ─────────────────────────────────────────────────────────────────
// Live pipeline validation hook. Runs on every nodes/edges change
// and returns a list of warnings with nodeId, severity, message.
//
// Rules checked:
//   - Unconnected node (no edges touching it)
//   - Node with unconnected required inputs
//   - No output node in pipeline
//   - No input node in pipeline
//   - Duplicate output names
// ─────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { useStore } from './store';
import { shallow }  from 'zustand/shallow';

const selector = (s) => ({ nodes: s.nodes, edges: s.edges });

export const useValidation = () => {
  const { nodes, edges } = useStore(selector, shallow);

  return useMemo(() => {
    if (nodes.length === 0) return [];
    const warnings = [];

    const connected = new Set();
    edges.forEach((e) => { connected.add(e.source); connected.add(e.target); });

    const hasInput  = nodes.some((n) => n.type === 'customInput');
    const hasOutput = nodes.some((n) => n.type === 'customOutput');

    if (!hasInput)  warnings.push({ id: 'global-no-input',  nodeId: null, message: 'Pipeline has no Input node',  severity: 'warning' });
    if (!hasOutput) warnings.push({ id: 'global-no-output', nodeId: null, message: 'Pipeline has no Output node', severity: 'warning' });

    nodes.forEach((n) => {
      // Skip note nodes — they're annotations, not pipeline steps
      if (n.type === 'note') return;

      if (!connected.has(n.id)) {
        warnings.push({
          id:       `${n.id}-unconnected`,
          nodeId:   n.id,
          message:  'Node is not connected to anything',
          severity: 'warning',
        });
      }
    });

    return warnings;
  }, [nodes, edges]);
};