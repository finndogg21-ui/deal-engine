# Meta ads + conversion tracking — owner setup

_Built 2026-09-03 (terminal run). This is the bridge between "site launches" and
"automated ads don't waste money." Everything below is wired and shipped; it
stays a silent no-op until you set the env vars, so nothing breaks pre-launch._

## Why this exists

The Meta AI ad creator (and any Meta campaign) optimizes toward whatever you
report as a conversion. With **no** conversion signal it optimizes blind — it
will happily spend your limited budget driving free signups that never pay.
This wiring reports two real signals so Meta's AI chases paying members:

- **CompleteRegistration** (browser) — someone finished signup.
- **Purchase** (server, guaranteed) — someone actually paid $20. Fired from the
  Stripe webhook, not the browser, because iOS Safari + ad-blockers strip
  ~20-30% of browser events — and that's exactly your phone-heavy ad traffic.

## What to set (in Railway)

| Var | Where | Lifetime | Effect |
|---|---|---|---|
| `VITE_META_PIXEL_ID` | Railway **build** env | **Build-time** — needs a redeploy | Turns on the browser pixel (PageView, CompleteRegistration, InitiateCheckout) |
| `META_PIXEL_ID` | Railway runtime env | Runtime | Same pixel id; used by the server Purchase report |
| `META_CAPI_TOKEN` | Railway runtime env | Runtime | Turns on the server-side Purchase (Conversions API) |

**The build-time gotcha:** `VITE_META_PIXEL_ID` is inlined into the JS bundle at
build. Setting it in Railway's runtime-only env does nothing until the next
`redeploy --from-source`. Set it as a build variable, then redeploy.

### Get the values
1. **Pixel ID:** Meta Events Manager → Data Sources → your pixel → the ID is at
   the top (a long number).
2. **CAPI token:** same pixel → Settings → Conversions API → **Generate access
   token**. Paste into `META_CAPI_TOKEN`.

## How to verify it's working
- Browser: open the live site with Meta's **Pixel Helper** extension — you
  should see PageView fire, and CompleteRegistration after a test signup.
- Server: Events Manager → your pixel → **Test Events**, then run one real (or
  Stripe test-mode) checkout. A `Purchase` with `value: 20` should appear,
  source "server". The server logs `meta capi: Purchase reported for sub …`.

## The launch order this unlocks
1. Set the three vars + redeploy (this doc).
2. Post organically / run the one manual creative → watch CompleteRegistration
   and Purchase populate. Now you have a real cost-per-paying-member number.
3. **Only then** turn on the Meta AI auto-creator with Purchase as the
   optimization goal — it scales a funnel you've proven, not a guess.

## Files (for reference)
- `web/src/lib/track.ts` — browser pixel + funnel events (build-gated)
- `src/vendors/meta-capi.ts` — server Conversions API (runtime-gated)
- `src/api/routes/billing.ts` — fires Purchase on `customer.subscription.created`
- `web/src/pages/site/Auth.tsx` — fires CompleteRegistration on signup
- `web/src/pages/site/Pricing.tsx` — fires InitiateCheckout on checkout start
