// AIPipelineAssistant.js — Chat panel that reads + builds the pipeline via Ollama

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore }        from './store';
import { shallow }         from 'zustand/shallow';
import { chatStream, MODELS, getAvailableModels } from './OllamaClient';
import { toast }           from './Toast';
import { useClickOutside } from './useClickOutside';

// ── System prompt for pipeline assistant ──────────────────────────
const buildSystemPrompt = (nodes, edges) => {
  const isEmpty  = nodes.length === 0;
  const nodeList = nodes.map((n) => {
    const name = n.data?.customName || n.data?.label || n.data?.inputName || n.data?.outputName || '';
    return `  - id="${n.id}" type="${n.type}"${name ? ` name="${name}"` : ''}`;
  }).join('\n');
  const edgeList = edges.map((e) => `  - ${e.source} → ${e.target}`).join('\n');

  return `
You are an AI assistant embedded in a visual pipeline builder.

CURRENT CANVAS STATE:
${isEmpty
    ? 'EMPTY — there are NO nodes or edges on the canvas yet.'
    : `NODES (you MUST use EXACTLY these IDs when referencing existing nodes — do NOT invent IDs):
${nodeList}

EDGES:
${edgeList || '  (none)'}`
}

STRICT RULES:
- NEVER invent node IDs for existing nodes. Use ONLY the IDs listed above.
- New nodes you add must use NEW unique IDs like "llm-ai-1", "filter-ai-2" etc.
- If canvas is EMPTY, say so in explanation only.
- Respond with ONE single JSON object only. No prose before or after. No multiple JSON blocks.
- NEVER create a cycle: do NOT connect a downstream node back to an upstream node.
- condition node: true output → success path, false output → error/fallback path. NEVER connect either output back upstream.
- customOutput has NO output handle — never use it as a source in addEdge.
- customInput has NO input handle — never use it as a target in addEdge.
- ALWAYS include addEdge actions to connect every node you add. Do not leave nodes disconnected.

AVAILABLE NODE TYPES: customInput, llm, customOutput, text, filter, merge, api, transform, condition, timer, note

HANDLE IDs (use these for mental reference — the system resolves them automatically):
- customInput  outputs: value
- llm          inputs: prompt, system   outputs: response
- customOutput inputs: value
- text         inputs: (each {{variable}} in content becomes an input)   outputs: output
- filter       inputs: data   outputs: match, no-match
- merge        inputs: input-0, input-1, ...   outputs: merged
- api          inputs: body, headers   outputs: response, error
- transform    inputs: input   outputs: output
- condition    inputs: input   outputs: true, false
- timer        inputs: trigger   outputs: output

For condition nodes you MUST specify sourceHandle to pick the branch:
  { "type": "addEdge", "source": "condition-ai-1", "target": "customOutput-ai-1", "sourceHandle": "true" }
  { "type": "addEdge", "source": "condition-ai-1", "target": "customOutput-ai-2", "sourceHandle": "false" }

EDITABLE FIELDS PER NODE TYPE (use with updateNode):
- customInput:  field="inputName" (string), field="inputType" (text|file|number)
- customOutput: field="outputName" (string), field="outputType" (text|file|number)
- llm:          field="model" (gpt-4o|gpt-4-turbo|claude-3-5-sonnet|gemini-1.5-pro)
- condition:    field="expression" (e.g. "user.age > 18", "status == \\"active\\"")
- filter:       field="conditions" (array: [{field,operator,value,logic}], operators: equals|not equals|contains|starts with|ends with|greater than|less than|is empty)
- transform:    field="fromFormat" (JSON|CSV|XML|YAML|Markdown|Plain Text), field="toFormat" (same), field="template" (string)
- api:          field="url" (string), field="method" (GET|POST|PUT|DELETE)
- text:         field="text" (string content, use {{variableName}} for dynamic inputs)
- timer:        field="interval" (number in ms)

CORRECT PIPELINE PATTERNS:
  Input → Text → LLM → Output   (use this for RAG/QA pipelines)
  Input → LLM → Output          (simple chat)
  Input → Filter → Transform → Output  (data processing)
  Input → Condition (true→Output1, false→Output2)  (branching — both outputs go to DIFFERENT downstream nodes, NEVER back upstream)
  Input → LLM → Condition (true→Output, false→ErrorOutput)  (error handling)

Respond with EXACTLY this format:
{
  "actions": [
    { "type": "addNode",    "nodeType": "customInput", "id": "customInput-ai-1", "position": { "x": 60,  "y": 200 }, "label": "query" },
    { "type": "addNode",    "nodeType": "llm",         "id": "llm-ai-1",         "position": { "x": 400, "y": 200 }, "label": "LLM" },
    { "type": "addNode",    "nodeType": "customOutput", "id": "customOutput-ai-1","position": { "x": 750, "y": 200 }, "label": "answer" },
    { "type": "addEdge",    "source": "customInput-ai-1", "target": "llm-ai-1" },
    { "type": "addEdge",    "source": "llm-ai-1",         "target": "customOutput-ai-1" },
    { "type": "layoutPipeline" }
  ],
  "explanation": "One sentence summary."
}

IMPORTANT: Whenever you add 2 or more nodes, ALWAYS include addEdge for each connection AND append { "type": "layoutPipeline" } as the LAST action.

For questions only: { "actions": [], "explanation": "Answer here." }
`.trim();
};

