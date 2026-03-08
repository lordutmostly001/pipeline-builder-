// filterNode.js — multi-condition filter with per-row AND/OR connectors

import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldInput, fieldSelect } from './nodeStyles';

const OPERATORS  = ['equals','not equals','contains','starts with','ends with','greater than','less than','is empty'];
const EMPTY_COND = { field: '', operator: 'equals', value: '', logic: 'AND' }; // logic = connector TO next row

export const FilterNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);

  const conditions = nodeData?.conditions ?? [{ ...EMPTY_COND }];

  const updateCondition = (index, key, value) => {
    updateNodeField(id, 'conditions', conditions.map((c, i) => i === index ? { ...c, [key]: value } : c));
  };

  const addCondition = () => {
    if (conditions.length >= 4) return;
    updateNodeField(id, 'conditions', [...conditions, { ...EMPTY_COND }]);
  };

  const removeCondition = (index) => {
    if (conditions.length === 1) return;
    updateNodeField(id, 'conditions', conditions.filter((_, i) => i !== index));
  };

  // Build preview: "field op val AND field op val OR field op val"
  const preview = conditions
    .filter((c) => c.field)
    .map((c, i, arr) => {
      const expr = `${c.field} ${c.operator}${c.operator !== 'is empty' ? ` "${c.value}"` : ''}`;
      return i < arr.length - 1 ? `${expr} ${c.logic}` : expr;
    })
    .join(' ');

  const miniInput  = { ...fieldInput,  fontSize: '11px', padding: '4px 7px' };
  const miniSelect = { ...fieldSelect, fontSize: '11px', padding: '4px 6px' };

  return (
    <BaseNode id={id} title="Filter" icon="🔍" color="#ec4899" minWidth={320}
      inputs={[{ id: 'data', label: 'data' }]}
      outputs={[{ id: 'match', label: 'match' }, { id: 'no-match', label: 'no match' }]}>

      {conditions.map((cond, i) => (
        <div key={i}>
          {/* Condition row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr auto', gap: '4px', alignItems: 'center' }}>
            <input style={miniInput} value={cond.field} placeholder="field"
              onChange={(e) => updateCondition(i, 'field', e.target.value)} />
            <select style={miniSelect} value={cond.operator}
              onChange={(e) => updateCondition(i, 'operator', e.target.value)}>
              {OPERATORS.map((op) => <option key={op}>{op}</option>)}
            </select>
            <input
              style={{ ...miniInput, visibility: cond.operator === 'is empty' ? 'hidden' : 'visible' }}
              value={cond.value} placeholder="value"
              onChange={(e) => updateCondition(i, 'value', e.target.value)}
            />
            <button onClick={() => removeCondition(i)} disabled={conditions.length === 1}
              style={{ background: 'none', border: 'none', color: conditions.length === 1 ? '#2a3a55' : '#f43f5e88', cursor: conditions.length === 1 ? 'default' : 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
              onMouseEnter={(e) => { if (conditions.length > 1) e.currentTarget.style.color = '#f43f5e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = conditions.length === 1 ? '#2a3a55' : '#f43f5e88'; }}>
              ✕
            </button>
          </div>

          {/* Per-row AND/OR connector — shown between rows, not after last */}
          {i < conditions.length - 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '5px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#ec489922' }} />
              {['AND','OR'].map((opt) => (
                <button key={opt} onClick={() => updateCondition(i, 'logic', opt)}
                  style={{
                    padding: '1px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                    border:      `1px solid ${cond.logic === opt ? '#ec4899' : '#1e2d45'}`,
                    background:  cond.logic === opt ? '#ec489922' : 'transparent',
                    color:       cond.logic === opt ? '#ec4899'   : '#2a3a55',
                  }}>
                  {opt}
                </button>
              ))}
              <div style={{ flex: 1, height: '1px', background: '#ec489922' }} />
            </div>
          )}
        </div>
      ))}

      {/* Add condition */}
      {conditions.length < 4 && (
        <button onClick={addCondition}
          style={{ width: '100%', marginTop: '6px', padding: '5px', background: '#ec489908', border: '1px dashed #ec489944', borderRadius: '6px', color: '#ec489988', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#ec489918'; e.currentTarget.style.color = '#ec4899cc'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#ec489908'; e.currentTarget.style.color = '#ec489988'; }}>
          + Add condition
        </button>
      )}

      {/* Preview */}
      {preview && (
        <div style={{ marginTop: '8px', background: 'var(--node-input-bg)', border: '1px solid var(--node-border)', borderRadius: '6px', padding: '5px 8px', fontFamily: 'monospace', fontSize: '10px', color: '#ec4899aa', lineHeight: 1.5, wordBreak: 'break-word' }}>
          {preview}
        </div>
      )}
    </BaseNode>
  );
};