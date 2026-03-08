import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel, fieldInput, fieldSelect, fieldRow } from './nodeStyles';

export const InputNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const name = nodeData?.inputName || id.replace('customInput-', 'input_');
  const type = nodeData?.inputType || 'Text';

  return (
    <BaseNode id={id} title="Input" icon="📥" color="#3b82f6"
      outputs={[{ id: 'value', label: 'value' }]}>
      <div style={fieldRow}>
        <label style={fieldLabel}>Name</label>
        <input style={fieldInput} value={name}
          onChange={(e) => updateNodeField(id, 'inputName', e.target.value)} />
      </div>
      <div style={fieldRow}>
        <label style={fieldLabel}>Type</label>
        <select style={fieldSelect} value={type}
          onChange={(e) => updateNodeField(id, 'inputType', e.target.value)}>
          <option>Text</option>
          <option>File</option>
        </select>
      </div>
    </BaseNode>
  );
};