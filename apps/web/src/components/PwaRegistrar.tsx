'use client';
import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // In development, don't register a service worker at all, and
    // unregister any stale one from a previous run. Dev assets change
    // constantly; a cached SW keeps serving stale pages after idle.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => undefined);
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => undefined);
  }, []);

  return null;
}