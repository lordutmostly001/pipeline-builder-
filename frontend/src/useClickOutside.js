// useClickOutside.js — fires callback when user clicks outside the ref element
import { useEffect } from 'react';

export const useClickOutside = (ref, onClose, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    // Use mousedown so it fires before click handlers inside the panel
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose, enabled]);
};