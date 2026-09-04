# 🚦 Launch readiness — Summit Clearance

_Single source of truth. Updated live during the 24h run (2026-09-03).
Target: **Monday 2026-09-07.** Everything below is verified on the live site
unless marked otherwise._

## Verdict: **GREEN for soft launch.** Two owner actions gate a paid-ad launch.

---

## ✅ Shipped + live tonight (all on summitclearance.com)

| Area | What | Evidence |
|---|---|---|
| Mobile density | First deal 640px → **443px** at 375×812; 2 full cards above fold | measured live |
| Hidden clearance | First-class track; only on stores with a real pipeline (HD); honest store-scoped counts | verified target/HD/global |
| Mobile Safari | dvh, safe-area insets, viewport-fit=cover (blind-safe pass) | no regression at 375px; **owner device-test pending** |
| Console cleanliness | Killed the 402 errors non-members saw on the feed | 0×402 on preview load |
| SMS alerts | Full frame: outbox, phone-verify, opt-in, register-find texts | routes 402-gate correctly; **needs Twilio env** |
| Amazon | Comp columns + ingest stub + honest card line | `npm run amazon:comps` reports 4,871 deals awaiting comps |
| Conversion tracking | Pixel funnel + server-side CAPI Purchase | no-op verified; **needs Meta env** |
| Deal feed | 12 published deals (HD 8, BestBuy 3, Woot 1), signup works (201) | live e2e |

## 🔴 Owner actions before a PAID-AD launch (only you can do these)

1. **Device-test mobile on your actual phone** — I made every known-Safari-killer
   fix blind, but I can't see real iOS. 10 minutes with your phone on
   summitclearance.com/app. Most likely to embarrass a launch if skipped.
2. **Pick the hidden-clearance source** — Scrapfly $30/mo (proven) OR the cloak
   self-scan ($0, held 600/600 today but unproven across days). Either turns the
   moat feed on. See `launch-strategy-2026-09.md` §3.
3. **Set Meta env vars** (protects ad spend) — `VITE_META_PIXEL_ID` (build),
   `META_PIXEL_ID` + `META_CAPI_TOKEN` (runtime), then redeploy. See
   `meta-ads-setup.md`.

## 🟡 Fast-follow (not launch-blocking)

- **Twilio** for SMS — set `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM`; frame goes live
  with no code change. A2P 10DLC registration takes days, so start it early.
- **Amazon comps** — set a source key (`retailerapi` free tier is the cheap
  path; Keepa ~EUR49/mo blows the $50 cap). Card UI already ships.

## 📉 The honest economics (from launch-strategy §2)

- Net per member: **$19.12** ($20 − Stripe fee).
- Fixed cost at launch: **~$41/mo** (Scrapfly $30 + Railway $10 + domain) — or
  **~$11/mo** if the cloak self-scan holds (break-even drops 3 members → 1).
- Real money ($500+/mo ≈ 28 members) is a **3–6 month** horizon, base case.
- The model is robust to cost, **fragile to week-1 churn** — a thin feed on
  launch day is the real risk, which is why hidden-source (#2) matters most.

## The launch sequence I'd run (matches your capital-constrained plan)

1. Owner: device-test + pick hidden source + set Meta env → redeploy.
2. Organic posts to reseller channels (Higgsfield for creative) — $0.
3. One manual ad → read the real cost-per-paying-member.
4. **Only then** turn on the Meta AI auto-creator with **Purchase** as the goal
   (the server CAPI event) — scales a proven funnel, not a guess.
