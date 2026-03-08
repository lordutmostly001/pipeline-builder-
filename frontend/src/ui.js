// ui.js — ReactFlow canvas with enhanced edge interactions

import { useState, useRef, useCallback, useMemo } from 'react';
import ReactFlow, {
  Controls, Background, MiniMap,
  MarkerType,
} from 'reactflow';
import { useStore }             from './store';
import { NODE_COLORS }          from './store';
import { shallow }              from 'zustand/shallow';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { StatsPanel }           from './StatsPanel';
import { SpotlightModal }       from './SpotlightModal';
import { ValidationPanel }      from './ValidationPanel';
import { analyzeGraph }          from './graphAnalytics';
import { NodeCommentBubble, AddCommentBtn } from './NodeComment';
import { MismatchWarning, useMismatchWarning } from './TypeInferenceEngine';
import { PipelineLinter }        from './PipelineLinter';
import { ContextMenu }          from './ContextMenu';
import { EdgeContextMenu }      from './EdgeContextMenu';
import { buildEdgeStyle }               from './edgeUtils';

import { InputNode }     from './nodes/inputNode';
import { LLMNode }       from './nodes/llmNode';
import { OutputNode }    from './nodes/outputNode';
import { TextNode }      from './nodes/textNode';
import { FilterNode }    from './nodes/filterNode';
import { MergeNode }     from './nodes/mergeNode';
import { APINode }       from './nodes/apiNode';
import { TransformNode } from './nodes/transformNode';
import { NoteNode }      from './nodes/noteNode';
import { ConditionNode } from './nodes/conditionNode';
import { TimerNode }     from './nodes/timerNode';
import { ComponentNode } from './nodes/componentNode';

import 'reactflow/dist/style.css';

const gridSize   = 20;
const proOptions = { hideAttribution: true };

const NODE_TYPE_MAP = {
  customInput: InputNode, llm: LLMNode, customOutput: OutputNode,
  text: TextNode, filter: FilterNode, merge: MergeNode,
  api: APINode, transform: TransformNode, note: NoteNode,
  condition: ConditionNode, timer: TimerNode,
  component: ComponentNode,
};

const isValidConnection = (connection) => connection.source !== connection.target;

const selector = (s) => ({
  nodes: s.nodes, edges: s.edges,
  getNodeID: s.getNodeID, addNode: s.addNode,
  onNodesChange: s.onNodesChange,
  onEdgesChange: s.onEdgesChange,
  onConnect: s.onConnect,
});

// ── Empty state ───────────────────────────────────────────────────
const EmptyState = () => (
  <div style={{
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', userSelect: 'none', gap: '12px',
  }}>
    <div style={{ fontSize: '48px', opacity: 0.18 }}>⚡</div>
    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-hint)' }}>Your canvas is empty</div>
    <div style={{ fontSize: '12px', color: 'var(--border)', maxWidth: '260px', textAlign: 'center', lineHeight: 1.6 }}>
      Drag a node from the toolbar, press{' '}
      <strong style={{ color: 'var(--text-hint)' }}>Ctrl+K</strong> to search,
      or load a <strong style={{ color: 'var(--text-hint)' }}>template</strong>.
    </div>
  </div>
);

