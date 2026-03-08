// NotificationDrawer.js
// Bell + slide-in drawer with TTL awareness, system tab, expiry fading.

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence }     from 'framer-motion';
import { notify }                      from './NotificationStore';

const TYPE_CONFIG = {
  success: { icon: '✅', color: '#10b981', bg: '#10b98112', border: '#10b98133', label: 'Success' },
  error:   { icon: '❌', color: '#f43f5e', bg: '#f43f5e12', border: '#f43f5e33', label: 'Error'   },
  warning: { icon: '⚠️', color: '#f59e0b', bg: '#f59e0b12', border: '#f59e0b33', label: 'Warning' },
  info:    { icon: 'ℹ️', color: '#3b82f6', bg: '#3b82f612', border: '#3b82f633', label: 'Info'    },
  system:  { icon: '⚙️', color: '#64748b', bg: '#64748b10', border: '#64748b2a', label: 'System'  },
};

// Badge only counts warning + error (things needing attention)
const BADGE_TYPES = new Set(['warning', 'error']);

const formatTime = (date) => {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Relative time re-renders every 15s so timestamps stay fresh
const useRelativeTime = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
};

// ── TTL countdown bar ─────────────────────────────────────────────
const ExpiryBar = ({ type, createdAt }) => {
  const [width, setWidth] = useState(100);
  const TTL_MS = type === 'success' ? 60_000 : 30_000;

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - createdAt;
      setWidth(Math.max(0, 100 - (elapsed / TTL_MS) * 100));
    };
    update();
    const t = setInterval(update, 500);
    return () => clearInterval(t);
  }, [createdAt, TTL_MS]);

  const cfg = TYPE_CONFIG[type];
  return (
    <div style={{ height: '2px', background: 'var(--border)', borderRadius: '1px', marginTop: '6px', overflow: 'hidden' }}>
      <div style={{ width: `${width}%`, height: '100%', background: cfg.color, borderRadius: '1px', transition: 'width 0.5s linear', opacity: 0.5 }} />
    </div>
  );
};

// ── Bell button ───────────────────────────────────────────────────
const bellPulseStyle = `
  @keyframes bellRing {
    0%,100% { transform: rotate(0deg);   }
    15%     { transform: rotate(12deg);  }
    30%     { transform: rotate(-10deg); }
    45%     { transform: rotate(8deg);   }
    60%     { transform: rotate(-6deg);  }
    75%     { transform: rotate(4deg);   }
  }
  @keyframes badgePulse {
    0%,100% { box-shadow: 0 0 0 0 #f43f5e88; }
    50%     { box-shadow: 0 0 0 5px #f43f5e00; }
  }
`;

