# RideGuard — rider-first redesign

**Date:** 2026-09-03
**Status:** approved design, ready for implementation planning
**Scope:** `apps/web` — all five screens, plus two functional changes agreed during design

---

## 1. Why

RideGuard's current UI is built around a numeric risk score and technical vocabulary
(`Fused R`, `Spatial π`, `Behaviour s`, `Mean / P90 / Max`). That serves a technical
reviewer. It does not serve the stated user: a motorcyclist in Dhaka, sometimes with the
phone mounted on the handlebars, sometimes in a pocket, who needs one question answered in
about a second — *should I be more careful right now?*

A second motivation comes from the dataset and model audit (2026-09-03). The shipped
model's counterfactual behaviour is weak in ways the UI currently hides: across 3,000
simulated riders, rain moves the score by a mean of −0.009, taking a helmet off is read as
*safer* for 10.2% of riders, and a +20 km/h speed increase has zero mean effect. Leading the
interface with a two-digit number implies a precision the model does not have. A colour,
an icon and a word are an honest representation of what this model can actually tell a rider.

### Goals

1. A rider can read the current advisory in one glance, in daylight, without stopping.
2. The app works for Bengali and English readers.
3. The interface never claims more certainty than the model supports.
4. Technical detail stays reachable, one tap away, for the thesis defence.

### Non-goals

- Retraining or modifying the model. (Recommended separately — see §11.)
- Changing the fusion maths, thresholds, or the API's scoring contract.
- Native app packaging, offline mode, or push notifications.

---

## 2. Decisions taken during design

| # | Decision | Chosen |
|---|---|---|
| 1 | Primary audience | Real riders in Dhaka |
| 2 | Phone placement | Mixed — glanceable when mounted, never *required* to look |
| 3 | Scope | Full redesign of all five screens |
| 4 | Language | Bengali + English, switchable |
| 5 | Information hierarchy | Verdict first; number subordinate |
| 6 | Number on main view | Verdict + one quiet score (`40/100`) |
| 7 | Ride view | Speed dominant, map dimmed |
| 8 | Route | Score 2–3 alternatives and rank them |
| 9 | Trips | Month summary bar + ride cards |
| 10 | Reasons | Split: model factors vs. human watch-outs |
| 11 | Save | One button |

---

## 3. Design system

### 3.1 The four states

Every risk reading is expressed through **four redundant channels** — icon, Bengali word,
English word, colour — so that no single channel is load-bearing. Roughly 1 in 12 men has
red–green colour deficiency, and a handlebar-mounted phone in Dhaka daylight washes colour
out; colour is reinforcement, never the sole signal.

| State | Icon | Bengali | English | Surface | Text on it | Contrast |
|---|---|---|---|---|---|---|
| Low | ✓ | রাস্তা স্বাভাবিক | CLEAR | `#0B7A43` | white | 5.41 : 1 |
| Medium | ⚠ | সতর্ক থাকুন | BE CAREFUL | `#E08600` | ink `#0B1220` | 6.76 : 1 |
| High | ⛔ | ঝুঁকি বেশি — ধীরে চলুন | HIGH RISK — SLOW DOWN | `#D92D20` | white | 4.83 : 1 |
| **Unknown** | — | তথ্য পাওয়া যায়নি | CAN'T CHECK | `#5B6675` | white | 5.92 : 1 |

Every pairing clears WCAG AA for normal text (4.5 : 1), measured, not assumed.

**Amber takes dark text, not white.** This is the one asymmetry in the system and it is
forced by physics: no amber light enough to read as amber can carry white text. `#E08600`
on white is **2.77 : 1**, failing even the 3 : 1 large-text threshold. Pairing it with ink
instead gives 6.76 : 1. Implementations must therefore read the foreground colour from the
token, never assume white.

For reference, the palette being replaced fails throughout: `#12B76A` / white = 2.62 : 1,
`#F79009` / white = 2.35 : 1, `#F04438` / white = 3.76 : 1 — all below AA for normal text.

> **Open item.** The Bengali strings above were drafted by Claude and have **not** been
> checked by a native speaker. They must be reviewed before implementation. `রাস্তা স্বাভাবিক`
> in particular may read stiffly; `স্বাভাবিক` alone may be better.

