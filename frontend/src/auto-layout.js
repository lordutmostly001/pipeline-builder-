// autoLayout.js
// ─────────────────────────────────────────────────────────────────
// Computes optimal node positions using dagre's directed graph
// layout algorithm, then returns updated node positions.
//
// Layout direction: left → right (LR), matching pipeline flow.
// Node dimensions are estimated from type; could be made exact
// by reading DOM rects if needed.
// ─────────────────────────────────────────────────────────────────

import dagre from 'dagre';

const NODE_WIDTH  = 260;
const NODE_HEIGHT = 140;

/**
 * Given ReactFlow nodes + edges, returns a new nodes array with
 * updated x/y positions computed by dagre.
 *
 * @param {object[]} nodes  - ReactFlow nodes
 * @param {object[]} edges  - ReactFlow edges
 * @param {'LR'|'TB'} direction - layout direction
 * @returns {object[]} nodes with updated position
 */
export const getAutoLayoutedNodes = (nodes, edges, direction = 'LR') => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir:  direction,
    nodesep:  60,   // vertical gap between nodes in same rank
    ranksep:  100,  // horizontal gap between ranks
    marginx:  40,
    marginy:  40,
  });

  // Register all nodes
  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Register all edges (dagre only needs source + target)
  edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  // Map computed positions back to ReactFlow nodes
  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return {
      ...node,
      // dagre centers the node; ReactFlow uses top-left corner
      position: {
        x: x - NODE_WIDTH  / 2,
        y: y - NODE_HEIGHT / 2,
      },
    };
  });
};