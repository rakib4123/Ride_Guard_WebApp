import type { Config } from 'tailwindcss';

/**
 * Light, friendly, modern. Soft off-white canvas, white cards with gentle
 * shadows, rounded corners, a calm blue accent, and a clear green/amber/red
 * risk ramp that reads well on light surfaces.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#FFFFFF',     // contrast text on the accent (e.g. button labels)
        canvas: '#F4F7FB',  // page background
        panel: '#FFFFFF',   // cards
        panel2: '#F1F5F9',  // inputs / subtle surfaces
        line: '#E2E8F0',    // borders
        text: '#0F172A',    // primary text
        muted: '#64748B',   // secondary text
        signal: '#2563EB',  // friendly blue accent (brand, focus, primary)
        risk: {
          low: '#16A34A',
          med: '#F59E0B',
          high: '#EF4444',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        dial: '0 1px 3px rgba(15,23,42,0.06), 0 12px 28px -16px rgba(15,23,42,0.18)',
        soft: '0 1px 2px rgba(15,23,42,0.05)',
      },
    },
  },
  plugins: [],
};
export default config;
