import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, JetBrains_Mono } from 'next/font/google';
import { LocaleProvider } from '@/i18n/LocaleContext';
import { AuthProvider } from '@/context/AuthContext';
import { ConditionsProvider } from '@/context/ConditionsContext';
import { LocationProvider } from '@/context/LocationContext';
import { AlertsProvider } from '@/context/AlertsContext';
import { Shell } from '@/components/Shell';

// Inter and Space Grotesk ship no Bengali glyphs, so Bengali silently fell
// back to a system font and conjuncts broke on Android. Hind Siliguri covers
// both scripts; it is not a variable font, so it needs an explicit weight list.
const display = Hind_Siliguri({
  subsets: ['latin', 'bengali'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
});
const body = Hind_Siliguri({
  subsets: ['latin', 'bengali'],
  weight: ['400', '600', '700'],
  variable: '--font-body',
});
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'RideGuard',
  description: 'Riding-risk advisory for motorcyclists, from what your phone measures and where crashes happen.',
};
export const viewport: Viewport = { themeColor: '#EDF1F7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen font-body">
        <LocaleProvider>
          <AuthProvider>
            <LocationProvider>
            <ConditionsProvider>
              <AlertsProvider>
                <Shell>{children}</Shell>
              </AlertsProvider>
            </ConditionsProvider>
            </LocationProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
