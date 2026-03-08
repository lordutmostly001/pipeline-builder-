// graphAnalytics.js — Full DAG analysis suite

// ── Node mock latencies (ms) for execution time simulation ────────
const NODE_LATENCY = {
  customInput: 50,  llm: 2000, customOutput: 50,
  text: 100, filter: 150, merge: 100,
  api: 500,  transform: 200, condition: 100,
  timer: 300, note: 0,
};

export const analyzeGraph = (nodes, edges) => {
  if (nodes.length === 0) return null;

  const nodeIds = new Set(nodes.map((n) => n.id));
  const adj     = {};   // id → [target ids]
  const radj    = {};   // id → [source ids] (reverse)
  const inDeg   = {};
  const edgeAdj = {};   // id → [{ edgeId, target }]

  nodes.forEach((n) => { adj[n.id] = []; radj[n.id] = []; inDeg[n.id] = 0; edgeAdj[n.id] = []; });
  edges.forEach((e) => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      adj[e.source].push(e.target);
      radj[e.target].push(e.source);
      edgeAdj[e.source].push({ edgeId: e.id, target: e.target });
      inDeg[e.target]++;
    }
  });

  const nonNote = nodes.filter((n) => n.type !== 'note');
  const sources = nonNote.filter((n) => inDeg[n.id] === 0);
  const sinks   = nonNote.filter((n) => adj[n.id].length === 0);
  const branches = nodes.filter((n) => adj[n.id].length >= 2);

  // ── Topological sort (Kahn's) + longest path ─────────────────────
  const dist     = {};  // longest path length to node
  const distTime = {};  // longest path latency to node
  nodes.forEach((n) => { dist[n.id] = 0; distTime[n.id] = 0; });

  const inDegCopy = { ...inDeg };
  const queue     = sources.map((n) => n.id);
  const topoOrder = [];
  const visited   = new Set(queue);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    topoOrder.push(cur);
    for (const nb of adj[cur]) {
      dist[nb]     = Math.max(dist[nb],     dist[cur] + 1);
      distTime[nb] = Math.max(distTime[nb], distTime[cur] + (NODE_LATENCY[nodes.find(n=>n.id===cur)?.type] ?? 100));
      inDegCopy[nb]--;
      if (inDegCopy[nb] === 0 && !visited.has(nb)) { visited.add(nb); queue.push(nb); }
    }
  }

  const isDAG = topoOrder.length === nonNote.length || nonNote.length === 0;
  const depth = topoOrder.length ? Math.max(...topoOrder.map((id) => dist[id])) + 1 : 1;

  // ── Critical path (longest latency path) ─────────────────────────
  // Work backwards from the sink with highest distTime
  const criticalPath = (() => {
    if (!isDAG || sinks.length === 0) return { nodeIds: new Set(), edgeIds: new Set(), totalMs: 0 };
    const bestSink = sinks.reduce((a, b) => distTime[a.id] >= distTime[b.id] ? a : b);
    const pathNodes = new Set();
    const pathEdges = new Set();
    const totalMs   = distTime[bestSink.id] + (NODE_LATENCY[bestSink.type] ?? 100);

    // Trace back greedily via reverse adj
    let cur = bestSink.id;
    pathNodes.add(cur);
    while (radj[cur]?.length > 0) {
      const prev    = radj[cur].reduce((a, b) => distTime[a] >= distTime[b] ? a : b);
      const curSnap = cur;  // snapshot so arrow fn doesn't close over mutable `cur`
      const e = edges.find((ed) => ed.source === prev && ed.target === curSnap);
      if (e) pathEdges.add(e.id);
      pathNodes.add(prev);
      cur = prev;
    }
    return { nodeIds: pathNodes, edgeIds: pathEdges, totalMs };
  })();

  // ── Dead node detection (can't reach any sink) ───────────────────
  // BFS backwards from all sinks
  const reachableFromSink = new Set();
  const rQueue = sinks.map((n) => n.id);
  let ri = 0;
  while (ri < rQueue.length) {
    const cur = rQueue[ri++];
    reachableFromSink.add(cur);
    for (const prev of (radj[cur] ?? [])) {
      if (!reachableFromSink.has(prev)) rQueue.push(prev);
    }
  }
  const deadNodes = nonNote.filter((n) => !reachableFromSink.has(n.id) && sinks.length > 0);

  // ── Articulation points (bottlenecks) — Tarjan's algorithm ───────
  const articulationPoints = (() => {
    if (nodes.length < 3) return new Set();
    const visited2 = {}, disc = {}, low = {}, parent = {};
    const ap = new Set();
    let timer = 0;

    // Use undirected adjacency for AP detection
    const uAdj = {};
    nodes.forEach((n) => { uAdj[n.id] = new Set(); });
    edges.forEach((e) => {
      if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
        uAdj[e.source].add(e.target);
        uAdj[e.target].add(e.source);
      }
    });

    const dfs = (u) => {
      visited2[u] = true;
      disc[u] = low[u] = timer++;
      let children = 0;
      for (const v of uAdj[u]) {
        if (!visited2[v]) {
          children++;
          parent[v] = u;
          dfs(v);
          low[u] = Math.min(low[u], low[v]);
          if (!parent[u] && children > 1) ap.add(u);
          if (parent[u] && low[v] >= disc[u]) ap.add(u);
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    };
    nodes.forEach((n) => { if (!visited2[n.id]) dfs(n.id); });
    return ap;
  })();

  // ── Complexity score (McCabe-inspired) ───────────────────────────
  const density      = nodes.length > 1 ? edges.length / nodes.length : 0;
  const branchFactor = nodes.length > 0 ? branches.length / nodes.length : 0;
  const cyclePenalty = isDAG ? 0 : 2;
  const rawScore     = density + branchFactor * 2 + cyclePenalty + (articulationPoints.size * 0.5);
  const complexity   = rawScore < 1.2 ? 'Simple' : rawScore < 2.5 ? 'Moderate' : rawScore < 4 ? 'Complex' : 'Very Complex';
  const complexityColor = { Simple: '#10b981', Moderate: '#f59e0b', Complex: '#f97316', 'Very Complex': '#f43f5e' }[complexity];

  // ── Estimated critical path runtime ──────────────────────────────
  const estimatedMs = criticalPath.totalMs;
  const estimatedLabel = estimatedMs < 1000
    ? `~${estimatedMs}ms`
    : `~${(estimatedMs / 1000).toFixed(1)}s`;

  // ── Node type usage counts ────────────────────────────────────────
  const typeCounts = nodes.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1; return acc;
  }, {});

  return {
    nodeCount: nodes.length, edgeCount: edges.length,
    depth, sources: sources.length, sinks: sinks.length, branches: branches.length,
    typeCounts, isDAG, topoOrder,
    criticalPath,       // { nodeIds: Set, edgeIds: Set, totalMs }
    deadNodes,          // Node[]
    articulationPoints, // Set<nodeId>
    complexity, complexityColor,
    estimatedMs, estimatedLabel,
    distTime,           // { [nodeId]: ms } — for minimap heatmap
  };
};

