# RideGuard Rider-First Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the risk-verdict design system and bilingual foundation, and wire it into the Now screen so the app stops reporting "Low" when it has no data.

**Architecture:** A pure-logic core (`riskTokens`, `verdict`, `i18n`) tested with Vitest, consumed by one presentational `RiskVerdict` component that Now, Route and Map will all share in later phases. Nothing in this phase touches the API, the scoring contract, or the map layers.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5.4, Tailwind 3.4, Vitest (new), `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-09-03-rider-first-redesign-design.md`

## Global Constraints

- Package manager is npm workspaces. Web commands run as `npm run <script> --workspace @rideguard/web` from the repo root.
- `@rideguard/shared` must be built before web tests run: `npm run build:shared`.
- Risk surfaces and their foreground colours are fixed and measured — never assume white text: Low `#0B7A43` on white, Medium `#E08600` on ink `#0B1220`, High `#D92D20` on white, Unknown `#5B6675` on white.
- Every surface/foreground pair must meet WCAG AA for normal text (≥ 4.5 : 1).
- Numerals are always Western (`45`, never `৪৫`) in both locales.
- Bengali copy in this plan is **unverified** and carries a `// TRANSLATION: unverified` marker. It must not be removed until a native speaker signs off (spec Open Item 1).
- No component-render tests (spec §12). Presentational components are gated by `npm run build --workspace @rideguard/web` plus a visual check.
- Minimum touch target 44×44 px.

---

## File Structure

**Create**
| File | Responsibility |
|---|---|
| `apps/web/vitest.config.ts` | Test runner config, `@/` alias |
| `apps/web/src/lib/riskTokens.ts` | Colour / foreground / icon per risk level. No i18n dependency. |
| `apps/web/src/lib/riskTokens.test.ts` | Contrast enforcement |
| `apps/web/src/i18n/messages/en.ts` | English catalogue; source of `MessageKey` |
| `apps/web/src/i18n/messages/bn.ts` | Bengali catalogue, typed against `MessageKey` |
| `apps/web/src/i18n/messages.test.ts` | Catalogue completeness |
| `apps/web/src/i18n/LocaleContext.tsx` | Locale state, persistence, `useT()` |
| `apps/web/src/lib/verdict.ts` | Score → level, score, model reasons, watch-outs |
| `apps/web/src/lib/verdict.test.ts` | Level mapping, Unknown fallback, reason/watch-out split |
| `apps/web/src/components/RiskVerdict.tsx` | The band, sizes `sm`/`md`/`lg` |
| `apps/web/src/components/LanguageToggle.tsx` | EN / বাংলা switch |

**Modify**
| File | Change |
|---|---|
| `apps/web/package.json` | Add `vitest` devDep, `test` script |
| `apps/web/tailwind.config.ts` | Replace the `risk` palette |
| `apps/web/src/app/layout.tsx` | Swap fonts to Hind Siliguri; wrap in `LocaleProvider` |
| `apps/web/src/app/now/page.tsx:140,200,252` | Remove both `?? 'Low'` defaults; render `RiskVerdict` |
| `apps/web/src/app/profile/page.tsx` | Add the language section |

---

## Task 1: Vitest harness

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/src/lib/fmt.ts`, `apps/web/src/lib/fmt.test.ts`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `npm run test --workspace @rideguard/web`; `fmt.pct(n: number): string`, `fmt.km(n: number): string`, `fmt.speed(n: number): string` — all returning Western digits.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^2.1.8 --workspace @rideguard/web
```

- [ ] **Step 2: Add the config**

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Pure logic only — no jsdom, per spec section 12.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3: Add the test script**

In `apps/web/package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the failing test**

Create `apps/web/src/lib/fmt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fmt } from '@/lib/fmt';

