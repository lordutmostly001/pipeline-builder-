// PatternTracker.js — Tracks node pair/chain usage and suggests learned templates

// ── Storage keys ──────────────────────────────────────────────────
const PAIR_KEY    = 'pipeline_pattern_pairs';    // { "llm→transform": 7, ... }
const CHAIN_KEY   = 'pipeline_pattern_chains';   // { "customInput→llm→customOutput": 3, ... }
const LEARNED_KEY = 'pipeline_learned_templates';// [{ id, name, nodes, edges, useCount }]
const DISMISSED_KEY = 'pipeline_dismissed_suggestions'; // Set of pattern keys

const SUGGEST_THRESHOLD = 5; // uses before suggestion fires

// ── Helpers ───────────────────────────────────────────────────────
const loadJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const saveJSON = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

// ── Record a new edge connection ──────────────────────────────────
// Call this every time the user connects two nodes.
// sourceType + targetType = one data point.
export const recordConnection = (sourceType, targetType) => {
  const pairs = loadJSON(PAIR_KEY, {});
  const key   = `${sourceType}→${targetType}`;
  pairs[key]  = (pairs[key] ?? 0) + 1;
  saveJSON(PAIR_KEY, pairs);
};

// ── Record a full 3-node chain ────────────────────────────────────
// Call after each connection with full current edge list + nodes.
export const recordChains = (nodes, edges) => {
  if (nodes.length < 3) return;

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const adj = {};
  nodes.forEach((n) => { adj[n.id] = []; });
  edges.forEach((e) => { if (adj[e.source]) adj[e.source].push(e.target); });

  const chains = loadJSON(CHAIN_KEY, {});

  // Find all 3-node paths
  nodes.forEach((start) => {
    (adj[start.id] ?? []).forEach((midId) => {
      (adj[midId] ?? []).forEach((endId) => {
        const key = `${nodeMap[start.id]?.type}→${nodeMap[midId]?.type}→${nodeMap[endId]?.type}`;
        chains[key] = (chains[key] ?? 0) + 1;
      });
    });
  });
  saveJSON(CHAIN_KEY, chains);
};

// ── Check if any pattern just crossed the threshold ───────────────
// Returns { type: 'pair'|'chain', key, count, label } or null
export const checkForSuggestion = () => {
  const dismissed = new Set(loadJSON(DISMISSED_KEY, []));
  const learned   = loadJSON(LEARNED_KEY, []);
  const learnedKeys = new Set(learned.map((t) => t.patternKey));

  // Check pairs first
  const pairs = loadJSON(PAIR_KEY, {});
  for (const [key, count] of Object.entries(pairs)) {
    if (count >= SUGGEST_THRESHOLD && !dismissed.has(key) && !learnedKeys.has(key)) {
      const [src, tgt] = key.split('→');
      return { type: 'pair', key, count, label: `${fmt(src)} → ${fmt(tgt)}` };
    }
  }

  // Check chains
  const chains = loadJSON(CHAIN_KEY, {});
  for (const [key, count] of Object.entries(chains)) {
    if (count >= SUGGEST_THRESHOLD && !dismissed.has(key) && !learnedKeys.has(key)) {
      const parts = key.split('→').map(fmt).join(' → ');
      return { type: 'chain', key, count, label: parts };
    }
  }

  return null;
};

// ── Save a pattern as a learned template ─────────────────────────
export const saveLearnedTemplate = (patternKey, name, nodes, edges) => {
  const learned = loadJSON(LEARNED_KEY, []);
  const id = `learned_${Date.now()}`;
  learned.push({ id, patternKey, name, nodes, edges, savedAt: Date.now(), useCount: 0 });
  saveJSON(LEARNED_KEY, learned);
};

// ── Dismiss a suggestion (don't ask again) ───────────────────────
export const dismissSuggestion = (key) => {
  const dismissed = loadJSON(DISMISSED_KEY, []);
  if (!dismissed.includes(key)) dismissed.push(key);
  saveJSON(DISMISSED_KEY, dismissed);
};

// ── Get all learned templates ─────────────────────────────────────
export const getLearnedTemplates = () => loadJSON(LEARNED_KEY, []);

// ── Delete a learned template ─────────────────────────────────────
export const deleteLearnedTemplate = (id) => {
  const learned = loadJSON(LEARNED_KEY, []).filter((t) => t.id !== id);
  saveJSON(LEARNED_KEY, learned);
};

// ── Increment use count ───────────────────────────────────────────
export const incrementLearnedUse = (id) => {
  const learned = loadJSON(LEARNED_KEY, []);
  const t = learned.find((l) => l.id === id);
  if (t) { t.useCount = (t.useCount ?? 0) + 1; saveJSON(LEARNED_KEY, learned); }
};

// ── Reset all tracking (for testing) ─────────────────────────────
export const resetTracking = () => {
  [PAIR_KEY, CHAIN_KEY, DISMISSED_KEY].forEach((k) => localStorage.removeItem(k));
};

// ── Format node type to label ─────────────────────────────────────
const TYPE_LABELS = {
  customInput:'Input', llm:'LLM', customOutput:'Output',
  text:'Text', filter:'Filter', merge:'Merge', api:'API',
  transform:'Transform', condition:'Condition', timer:'Timer', note:'Note',
};
export const fmt = (type) => TYPE_LABELS[type] ?? type;

// ── Build minimal template nodes/edges from a pattern key ─────────
export const buildPatternTemplate = (key, existingNodes, existingEdges) => {
  // Try to find this exact pattern in current canvas first
  const types = key.split('→');
  const nodeMap = Object.fromEntries(existingNodes.map((n) => [n.id, n]));
  const adj = {};
  existingNodes.forEach((n) => { adj[n.id] = []; });
  existingEdges.forEach((e) => { if (adj[e.source]) adj[e.source].push(e.target); });

  // Find chain in existing graph
  for (const start of existingNodes) {
    if (start.type !== types[0]) continue;
    let path = [start.id];
    let cur = start.id;
    let matched = true;
    for (let i = 1; i < types.length; i++) {
      const next = (adj[cur] ?? []).find((id) => nodeMap[id]?.type === types[i]);
      if (!next) { matched = false; break; }
      path.push(next);
      cur = next;
    }
    if (matched) {
      const pathSet = new Set(path);
      const tNodes = path.map((id) => ({ ...nodeMap[id], position: undefined }));
      const tEdges = existingEdges.filter((e) => pathSet.has(e.source) && pathSet.has(e.target));
      return { nodes: tNodes, edges: tEdges };
    }
  }

  // Fallback: build synthetic template
  const tNodes = types.map((type, i) => ({
    id: `tmpl_${type}_${i}`,
    type,
    data: { label: TYPE_LABELS[type] ?? type },
    position: { x: i * 300, y: 0 },
  }));
  const tEdges = types.slice(0, -1).map((_, i) => ({
    id: `tmpl_e${i}`,
    source: tNodes[i].id,
    target: tNodes[i + 1].id,
    type: 'default',
  }));
  return { nodes: tNodes, edges: tEdges };
};
