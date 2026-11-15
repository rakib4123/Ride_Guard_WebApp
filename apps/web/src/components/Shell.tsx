'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TabNav } from '@/components/TabNav';
import { PlaceholderBanner } from '@/components/PlaceholderBanner';
import { AccountBar } from '@/components/AccountBar';
import { Splash } from '@/components/Splash';
import { nextPath } from '@/lib/nav';

/** How long the branded splash is held before content may take over. */
const MIN_SPLASH_MS = 1200;

const AUTH_ROUTES = ['/login', '/signup'];
const FULL_BLEED = ['/now', '/', '/map', '/route']; // map-first screens manage their own chrome

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const isAuthRoute = AUTH_ROUTES.includes(path);
  // The splash holds for a brief branded minimum, then clears as soon as auth
  // has resolved. It is not a fixed delay: this is a safety app, and a rider
  // checking conditions before pulling away should not wait on an animation.
  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinSplashDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  const booting = !minSplashDone || (configured && loading);

  // Guests may use everything except their saved trips (that screen asks them
  // to sign in). Once signed in, the auth pages send the rider back to where
  // they came from.
  useEffect(() => {
    if (!configured || loading) return;
    if (user && isAuthRoute) router.replace(nextPath());
  }, [user, loading, configured, isAuthRoute, router]);

  if (booting) {
    return <Splash />;
  }

  if (isAuthRoute) {
    return <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">{children}</div>;
  }
  // Full-bleed map screens render edge-to-edge; the nav bar floats on top.
  if (FULL_BLEED.includes(path)) {
    return (
      <>
        {children}
        <TabNav />
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="flex items-center justify-between px-4 pt-5">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-text">
            Ride<span className="text-signal">Guard</span>
          </span>
        </div>
        <AccountBar />
      </header>
      <PlaceholderBanner />
      <main className="flex-1 space-y-4 px-4 py-4 pb-24">{children}</main>
      <TabNav />
    </div>
  );
}