describe('fmt', () => {
  it('renders percentages as Western digits', () => {
    expect(fmt.pct(0.395)).toBe('40');
    expect(fmt.pct(0)).toBe('0');
    expect(fmt.pct(1)).toBe('100');
  });

  it('clamps percentages into 0..100', () => {
    expect(fmt.pct(-0.5)).toBe('0');
    expect(fmt.pct(2)).toBe('100');
  });

  it('renders distance to one decimal', () => {
    expect(fmt.km(18.24)).toBe('18.2');
  });

  it('renders speed as a whole number', () => {
    expect(fmt.speed(52.6)).toBe('53');
  });

  it('never emits Bengali digits', () => {
    const out = [fmt.pct(0.4), fmt.km(18.2), fmt.speed(52)].join('');
    expect(out).not.toMatch(/[০-৯]/);
  });
});
```

- [ ] **Step 5: Run it and watch it fail**

```bash
npm run build:shared
npm run test --workspace @rideguard/web
```

Expected: FAIL — `Failed to resolve import "@/lib/fmt"`.

- [ ] **Step 6: Implement**

Create `apps/web/src/lib/fmt.ts`:

```ts
/**
 * Number formatting. Always Western digits, in both locales: every
 * speedometer, road sign and odometer in Bangladesh uses them, so matching
 * the bike's own dial matters more than script consistency (spec 3.4).
 */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const fmt = {
  /** A 0..1 risk value as a 0..100 string. */
  pct: (x: number): string => String(Math.round(clamp01(x) * 100)),
  km: (x: number): string => x.toFixed(1),
  speed: (x: number): string => String(Math.round(x)),
};
```

- [ ] **Step 7: Run tests**

```bash
npm run test --workspace @rideguard/web
```

Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json package-lock.json \
        apps/web/src/lib/fmt.ts apps/web/src/lib/fmt.test.ts
git commit -m "test: add vitest harness and number formatting helper"
```

---

## Task 2: Risk tokens with enforced contrast

**Files:**
- Create: `apps/web/src/lib/riskTokens.ts`, `apps/web/src/lib/riskTokens.test.ts`

**Interfaces:**
- Consumes: `AdvisoryLevel` from `@rideguard/shared`
- Produces: `type RiskLevel = AdvisoryLevel | 'Unknown'`; `interface RiskToken { surface: string; onSurface: string; icon: string }`; `RISK_TOKENS: Record<RiskLevel, RiskToken>`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/riskTokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RISK_TOKENS, type RiskLevel } from '@/lib/riskTokens';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LEVELS: RiskLevel[] = ['Low', 'Medium', 'High', 'Unknown'];

