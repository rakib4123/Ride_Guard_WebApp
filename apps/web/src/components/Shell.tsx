'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TabNav } from '@/components/TabNav';
import { PlaceholderBanner } from '@/components/PlaceholderBanner';
import { AccountBar } from '@/components/AccountBar';

const AUTH_ROUTES = ['/login', '/signup'];
const FULL_BLEED = ['/now', '/', '/map', '/route']; // map-first screens manage their own chrome

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const isAuthRoute = AUTH_ROUTES.includes(path);

  useEffect(() => {
    if (!configured || loading) return;
    if (!user && !isAuthRoute) router.replace('/login');
    if (user && isAuthRoute) router.replace('/now');
  }, [user, loading, configured, isAuthRoute, router]);

  if (isAuthRoute) {
    return <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">{children}</div>;
  }
  if (configured && (loading || !user)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading…</div>;
  }

  // Full-bleed map screens render edge-to-edge and supply their own nav/header.
  if (FULL_BLEED.includes(path)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 pt-5">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-text">
            Ride<span className="text-signal">Guard</span>
          </span>
          <span className="font-mono text-[10px] text-muted">DHAKA</span>
        </div>
        <AccountBar />
      </header>
      <PlaceholderBanner />
      <main className="flex-1 space-y-4 px-4 py-4">{children}</main>
      <TabNav />
    </div>
  );
}
