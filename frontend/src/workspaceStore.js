// workspaceStore.js — Multi-pipeline workspace layer
// Wraps the pipeline state in named tabs. Each workspace has its own
// nodes/edges/versions/bookmarks/comments. The active workspace is
// synced to localStorage as before.

const WS_KEY = 'pipeline_workspaces';
const WS_ACTIVE_KEY = 'pipeline_active_ws';

const DEFAULT_NAME = 'Pipeline 1';

const emptyWorkspace = (id, name) => ({
  id,
  name,
  nodes:      [],
  edges:      [],
  nodeIDs:    {},
  past:       [],
  future:     [],
  versions:   [],
  comments:   {},
  bookmarks:  [],
  nodeStatus: {},
  cycleEdgeIds: [],  // serialised as array, converted to Set on load
});

export const saveWorkspaces = (workspaces, activeId) => {
  try {
    // Serialise Sets to arrays
    const serialisable = workspaces.map((ws) => ({
      ...ws,
      cycleEdgeIds: [...(ws.cycleEdgeIds instanceof Set ? ws.cycleEdgeIds : new Set(ws.cycleEdgeIds ?? []))],
    }));
    localStorage.setItem(WS_KEY, JSON.stringify(serialisable));
    localStorage.setItem(WS_ACTIVE_KEY, activeId);
  } catch {}
};

export const loadWorkspaces = () => {
  try {
    const raw = localStorage.getItem(WS_KEY);
    if (!raw) return null;
    const workspaces = JSON.parse(raw).map((ws) => ({
      ...ws,
      cycleEdgeIds: new Set(ws.cycleEdgeIds ?? []),
      edges: (ws.edges ?? []).map((e) => ({ ...e, type: 'default', label: '' })),
    }));
    const activeId = localStorage.getItem(WS_ACTIVE_KEY) ?? workspaces[0]?.id;
    return { workspaces, activeId };
  } catch { return null; }
};

export const initWorkspaces = (legacyNodes, legacyEdges) => {
  // Try loading saved workspaces first
  const saved = loadWorkspaces();
  if (saved && saved.workspaces.length > 0) return saved;

  // Otherwise migrate legacy single pipeline
  const id = `ws-${Date.now()}`;
  const ws = emptyWorkspace(id, DEFAULT_NAME);
  ws.nodes = legacyNodes ?? [];
  ws.edges = (legacyEdges ?? []).map((e) => ({ ...e, type: 'default', label: '' }));
  return { workspaces: [ws], activeId: id };
};

export { emptyWorkspace };