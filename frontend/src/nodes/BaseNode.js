// nodes/BaseNode.js

import { useState, useRef }           from 'react';
import { Handle, Position }           from 'reactflow';
import { motion, AnimatePresence }    from 'framer-motion';
import { useStore }                   from '../store';
import { HANDLE_TYPES, TYPE_COLORS }  from '../graphAnalytics';
import { NodeCommentBubble, AddCommentBtn } from '../NodeComment';

const HANDLE_STRIP_W = 52;

const STATUS_COLORS = {
  idle:    'var(--text-hint)',
  running: '#f59e0b',
  success: '#10b981',
  error:   '#f43f5e',
  warning: '#f97316',
};

export const BaseNode = ({
  id, title, color = '#4f8ef7', icon = '',
  inputs = [], outputs = [],
  minWidth = 240,
  children, style = {},
}) => {
  const toggleCollapsed = useStore((s) => s.toggleNodeCollapsed);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const nodeStatus      = useStore((s) => s.nodeStatus[id] ?? 'idle');
  const collapsed       = useStore((s) => s.nodes.find((n) => n.id === id)?.data?.collapsed ?? false);
  const customName      = useStore((s) => s.nodes.find((n) => n.id === id)?.data?.customName ?? '');
  const isSelected      = useStore((s) => s.nodes.find((n) => n.id === id)?.selected ?? false);
  const hasComment      = useStore((s) => !!(s.comments?.[id]));
  const [addingComment, setAddingComment] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState('');
  const nameRef = useRef(null);

  const startNameEdit = (e) => {
    e.stopPropagation();
    setNameInput(customName || title);
    setEditingName(true);
    setTimeout(() => { nameRef.current?.select(); }, 20);
  };

  const commitName = () => {
    const trimmed = nameInput.trim();
    // If user typed exactly the default title, treat as no custom name
    updateNodeField(id, 'customName', trimmed === title ? '' : trimmed);
    setEditingName(false);
  };

  const displayName = customName || title;
  const isRenamed   = !!customName && customName !== title;

  const getTop = (list, i) =>
    list.length === 1 ? '50%' : `${((i + 1) / (list.length + 1)) * 100}%`;

  return (
    <div
      className="base-node"
      style={{
        minWidth,
        background:   'var(--bg-node)',
        backgroundColor: 'var(--bg-node)',
        border: `1px solid ${
          nodeStatus === 'error'   ? '#f43f5e' :
          nodeStatus === 'warning' ? '#f9731688' :
          `${color}44`
        }`,
        borderRadius: '12px',
        boxShadow: nodeStatus === 'error'
          ? `var(--node-shadow), 0 0 0 2px #f43f5e66, 0 0 16px #f43f5e44`
          : nodeStatus === 'warning'
          ? `var(--node-shadow), 0 0 0 2px #f9731644, 0 0 12px #f9731633`
          : `var(--node-shadow), 0 0 0 1.5px ${color}22`,
        fontFamily:   "'DM Sans','Segoe UI',sans-serif",
        position:     'relative',
        overflow:     'visible',
        isolation:    'isolate',
        zIndex:       1,
        ...style,
      }}
    >
      {/* ── Header — shows node TYPE (small, fixed) ── */}
      <div
        style={{
          background:   `linear-gradient(90deg, ${color}dd, ${color}99)`,
          borderRadius: collapsed ? '11px' : '11px 11px 0 0',
          padding:      '5px 10px',
          display:      'flex', alignItems: 'center', gap: '5px',
          cursor: 'pointer', userSelect: 'none',
          transition:   'border-radius 0.2s',
        }}
        onClick={() => toggleCollapsed(id)}
      >
        {/* Status dot */}
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          background: STATUS_COLORS[nodeStatus],
          boxShadow: nodeStatus === 'running' ? `0 0 6px ${STATUS_COLORS.running}` : 'none',
          transition: 'background 0.3s',
        }} />
        {icon && <span style={{ fontSize: '11px', lineHeight: 1 }}>{icon}</span>}
        {/* Node type label — always shows the TYPE, small */}
        <span style={{
          color: '#ffffffaa', fontWeight: 600, fontSize: '9px',
          letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1,
        }}>
          {title}
        </span>
        <motion.span
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={{ color: '#ffffff66', fontSize: '9px', display: 'inline-block', transformOrigin: 'center' }}
        >
          ▾
        </motion.span>
      </div>

      {/* ── Name bar — shows USER-GIVEN NAME, always visible, click to edit ── */}
      <div
        style={{
          padding: '6px 10px 5px',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          background: 'var(--bg-node)',
          borderRadius: collapsed ? '0 0 11px 11px' : '0',
          display: 'flex', alignItems: 'center', gap: '6px',
          minHeight: '30px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {editingName ? (
          <input
            ref={nameRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditingName(false);
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder={title}
            style={{
              flex: 1, background: `${color}18`,
              border: `1px solid ${color}66`,
              borderRadius: '5px', color: 'var(--text-primary)',
              fontWeight: 700, fontSize: '12px',
              padding: '2px 7px', outline: 'none',
              fontFamily: "'DM Sans','Segoe UI',sans-serif",
              minWidth: 0,
            }}
          />
        ) : (
          <span
            onClick={startNameEdit}
            title="Click to rename"
            style={{
              flex: 1, color: isRenamed ? 'var(--text-primary)' : 'var(--text-dim)',
              fontWeight: isRenamed ? 700 : 500,
              fontSize: '12px', cursor: 'text',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </span>
        )}
        {/* Edit pencil icon */}
        {!editingName && (
          <span
            onClick={startNameEdit}
            title="Rename node"
            style={{
              fontSize: '10px', color: 'var(--text-hint)',
              cursor: 'pointer', flexShrink: 0, opacity: 0.6,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
          >
            ✏
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: `10px ${HANDLE_STRIP_W}px 14px`, boxSizing: 'border-box', width: '100%' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input handles ── */}
      {inputs.map((handle, i) => {
        const hColor = TYPE_COLORS[HANDLE_TYPES.inputs?.[handle.id]] ?? color;
        return (
          <Handle
            key={handle.id}
            type="target"
            position={Position.Left}
            id={`${id}-${handle.id}`}
            style={{ top: getTop(inputs, i), left: '-5px', width: '10px', height: '10px', background: hColor, border: `2px solid ${hColor}`, borderRadius: '50%', zIndex: 10 }}
          >
            {handle.label && (
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', color: 'var(--text-dim)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                {handle.label}
              </span>
            )}
          </Handle>
        );
      })}

      {/* ── Output handles ── */}
      {outputs.map((handle, i) => {
        const hColor = TYPE_COLORS[HANDLE_TYPES.outputs?.[handle.id]] ?? color;
        return (
          <Handle
            key={handle.id}
            type="source"
            position={Position.Right}
            id={`${id}-${handle.id}`}
            style={{ top: getTop(outputs, i), right: '-5px', width: '10px', height: '10px', background: hColor, border: `2px solid ${hColor}`, borderRadius: '50%', zIndex: 10 }}
          >
            {handle.label && (
              <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', color: 'var(--text-dim)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                {handle.label}
              </span>
            )}
          </Handle>
        );
      })}

      {/* ── Comment bubble — anchored to node's right edge ── */}
      {(hasComment || addingComment) && (
        <NodeCommentBubble nodeId={id} onDelete={() => setAddingComment(false)} />
      )}
      {isSelected && !hasComment && !addingComment && (
        <AddCommentBtn nodeId={id} onAdd={() => setAddingComment(true)} />
      )}
    </div>
  );
};