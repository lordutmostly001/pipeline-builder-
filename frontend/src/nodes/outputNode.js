import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel, fieldInput, fieldSelect, fieldRow } from './nodeStyles';

export const OutputNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const name = nodeData?.outputName || id.replace('customOutput-', 'output_');
  const type = nodeData?.outputType || 'Text';

  return (
    <BaseNode id={id} title="Output" icon="📤" color="#10b981"
      inputs={[{ id: 'value', label: 'value' }]}>
      <div style={fieldRow}>
        <label style={fieldLabel}>Name</label>
        <input style={fieldInput} value={name}
          onChange={(e) => updateNodeField(id, 'outputName', e.target.value)} />
      </div>
      <div style={fieldRow}>
        <label style={fieldLabel}>Type</label>
        <select style={fieldSelect} value={type}
          onChange={(e) => updateNodeField(id, 'outputType', e.target.value)}>
          <option>Text</option>
          <option>Image</option>
        </select>
      </div>
    </BaseNode>
  );
};