# Blueprint backlog — deal-engine

Maintained by the Ideator/Blueprints sector. BUILD executes from the top down.
Each run: re-read the code, open PRs/branches, and competitor state before
rewriting this file — don't re-propose shipped or in-flight work.

**Scope note:** this file covers marketing/UI/pricing/positioning. The
scan/score/verify data-method track now has its own file,
`company/penny-blueprints.md` (a separate pass, 2026-08-22) — don't duplicate
its backlog here; its #1 item (proving the store-confirm vendor call actually
works) is the real prerequisite behind this file's #2 (freshness bar), so
read both before assuming either is ready to ship.

**Last pass:** 2026-08-22

## Market snapshot (as of this pass)

- **New this pass — BrickSeek** now runs a paid reseller tier too: Premium
  $14.99/mo, Extreme $29.99/mo, on top of its long-standing free basic
  lookups. Another entrant between Endless ($9.99) and Deal Soldier/Scavenger
  ($44-47) — the mid-tier is filling in, not thinning out.
- **New this pass — Scavenger now offers a free preview scan with no signup
  required**, ahead of its $47/mo paywall. This is the same shape as
  deal-engine's own `PUBLIC_PREVIEW` flag (see Blueprint 1, below) — a
  competitor treating "browse free, pay to keep using it" as a deliberate
  funnel confirms the mechanic is sound *if scoped on purpose*. deal-engine's
  version currently isn't scoped at all, which is the problem Blueprint 1
  raises.
- **Penny (pennydeals.app)**, free tier + Pro $14.99/mo + VIP $29.99/mo
  (65+ stores; VIP's HD aisle/bay data is crowdsourced — "you scan in store
  to confirm," "where available," not a machine scan) and **PennyCentral**
  (140k+ member free community list) remain the sharpest "looks automated,
  isn't" threats — still the strongest reason Blueprint 3 (public freshness
  proof) matters, once the data behind it is real (see
  `penny-blueprints.md` Blueprint 1-2).
