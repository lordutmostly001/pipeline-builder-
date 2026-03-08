import { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider }    from 'reactflow';
import { PipelineToolbar }      from './toolbar';
import { PipelineUI }           from './ui';
import { SubmitButton }         from './submit';
import { ShortcutsModal }       from './ShortcutsModal';
import { TemplatesModal }       from './TemplatesModal';
import { ExecutionPreview }     from './ExecutionPreview';
import { NodeSearch }           from './NodeSearch';
import { VersionPanel }         from './VersionPanel';
import { VersionDiff }          from './VersionDiff';
import { BookmarkPanel }        from './BookmarkPanel';
import { AIPipelineAssistant }  from './AIPipelineAssistant';
import { ExplainerPanel, usePipelineExplainer } from './PipelineExplainer';
import { SharePanel, usePipelineShare }          from './PipelineShare';
import { NodeGenealogy }        from './NodeGenealogy';
import { useStore }             from './store';
import { ToastContainer }       from './Toast';
import { NodeInspector }        from './NodeInspector';
import { notify }               from './NotificationStore';
import { loadPipeline }         from './persist';
// New features
import { CanvasMood }           from './CanvasMood';
import { PreflightPanel }       from './PreflightPanel';
import { WorkspaceTabs }        from './WorkspaceTabs';
import { ComponentLibrary, useComponents } from './ComponentLibrary';
import { SaveComponentModal }   from './SaveComponentModal';
import { detectPorts }          from './componentStore';

