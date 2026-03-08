// componentNode.js — Renders a collapsed subgraph component node
// Shows the component name, port count, and a mini node-type grid

import { Handle, Position } from 'reactflow';
import { useStore } from '../store';

const COLOR = '#64748b';

export const ComponentNode = ({ id, data }) => {
  const nodeData = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const { componentName = 'Component', inputs = [], outputs = [], nodeTypes = [], description = '' } = nodeData;

  const getTop = (list, i) => list.length === 1 ? '50%' : `${((i+1)/(list.length+1))*100}%`;

  // Mini type colour chips
  const TYPE_COLORS = {
    customInput:'#3b82f6',llm:'#8b5cf6',customOutput:'#10b981',text:'#f59e0b',
    filter:'#ec4899',merge:'#06b6d4',api:'#f97316',transform:'#a855f7',
    condition:'#f43f5e',timer:'#0ea5e9',
  };

  return (
    <div style={{
      minWidth: 200, maxWidth: 280,
      background: 'var(--bg-node)',
      border: `1.5px solid ${COLOR}66`,
      borderRadius: 12,
      boxShadow: `0 4px 20px #0007, 0 0 0 1px ${COLOR}22`,
      fontFamily: "'DM Sans',sans-serif",
      position: 'relative',
      overflow: 'visible',
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(90deg,${COLOR}cc,${COLOR}88)`,
        borderRadius: '11px 11px 0 0', padding: '7px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ fontSize: 12 }}>🧩</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {componentName}
        </span>
        <span style={{ fontSize: 9, color: '#ffffff66', fontWeight: 600 }}>COMPONENT</span>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 44px 12px' }}>
        {description && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>
            {description}
          </div>
        )}

        {/* Node type chips */}
        {nodeTypes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            {nodeTypes.map((t, i) => (
              <span key={i} style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: TYPE_COLORS[t] ?? COLOR,
                boxShadow: `0 0 4px ${TYPE_COLORS[t] ?? COLOR}88`,
              }} title={t} />
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--text-hint)', fontWeight: 600 }}>
          {inputs.length} input{inputs.length !== 1 ? 's' : ''} · {outputs.length} output{outputs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Input handles */}
      {inputs.map((port, i) => (
        <div key={port.id}>
          <Handle type="target" position={Position.Left} id={port.id}
            style={{ top: getTop(inputs, i), background: COLOR, border: `2px solid ${COLOR}`, width: 10, height: 10 }} />
          <span style={{ position:'absolute', left:14, top:getTop(inputs,i), transform:'translateY(-50%)', fontSize:8, color:`${COLOR}cc`, whiteSpace:'nowrap', pointerEvents:'none', userSelect:'none' }}>
            {port.label}
          </span>
        </div>
      ))}

      {/* Output handles */}
      {outputs.map((port, i) => (
        <div key={port.id}>
          <Handle type="source" position={Position.Right} id={port.id}
            style={{ top: getTop(outputs, i), background: COLOR, border: `2px solid ${COLOR}`, width: 10, height: 10 }} />
          <span style={{ position:'absolute', right:14, top:getTop(outputs,i), transform:'translateY(-50%)', fontSize:8, color:`${COLOR}cc`, whiteSpace:'nowrap', pointerEvents:'none', userSelect:'none' }}>
            {port.label}
          </span>
        </div>
      ))}
    </div>
  );
};