- **Scavenger** (~$47/mo) still the one rival whose own copy claims genuine
  automated inventory reads ("scans every Home Depot within 25 miles...
  24/7") — closest thing to a real scanning competitor, still broad-radius
  rather than per-store-verified-fresh.
- **Hidden Clearances** — free, 6-7 retailers (Amazon, HD, Lowe's, Walmart,
  Costco, Target), feed "refreshes every minute" per its own copy. Breadth
  over depth, still the free comparison every prospect reaches for first.
- **Deal Soldier** — $44/mo, HD/Lowe's/Walmart/Target, Discord-based,
  7-day free trial now advertised on its own site.
- **Endless** — $9.99/mo, lower-end general clearance tool.
- **Rebel Savings** — free, community-sourced store-level radius map.
- Realistic paying market unchanged: ~30k-150k US penny/clearance hunters
  total, San Antonio's share roughly 50-200 people. More paid mid-tier
  entrants (BrickSeek) this pass reinforces the same conclusion as last
  pass: this niche competes on trust in the data, not on price or breadth,
  because there isn't room for a volume play.
- **Shipped since last pass, changes the picture:** the "possible deals"
  feed (`/api/deals/nearby`) now works for **any US ZIP nationwide**, not
  just San Antonio (`src/geo/load-zip-centroids.ts`, `nearby-deals.ts`),
  and there's a public-preview mode that lets anonymous visitors browse it
  without an account. That's a bigger move than anything in this backlog
  last pass — see Blueprint 1, it changes what Blueprint 7 (out-of-metro
  capture) still needs to do.

**Standing correction (still true, still worth restating so it doesn't
regress):** pricing is **Consumer $9.99/mo** and **Reseller $19/mo**
(founding rate, 30 seats), not "$75/mo" — confirmed again this pass in
`src/vendors/stripe.ts`, `Pricing.tsx`, `Welcome.tsx`. Cheapest
genuine-scan-claiming reseller tool against Deal Soldier, Scavenger, BrickSeek
Extreme, and Penny VIP. (BUILD: `$75/mo` anywhere in code/copy is a bug.)

## What's already shipped that overlaps with the brief's "strategic bets"

- **Profit/margin layer** — done (`Profit.tsx`, `src/resell/fees.ts`,
  `/api/profit`). Resale-comp suggestions (bigger bet #10, below) still open.
- **Public live-scan freshness bar** — code-complete in PR #2, not merged.
  See Blueprint 1.
- **Nationwide deal browsing** — done, shipped since last pass (see market
  snapshot). Reduces Blueprint 7 to a narrower ask.
- **Founding-seat scarcity** — done on `/pricing`, still missing from
  `Welcome.tsx`. See Blueprint 6.
- **Metro-gating honesty for scores** — done (`src/coverage.ts`, 14-day
  floor), now sitting alongside a nationwide *browse* feed that isn't
  metro-gated at all — worth making sure the copy is consistent about which
  parts of the product are national and which are San-Antonio-only.

## In flight — do not re-propose

- **PR #1** (`company/night-2026-08-21` → `main`): wires the contact form to
  `/api/contact`. Still open, draft, no new commits since last pass.
- **PR #2** (`company/night-2026-08-21-freshness-bar` → `main`): implements
  the public freshness bar (`FreshnessBar.tsx`, wired into `SiteLayout.tsx`).
  Still open, draft. **Do not merge yet** — `penny-blueprints.md` Blueprint 3
  gates this on real `scan_runs` history existing first; shipping it against
  test/empty data would be the exact "unverifiable claim" this backlog exists
  to avoid.

---

## Ranked backlog

### 1. Decide `PUBLIC_PREVIEW` on purpose — funnel or leak
**status:** todo — new top priority this pass
**problem:** `src/api/middleware.ts`'s `loadUser` grants any anonymous
visitor a full logged-in **reseller-plan** identity when
`PUBLIC_PREVIEW=1` — no signup, no paywall, same feed a $19/mo subscriber
gets. The code comment calls it "TEMPORARY" and says to "unset and
redeploy" to restore the paywall, but there's no record of whether it's
currently set in production, no expiry, and no scoping (it's not even
listed in `.env.example`). If it's live on Railway right now, every visitor
already has full paid access for free — that's not a growth lever, that's
the entire subscription revenue at risk, for a product whose realistic
total paying market is already only 50-200 people. On the other hand, this
pass's research found **Scavenger now runs almost the identical mechanic on
purpose** — a free preview scan, no signup, ahead of its paywall — so the
idea itself isn't wrong, only the fact that deal-engine's version looks
unscoped and undecided.
**what to build:** (a) confirm today whether `PUBLIC_PREVIEW=1` is actually
set on the production deploy — a same-day check, not a build; (b) if kept
as a deliberate funnel, bound it the way a real free tier is bounded (e.g.
delayed feed, capped results, or fewer alerts/day than `PREVIEW_USER`
currently gets, matching the delay-based pattern Penny's own free tier
uses) and add a visible upgrade prompt at the point preview runs out; (c) if
it's leftover from testing, unset it and redeploy; (d) either way, write the
decision down (dated) so it isn't an open toggle again next pass.
**why it beats today:** right now it's the worst of both — unbounded free
access with no upsell path *and* an undocumented decision. Either fix turns
a silent risk into either a real funnel or a closed gap.
**effort:** S to check and decide; M if scoping a bounded preview tier.
**success metric:** dated decision recorded in this file or a company note;
if kept, preview traffic is visibly capped vs. paid with a measurable
preview→paid conversion path.

### 2. Public live-scan freshness bar — ship once real data backs it
**status:** in-pr (PR #2) — code done, merge gated
**problem:** unchanged from last pass in substance — this is still the one
differentiator (genuine machine-swept, timestamped per-store data) that
Penny/PennyCentral's crowdsourced-dressed-as-scanned copy and Scavenger's
"24/7 scans" claim can't be told apart from without proof on the page. The
build side is done; what's missing is real `scan_runs` history behind it,
tracked in `penny-blueprints.md` Blueprint 1-2 (store-confirm vendor
reliability, then turning the sweep on for real).
**what to build:** nothing new on the frontend. BUILD: merge PR #2 only
after `penny-blueprints.md` Blueprint 2's 14-day real-data clock has run.
Ideator note for next pass: check `penny-blueprints.md`'s dated vendor-probe
results before re-promoting this.
**why it beats today:** a live, updating timestamp is something no
crowdsourced competitor can fake without becoming an actual scanner — but
only once it's showing real numbers.
**effort:** S (a merge) once unblocked.
**success metric:** freshness bar live in production showing a real,
sub-26h timestamp, ≥95% of days.

### 3. Make the landing hero prove itself with real data
**status:** todo
**problem:** `Landing.tsx`'s hero ("Someone paid $0.01... this morning, 1.4
miles away, 62 still on the shelf") is still hardcoded, unchanged since last
pass. For a product whose whole pitch is "real scan, not stale scraped
leads," a fake live example on the homepage is the exact failure mode being
sold against.
**what to build:** small public endpoint (or `/api/candidates?penny=1`
filtered, unauthenticated, stripped to title/discount/relative-distance-
bucket/relative-time only) returning the most recent confirmed/high-
confidence penny find. Hero renders it when available; falls back to
today's static copy, clearly labeled as an example, only when there's
genuinely nothing yet.
**why it beats today:** pairs with Blueprint 2 (also gated on the same real
scan data) — together they turn the hero from a claim into a live demo.
**effort:** M
**success metric:** hero renders a real find on ≥80% of loads during active
scan hours; zero "the example never changes" reports.

### 4. Remove the "Amazon Warehouse" claim
**status:** todo — still present, unchanged since last pass
**problem:** `Landing.tsx:103`, `Pricing.tsx:29`, and `Welcome.tsx:40` all
still promise "Amazon Warehouse and clearance deals." The live scan covers
Home Depot + Lowe's only (`web/DESIGN_AUDIT.md` P2-5). Hidden Clearances
genuinely does cover Amazon, so this gap is visible to anyone comparing —
and now that BrickSeek and Penny both list retailer coverage prominently
too, the mismatch is one comparison-shop away from being noticed by a payer,
not just a reviewer.
**what to build:** delete the line in all three files; replace with an
accurate claim already true today (e.g. "Watch any product by name across
Home Depot and Lowe's") or drop the bullet.
**why it beats today:** removes a live false-advertising/chargeback risk for
a five-minute, three-file, copy-only edit.
**effort:** S — single PR.
**success metric:** grep for "Amazon" in `web/src` returns nothing outside
`Terms.tsx`'s trademark disclaimer.

### 5. Answer "why pay when it's free/cheap elsewhere?" head-on
**status:** todo
**problem:** `Faq.tsx` still names zero competitors. The free/cheap field
keeps growing (Hidden Clearances, Rebel Savings, Penny free tier,
PennyCentral, now BrickSeek's free basic tier and Scavenger's free preview)
— every one of them a "why not just use the free one" objection nobody on
the site currently answers.
**what to build:** one direct FAQ entry (or a short `/compare` page linked
from Pricing and FAQ) naming the tradeoff specifically: most alternatives
are broad, crowdsourced, or community-confirmed — genuinely useful, but not
a per-store automated scan, and their own copy hedges this ("where
available," "scan in store to confirm"). deal-engine covers 2 retailers
deeply with a machine-swept, timestamped scan, checked against confirmed
outcomes (`src/engine/reputation.ts`). Link to the freshness bar (Blueprint
2) as proof once it's live with real data.
**why it beats today:** silence on the objection means the prospect answers
it themselves, usually by leaving.
**effort:** S-M
**success metric:** page/FAQ entry shipped; track conversion delta for
visitors who read it, if analytics are wired.

### 6. Surface founding-seat scarcity before checkout, not during it
**status:** todo — unchanged since last pass
**problem:** `Pricing.tsx` shows real `seats_left` out of 30 for the
reseller plan; `Welcome.tsx`'s PathPicker — the earlier, higher-traffic
decision point — still shows static "$9.99/$19" with no scarcity signal
(confirmed again this pass: no `seats_left` reference in `Welcome.tsx`).
**what to build:** thread the same `/api/billing/plans` seats-left number
into `Welcome.tsx`'s reseller card, verbatim reuse of `Pricing.tsx`'s
fetch/format logic; optionally a small ambient mention on `Landing.tsx` too.
**why it beats today:** real, server-verified scarcity is a strong lever in
a market this small — 30 seats against ~50-200 realistic SA payers.
**effort:** S
**success metric:** seats-left visible at both Welcome and Landing, no
mismatch with Pricing's number.

### 7. Close out the last design-debt items
**status:** todo — narrower than last pass, some of it already cleaned up
**problem:** the dead CSS rules flagged last pass (`.card-store*`,
`.card-compare`, `.icon-btn`, `.sb-group*`) are gone — no longer present in
`site.css`, so that part is done. Two items remain open: `RetailerDeals.tsx`
still has no `onError` fallback on its `<img>` (confirmed this pass, line
104) — shows a broken-image icon instead of the placeholder `AllDeals.tsx`
already uses; and `Palettes.tsx` is still an unrouted scratch page.
**what to build:** add the same `onError` → placeholder swap from
`AllDeals.tsx` to `RetailerDeals.tsx`; delete or explicitly route
`Palettes.tsx`.
**why it beats today:** small, zero-risk, prevents a broken-image state
from being a new user's first impression of a retailer deals page.
**effort:** S
**success metric:** no broken-image icon reachable in
`/app/deals/:retailer`; `Palettes.tsx` no longer an orphaned file.

### 8. Capture demand outside San Antonio's *scored* coverage
**status:** todo — narrowed by this pass's discovery that browsing is now national
**problem:** `coverage.ts` still gates meaningful penny *scores* to 782xx
ZIPs with 14+ days of history — that part is unchanged and still correct.
What's new: the "possible deals" browse feed (`/api/deals/nearby`) now works
for any US ZIP nationwide, so out-of-market visitors are no longer a dead
end the way they were last pass — they can already browse. What's still
missing is capturing *who* wants full scored/verified coverage in their
metro, so expansion is a data decision instead of a guess.
**what to build:** when a visitor is outside 782xx and hits the
coverage-gated score view (not the national browse feed, which already
works), show a lightweight "tell us where you are, we'll email you when
scored coverage arrives" capture (ZIP + optional email). Roll up top
requested ZIP prefixes on `Admin.tsx`.
**why it beats today:** turns the *remaining* dead end (no scored coverage,
not "no access at all" anymore) into lead data for the next metro pick.
**effort:** M
**success metric:** waitlist table populated; ranked next-metro candidate
list exists after 30 days.

---

## Bigger strategic bets (not one-PR items — for planning, not immediate build)

### 9. Multi-metro expansion
**status:** todo (blocked on Blueprint 8's demand data + the lead-time
constraint documented in `coverage.ts` and reinforced in
`penny-blueprints.md` Blueprint 2 — new metro scoring needs ~14+ days of
real scan history before it can be sold honestly). Note the browse feed
(market snapshot, above) already reaches new metros; only *scored*
expansion is gated.

### 10. Reposition pricing/marketing around "cheapest verified data," not premium
**status:** todo
Unchanged thesis from last pass: at $9.99/$19, deal-engine already undercuts
Deal Soldier, Scavenger, BrickSeek Extreme, and Penny VIP — the marketing
story should be "cheapest tool that's actually verified fresh," not "worth
paying more for." Touches Landing, Pricing, How It Works simultaneously;
scope as its own review, not folded into the smaller copy fixes above.

### 11. Deepen the profit layer with resale-comp suggestions
**status:** todo
`Profit.tsx` / `src/resell/fees.ts` compute real net/ROI after the sale. The
open step is suggesting an expected resale range at find-time, before
purchase — closing the loop from "here's a penny find" to "here's whether
it's worth your gas money," which none of the named competitors do. Needs a
resale-comp data source decision before this is buildable as PRs.
