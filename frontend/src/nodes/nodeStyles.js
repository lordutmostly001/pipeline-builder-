// nodes/nodeStyles.js
// ─────────────────────────────────────────────────────────────────
// Shared inline-style tokens used across all node components.
// Keeping these in one place means a single edit re-styles every
// node uniformly.
// ─────────────────────────────────────────────────────────────────

/** FIELD LABEL — uppercase micro-text above each input */
export const fieldLabel = {
  display:       'block',
  fontSize:      '9px',
  color:         '#5a6a8a',
  marginBottom:  '4px',
  fontWeight:    700,
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
};

/** Base for all text inputs */
const baseInput = {
  width:      '100%',
  background: '#0a1020',
  border:     '1px solid #1e2d45',
  borderRadius: '6px',
  color:      '#c8d8f0',
  fontSize:   '12px',
  padding:    '6px 9px',
  outline:    'none',
  boxSizing:  'border-box',
  fontFamily: "'DM Sans','Segoe UI',sans-serif",
  lineHeight: '1.4',
  transition: 'border-color 0.15s',
};

/** TEXT INPUT */
export const fieldInput = {
  ...baseInput,
};

/** SELECT / DROPDOWN */
export const fieldSelect = {
  ...baseInput,
  cursor:     'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235a6a8a'/%3E%3C/svg%3E")`,
  backgroundRepeat:   'no-repeat',
  backgroundPosition: 'right 9px center',
  paddingRight:       '28px',
};

/** Wrapper div for a label + input pair */
export const fieldRow = {
  marginBottom: '8px',
};

/** Muted descriptive text inside a node body */
export const infoText = {
  margin:     '4px 0 0',
  fontSize:   '11px',
  color:      '#3d5070',
  lineHeight: '1.5',
};
