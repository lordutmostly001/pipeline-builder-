// edgeUtils.js — shared edge styling + live cycle detection

export const EDGE_DEFAULT  = { stroke: '#3b82f6', strokeWidth: 1.5 };
export const EDGE_HOVER    = { stroke: '#60a5fa', strokeWidth: 3   };
export const EDGE_ANIMATED = { stroke: '#6366f1', strokeWidth: 2.5 };
export const EDGE_CYCLE    = { stroke: '#f43f5e', strokeWidth: 2.5 };

// ── Client-side cycle detection (DFS back-edge finder) ───────────
// Returns a Set of ALL edge IDs that participate in any cycle.
export const detectCycleEdges = (nodes, edges) => {
  const adj = {};  // nodeId → [{ edgeId, target }]
  const edgeMap = {}; // edgeId → edge
  nodes.forEach((n) => { adj[n.id] = []; });
  edges.forEach((e) => {
    edgeMap[e.id] = e;
    if (adj[e.source]) adj[e.source].push({ edgeId: e.id, target: e.target });
  });

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  nodes.forEach((n) => { color[n.id] = WHITE; });

  // Track the DFS path (stack of node ids + edge ids used to reach them)
  const nodeStack  = [];  // node ids in current DFS path
  const edgeStack  = [];  // edge ids used to reach each node in path
  const cycleEdgeIds = new Set();

  const dfs = (id) => {
    color[id] = GRAY;
    nodeStack.push(id);

    for (const { edgeId, target } of (adj[id] ?? [])) {
      edgeStack.push(edgeId);

      if (color[target] === GRAY) {
        // Found a back-edge — walk back up the stack to collect
        // ALL edges in this cycle (from target's position to current)
        const cycleStart = nodeStack.indexOf(target);
        for (let i = cycleStart; i < edgeStack.length; i++) {
          cycleEdgeIds.add(edgeStack[i]);
        }
      } else if (color[target] === WHITE) {
        dfs(target);
      }

      edgeStack.pop();
    }

    nodeStack.pop();
    color[id] = BLACK;
  };

  nodes.forEach((n) => { if (color[n.id] === WHITE) dfs(n.id); });
  return cycleEdgeIds;
};

// ── Build per-edge style ─────────────────────────────────────────
export const buildEdgeStyle = ({ edge, hoveredNodeId, animating, cycleEdgeIds }) => {
  const connected = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
  const isCycle   = cycleEdgeIds?.has(edge.id);
  const isAnim    = animating && !isCycle;

  if (isCycle)   return { ...EDGE_CYCLE,    strokeDasharray: '6 4' };
  if (connected) return { ...EDGE_HOVER };
  if (isAnim)    return { ...EDGE_ANIMATED, strokeDasharray: '6 4' };
  return EDGE_DEFAULT;
};

// ── Map backend result → cycle edge ids (fallback) ───────────────
export const getCycleEdgeIds = (edges, result) => {
  if (!result || result.is_dag) return new Set();
  if (result.cycle_edges) return new Set(result.cycle_edges);
  return new Set(edges.map((e) => e.id));
};