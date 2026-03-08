// templates.js — Pre-built pipeline templates

export const TEMPLATES = [
  {
    id: 'rag',
    name: 'RAG Pipeline',
    description: 'Retrieval-Augmented Generation with input, retriever, LLM and output.',
    icon: '🔍',
    nodes: [
      { id: 'customInput-1', type: 'customInput', position: { x: 60,  y: 120 }, data: { id: 'customInput-1', inputName: 'query',   inputType: 'Text' } },
      { id: 'customInput-2', type: 'customInput', position: { x: 60,  y: 300 }, data: { id: 'customInput-2', inputName: 'context', inputType: 'Text' } },
      { id: 'text-1',        type: 'text',        position: { x: 360, y: 60  }, data: { id: 'text-1',        text: 'Answer the question using the context below:\n\nContext: {{context}}\n\nQuestion: {{query}}' } },
      { id: 'llm-1',         type: 'llm',         position: { x: 700, y: 180 }, data: { id: 'llm-1',         model: 'gpt-4o' } },
      { id: 'customOutput-1',type: 'customOutput', position: { x: 980, y: 180 }, data: { id: 'customOutput-1', outputName: 'answer', outputType: 'Text' } },
    ],
    edges: [
      { id: 'e1', source: 'customInput-1', sourceHandle: 'customInput-1-value', target: 'text-1', targetHandle: 'text-1-query'   },
      { id: 'e2', source: 'customInput-2', sourceHandle: 'customInput-2-value', target: 'text-1', targetHandle: 'text-1-context' },
      { id: 'e3', source: 'text-1',        sourceHandle: 'text-1-output',        target: 'llm-1',  targetHandle: 'llm-1-prompt'  },
      { id: 'e4', source: 'llm-1',         sourceHandle: 'llm-1-response',       target: 'customOutput-1', targetHandle: 'customOutput-1-value' },
    ],
  },
  {
    id: 'chatbot',
    name: 'Simple Chatbot',
    description: 'User message → system prompt → LLM → response output.',
    icon: '🤖',
    nodes: [
      { id: 'customInput-1', type: 'customInput', position: { x: 60,  y: 100 }, data: { id: 'customInput-1', inputName: 'user_message', inputType: 'Text' } },
      { id: 'customInput-2', type: 'customInput', position: { x: 60,  y: 260 }, data: { id: 'customInput-2', inputName: 'system_prompt', inputType: 'Text' } },
      { id: 'llm-1',         type: 'llm',         position: { x: 380, y: 180 }, data: { id: 'llm-1', model: 'gpt-4o' } },
      { id: 'customOutput-1',type: 'customOutput', position: { x: 660, y: 180 }, data: { id: 'customOutput-1', outputName: 'response', outputType: 'Text' } },
    ],
    edges: [
      { id: 'e1', source: 'customInput-1', sourceHandle: 'customInput-1-value', target: 'llm-1', targetHandle: 'llm-1-prompt' },
      { id: 'e2', source: 'customInput-2', sourceHandle: 'customInput-2-value', target: 'llm-1', targetHandle: 'llm-1-system' },
      { id: 'e3', source: 'llm-1', sourceHandle: 'llm-1-response', target: 'customOutput-1', targetHandle: 'customOutput-1-value' },
    ],
  },
  {
    id: 'data-cleaner',
    name: 'Data Cleaner',
    description: 'Input data → filter → transform → output.',
    icon: '🧹',
    nodes: [
      { id: 'customInput-1', type: 'customInput', position: { x: 60,  y: 180 }, data: { id: 'customInput-1', inputName: 'raw_data', inputType: 'File' } },
      { id: 'filter-1',      type: 'filter',      position: { x: 320, y: 100 }, data: { id: 'filter-1', field: 'status', operator: 'equals', value: 'active' } },
      { id: 'transform-1',   type: 'transform',   position: { x: 600, y: 180 }, data: { id: 'transform-1', fromFormat: 'JSON', toFormat: 'CSV' } },
      { id: 'customOutput-1',type: 'customOutput', position: { x: 880, y: 180 }, data: { id: 'customOutput-1', outputName: 'clean_data', outputType: 'Text' } },
    ],
    edges: [
      { id: 'e1', source: 'customInput-1', sourceHandle: 'customInput-1-value', target: 'filter-1',    targetHandle: 'filter-1-data' },
      { id: 'e2', source: 'filter-1',      sourceHandle: 'filter-1-match',      target: 'transform-1', targetHandle: 'transform-1-input' },
      { id: 'e3', source: 'transform-1',   sourceHandle: 'transform-1-output',  target: 'customOutput-1', targetHandle: 'customOutput-1-value' },
    ],
  },
  {
    id: 'api-pipeline',
    name: 'API Enrichment',
    description: 'Fetch data from an API, transform it, then output.',
    icon: '🌐',
    nodes: [
      { id: 'customInput-1', type: 'customInput', position: { x: 60,  y: 180 }, data: { id: 'customInput-1', inputName: 'query', inputType: 'Text' } },
      { id: 'api-1',         type: 'api',         position: { x: 320, y: 180 }, data: { id: 'api-1', url: 'https://api.example.com/enrich', method: 'POST', authType: 'Bearer' } },
      { id: 'transform-1',   type: 'transform',   position: { x: 620, y: 180 }, data: { id: 'transform-1', fromFormat: 'JSON', toFormat: 'Markdown' } },
      { id: 'customOutput-1',type: 'customOutput', position: { x: 900, y: 180 }, data: { id: 'customOutput-1', outputName: 'result', outputType: 'Text' } },
    ],
    edges: [
      { id: 'e1', source: 'customInput-1', sourceHandle: 'customInput-1-value', target: 'api-1',       targetHandle: 'api-1-body' },
      { id: 'e2', source: 'api-1',         sourceHandle: 'api-1-response',       target: 'transform-1', targetHandle: 'transform-1-input' },
      { id: 'e3', source: 'transform-1',   sourceHandle: 'transform-1-output',  target: 'customOutput-1', targetHandle: 'customOutput-1-value' },
    ],
  },
];