// nodes/noteNode.js
// A non-compute annotation node — no handles, just a sticky note

import { useState } from 'react';

const COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f87171', '#c084fc'];

export const NoteNode = ({ id, data }) => {
  const [text, setText] = useState(data?.text || 'Add a note...');
  const [colorIdx, setColorIdx] = useState(data?.colorIdx || 0);
  const accent = COLORS[colorIdx];

  return (
    <div
      style={{
        minWidth: 180,
        minHeight: 100,
        background: `${accent}18`,
        border: `1.5px solid ${accent}66`,
        borderRadius: '10px',
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        padding: '0',
        position: 'relative',
        boxShadow: `0 2px 12px ${accent}22`,
      }}
    >
      {/* Color picker strip */}
      <div
        style={{
          display: 'flex',
          gap: '5px',
          padding: '6px 10px',
          borderBottom: `1px solid ${accent}33`,
          background: `${accent}14`,
          borderRadius: '9px 9px 0 0',
        }}
      >
        <span style={{ fontSize: '11px', color: accent, fontWeight: 700, marginRight: 4 }}>📌 NOTE</span>
        {COLORS.map((c, i) => (
          <div
            key={c}
            onClick={() => setColorIdx(i)}
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: c,
              cursor: 'pointer',
              border: i === colorIdx ? '2px solid #fff' : '2px solid transparent',
              marginLeft: 'auto',
            }}
          />
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          width: '100%',
          minHeight: '72px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#ddeeff',
          fontSize: '12px',
          padding: '8px 12px',
          resize: 'both',
          fontFamily: 'inherit',
          lineHeight: '1.6',
          boxSizing: 'border-box',
        }}
        placeholder="Write a note..."
      />
    </div>
  );
};