// ── Persistent chat state — survives close/reopen ─────────────────
const _chatStore = {
  messages: [{ role:'assistant', content:"Hi! I can build, modify, and explain your pipeline. Try:\n• \"Add an LLM node after the input\"\n• \"Connect all nodes in sequence\"\n• \"What does this pipeline do?\"\n• \"Add a filter that removes empty responses\"", id: 0 }],
  history:  [],
  model:    null,
};

const NODE_COLORS = {
  customInput:'#3b82f6', llm:'#8b5cf6', customOutput:'#10b981',
  text:'#f59e0b', filter:'#ec4899', merge:'#06b6d4',
  api:'#f97316', transform:'#a855f7', condition:'#f43f5e',
  timer:'#0ea5e9', note:'#fbbf24',
};

const selector = (s) => ({
  addNode: s.addNode, onConnect: s.onConnect,
  onNodesChange: s.onNodesChange, onEdgesChange: s.onEdgesChange,
  getNodeID: s.getNodeID, updateNodeField: s.updateNodeField,
  clearCanvas: s.clearCanvas,
});

// ── Handle ID map — must match BaseNode's `${nodeId}-${handle.id}` pattern ──
const FIRST_OUTPUT_HANDLE = {
  customInput:  'value',
  llm:          'response',
  text:         'output',
  filter:       'match',
  merge:        'merged',
  api:          'response',
  transform:    'output',
  condition:    'true',
  timer:        'output',   // timerNode outputs {id:'output'}
  customOutput: null,       // no output handle
  note:         null,
};
const FIRST_INPUT_HANDLE = {
  customInput:  null,       // no input handle
  llm:          'prompt',
  customOutput: 'value',
  text:         'context',  // text node dynamic: first var is often 'context', fallback handled below
  filter:       'data',
  merge:        'input-0',  // mergeNode uses input-0, input-1, etc.
  api:          'body',     // apiNode first input is 'body'
  transform:    'input',
  condition:    'input',
  timer:        'trigger',  // timerNode input is 'trigger'
  note:         null,
};

// For text nodes: extract the first {{variable}} from the content to use as target handle.
// Falls back to 'context' if no variables or content not available.
const getTextNodeFirstInput = (node) => {
  const content = node?.data?.text ?? node?.data?.content ?? '';
  const match   = content.match(/\{\{(\w+)\}\}/);
  return match ? match[1] : 'context';
};

