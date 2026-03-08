import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel, fieldSelect, fieldRow, infoText } from './nodeStyles';

export const LLMNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const model = nodeData?.model || 'gpt-4o';

  return (
    <BaseNode id={id} title="LLM" icon="🤖" color="#8b5cf6" minWidth={260}
      inputs={[{ id: 'system', label: 'system' }, { id: 'prompt', label: 'prompt' }]}
      outputs={[{ id: 'response', label: 'response' }]}>
      <div style={fieldRow}>
        <label style={fieldLabel}>Model</label>
        <select style={fieldSelect} value={model}
          onChange={(e) => updateNodeField(id, 'model', e.target.value)}>
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
        </select>
      </div>
      <p style={infoText}>Routes a system prompt and user prompt to the selected model.</p>
    </BaseNode>
  );
};