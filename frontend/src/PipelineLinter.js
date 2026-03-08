// PipelineLinter.js — DOM-only effect: applies lint CSS classes to ReactFlow nodes
// No rendered UI — output is visible via node outlines on canvas.
// The warning list is shown in StatsPanel's Lint tab.

import { useMemo, useEffect } from 'react';
import { useStore }           from './store';
import { shallow }            from 'zustand/shallow';
import { lintPipeline }       from './graphAnalytics';

const STYLE_ID = 'linter-node-styles';

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .lint-error      > div { outline: 2px solid #f43f5e88 !important; outline-offset: 3px; }
    .lint-warning    > div { outline: 2px solid #f59e0b88 !important; outline-offset: 3px; }
    .lint-info       > div { outline: 2px solid #60a5fa44 !important; outline-offset: 3px; }
    .lint-dead       > div { opacity: 0.4; filter: grayscale(60%); }
    .lint-bottleneck > div { outline: 2px solid #f9731688 !important; outline-offset: 3px; box-shadow: 0 0 12px #f9731633 !important; }
    .lint-critical   > div { outline: 2px solid #fbbf24 !important; outline-offset: 4px; box-shadow: 0 0 16px #fbbf2440, 0 0 32px #fbbf2420 !important; }
  `;
  document.head.appendChild(el);
};

const ALL_LINT = ['lint-error','lint-warning','lint-info','lint-dead','lint-bottleneck','lint-critical'];
const selector = (s) => ({ nodes: s.nodes, edges: s.edges });

export const PipelineLinter = ({ analytics }) => {
  const { nodes, edges } = useStore(selector, shallow);
  const warnings = useMemo(() => lintPipeline(nodes, edges), [nodes, edges]);

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    // Clear all
    document.querySelectorAll(ALL_LINT.map((c) => `.${c}`).join(',')).forEach((el) => {
      ALL_LINT.forEach((c) => el.classList.remove(c));
    });

    // Lint warnings → node outlines
    warnings.forEach((w) => {
      if (!w.nodeId) return;
      const el = document.querySelector(`.react-flow__node[data-id="${w.nodeId}"]`);
      if (el) el.classList.add(`lint-${w.level}`);
    });

    // Dead nodes
    analytics?.deadNodes?.forEach((n) => {
      const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`);
      if (el) el.classList.add('lint-dead');
    });

    // Bottlenecks
    analytics?.articulationPoints?.forEach((id) => {
      const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
      if (el) el.classList.add('lint-bottleneck');
    });

    // Critical path — only when it's a proper subset
    const critSize    = analytics?.criticalPath?.nodeIds?.size ?? 0;
    const showCritical = critSize > 0 && critSize < (analytics?.nodeCount ?? 0);
    if (showCritical) {
      analytics.criticalPath.nodeIds.forEach((id) => {
        const el = document.querySelector(`.react-flow__node[data-id="${id}"]`);
        if (el) el.classList.add('lint-critical');
      });
    }
  }, [warnings, analytics]);

  return null; // no rendered UI — StatsPanel lint tab shows the warnings
};