// ── Flow animation — injected as a style tag in render ───────────
const EdgeFlowStyle = () => (
  <style>{`
    @keyframes edgeFlow {
      to { stroke-dashoffset: -20; }
    }
    @keyframes neonPulse {
      0%, 100% { opacity: 1;    filter: drop-shadow(0 0 3px currentColor) drop-shadow(0 0 6px currentColor); }
      50%       { opacity: 0.7; filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor); }
    }
    /* ALL edges are dashed and flowing always */
    .react-flow__edge path.react-flow__edge-path {
      stroke-dasharray: 6 4 !important;
      animation: edgeFlow 2s linear infinite !important;
      filter: drop-shadow(0 0 2px currentColor);
      transition: stroke 0.2s ease, stroke-width 0.2s ease;
    }
    /* Cycle edges — red pulse */
    .edge-cycle path.react-flow__edge-path {
      stroke: #f43f5e !important;
      stroke-width: 3 !important;
      stroke-dasharray: 6 4 !important;
      animation: edgeFlow 0.6s linear infinite, cyclePulse 1.2s ease-in-out infinite !important;
    }
    @keyframes cyclePulse {
      0%, 100% { filter: drop-shadow(0 0 3px #f43f5e) drop-shadow(0 0 6px #f43f5e88); }
      50%       { filter: drop-shadow(0 0 8px #f43f5e) drop-shadow(0 0 16px #f43f5e66); }
    }
    /* Hover glow */
    .react-flow__edge:hover path.react-flow__edge-path {
      filter: drop-shadow(0 0 6px #60a5fa) drop-shadow(0 0 12px #3b82f655) !important;
    }
    /* Neon pulse on arrowheads */
    .react-flow__edge .react-flow__arrowhead path {
      animation: neonPulse 2.5s ease-in-out infinite;
    }
  `}</style>
);

// ── Inner — inside ReactFlow tree ─────────────────────────────────
const FlowInner = ({ onSubmit, onToggleHelp, onCloseModal, onToggleSpotlight }) => {
  useKeyboardShortcuts({ onSubmit, onToggleHelp, onCloseModal, onToggleSpotlight });
  return null;
};

