// NodeInspector.js
// Slide-in right panel showing the selected node's properties.
// Appears when exactly one node is selected, slides out when deselected.

import { motion, AnimatePresence } from 'framer-motion';
import { useStore }                from './store';
import { NODE_COLORS }             from './store';

// ── Per-type field definitions ────────────────────────────────────
const NODE_META = {
  customInput: {
    label: 'Input Node', icon: '📥', color: '#3b82f6',
    desc: 'Pipeline entry point. Accepts data from outside the pipeline.',
    fields: [
      { key: 'inputName', label: 'Variable name', type: 'text' },
      { key: 'inputType', label: 'Data type',     type: 'select', options: ['Text', 'File'] },
    ],
  },
  customOutput: {
    label: 'Output Node', icon: '📤', color: '#10b981',
    desc: 'Pipeline exit point. Exposes the final result.',
    fields: [
      { key: 'outputName', label: 'Output name', type: 'text' },
      { key: 'outputType', label: 'Data type',   type: 'select', options: ['Text', 'Image'] },
    ],
  },
  llm: {
    label: 'LLM Node', icon: '🤖', color: '#8b5cf6',
    desc: 'Sends a prompt to a language model and returns the response.',
    fields: [
      { key: 'model', label: 'Model', type: 'select', options: ['gpt-4o', 'gpt-4-turbo', 'claude-3-5-sonnet', 'gemini-1.5-pro'] },
    ],
  },
  text: {
    label: 'Text Node', icon: '📝', color: '#f59e0b',
    desc: 'A text template. Use {{variable}} to create dynamic input handles.',
    fields: [
      { key: 'text', label: 'Content', type: 'textarea', placeholder: 'Use {{variable}} to create input handles' },
    ],
  },
  filter: {
    label: 'Filter Node', icon: '🔍', color: '#ec4899',
    desc: 'Multi-condition data filter with per-row AND/OR logic.',
    fields: [],
    customSection: 'filterConditions',
  },
  merge: {
    label: 'Merge Node', icon: '🔗', color: '#06b6d4',
    desc: 'Combines multiple inputs into one output.',
    fields: [
      { key: 'inputCount',    label: 'Input count',     type: 'select', options: ['2','3','4','5'] },
      { key: 'mergeStrategy', label: 'Merge strategy',  type: 'select', options: ['Concatenate', 'JSON Array', 'First non-null'] },
    ],
  },
  api: {
    label: 'API Call Node', icon: '🌐', color: '#f97316',
    desc: 'Makes an HTTP request to an external endpoint.',
    fields: [
      { key: 'url',      label: 'Endpoint URL', type: 'text' },
      { key: 'method',   label: 'Method',       type: 'select', options: ['GET','POST','PUT','DELETE','PATCH'] },
      { key: 'authType', label: 'Auth type',    type: 'select', options: ['None','API Key','Bearer','Basic'] },
    ],
  },
  transform: {
    label: 'Transform Node', icon: '⚙️', color: '#a855f7',
    desc: 'Converts data from one format to another.',
    fields: [
      { key: 'fromFormat', label: 'From', type: 'select', options: ['JSON','CSV','Markdown','Plain text','XML'] },
      { key: 'toFormat',   label: 'To',   type: 'select', options: ['JSON','CSV','Markdown','Plain text','XML'] },
    ],
  },
  condition: {
    label: 'Condition Node', icon: '🔀', color: '#f43f5e',
    desc: 'Evaluates a JS-like expression. Supports dot notation, comparison and logical operators.',
    fields: [
      { key: 'expression', label: 'Expression', type: 'textarea', placeholder: 'e.g. user.age > 18 && status == "active"' },
    ],
  },
  timer: {
    label: 'Timer Node', icon: '⏱️', color: '#0ea5e9',
    desc: 'Introduces a delay before passing data downstream.',
    fields: [
      { key: 'mode',    label: 'Mode',     type: 'select', options: ['delay','interval'], optionLabels: ['Delay','Interval'],                                                          defaultValue: 'delay'   },
      { key: 'delay',   label: 'Duration', type: 'number',  defaultValue: 1 },
      { key: 'timeUnit',label: 'Unit',     type: 'select', options: ['ms','seconds','minutes','hours'], optionLabels: ['Milliseconds','Seconds','Minutes','Hours'], defaultValue: 'seconds' },
    ],
  },
  note: {
    label: 'Note', icon: '📌', color: '#fbbf24',
    desc: 'An annotation. Does not affect pipeline execution.',
    fields: [
      { key: 'text',     label: 'Note text', type: 'textarea' },
      { key: 'colorIdx', label: 'Color',     type: 'select', options: [0,1,2,3,4], optionLabels: ['🟡 Yellow','🟢 Green','🔵 Blue','🔴 Red','🟣 Purple'] },
    ],
  },
};

