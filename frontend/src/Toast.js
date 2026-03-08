// Toast.js
// Shows a brief 2s bottom-center flash, then silently routes to
// the notification drawer. No stacking, no clutter.

import { useState, useEffect, useRef } from 'react';
import { notify }                      from './NotificationStore';

export { notify as toast };

const TYPE_STYLES = {
  success: { bg: '#10b98115', border: '#10b98144', icon: '✅', color: '#34d399' },
  error:   { bg: '#f43f5e15', border: '#f43f5e44', icon: '❌', color: '#f87171' },
  warning: { bg: '#f59e0b15', border: '#f59e0b44', icon: '⚠️', color: '#fbbf24' },
  info:    { bg: '#3b82f615', border: '#3b82f644', icon: 'ℹ️', color: '#60a5fa' },
  system:  { bg: '#64748b15', border: '#64748b44', icon: '⚙️', color: '#94a3b8' },
};

const ProgressBar = ({ color, id }) => {
  const [width, setWidth] = useState(100);
  useEffect(() => {
    setWidth(100);
    const t = requestAnimationFrame(() => setWidth(0));
    return () => cancelAnimationFrame(t);
  }, [id]);
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', borderRadius: '0 0 8px 8px', background: color, opacity: 0.5, width: `${width}%`, transition: width === 0 ? 'width 2s linear' : 'none' }} />
  );
};

export const ToastContainer = () => {
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef(null);
  const removeTimer  = useRef(null);

  useEffect(() => {
    const show = (notifications) => {
      if (!notifications.length) return;
      const latest = notifications[0];

      // Only show success and info as popups — warnings/errors go to drawer only
      if (latest.type === 'system' || latest.type === 'warning' || latest.type === 'error') return;

      clearTimeout(dismissTimer.current);
      clearTimeout(removeTimer.current);

      setCurrent(latest);
      setVisible(false);
      requestAnimationFrame(() => setVisible(true));

      // Dismiss after 2s
      dismissTimer.current = setTimeout(() => setVisible(false), 2000);
      // Remove from DOM after fade
      removeTimer.current  = setTimeout(() => setCurrent(null), 2300);
    };

    notify.subscribe(show);
    return () => {
      notify.unsubscribe(show);
      clearTimeout(dismissTimer.current);
      clearTimeout(removeTimer.current);
    };
  }, []);

  if (!current) return null;
  const s = TYPE_STYLES[current.type] ?? TYPE_STYLES.info;

  return (
    <div
      onClick={() => setVisible(false)}
      style={{
        position:       'fixed',
        bottom:         '72px',
        left:           '50%',
        transform:      `translateX(-50%) translateY(${visible ? '0px' : '10px'})`,
        opacity:        visible ? 1 : 0,
        transition:     'opacity 0.2s ease, transform 0.2s ease',
        zIndex:         99999,
        display:        'flex',
        alignItems:     'center',
        gap:            '8px',
        padding:        '8px 14px',
        background:     s.bg,
        border:         `1px solid ${s.border}`,
        borderRadius:   '8px',
        backdropFilter: 'blur(12px)',
        boxShadow:      '0 4px 20px #0009',
        fontFamily:     "'DM Sans',sans-serif",
        fontSize:       '12px',
        color:          'var(--text-primary)',
        cursor:         'pointer',
        pointerEvents:  visible ? 'all' : 'none',
        whiteSpace:     'nowrap',
        maxWidth:       '380px',
      }}
    >
      <span style={{ fontSize: '13px' }}>{s.icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{current.message}</span>
      {/* Progress bar — starts full, drains to 0 over 2s */}
      <ProgressBar color={s.color} id={current.id} />
    </div>
  );
};