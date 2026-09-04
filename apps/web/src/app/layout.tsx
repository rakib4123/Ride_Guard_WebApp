import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, JetBrains_Mono } from 'next/font/google';
import { LocaleProvider } from '@/i18n/LocaleContext';
import { AuthProvider } from '@/context/AuthContext';
import { ProfileProvider } from '@/context/ProfileContext';
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
  description: 'Rider risk advisory for Dhaka motorcyclists.',
};
export const viewport: Viewport = { themeColor: '#EDF1F7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen font-body">
        <LocaleProvider>
          <AuthProvider>
            <ProfileProvider>
              <Shell>{children}</Shell>
            </ProfileProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
