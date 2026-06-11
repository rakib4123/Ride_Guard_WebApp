'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/now', label: 'Now', icon: GaugeIcon },
  { href: '/route', label: 'Route', icon: RouteIcon },
  { href: '/map', label: 'Map', icon: MapIcon },
  { href: '/history', label: 'Trips', icon: HistoryIcon },
  { href: '/profile', label: 'Profile', icon: UserIcon },
];

export function TabNav({ inline = false }: { inline?: boolean }) {
  const path = usePathname();
  return (
    <nav className={inline ? '' : 'sticky bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur'}>
      <div className="mx-auto flex max-w-2xl">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = path === t.href || (path === '/' && t.href === '/now');
          return (
            <Link key={t.href} href={t.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors"
              style={{ color: active ? '#2563EB' : '#64748B' }}>
              <Icon />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const ic = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function GaugeIcon() { return <svg {...ic}><path d="M12 14l3-3" /><path d="M3.5 18a9 9 0 1 1 17 0" /></svg>; }
function RouteIcon() { return <svg {...ic}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6" /></svg>; }
function MapIcon() { return <svg {...ic}><path d="M9 6l-6 3v12l6-3 6 3 6-3V6l-6 3-6-3z" /><path d="M9 6v12M15 9v12" /></svg>; }
function HistoryIcon() { return <svg {...ic}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" /><path d="M12 8v4l3 2" /></svg>; }
function UserIcon() { return <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>; }
