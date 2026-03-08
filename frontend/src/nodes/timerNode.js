import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel, fieldInput, fieldSelect, fieldRow, infoText } from './nodeStyles';

export const TimerNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const delay = nodeData?.delay    || 1;
  const unit  = nodeData?.timeUnit || 'seconds';
  const mode  = nodeData?.mode     || 'delay';

  return (
    <BaseNode id={id} title="Timer" icon="⏱️" color="#0ea5e9" minWidth={260}
      inputs={[{ id: 'trigger', label: 'trigger' }]}
      outputs={[{ id: 'output', label: 'output' }]}>
      <div style={fieldRow}>
        <label style={fieldLabel}>Mode</label>
        <select style={fieldSelect} value={mode}
          onChange={(e) => updateNodeField(id, 'mode', e.target.value)}>
          <option value="delay">Delay</option>
          <option value="interval">Interval</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Duration</label>
          <input style={fieldInput} type="number" min="1" value={delay}
            onChange={(e) => updateNodeField(id, 'delay', e.target.value)} />
        </div>
        <div style={{ flex: 1.4 }}>
          <label style={fieldLabel}>Unit</label>
          <select style={fieldSelect} value={unit}
            onChange={(e) => updateNodeField(id, 'timeUnit', e.target.value)}>
            <option value="ms">Milliseconds</option>
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
          </select>
        </div>
      </div>
      <p style={infoText}>{mode === 'delay' ? 'Wait' : 'Trigger every'} {delay} {unit}</p>
    </BaseNode>
  );
};