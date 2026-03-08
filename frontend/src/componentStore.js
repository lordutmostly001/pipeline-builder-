// componentStore.js — Component library persistence (subgraph abstraction)
const KEY = 'pipeline_components';

export const loadComponents = () => {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch { return []; }
};

export const saveComponents = (components) => {
  try { localStorage.setItem(KEY, JSON.stringify(components)); } catch {}
};

// Build port list from boundary nodes of a subgraph
// Inputs: nodes that have an incoming edge from OUTSIDE the subgraph
// Outputs: nodes that have an outgoing edge to OUTSIDE the subgraph
export const detectPorts = (selectedNodeIds, nodes, edges) => {
  const selSet = new Set(selectedNodeIds);
  const inputs  = [];
  const outputs = [];

  edges.forEach((e) => {
    const srcIn = selSet.has(e.source);
    const tgtIn = selSet.has(e.target);
    if (!srcIn && tgtIn) {
      // Edge comes from outside into selected → input port
      const tgtNode = nodes.find((n) => n.id === e.target);
      const portId  = `in_${e.targetHandle ?? e.target}`;
      if (!inputs.find((p) => p.id === portId)) {
        inputs.push({ id: portId, label: tgtNode?.data?.customName || tgtNode?.type || e.target });
      }
    }
    if (srcIn && !tgtIn) {
      // Edge goes from selected to outside → output port
      const srcNode = nodes.find((n) => n.id === e.source);
      const portId  = `out_${e.sourceHandle ?? e.source}`;
      if (!outputs.find((p) => p.id === portId)) {
        outputs.push({ id: portId, label: srcNode?.data?.customName || srcNode?.type || e.source });
      }
    }
  });

  return { inputs, outputs };
};