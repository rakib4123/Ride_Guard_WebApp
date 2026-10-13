'use client';

import type { AlertItem } from '@/context/AlertsContext';
import { RISK_TOKENS } from '@/lib/riskTokens';

export function AlertBanner({ alert, onClose }: { alert: AlertItem | null; onClose: () => void }) {
  if (!alert) return null;
  // Same measured pairs as the verdict band: amber takes ink, never white.
  const token = RISK_TOKENS[alert.level === 'high' ? 'High' : 'Medium'];
  return (
    <div className="fixed inset-x-0 top-3 z-[2000] flex justify-center px-3"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl2 px-4 py-3 shadow-dial"
        style={{ background: token.surface, color: token.onSurface }} role="alert">
        <span className="shrink-0 text-xl leading-none" aria-hidden="true">{token.icon}</span>
        <span className="flex-1 text-base font-semibold">{alert.message}</span>
        <button onClick={onClose} aria-label="Dismiss"
          className="flex h-11 w-11 flex-none items-center justify-center opacity-80 hover:opacity-100">✕</button>
      </div>
    </div>
  );
}
