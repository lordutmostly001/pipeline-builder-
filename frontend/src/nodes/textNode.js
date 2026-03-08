import { Handle, Position } from 'reactflow';
import { useStore }         from '../store';
import { fieldLabel }       from './nodeStyles';

const VAR_REGEX = /\{\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\}/g;
const COLOR     = '#f59e0b';
const MIN_WIDTH = 240;

const extractVariables = (text) => {
  const seen = new Set(), vars = [];
  let match;
  const re = new RegExp(VAR_REGEX.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (!seen.has(match[1])) { seen.add(match[1]); vars.push(match[1]); }
  }
  return vars;
};

export const TextNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const currText  = nodeData?.text || '{{input}}';
  const variables = extractVariables(currText);
  const lines     = currText.split('\n');
  const width     = Math.min(500, Math.max(MIN_WIDTH, Math.max(...lines.map((l) => l.length), 10) * 7.2 + 120));
  const rows      = Math.max(2, lines.length);

  return (
    <div style={{ width, background: 'var(--bg-node)', border: `1px solid ${COLOR}44`, borderRadius: '12px', boxShadow: `0 4px 24px #0008, 0 0 0 1.5px ${COLOR}22`, fontFamily: "'DM Sans',sans-serif", position: 'relative', overflow: 'visible', transition: 'width 0.12s ease' }}>
      <div style={{ background: `linear-gradient(90deg,${COLOR}dd,${COLOR}99)`, borderRadius: '11px 11px 0 0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ fontSize: '13px' }}>📝</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Text</span>
      </div>
      <div style={{ padding: '10px 44px 12px 44px' }}>
        <label style={fieldLabel}>Content</label>
        <textarea
          value={currText}
          rows={rows}
          onChange={(e) => updateNodeField(id, 'text', e.target.value)}
          placeholder="Type text... use {{variable}} to create input handles"
          style={{ width: '100%', background: 'var(--node-input-bg)', border: '1px solid var(--node-border)', borderRadius: '6px', color: 'var(--node-text)', fontSize: '12px', padding: '6px 9px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'none', lineHeight: '1.5' }}
        />
        {variables.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            <span style={{ fontSize: '9px', color: '#5a6a8a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', alignSelf: 'center', marginRight: '2px' }}>Inputs:</span>
            {variables.map((v) => (
              <span key={v} style={{ background: `${COLOR}18`, border: `1px solid ${COLOR}55`, borderRadius: '4px', padding: '2px 7px', fontSize: '10px', color: COLOR, fontFamily: 'monospace' }}>{`{{${v}}}`}</span>
            ))}
          </div>
        )}
      </div>
      {variables.map((varName, i) => {
        const top = variables.length === 1 ? '50%' : `${((i + 1) / (variables.length + 1)) * 100}%`;
        return (
          <div key={varName}>
            <Handle type="target" position={Position.Left} id={`${id}-${varName}`} style={{ top, background: COLOR, border: '2px solid var(--node-handle-border)', width: 10, height: 10 }} />
            <span style={{ position: 'absolute', left: 14, top, transform: 'translateY(-50%)', fontSize: '9px', fontWeight: 600, color: `${COLOR}cc`, pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}>{varName}</span>
          </div>
        );
      })}
      <Handle type="source" position={Position.Right} id={`${id}-output`} style={{ top: '50%', background: COLOR, border: '2px solid var(--node-handle-border)', width: 10, height: 10 }} />
      <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '9px', fontWeight: 600, color: `${COLOR}cc`, pointerEvents: 'none', userSelect: 'none' }}>output</span>
    </div>
  );
};