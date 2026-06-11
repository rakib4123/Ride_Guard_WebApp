'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/now', label: 'Now' },
  { href: '/route', label: 'Route' },
  { href: '/map', label: 'Map' },
  { href: '/about', label: 'About' },
];

export function TabNav() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map((t) => {
          const active = path === t.href || (path === '/' && t.href === '/now');
          return (
            <Link key={t.href} href={t.href}
              className="flex-1 py-3 text-center text-sm font-medium transition-colors"
              style={{ color: active ? '#FFB454' : '#93A0B4' }}>
              {t.label}
              {active && (
                <span className="mx-auto mt-1 block h-0.5 w-6 rounded-full bg-signal" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
