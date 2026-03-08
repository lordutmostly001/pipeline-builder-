// ConfirmBanner.js — Inline confirmation bar, replaces window.confirm()
// Renders as a dismissible banner inside the UI rather than a browser popup.

export const ConfirmBanner = ({ message, onConfirm, onCancel, danger = true }) => (
  <div style={{
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            '12px',
    padding:        '10px 16px',
    background:     danger ? '#f43f5e14' : '#3b82f614',
    border:         `1px solid ${danger ? '#f43f5e44' : '#3b82f644'}`,
    borderRadius:   '8px',
    fontFamily:     "'DM Sans','Segoe UI',sans-serif",
    fontSize:       '12px',
    color:          '#ccd6f6',
    animation:      'fadeIn 0.15s ease both',
  }}>
    <span style={{ flex: 1 }}>
      {danger ? '⚠️' : 'ℹ️'} {message}
    </span>
    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
      <button
        onClick={onCancel}
        style={{
          background: 'transparent', border: '1px solid #2a3a55',
          borderRadius: '6px', color: '#7a8fb5', cursor: 'pointer',
          fontSize: '11px', fontWeight: 700, padding: '4px 10px',
          fontFamily: 'inherit',
        }}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        style={{
          background:   danger ? '#f43f5e22' : '#3b82f622',
          border:       `1px solid ${danger ? '#f43f5e66' : '#3b82f666'}`,
          borderRadius: '6px',
          color:        danger ? '#f87171' : '#60a5fa',
          cursor:       'pointer',
          fontSize:     '11px',
          fontWeight:   700,
          padding:      '4px 10px',
          fontFamily:   'inherit',
        }}
      >
        {danger ? 'Yes, clear' : 'Confirm'}
      </button>
    </div>
  </div>
);