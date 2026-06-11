# Deploying RideGuard (Vercel + Render)

Three services:

| Service | Host | What |
| --- | --- | --- |
| `apps/web` (Next.js) | **Vercel** | the rider-facing site |
| `apps/api` (NestJS) | **Render** | scoring + trip logging API |
| `apps/model` (FastAPI) | **Render** | the trained Tier-1 model |

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
- `CORS_ORIGINS` = your Vercel URL — you'll get it in step 3, so set a placeholder now and
  come back. (You can temporarily set `*` to test, then lock it down.)

Copy the API URL, e.g. `https://rideguard-api.onrender.com`. Check `…/api/health` —
it should say `"scorer":"tier1-model"` (or `"placeholder"` on the mock).

---

## 3. Vercel — web app

1. Vercel → **Add New… → Project** → import your repo.
2. **Root Directory:** set to `apps/web`.
   - If Vercel asks, enable **"Include source files outside of the Root Directory"** (needed
     so the shared package builds). The included `apps/web/vercel.json` already sets the
     install/build commands.
3. **Environment Variables** → add:
   - `NEXT_PUBLIC_API_URL` = your API URL **plus `/api`**, e.g.
     `https://rideguard-api.onrender.com/api`
   (This is read at build time, so set it before deploying.)
4. **Deploy.** Copy the resulting site URL, e.g. `https://rideguard.vercel.app`.

---

## 4. Close the loop (CORS)

Go back to **rideguard-api** on Render → Environment → set:

- `CORS_ORIGINS` = your Vercel URL, e.g. `https://rideguard.vercel.app`

Save (the API redeploys). Done.

---

## 5. Test

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
- **OpenStreetMap services:** search (Nominatim) and routing (OSRM) use free public
  endpoints with rate limits — fine for light use, not production traffic. Swap the base URLs
  in `apps/web/src/lib/geocode.ts` and `routing.ts` for a paid provider if you scale.
- **Updating:** push to `main` and both Render services + Vercel auto-redeploy.