### 3.2 The Unknown state is not optional

`apps/web/src/app/now/page.tsx` currently reads:

```ts
line 140:  const level = result?.advisoryLevel ?? 'Low';   // feeds alert logic
line 200:  const level = result?.advisoryLevel ?? 'Low';   // feeds the display
line 252:  <RiskRing value={result?.R ?? 0} ... />
```

When the scoring API is unreachable, `result` is null and the app renders **"Low risk", ring
at 0** — a reassuring reading produced by having no data at all. A safety tool must fail
loud, not calm. Both `?? 'Low'` defaults are replaced by an explicit `'Unknown'` state, and
the alert logic must not fire "risk dropped" transitions off a missing result.

### 3.3 Typography

`Inter` and `Space_Grotesk` (currently loaded in `app/layout.tsx`) ship no Bengali glyphs, so
Bengali silently falls back to a system font and conjuncts break on Android.

- Replace body + display with **Hind Siliguri** (`next/font/google`, `subsets: ['latin','bengali']`).
- Keep `JetBrains_Mono` for numeric readouts only.
- Bengali needs more line-height than Latin: body `line-height: 1.65` where Latin uses 1.5.

### 3.4 Numerals

Always Western digits (`45`, not `৪৫`), in both locales, via a single `fmt` helper. Every
speedometer, road sign and odometer in Bangladesh uses Western digits; matching the bike's
own dial matters more than script consistency.

### 3.5 Touch targets

Minimum 44×44 px for anything tappable. The current alert-channel buttons (three ~24 px
letter buttons on the Now sheet) violate this and are removed — see §7.

---

## 4. Now screen

Splits into two states. The rider's situation is genuinely different in each.

### 4.1 Parked

```
┌─────────────────────────────┐
│ 🔍 Mohakhali      [EN] (RH) │  search · language · account
│                             │
│         ~ map ~             │  roads coloured by risk
│                             │
├─────────────────────────────┤
│ ⚠  সতর্ক থাকুন        40/100 │  RiskVerdict (large)
│    BE CAREFUL               │
│                             │
│ Why: crash blackspot 200 m  │  model reasons
│ Watch out: wet road, night  │  human watch-outs
│                             │
│ ┌─────────────────────────┐ │
│ │    ▶  Start ride        │ │  single dominant action
│ └─────────────────────────┘ │
│      Why this reading? ▾    │
└─────────────────────────────┘
```

The **"Why this reading?"** drawer holds everything technical: behaviour score, spatial
prior, fused R, top SHAP factors, conformal set, the trip-condition toggles
(`TripTogglesPanel` — helmet, alcohol, smoking, phone use), consent checkboxes and Save.

### 4.2 Riding

Full-screen takeover on Start. The entire background becomes the verdict colour.