// ── Action executor ───────────────────────────────────────────────
const useActionExecutor = () => {
  const { addNode, onConnect, onNodesChange, onEdgesChange, updateNodeField, clearCanvas } = useStore(selector, shallow);

  return useCallback((actions) => {
    if (!actions?.length) return;

    // Always read live nodes from store so we don't use stale closures.
    // We also maintain a localNodes list for nodes added IN THIS batch
    // that haven't hit the store yet.
    const batchNodes = [];

    const getLiveNode = (id) =>
      batchNodes.find((n) => n.id === id) ??
      useStore.getState().nodes.find((n) => n.id === id);

    actions.forEach((action) => {
      switch (action.type) {
        case 'addNode': {
          const id = action.id ?? `${action.nodeType}-ai-${Date.now()}`;
          const newNode = {
            id,
            type: action.nodeType,
            position: action.position ?? { x: 400, y: 200 },
            data: {
              id,
              label: action.label ?? action.nodeType,
              ...(action.nodeType === 'customInput'  ? { inputName: action.label ?? 'input',  inputType: 'text' } : {}),
              ...(action.nodeType === 'customOutput' ? { outputName: action.label ?? 'output', outputType: 'text' } : {}),
            },
          };
          addNode(newNode);
          batchNodes.push(newNode); // available for subsequent addEdge in same batch
          break;
        }
        case 'addEdge': {
          const srcNode = getLiveNode(action.source);
          const tgtNode = getLiveNode(action.target);
          if (!srcNode || !tgtNode) {
            console.warn(`[AI] addEdge skipped — node not found: ${!srcNode ? action.source : action.target}. Live IDs:`,
              useStore.getState().nodes.map((n) => n.id));
            break;
          }
          // Skip invalid connections — output nodes have no output, input nodes have no input
          if (FIRST_OUTPUT_HANDLE[srcNode.type] === null) {
            console.warn(`[AI] addEdge skipped — ${srcNode.type} has no output handle`);
            break;
          }
          if (FIRST_INPUT_HANDLE[tgtNode.type] === null) {
            console.warn(`[AI] addEdge skipped — ${tgtNode.type} has no input handle`);
            break;
          }

          // Text nodes: resolve input handle from {{variables}} in content
          const tgtHandleKey = action.targetHandle
            ? action.targetHandle  // AI specified explicit handle
            : tgtNode.type === 'text'
              ? getTextNodeFirstInput(tgtNode)
              : (FIRST_INPUT_HANDLE[tgtNode.type] ?? 'input');

          const srcHandleKey = action.sourceHandle
            ? action.sourceHandle  // AI specified explicit handle (e.g. 'false' for condition)
            : (FIRST_OUTPUT_HANDLE[srcNode.type] ?? 'value');

          onConnect({
            source: action.source, target: action.target,
            sourceHandle: `${action.source}-${srcHandleKey}`,
            targetHandle: `${action.target}-${tgtHandleKey}`,
          });
          break;
        }
        case 'removeNode': {
          onNodesChange([{ type: 'remove', id: action.id }]);
          break;
        }
        case 'removeEdge': {
          const edge = useStore.getState().edges.find((e) => e.source === action.source && e.target === action.target);
          if (edge) onEdgesChange([{ type: 'remove', id: edge.id }]);
          break;
        }
        case 'updateNode': {
          if (action.fields && typeof action.fields === 'object') {
            Object.entries(action.fields).forEach(([field, value]) => {
              updateNodeField(action.id, field, value);
            });
          } else if (action.field !== undefined) {
            updateNodeField(action.id, action.field, action.value);
          }
          break;
        }
        case 'layoutPipeline':
        case 'layout': {
          setTimeout(() => useStore.getState().autoLayout(), 100);
          break;
        }
        case 'clearCanvas': {
          clearCanvas();
          break;
        }
        default: break;
      }
    });
  }, [addNode, onConnect, onNodesChange, onEdgesChange, updateNodeField, clearCanvas]);
};

