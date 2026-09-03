# ☕ /coffee backlog — deal-engine

Living, per-focus list of gaps found but not yet shipped. Each cycle pulls the top item for its
focus and returns the rest. Ranked within a focus by leverage × (low) risk.

## mobile  ← ACTIVE FOCUS (owner directive 2026-09-02: the next few sessions are mobile design)
**THE BAR (owner, non-negotiable): mobile must be AS READABLE AND USABLE AS DESKTOP.** Not a
squished desktop — a first-class view on the receipt aesthetic. Same price hierarchy + contrast +
type scale, real 44px+ tap targets, and the deals deck / ZIP bar / store-chip rail all clean at
375px. Every mobile cycle's success test = "a reseller on a phone reads and acts on a deal as fast
as on desktop." Guardrails unchanged: THE RECEIPT / THE TAPE (pure B&W, 3 price accents, Archivo +
IBM Plex Mono, zero radius, --s1..--s9, weight ≤500; motion encodes change; respect prefers-reduced-motion).
Shipped 2026-09-02 (commit 66d9d4f, run 2026-09-02-mobile.md): **deal-card type restored at the
≤430px single-column breakpoint** — the six-up density shrink was leaving a 12.5px title / 9px
retailer / 10px facts on a FULL-WIDTH phone card; now title 16px, price 28px, secondary ≥13-14px,
clr-reveal ≥44px tap area. Verified live at 375px. The card is now as readable as desktop.

Shipped 2026-09-03 (commit f9898ef, run 2026-09-03-mobile.md): **mobile store rail shows retailer
NAMES not 2-letter codes** — the phone rail was showing "HD/TG/LW" where desktop shows full names
(worst-scoring audit area, 6.0); now "HOME DEPOT/TARGET/…" with 44px tap targets, generic icon
dropped. Verified live at 375px. Also shipped 2026-09-02 night: CTA-hide + gutter trim (density),
penny "start free"→"Create a free account", landing/HowItWorks honesty + zero-radius fixes, h3/h4
weight, sortbox 44px, search focus ring (batches 1beeeec/b2c6e3b/2f43641).

Shipped 2026-09-03 (commit 58f98c7): tightened mobile card vertical rhythm (gap --s2→--s1, dropped
wasted price min-height) → card 458px→433px. Modest. **Mobile is now at the low-risk floor** — the
375px measurement (this cycle) proved the remaining density wins are MEDIUM-risk and need owner sign-off:

Ranked (real levers, all MEDIUM-risk → owner-directed, not auto-shipped):
1. **Chrome reduction — THE lever.** 571px of chrome sits above the feed (header 194 + store rail 70
   + toolbar/spools 234 = 70% of the 812 viewport), so 0 deals are fully visible on load. Fix =
   collapse-on-scroll header, or move the ZIP bar / compact the toolbar on mobile. Shell-layout change.
2. **Card content height** — the price block is 71px (over-tall; likely an "as low as" label + wrap),
   card-facts 60px. Trim/clamp, but the facts carry honesty copy (margin, "check your store"). Careful.
3. **Right-hand thumbnail** card (research-preferred for a decision-by-numbers feed) — bigger restructure.
   NOTE: the image is only 25% of the card height, so this is lower-priority than #1/#2.
- Dead: ZIP-placeholder "clip" was a FALSE positive (measured zipClips:false); tap targets already ≥44px
  after the rail fix + sortbox/searchbox fixes. No low-risk items remain.
3. **Store-chip rail + ZIP bar on narrow screens** — horizontal-scroll rail ergonomics, sticky ZIP
   bar, no overflow/reflow jank at 320–414px.
4. **Deal card at 375px** — image/price/discount/store layout; keep the --cut/--save/--grail accents
   legible and the CTA thumb-reachable.
5. Carry-overs from the general design list below (animations, micro-interactions, edge states) —
   apply them MOBILE-FIRST while this focus is active.