```
┌─────────────────────────────┐
│                             │
│      ⚠  BE CAREFUL          │
│         সতর্ক থাকুন           │
│                             │
│            52               │  ~74px, tabular
│           km/h              │
│      ( limit 40 )           │
│                             │
│ ┌─────────────────────────┐ │
│ │      ■  STOP RIDE       │ │  ≥56px tall, thumb reach
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

Rules for this state:

- No tab bar, no search, no map interaction, no text below 12 px.
- **No risk score.** A number the rider cannot act on while moving is a distraction.
  Speed is shown because speed is the one variable they control.
- Map is dimmed to ~28% opacity as a background hint only.
- Alerts (sound / voice / vibration) continue to work exactly as today; the visual layer
  is a bonus for mounted riders and is never the only channel.

---

## 5. Route screen

- Two plain stacked inputs (origin, destination). **The "Map tap sets: Start (A) / End (B)"
  mode toggle is removed** — tapping the map moves the nearest pin instead. Modal
  targeting is a reliable source of wrong-pin errors.
- One `RiskVerdict` for the whole trip, with distance and duration.
- **The riskiest stretch is named as a place**, not as "point #217". Requires reverse-geocoding
  the riskiest segment and describing a span ("Mohakhali flyover approach · 2.1 km").
- `Mean / P90 / Max` move into the breakdown drawer, retained for the paper.

### 5.1 Route alternatives (functional change)

`apps/web/src/lib/routing.ts:26` takes `data.routes?.[0]` and discards the rest. OSRM returns
alternatives when called with `alternatives=true`.

- Request up to 3 routes, score each via the existing `POST /score/route`.
- Rank by fused risk; present as selectable rows:
  *"Safer route — 6 min longer, avoids the Mohakhali blackspot."*
- Selecting a row redraws the map and updates the verdict.
- If OSRM returns only one route, the picker is hidden entirely (no empty state).

This is the change that turns Route from a readout into something that alters a decision.

---

## 6. Map screen

- Same `RiskVerdict` component, sized medium.
- `Fused R / Spatial π / Behaviour s` are **removed from the rider view** and replaced with
  one sentence of plain cause: *"This area has a heavy crash history. Your riding style is a
  smaller part of it here."* The three values stay in the drawer.
- Hotspots render as **soft radial-gradient blooms**, not hard-edged circles.
- A standing note: *"Blackspots are area-level, roughly street accurate — not exact points."*

The bloom and the note are an integrity fix, not decoration. The audit found 40,387 crash
records resolving to only 1,092 distinct coordinates, because coordinates are geocoded
place-name centroids — the top hotspot is the centroid of the entire Dhaka–Mymensingh
Highway, with 2,580 records stacked on one point. A crisp circle claims a spatial precision
the data does not have.

---

## 7. Trips and Profile

### 7.1 Trips

- **Month summary bar:** ride count, total km, and a stacked bar of clear / careful /
  high-risk counts. Strictly descriptive — counts of what the app read, nothing inferred.
- **Ride cards:** verdict colour stripe, endpoints as place names, timestamp, the reason it
  scored that way, and the score.
- Delete moves to swipe-to-delete, removing the permanent Delete button beside every row.

Explicitly **not** included: trends, streaks or coaching ("your risk is trending down").
With no crash outcomes recorded anywhere, a downward trend means the app's own score moved,
not that the rider got safer. That is precisely the claim the About page is careful to avoid.

### 7.2 Profile

Restructured into labelled sections:

1. **Alerts** — sound / voice / vibration as full-width labelled switches, plus a
   **"Test alert now"** button. Safety-relevant: browsers block audio without a user
   gesture, and a rider must be able to confirm alerts work *while parked* rather than
   discover the failure mid-ride.
2. **Language · ভাষা** — EN / বাংলা toggle.
3. **Rider profile** — the six demographic fields.
4. **What RideGuard can and cannot do** — link to About, styled as a standing caution.

### 7.3 Save unification (functional change)

The Now sheet currently offers **"Save trip"** (posts to the NestJS API) and **"Save to my
trips"** (inserts a Supabase row). They read as synonyms, write to different stores, and only
the Supabase one appears on the Trips screen.

Replaced by one **"Save this ride"** which always writes the Supabase row, and additionally
posts the research record to the API when the logging-consent box is ticked. The consent
checkboxes govern only the research copy.

---

## 8. Reasons: model factors vs. watch-outs

Two visually distinct lines, never merged:

- **"Why this reading"** — only factors that genuinely moved the score: crash blackspot
  proximity (spatial prior), over the speed limit, phone use, alcohol, no helmet, smoking.
  Sourced from `topFactors` plus spatial prior and the speed comparison.
- **"Also watch out for"** — rain, wet road, fog, night. Human advice, *not* model output.

This split exists because the audit showed the model assigns wet roads ≈ −0.009 and night
≈ −0.013 — it reads them as marginally *safer*. Presenting them as model reasons would
overclaim; omitting them entirely would leave a safety app silent about riding in heavy rain
at night. The split is honest and still useful.

`lib/verdict.ts` owns this mapping: `ScorePointResponse` + context → `{ level, score,
modelReasons[], watchOuts[], isPlaceholder }`, with every reason a translation key, never a
raw string. The headline text is not part of this shape — it is derived from `level` at render
time by `RiskVerdict`, so the mapping stays language-agnostic and testable without i18n.

---

## 9. Internationalisation

A dependency-free layer, sized to the problem (~150 strings, 5 screens):

- `src/i18n/messages/en.ts` and `bn.ts` — typed as `Record<MessageKey, string>` so a missing
  key is a compile error.
- `LocaleContext` + `useT()`; choice persisted to `localStorage` and mirrored to the Supabase
  profile so it follows the rider across devices.
- `<html lang>` updates with the locale.

`next-intl` is rejected: it expects `[locale]` route segments or middleware, restructuring the
App Router for no benefit at this size.

**Layout constraint:** Bengali strings run roughly 20–30% longer than their English
equivalents. Every label must be tested in Bengali; no fixed-width text containers.

---

## 10. Component structure

### New

| File | Purpose |
|---|---|
| `components/RiskVerdict.tsx` | The band. Sizes `sm` / `md` / `lg`. Rendered by Now, Route and Map. Single source of truth for how a reading looks. |
| `lib/riskTokens.ts` | The colour / icon / label triple per level. Consumed by `RiskVerdict` and by `TripCard`, which shows only a colour stripe rather than a full band. |
| `components/RideMode.tsx` | Full-screen riding takeover. |
| `components/AlertSettings.tsx` | Labelled switches + Test alert. |
| `components/TripCard.tsx`, `MonthSummary.tsx` | Trips screen. |
| `components/RoutePicker.tsx` | Ranked alternatives list. |
| `lib/verdict.ts` | Score → level, score, model reasons, watch-outs. Language-agnostic. |
| `lib/fmt.ts` | Numbers, distances, durations. |
| `i18n/` | Context, hook, catalogues. |

### Refactored

`app/now/page.tsx` is **406 lines** and currently owns location, weather, scoring, the road
overlay, ride sensing, alerts, consent and two save flows. Adding a second full-screen state
to it would make it unmaintainable. It splits into:

- `app/now/page.tsx` — state selection only (parked vs riding)
- `components/NowParked.tsx`
- `components/RideMode.tsx`
- `hooks/useNowScore.ts` — location, weather, debounced scoring, road overlay

Existing `RiskGauge` is already deleted. `AdvisoryBadge` is superseded by `RiskVerdict` and
should be removed once no screen references it.

---

## 11. Error handling

| Condition | Behaviour |
|---|---|
| Scoring API unreachable | `Unknown` state, grey, "Can't check right now". Never `Low`. |
| Model service on mock (`isPlaceholder`) | Visible label on the verdict: "sample reading", not the current 6 px "· sample". |
| Geolocation denied | Map centres on Dhaka; verdict shows `Unknown` with "Turn on location to get a reading". |
| Weather fetch fails | Watch-outs omitted. Never blocks the verdict. |
| OSRM fails | Existing straight-line fallback, labelled; alternatives picker hidden. |
| Nominatim fails | Fall back to coordinates for place names. |

---

## 12. Testing

Vitest, on pure logic only:

- `lib/verdict.ts` — level thresholds, the `Unknown` fallback, model-reason vs watch-out
  routing, and that no watch-out ever appears as a model reason.
- `lib/fmt.ts` — Western digits in both locales.
- **Catalogue completeness** — every `MessageKey` present in both `en` and `bn`. This is the
  test that stops a missing Bengali string reaching a rider.

No component-render tests; at this size they would cost more than they catch. Existing API
tests (19, `apps/api/test/`) are unaffected.

---

## 13. Out of scope, recommended separately

1. **Retrain with monotonic constraints** so removing a helmet cannot lower the score and
   rain cannot raise safety. CatBoost supports `monotone_constraints`. This is the real fix
   for §8; the UI split is a mitigation, not a cure.
2. **Correct the Map footer**, which claims the crash data covers "2007–2024". The delivered
   file ends in 2021.
3. **Supabase JWT verification** on the API's admin endpoints, replacing the shared token.

---

## 14. Open items

1. **Bengali copy needs native review** before implementation — all state words, button
   labels and reason strings.
2. Reverse-geocoding a route's riskiest *stretch* (not point) needs a rule for how far to
   extend the span; propose ±1 km around the riskiest segment, merged if adjacent segments
   share a level.
