import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel, fieldInput, fieldSelect, fieldRow } from './nodeStyles';

const FORMATS = ['JSON','CSV','XML','YAML','Markdown','Plain Text'];

export const TransformNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const fromFormat = nodeData?.fromFormat || 'JSON';
  const toFormat   = nodeData?.toFormat   || 'CSV';
  const template   = nodeData?.template   || '';

  return (
    <BaseNode id={id} title="Transform" icon="⚙️" color="#a855f7" minWidth={280}
      inputs={[{ id: 'input', label: 'input' }]}
      outputs={[{ id: 'output', label: 'output' }]}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>From</label>
          <select style={fieldSelect} value={fromFormat}
            onChange={(e) => updateNodeField(id, 'fromFormat', e.target.value)}>
            {FORMATS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <span style={{ color: '#3d5070', fontSize: '14px', paddingBottom: '7px' }}>→</span>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>To</label>
          <select style={fieldSelect} value={toFormat}
            onChange={(e) => updateNodeField(id, 'toFormat', e.target.value)}>
            {FORMATS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div style={fieldRow}>
        <label style={fieldLabel}>Template <span style={{ color: '#2a3550', fontWeight: 400 }}>(optional)</span></label>
        <input style={fieldInput} value={template} placeholder="Custom mapping expression..."
          onChange={(e) => updateNodeField(id, 'template', e.target.value)} />
      </div>
    </BaseNode>
  );
};