// ── Message bubble ────────────────────────────────────────────────
const Bubble = ({ msg }) => {
  const isUser = msg.role === 'user';
  const hasActions = msg.actions?.length > 0;

    return (
    <div style={{ display:'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom:'10px' }}>
      {!isUser && (
        <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'linear-gradient(135deg,#8b5cf6,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', flexShrink:0, marginRight:'8px', marginTop:'2px' }}>
          🤖
        </div>
      )}
      <div style={{
        maxWidth:'80%', padding:'10px 13px',
        background: isUser ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'var(--bg-node)',
        border: isUser ? 'none' : '1px solid var(--border)',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        color:'var(--text-primary)', fontSize:'12px', lineHeight:1.6,
        fontFamily:"'DM Sans',sans-serif",
      }}>
        {msg.streaming ? (
          <span>{msg.content}<span style={{ display:'inline-block', width:'8px', height:'12px', background:'#60a5fa', marginLeft:'2px', animation:'blink 0.8s step-end infinite', borderRadius:'1px' }} /></span>
        ) : (
          <span style={{ whiteSpace:'pre-wrap' }}>{msg.content}</span>
        )}
        {hasActions && !msg.streaming && (
          <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:'9px', fontWeight:700, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'5px' }}>Actions applied</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
              {msg.actions.map((a, i) => (
                <span key={i} style={{ fontSize:'9px', padding:'2px 7px', borderRadius:'10px', background:`${NODE_COLORS[a.nodeType] ?? '#4a5878'}22`, border:`1px solid ${NODE_COLORS[a.nodeType] ?? '#4a5878'}44`, color: NODE_COLORS[a.nodeType] ?? 'var(--text-dim)' }}>
                  {a.type === 'addNode' ? `+ ${a.nodeType}` : a.type === 'addEdge' ? `→ edge` : a.type === 'removeNode' ? `− node` : a.type}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────
export const AIPipelineAssistant = ({ onClose }) => {
  const { nodes, edges } = useStore((s) => ({ nodes: s.nodes, edges: s.edges }), shallow);
  const executeActions   = useActionExecutor();

  // Restore from persistent store on every mount
  const [messages,    setMessages]    = useState(() => _chatStore.messages);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [model,       setModel]       = useState(() => _chatStore.model ?? MODELS.MAIN);
  const [availModels, setAvailModels] = useState([]);
  const [ollamaOk,    setOllamaOk]    = useState(null);
  const [history,     setHistory]     = useState(() => _chatStore.history);
  const [pos,         setPos]         = useState({ x: window.innerWidth - 390, y: window.innerHeight - 580 });
  const [dragging,    setDragging]    = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const abortRef   = useRef(null);
  const panelRef   = useRef(null);
  useClickOutside(panelRef, onClose, !loading);

  // Check Ollama on mount
  const modelRef = useRef(model);
  useEffect(() => { modelRef.current = model; }, [model]);

  useEffect(() => {
    getAvailableModels().then(({ available, error }) => {
      setOllamaOk(!error);
      setAvailModels(available);
      if (available.length > 0 && !available.includes(modelRef.current)) setModel(available[0]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);
  // Persist to module-level store so state survives close/reopen
  useEffect(() => { _chatStore.messages = messages; }, [messages]);
  useEffect(() => { _chatStore.history  = history;  }, [history]);
  useEffect(() => { _chatStore.model    = model;    }, [model]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg = { role:'user', content: text, id: Date.now() };
    setMessages((m) => [...m, userMsg]);

    const newHistory = [...history, { role:'user', content: text }];
    setHistory(newHistory);

    // Streaming assistant placeholder
    const assistantId = Date.now() + 1;
    setMessages((m) => [...m, { role:'assistant', content:'', streaming:true, id: assistantId }]);
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const system   = buildSystemPrompt(nodes, edges);
      await chatStream({
        model,
        messages: newHistory,
        system,
        temperature: 0.3,
        signal: abortRef.current.signal,
        onToken: (_, full) => {
          setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, content: full } : msg));
        },
        onDone: async (full) => {
          let explanation = '';
          let actions     = [];
          try {
            const clean = full.replace(/```json|```/g, '');

            // Extract ALL JSON objects from the response (llama2 returns multiple blocks)
            const allBlocks = [];
            let searchFrom  = 0;
            while (searchFrom < clean.length) {
              const start = clean.indexOf('{', searchFrom);
              if (start === -1) break;
              // Find matching closing brace
              let depth = 0, end = -1;
              for (let i = start; i < clean.length; i++) {
                if (clean[i] === '{') depth++;
                else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
              }
              if (end === -1) break;
              try {
                const parsed = JSON.parse(clean.slice(start, end + 1));
                if (parsed.actions) allBlocks.push(parsed);
              } catch { /* skip malformed block */ }
              searchFrom = end + 1;
            }

            if (allBlocks.length > 0) {
              // Merge all actions from all blocks into one list
              actions     = allBlocks.flatMap((b) => b.actions ?? []);
              // Use last explanation or strip prose from full response
              explanation = allBlocks[allBlocks.length - 1].explanation
                ?? full.replace(/\{[\s\S]*?\}/g, '').replace(/\n{3,}/g, '\n\n').trim();
            } else {
              // Pure prose answer — no JSON blocks at all
              explanation = full.trim();
            }

            if (actions.length > 0) {
              const nodeActions   = actions.filter((a) => a.type === 'addNode');
              const edgeActions   = actions.filter((a) => a.type === 'addEdge');
              const layoutActions = actions.filter((a) => a.type === 'layoutPipeline' || a.type === 'layout');
              const otherActions  = actions.filter((a) => !['addNode','addEdge','layoutPipeline','layout'].includes(a.type));

              // Fallback: auto-chain nodes if model forgot edges
              // Sort nodes by role: inputs → processing → outputs
              const CHAIN_ORDER = {
                customInput: 0, timer: 1, api: 2, text: 3, transform: 4,
                filter: 5, merge: 6, condition: 7, llm: 8, customOutput: 9,
              };
              const autoEdges = [];
              if (nodeActions.length >= 2 && edgeActions.length === 0) {
                // Sort by natural pipeline role
                const sorted = [...nodeActions].sort((a, b) =>
                  (CHAIN_ORDER[a.nodeType] ?? 5) - (CHAIN_ORDER[b.nodeType] ?? 5)
                );
                for (let i = 0; i < sorted.length - 1; i++) {
                  const src = sorted[i];
                  const tgt = sorted[i + 1];
                  // Only chain if src has output and tgt has input
                  if (FIRST_OUTPUT_HANDLE[src.nodeType] !== null &&
                      FIRST_INPUT_HANDLE[tgt.nodeType] !== null) {
                    autoEdges.push({ type: 'addEdge', source: src.id, target: tgt.id });
                  }
                }
              }

              setTimeout(() => executeActions(nodeActions),   80);
              setTimeout(() => executeActions([...edgeActions, ...autoEdges]), 900);
              if (otherActions.length) setTimeout(() => executeActions(otherActions), 1100);
              // Layout fires last — after all nodes/edges are in store
              if (layoutActions.length > 0 || nodeActions.length >= 2) {
                setTimeout(() => useStore.getState().autoLayout(), 1400);
              }
              toast.success(`✨ Applied ${actions.length + autoEdges.length} action${actions.length > 1 ? 's' : ''}${autoEdges.length > 0 ? ' (auto-chained)' : ''}`);
            }
          } catch {
            explanation = full.trim();
          }

          setMessages((m) => m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: explanation, streaming: false, actions } : msg
          ));
          setHistory((h) => [...h, { role:'assistant', content: explanation }]);
          setLoading(false);
        },
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, content:'[Stopped]', streaming:false } : msg));
      } else {
        setMessages((m) => m.map((msg) => msg.id === assistantId ? { ...msg, content:`Error: ${e.message}`, streaming:false } : msg));
        toast.error('Ollama error: ' + e.message);
      }
      setLoading(false);
    }
  };

  const stop = () => { abortRef.current?.abort(); setLoading(false); };

  const onMouseDown = (e) => {
    if (e.target.closest('button,select,textarea')) return;
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - 360, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 520, e.clientY - dragOffset.current.y)),
    });
  };
  const onMouseUp = () => setDragging(false);

  const quickPrompts = [
    'What does this pipeline do?',
    'Add an LLM node after the input',
    'Connect all unconnected nodes',
    'How can I improve this pipeline?',
    'Add error handling with a condition node',
  ];

  return (
    <div ref={panelRef} style={{
      position:'fixed', left:`${pos.x}px`, top:`${pos.y}px`, zIndex:8000,
      width:'360px', height:'520px',
      background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:'16px', display:'flex', flexDirection:'column',
      boxShadow:'0 20px 60px #0009', fontFamily:"'DM Sans',sans-serif",
      overflow:'hidden',
      cursor: dragging ? 'grabbing' : 'default',
    }}
    onMouseMove={onMouseMove}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseUp}>
      {/* Header — drag handle */}
      <div onMouseDown={onMouseDown} style={{ padding:'12px 14px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'10px', flexShrink:0, cursor: dragging ? 'grabbing' : 'grab', userSelect:'none' }}>
        <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'linear-gradient(135deg,#8b5cf6,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>🤖</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:'13px', fontWeight:800, color:'var(--text-primary)' }}>AI Pipeline Assistant</div>
          <div style={{ fontSize:'9px', color: ollamaOk === null ? 'var(--text-dim)' : ollamaOk ? '#10b981' : '#f43f5e' }}>
            {ollamaOk === null ? 'Connecting…' : ollamaOk ? `● Ollama connected` : '● Ollama offline'}
          </div>
        </div>
        {/* Model selector */}
        {availModels.length > 0 && (
          <select value={model} onChange={(e) => setModel(e.target.value)}
            style={{ fontSize:'9px', background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'5px', color:'var(--text-dim)', padding:'2px 5px', cursor:'pointer', maxWidth:'110px' }}>
            {availModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:'18px', padding:'0', lineHeight:1 }}>×</button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
        {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — show when input is empty */}
      {!input && !loading && messages.length < 3 && (
        <div style={{ padding:'0 14px 8px', display:'flex', flexWrap:'wrap', gap:'5px', flexShrink:0 }}>
          {quickPrompts.map((p) => (
            <button key={p} onClick={() => { setInput(p); inputRef.current?.focus(); }}
              style={{ fontSize:'10px', padding:'4px 9px', background:'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'12px', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >{p}</button>
          ))}
        </div>
      )}

      {/* Ollama offline banner */}
      {ollamaOk === false && (
        <div style={{ margin:'0 14px 8px', padding:'8px 12px', background:'#f43f5e15', border:'1px solid #f43f5e44', borderRadius:'8px', fontSize:'10px', color:'#f87171' }}>
          ⚠ Ollama is not running. Start it with: <code style={{ background:'#ffffff10', padding:'1px 5px', borderRadius:'3px' }}>ollama serve</code>
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding:'10px 14px 12px', borderTop:'1px solid var(--border)', display:'flex', gap:'8px', flexShrink:0 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Describe what to build or change… (Enter to send)"
          rows={2}
          disabled={!ollamaOk}
          style={{
            flex:1, background:'var(--bg-node)', border:'1px solid var(--border)',
            borderRadius:'10px', padding:'8px 12px', fontSize:'12px',
            color:'var(--text-primary)', resize:'none', outline:'none',
            fontFamily:'inherit', lineHeight:1.5,
            transition:'border-color 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border)'; }}
        />
        {loading ? (
          <button onClick={stop} style={{ background:'#f43f5e', border:'none', borderRadius:'10px', color:'#fff', fontSize:'12px', fontWeight:700, padding:'0 14px', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>■ Stop</button>
        ) : (
          <button onClick={send} disabled={!input.trim() || !ollamaOk}
            style={{ background: input.trim() && ollamaOk ? 'linear-gradient(135deg,#6366f1,#3b82f6)' : 'var(--bg-node)', border:'1px solid var(--border)', borderRadius:'10px', color: input.trim() && ollamaOk ? '#fff' : 'var(--text-hint)', fontSize:'14px', padding:'0 14px', cursor: input.trim() && ollamaOk ? 'pointer' : 'not-allowed', flexShrink:0, transition:'all 0.15s' }}>
            ➤
          </button>
        )}
      </div>
    </div>
  );
};