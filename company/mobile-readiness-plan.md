# 📱 Summit Clearance — Mobile Readiness Plan (2026-09-02)

From the mobile-scoping research (5 dimensions, OWASP/vendor/practitioner sources). **Unanimous
verdict: ship a PWA first, not native.** Escalate to React Native/Expo only if iOS push reach
later proves to be the growth ceiling. Skip fully-native entirely.

## Why PWA (for THIS stack: solo dev, responsive React 19 + Vite SPA, Express/Postgres, Stripe)
- Reuses ~100% of the existing web app (add a manifest + service worker; no UI rewrite).
- ~$0, no app-store fees ($99/yr Apple + $25 Google avoided), no review, ships on the same Railway
  git-push flow. v1 in DAYS, not weeks.
- Keeps the $20/mo Stripe billing off-store (no IAP 15-30% commission).
- A deal-feed "wrapper" native app is the textbook target of Apple's 4.2 minimum-functionality
  rejection — PWA sidesteps that entirely.
- **Auth untouched:** the same-origin `__Host-` httpOnly cookie session works as-is for a PWA. No
  token/refresh system needed (that's only for native later).

## The honest tradeoff to accept
Web push is weaker than native on iOS: it works only after the user taps **Add to Home Screen**
(iOS 16.4+), there's no auto install-prompt on iOS, and no rich/silent/background push. Android +
all desktop are fully supported with no install needed. → **Keep email as the reliable alert
fallback; treat iOS push as best-effort.**

## READINESS CHECKLIST (the concrete "getting ready" build — LOW risk, reuses everything)
1. **Installable PWA** — `npm i -D vite-plugin-pwa @vite-pwa/assets-generator` in web/; add
   `VitePWA({ registerType:'autoUpdate', manifest:{ name:'Summit Clearance', short_name:'Summit',
   display:'standalone', theme_color:'#000000', background_color:'#fafaf7', icons:[192/512/maskable] } })`
   to vite.config. **CRITICAL: `workbox.navigateFallbackDenylist:[/^\/api\//]` and DO NOT runtime-
   cache /api** — deals must be fresh (network-only for the API, precache only the shell). Add
   apple-touch-icon + theme-color to index.html. Icons from one B&W source (fits the receipt design).
2. **Web Push backend** — `npm i web-push`; `web-push generate-vapid-keys` once → store as Railway
   env vars; new Postgres table `push_subscriptions` (subscription JSON keyed to member user_id);
   an Express route to save a subscription; fire `webpush.sendNotification` from the alert pipeline
   (src/alerts/deliver.ts already builds alert payloads → add a web-push channel next to email).
3. **Frontend opt-in** — a gesture-triggered "Enable deal alerts" button (never on load); gate it
   behind `window.matchMedia('(display-mode: standalone)').matches`; for iOS show a one-time
   "Add to Home Screen to get alerts" nudge.
4. **This is high_risk-adjacent** (touches the alert pipeline + a new DB table = schema migration) →
   BLUEPRINT + owner greenlight before building; then ship in stages (PWA install first, push second).

## Escalation trigger (when to revisit native/Expo)
Only if paying members specifically demand rock-solid iOS background alerts / metrics show iOS push
conversion is the binding growth constraint. Then: Expo reuses React skills + the same Express API,
its push service is free, EAS free tier covers a solo dev; cost = $99/yr Apple + $25 Google + a full
UI rebuild + add a bearer-token layer alongside cookies (never replace them). Not justified now.

## DECISION FOR OWNER
Greenlight the PWA build? It's the highest-leverage mobile step, low-risk, reuses everything, and
makes "notification alerts" real. First stage (installable PWA, no push yet) is genuinely low-risk;
the push backend (new table + pipeline hook) is the stage that needs a schema migration.
