// NotificationStore.js
const listeners = new Set();
const history   = [];

const TTL = {
  success: 60_000,
  info:    30_000,
  system:  30_000,
  warning: null,
  error:   null,
};

const FADE_DURATION = 8_000;

const broadcast = () => listeners.forEach((fn) => fn([...history]));

const hardRemove = (entry) => {
  const idx = history.indexOf(entry);
  if (idx !== -1) history.splice(idx, 1);
  broadcast();
};

const softExpire = (entry) => {
  if (entry.expired) return;
  entry.expired = true;
  broadcast();
  setTimeout(() => hardRemove(entry), FADE_DURATION);
};

const scheduleExpiry = (entry) => {
  const ttl = TTL[entry.type];
  if (!ttl) return;
  setTimeout(() => softExpire(entry), ttl);
};

export const notify = {
  _emit: (type, message, tag) => {
    // Deduplicate: if a non-expired entry with same tag already exists, skip
    if (tag && history.some((e) => !e.expired && e.tag === tag)) return null;

    const entry = {
      id:      Date.now() + Math.random(),
      tag:     tag ?? null,
      type,
      message,
      time:    new Date(),
      read:    false,
      expired: false,
    };
    history.unshift(entry);
    if (history.length > 100) history.pop();
    scheduleExpiry(entry);
    broadcast();
    return entry.id;
  },

  success: (msg, tag) => notify._emit('success', msg, tag),
  error:   (msg, tag) => notify._emit('error',   msg, tag),
  warning: (msg, tag) => notify._emit('warning', msg, tag),
  info:    (msg, tag) => notify._emit('info',    msg, tag),
  system:  (msg, tag) => notify._emit('system',  msg, tag),

  // Instantly remove all notifications matching a tag
  resolve: (tagOrMsg) => {
    const toRemove = history.filter((e) => e.tag === tagOrMsg || e.message === tagOrMsg);
    toRemove.forEach(hardRemove);
  },

  resolveWhere: (predFn) => {
    history.filter(predFn).forEach(hardRemove);
  },

  subscribe:   (fn) => { listeners.add(fn); fn([...history]); },
  unsubscribe: (fn) => listeners.delete(fn),

  markAllRead: () => { history.forEach((n) => { n.read = true; }); broadcast(); },
  clear: () => { history.length = 0; broadcast(); },
};

export const toast = notify;