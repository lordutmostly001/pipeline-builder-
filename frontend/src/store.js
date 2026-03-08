// store.js — Central Zustand store for the pipeline editor.
// Supports multi-pipeline workspaces. Each workspace has its own
// nodes/edges/versions/bookmarks/comments. Active workspace is synced
// to the top-level state for backward compatibility with all components.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { toast } from './NotificationStore';
import { saveTheme, loadTheme, savePipeline, loadPipeline, clearSavedPipeline } from './persist';
import { detectCycleEdges } from './edgeUtils';
import { recordConnection, recordChains } from './PatternTracker';
import { initWorkspaces, emptyWorkspace, saveWorkspaces } from './workspaceStore';

const MAX_HISTORY = 50;

// ── Node type → accent color map ─────────────────────────────────
export const NODE_COLORS = {
  customInput:  '#3b82f6', llm: '#8b5cf6', customOutput: '#10b981',
  text: '#f59e0b', filter: '#ec4899', merge: '#06b6d4',
  api: '#f97316', transform: '#a855f7', condition: '#f43f5e',
  timer: '#0ea5e9', note: '#fbbf24',
  component: '#64748b',  // subgraph component node
};

const makeEdge = (connection) => ({
  ...connection,
  type: 'default', animated: false, label: '',
});

// ── Initialise ───────────────────────────────────────────────────
const _legacy  = loadPipeline();
const _theme   = loadTheme();
const _init    = initWorkspaces(_legacy?.nodes, _legacy?.edges);

// Extract active workspace into top-level for backward compat
const _active  = _init.workspaces.find((ws) => ws.id === _init.activeId) ?? _init.workspaces[0];

// ── Helper: read active workspace fields ─────────────────────────
const fromActive = (workspaces, activeId) => {
  const ws = workspaces.find((w) => w.id === activeId);
  if (!ws) return {};
  return {
    nodes:        ws.nodes,
    edges:        ws.edges,
    nodeIDs:      ws.nodeIDs,
    past:         ws.past,
    future:       ws.future,
    versions:     ws.versions,
    comments:     ws.comments,
    bookmarks:    ws.bookmarks,
    nodeStatus:   ws.nodeStatus,
    cycleEdgeIds: ws.cycleEdgeIds instanceof Set ? ws.cycleEdgeIds : new Set(ws.cycleEdgeIds ?? []),
  };
};

// ── Helper: patch active workspace ───────────────────────────────
const patchActive = (workspaces, activeId, patch) =>
  workspaces.map((ws) => ws.id === activeId ? { ...ws, ...patch } : ws);

