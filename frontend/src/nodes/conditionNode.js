// conditionNode.js — free-form expression evaluator

import { useStore }  from '../store';
import { BaseNode }  from './BaseNode';
import { fieldLabel } from './nodeStyles';

const HINTS = [
  { ex: '==',  tip: 'equals'     },
  { ex: '!=',  tip: 'not equals' },
  { ex: '>',   tip: 'greater'    },
  { ex: '<',   tip: 'less'       },
  { ex: '>=',  tip: 'gte'        },
  { ex: '<=',  tip: 'lte'        },
  { ex: '&&',  tip: 'and'        },
  { ex: '||',  tip: 'or'         },
  { ex: '!',   tip: 'not'        },
  { ex: '.',   tip: 'dot access' },
];

const EXAMPLES = [
  'user.age > 18',
  'status == "active" && verified != false',
  'score >= 90 || role == "admin"',
  '!user.banned',
];

// Tokenise expression into colored spans — no dangerouslySetInnerHTML
const Token = ({ text }) => {
  if (/^(&&|\|\|)$/.test(text))          return <span style={{ color: '#f59e0b', fontWeight: 800 }}>{text}</span>;
  if (/^(==|!=|>=|<=|>|<)$/.test(text))  return <span style={{ color: '#60a5fa' }}>{text}</span>;
  if (/^".*"$/.test(text))               return <span style={{ color: '#34d399' }}>{text}</span>;
  if (/^!(?!={0})/.test(text))           return <span style={{ color: '#f43f5e' }}>{text}</span>;
  return <span style={{ color: 'var(--node-text)' }}>{text}</span>;
};

const HighlightedExpr = ({ expression }) => {
  // Split on operators while keeping them as tokens
  const tokens = expression.split(/(\s+|&&|\|\||==|!=|>=|<=|>|<|"[^"]*")/g).filter(Boolean);
  return (
    <div style={{ background: 'var(--node-input-bg)', border: '1px solid #f43f5e22', borderRadius: '6px', padding: '5px 9px', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.6, marginTop: '6px', wordBreak: 'break-all' }}>
      {tokens.map((t, i) => <Token key={i} text={t} />)}
    </div>
  );
};

export const ConditionNode = ({ id, data }) => {
  const nodeData        = useStore((s) => s.nodes.find((n) => n.id === id)?.data ?? data);
  const updateNodeField = useStore((s) => s.updateNodeField);
  const expression      = nodeData?.expression ?? '';
  const placeholder     = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];

  const insertOp = (op) => {
    const val = (expression + ' ' + op + ' ').replace(/\s{2,}/g, ' ').trimStart();
    updateNodeField(id, 'expression', val);
  };

  return (
    <BaseNode id={id} title="Condition" icon="🔀" color="#f43f5e" minWidth={300}
      inputs={[{ id: 'input', label: 'input' }]}
      outputs={[{ id: 'true', label: 'true' }, { id: 'false', label: 'false' }]}>

      <div style={{ marginBottom: '6px' }}>
        <label style={fieldLabel}>Expression</label>
        <textarea
          value={expression}
          rows={2}
          placeholder={placeholder}
          onChange={(e) => updateNodeField(id, 'expression', e.target.value)}
          style={{ width: '100%', background: 'var(--node-input-bg)', border: '1px solid var(--node-border)', borderRadius: '6px', color: 'var(--node-text)', fontSize: '12px', padding: '6px 9px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'none', lineHeight: 1.5 }}
          onFocus={(e) => { e.target.style.borderColor = '#f43f5e'; }}
          onBlur={(e)  => { e.target.style.borderColor = '#1e2d45'; }}
        />
        {/* Highlighted preview — only shown when there's content */}
        {expression.trim() && <HighlightedExpr expression={expression} />}
      </div>

      {/* Operator chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
        {HINTS.map(({ ex, tip }) => (
          <button key={ex} onClick={() => insertOp(ex)} title={tip}
            style={{ background: '#f43f5e0e', border: '1px solid #f43f5e33', borderRadius: '4px', color: '#f43f5ecc', fontSize: '10px', fontFamily: 'monospace', padding: '3px 8px', cursor: 'pointer', fontWeight: 700, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f43f5e22'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f43f5e0e'; }}
          >
            {ex}
          </button>
        ))}
      </div>
    </BaseNode>
  );
};