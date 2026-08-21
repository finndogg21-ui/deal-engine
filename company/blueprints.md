# Blueprint backlog — deal-engine

Maintained by the Ideator/Blueprints sector. BUILD executes from the top down.
Each run: re-read the code, open PRs/branches, and competitor state before
rewriting this file — don't re-propose shipped or in-flight work.

**Last pass:** 2026-08-21 (17:05 UTC run)

## Market snapshot (as of this pass)

- **New this pass — Penny (pennydeals.app)**, a real iOS app, is a sharper
  threat than the brief's original competitor list: free tier + Pro
  $14.99/mo + **VIP $29.99/mo**, monitors 65+ stores, and VIP specifically
  adds "local Home Depot clearance with aisle and bay" location. On close
  read, though, its in-store aisle/bay data is **crowdsourced, not
  machine-swept** — the app's own copy says "you scan in store to confirm"
  and locations show only "where available." It's community data wearing
  scanner branding. Same pattern as **PennyCentral** (140k+ member
  community penny list, free). Neither is a real per-store inventory scan;
  both are exactly the "stale scraped/community leads" category
  deal-engine is built to beat — but their marketing reads as if they scan,
  so a casual comparison shopper won't tell the difference from a landing
  page alone. This raises the stakes on Blueprint 2 (public freshness
  proof) — it's no longer just a nice differentiator, it's the only thing
  that distinguishes a real scan from a crowdsourced one to an outside
  visitor.
- **Scavenger** (~$47/mo) is the one rival whose own copy explicitly claims
  automated inventory reads ("scans every Home Depot within 25 miles... 24/7"),
  so it's the closest thing to a genuine scanning competitor, not just a
  pricing one. Still broad-radius, not per-store-verified-fresh the way
  `Admin.tsx`'s scan-run data already is.
- **Hidden Clearances** — free, scans/aggregates across Amazon, HD, Lowe's,
  Walmart, Costco, Target (7 retailers). Breadth over depth: a general
  scanner watching seven chains surfaces far fewer $0.01 finds per chain
  than a scanner pointed at one. Still the free alternative every prospect
  compares us to first.
- **Deal Soldier** — $35–44/mo depending on source, HD/Lowe's/Walmart/Target,
  runs inside Discord, bundles reseller-education content/community over a
  standalone app.
- **Endless** — $9.99/mo, lower-end general clearance tool.
- **Rebel Savings** — free, no paywall, store-level radius map for
  HD/Lowe's/Walmart, explicitly community-sourced.
- Realistic paying market: ~30k–150k US penny/clearance hunters total, San
  Antonio's share is roughly 50–200 people. Tiny, winner-take-most local
  market, not a growth-at-all-costs SaaS market. More players than last
  pass (Penny, PennyCentral) confirms this niche is getting crowded on the
  free/cheap/community end — reinforces that deal-engine's only durable
  lane is *provably real, per-store, timestamped* data, not price or
  breadth.

