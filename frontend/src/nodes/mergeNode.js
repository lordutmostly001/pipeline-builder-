import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel, fieldSelect, fieldRow, infoText } from './nodeStyles';

export const MergeNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const inputCount = Number(nodeData?.inputCount    || 2);
  const strategy   = nodeData?.mergeStrategy || 'Concatenate';
  const inputs     = Array.from({ length: inputCount }, (_, i) => ({ id: `input-${i}`, label: `in ${i + 1}` }));

  return (
    <BaseNode id={id} title="Merge" icon="🔗" color="#06b6d4" minWidth={260}
      inputs={inputs} outputs={[{ id: 'merged', label: 'merged' }]}>
      <div style={fieldRow}>
        <label style={fieldLabel}>Input count</label>
        <select style={fieldSelect} value={inputCount}
          onChange={(e) => updateNodeField(id, 'inputCount', Number(e.target.value))}>
          {[2,3,4,5].map((n) => <option key={n} value={n}>{n} inputs</option>)}
        </select>
      </div>
      <div style={fieldRow}>
        <label style={fieldLabel}>Merge strategy</label>
        <select style={fieldSelect} value={strategy}
          onChange={(e) => updateNodeField(id, 'mergeStrategy', e.target.value)}>
          <option>Concatenate</option>
          <option>JSON Array</option>
          <option>First non-null</option>
        </select>
      </div>
      <p style={infoText}>Combines {inputCount} inputs into one output stream.</p>
    </BaseNode>
  );
};