// ── Pipeline Linter ───────────────────────────────────────────────
export const lintPipeline = (nodes, edges) => {
  const warnings = [];
  if (nodes.length === 0) return warnings;

  const nodeIds = new Set(nodes.map((n) => n.id));
  const inDeg   = {};
  const outDeg  = {};
  nodes.forEach((n) => { inDeg[n.id] = 0; outDeg[n.id] = 0; });
  edges.forEach((e) => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      outDeg[e.source]++;
      inDeg[e.target]++;
    }
  });

  const nonNote = nodes.filter((n) => n.type !== 'note');
  const outputs = nodes.filter((n) => n.type === 'customOutput');
  const inputs  = nodes.filter((n) => n.type === 'customInput');
  const llms    = nodes.filter((n) => n.type === 'llm');
  const merges  = nodes.filter((n) => n.type === 'merge');
  const apis    = nodes.filter((n) => n.type === 'api');

  // ── Structural rules ──
  if (outputs.length === 0 && nonNote.length > 0)
    warnings.push({ id: 'no-output',    level: 'error',   msg: 'No Output node — pipeline has no destination', nodeId: null, action: 'customOutput' });
  if (inputs.length === 0 && nonNote.length > 0)
    warnings.push({ id: 'no-input',     level: 'error',   msg: 'No Input node — pipeline has no data source',  nodeId: null, action: 'customInput'  });
  if (outputs.length > 1)
    warnings.push({ id: 'multi-output', level: 'warning', msg: `${outputs.length} Output nodes — consider merging them`, nodeId: null });

  // ── Node-level rules ──
  llms.forEach((n) => {
    if (inDeg[n.id] === 0)
      warnings.push({ id: `llm-no-input-${n.id}`, level: 'warning', msg: 'LLM node has no inputs — needs a prompt', nodeId: n.id });
  });

  merges.forEach((n) => {
    if (inDeg[n.id] < 2)
      warnings.push({ id: `merge-single-${n.id}`, level: 'info', msg: 'Merge node has only 1 input — needs 2+ to be useful', nodeId: n.id });
  });

  apis.forEach((n) => {
    if (!n.data?.endpointUrl || n.data.endpointUrl === 'https://api.example.com/endpoint')
      warnings.push({ id: `api-default-${n.id}`, level: 'info', msg: 'API node still has placeholder URL', nodeId: n.id });
  });

  nonNote.forEach((n) => {
    if (outDeg[n.id] === 0 && n.type !== 'customOutput')
      warnings.push({ id: `dead-end-${n.id}`, level: 'warning', msg: `${n.type} node has no outgoing connections`, nodeId: n.id });
    if (inDeg[n.id] === 0 && n.type !== 'customInput')
      warnings.push({ id: `orphan-${n.id}`, level: 'info', msg: `${n.type} node has no incoming connections`, nodeId: n.id });
  });

  // ── Graph-level rules ──
  if (nonNote.length > 1 && edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)).length === 0)
    warnings.push({ id: 'no-edges', level: 'error', msg: 'Nodes are not connected — add edges between them', nodeId: null });

  return warnings;
};

