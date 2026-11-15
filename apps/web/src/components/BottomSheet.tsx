'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { settleSheet } from '@/lib/motion';

/** Room left under the sheet for the floating tab bar. */
const TAB_BAR = 'calc(3.75rem + env(safe-area-inset-bottom))';
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="switch"], [role="radio"]';

/**
 * A map-app bottom sheet: the `peek` part always shows; drag it up (or tap the
 * handle) to reveal `children`. It follows the finger, settles open or closed
 * by flick or position, and `floating` controls (the locate button) ride on
 * its top edge. Drags start only from the handle/peek area and never from a
 * button, so taps still work; the body scrolls on its own once open.
 */
export function BottomSheet({
  peek, children, open, onOpenChange, floating, label,
}: {
  peek: React.ReactNode;
  children?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floating?: React.ReactNode;
  /** Accessible name for the handle ("Details"). */
  label: string;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const [closedY, setClosedY] = useState(0);
  const [dragY, setDragY] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const drag = useRef<{ startY: number; base: number; lastY: number; lastT: number; v: number; moved: boolean } | null>(null);

  // How far down the sheet sits when closed: everything but the peek.
  const measure = useCallback(() => {
    const total = sheet.current?.offsetHeight ?? 0;
    const shown = (peekRef.current?.offsetHeight ?? 0) + (spacer.current?.offsetHeight ?? 0);
    setClosedY(Math.max(0, total - shown));
  }, []);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (sheet.current) ro.observe(sheet.current);
    if (peekRef.current) ro.observe(peekRef.current);
    return () => ro.disconnect();
  }, [measure]);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);

  const hasBody = Boolean(children);
  const restY = open && hasBody ? 0 : closedY;
  const y = dragY ?? restY;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!hasBody || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    drag.current = { startY: e.clientY, base: restY, lastY: e.clientY, lastT: performance.now(), v: 0, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.v = 0.8 * d.v + 0.2 * (((d.lastY - e.clientY) / dt) * 1000); // px/s, positive = up
    d.lastY = e.clientY; d.lastT = now;
    if (Math.abs(e.clientY - d.startY) > 4) d.moved = true;
    setDragY(Math.min(closedY, Math.max(0, d.base + (e.clientY - d.startY))));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { setDragY(null); onOpenChange(!open); return; } // a tap toggles
    const current = dragY ?? restY;
    const progress = closedY ? 1 - current / closedY : 1;
    setDragY(null);
    onOpenChange(settleSheet(progress, closedY ? d.v / closedY : 0));
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1200]">
      <div
        ref={sheet}
        className="pointer-events-auto relative mx-auto flex max-h-[85dvh] max-w-2xl flex-col rounded-t-3xl bg-white"
        style={{
          transform: `translateY(${mounted ? y : closedY + 160}px)`,
          transition: dragY != null ? 'none' : 'transform .42s cubic-bezier(.22,1,.36,1)',
          boxShadow: '0 -1px 2px rgba(11,18,32,.04), 0 -18px 44px -18px rgba(11,18,32,.28)',
          touchAction: 'none',
        }}
      >
        {floating && <div className="absolute -top-16 right-3 flex flex-col gap-2">{floating}</div>}

        <div ref={peekRef} className="flex-none px-4 pb-1 pt-2"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {hasBody ? (
            // Not a <button>: the handle must start drags, and a tap on it is
            // handled by the pointer logic. Keyboard users toggle with Enter/Space.
            <div role="button" tabIndex={0} aria-expanded={open} aria-label={label}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenChange(!open); } }}
              className="mx-auto mb-2 flex h-6 w-full cursor-grab items-center justify-center">
              <span className="h-1.5 w-10 rounded-full bg-line" />
            </div>
          ) : <div className="h-2" />}
          {peek}
        </div>

        {hasBody && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4" style={{ touchAction: 'pan-y' }}
            aria-hidden={!open}>
            <div className={open ? 'rg-fade-up space-y-4 border-t border-line pb-3 pt-3' : 'space-y-4 border-t border-line pb-3 pt-3'}>
              {children}
            </div>
          </div>
        )}
        <div ref={spacer} className="flex-none" style={{ height: TAB_BAR }} />
      </div>
    </div>
  );
}

/** A round floating map button (locate, recenter). */
export function MapFab({ onClick, label, active = false, disabled = false, children }: {
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} disabled={disabled}
      className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full shadow-lift disabled:opacity-60 ${
        active ? 'bg-signal text-white' : 'bg-white text-signal'}`}>
      {children}
    </button>
  );
}

/** Crosshair icon for "my location"; filled while the map follows the rider. */
export function LocateIcon({ following }: { following: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" fill={following ? 'currentColor' : 'none'} />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
