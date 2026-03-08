export const fieldLabel = {
  display: 'block', fontSize: '9px', fontWeight: 700,
  color: 'var(--text-dim)', textTransform: 'uppercase',
  letterSpacing: '0.07em', marginBottom: '4px',
};
export const fieldInput = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: '6px', color: 'var(--text-primary)',
  fontSize: '12px', fontFamily: "'DM Sans','Segoe UI',sans-serif",
  outline: 'none', padding: '5px 8px',
};
export const fieldSelect = { ...fieldInput, cursor: 'pointer' };
export const fieldTextarea = { ...fieldInput, resize: 'none', lineHeight: 1.5 };