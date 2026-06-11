import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { ProfileProvider } from '@/context/ProfileContext';
import { TabNav } from '@/components/TabNav';
import { PlaceholderBanner } from '@/components/PlaceholderBanner';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'RideGuard',
  description: 'Rider risk advisory for Dhaka motorcyclists.',
};
export const viewport: Viewport = { themeColor: '#F4F7FB' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen font-body">
        <ProfileProvider>
          <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
            <header className="px-4 pt-5">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-tight text-text">
                  Ride<span className="text-signal">Guard</span>
                </span>
                <span className="font-mono text-[10px] text-muted">DHAKA</span>
              </div>
            </header>
            <PlaceholderBanner />
            <main className="flex-1 space-y-4 px-4 py-4">{children}</main>
            <TabNav />
          </div>
        </ProfileProvider>
      </body>
    </html>
  );
}
