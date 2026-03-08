// CanvasMood.js — Atmospheric background that reacts to pipeline health
// Injects a CSS custom property --mood-bg onto the root element.
// The canvas background smoothly transitions based on health score.

import { useEffect, useMemo } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';
import { analyzeGraph, lintPipeline, computeHealthScore } from './graphAnalytics';

const selector = (s) => ({ nodes: s.nodes, edges: s.edges, theme: s.theme });

// Mood palettes — dark and light variants
const MOODS = {
  dark: {
    excellent: { bg: '#080f1e', glow: '30,55,120',  label: 'healthy' },   // calm deep blue
    good:      { bg: '#090e1c', glow: '40,60,130',  label: 'good'    },
    fair:      { bg: '#0c0f18', glow: '80,60,20',   label: 'warning' },   // warm amber tint
    poor:      { bg: '#0e0c14', glow: '100,50,10',  label: 'poor'    },   // orange tint
    critical:  { bg: '#120a0e', glow: '120,20,30',  label: 'critical'},   // deep red
    empty:     { bg: '#080f1e', glow: '20,30,60',   label: 'empty'   },
  },
  light: {
    excellent: { bg: '#eef2f9', glow: '180,210,255', label: 'healthy' },
    good:      { bg: '#edf2f9', glow: '170,200,250', label: 'good'    },
    fair:      { bg: '#f5f0e8', glow: '200,170,80',  label: 'warning' },
    poor:      { bg: '#f5ece8', glow: '210,130,60',  label: 'poor'    },
    critical:  { bg: '#f5e8ea', glow: '220,80,90',   label: 'critical'},
    empty:     { bg: '#eef2f9', glow: '180,200,230',  label: 'empty'  },
  },
};

const getMoodKey = (score, nodeCount) => {
  if (nodeCount === 0) return 'empty';
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'critical';
};

export const CanvasMood = () => {
  const { nodes, edges, theme } = useStore(selector, shallow);

  const health = useMemo(() => {
    if (nodes.length === 0) return null;
    const a = analyzeGraph(nodes, edges);
    const w = lintPipeline(nodes, edges);
    return computeHealthScore(a, w);
  }, [nodes, edges]);

  const moodKey  = getMoodKey(health?.score ?? 100, nodes.length);
  const palette  = MOODS[theme === 'light' ? 'light' : 'dark'];
  const mood     = palette[moodKey];

  useEffect(() => {
    const root = document.documentElement;

    // Set bg-app CSS variable smoothly
    root.style.setProperty('--bg-app', mood.bg);

    // Inject / update the radial glow overlay on the canvas renderer
    const styleId = 'canvas-mood-style';
    let el = document.getElementById(styleId);
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }

    const [r, g, b] = mood.glow.split(',').map(Number);
    const isDark = theme !== 'light';

    el.textContent = `
      .react-flow__renderer {
        background: radial-gradient(
          ellipse at 50% 40%,
          rgba(${r}, ${g}, ${b}, ${isDark ? '0.22' : '0.30'}) 0%,
          rgba(${isDark ? '8,15,30' : '180,200,230'}, ${isDark ? '0.75' : '0.55'}) 70%
        ) !important;
        transition: background 2s ease !important;
      }
    `;

    return () => {
      // On unmount reset to default — don't leave mood styles orphaned
    };
  }, [mood, theme]);

  // This component renders nothing — pure side-effect
  return null;
};