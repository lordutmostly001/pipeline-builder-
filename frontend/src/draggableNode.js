// draggableNode.js

export const DraggableNode = ({ type, label, icon = '', color = '#4f8ef7' }) => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType }));
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.7';
  };

  return (
    <div
      className={type}
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      onDragEnd={(e) => (e.target.style.opacity = '1')}
      style={{
        cursor:      'grab',
        display:     'flex',
        alignItems:  'center',
        gap:         '6px',
        padding:     '6px 12px',
        borderRadius:'8px',
        background:  `${color}18`,
        border:      `1px solid ${color}44`,
        color: 'var(--text-primary)',
        fontSize:    '12px',
        fontWeight:  600,
        fontFamily:  "'DM Sans', 'Segoe UI', sans-serif",
        userSelect:  'none',
        transition:  'background 0.15s, border-color 0.15s, transform 0.1s',
        whiteSpace:  'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background   = `${color}30`;
        e.currentTarget.style.borderColor  = `${color}88`;
        e.currentTarget.style.transform    = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background   = `${color}18`;
        e.currentTarget.style.borderColor  = `${color}44`;
        e.currentTarget.style.transform    = 'translateY(0)';
      }}
    >
      {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
      <span>{label}</span>
    </div>
  );
};