# 🌙 Overnight site audit + improvement pass — 2026-09-02

Owner directive: agents audit every page (rate /10 + improvements) → vet into instructions →
deploy the safe ones (keep secure) → review; product /loop scans concurrently. No questions.

## Phase 1 — AUDIT (workflow wd5725y2h, 10/11 areas; deal-detail agent errored, re-audit direct)
Avg **7.2/10**. Worst→best: shell-nav 6.0, landing 6.3, penny 6.5, deals-feed 7.2, pricing 7.5,
marketing 7.5, deal-components 7.5, amazon 7.5, auth 8.0, tokens 8.0.

## Phase 2 — INSTRUCTIONS (vetted, ranked; risk-gated)

### SHIP TONIGHT — low-risk, in-constitution, high-impact
**A. Mobile density (owner's #1 concern):**
- A1. Hide the redundant `.card-cta` "See this deal" on phones — the whole card is already a
  `<button>`, the 46px sticker halves deals-per-screen at 2-up. (dashboard.css mobile block) ✅ ship
- A2. Trim `.dash` side padding at ≤430px (--s5→--s3) so 2-up cards get more width. ✅ ship
- A3. Sidebar: show real retailer NAMES on mobile (not "HD/TG" codes) + drop generic STORE_ICON +
  raise chips to 44px + overflow affordance. (sidebar.css + Sidebar.tsx) ✅ ship (verify)

**B. Zero-radius constitution (leaked back in, very visible):**
- B1. Reset `.card-deal` border-radius to 0 (TAPE layer never reset the base --r-lg) + `.empty`
  `.pill` `.cell` `.actions button` `.storechip` `.fs`. (dashboard.css) ✅ ship
- B2. landing.css `.step-n`(50%) `.who-card` `.who-tag`; HowItWorks step badge (inline 50%). ✅ ship

**C. Heading-weight ≤500 constitution (global + spots):**
- C1. styles.css h3/h4 600→500 (source of truth, affects site-wide). ✅ ship
- C2. dashboard `.community-head h3` + `.spool` 800→500; penny `.pw-card h2` 600→500;
  sidebar `.tape-mark` 900→500; HowItWorks badge numeral 700→500. ✅ ship

**D. Honesty copy (VERIFY facts first, then ship):**
- D1. penny "start free" → "Create a free account" (no free tier/trial exists). ✅ ship
- D2. "ten retailers" on landing + pricing — VERIFY actual retailer count before editing (sidebar
  ships 13 store options, so "ten" may be defensible; do not "fix" a true claim). ⏳ verify
- D3. HowItWorks "Home Depot and Lowe's store by store" vs FAQ "Home Depot and Target" — VERIFY
  which retailers are per-store, fix the wrong one. ⏳ verify

**E. Accessibility quick wins (low-risk):**
- E1. dashboard `.searchbox input { outline:none }` → restore a focus-visible ring. ✅ ship
- E2. sortbox 38px→44px tap target. ✅ ship
- E3. landing white-on-orange (.step-n/.who-tag) → ink-on-orange (verify contrast). ✅ ship

### DEFER — medium/high risk → owner review (NOT auto-shipped)
- Pricing: render price from server plan instead of hardcoded $20; founding-seat scarcity (billing/data). HIGH.
- Deals-feed: wire the built-but-unreachable "Closest to me" (near) tab (JS/behavior). MEDIUM.
- Penny feed 2-across compact card variant (needs a new compact card). MEDIUM.
- Auth: password-reveal toggle, Reset confirm field (auth flow). MEDIUM.
- Landing hero focal point rebuild (dead .now CSS → new display size). MEDIUM (do carefully).
- Amazon waitlist capture (touches signup/data). HIGH.

## Phase 3 — DEPLOY (done — 3 batches, each typecheck→deploy→verify)
- **1beeeec** — mobile density: hide redundant `.card-cta` on phones + trim `.dash` gutters. VERIFIED
  live at 375px: CTA display:none, 2-across, card 172px, 2 deals visible + more on scroll, no overflow.
- **b2c6e3b** — honesty + a11y + constitution: penny "start free"→"Create a free account"; landing
  `.step-n` 50%→0; styles.css h3/h4 600→500; sortbox 38→44px; search focus ring.
- **2f43641** — HowItWorks: "Home Depot and Lowe's, store by store"→"Home Depot and Target" (match
  FAQ + reality); step badge inline 50%→0, weight 700→500.

## Phase 4 — REVIEW (done)
- **Security INTACT** (curl): CSP, HSTS, COOP, Permissions-Policy, Referrer-Policy, X-Content-Type
  nosniff, X-Frame-Options DENY all present; paid gate holds (anon /api/community-deals→402,
  teaser /api/deals/published→200). No deploy weakened security.
- **VERIFY-FIRST caught 3 audit FALSE POSITIVES (not shipped):**
  1. dashboard token-radius "resets" (.card-deal/.empty/.pill/.cell) — `--r-*` are all 0px already; no-ops.
  2. landing "white-on-orange contrast fail" — `--sticker` is #111 ink, not orange; white-on-ink ~18:1, fine.
  3. "ten retailers" overclaim — DB shows EXACTLY 10 retailers with live published deals (bestbuy 1961,
     woot 1531, ollies 528, target 368, homedepot 338, walmart 57, newegg 25, grove 25, lowes 21,
     staples 16). The claim is TRUE; left untouched (agents only saw the landing source, not the DB).

## DEFERRED (medium/high risk or judgment — for owner review, NOT auto-shipped)
- Mobile card is still ~457px tall (content-rich). Could shorten by deferring the store-ledger/facts
  behind a tap → more deals per screen. MEDIUM (content decision, owner should see it).
- Mobile nav: 13 chips + ZIP + nudge eat ~500px above the feed; the sidebar shows cryptic "HD/TG"
  codes on phones instead of names, hides the Main-vs-Community grouping, and has a generic repeated
  icon. Real wins but MEDIUM (nav restructure). (shell-nav scored 6.0 — worst area.)
- Pricing: render price from server plan (not hardcoded $20) + honest founding-seat scarcity. HIGH (billing).
- Deals-feed: wire the built-but-unreachable "Closest to me" (near) tab. MEDIUM.
- Penny companion feed still 1-up at ≤720px (needs a compact 2-up card). MEDIUM.
- Auth: password-reveal toggle + Reset confirm field. MEDIUM.
- Heading weights 800/900 on branded `.spool`/`.tape-mark` — exceed ≤500 but may be intentional
  branding; NOT changed unilaterally. Owner call.
- Landing hero has no focal point (dead `.now` CSS); rebuild a display size. MEDIUM.