export const NotificationBell = ({ onClick, unreadCount }) => (
  <>
    <style>{bellPulseStyle}</style>
    <button
      onClick={onClick}
      title={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
      style={{
        position: 'relative', background: 'transparent',
        border: `1px solid ${unreadCount > 0 ? '#f43f5e66' : 'var(--border)'}`,
        borderRadius: '7px',
        color: unreadCount > 0 ? '#f43f5e' : 'var(--text-dim)',
        cursor: 'pointer', width: '30px', height: '30px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', transition: 'all 0.2s',
        boxShadow: unreadCount > 0 ? '0 0 8px #f43f5e33' : 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'inline-block', animation: unreadCount > 0 ? 'bellRing 1.2s ease 0.3s 3' : 'none' }}>
        🔔
      </span>
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            style={{
              position: 'absolute', top: '-5px', right: '-5px',
              background: '#f43f5e', color: '#fff', borderRadius: '999px',
              fontSize: '9px', fontWeight: 800, minWidth: '17px', height: '17px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', lineHeight: 1, fontFamily: "'DM Sans',sans-serif",
              pointerEvents: 'none',
              animation: 'badgePulse 1.5s ease-in-out infinite',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  </>
);

// ── Drawer ────────────────────────────────────────────────────────
export const NotificationDrawer = () => {
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [filter,        setFilter]        = useState('all');
  const drawerRef = useRef(null);
  useRelativeTime();

  useEffect(() => {
    notify.subscribe(setNotifications);
    return () => notify.unsubscribe(setNotifications);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Close if click is outside the drawer panel itself
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    // Use capture phase so it fires before any stop-propagation
    window.addEventListener('mousedown', handler, true);
    return () => window.removeEventListener('mousedown', handler, true);
  }, [open]);

  // Badge only counts unread warning/error
  const unreadBadge = notifications.filter((n) => !n.read && BADGE_TYPES.has(n.type)).length;

  // Tabs: all (excluding system), system, then individual types
  const mainNotifs   = notifications.filter((n) => n.type !== 'system');
  const systemNotifs = notifications.filter((n) => n.type === 'system');

  const getFiltered = () => {
    if (filter === 'system') return systemNotifs;
    if (filter === 'all')    return mainNotifs;
    return mainNotifs.filter((n) => n.type === filter);
  };
  const filtered = getFiltered();

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) {
      notify.markAllRead();
      // Reset filter to 'all' unless currently on system
      if (filter !== 'system') setFilter('all');
    }
  };

  // Tab definitions
  const tabs = [
    { key: 'all',     label: `All`,    count: mainNotifs.length },
    { key: 'error',   label: '❌',     count: mainNotifs.filter((n) => n.type === 'error').length },
    { key: 'warning', label: '⚠️',    count: mainNotifs.filter((n) => n.type === 'warning').length },
    { key: 'success', label: '✅',     count: mainNotifs.filter((n) => n.type === 'success').length },
    { key: 'info',    label: 'ℹ️',    count: mainNotifs.filter((n) => n.type === 'info').length },
    { key: 'system',  label: '⚙️',    count: systemNotifs.length },
  ].filter((t) => t.count > 0 || t.key === 'all');

  return (
    <div style={{ display: 'contents' }}>
      <NotificationBell onClick={handleOpen} unreadCount={unreadBadge} />

      <AnimatePresence>
        {open && (
          <>
            {/* Transparent backdrop — click outside closes drawer */}
            <div
              onMouseDown={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'transparent' }}
            />
            <motion.div
              ref={drawerRef}
              key="notif-drawer"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0,   opacity: 1 }}
            exit={{    x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            style={{
              position: 'fixed', right: 0, top: '56px', bottom: '56px',
              width: '300px',
              background: 'var(--bg-panel)',
              borderLeft: '1px solid var(--border)', zIndex: 45,
              display: 'flex', flexDirection: 'column',
              fontFamily: "'DM Sans','Segoe UI',sans-serif",
              boxShadow: 'var(--shadow-panel)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontSize: '14px' }}>🔔</span>
              <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>Notifications</span>
              {notifications.length > 0 && (
                <button onClick={() => notify.clear()} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>
                  Clear all
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            {/* Legend row */}
            <div style={{ padding: '6px 16px 0', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-hint)' }}>
                <span style={{ color: '#f43f5e' }}>●</span> Errors &amp; warnings stay until cleared
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-hint)', marginLeft: 'auto' }}>
                <span style={{ color: '#10b981' }}>●</span> Others auto-expire
              </span>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', padding: '8px 16px', gap: '4px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
              {tabs.map((t) => {
                const cfg    = TYPE_CONFIG[t.key];
                const active = filter === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    style={{
                      padding: '4px 8px', borderRadius: '6px',
                      border:     `1px solid ${active ? (cfg?.color ?? '#60a5fa') : 'var(--border)'}`,
                      background:  active ? (cfg?.bg ?? '#3b82f618') : 'transparent',
                      color:       active ? (cfg?.color ?? '#60a5fa') : 'var(--text-dim)',
                      cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    {t.key === 'all' ? `All (${t.count})` : `${t.label} ${t.count}`}
                  </button>
                );
              })}
            </div>

            {/* System tab notice */}
            {filter === 'system' && (
              <div style={{ padding: '6px 16px', background: '#64748b0a', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-dim)' }}>
                ⚙️ System events — informational only, auto-expire in 30s
              </div>
            )}

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {filtered.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'var(--text-hint)' }}>
                  <span style={{ fontSize: '28px', opacity: 0.25 }}>🔔</span>
                  <span style={{ fontSize: '12px' }}>Nothing here</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filtered.map((n) => {
                    const cfg     = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
                    const hasTTL  = ['success','info','system'].includes(n.type);
                    const isSystem = n.type === 'system';
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: n.expired ? 0.35 : 1, y: 0, scale: 1 }}
                        exit={{    opacity: 0, x: 40, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        style={{
                          marginBottom: '4px', padding: '9px 12px',
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                          borderRadius: '8px',
                          opacity: n.expired ? 0.35 : 1,
                          transition: 'opacity 1s ease',
                          filter: isSystem ? 'saturate(0.5)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>{cfg.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: isSystem ? '#64748b' : 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                              {n.message}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', marginTop: '3px', gap: '8px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{formatTime(n.time)}</span>
                              {n.expired && <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' }}>expiring…</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: '9px', fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, marginTop: '2px' }}>
                            {cfg.label}
                          </div>
                        </div>
                        {/* TTL countdown bar for auto-expiring types */}
                        {hasTTL && !n.expired && (
                          <ExpiryBar type={n.type} createdAt={n.time.getTime()} />
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* Footer summary */}
            {notifications.length > 0 && (
              <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
                  const count = notifications.filter((n) => n.type === type).length;
                  if (!count) return null;
                  return <span key={type} style={{ fontSize: '11px', color: cfg.color }}>{cfg.icon} {count}</span>;
                })}
                <span style={{ fontSize: '10px', color: 'var(--text-hint)', marginLeft: 'auto' }}>
                  {notifications.length} total
                </span>
              </div>
            )}
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};