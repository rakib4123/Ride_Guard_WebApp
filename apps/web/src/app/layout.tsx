import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import { ProfileProvider } from '@/context/ProfileContext';
import { Shell } from '@/components/Shell';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
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
        <AuthProvider>
          <ProfileProvider>
            <Shell>{children}</Shell>
          </ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