describe('risk tokens', () => {
  it('defines a token for every level', () => {
    for (const level of LEVELS) expect(RISK_TOKENS[level]).toBeDefined();
  });

  it.each(LEVELS)('%s meets WCAG AA for normal text', (level) => {
    const t = RISK_TOKENS[level];
    expect(contrast(t.surface, t.onSurface)).toBeGreaterThanOrEqual(4.5);
  });

  it('pairs amber with ink, not white — white on amber is only 2.77:1', () => {
    expect(RISK_TOKENS.Medium.onSurface).toBe('#0B1220');
    expect(contrast(RISK_TOKENS.Medium.surface, '#FFFFFF')).toBeLessThan(3);
  });

  it('gives every level a distinct icon so colour is never the only signal', () => {
    const icons = LEVELS.map((l) => RISK_TOKENS[l].icon);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run test --workspace @rideguard/web
```

Expected: FAIL — `Failed to resolve import "@/lib/riskTokens"`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/riskTokens.ts`:

```ts
import type { AdvisoryLevel } from '@rideguard/shared';

/**
 * The advisory levels plus Unknown. Unknown is not decoration: when the
 * scoring API is unreachable the app must say so rather than fall back to a
 * reassuring "Low" (spec 3.2).
 */
export type RiskLevel = AdvisoryLevel | 'Unknown';

export interface RiskToken {
  /** Background of the verdict band. */
  surface: string;
  /** Foreground ON that surface. Read it — never assume white. */
  onSurface: string;
  /** Carries the meaning when colour cannot: colour-blindness, sunlight. */
  icon: string;
}

/**
 * Every pair below is measured at >= 4.5:1. Amber is the one asymmetry and it
 * is forced: no amber light enough to read as amber can carry white text
 * (#E08600 on white is 2.77:1), so Medium takes ink instead at 6.76:1.
 */
export const RISK_TOKENS: Record<RiskLevel, RiskToken> = {
  Low: { surface: '#0B7A43', onSurface: '#FFFFFF', icon: '✓' },
  Medium: { surface: '#E08600', onSurface: '#0B1220', icon: '⚠' },
  High: { surface: '#D92D20', onSurface: '#FFFFFF', icon: '⛔' },
  Unknown: { surface: '#5B6675', onSurface: '#FFFFFF', icon: '–' },
};
```

- [ ] **Step 4: Run tests**

```bash
npm run test --workspace @rideguard/web
```

Expected: PASS, 12 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/riskTokens.ts apps/web/src/lib/riskTokens.test.ts
git commit -m "feat: risk level tokens with enforced WCAG AA contrast"
```

---

## Task 3: Bilingual catalogues and locale context

**Files:**
- Create: `apps/web/src/i18n/messages/en.ts`, `apps/web/src/i18n/messages/bn.ts`, `apps/web/src/i18n/messages.test.ts`, `apps/web/src/i18n/LocaleContext.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `type MessageKey`; `en`, `bn` catalogues; `<LocaleProvider>`; `useLocale(): { locale: Locale; setLocale(l: Locale): void }`; `useT(): (key: MessageKey) => string`

- [ ] **Step 1: Write the English catalogue**

Create `apps/web/src/i18n/messages/en.ts`:

```ts
export const en = {
  'risk.Low.title': 'CLEAR',
  'risk.Medium.title': 'BE CAREFUL',
  'risk.High.title': 'HIGH RISK — SLOW DOWN',
  'risk.Unknown.title': "CAN'T CHECK",

  'reason.blackspot': 'Crash blackspot nearby',
  'reason.overLimit': 'Over the speed limit',
  'reason.phone': 'Phone use while riding',
  'reason.alcohol': 'Alcohol',
  'reason.noHelmet': 'No helmet',
  'reason.smoking': 'Smoking while riding',

  'watch.rain': 'Rain',
  'watch.fog': 'Fog',
  'watch.wet': 'Wet road',
  'watch.night': 'Riding at night',

  'label.why': 'Why this reading',
  'label.watchOut': 'Also watch out for',
  'label.startRide': 'Start ride',
  'label.stopRide': 'Stop ride',
  'label.language': 'Language',
  'label.sample': 'Sample reading — not the real model',
  'label.unknownHelp': 'Cannot reach RideGuard right now',
} as const;

/** Every translatable string in the app is one of these. */
export type MessageKey = keyof typeof en;
```

- [ ] **Step 2: Write the Bengali catalogue**

Create `apps/web/src/i18n/messages/bn.ts`:

```ts
import type { MessageKey } from './en';

// TRANSLATION: unverified — drafted without a native speaker.
// Do not remove this marker until reviewed (spec Open Item 1).
export const bn: Record<MessageKey, string> = {
  'risk.Low.title': 'রাস্তা স্বাভাবিক',
  'risk.Medium.title': 'সতর্ক থাকুন',
  'risk.High.title': 'ঝুঁকি বেশি — ধীরে চলুন',
  'risk.Unknown.title': 'তথ্য পাওয়া যায়নি',

  'reason.blackspot': 'কাছেই দুর্ঘটনাপ্রবণ এলাকা',
  'reason.overLimit': 'গতিসীমার বেশি',
  'reason.phone': 'চালানোর সময় ফোন ব্যবহার',
  'reason.alcohol': 'মদ্যপান',
  'reason.noHelmet': 'হেলমেট নেই',
  'reason.smoking': 'চালানোর সময় ধূমপান',

  'watch.rain': 'বৃষ্টি',
  'watch.fog': 'কুয়াশা',
  'watch.wet': 'ভেজা রাস্তা',
  'watch.night': 'রাতে চালানো',

  'label.why': 'কেন এই ফলাফল',
  'label.watchOut': 'এদিকেও খেয়াল রাখুন',
  'label.startRide': 'যাত্রা শুরু',
  'label.stopRide': 'যাত্রা শেষ',
  'label.language': 'ভাষা',
  'label.sample': 'নমুনা ফলাফল — প্রকৃত মডেল নয়',
  'label.unknownHelp': 'এখন RideGuard-এর সাথে সংযোগ করা যাচ্ছে না',
};
```

- [ ] **Step 3: Write the failing completeness test**

Create `apps/web/src/i18n/messages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { en } from '@/i18n/messages/en';
import { bn } from '@/i18n/messages/bn';

describe('message catalogues', () => {
  it('has a Bengali string for every English key', () => {
    const missing = Object.keys(en).filter((k) => !(k in bn));
    expect(missing).toEqual([]);
  });

  it('has no Bengali keys that English lacks', () => {
    const extra = Object.keys(bn).filter((k) => !(k in en));
    expect(extra).toEqual([]);
  });

  it('has no empty strings in either catalogue', () => {
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en.${k}`).not.toBe('');
    for (const [k, v] of Object.entries(bn)) expect(v.trim(), `bn.${k}`).not.toBe('');
  });

  it('actually contains Bengali script, catching copy-pasted English', () => {
    const bengali = /[ঀ-৿]/;
    for (const [k, v] of Object.entries(bn)) {
      expect(bengali.test(v), `bn.${k} has no Bengali characters`).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm run test --workspace @rideguard/web
```

Expected: PASS, 16 tests total. (Catalogues were written first here because the test asserts a relationship between two files — there is no meaningful failing state with neither present.)

- [ ] **Step 5: Add the locale context**

Create `apps/web/src/i18n/LocaleContext.tsx`:

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, type MessageKey } from './messages/en';
import { bn } from './messages/bn';

export type Locale = 'en' | 'bn';

const STORAGE_KEY = 'rideguard.locale';
const CATALOGUES: Record<Locale, Record<MessageKey, string>> = { en, bn };

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
}

const Ctx = createContext<LocaleState | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  // Read the stored choice after mount: localStorage is unavailable during SSR,
  // and reading it in useState would desync the server and client markup.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'bn') setLocaleState(saved);
    } catch {
      /* private mode or blocked storage — English stands */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* choice still applies for this session */
    }
  }, []);

  const t = useCallback((key: MessageKey) => CATALOGUES[locale][key] ?? en[key], [locale]);

  const value = useMemo<LocaleState>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocale must be used within LocaleProvider');
  return v;
}

/** Convenience for components that only translate. */
export function useT(): (key: MessageKey) => string {
  return useLocale().t;
}
```

- [ ] **Step 6: Verify it compiles**

```bash
npm run build --workspace @rideguard/web
```

Expected: compiles successfully. (`LocaleProvider` is not mounted yet — Task 4 does that.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/i18n
git commit -m "feat: bilingual message catalogues and locale context"
```

---

## Task 4: Fonts, palette, and provider mount

**Files:**
- Modify: `apps/web/src/app/layout.tsx`, `apps/web/tailwind.config.ts`

**Interfaces:**
- Consumes: `LocaleProvider` from Task 3
- Produces: `LocaleProvider` mounted above `ProfileProvider`; Tailwind `risk-low` / `risk-med` / `risk-high` updated to the measured palette

- [ ] **Step 1: Swap the fonts**

In `apps/web/src/app/layout.tsx`, replace the font imports and declarations. `Inter` and `Space_Grotesk` ship no Bengali glyphs, so Bengali silently falls back and conjuncts break on Android.

```tsx
import { Hind_Siliguri, JetBrains_Mono } from 'next/font/google';

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
```

- [ ] **Step 2: Mount the provider**

In the same file, wrap the existing tree — `LocaleProvider` goes outermost so auth and profile UI can translate:

```tsx
<body className="min-h-screen font-body">
  <LocaleProvider>
    <AuthProvider>
      <ProfileProvider>
        <Shell>{children}</Shell>
      </ProfileProvider>
    </AuthProvider>
  </LocaleProvider>
</body>
```

Add the import: `import { LocaleProvider } from '@/i18n/LocaleContext';`

- [ ] **Step 3: Update the Tailwind palette**

In `apps/web/tailwind.config.ts`, replace the `risk` block:

```ts
risk: {
  low: '#0B7A43',   // white text — 5.41:1
  med: '#E08600',   // INK text  — 6.76:1 (white would be 2.77:1)
  high: '#D92D20',  // white text — 4.83:1
  unknown: '#5B6675',
},
```

- [ ] **Step 4: Give Bengali room to breathe**

In `apps/web/src/app/globals.css`, inside the `body` rule, add:

```css
  /* Bengali conjuncts sit taller than Latin and clip at 1.5. */
  line-height: 1.65;
```

- [ ] **Step 5: Verify build and render**

```bash
npm run build --workspace @rideguard/web
npm run dev --workspace @rideguard/web
```

Open `http://localhost:3000/now`. Confirm text still renders and nothing overflows. Expected: build passes; the app looks near-identical apart from slightly different type.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/tailwind.config.ts apps/web/src/app/globals.css
git commit -m "feat: Bengali-capable typography and measured risk palette"
```

---

## Task 5: The verdict builder

**Files:**
- Create: `apps/web/src/lib/verdict.ts`, `apps/web/src/lib/verdict.test.ts`

**Interfaces:**
- Consumes: `RiskLevel` (Task 2), `MessageKey` (Task 3), `ScorePointResponse` / `FeatureVector` from `@rideguard/shared`
- Produces: `interface Verdict { level: RiskLevel; score: string | null; modelReasons: MessageKey[]; watchOuts: MessageKey[]; isPlaceholder: boolean }` and `buildVerdict(result: ScorePointResponse | null, features: FeatureVector): Verdict`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/verdict.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildVerdict } from '@/lib/verdict';
import { DEFAULT_PROFILE, DEFAULT_TOGGLES, type FeatureVector } from '@rideguard/shared';
import type { ScorePointResponse } from '@rideguard/shared';

const features = (over: Partial<FeatureVector> = {}): FeatureVector => ({
  ...DEFAULT_PROFILE,
  ...DEFAULT_TOGGLES,
  Weather: 'Clear',
  Time_of_Day: 'Morning',
  ...over,
});

const result = (over: Partial<ScorePointResponse> = {}): ScorePointResponse => ({
  R: 0.4,
  advisoryLevel: 'Medium',
  behaviourScore: 0.3,
  spatialPrior: 0.2,
  probabilities: { noAccident: 0.5, moderate: 0.5, severe: 0 },
  topFactors: [],
  conformalSet: [],
  isPlaceholder: false,
  modelVersion: 'test',
  ...over,
});

describe('buildVerdict', () => {
  it('reports Unknown when there is no result, never Low', () => {
    const v = buildVerdict(null, features());
    expect(v.level).toBe('Unknown');
    expect(v.score).toBeNull();
    expect(v.modelReasons).toEqual([]);
  });

  it('carries the level and score through from the API', () => {
    const v = buildVerdict(result({ R: 0.395, advisoryLevel: 'Medium' }), features());
    expect(v.level).toBe('Medium');
    expect(v.score).toBe('40');
  });

  it('names a blackspot when the spatial prior is high', () => {
    const v = buildVerdict(result({ spatialPrior: 0.8 }), features());
    expect(v.modelReasons).toContain('reason.blackspot');
  });

  it('does not name a blackspot when the prior is low', () => {
    const v = buildVerdict(result({ spatialPrior: 0.1 }), features());
    expect(v.modelReasons).not.toContain('reason.blackspot');
  });

  it('names speeding only when over the posted limit', () => {
    const over = buildVerdict(result(), features({ Bike_Speed: 60, Speed_Limit: 40 }));
    expect(over.modelReasons).toContain('reason.overLimit');
    const under = buildVerdict(result(), features({ Bike_Speed: 35, Speed_Limit: 40 }));
    expect(under.modelReasons).not.toContain('reason.overLimit');
  });

  it('names the behavioural factors the model actually weighs', () => {
    const v = buildVerdict(
      result(),
      features({ Wearing_Helmet: 'No', Biker_Alcohol: 1, Talk_While_Riding: 'Regularly' }),
    );
    expect(v.modelReasons).toContain('reason.noHelmet');
    expect(v.modelReasons).toContain('reason.alcohol');
    expect(v.modelReasons).toContain('reason.phone');
  });

  it('puts weather and night in watch-outs, never in model reasons', () => {
    const v = buildVerdict(
      result(),
      features({ Weather: 'Rainy', Road_condition: 'Wet', Time_of_Day: 'Night' }),
    );
    expect(v.watchOuts).toContain('watch.rain');
    expect(v.watchOuts).toContain('watch.wet');
    expect(v.watchOuts).toContain('watch.night');
    for (const key of v.watchOuts) expect(v.modelReasons).not.toContain(key);
  });

  it('never lets a watch-out key appear as a model reason', () => {
    const v = buildVerdict(result({ spatialPrior: 0.9 }), features({ Weather: 'Foggy' }));
    expect(v.modelReasons.every((k) => !k.startsWith('watch.'))).toBe(true);
    expect(v.watchOuts.every((k) => k.startsWith('watch.'))).toBe(true);
  });

  it('caps each list at three so the band stays readable', () => {
    const v = buildVerdict(
      result({ spatialPrior: 0.9 }),
      features({
        Wearing_Helmet: 'No', Biker_Alcohol: 1, Talk_While_Riding: 'Regularly',
        Smoke_While_Riding: 'Regularly', Bike_Speed: 90, Speed_Limit: 40,
        Weather: 'Rainy', Road_condition: 'Wet', Time_of_Day: 'Night',
      }),
    );
    expect(v.modelReasons.length).toBeLessThanOrEqual(3);
    expect(v.watchOuts.length).toBeLessThanOrEqual(3);
  });

  it('surfaces the placeholder flag', () => {
    expect(buildVerdict(result({ isPlaceholder: true }), features()).isPlaceholder).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm run test --workspace @rideguard/web
```

Expected: FAIL — `Failed to resolve import "@/lib/verdict"`.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/verdict.ts`:

```ts
import type { FeatureVector, ScorePointResponse } from '@rideguard/shared';
import type { MessageKey } from '@/i18n/messages/en';
import type { RiskLevel } from '@/lib/riskTokens';
import { fmt } from '@/lib/fmt';

/** Above this, the location's crash history is worth naming. */
const BLACKSPOT_PRIOR = 0.5;
const MAX_ITEMS = 3;

export interface Verdict {
  level: RiskLevel;
  /** 0..100 as a string, or null when there is no reading at all. */
  score: string | null;
  /** Factors that genuinely moved the score. */
  modelReasons: MessageKey[];
  /** Human advice the model does NOT account for. Never mixed with the above. */
  watchOuts: MessageKey[];
  isPlaceholder: boolean;
}

/**
 * Turn a scoring response into something a rider can read.
 *
 * The split between `modelReasons` and `watchOuts` is deliberate and load-
 * bearing (spec section 8). The audit of 2026-09-03 measured the shipped model
 * assigning wet roads a mean effect of -0.009 and night -0.013 — it reads them
 * as marginally *safer*. Presenting them as reasons for the score would
 * overclaim; dropping them would leave a safety app silent about riding in
 * heavy rain at night. So they ride along, clearly labelled as something else.
 */
export function buildVerdict(
  result: ScorePointResponse | null,
  features: FeatureVector,
): Verdict {
  const watchOuts = collectWatchOuts(features);

  // No reading is not a safe reading. Never fall back to 'Low'.
  if (!result) {
    return { level: 'Unknown', score: null, modelReasons: [], watchOuts, isPlaceholder: false };
  }

  return {
    level: result.advisoryLevel,
    score: fmt.pct(result.R),
    modelReasons: collectModelReasons(result, features),
    watchOuts,
    isPlaceholder: result.isPlaceholder,
  };
}

function collectModelReasons(r: ScorePointResponse, f: FeatureVector): MessageKey[] {
  const out: MessageKey[] = [];
  if (r.spatialPrior >= BLACKSPOT_PRIOR) out.push('reason.blackspot');
  if (f.Bike_Speed > f.Speed_Limit) out.push('reason.overLimit');
  if (f.Biker_Alcohol === 1) out.push('reason.alcohol');
  if (f.Talk_While_Riding !== 'Never') out.push('reason.phone');
  if (f.Wearing_Helmet === 'No') out.push('reason.noHelmet');
  if (f.Smoke_While_Riding !== 'Never') out.push('reason.smoking');
  return out.slice(0, MAX_ITEMS);
}

function collectWatchOuts(f: FeatureVector): MessageKey[] {
  const out: MessageKey[] = [];
  if (f.Weather === 'Rainy') out.push('watch.rain');
  if (f.Weather === 'Foggy') out.push('watch.fog');
  if (f.Road_condition === 'Wet') out.push('watch.wet');
  if (f.Time_of_Day === 'Night') out.push('watch.night');
  return out.slice(0, MAX_ITEMS);
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test --workspace @rideguard/web
```

Expected: PASS, 26 tests total.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/verdict.ts apps/web/src/lib/verdict.test.ts
git commit -m "feat: verdict builder separating model reasons from watch-outs"
```

---

## Task 6: The RiskVerdict component

**Files:**
- Create: `apps/web/src/components/RiskVerdict.tsx`

**Interfaces:**
- Consumes: `Verdict` (Task 5), `RISK_TOKENS` (Task 2), `useT` (Task 3)
- Produces: `<RiskVerdict verdict={Verdict} size="sm" | "md" | "lg" />`

> No unit test here by spec decision (section 12): this is presentational, and all
> of its logic lives in `verdict.ts` and `riskTokens.ts`, which are tested. Its
> gate is a successful build plus a visual check.

- [ ] **Step 1: Implement**

Create `apps/web/src/components/RiskVerdict.tsx`:

```tsx
'use client';

import { RISK_TOKENS } from '@/lib/riskTokens';
import { useLocale } from '@/i18n/LocaleContext';
import { en, type MessageKey } from '@/i18n/messages/en';
import { bn } from '@/i18n/messages/bn';
import type { Verdict } from '@/lib/verdict';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { pad: string; icon: string; title: string; sub: string }> = {
  sm: { pad: 'px-3 py-2', icon: 'text-lg', title: 'text-sm', sub: 'text-[10px]' },
  md: { pad: 'px-3 py-2.5', icon: 'text-xl', title: 'text-base', sub: 'text-[11px]' },
  lg: { pad: 'px-4 py-3', icon: 'text-2xl', title: 'text-xl', sub: 'text-xs' },
};

/**
 * The single source of truth for how a risk reading looks. Now, Route and Map
 * all render this, so the three screens cannot drift apart.
 *
 * Meaning is carried four ways — icon, Bengali word, English word, colour — so
 * that no single channel is load-bearing. Colour deficiency affects roughly 1
 * in 12 men, and a handlebar-mounted phone in daylight washes colour out.
 */
export function RiskVerdict({ verdict, size = 'md' }: { verdict: Verdict; size?: Size }) {
  const { locale } = useLocale();
  const token = RISK_TOKENS[verdict.level];
  const s = SIZES[size];

  // The four `risk.*.title` keys exist for every RiskLevel, so this is safe.
  const titleKey = `risk.${verdict.level}.title` as MessageKey;
  // Always show both scripts: the rider's own language leads, the other follows.
  const primary = (locale === 'bn' ? bn : en)[titleKey];
  const secondary = (locale === 'bn' ? en : bn)[titleKey];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl2 ${s.pad}`}
      style={{ background: token.surface, color: token.onSurface }}
      role="status"
      aria-live="polite"
    >
      <span className={`${s.icon} flex-none leading-none`} aria-hidden="true">
        {token.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className={`${s.title} font-bold leading-tight`}>{primary}</div>
        <div className={`${s.sub} font-semibold opacity-90`}>{secondary}</div>
      </div>

      {verdict.score !== null && (
        <div className="flex-none text-right leading-none opacity-90">
          <div className="font-mono text-base font-bold tabular">{verdict.score}</div>
          <div className="text-[9px]">/100</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

```bash
npm run build --workspace @rideguard/web
```

Expected: compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/RiskVerdict.tsx
git commit -m "feat: shared RiskVerdict band component"
```

---

## Task 7: Wire the verdict into Now, removing the false "Low"

**Files:**
- Modify: `apps/web/src/app/now/page.tsx` (lines 140, 200, 252)

**Interfaces:**
- Consumes: `buildVerdict` (Task 5), `RiskVerdict` (Task 6)
- Produces: nothing new — this is the first user-visible payoff

> This is the bug fix from spec 3.2. Today, when the scoring API is unreachable,
> `result` is null, `level` falls back to `'Low'`, and the app shows a calm green
> reading produced by having no data at all.

- [ ] **Step 1: Replace the display fallback**

In `apps/web/src/app/now/page.tsx`, delete the line at ~200:

```tsx
const level = result?.advisoryLevel ?? 'Low';
```

and put in its place:

```tsx
const verdict = buildVerdict(result, features);
const level = verdict.level;
```

Add the imports:

```tsx
import { buildVerdict } from '@/lib/verdict';
import { RiskVerdict } from '@/components/RiskVerdict';
```

- [ ] **Step 2: Fix the alert fallback**

At ~140, the same `?? 'Low'` feeds the "risk rose to High" alert, so a dead API can suppress or spuriously trigger it. Replace:

```tsx
const level = result?.advisoryLevel ?? 'Low';
if (ride.riding && level === 'High' && prevLevel.current !== 'High') {
```

with:

```tsx
// No result means no transition to announce — do not treat silence as 'Low'.
if (!result) return;
const level = result.advisoryLevel;
if (ride.riding && level === 'High' && prevLevel.current !== 'High') {
```

- [ ] **Step 3: Swap the ring for the band**

Replace the peek block that currently renders `<RiskRing …>` and the adjacent level pill (around line 252) with:

```tsx
<RiskVerdict verdict={verdict} size="lg" />
<p className="mt-2 truncate text-sm font-medium text-text">{locName}</p>
```

Then delete the now-unused local `RiskRing` function and the `BAND` constant from the bottom of the file.

- [ ] **Step 4: Guard the map pin**

`PointPickerMap` takes `level` for the pin tint and only accepts the three advisory levels. Pass undefined when unknown, so the pin falls back to its neutral blue:

```tsx
level={verdict.level === 'Unknown' ? undefined : verdict.level}
```

- [ ] **Step 5: Verify the fix by hand**

```bash
npm run dev --workspace @rideguard/web
```

With the API **not** running, open `http://localhost:3000/now`.
Expected: a grey band reading "CAN'T CHECK" / "তথ্য পাওয়া যায়নি" with no score — **not** a green "Low" at 0.
Then start the API (`node apps/api/dist/main.js`) and reload. Expected: a coloured band with a score.

- [ ] **Step 6: Confirm nothing else broke**

```bash
npm run test --workspace @rideguard/web
npm run build --workspace @rideguard/web
```

Expected: 26 tests pass; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/now/page.tsx
git commit -m "fix: show Unknown instead of Low when scoring is unavailable"
```

---

## Task 8: Language toggle

**Files:**
- Create: `apps/web/src/components/LanguageToggle.tsx`
- Modify: `apps/web/src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `useLocale` (Task 3), `Card` from `@/components/Card`
- Produces: `<LanguageToggle />`

- [ ] **Step 1: Build the toggle**

Create `apps/web/src/components/LanguageToggle.tsx`:

```tsx
'use client';

import { useLocale, type Locale } from '@/i18n/LocaleContext';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা' },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex gap-2" role="group" aria-label="Language">
      {OPTIONS.map((o) => {
        const active = locale === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setLocale(o.value)}
            aria-pressed={active}
            // min-h-11 keeps the 44px touch target from the spec.
            className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold transition ${
              active
                ? 'bg-signal text-white shadow-soft'
                : 'border border-line bg-panel2 text-text'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add it to Profile**

In `apps/web/src/app/profile/page.tsx`, add the import and place a new card directly after the "Account" card:

```tsx
import { LanguageToggle } from '@/components/LanguageToggle';
```

```tsx
<Card title="Language · ভাষা">
  <LanguageToggle />
</Card>
```

- [ ] **Step 3: Verify end to end**

```bash
npm run dev --workspace @rideguard/web
```

Open `http://localhost:3000/profile`, tap **বাংলা**, then go to **Now**.
Expected: the verdict band leads in Bengali with English beneath. Reload the page — the choice survives. Check `<html lang>` is now `bn` in devtools.

- [ ] **Step 4: Final checks**

```bash
npm run test --workspace @rideguard/web
npm run build --workspace @rideguard/web
```

Expected: 26 tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/LanguageToggle.tsx apps/web/src/app/profile/page.tsx
git commit -m "feat: English/Bengali language toggle"
```

---

## Phase 1 done — what ships

A rider can switch the app to Bengali; every risk reading appears as a colour-and-word
verdict that meets AA contrast; and the app now says "can't check" instead of quietly
reporting "Low" when the scoring service is down.

## Later phases (separate plans)

Each gets its own plan once its predecessor lands, so every phase is independently shippable.

- **Phase 2 — Now + ride mode.** Split `now/page.tsx` into `NowParked` / `RideMode` / `useNowScore`; full-screen ride takeover with speed dominant; move alert channels to Profile with a Test-alert button; unify the two save buttons.
- **Phase 3 — Route + Map.** OSRM `alternatives=true` and a ranked route picker; riskiest stretch named as a place; remove the A/B tap-target mode switch; replace `Fused R / Spatial π / Behaviour s` with plain cause; hotspots as soft blooms with the area-level caveat.
- **Phase 4 — Trips + Profile.** Month summary bar, ride cards, swipe-to-delete, restructured Profile sections.

## Blocking follow-up

Bengali copy in `messages/bn.ts` is **unverified**. It carries a `// TRANSLATION: unverified`
marker and must be reviewed by a native speaker before this reaches real riders
(spec Open Item 1).