// ── Main canvas ───────────────────────────────────────────────────
export const PipelineUI = ({ onSubmit, onToggleHelp, onCloseModal, animating = false, cycleEdgeIds = null, onNodeGenealogyOpen, onSaveComponent }) => {
  const reactFlowWrapper              = useRef(null);
  const [reactFlowInstance, setInst]  = useState(null);
  const [viewport,          setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [showSpotlight, setSpotlight] = useState(false);
  const [contextMenu,     setContextMenu]     = useState(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState(null);
  const [hoveredNodeId,   setHoveredNode]     = useState(null);
  const [commentNodeId,   setCommentNodeId]   = useState(null);
  const [mismatchWarn,    setMismatchWarn]    = useState(null);
  const { checkConnection } = useMismatchWarning();

  const {
    nodes, edges, getNodeID, addNode,
    onNodesChange, onEdgesChange,
  } = useStore(selector, shallow);

  const storeOnConnect = useStore((s) => s.onConnect);
  const comments       = useStore((s) => s.comments);

  const nodeTypes = useMemo(() => NODE_TYPE_MAP, []);

  const onToggleSpotlight = useCallback(() => setSpotlight((v) => !v), []);
  const onCloseAll = useCallback(() => {
    onCloseModal();
    setSpotlight(false);
    setContextMenu(null);
  }, [onCloseModal]);

  // Convert ReactFlow canvas coordinates → screen pixel coordinates for comment overlays
  const canvasToScreen = useCallback((canvasPos) => ({
    x: canvasPos.x * viewport.zoom + viewport.x,
    y: canvasPos.y * viewport.zoom + viewport.y,
  }), [viewport]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    if (!reactFlowInstance) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const raw = event?.dataTransfer?.getData('application/reactflow');
    if (!raw) return;
    const { nodeType: type } = JSON.parse(raw);
    if (!type) return;
    const position = reactFlowInstance.project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    const nodeID = getNodeID(type);
    addNode({ id: nodeID, type, position, data: { id: nodeID, nodeType: type } });
  }, [reactFlowInstance, addNode, getNodeID]);

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);

  const onPaneClick = useCallback(() => { setContextMenu(null); setEdgeContextMenu(null); }, []);

  // ── Cycle edges come from the store (updated on every connect/disconnect)
  const storeCycleIds  = useStore((s) => s.cycleEdgeIds);
  const activeCycleIds = useMemo(
    () => (cycleEdgeIds?.size ? cycleEdgeIds : storeCycleIds) ?? new Set(),
    [cycleEdgeIds, storeCycleIds]
  );

  // ── Graph analytics (critical path, dead nodes, bottlenecks) ──
  const analytics = useMemo(() => analyzeGraph(nodes, edges), [nodes, edges]);

  // ── Build styled edges ─────────────────────────────────────────
  const styledEdges = useMemo(() => edges.map((edge) => {
    const critPathSize   = analytics?.criticalPath?.nodeIds?.size ?? 0;
    const showCritical   = critPathSize > 0 && critPathSize < (analytics?.nodeCount ?? 0);
    const isCritical = showCritical && analytics?.criticalPath?.edgeIds?.has(edge.id) && !activeCycleIds?.has(edge.id);
    const style      = isCritical
      ? { stroke: '#fbbf24', strokeWidth: 2.5, strokeDasharray: '6 4' }
      : buildEdgeStyle({ edge, hoveredNodeId, animating, cycleEdgeIds: activeCycleIds });
    const isCycle   = activeCycleIds?.has(edge.id);
    const isHovered = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
    const isAnim    = animating && !isCycle;

    return {
      ...edge,
      style,
      animated: false,
      zIndex: 0,
      className: isCycle ? 'edge-cycle' : isCritical ? 'edge-critical' : isAnim ? 'edge-animated' : '',
      markerEnd: {
        type:   MarkerType.ArrowClosed,
        color:  style.stroke,
        width:  isHovered ? 20 : 16,
        height: isHovered ? 20 : 16,
      },
    };
  }), [edges, hoveredNodeId, animating, activeCycleIds, analytics]);

  // ── Wrap nodes to inject hover handlers ───────────────────────
  // We pass onMouseEnter/Leave via nodeTypes wrapper approach —
  // actually we handle it via onNodeMouseEnter/Leave ReactFlow events
  const onNodeDoubleClick = useCallback((_, node) => {
    onNodeGenealogyOpen?.(node.id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onConnectWithCheck = useCallback((connection) => {
    const srcNode = nodes.find((n) => n.id === connection.source);
    const tgtNode = nodes.find((n) => n.id === connection.target);
    if (srcNode && tgtNode) {
      checkConnection({
        sourceType: srcNode.type, sourceHandle: connection.sourceHandle,
        targetType:  tgtNode.type, targetHandle:  connection.targetHandle,
        onWarning: (w) => { setMismatchWarn(w); setTimeout(() => setMismatchWarn(null), 8000); },
      });
    }
    storeOnConnect(connection);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeMouseEnter  = useCallback((_, node) => setHoveredNode(node.id), []);
  const onNodeMouseLeave  = useCallback(()         => setHoveredNode(null),   []);
  const onNodeDragStart   = useCallback(()         => setHoveredNode(null),   []);

  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    setEdgeContextMenu({ edgeId: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  const onEdgeClick = useCallback((_, edge) => {
    setEdgeContextMenu(null);
    setContextMenu(null);
  }, []);

  const onEdgeDoubleClick = useCallback((_, edge) => {
    onEdgesChange([{ type: 'remove', id: edge.id }]);
  }, [onEdgesChange]);

  return (
    <div ref={reactFlowWrapper} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0 }}>
      <EdgeFlowStyle />
      {nodes.length === 0 && <EmptyState />}
      {showSpotlight && <SpotlightModal onClose={() => setSpotlight(false)} />}
      {contextMenu && (
        <ContextMenu nodeId={contextMenu.nodeId} x={contextMenu.x} y={contextMenu.y}
          onClose={() => setContextMenu(null)} onSaveComponent={onSaveComponent} />
      )}
      {edgeContextMenu && (
        <EdgeContextMenu edgeId={edgeContextMenu.edgeId} x={edgeContextMenu.x} y={edgeContextMenu.y}
          onClose={() => setEdgeContextMenu(null)} />
      )}
      <ValidationPanel />
      <MismatchWarning warning={mismatchWarn} onDismiss={() => setMismatchWarn(null)} />

      {/* Node comments — rendered as absolute overlays using viewport-aware coordinates */}
      {Object.keys(comments ?? {}).map((nodeId) => {
        const n = nodes.find((nd) => nd.id === nodeId);
        if (!n) return null;
        const screenPos = canvasToScreen(n.position);
        return <NodeCommentBubble key={nodeId} nodeId={nodeId} position={screenPos} zoom={viewport.zoom} />;
      })}

      {/* Add-comment button on selected node */}
      {nodes.filter((n) => n.selected && !comments?.[n.id]).map((n) => {
        const screenPos = canvasToScreen(n.position);
        return (
          <AddCommentBtn key={n.id} nodeId={n.id} position={screenPos} zoom={viewport.zoom} onAdd={() => setCommentNodeId(n.id)} />
        );
      })}
      {commentNodeId && (() => {
        const n = nodes.find((nd) => nd.id === commentNodeId);
        if (!n) return null;
        const screenPos = canvasToScreen(n.position);
        return <NodeCommentBubble nodeId={commentNodeId} position={screenPos} zoom={viewport.zoom} onDelete={() => setCommentNodeId(null)} />;
      })()}

      <PipelineLinter analytics={analytics} />
      <StatsPanel />

      {/* ── Live cycle warning banner ── */}
      {activeCycleIds.size > 0 && (
        <div style={{
          position:    'absolute', top: 12, left: '50%',
          transform:   'translateX(-50%)',
          zIndex:      100,
          background:  '#f43f5e18',
          border:      '1px solid #f43f5e88',
          borderRadius: '10px',
          padding:     '7px 16px',
          display:     'flex', alignItems: 'center', gap: '8px',
          fontFamily:  "'DM Sans',sans-serif",
          fontSize:    '12px', fontWeight: 600,
          color:       '#f87171',
          backdropFilter: 'blur(10px)',
          boxShadow:   '0 0 20px #f43f5e22',
          pointerEvents: 'none',
          animation:   'fadeIn 0.2s ease',
          whiteSpace:  'nowrap',
        }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          Cycle detected — pipeline is not a valid DAG.
          <span style={{ opacity: 0.6, fontSize: 11, fontWeight: 400 }}>
            ({activeCycleIds.size} edge{activeCycleIds.size !== 1 ? 's' : ''} highlighted)
          </span>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnectWithCheck}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => { setInst(instance); setViewport(instance.getViewport()); }}
        onMove={(_, vp) => setViewport(vp)}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeDragStart={onNodeDragStart}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        snapGrid={[gridSize, gridSize]}
        elevateEdgesOnSelect={false}
        elevateNodesOnSelect={true}
        connectionLineType="bezier"
        defaultEdgeOptions={{ type: 'default' }}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode="Shift"
        isValidConnection={isValidConnection}
        style={{ background: 'var(--bg-app)' }}
      >
        <FlowInner
          onSubmit={onSubmit}
          onToggleHelp={onToggleHelp}
          onCloseModal={onCloseAll}
          onToggleSpotlight={onToggleSpotlight}
        />
        <Background color={'var(--border)'} gap={gridSize} size={1.2} />
        <Controls
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
          aria-label="Canvas controls"
        />
        <MiniMap
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
          nodeColor={(n) => {
            if (!analytics?.distTime) return NODE_COLORS[n.type] ?? '#4a5878';
            const maxT = Math.max(1, ...Object.values(analytics.distTime));
            const t    = (analytics.distTime[n.id] ?? 0) / maxT;
            // blue (source) → purple → red (deep)
            const r = Math.round(59  + t * (239 - 59));
            const g = Math.round(130 + t * (68  - 130));
            const b = Math.round(246 + t * (68  - 246));
            return `rgb(${r},${g},${b})`;
          }}
          maskColor="rgba(8,15,30,0.75)"
          aria-label="Pipeline minimap"
          zoomable
          pannable
          nodeStrokeWidth={3}
          nodeStrokeColor={(n) => NODE_COLORS[n.type] ?? '#4a5878'}
        />
      </ReactFlow>
    </div>
  );
};