// ── Connections summary ───────────────────────────────────────────
const ConnectionsSummary = ({ nodeId, edges, nodes }) => {
  const incoming = edges.filter((e) => e.target === nodeId);
  const outgoing = edges.filter((e) => e.source === nodeId);

  const nodeLabel = (id) => {
    const n = nodes.find((n) => n.id === id);
    if (!n) return id;
    const meta = NODE_META[n.type];
    return meta ? `${meta.icon} ${meta.label}` : id;
  };

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div style={{ fontSize: '11px', color: '#f59e0b', background: '#f59e0b10', border: '1px solid #f59e0b33', borderRadius: '6px', padding: '6px 10px' }}>
        ⚠️ Not connected to anything
      </div>
    );
  }

  const ConnRow = ({ label, handle, color, bg, dirIcon }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: bg, border: `1px solid ${color}22`, borderRadius: '7px', padding: '5px 8px' }}>
      <span style={{ fontSize: '13px' }}>{dirIcon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'var(--node-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {handle && <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginTop: '1px', fontFamily: 'monospace' }}>{handle}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {incoming.length > 0 && (
        <>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>From</div>
          {incoming.map((e) => (
            <ConnRow key={e.id}
              label={nodeLabel(e.source)}
              handle={e.sourceHandle || null}
              color="#3b82f6" bg="#3b82f60a"
              dirIcon="⬇️"
            />
          ))}
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: incoming.length ? '6px' : '0', marginBottom: '2px' }}>To</div>
          {outgoing.map((e) => (
            <ConnRow key={e.id}
              label={nodeLabel(e.target)}
              handle={e.targetHandle || null}
              color="#10b981" bg="#10b9810a"
              dirIcon="⬆️"
            />
          ))}
        </>
      )}
    </div>
  );
};

// ── Section header ────────────────────────────────────────────────
const Section = ({ title, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
      {title}
    </div>
    {children}
  </div>
);

// ── Field row ────────────────────────────────────────────────────
const FieldRow = ({ field, value, onChange }) => {
  const inputBase = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--node-input-bg)', border: '1px solid var(--node-border)',
    borderRadius: '6px', color: 'var(--node-text)',
    fontSize: '12px', fontFamily: "'DM Sans',sans-serif",
    outline: 'none', padding: '6px 8px',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {field.label}
      </div>
      {field.type === 'textarea' ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
          onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
        />
      ) : field.type === 'select' ? (
        <select
          value={value ?? field.defaultValue ?? field.options[0]}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputBase, cursor: 'pointer' }}
        >
          {field.options.map((o, i) => <option key={o} value={o}>{field.optionLabels ? field.optionLabels[i] : o}</option>)}
        </select>
      ) : field.type === 'number' ? (
        <input
          type="number"
          min={field.min ?? 1}
          value={value ?? field.defaultValue ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
          style={inputBase}
          onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
        />
      ) : (
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputBase}
          onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
        />
      )}
    </div>
  );
};