// ── Pipeline Health Score (0–100) ─────────────────────────────────
export const computeHealthScore = (analytics, warnings) => {
  if (!analytics) return null;

  let score = 100;
  const issues = [];

  // DAG validity (-30 if has cycles)
  if (!analytics.isDAG) { score -= 30; issues.push('Has cycles'); }

  // Dead nodes (-5 each, max -20)
  const deadPenalty = Math.min(analytics.deadNodes?.length * 5, 20);
  if (deadPenalty) { score -= deadPenalty; issues.push(`${analytics.deadNodes.length} dead node(s)`); }

  // Lint errors (-10 each, max -25)
  const errCount = warnings?.filter((w) => w.level === 'error').length ?? 0;
  const errPenalty = Math.min(errCount * 10, 25);
  if (errPenalty) { score -= errPenalty; issues.push(`${errCount} error(s)`); }

  // Lint warnings (-3 each, max -15)
  const warnCount = warnings?.filter((w) => w.level === 'warning').length ?? 0;
  const warnPenalty = Math.min(warnCount * 3, 15);
  if (warnPenalty) { score -= warnPenalty; issues.push(`${warnCount} warning(s)`); }

  // Bottlenecks (-5 each, max -10)
  const apPenalty = Math.min((analytics.articulationPoints?.size ?? 0) * 5, 10);
  if (apPenalty) { score -= apPenalty; issues.push(`${analytics.articulationPoints.size} bottleneck(s)`); }

  // Complexity bonus/penalty
  if (analytics.complexity === 'Very Complex') { score -= 5; issues.push('Very complex topology'); }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#60a5fa' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#f43f5e';
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Fair' : score >= 40 ? 'Poor' : 'Critical';

  return { score, grade, color, label, issues };
};

// ── Data types per handle ─────────────────────────────────────────
export const HANDLE_TYPES = {
  customInput:  { outputs: { value: 'any' } },
  llm:          { inputs: { prompt: 'string', context: 'any' }, outputs: { response: 'string' } },
  customOutput: { inputs: { value: 'any' } },
  text:         { outputs: { output: 'string' } },
  filter:       { inputs: { data: 'any' }, outputs: { match: 'any', 'no-match': 'any' } },
  merge:        { inputs: { input1: 'any', input2: 'any' }, outputs: { merged: 'any' } },
  api:          { inputs: { input: 'any' }, outputs: { response: 'json' } },
  transform:    { inputs: { input: 'any' }, outputs: { output: 'any' } },
  condition:    { inputs: { input: 'any' }, outputs: { true: 'boolean', false: 'boolean' } },
  timer:        { outputs: { tick: 'number' } },
};

export const TYPE_COLORS = {
  string:  '#60a5fa',
  json:    '#a78bfa',
  number:  '#34d399',
  boolean: '#f59e0b',
  any:     '#94a3b8',
  file:    '#f97316',
};