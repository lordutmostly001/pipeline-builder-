// persist.js
// ─────────────────────────────────────────────────────────────────
// Thin localStorage persistence layer for user preferences and
// the last pipeline state.
//
// Saves:  theme, nodes, edges
// Loads:  on app start via loadPersistedState()
// ─────────────────────────────────────────────────────────────────

const KEYS = {
  theme:    'pipeline_theme',
  pipeline: 'pipeline_last',
};

/** Save current theme to localStorage. */
export const saveTheme = (theme) => {
  try { localStorage.setItem(KEYS.theme, theme); } catch {}
};

/** Load saved theme, defaulting to 'dark'. */
export const loadTheme = () => {
  try { return localStorage.getItem(KEYS.theme) ?? 'dark'; } catch { return 'dark'; }
};

/** Save nodes + edges to localStorage (debounced by caller). */
export const savePipeline = (nodes, edges) => {
  try {
    localStorage.setItem(KEYS.pipeline, JSON.stringify({ nodes, edges }));
  } catch {}
};

/** Load last saved pipeline. Returns null if none saved. */
export const loadPipeline = () => {
  try {
    const raw = localStorage.getItem(KEYS.pipeline);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

/** Clear saved pipeline (e.g. after explicit clear canvas). */
export const clearSavedPipeline = () => {
  try { localStorage.removeItem(KEYS.pipeline); } catch {}
};