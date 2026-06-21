'use client';

/** Branded startup / loading screen. */
export function Splash() {
  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-6 bg-canvas">
      <style>{`
        @keyframes rg-spin { to { transform: rotate(360deg); } }
        @keyframes rg-pulse { 0%,100% { opacity:.35; } 50% { opacity:1; } }
        @keyframes rg-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
      `}</style>

      <div className="relative h-24 w-24">
        <svg viewBox="0 0 96 96" className="h-24 w-24" style={{ animation: 'rg-spin 1.1s linear infinite' }} aria-hidden="true">
          <circle cx="48" cy="48" r="40" fill="none" stroke="#E2E8F0" strokeWidth="7" />
          <circle cx="48" cy="48" r="40" fill="none" stroke="#2563EB" strokeWidth="7" strokeLinecap="round"
            strokeDasharray="70 251" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 14l3-3" />
            <path d="M3.5 18a9 9 0 1 1 17 0" />
          </svg>
        </div>
      </div>

      <div className="text-center">
        <div className="font-display text-2xl font-bold tracking-tight text-text">
          Ride<span className="text-signal">Guard</span>
        </div>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-muted"
          style={{ animation: 'rg-pulse 1.6s ease-in-out infinite' }}>
          Dhaka · Ride safe
        </div>
      </div>

      <div className="h-1 w-40 overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/3 rounded-full bg-signal" style={{ animation: 'rg-bar 1.2s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
