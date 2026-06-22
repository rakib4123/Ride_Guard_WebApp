import type { Config } from 'tailwindcss';

/**
 * RideGuard design system — "rider's instrument cluster".
 * Light and map-legible, but the floating UI reads like a premium motorcycle
 * dashboard: deep ink, hairline borders, layered depth, mono data readouts,
 * and a precise green/amber/red risk ramp.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#FFFFFF',     // text on the accent
        canvas: '#EDF1F7',  // page background (cool off-white)
        panel: '#FFFFFF',   // cards / sheets
        panel2: '#EFF3F8',  // inputs / subtle fills
        line: '#E1E6EF',    // hairline borders
        text: '#0B1220',    // primary text (deep ink)
        muted: '#5B6675',   // secondary text
        signal: '#2563EB',  // brand / primary / focus
        'signal-700': '#1D4ED8',
        risk: {
          low: '#12B76A',   // success
          med: '#F79009',   // warning
          high: '#F04438',  // danger
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { lg2: '0.875rem', xl2: '1.25rem', xl3: '1.5rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(11,18,32,0.04), 0 1px 3px rgba(11,18,32,0.05)',
        card: '0 1px 2px rgba(11,18,32,0.04), 0 10px 26px -14px rgba(11,18,32,0.14)',
        lift: '0 1px 2px rgba(11,18,32,0.05), 0 16px 40px -18px rgba(11,18,32,0.20)',
        sheet: '0 -1px 2px rgba(11,18,32,0.04), 0 -16px 44px -20px rgba(11,18,32,0.22)',
        dial: '0 2px 8px rgba(11,18,32,0.06), 0 22px 48px -26px rgba(11,18,32,0.26)',
        focus: '0 0 0 4px rgba(37,99,235,0.18)',
      },
      letterSpacing: { tightish: '-0.01em' },
      transitionTimingFunction: { swift: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    },
  },
  plugins: [],
};
export default config;