## cybersecurity
Shipped 2026-09-02: COOP/CORP + no-store + upgrade-insecure-requests (10:03); `/api/candidates` +
`/api/candidates/:productId/:storeId` rate limits (12:17, commit 0fd12f5). See runs/.
Open — NOTE: cybersecurity is at diminishing returns; the 18:17 cycle was an honest NO-OP.
**RECOMMEND rotating the loop focus to `conversion` or `performance`** (CronDelete 1dee4526 → wire
`/coffee conversion`). Remaining items are moderate-risk / blocked:
1. **Session idle timeout** — BLUEPRINTED 18:17 (runs/2026-09-02-cybersecurity-1817.md). Needs a
   `last_seen_at` schema column → HIGH risk (schema+auth) = owner-approved only. Honest value for a
   consumer deal-finder: LOW–MODERATE (30-day absolute cap already bounds sessions). Not prioritized.
2. **CSP nonce/strict-dynamic** — currently `script-src 'self'` (acceptable for a static SPA, no inline). Strict ideal but higher effort for a static build. Low priority.
3. **Supply chain**: `.npmrc ignore-scripts=true`, `npm ci` + committed lockfile in CI, SCA (npm audit) each build. No CI yet + esbuild postinstall risk → blueprint when CI exists.
4. **Static-asset caching** — `/assets/*` is `public,max-age=0`; content-hashed files should be `immutable,max-age=1y`. This is a PERFORMANCE item → move to a `/coffee performance` cycle.

### 🔑 DOMAIN-SWAP — summitclearance.com LIVE 2026-09-02 (commit 17fc872)
DONE: custom domain live (cert issued, port 8080 OK); `__Host-` cookie prefix (verified
login/checkout/logout on the new domain); Stripe base-URL fallback → new domain; live_url updated.
OWNER TODO (Railway env vars — NOT a /coffee auto-ship): set `APP_URL` (unset → email links go to
localhost) and `PUBLIC_BASE_URL` both to `https://summitclearance.com`.
OPTIONAL/deferred (owner's call, not auto-shipped): HSTS `preload` (hard to reverse); wire Contact
page to `support@summitclearance.com` once email forwarding is on; force old Railway URL → new
domain redirect. CORS = same-origin, nothing to change.

## NEEDS-OWNER (not a code fix — external)
- Bot CAPTCHA provider (Turnstile/hCaptcha, free tier) — honeypot is in; CAPTCHA is the stronger layer.
- Confirm `MAIL_URL` is set in Railway or password-reset emails don't send (the app correctly refuses to log the token).

## design  (active focus as of 2026-09-02 evening — loop d4d95934)
Guardrails: everything MUST fit "THE RECEIPT / THE TAPE" (pure B&W, 3 price accents, Archivo + IBM
Plex Mono, zero radius, --s1..--s9, weight ≤500). Motion ENCODES CHANGE, never decorative. Respect
prefers-reduced-motion. The 20-flaw scan (2026-09-02) already found the site dodges 17/20 vibecoded
tells; 3 were fixed (dark-mode contrast, off-scale spacing, one buzzword). So design cycles hunt for
SUBTLE polish + purposeful motion, not gross flaws.
Seed items (each cycle researches + compares to find more):
1. **Purposeful animations** — add motion that encodes CHANGE, on the receipt system's terms:
   deal-card entrance stagger, price/stock/"reveal" state transitions, the penny/grail stamp. NOT
   fade-in-on-scroll, NOT hover-opacity. Start with the highest-traffic surface (the deals deck).
2. **Mobile / 375px polish** — the app is responsive (31 media queries) but not audited at 375px on
   the new domain; check tap targets (44px), the store-chip rail, the deal cards, the ZIP bar,
   overflow. (Overlaps with the mobile-support workstream.)
3. **Micro-interactions** — button press feedback (ink/bg inversion, not opacity), focus-visible
   polish, loading/skeleton states that match the receipt look.
4. **Empty/edge states** — make "no scan yet", locked/upgrade, and error states feel intentional.

## other foci (seeded for future cycles)
- **conversion**: the teaser → signup → $20 checkout funnel.
- **performance**: Web Vitals, bundle size, the static-asset caching above.
- **accessibility**: WCAG audit of the live site.
- **feed quality**: resale-margin ranking, dedupe, junk filtering.
