'use client';

import type { AlertItem } from '@/hooks/useAlerts';

export function AlertBanner({ alert, onClose }: { alert: AlertItem | null; onClose: () => void }) {
  if (!alert) return null;
  const color = alert.level === 'high' ? '#EF4444' : '#F59E0B';
  return (
    <div className="fixed inset-x-0 top-3 z-[2000] flex justify-center px-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl2 px-4 py-3 text-white shadow-dial"
        style={{ background: color }} role="alert">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><circle cx="12" cy="17" r="0.6" fill="currentColor" />
        </svg>
        <span className="flex-1 text-sm font-semibold">{alert.message}</span>
        <button onClick={onClose} aria-label="Dismiss" className="text-white/80 hover:text-white">✕</button>
      </div>
    </div>
  );
}