function App() {
  const theme        = useStore((s) => s.theme);
  const cycleEdgeIds = useStore((s) => s.cycleEdgeIds);
  const undo         = useStore((s) => s.undo);
  const redo         = useStore((s) => s.redo);
  const autoLayout   = useStore((s) => s.autoLayout);
  const saveVersion  = useStore((s) => s.saveVersion);
  const duplicateSelected = useStore((s) => s.duplicateSelected);
  const nodes        = useStore((s) => s.nodes);
  const edges        = useStore((s) => s.edges);

  const [animating,        setAnimating]        = useState(false);
  const [showHelp,         setShowHelp]         = useState(false);
  const [showTemplates,    setShowTemplates]     = useState(false);
  const [showExecPreview,  setShowExecPreview]   = useState(false);
  const [showNodeSearch,   setShowNodeSearch]    = useState(false);
  const [showVersions,     setShowVersions]      = useState(false);
  const [showBookmarks,    setShowBookmarks]     = useState(false);
  const [showDiff,         setShowDiff]          = useState(false);
  const [showAI,           setShowAI]            = useState(false);
  const [showShare,        setShowShare]         = useState(false);
  const [genealogyNodeId,  setGenealogyNodeId]   = useState(null);
  const [submitTrigger,    setSubmitTrigger]     = useState(0);
  const animTimerRef = useRef(null);

  // New feature states
  const [showPreflight,    setShowPreflight]     = useState(false);
  const [showComponents,   setShowComponents]    = useState(false);
  const [saveCompNodeIds,  setSaveCompNodeIds]   = useState(null); // array of nodeIds to save

  const { components, addComponent, deleteComponent, renameComponent } = useComponents();

  const { result: explainerResult, loading: explainerLoading, explain, explainError, clear: clearExplainer } = usePipelineExplainer();
  const [showExplainer, setShowExplainer] = useState(false);

  const { loadFromURL } = usePipelineShare();

  // Load from URL on mount (shared pipeline links)
  useEffect(() => {
    const loaded = loadFromURL();
    if (!loaded) {
      const saved = loadPipeline();
      if (saved?.nodes?.length) notify.system(`Restored last pipeline — ${saved.nodes.length} nodes loaded`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmitResult = useCallback((result) => {
    clearTimeout(animTimerRef.current);
    if (result?.success === false) {
      // Auto-open explainer and trigger failure analysis
      setShowExplainer(true);
      explainError(result.error ?? 'Unknown error', result.failed_node_id ?? null);
    } else {
      setAnimating(true);
      animTimerRef.current = setTimeout(() => setAnimating(false), 2500);
    }
  }, [explainError]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;
      if (typing) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowNodeSearch((v) => !v); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); autoLayout(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSelected(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveVersion(''); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); setShowAI((v) => !v); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); useStore.getState().createWorkspace(); return; }

      if (e.key === 'Escape') {
        setShowNodeSearch(false); setShowExecPreview(false);
        setShowHelp(false); setShowTemplates(false);
        setShowVersions(false); setShowBookmarks(false);
        setShowAI(false); setShowShare(false); setShowExplainer(false); setShowDiff(false);
        setGenealogyNodeId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, autoLayout, duplicateSelected, saveVersion]);

  const onToggleHelp      = useCallback(() => setShowHelp((v) => !v), []);
  const onCloseModal      = useCallback(() => { setShowHelp(false); setShowTemplates(false); setShowNodeSearch(false); setShowExecPreview(false); }, []);
  const onToggleTemplates = useCallback(() => setShowTemplates((v) => !v), []);
  const onSubmit          = useCallback(() => setSubmitTrigger((n) => n + 1), []);

  return (
    <div data-theme={theme} style={{ colorScheme: theme }}>
      <ToastContainer />
      <CanvasMood />
      <ReactFlowProvider>
        <>
          {showHelp        && <ShortcutsModal   key="help"      onClose={onCloseModal} />}
          {showTemplates   && <TemplatesModal    key="tmpl"      onClose={onCloseModal} />}
          {showExecPreview && <ExecutionPreview  key="exec"      onClose={() => setShowExecPreview(false)} />}
          {showNodeSearch  && <NodeSearch        key="search"    onClose={() => setShowNodeSearch(false)} />}
          {showVersions    && <VersionPanel      key="versions"  onClose={() => setShowVersions(false)} onDiff={() => { setShowVersions(false); setShowDiff(true); }} />}
          {showDiff        && <VersionDiff       key="diff"      onClose={() => setShowDiff(false)} />}
          {showBookmarks   && <BookmarkPanel     key="bookmarks" onClose={() => setShowBookmarks(false)} />}
          {showShare       && <SharePanel        key="share"     onClose={() => setShowShare(false)} />}
          {showAI          && <AIPipelineAssistant key="ai"      onClose={() => setShowAI(false)} />}
          {showPreflight   && (
            <PreflightPanel
              key="preflight"
              onClose={() => setShowPreflight(false)}
              onRun={() => { setShowPreflight(false); setShowExecPreview(true); }}
            />
          )}
          {showComponents  && (
            <ComponentLibrary
              key="components"
              onClose={() => setShowComponents(false)}
              components={components}
              onDelete={deleteComponent}
              onRename={renameComponent}
            />
          )}
          {saveCompNodeIds && (
            <SaveComponentModal
              nodeIds={saveCompNodeIds}
              onSave={(name, desc) => {
                const selNodes = nodes.filter((n) => saveCompNodeIds.includes(n.id));
                const selEdges = edges.filter((e) => saveCompNodeIds.includes(e.source) && saveCompNodeIds.includes(e.target));
                const ports    = detectPorts(saveCompNodeIds, nodes, edges);
                const nodeTypes = [...new Set(selNodes.map((n) => n.type))];
                addComponent({ name, description: desc, nodes: selNodes, edges: selEdges, ports, nodeTypes });
                setSaveCompNodeIds(null);
                notify.success(`Component "${name}" saved to library`);
              }}
              onCancel={() => setSaveCompNodeIds(null)}
            />
          )}
          {showExplainer   && (
            <ExplainerPanel
              key="explainer"
              result={explainerResult}
              loading={explainerLoading}
              onExplain={explain}
              onClose={() => { setShowExplainer(false); clearExplainer(); useStore.getState().clearNodeStatuses(); }}
            />
          )}
          {genealogyNodeId && (
            <NodeGenealogy
              key="genealogy"
              nodeId={genealogyNodeId}
              onClose={() => setGenealogyNodeId(null)}
            />
          )}
        </>

        <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg-app)' }}>
          <PipelineToolbar
            onToggleHelp={onToggleHelp}
            onToggleTemplates={onToggleTemplates}
            onExecPreview={() => setShowExecPreview(true)}
            onPreflight={() => setShowPreflight((v) => !v)}
            onNodeSearch={() => setShowNodeSearch(true)}
            onToggleVersions={() => { setShowVersions((v) => !v); setShowBookmarks(false); setShowShare(false); }}
            onToggleBookmarks={() => { setShowBookmarks((v) => !v); setShowVersions(false); setShowShare(false); }}
            onToggleAI={() => setShowAI((v) => !v)}
            onToggleShare={() => { setShowShare((v) => !v); setShowVersions(false); setShowBookmarks(false); }}
            onToggleExplainer={() => setShowExplainer((v) => !v)}
            onToggleComponents={() => setShowComponents((v) => !v)}
            showAI={showAI}
          />
          <WorkspaceTabs />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <PipelineUI
              onSubmit={onSubmit}
              onToggleHelp={onToggleHelp}
              onCloseModal={onCloseModal}
              animating={animating}
              cycleEdgeIds={cycleEdgeIds}
              onNodeGenealogyOpen={(id) => setGenealogyNodeId(id)}
              onSaveComponent={(nodeIds) => setSaveCompNodeIds(nodeIds)}
            />
          </div>
          <SubmitButton externalTrigger={submitTrigger} onResult={onSubmitResult} />
        </div>
        <NodeInspector />
      </ReactFlowProvider>
    </div>
  );
}

export default App;