# RideGuard

**A riding-safety helper for Dhaka motorcyclists.** RideGuard shows how risky a ride looks right
now — before and during your trip — on a live map, and warns you out loud about risky moments while
you ride. It works in your phone's browser, like a lightweight app.

> 🧪 **The model behind it:** research code, benchmarks and the leakage audit are in [RideGuard_V1](https://github.com/rakib4123/RideGuard_V1). Paper presented at **IEEE COMPAS 2026**.

> ⚠️ **Please read:** RideGuard is a **safety guide, not a guarantee.** It points out when to be
> extra careful, but it can't predict crashes. Always ride to the conditions, follow traffic laws,
> and wear your gear.

---

## Try it

👉 **[Open RideGuard](https://ride-guard-web-app-web.vercel.app)**

Works best on a phone. The first time you open it after a while it may take ~30–60 seconds to wake
up — just wait and refresh once.

---

## How to use it

### 1. Open it — no account needed
Use RideGuard straight away as a guest. Sign in (email and password) only if you want to save your
rides and see them later on the **Trips** screen.

### 2. Nothing to fill in
RideGuard asks you nothing about yourself. Your speed, the speed limit, the road, the weather,
the time and the traffic are all measured by your phone.

### 3. The four screens (bottom bar)

- **Now** — your live risk on a full map. A colored ring shows the reading:
  🟢 **Low** · 🟡 **Medium** · 🔴 **High**. Almost everything fills in automatically (your location,
  speed, weather, road, traffic).
- **Route** — pick a start and destination to see your route colored by risk, so you can choose a
  safer way.
- **Map** — tap anywhere in Dhaka to check the risk there, with crash-hotspot areas highlighted.
- **Trips** — your saved rides, so you can look back at where and when risk was high.

### 4. Start a ride
On the **Now** screen, tap **Start ride**. RideGuard then tracks your speed and location and alerts
you — by sound, voice, and vibration — when it matters:

- 📵 you're touching your phone while moving,
- 🚀 you're going over the speed limit,
- ⚠️ you're entering a known crash blackspot.

Tap **Stop ride** when you're done. You can save the ride to **Trips** to review later.

> Set everything up **before** you ride. Once you tap Start, let the sound and vibration alerts do
> the talking — don't look at the screen while riding.

---

## Tips

- **Allow location** when your browser asks — that's how the map follows you and reads your speed.
- **Allow sound** (tap Start ride from a tap, not in silent mode) so voice and beep alerts work.
- The **Sound / Voice / Buzz** toggles on the Now screen let you turn each alert type on or off.
- **People around you** (Profile): switch on sharing to count other RideGuard riders near you,
  and Bluetooth scanning (Android Chrome with *Experimental Web Platform features* on in
  `chrome://flags`) to count other phones. Phones on the same bus count as one.
- **Add it to your home screen** (your browser's "Add to Home Screen") to open it like a normal app.

---

## Disclaimer

RideGuard is a research and educational project. Its readings are not a substitute for safe riding,
traffic laws, protective gear, or your own judgement.

*Developers: setup and deployment details are in [DEPLOY.md](./DEPLOY.md).*

## License

MIT — see [LICENSE](./LICENSE).
