# Deploying RideGuard (Vercel + Render)

Four pieces:

| Service | Host | What |
| --- | --- | --- |
| `apps/web` (Next.js) | **Vercel** | the rider-facing site |
| `apps/api` (NestJS) | **Render** | scoring + trip logging API |
| `apps/model` (FastAPI) | **Render** | the trained Tier-1 model |
| auth + user data | **Supabase** | sign-in, rider profiles, saved trips |

> **Supabase is not optional.** The app redirects every unauthenticated visitor
> to `/login`, so without it you get a site nobody can get past. Set it up in
> step 3 below.

The browser also calls OpenStreetMap (tiles, search, routing) and Open-Meteo directly —
those need no setup.

> Cost note: Render's **free** plan sleeps after ~15 min idle, so the first request after
> a nap is slow (cold start), and the model service is memory-heavy. You can deploy the web
> + API on the **mock scorer first** (skip the model) and add the model later — the API
> falls back to the mock automatically when `MODEL_SERVICE_URL` is unset.

---

## 0. Put the code on GitHub

Render and Vercel deploy from a Git repo.

```bash
cd rideguard
git init
git add .
git commit -m "RideGuard"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/rideguard.git
git branch -M main
git push -u origin main
```

The trained model lives in `apps/model/artifacts/` and **is committed** (it's small), so the
model service runs without the dataset.

---

## 1. Render — model service (do this first)

1. Render dashboard → **New + → Blueprint** → pick your repo. Render reads `render.yaml`
   and proposes **rideguard-api** and **rideguard-model**.
2. Click **Apply**. Both services start building.
   - If you'd rather not run the model yet, you can delete/suspend `rideguard-model` and
     skip to step 2 — the API will use the mock.
3. When `rideguard-model` is **Live**, copy its URL, e.g.
   `https://rideguard-model.onrender.com`. Open `…/health` to confirm it returns JSON.

> If the model service crashes with an out-of-memory error on the free plan, upgrade it to
> **Starter**, or leave `MODEL_SERVICE_URL` unset on the API to use the mock.

---

## 2. Render — API service

The Blueprint already created **rideguard-api**. Set its env vars
(Service → **Environment**):

- `MODEL_SERVICE_URL` = your model URL from step 1 (e.g. `https://rideguard-model.onrender.com`).
  Leave blank to use the mock scorer.
- `CORS_ORIGINS` = your Vercel URL — you'll get it in step 4, so set a placeholder now and
  come back. Prefer `http://localhost:3000` as the placeholder over `*`: the API accepts
  anonymous trip posts, so a wildcard origin invites junk into your dataset.
- `RIDER_ID_SALT` = the HMAC key that pseudonymises rider ids before storage. The Blueprint
  generates one for you; don't change it later, or previously stored ids stop matching.
- `ADMIN_TOKEN` = **leave unset** unless you need to pull the collected trips. Setting it
  enables `GET /api/trips` and `GET /api/trips/:id`, which return every rider's stored trip;
  callers must send the value as an `x-admin-token` header. While unset, both endpoints
  refuse with 403.

Copy the API URL, e.g. `https://rideguard-api.onrender.com`. Check `…/api/health` —
it should say `"scorer":"tier1-model"` (or `"placeholder"` on the mock).

---

## 3. Supabase — auth, profiles, trip history

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. **SQL Editor** → run this once. It creates the two tables the app reads and
   writes, and the Row-Level Security policies that keep each rider's rows
   private to them:

```sql
-- Rider profiles: one row per user, holding the RiderProfile JSON.
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "own profile: read"   on public.profiles
  for select using (auth.uid() = id);
create policy "own profile: write"  on public.profiles
  for insert with check (auth.uid() = id);
create policy "own profile: update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Saved trips shown on the Trips screen.
create table public.trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  risk       double precision,
  advisory   text,
  lat        double precision,
  lon        double precision,
  data       jsonb
);
alter table public.trips enable row level security;

create policy "own trips: read"   on public.trips
  for select using (auth.uid() = user_id);
create policy "own trips: write"  on public.trips
  for insert with check (auth.uid() = user_id);
create policy "own trips: delete" on public.trips
  for delete using (auth.uid() = user_id);

create index trips_user_created_idx on public.trips (user_id, created_at desc);
```

3. **Authentication → Providers → Email**: decide whether to require email
   confirmation. With confirmation *on*, `signUp` returns no session and the app
   tells the rider to check their inbox. With it *off*, they go straight to the
   map.
4. **Settings → API**: copy the **Project URL** and the **anon public** key for
   step 4. The anon key is safe to expose — the RLS policies above are what
   actually enforce access.

---

## 4. Vercel — web app

1. Vercel → **Add New… → Project** → import your repo.
2. **Root Directory:** set to `apps/web`.
   - If Vercel asks, enable **"Include source files outside of the Root Directory"** (needed
     so the shared package builds). The included `apps/web/vercel.json` already sets the
     install/build commands.
3. **Environment Variables** → add:
   - `NEXT_PUBLIC_API_URL` = your API URL **plus `/api`**, e.g.
     `https://rideguard-api.onrender.com/api`
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL from step 3.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key from step 3.

   (These are read at build time, so set them before deploying.)
4. **Deploy.** Copy the resulting site URL, e.g. `https://rideguard.vercel.app`.

---

## 5. Close the loop (CORS)

Go back to **rideguard-api** on Render → Environment → set:

- `CORS_ORIGINS` = your Vercel URL, e.g. `https://rideguard.vercel.app`

Save (the API redeploys). Done.

---

## 6. Test

Open your Vercel URL and check:

- The gauge loads and the three metric tiles fill in (the web app reached the API).
- `…/api/health` on the API shows the right `scorer`.
- The Map tab shows hotspots; Route draws a road line; Now's "Start ride" asks for location.

---

## Notes & gotchas

- **`NEXT_PUBLIC_API_URL` must end in `/api`** — the NestJS routes live under that prefix.
- **Cold starts (free plan):** the first hit after idle can take 30–60s while Render wakes
  the API and model. Upgrade to Starter to keep them warm.
- **Trip logs are ephemeral** on Render's disk (the file repository resets on redeploy/sleep).
  For durable logs, swap `FileTripsRepository` for a database (see the root README).
- **Pulling the collected trips:** with `ADMIN_TOKEN` set,
  `curl -H "x-admin-token: $ADMIN_TOKEN" https://<api>/api/trips`. Riders who declined the
  "Include my GPS trail" consent have every coordinate zeroed — trace, origin, destination and
  incident point — so those records carry risk values and context only.
- **Swagger** (`/api/docs`) is served outside production only. To expose it on Render, set
  `ENABLE_API_DOCS=true`.
- **Model cold starts:** the API waits `MODEL_TIMEOUT_MS` (default 30s) and retries once, so
  the first ride after the model service naps still gets a real score rather than the mock.
- **OpenStreetMap services:** search (Nominatim) and routing (OSRM) use free public
  endpoints with rate limits — fine for light use, not production traffic. Swap the base URLs
  in `apps/web/src/lib/geocode.ts` and `routing.ts` for a paid provider if you scale.
- **Updating:** push to `main` and both Render services + Vercel auto-redeploy.