**Standing correction (from prior pass, still true):** the operating brief
describes deal-engine as "the priciest option at $75/mo." The actual code
(`src/vendors/stripe.ts`, `web/src/pages/site/Pricing.tsx`,
`web/src/pages/app/Welcome.tsx`) prices two tiers: **Consumer $9.99/mo**
and **Reseller $19/mo** (founding rate, capped at 30 seats). At those
prices deal-engine undercuts Deal Soldier, Scavenger, and now Penny VIP
($29.99) too — cheapest genuine-scan-claiming reseller tool in the set.
(BUILD: if `$75/mo` shows up anywhere in code or copy, that's a bug, not a
strategy — flag it, don't ship it.)

## What's already shipped that the brief's "strategic bets" list overlaps with

- **Profit/margin layer** — done. `web/src/pages/app/Profit.tsx` +
  `src/resell/fees.ts` + `/api/profit` already compute net (not gross),
  ROI%, by-month/store/category breakdowns from real order rows.
- **Scan freshness / health tracking** — done, but *internal only*.
  `src/api/routes/admin.ts` + `web/src/pages/app/Admin.tsx` already track
  last-scan time, staleness (>26h flag), rows written, trailing average.
  Nothing about this is customer-facing yet — see Blueprint 2 below, now
  the single highest-leverage item in this backlog given this pass's
  competitor research (see market snapshot above).
- **Metro-gating honesty** — done. `src/coverage.ts` already refuses to
  show meaningful penny scores until 14+ days of price history exist for a
  ZIP, with honest copy explaining why. Good foundation, currently a dead
  end for anyone outside San Antonio (see Blueprint 7).
- **Founding-seat scarcity** — done, but only visible mid-checkout. See
  Blueprint 5.

## In flight — do not re-propose

- **PR #1** (`company/night-2026-08-21` → `main`): wires the contact form
  to the existing `/api/contact` endpoint. Status: `in-pr`, still open and
  unmerged as of this pass, no new commits since it was opened.

---

## Ranked backlog

### 1. Public live-scan freshness bar (the provable-freshness widget)
**status:** todo — promoted to #1 this pass
**problem:** the single believable differentiator deal-engine has —
genuine machine-swept per-store stock counts with fresh timestamps — is
invisible to anyone who hasn't signed up. `Admin.tsx` already computes
exactly this (`last scan Xh ago`, rows written, stale flag) but it's gated
behind the admin route. This pass's competitor research raises the
urgency: **Penny (pennydeals.app) and PennyCentral now market
crowdsourced/community aisle data in language that reads as automated
scanning** ("you scan in store to confirm", "where available" — i.e. not
guaranteed, not timestamped), and Scavenger explicitly claims 24/7
automated reads too. A skeptical prospect landing on any of these sites
cannot currently tell "real per-store scan" from "community tip dressed as
one" — including on deal-engine's own site, where the proof exists in the
database but not on the page.
**what to build:** a small, honest status strip — "Last scan: 47 min ago ·
5 San Antonio stores · 1,842 SKUs checked" — reusing the existing scan-run
data, on the landing page and in the footer of every marketing page. Same
red/stale treatment `Admin.tsx` already has (reuse the >26h stale
threshold and copy pattern). No new backend logic, just a public read of
data that already exists.
**why it beats today:** turns "trust us, it's fresh" into a number a
skeptical reseller can watch update in real time — a crowdsourced
competitor cannot fake a live per-store timestamp without actually
building the scanner. This is now a defensive move, not just an upsell:
it's the only thing standing between deal-engine and being lumped in with
Penny/PennyCentral/Rebel Savings by anyone comparison-shopping fast.
**effort:** M
**success metric:** freshness bar visible on landing + pricing; time-since-
scan stays under the existing 26h stale threshold ≥95% of days (this also
functions as an internal SLA once it's public).

### 2. Make the landing hero prove itself with real data
**status:** todo
**problem:** `web/src/pages/Landing.tsx` hero — "Someone paid $0.01 for a
100 ft contractor garden hose, this morning, 1.4 miles away, 62 still on
the shelf" — is hardcoded copy, not a real finding. It never changes. For a
product whose entire pitch is "genuine machine-swept data, not stale
scraped leads," a fake live example is the single worst thing that could
be sitting on the homepage — it's the exact failure mode we accuse Penny/
PennyCentral/Rebel Savings of.
**what to build:** a small public endpoint (or reuse `/api/candidates`
filtered to `penny=1`, non-authenticated, stripped to only
title/discount/relative-distance-bucket/relative-time — no store number or
exact address, matching existing card constraints enforced elsewhere) that
returns the single most recent confirmed or high-confidence penny find.
Landing hero renders that when available; falls back to today's static
copy, clearly framed as an example, only when there's genuinely nothing
yet (new/quiet metro).
**why it beats today:** pairs naturally with Blueprint 1 — together they
turn the hero from a claim into a live demo, which is the one thing none
of the crowdsourced competitors can replicate without becoming an actual
scanner.
**effort:** M
**success metric:** hero renders a real find on ≥80% of page loads during
active scan hours; zero reports of "the example never changes."

### 3. Remove the "Amazon Warehouse" claim
**status:** todo
**problem:** `Landing.tsx`, `Pricing.tsx`, and `Welcome.tsx` all promise
"Amazon Warehouse and clearance deals" in the consumer plan's feature list.
The live scan covers Home Depot + Lowe's only — flagged in
`web/DESIGN_AUDIT.md` (P2-5, confirmed still present this pass) and
explicitly left unfixed there as "a marketing/roadmap copy decision...
left for the product owner." That's this backlog. Selling a plan on a
retailer we don't scan is a false-advertising / chargeback risk, not a
style nit — and this pass's research shows Hidden Clearances genuinely
does cover Amazon, so the gap is visible to anyone who compares.
**what to build:** delete the line in all three files (`Landing.tsx` who
card, `Pricing.tsx` TIERS features, `Welcome.tsx` PathPicker consumer
list). Replace with an accurate claim already true today — e.g. "Watch any
product by name across Home Depot and Lowe's" — or leave the bullet count
at four instead of inventing a fifth.
**why it beats today:** removes a live legal/trust liability for a
five-minute edit; also frees up the roadmap to *actually* promise Amazon
later once it's real, without walking back a claim already made to payers.
**effort:** S — single PR, three files, copy-only.
**success metric:** zero live references to unscanned retailers anywhere
in `web/src`; grep for "Amazon" in `web/src` returns nothing outside
comments/roadmap notes.

### 4. Answer "why pay when it's free/cheap elsewhere?" head-on — and name the crowdsourcing gap
**status:** todo
**problem:** every prospect's first move is to check for a free tool.
This pass turned up more free/cheap options than the standing brief lists
(Hidden Clearances, Rebel Savings, Penny free tier, PennyCentral) plus
Scavenger running comparison-SEO content ("7 best penny finder apps") to
win exactly this search. `Faq.tsx` currently doesn't mention any
competitor at all.
**what to build:** one direct FAQ entry (or a short `/compare` page linked
from Pricing and FAQ) that names the tradeoff honestly and specifically:
most alternatives (Hidden Clearances, Rebel Savings, Penny, PennyCentral)
are broad, crowdsourced, or community-confirmed — genuinely useful, but
not a per-store automated scan, and their own product copy hedges this
("where available," "scan in store to confirm"). deal-engine covers 2
retailers deeply with a machine-swept, timestamped, per-store scan and a
score checked against confirmed outcomes weekly (`src/engine/reputation.ts`
/ "Members confirm" in `HowItWorks.tsx`). Own "narrower but real" instead
of avoiding the comparison — and this can link directly to the freshness
bar from Blueprint 1 as proof.
**why it beats today:** silence on the objection means the prospect
answers it themselves, usually by leaving. Naming the crowdsourcing gap
specifically (not just "we're better") is a claim competitors can't easily
copy without exposing their own data source.
**effort:** S–M
**success metric:** page/FAQ entry shipped; track via analytics (if wired)
whether visitors who read it convert at a higher rate than baseline.

### 5. Surface founding-seat scarcity before checkout, not during it
**status:** todo
**problem:** `Pricing.tsx` already fetches real `seats_left` out of 30 for
the reseller plan and shows it — but only once someone lands on `/pricing`.
`Welcome.tsx`'s PathPicker (the earlier, higher-traffic decision point)
still shows static "$9.99/$19" with no scarcity signal at all.
**what to build:** thread the same `/api/billing/plans` seats-left number
into `Welcome.tsx`'s reseller card, and consider a small ambient mention on
`Landing.tsx` ("30 founding reseller seats, X left" near the pricing CTA).
Reuse the existing fetch/format logic from `Pricing.tsx` verbatim.
**why it beats today:** real, server-verified scarcity (not a countdown
timer trick) is a strong local-market lever precisely because the market
really is that small — 30 seats against ~50-200 realistic SA payers is a
meaningful fraction, worth saying out loud earlier in the funnel.
**effort:** S
**success metric:** seats-left visible at both Welcome and Landing; no
mismatch with the Pricing page's number (single source of truth via the
same endpoint).

### 6. Small design-debt cleanup left open by the last audit
**status:** todo
**problem:** `web/DESIGN_AUDIT.md` left two P2 items unfixed as
out-of-scope for that pass (confirmed still open this pass): RetailerDeals
`<img>` has no `onError` fallback (P2-6, shows a broken-image icon instead
of the placeholder AllDeals already uses), and a handful of dead CSS rules
(`.card-store*`, `.card-compare`, `.icon-btn`, `.sb-group`, `.sb-caret`,
`.sb-group-head`) plus an unrouted `Palettes.tsx` scratch page.
**what to build:** add the same `onError` → placeholder swap
`AllDeals.tsx` already uses to `RetailerDeals.tsx`; delete the confirmed-
dead CSS rules; delete or explicitly route `Palettes.tsx`.
**why it beats today:** cheap, zero-risk cleanup bundled as one PR;
prevents the broken-image state from ever being a new user's first
impression of a retailer deals page.
**effort:** S
**success metric:** no broken-image icon reachable in `/app/deals/:retailer`;
`tsc --noEmit` and a CSS-usage grep both clean.

### 7. Capture demand outside San Antonio instead of just turning it away
**status:** todo
**problem:** `src/coverage.ts` already returns a good, honest "we don't
cover you yet" message for any ZIP outside the 782xx prefix — but it's a
dead end. Nothing captures who asked, so there's no data to decide which
metro to scan next, and no way to notify that person when it's live.
**what to build:** when `coverageFor()` returns `covered: false`, show a
lightweight "tell us where you are, we'll email you when we cover it"
capture (ZIP + optional email) on the welcome/onboarding flow, writing to
a simple table. Surface a rollup on `Admin.tsx` (top requested ZIP
prefixes) so expansion is a data decision, not a guess.
**why it beats today:** turns every out-of-market visitor — currently pure
loss — into a lead for the next metro, and de-risks the "coverage takes
weeks to spin up" constraint already documented in `coverage.ts` by giving
BUILD lead time driven by real demand instead of a hunch.
**effort:** M
**success metric:** waitlist table populated; a ranked list of next-metro
candidates exists after 30 days of capture.

---

## Bigger strategic bets (not one-PR items — for planning, not immediate build)

### 8. Multi-metro expansion
**status:** todo (blocked on Blueprint 7's demand data + weeks of lead-time
scanning per `coverage.ts`'s own documented constraint)
Expansion is infrastructure + lead time, not a config flag: a new metro
needs the scan running for ~14+ days before anyone there can be sold a
plan honestly. Sequence this after Blueprint 7 tells us which metro to
pick, and treat the lead time as a hard scheduling constraint, not
something to shortcut.

### 9. Reposition pricing/marketing around "cheapest verified data," not premium
**status:** todo
Given the corrected pricing reality above (we're $9.99/$19, not $75, and
now cheaper than Deal Soldier, Scavenger, *and* Penny VIP), the marketing
thesis should shift from "worth paying more for" to "the cheapest tool
that's actually verified fresh" — a materially different story than a
$75/mo positioning would need. This touches Landing, Pricing, and How It
Works copy simultaneously and should be scoped as its own review rather
than folded into the smaller copy fixes above.

### 10. Deepen the profit layer with resale-comp suggestions
**status:** todo
`Profit.tsx` and `src/resell/fees.ts` already compute real net/ROI from
stored orders. The natural next step — suggesting an expected resale price
range at find-time (before purchase), not just reporting after the sale —
would close the loop from "here's a penny find" to "here's whether it's
worth your gas money," which none of the named competitors do. Needs a
resale-comp data source decision before this can be scoped as buildable
PRs.
