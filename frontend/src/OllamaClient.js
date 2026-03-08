// OllamaClient.js — Wrapper for Ollama local API with streaming support

const OLLAMA_BASE = 'http://127.0.0.1:11434';

export const MODELS = {
  FAST:   'llama3.2:3b',  // fast suggestions, type hints
  MAIN:   'llama3.2:3b',  // main assistant — better JSON than llama2:7b
  CODER:  'llama3.2:3b',  // structured JSON output
};

// ── Check which models are available ─────────────────────────────
export const getAvailableModels = async () => {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return { available: [], error: 'Ollama not running' };
    const data = await res.json();
    return { available: (data.models ?? []).map((m) => m.name), error: null };
  } catch {
    return { available: [], error: 'Cannot connect to Ollama at localhost:11434' };
  }
};

// ── One-shot generation (non-streaming) ──────────────────────────
export const generate = async ({ model, prompt, system, temperature = 0.3, maxTokens = 1024 }) => {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: system ? `${system}\n\n${prompt}` : prompt,
      stream: false,
      options: { temperature, num_predict: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response ?? '';
};

// ── Chat API (multi-turn with streaming) ─────────────────────────
export const chatStream = async ({ model, messages, system, temperature = 0.5, onToken, onDone, signal }) => {
  const msgs = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      messages: msgs,
      stream: true,
      options: { temperature, num_predict: 2048 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const token = obj.message?.content ?? '';
        if (token) { full += token; onToken?.(token, full); }
        if (obj.done) { onDone?.(full); return full; }
      } catch { /* partial line */ }
    }
  }
  onDone?.(full);
  return full;
};

// ── Generate structured JSON (with retry + parse) ─────────────────
export const generateJSON = async ({ model = MODELS.CODER, prompt, system, retries = 2 }) => {
  const sys = (system ?? '') + '\n\nYou MUST respond with valid JSON only. No markdown, no explanation, no backticks. Raw JSON object only.';
  for (let i = 0; i <= retries; i++) {
    try {
      const raw = await generate({ model, prompt, system: sys, temperature: 0.1, maxTokens: 1500 });
      const clean = raw.replace(/```json|```/g, '').trim();
      // Find first { to last }
      const start = clean.indexOf('{');
      const end   = clean.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');
      return JSON.parse(clean.slice(start, end + 1));
    } catch (e) {
      if (i === retries) throw e;
    }
  }
};

// ── Build compact graph context for prompts ───────────────────────
export const buildGraphContext = (nodes, edges) => {
  const nodeList = nodes.map((n) => ({
    id: n.id, type: n.type,
    ...(n.data?.inputName  ? { name: n.data.inputName }  : {}),
    ...(n.data?.outputName ? { name: n.data.outputName } : {}),
  }));
  const edgeList = edges.map((e) => ({ from: e.source, to: e.target }));
  return JSON.stringify({ nodes: nodeList, edges: edgeList }, null, 2);
};