// ── Main panel ────────────────────────────────────────────────────
export const NodeInspector = () => {
  const nodes          = useStore((s) => s.nodes);
  const isDragging     = useStore((s) => s.isDragging);
  const edges          = useStore((s) => s.edges);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const onNodesChange  = useStore((s) => s.onNodesChange);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const toggleCollapsed   = useStore((s) => s.toggleNodeCollapsed);

  const selected = nodes.filter((n) => n.selected);
  // Suppress inspector while dragging — avoids it opening mid-drag
  const node     = selected.length === 1 && !isDragging ? selected[0] : null;
  const meta     = node ? (NODE_META[node.type] ?? null) : null;
  const color    = meta?.color ?? NODE_COLORS[node?.type] ?? '#4f8ef7';

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0,   opacity: 1 }}
          exit={{    x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          style={{
            position:       'fixed',
            right:          0,
            top:            '56px',            // below toolbar
            bottom:         '56px',            // above submit bar
            width:          '280px',
            background:     'var(--bg-panel)',
            borderLeft:     `1px solid ${color}33`,
            borderTop:      '1px solid var(--node-border)',
            borderBottom:   '1px solid var(--node-border)',
            zIndex:         30,
            display:        'flex',
            flexDirection:  'column',
            fontFamily:     "'DM Sans','Segoe UI',sans-serif",
            boxShadow:      '-8px 0 32px #0006',
            overflowY:      'auto',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding:      '14px 16px',
            borderBottom: `1px solid ${color}22`,
            background:   `linear-gradient(135deg, ${color}18, transparent)`,
            flexShrink:    0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: `${color}22`, border: `1px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', flexShrink: 0,
              }}>
                {meta?.icon ?? '⚙️'}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--node-text)' }}>
                  {meta?.label ?? node.type}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px', fontFamily: 'monospace' }}>
                  {node.id}
                </div>
              </div>
              {/* Close / deselect */}
              <button
                onClick={() => onNodesChange([{ type: 'select', id: node.id, selected: false }])}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                aria-label="Close inspector"
              >✕</button>
            </div>
            {meta?.desc && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{meta.desc}</div>
            )}
          </div>

          {/* ── Scrollable content ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

            {/* Position */}
            <Section title="Position">
              <div style={{ display: 'flex', gap: '8px' }}>
                {['x', 'y'].map((axis) => (
                  <div key={axis} style={{ flex: 1, background: 'var(--node-input-bg)', border: '1px solid var(--node-border)', borderRadius: '6px', padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{axis}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {Math.round(node.position[axis])}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Fields */}
            {meta?.fields?.length > 0 && (
              <Section title="Properties">
                {meta.fields.map((field) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    value={node.data?.[field.key]}
                    onChange={(val) => updateNodeField(node.id, field.key, val)}
                  />
                ))}
              </Section>
            )}

            {/* Custom section: filter conditions — fully editable */}
            {meta?.customSection === 'filterConditions' && (() => {
              const FILTER_OPS = ['equals','not equals','contains','starts with','ends with','greater than','less than','is empty'];
              const conditions = node.data?.conditions ?? [{ field: '', operator: 'equals', value: '', logic: 'AND' }];
              const updateCond = (index, key, val) => {
                const next = conditions.map((c, i) => i === index ? { ...c, [key]: val } : c);
                updateNodeField(node.id, 'conditions', next);
              };
              const addCond = () => {
                if (conditions.length >= 4) return;
                updateNodeField(node.id, 'conditions', [...conditions, { field: '', operator: 'equals', value: '', logic: 'AND' }]);
              };
              const removeCond = (index) => {
                if (conditions.length === 1) return;
                updateNodeField(node.id, 'conditions', conditions.filter((_, i) => i !== index));
              };
              const inputBase = { width: '100%', boxSizing: 'border-box', background: 'var(--node-input-bg)', border: '1px solid var(--node-border)', borderRadius: '6px', color: 'var(--node-text)', fontSize: '11px', fontFamily: "'DM Sans',sans-serif", outline: 'none', padding: '5px 7px' };
              return (
                <Section title="Conditions">
                  {conditions.map((cond, i) => (
                    <div key={i}>
                      {/* Field */}
                      <div style={{ marginBottom: '3px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Field</div>
                        <input value={cond.field} placeholder="e.g. status"
                          onChange={(e) => updateCond(i, 'field', e.target.value)}
                          style={inputBase}
                          onFocus={(e) => { e.target.style.borderColor = '#ec4899'; }}
                          onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
                        />
                      </div>
                      {/* Operator */}
                      <div style={{ marginBottom: '3px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Operator</div>
                        <select value={cond.operator} onChange={(e) => updateCond(i, 'operator', e.target.value)} style={{ ...inputBase, cursor: 'pointer' }}>
                          {FILTER_OPS.map((op) => <option key={op}>{op}</option>)}
                        </select>
                      </div>
                      {/* Value */}
                      {cond.operator !== 'is empty' && (
                        <div style={{ marginBottom: '4px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Value</div>
                          <input value={cond.value} placeholder="e.g. active"
                            onChange={(e) => updateCond(i, 'value', e.target.value)}
                            style={inputBase}
                            onFocus={(e) => { e.target.style.borderColor = '#ec4899'; }}
                            onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
                          />
                        </div>
                      )}
                      {/* Remove button */}
                      {conditions.length > 1 && (
                        <button onClick={() => removeCond(i)}
                          style={{ width: '100%', marginBottom: '6px', padding: '3px', background: 'transparent', border: '1px solid #f43f5e22', borderRadius: '5px', color: '#f43f5e66', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#f43f5e12'; e.currentTarget.style.color = '#f43f5ecc'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f43f5e66'; }}>
                          Remove condition
                        </button>
                      )}
                      {/* AND/OR connector between rows */}
                      {i < conditions.length - 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '6px 0' }}>
                          <div style={{ flex: 1, height: '1px', background: '#ec489922' }} />
                          {['AND','OR'].map((opt) => (
                            <button key={opt} onClick={() => updateCond(i, 'logic', opt)}
                              style={{ padding: '2px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', border: `1px solid ${cond.logic === opt ? '#ec4899' : 'var(--border)'}`, background: cond.logic === opt ? '#ec489922' : 'transparent', color: cond.logic === opt ? '#ec4899' : 'var(--text-hint)' }}>
                              {opt}
                            </button>
                          ))}
                          <div style={{ flex: 1, height: '1px', background: '#ec489922' }} />
                        </div>
                      )}
                    </div>
                  ))}
                  {conditions.length < 4 && (
                    <button onClick={addCond}
                      style={{ width: '100%', marginTop: '4px', padding: '5px', background: '#ec489908', border: '1px dashed #ec489944', borderRadius: '6px', color: '#ec489988', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ec489918'; e.currentTarget.style.color = '#ec4899cc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ec489908'; e.currentTarget.style.color = '#ec489988'; }}>
                      + Add condition
                    </button>
                  )}
                </Section>
              );
            })()}

            {/* Connections */}
            <Section title="Connections">
              <ConnectionsSummary nodeId={node.id} edges={edges} nodes={nodes} />
            </Section>
          </div>

          {/* ── Footer actions ── */}
          <div style={{
            padding:     '10px 16px',
            borderTop:   '1px solid var(--node-border)',
            display:     'flex',
            gap:         '8px',
            flexShrink:   0,
          }}>
            {[
              { label: 'Duplicate', icon: '📋', action: () => duplicateSelected() },
              { label: node.data?.collapsed ? 'Expand' : 'Collapse', icon: node.data?.collapsed ? '▶' : '▼', action: () => toggleCollapsed(node.id) },
              { label: 'Delete', icon: '🗑', danger: true, action: () => onNodesChange([{ type: 'remove', id: node.id }]) },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.action}
                title={btn.label}
                style={{
                  flex:         1,
                  padding:      '6px 0',
                  background:   btn.danger ? '#f43f5e14' : 'var(--border)',
                  border:       `1px solid ${btn.danger ? '#f43f5e44' : 'var(--text-hint)'}`,
                  borderRadius: '7px',
                  color:        btn.danger ? '#f87171' : '#8899bb',
                  cursor:       'pointer',
                  fontSize:     '11px',
                  fontFamily:   'inherit',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  gap:          '4px',
                  transition:   'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = btn.danger ? '#f43f5e28' : 'var(--text-hint)'; e.currentTarget.style.color = btn.danger ? '#fca5a5' : 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = btn.danger ? '#f43f5e14' : 'var(--border)'; e.currentTarget.style.color = btn.danger ? '#f87171' : '#8899bb'; }}
              >
                <span>{btn.icon}</span> {btn.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};