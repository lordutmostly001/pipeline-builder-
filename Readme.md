# Pipeline Editor — Developer Documentation

A visual, node-based pipeline editor built with React, ReactFlow, and Zustand. Pipelines are constructed by dragging nodes onto a canvas, connecting them with edges, and submitting to a FastAPI backend for validation.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Architecture Overview](#architecture-overview)
5. [State Management (store.js)](#state-management)
6. [Node Types](#node-types)
7. [Handle ID Convention](#handle-id-convention)
8. [BaseNode Component](#basenode-component)
9. [Canvas & UI (ui.js)](#canvas--ui)
10. [Toolbar](#toolbar)
11. [Templates](#templates)
12. [Graph Analytics](#graph-analytics)
13. [Edge System](#edge-system)
14. [Workspaces](#workspaces)
15. [AI Pipeline Assistant](#ai-pipeline-assistant)
16. [Panels & Modals](#panels--modals)
17. [Theme System](#theme-system)
18. [Persistence](#persistence)
19. [Backend API](#backend-api)
20. [Keyboard Shortcuts](#keyboard-shortcuts)
21. [Known Patterns & Gotchas](#known-patterns--gotchas)

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 |
| Canvas | ReactFlow |
| State | Zustand (with devtools) |
| Animation | Framer Motion |
| Styling | CSS variables + inline styles |
| Local LLM | Ollama (via `OllamaClient.js`) |
| Backend | FastAPI (Python) |
| Build | Webpack (CRA) |

---

## Project Structure

```
src/
├── App.js                    # Root component, modal orchestration
├── store.js                  # Central Zustand store
├── workspaceStore.js         # Workspace init/persistence helpers
├── persist.js                # localStorage read/write
├── index.js                  # React entry point
├── index.css                 # Global styles, ReactFlow overrides
│
├── nodes/
│   ├── BaseNode.js           # Shared node shell (handles, header, collapse)
│   ├── inputNode.js          # customInput type
│   ├── outputNode.js         # customOutput type
│   ├── llmNode.js            # LLM node (model selector)
│   ├── textNode.js           # Text template node (dynamic handles)
│   ├── filterNode.js         # Filter/condition node
│   ├── mergeNode.js          # Fan-in merge node
│   ├── apiNode.js            # HTTP API call node
│   ├── transformNode.js      # Data format transform node
│   ├── conditionNode.js      # Boolean branch node
│   ├── timerNode.js          # Timer/delay node
│   ├── noteNode.js           # Sticky note (no handles)
│   ├── componentNode.js      # Saved sub-pipeline component
│   ├── nodeStyles.js         # Shared style helpers
│   └── theme.css             # CSS design token variables
│
├── ui.js                     # ReactFlow canvas, SmartMiniMap
├── toolbar.js                # Top toolbar, node palette, export
├── submit.js                 # Submit button + results modal
├── draggableNode.js          # Draggable node chip in toolbar
│
├── graphAnalytics.js         # DAG analysis, critical path, health score
├── edgeUtils.js              # Edge styling, cycle detection
├── autoLayout.js             # Dagre auto-layout
├── TypeInferenceEngine.js    # Handle type mismatch warnings
├── PipelineLinter.js         # Real-time lint overlay
│
├── AIPipelineAssistant__1_.js # AI assistant sidebar (Ollama)
├── OllamaClient.js           # Ollama streaming client
│
├── templates.js              # Pre-built pipeline templates
├── TemplatesModal.js         # Templates picker UI
│
├── ContextMenu.js            # Node right-click menu
├── EdgeContextMenu.js        # Edge right-click menu
├── NodeComment.js            # Comment bubble anchored to nodes
├── NodeInspector.js          # Right-side node property panel
├── NodeGenealogy.js          # Node ancestry/lineage viewer
├── NodeSearch.js             # Spotlight search for nodes
│
├── VersionPanel.js           # Named version snapshots
├── VersionDiff.js            # Diff viewer between versions
├── BookmarkPanel.js          # Bookmarked pipeline states
├── WorkspaceTabs.js          # Multi-tab workspace switcher
│
├── StatsPanel.js             # Live graph stats overlay
├── ValidationPanel.js        # Validation error display
├── PreflightPanel.js         # Pre-run checklist
├── ExecutionPreview.js       # Simulated execution walkthrough
├── PipelineExplainer.js      # AI-powered error explainer
├── PipelineShare.js          # URL-based pipeline sharing
│
├── ComponentLibrary.js       # Saved reusable components
├── componentStore.js         # Component persistence helpers
├── SaveComponentModal.js     # Save selection as component
│
├── CanvasMood.js             # Reactive canvas background mood
├── SmartRecommend.js         # Node connection suggestions
├── PatternSuggestion.js      # Usage pattern detector
├── SpotlightModal.js         # Ctrl+K command palette
├── ShortcutsModal.js         # Keyboard shortcuts cheatsheet
│
├── NotificationStore.js      # Global notification bus
├── NotificationDrawer.js     # Bell + slide-in notification panel
├── Toast.js                  # Toast notification system
├── ConfirmBanner.js          # Destructive action confirm banner
└── useKeyboardShortcuts.js   # Keyboard shortcut hook
```

---

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm start          
```

### Backend

```bash
pip install fastapi uvicorn
uvicorn main:app --reload   
```

> **Note:** The frontend dev server runs on port **3001** (not 3000). The FastAPI CORS config allows `http://localhost:3000` — update `main.py` if your port differs.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    App.js                        │
│  Modal state orchestration, keyboard shortcuts   │
└────────────┬──────────────────┬─────────────────┘
             │                  │
    ┌────────▼──────┐   ┌──────▼────────┐
    │  PipelineUI   │   │ PipelineToolbar│
    │  (ReactFlow)  │   │  (toolbar.js) │
    └────────┬──────┘   └───────────────┘
             │
    ┌────────▼──────────────────────────┐
    │            Zustand store           │
    │  nodes / edges / workspaces /      │
    │  versions / comments / bookmarks   │
    └────────────────────────────────────┘
             │
    ┌────────▼──────┐
    │  FastAPI       │
    │  /pipelines/   │
    │  parse         │
    └───────────────┘
```

All state lives in a single Zustand store. ReactFlow reads `nodes` and `edges` from the store and dispatches changes back via `onNodesChange`, `onEdgesChange`, and `onConnect`.

---

## State Management

**File:** `store.js`

### Top-level State Shape

```js
{
  // Active workspace fields (mirrored from workspaces[activeId])
  nodes:        ReactFlowNode[],
  edges:        ReactFlowEdge[],
  nodeIDs:      { [type: string]: number },   // auto-increment counters
  past:         Snapshot[],                   // undo history
  future:       Snapshot[],                   // redo history
  versions:     NamedVersion[],
  comments:     { [nodeId: string]: string },
  bookmarks:    Bookmark[],
  nodeStatus:   { [nodeId: string]: 'idle'|'running'|'success'|'error'|'warning' },
  cycleEdgeIds: Set<string>,

  // Workspace management
  workspaces:   Workspace[],
  activeId:     string,

  // Global
  theme:        'dark' | 'light',
  recommendations: any[],
}
```

### Key Actions

| Action | Description |
|---|---|
| `addNode(node)` | Adds a node and auto-detects cycles |
| `onNodesChange(changes)` | ReactFlow change handler |
| `onEdgesChange(changes)` | ReactFlow change handler |
| `onConnect(connection)` | Creates an edge, runs cycle detection |
| `updateNodeField(id, field, value)` | Updates a single field in `node.data` |
| `toggleNodeCollapsed(id)` | Toggle node body collapse |
| `loadTemplate(template)` | Replaces canvas with template, resets cycle state |
| `undo()` / `redo()` | 50-step history |
| `saveVersion(label)` | Named snapshot |
| `clearCanvas()` | Wipes nodes + edges |
| `exportJSON()` / `exportYAML()` / `exportGraphviz()` / `exportImage()` | Export pipeline |
| `importJSON(json)` | Import pipeline from JSON string |
| `autoLayout()` | Run Dagre layout |
| `toggleTheme()` | Switch dark/light |
| `setComment(nodeId, text)` | Attach a comment to a node |
| `deleteComment(nodeId)` | Remove a node's comment |
| `createWorkspace(name)` | Add a new workspace tab |
| `switchWorkspace(id)` | Change active workspace |
| `deleteWorkspace(id)` | Remove a workspace tab |

### NODE_COLORS Export

```js
export const NODE_COLORS = {
  customInput: '#3b82f6', llm: '#8b5cf6', customOutput: '#10b981',
  text: '#f59e0b', filter: '#ec4899', merge: '#06b6d4',
  api: '#f97316', transform: '#a855f7', condition: '#f43f5e',
  timer: '#0ea5e9', note: '#fbbf24', component: '#64748b',
};
```

---

## Node Types

### customInput — Input Node
**Color:** Blue `#3b82f6`  
**Handles:** 1 output — `{nodeId}-value`  
**Data fields:** `inputName` (string), `inputType` ('Text' | 'File' | 'Number' | 'Boolean')  
**Purpose:** Entry point for pipeline data. Name becomes the variable identifier.

---

### customOutput — Output Node
**Color:** Green `#10b981`  
**Handles:** 1 input — `{nodeId}-value`  
**Data fields:** `outputName`, `outputType`  
**Purpose:** Terminal node that collects the pipeline result.

---

### llm — LLM Node
**Color:** Purple `#8b5cf6`  
**Handles:** inputs: `{nodeId}-system`, `{nodeId}-prompt` / output: `{nodeId}-response`  
**Data fields:** `model` (string, e.g. `'gpt-4o'`)  
**Purpose:** Routes a system prompt and user prompt to the configured LLM model.

---

### text — Text Template Node
**Color:** Amber `#f59e0b`  
**Handles:** Dynamically generated — one input per `{{variable}}` found in the text content, named `{nodeId}-{variableName}`. Output: `{nodeId}-output`  
**Data fields:** `text` (string, supports `{{variable}}` syntax)  
**Purpose:** Template string that interpolates connected inputs. Handles are created/destroyed as variables are added/removed from the text.

> ⚠️ **Important:** Because handles are dynamic, template edges must exactly match the variable names in the text content. Renaming a variable breaks existing edges.

---

### filter — Filter Node
**Color:** Pink `#ec4899`  
**Handles:** input: `{nodeId}-data` / outputs: `{nodeId}-match`, `{nodeId}-no-match`  
**Data fields:** `field`, `operator`, `value`, `conditions[]`, `logic` ('AND' | 'OR')  
**Purpose:** Routes data to match or no-match output based on filter rules.

---

### merge — Merge Node
**Color:** Cyan `#06b6d4`  
**Handles:** Dynamic inputs — `{nodeId}-input-0`, `{nodeId}-input-1`, etc. / output: `{nodeId}-merged`  
**Purpose:** Fan-in node that combines multiple inputs into one output.

---

### api — API Call Node
**Color:** Orange `#f97316`  
**Handles:** inputs: `{nodeId}-body`, `{nodeId}-headers` / outputs: `{nodeId}-response`, `{nodeId}-error`  
**Data fields:** `url`, `method` ('GET'|'POST'|'PUT'|'DELETE'), `authType`, `authToken`  
**Purpose:** Makes an HTTP request and passes the response downstream.

---

### transform — Transform Node
**Color:** Violet `#a855f7`  
**Handles:** input: `{nodeId}-input` / output: `{nodeId}-output`  
**Data fields:** `fromFormat`, `toFormat` (JSON, CSV, Markdown, XML, YAML, Text)  
**Purpose:** Converts data between formats.

---

### condition — Condition Node
**Color:** Red `#f43f5e`  
**Handles:** input: `{nodeId}-input` / outputs: `{nodeId}-true`, `{nodeId}-false`  
**Data fields:** `expression` (string)  
**Purpose:** Boolean branch — routes data to true or false output.

---

### timer — Timer Node
**Color:** Sky `#0ea5e9`  
**Handles:** input: `{nodeId}-trigger` / output: `{nodeId}-output`  
**Data fields:** `delay` (ms), `mode` ('once' | 'repeat')  
**Purpose:** Introduces a delay in pipeline execution.

---

### note — Note Node
**Color:** Yellow `#fbbf24`  
**Handles:** None  
**Data fields:** `text`  
**Purpose:** Sticky note annotation. Excluded from graph analytics.

---

### component — Component Node
**Color:** Slate `#64748b`  
**Handles:** Derived from saved component's detected ports  
**Purpose:** Reusable encapsulated sub-pipeline loaded from the component library.

---

## Handle ID Convention

**This is the most critical architectural rule in the codebase.**

Every handle ID must follow the format:

```
{nodeId}-{handleName}
```

Examples:
- `customInput-1-value`
- `llm-1-prompt`
- `llm-1-system`
- `llm-1-response`
- `text-1-context`
- `text-1-output`
- `filter-1-data`
- `filter-1-match`
- `filter-1-no-match`
- `customOutput-1-value`
- `condition-1-input`
- `condition-1-true`
- `condition-1-false`

**Why this matters:** ReactFlow matches edge `sourceHandle`/`targetHandle` strings to the `id` prop on `<Handle>` components. If they don't match exactly, the edge exists in state but has no physical handle to attach to — it appears disconnected even though the data is correct.

BaseNode registers handles as:
```jsx
<Handle id={`${id}-${handle.id}`} ... />
```

All templates, the AI assistant, and `onConnect` must produce edges using this convention.

---

## BaseNode Component

**File:** `nodes/BaseNode.js`

The shared shell used by all node types except `TextNode` and `NoteNode` (which have custom layouts).

### Props

```js
BaseNode({
  id,           // string — ReactFlow node ID
  title,        // string — node type label shown in header
  color,        // string — accent hex color
  icon,         // string — emoji icon
  inputs,       // Array<{ id: string, label: string }> — input handle defs
  outputs,      // Array<{ id: string, label: string }> — output handle defs
  minWidth,     // number — minimum node width in px (default 240)
  children,     // ReactNode — node body content
  style,        // object — extra style overrides
})
```

### Features

- **Collapsible body** — click the header to collapse/expand with animation
- **Renameable** — click the name bar or pencil icon to rename
- **Status dot** — color-coded dot in header: idle (dim) / running (amber) / success (green) / error (red) / warning (orange)
- **Status glow** — error/warning states add a colored glow ring to the node border
- **Comments** — shows `NodeCommentBubble` anchored to the right edge when a comment exists; shows `AddCommentBtn` when the node is selected and has no comment
- **Handle registration** — all handles use `${id}-${handle.id}` format

---

## Canvas & UI

**File:** `ui.js`

### PipelineUI Props

```js
PipelineUI({
  onSubmit,             // () => void
  onToggleHelp,         // () => void
  onCloseModal,         // () => void
  animating,            // boolean — triggers edge flow animation
  cycleEdgeIds,         // Set<string> | null — overrides store cycle IDs
  onNodeGenealogyOpen,  // (nodeId: string) => void
  onSaveComponent,      // (nodeIds: string[]) => void
})
```

### Edge Styling Pipeline

Every render, edges are transformed via `useMemo`:

1. Check if edge is part of a cycle → red pulse animation
2. Check if edge is on the critical path → gold color
3. Otherwise apply standard style from `buildEdgeStyle()` in `edgeUtils.js`
4. Apply hover glow if source or target is hovered

### SmartMiniMap

Rendered as a child of `<ReactFlow>` at `bottom: 16px, right: 16px`. Has three UI controls:

- **🗺 toggle** — show/hide minimap entirely
- **⊞/⊟** — expand (240×160) or compact (160×110) size
- **Mode button** — cycles through three color modes:
  - `🎨 Type` — node type colors from `NODE_COLORS`
  - `📊 Depth` — blue→purple→red gradient based on topological distance
  - `⚡ Status` — red=critical path, amber=bottleneck, green=healthy, grey=unreachable

Shows a live legend and footer stats (node count, unreachable count, bottleneck count).

### Other Canvas Features

- **Drag-to-add** — drag node chips from toolbar onto canvas; position calculated via `reactFlowInstance.project()`
- **Double-click edge** — deletes edge immediately
- **Right-click node** — opens `ContextMenu`
- **Right-click edge** — opens `EdgeContextMenu`
- **Double-click node** — opens `NodeGenealogy`
- **Cycle banner** — floating warning at top of canvas when cycle edges exist
- **Empty state** — shown when canvas has no nodes
- **Comment overlays** — rendered inside each node via BaseNode

---

## Toolbar

**File:** `toolbar.js`

Left side: node type chips (draggable via HTML5 drag API).  
Right side: action buttons.

### Toolbar Actions

| Button | Action |
|---|---|
| 📐 Layout | Auto-layout with Dagre |
| 🔍 Search | Open node spotlight (Ctrl+K) |
| 📋 Templates | Open templates modal |
| 🔖 Bookmarks | Toggle bookmarks panel |
| 🕰 Versions | Toggle versions panel |
| 🚀 Preflight | Open pre-flight check |
| 🤖 AI | Toggle AI assistant |
| 🔗 Share | Toggle share panel |
| 💡 Explain | Toggle pipeline explainer |
| 🧩 Components | Toggle component library |
| Export ▾ | Dropdown: JSON / YAML / Graphviz / PNG / Import JSON |
| ☀️/🌙 | Toggle light/dark theme |
| 🔔 | Notification bell + drawer |

---

## Templates

**File:** `templates.js`

Four built-in templates loaded via `store.loadTemplate()`:

### RAG Pipeline
`Input(query)` + `Input(context)` → `Text({{query}},{{context}})` → `LLM` → `Output`

### Simple Chatbot
`Input(user_message)` + `Input(system_prompt)` → `LLM` → `Output`

### Data Cleaner
`Input(raw_data)` → `Filter` → `Transform` → `Output`

### API Enrichment
`Input(query)` → `API Call` → `Transform` → `Output`

### Template Edge Format

```js
{
  id: 'e1',
  source: 'customInput-1',
  sourceHandle: 'customInput-1-value',   // must match registered handle ID
  target: 'text-1',
  targetHandle: 'text-1-query',           // must match registered handle ID
}
```

> When adding new templates, ensure `sourceHandle` and `targetHandle` follow the `{nodeId}-{handleName}` convention exactly.

---

## Graph Analytics

**File:** `graphAnalytics.js`

Runs on every render via `useMemo` in `PipelineUI`. Returns:

```js
{
  nodeCount, edgeCount,
  sources,          // Node[] — nodes with no incoming edges
  sinks,            // Node[] — nodes with no outgoing edges
  branches,         // Node[] — nodes with 2+ outgoing edges
  depth,            // number — longest path length
  isDAG,            // boolean
  dist,             // { [nodeId]: number } — topological depth
  distTime,         // { [nodeId]: number } — estimated latency (ms)
  criticalPath: {
    nodeIds: Set<string>,
    edgeIds: Set<string>,
    estimatedMs: number,
    estimatedLabel: string,
  },
  deadNodes,        // Node[] — unreachable from any sink
  articulationPoints, // Set<nodeId> — bottleneck nodes
  density,          // number
  branchFactor,     // number
  topoOrder,        // string[] — topological sort order
}
```

### Health Score (`computeHealthScore`)

Returns a 0–100 score based on:
- Cycle presence (−30)
- Dead nodes (−5 per node, max −20)
- Articulation points/bottlenecks (−5 per node, max −10)
- No sources or sinks (−15 each)
- Density and branch factor bonuses

### Lint Rules (`lintPipeline`)

Returns `Array<{ id, level, msg, nodeId, action? }>` where `level` is `'error' | 'warning' | 'info'`. Common rules:

- Error: cycle detected
- Error: disconnected node
- Warning: no input nodes
- Warning: no output nodes
- Info: articulation points found
- Info: dead/unreachable nodes

> ⚠️ The return shape uses `msg` not `message`. Components must access `item.msg`.

---

## Edge System

**File:** `edgeUtils.js`

### `detectCycleEdges(nodes, edges) → Set<string>`

Uses DFS to find edges involved in cycles. Returns a Set of edge IDs. Called on every `onConnect`, `addNode`, and `loadTemplate`.

### `buildEdgeStyle({ edge, hoveredNodeId, animating, cycleEdgeIds })`

Returns a style object for an edge:
- Hovered source/target: brighter stroke
- Animating: flowing dash animation via CSS keyframes
- Normal: dim color based on source node type color

### Edge CSS Animations

Defined in `ui.js` as an injected `<style>` tag:
- `edgeFlow` — all edges flow dashoffset continuously
- `cyclePulse` — cycle edges pulse red
- `neonPulse` — arrowheads pulse glow

---

## Workspaces

**File:** `workspaceStore.js`

Each workspace is an isolated pipeline environment with its own:
- nodes / edges
- undo/redo history
- named versions
- comments
- bookmarks
- node statuses
- cycle edge IDs

Workspaces are persisted to `localStorage` under `pipeline_workspaces`. The active workspace's fields are mirrored to the Zustand store's top-level for backward compatibility.

### Workspace Actions

```js
createWorkspace(name?)   // creates new empty workspace, switches to it
switchWorkspace(id)      // activates workspace, syncs store top-level
renameWorkspace(id, name)
deleteWorkspace(id)      // min 1 workspace always remains
```

---

## AI Pipeline Assistant

**File:** `AIPipelineAssistant__1_.js`

A sidebar panel that interprets natural language instructions and builds/modifies pipelines using the local Ollama LLM.

### Action Executor

Processes a JSON action list returned by the LLM:

```js
// Supported actions:
{ action: 'addNode',    nodeType, x, y, data }
{ action: 'addEdge',    source, sourceHandle, target, targetHandle }
{ action: 'updateNode', nodeId, data }
{ action: 'clearCanvas' }
{ action: 'layout' }
```

### Handle Map (for AI edge generation)

```js
FIRST_OUTPUT_HANDLE = {
  customInput: 'value',    llm: 'response',  text: 'output',
  filter: 'match',         merge: 'merged',  api: 'response',
  transform: 'output',     condition: 'true', timer: 'output',
  customOutput: null,      note: null,
}

FIRST_INPUT_HANDLE = {
  customInput: null,      llm: 'prompt',    customOutput: 'value',
  text: 'context',        filter: 'data',   merge: 'input-0',
  api: 'body',            transform: 'input', condition: 'input',
  timer: 'trigger',       note: null,
}
```

### Timing

Nodes are added at 80ms intervals, edges at 900ms (after nodes are mounted and handles registered), layout fires at 1400ms.

### Ollama Integration

**File:** `OllamaClient.js`  
Streams responses from `http://localhost:11434`. The model used is configurable in the assistant component. Falls back gracefully if Ollama is not running.

---

## Panels & Modals

### NodeInspector (`NodeInspector.js`)
Slide-in right panel. Opens when a node is selected. Shows:
- Node position (x, y)
- All editable `data` fields (inputs, selects, textareas)
- Incoming/outgoing connection list
- Delete button

### VersionPanel (`VersionPanel.js`)
Named pipeline snapshots. Each version stores full nodes + edges. Supports restore and diff.

### VersionDiff (`VersionDiff.js`)
Side-by-side diff of two saved versions showing added/removed/changed nodes and edges.

### BookmarkPanel (`BookmarkPanel.js`)
Saved canvas states with names. Instant restore.

### PreflightPanel (`PreflightPanel.js`)
Pre-run checklist showing:
- Lint errors and warnings (`item.msg` field)
- Graph analytics summary (node count, edge count, estimated execution time)
- Warnings for dead nodes and bottlenecks
- "Run" button that closes preflight and opens execution preview

### ExecutionPreview (`ExecutionPreview.js`)
Simulates pipeline execution step-by-step, highlighting nodes in topological order.

### PipelineExplainer (`PipelineExplainer.js`)
AI-powered panel that explains what a pipeline does or diagnoses execution failures. Auto-opens on backend error.

### PipelineShare (`PipelineShare.js`)
Encodes the current pipeline as a base64 URL parameter. Anyone with the link can load the pipeline by visiting the URL.

### NodeGenealogy (`NodeGenealogy.js`)
Shows a node's full ancestry (all upstream nodes) and descendants (all downstream nodes). Opens on double-click.

### ComponentLibrary (`ComponentLibrary.js`)
Saved reusable node groups. Select 1+ nodes → right-click → "Save as Component". Components can be dragged onto the canvas like regular nodes.

### PatternSuggestion (`PatternSuggestion.js`)
Detects common pipeline patterns (e.g. filter → transform → output) and suggests completions.

### SmartRecommend (`SmartRecommend.js`)
Shows recommended next nodes based on the current node type and graph structure.

### NodeComment (`NodeComment.js`)
Comment bubbles attached to nodes. Rendered **inside BaseNode** using `position: absolute; left: calc(100% + 14px)` so they follow the node during pan/zoom without any coordinate conversion.

---

## Theme System

**File:** `nodes/theme.css`

All colors are CSS custom properties set on `:root` (dark, default) and `[data-theme="light"]`.

### Variables

```css
/* Surfaces */
--bg-app, --bg-toolbar, --bg-panel, --bg-modal, --bg-card, --bg-input, --bg-node, --bg-node-body, --bg-hover

/* Borders */
--border, --border-subtle

/* Text */
--text-primary, --text-secondary, --text-dim, --text-hint

/* Node internals */
--node-border, --node-text, --node-input-bg

/* Handles */
--handle-border

/* Shadows */
--shadow-node, --shadow-panel, --shadow-sm
```

Theme is toggled via `store.toggleTheme()`, persisted to `localStorage`, and applied as `data-theme` on the root `<div>` in `App.js`.

### CanvasMood (`CanvasMood.js`)

Dynamically overrides `--bg-app` and the ReactFlow canvas background gradient based on pipeline health score. Has separate dark/light palettes for 6 mood states: `excellent`, `good`, `fair`, `poor`, `critical`, `empty`.

---

## Persistence

**File:** `persist.js`

| Key | Content |
|---|---|
| `pipeline_workspaces` | All workspaces (nodes, edges, history, etc.) |
| `pipeline_theme` | `'dark'` or `'light'` |

`savePipeline` / `loadPipeline` are legacy helpers kept for backward compatibility with single-workspace saves. New code uses `saveWorkspaces` / `initWorkspaces`.

### URL Sharing

`PipelineShare.js` uses `btoa(JSON.stringify(pipeline))` to encode and `atob` to decode pipeline state from the `?pipeline=` URL query parameter.

---

## Backend API

**File:** `main.py`  
**Base URL:** `http://localhost:8000`

### `GET /`
Health check. Returns `{ "Ping": "Pong" }`.

### `POST /pipelines/parse`

Validates a pipeline and returns graph metadata.

**Request body:**
```json
{
  "nodes": [ { "id": "...", "type": "...", ... } ],
  "edges": [ { "source": "...", "target": "...", ... } ]
}
```

**Response:**
```json
{
  "num_nodes": 4,
  "num_edges": 3,
  "is_dag": true
}
```

DAG detection uses DFS with three-color marking (white/grey/black). A cycle is detected when a grey (in-progress) node is encountered during traversal.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + Z` | Undo |
| `Ctrl/⌘ + Y` | Redo |
| `Ctrl/⌘ + Shift + Z` | Redo |
| `Ctrl/⌘ + A` | Select all nodes |
| `Ctrl/⌘ + D` | Duplicate selected nodes |
| `Ctrl/⌘ + K` | Node spotlight search |
| `Ctrl/⌘ + L` | Auto-layout pipeline |
| `Ctrl/⌘ + Shift + F` | Fit view |
| `Ctrl/⌘ + Enter` | Submit pipeline |
| `Ctrl/⌘ + E` | Export pipeline JSON |
| `Ctrl/⌘ + S` | Save named version |
| `Ctrl/⌘ + I` | Toggle AI assistant |
| `Ctrl/⌘ + T` | New workspace tab |
| `Shift + drag` | Multi-select nodes |
| `Del / Backspace` | Delete selected |
| `Escape` | Deselect / close modal |
| `?` | Toggle shortcuts panel |
| Double-click edge | Delete edge |
| Double-click node | Open node genealogy |
| Right-click node | Context menu |
| Right-click edge | Edge context menu |

---

## Known Patterns & Gotchas

### 1. Handle IDs must include nodeId prefix
The single most common source of bugs. Always use `${nodeId}-${handleName}`. If edges appear disconnected despite being in state, check `BaseNode.js` handle `id` props first.

### 2. TextNode handles are dynamic
`TextNode` generates input handles from `{{variables}}` in its text. If the text changes, handles appear/disappear. Existing edges to deleted handles become dangling — ReactFlow renders them disconnected. There is no automatic cleanup.

### 3. lintPipeline returns `msg` not `message`
The lint result shape is `{ id, level, msg, nodeId, action? }`. Components must use `item.msg`, not `item.message`.

### 4. graphAnalytics returns `deadNodes` as Array, `articulationPoints` as Set
- `deadNodes`: `Node[]` — use `.length`, `.some()`, `.filter()`
- `articulationPoints`: `Set<string>` — use `.size`, `.has()`

### 5. Comments render inside BaseNode
Comments are `position: absolute` children of the node DOM element — they don't need any canvas coordinate conversion. Do not render them as overlays on the wrapper div.

### 6. loadTemplate must reset cycleEdgeIds
Always pass `cycleEdgeIds` to both `set()` and `_flushToActive()` when loading a template, otherwise stale cycle state from the previous pipeline persists.

### 7. Orphaned duplicate code pattern
Several files in the history had a complete working component followed by an orphaned duplicate fragment outside any function body (caused by incomplete edits). If a component behaves unexpectedly, check for a second `};` at the file level.

### 8. Theme: --node-border, --node-text, --node-input-bg must be defined
These variables are used across node files but are not native ReactFlow or browser variables. They must be defined in `theme.css` for both `:root` and `[data-theme="light"]` or node interiors will appear unstyled.

### 9. AI assistant edge timing
The AI assistant adds edges with a 900ms delay after adding nodes. This is intentional — React needs to mount the node components and register their handles with ReactFlow before edges can attach. Do not reduce this delay.