export const useStore = create(devtools((set, get) => ({
  // ── Workspace management ──────────────────────────────────────
  workspaces:  _init.workspaces,
  activeId:    _init.activeId,

  // ── Active workspace fields (top-level for backward compat) ──
  nodes:        _active.nodes,
  edges:        _active.edges,
  nodeIDs:      _active.nodeIDs      ?? {},
  past:         _active.past         ?? [],
  future:       _active.future       ?? [],
  versions:     _active.versions     ?? [],
  comments:     _active.comments     ?? {},
  bookmarks:    _active.bookmarks    ?? [],
  nodeStatus:   _active.nodeStatus   ?? {},
  cycleEdgeIds: _active.cycleEdgeIds instanceof Set
    ? _active.cycleEdgeIds
    : new Set(_active.cycleEdgeIds ?? []),

  // ── Global state ─────────────────────────────────────────────
  theme:            _theme,
  recommendations:  [],

  // ── Internal: sync active workspace to store top-level ────────
  _syncFromActive: () => {
    const { workspaces, activeId } = get();
    const fields = fromActive(workspaces, activeId);
    set(fields);
  },

  // ── Internal: flush current top-level into active workspace ───
  _flushToActive: (patch) => {
    const { workspaces, activeId } = get();
    const updated = patchActive(workspaces, activeId, patch);
    set({ workspaces: updated });
    saveWorkspaces(updated, activeId);
  },

  // ── Workspace CRUD ────────────────────────────────────────────
  createWorkspace: (name) => {
    const id = `ws-${Date.now()}`;
    const ws = emptyWorkspace(id, name || `Pipeline ${get().workspaces.length + 1}`);
    const workspaces = [...get().workspaces, ws];
    set({ workspaces, activeId: id, ...fromActive(workspaces, id) });
    saveWorkspaces(workspaces, id);
    toast.success(`Created "${ws.name}"`);
    return id;
  },

  switchWorkspace: (id) => {
    // Flush current top-level state to the current active workspace first
    const { workspaces, activeId, nodes, edges, nodeIDs, past, future,
            versions, comments, bookmarks, nodeStatus, cycleEdgeIds } = get();
    const flushed = patchActive(workspaces, activeId, {
      nodes, edges, nodeIDs, past, future, versions, comments, bookmarks, nodeStatus, cycleEdgeIds,
    });
    const fields = fromActive(flushed, id);
    set({ workspaces: flushed, activeId: id, ...fields });
    saveWorkspaces(flushed, id);
  },

  renameWorkspace: (id, name) => {
    const workspaces = get().workspaces.map((ws) => ws.id === id ? { ...ws, name } : ws);
    set({ workspaces });
    saveWorkspaces(workspaces, get().activeId);
  },

  deleteWorkspace: (id) => {
    const { workspaces, activeId } = get();
    if (workspaces.length <= 1) { toast.error('Cannot delete the last pipeline'); return; }
    const remaining = workspaces.filter((ws) => ws.id !== id);
    const newActive = activeId === id ? remaining[0].id : activeId;
    const fields = fromActive(remaining, newActive);
    set({ workspaces: remaining, activeId: newActive, ...fields });
    saveWorkspaces(remaining, newActive);
    toast.success('Pipeline deleted');
  },

  duplicateWorkspace: (id) => {
    const source = get().workspaces.find((ws) => ws.id === id);
    if (!source) return;
    const newId = `ws-${Date.now()}`;
    const copy = { ...source, id: newId, name: `${source.name} (copy)`, past: [], future: [] };
    const workspaces = [...get().workspaces, copy];
    set({ workspaces, activeId: newId, ...fromActive(workspaces, newId) });
    saveWorkspaces(workspaces, newId);
    toast.success(`Duplicated "${source.name}"`);
  },

  // ── History ──────────────────────────────────────────────────
  _snapshot: () => {
    const { nodes, edges, past } = get();
    const newPast = [...past, { nodes, edges }].slice(-MAX_HISTORY);
    set({ past: newPast, future: [] });
    get()._flushToActive({ past: newPast, future: [] });
  },

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (!past.length) return;
    const newState = { nodes: past.at(-1).nodes, edges: past.at(-1).edges, past: past.slice(0,-1), future: [{ nodes, edges }, ...future] };
    set(newState);
    get()._flushToActive(newState);
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (!future.length) return;
    const newState = { nodes: future[0].nodes, edges: future[0].edges, past: [...past, { nodes, edges }], future: future.slice(1) };
    set(newState);
    get()._flushToActive(newState);
  },

  // ── Theme ────────────────────────────────────────────────────
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    saveTheme(next);
    return { theme: next };
  }),

  // ── Node status ──────────────────────────────────────────────
  setNodeStatus: (nodeId, status) =>
    set((s) => ({ nodeStatus: { ...s.nodeStatus, [nodeId]: status } })),
  clearNodeStatuses: () => set({ nodeStatus: {} }),

  // ── Node collapse ────────────────────────────────────────────
  toggleNodeCollapsed: (nodeId) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, collapsed: !n.data?.collapsed } } : n
      ),
    })),

  // ── IDs ──────────────────────────────────────────────────────
  getNodeID: (type) => {
    const newIDs = { ...get().nodeIDs };
    newIDs[type] = (newIDs[type] ?? 0) + 1;
    set({ nodeIDs: newIDs });
    get()._flushToActive({ nodeIDs: newIDs });
    return `${type}-${newIDs[type]}`;
  },

  // ── Canvas mutations ─────────────────────────────────────────
  addNode: (node) => {
    get()._snapshot();
    const nodes = [...get().nodes, node];
    set({ nodes });
    get()._flushToActive({ nodes });
    savePipeline(nodes, get().edges);
  },

  onNodesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get()._snapshot();
    const nodes = applyNodeChanges(changes, get().nodes);
    const cycleEdgeIds = changes.some((c) => c.type === 'remove')
      ? detectCycleEdges(nodes, get().edges)
      : get().cycleEdgeIds;
    set({ nodes, cycleEdgeIds });
    get()._flushToActive({ nodes, cycleEdgeIds });
  },

  onEdgesChange: (changes) => {
    if (changes.some((c) => c.type === 'remove')) get()._snapshot();
    const edges = applyEdgeChanges(changes, get().edges);
    const cycleEdgeIds = detectCycleEdges(get().nodes, edges);
    set({ edges, cycleEdgeIds });
    get()._flushToActive({ edges, cycleEdgeIds });
  },

  onConnect: (connection) => {
    get()._snapshot();
    const edges = addEdge(makeEdge(connection), get().edges);
    const cycles = detectCycleEdges(get().nodes, edges);
    set({ edges, cycleEdgeIds: cycles });
    get()._flushToActive({ edges, cycleEdgeIds: cycles });
    if (cycles.size > 0) toast.warning('⚠️ Cycle detected — this connection creates a loop');
    savePipeline(get().nodes, edges);
    const nodes = get().nodes;
    const srcNode = nodes.find((n) => n.id === connection.source);
    const tgtNode = nodes.find((n) => n.id === connection.target);
    if (srcNode && tgtNode) { recordConnection(srcNode.type, tgtNode.type); recordChains(nodes, edges); }
  },

  updateNodeField: (nodeId, fieldName, fieldValue) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, [fieldName]: fieldValue } } : n
    );
    set({ nodes });
    get()._flushToActive({ nodes });
  },

  updateEdge: (edgeId, patch) => {
    const edges = get().edges.map((e) => e.id === edgeId ? { ...e, ...patch } : e);
    set({ edges });
    get()._flushToActive({ edges });
  },

  // ── Versions ────────────────────────────────────────────────
  saveVersion: (name) => {
    const { nodes, edges, versions } = get();
    const v = { id: Date.now(), name: name || `v${versions.length + 1}`, timestamp: Date.now(), nodes, edges };
    const newVersions = [...versions, v].slice(-20);
    set({ versions: newVersions });
    get()._flushToActive({ versions: newVersions });
    toast.success(`Version "${v.name}" saved`);
  },
  loadVersion: (id) => {
    const v = get().versions.find((v) => v.id === id);
    if (!v) return;
    get()._snapshot();
    const nodes = v.nodes;
    const edges = v.edges.map((e) => ({ ...e, type: 'default', label: '' }));
    set({ nodes, edges, nodeStatus: {} });
    get()._flushToActive({ nodes, edges, nodeStatus: {} });
    toast.success(`Loaded "${v.name}"`);
  },
  deleteVersion: (id) => {
    const versions = get().versions.filter((v) => v.id !== id);
    set({ versions });
    get()._flushToActive({ versions });
  },

  // ── Comments ────────────────────────────────────────────────
  setComment: (nodeId, text) => {
    const comments = { ...get().comments, [nodeId]: text };
    set({ comments });
    get()._flushToActive({ comments });
  },
  deleteComment: (nodeId) => {
    const comments = { ...get().comments };
    delete comments[nodeId];
    set({ comments });
    get()._flushToActive({ comments });
  },

  // ── Bookmarks ───────────────────────────────────────────────
  addBookmark: (bm) => {
    const bookmarks = [...get().bookmarks, { id: Date.now(), ...bm }];
    set({ bookmarks });
    get()._flushToActive({ bookmarks });
  },
  deleteBookmark: (id) => {
    const bookmarks = get().bookmarks.filter((b) => b.id !== id);
    set({ bookmarks });
    get()._flushToActive({ bookmarks });
  },

  clearCanvas: () => {
    get()._snapshot();
    set({ nodes: [], edges: [], nodeStatus: {} });
    get()._flushToActive({ nodes: [], edges: [], nodeStatus: {} });
    clearSavedPipeline();
  },

  duplicateSelected: () => {
    const selected = get().nodes.filter((n) => n.selected);
    if (!selected.length) return;
    get()._snapshot();
    const newNodes = selected.map((n) => {
      const newIDs = { ...get().nodeIDs };
      newIDs[n.type] = (newIDs[n.type] ?? 0) + 1;
      const newId = `${n.type}-${newIDs[n.type]}`;
      set({ nodeIDs: newIDs });
      return { ...n, id: newId, position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: false, data: { ...n.data, id: newId } };
    });
    const nodes = [...get().nodes.map((n) => ({ ...n, selected: false })), ...newNodes];
    set({ nodes });
    get()._flushToActive({ nodes });
  },

  // ── Export / Import ─────────────────────────────────────────
  exportJSON: () => {
    const { nodes, edges } = get();
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'pipeline.json'; a.click(); URL.revokeObjectURL(url);
  },

  exportYAML: () => {
    const { nodes, edges } = get();
    const NL = { customInput:'Input',llm:'LLM',customOutput:'Output',text:'Text',filter:'Filter',merge:'Merge',api:'API',transform:'Transform',condition:'Condition',timer:'Timer',note:'Note' };
    const lines = ['pipeline:','  nodes:',...nodes.map((n)=>`    - id: ${n.id}\n      type: ${NL[n.type]??n.type}\n      position: { x: ${Math.round(n.position.x)}, y: ${Math.round(n.position.y)} }`),'  edges:',...edges.map((e)=>`    - source: ${e.source}\n      target: ${e.target}`)];
    const blob = new Blob([lines.join('\n')],{type:'text/yaml'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='pipeline.yaml'; a.click(); URL.revokeObjectURL(url);
  },

  exportGraphviz: () => {
    const { nodes, edges } = get();
    const NL = { customInput:'Input',llm:'LLM',customOutput:'Output',text:'Text',filter:'Filter',merge:'Merge',api:'API',transform:'Transform',condition:'Condition',timer:'Timer',note:'Note' };
    const dot = `digraph Pipeline {\n  rankdir=LR;\n  node [shape=box, style=rounded];\n${nodes.map((n)=>`  "${n.id}" [label="${NL[n.type]??n.type}\\n${n.id}"];`).join('\n')}\n${edges.map((e)=>`  "${e.source}" -> "${e.target}";`).join('\n')}\n}`;
    const blob = new Blob([dot],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download='pipeline.dot'; a.click(); URL.revokeObjectURL(url);
  },

  exportImage: async () => {
    try {
      if (window.html2canvas) {
        const canvas = await window.html2canvas(document.querySelector('.react-flow__renderer'),{backgroundColor:null,scale:2,useCORS:true,logging:false});
        const a = document.createElement('a'); a.download='pipeline.png'; a.href=canvas.toDataURL('image/png'); a.click();
        toast.success('Pipeline exported as PNG');
      } else { toast.warning('html2canvas not loaded — install it for image export'); }
    } catch (e) { toast.error('Image export failed: '+e.message); }
  },

  importJSON: (json) => {
    try {
      const { nodes, edges } = JSON.parse(json);
      get()._snapshot();
      set({ nodes: nodes??[], edges: edges??[], nodeStatus:{} });
      get()._flushToActive({ nodes: nodes??[], edges: edges??[], nodeStatus:{} });
    } catch { toast.error('Invalid pipeline JSON — could not import.'); }
  },

  loadTemplate: (template) => {
    get()._snapshot();
    const styledEdges  = (template.edges??[]).map((e)=>makeEdge(e));
    const cycleEdgeIds = detectCycleEdges(template.nodes, styledEdges);
    set({ nodes: template.nodes, edges: styledEdges, nodeStatus:{}, cycleEdgeIds });
    get()._flushToActive({ nodes: template.nodes, edges: styledEdges, nodeStatus:{}, cycleEdgeIds });
    savePipeline(template.nodes, styledEdges);
  },

  // ── Auto layout ─────────────────────────────────────────────
  autoLayout: () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) return;

    const COL_GAP = 200; const ROW_GAP = 90;
    const NODE_SIZES = { customInput:{w:240,h:160},customOutput:{w:240,h:160},llm:{w:280,h:220},text:{w:290,h:200},filter:{w:320,h:260},merge:{w:270,h:190},api:{w:270,h:210},transform:{w:280,h:195},condition:{w:310,h:230},timer:{w:260,h:185},note:{w:230,h:110} };
    const sz = (n) => NODE_SIZES[n.type] ?? { w:260, h:180 };

    const noteNodes   = nodes.filter((n) => n.type === 'note');
    const layoutNodes = nodes.filter((n) => n.type !== 'note');
    const nodeIds = new Set(layoutNodes.map((n) => n.id));

    const adj={}, inDeg={};
    layoutNodes.forEach((n) => { adj[n.id]=[]; inDeg[n.id]=0; });
    edges.forEach((e) => { if (nodeIds.has(e.source)&&nodeIds.has(e.target)) { adj[e.source].push(e.target); inDeg[e.target]++; } });

    const rank={};
    const queue=layoutNodes.filter((n)=>inDeg[n.id]===0).map((n)=>n.id);
    queue.forEach((id)=>{rank[id]=0;});
    const visited=new Set(queue); let head=0;
    while(head<queue.length){ const cur=queue[head++]; for(const nb of adj[cur]){ rank[nb]=Math.max(rank[nb]??0,rank[cur]+1); if(!visited.has(nb)){visited.add(nb);queue.push(nb);} } }
    layoutNodes.forEach((n)=>{if(rank[n.id]===undefined)rank[n.id]=0;});

    const maxRank=Math.max(0,...Object.values(rank));
    const effectiveRank={...rank};
    layoutNodes.forEach((n)=>{ if(n.type==='customInput') effectiveRank[n.id]=0; else if(n.type==='customOutput') effectiveRank[n.id]=Math.max(maxRank,1); });

    const hasInput=layoutNodes.some((n)=>n.type==='customInput');
    const hasOutput=layoutNodes.some((n)=>n.type==='customOutput');
    if(hasInput&&hasOutput){ const finalMax=Math.max(...Object.values(effectiveRank)); const midRank=Math.round(finalMax/2); layoutNodes.forEach((n)=>{ if(n.type==='llm'){ const tr=rank[n.id]; if(tr>0&&tr<finalMax) effectiveRank[n.id]=midRank; } }); }

    const columns={};
    layoutNodes.forEach((n)=>{ const r=effectiveRank[n.id]; if(!columns[r])columns[r]=[]; columns[r].push(n.id); });
    const ROLE_ORDER={customInput:0,llm:1,merge:2,transform:3,filter:4,condition:5,api:6,text:7,timer:8,customOutput:9};
    Object.values(columns).forEach((col)=>{ col.sort((a,b)=>{ const na=layoutNodes.find((n)=>n.id===a),nb=layoutNodes.find((n)=>n.id===b); return (ROLE_ORDER[na?.type]??5)-(ROLE_ORDER[nb?.type]??5)||a.localeCompare(b); }); });

    const sortedRanks=Object.keys(columns).map(Number).sort((a,b)=>a-b);
    const colX={}; let curX=80;
    sortedRanks.forEach((r)=>{ colX[r]=curX; const maxW=Math.max(...columns[r].map((id)=>{ const n=layoutNodes.find((nd)=>nd.id===id); return sz(n).w; })); curX+=maxW+COL_GAP; });

    const positions={};
    sortedRanks.forEach((r)=>{ const col=columns[r]; const nodeList=col.map((id)=>layoutNodes.find((n)=>n.id===id)); const heights=nodeList.map((n)=>sz(n).h); const gaps=nodeList.map((n)=>n?.type==='llm'?ROW_GAP*1.4:ROW_GAP); const totalH=heights.reduce((s,h)=>s+h,0)+gaps.slice(0,-1).reduce((s,g)=>s+g,0); let y=-(totalH/2); col.forEach((id,i)=>{ positions[id]={x:colX[r],y}; y+=heights[i]+(gaps[i]??ROW_GAP); }); });

    const notePositions={};
    const allNoteEdges=edges.filter((e)=>noteNodes.some((n)=>n.id===e.source||n.id===e.target));
    noteNodes.forEach((note)=>{ const connected=allNoteEdges.map((e)=>(e.source===note.id?e.target:e.source===note.id?e.target:null)).filter(Boolean).find((id)=>positions[id]); if(connected&&positions[connected]){ const anchor=positions[connected]; const anchorNode=layoutNodes.find((n)=>n.id===connected); const anchorW=anchorNode?sz(anchorNode).w:260; notePositions[note.id]={x:anchor.x+anchorW/2-sz(note).w/2,y:anchor.y-sz(note).h-50}; } else { const allX=Object.values(positions).map((p)=>p.x); const allY=Object.values(positions).map((p)=>p.y); const centerX=allX.length?(Math.min(...allX)+Math.max(...allX))/2:400; const topY=allY.length?Math.min(...allY):0; notePositions[note.id]={x:centerX-sz(note).w/2,y:topY-sz(note).h-60}; } });

    get()._snapshot();
    const laid=nodes.map((n)=>({...n,position:positions[n.id]??notePositions[n.id]??n.position}));
    set({nodes:laid});
    get()._flushToActive({nodes:laid});
    savePipeline(laid,edges);
  },
}), { name: 'PipelineStore' }));