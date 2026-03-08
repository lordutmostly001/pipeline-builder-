import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel, fieldInput, fieldSelect, fieldRow } from './nodeStyles';

export const APINode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const url      = nodeData?.url      || '';
  const method   = nodeData?.method   || 'GET';
  const authType = nodeData?.authType || 'None';

  return (
    <BaseNode id={id} title="API Call" icon="🌐" color="#f97316" minWidth={280}
      inputs={[{ id: 'body', label: 'body' }, { id: 'headers', label: 'headers' }]}
      outputs={[{ id: 'response', label: 'response' }, { id: 'error', label: 'error' }]}>
      <div style={fieldRow}>
        <label style={fieldLabel}>Endpoint URL</label>
        <input style={fieldInput} value={url} placeholder="https://api.example.com/v1/..."
          onChange={(e) => updateNodeField(id, 'url', e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Method</label>
          <select style={fieldSelect} value={method}
            onChange={(e) => updateNodeField(id, 'method', e.target.value)}>
            {['GET','POST','PUT','DELETE','PATCH'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ flex: 1.2 }}>
          <label style={fieldLabel}>Auth type</label>
          <select style={fieldSelect} value={authType}
            onChange={(e) => updateNodeField(id, 'authType', e.target.value)}>
            {['None','API Key','Bearer','Basic'].map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>
    </BaseNode>
  );
};