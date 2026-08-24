# Blueprint backlog — deal-engine

Maintained by the Ideator/Blueprints sector. BUILD executes from the top down.
Each run: re-read the code, open PRs/branches, and competitor state before
rewriting this file — don't re-propose shipped or in-flight work.

**Scope note:** this file covers marketing/UI/pricing/positioning. The
scan/score/verify data-method track has its own file, `company/
penny-blueprints.md` (own pass, most recently 2026-08-24) — don't duplicate
its backlog here. A third track, general UI/UX polish, now runs nightly as
its own cycle under `company/sbb/` (three cycles logged as of this pass,
most recently `2026-08-24-blueprints.md`) — don't duplicate its line items
either, but its cycle-3 findings surface two things load-bearing enough for
this file to act on directly: see the market snapshot and Blueprint 1, below.

**Last pass:** 2026-08-24 (this pass). Previous pass: 2026-08-23.

## Market snapshot (as of this pass)

- **Competitor pricing/positioning: no material change since 2026-08-23.**
  Hidden Clearances (free, 6 retailers incl. Amazon/HD/Lowe's/Walmart/Costco/
  Target, "refreshes every minute," continuous verification claimed),
  BrickSeek (free basic + Premium $14.99/Extreme $29.99), Penny (free +
  Pro $14.99 + VIP $29.99, HD aisle/bay data crowdsourced — "you scan in
  store to confirm"), PennyCentral (140k+ free community list), Endless
  ($9.99/mo), and Rebel Savings (free, community radius map) all match last
  pass's figures in this pass's check.
- **New this pass: Scavenger's own trustworthiness is now publicly
  contested.** Scavenger (~$47/mo, the one rival whose copy claims genuine
  automated inventory scanning) is the subject of a dated (2026-06-11)
  ScamAdviser writeup and a security-blog post (GridinSoft) alleging it
  "asks for payment before the user can verify the deals" and converts a $1
  trial into $47/mo. Not independently verified by this repo beyond the
  search results themselves, and not something to name-and-shame in our own
  copy — but it's a real opening: it sharpens Blueprint 5's argument that
  "pay to even see if a deal is real" is a fair category-wide critique, not
  a jab at one named competitor. **Do not name Scavenger directly in
  marketing copy** — describe the pattern, not the company, to avoid
  disparagement risk without a primary-source verification of our own.
- **Deal Soldier's price is now reported inconsistently across sources**
  ($44/mo per one source, $99/mo per another, both dated 2026). Treat the
  $44 figure already used elsewhere in this file as unconfirmed going
  forward — don't cite a specific Deal Soldier price in new copy without
  re-checking its own site at build time.
- Realistic paying market unchanged: ~30k-150k US penny/clearance hunters
  total, San Antonio's share roughly 50-200 people.
- **Correction to last pass's "shipped" claim, caught by this pass's read of
  `company/sbb/2026-08-24-blueprints.md` (a different sector's cycle-3 log,
  produced from live measurement, not this file's own testing):** last
  pass reported the `/api/deals/nearby` "possible deals" feed as "shipped,
  works for any US ZIP nationwide." SBB's chairman measured the live
  behavior and found the deal list itself is **identical regardless of
  ZIP** — same items, same order, tested against San Antonio, Bozeman, and
  Adak. `nearby-deals.ts`'s own comment describes this as intentional
  ("the deal CATALOG is national... the SAME deal list shows in every
  ZIP... what is local is STOCK, which we overlay per deal") — so this may
  be correct-as-designed rather than a bug, but SBB's read is that it's a
  defect and queued it as their own next cycle's #1. **This file is not the
  place to resolve which read is right** (that's a backend/product-logic
  call, out of this file's scope), but until it's resolved: don't add
  "works for any US ZIP" language to actual marketing copy (grep confirms
  no page currently claims this — good, keep it that way), and treat
  Blueprint 8, below, as gated on the answer, not on the assumption that
  browsing "already works" out-of-metro.
- **New this pass, also from `sbb/2026-08-24-blueprints.md`:** the same
  cycle flagged, as its single largest unaddressed conversion defect, that
  `PUBLIC_PREVIEW`'s synthetic identity makes the site header show "Create
  free account" directly beside "Sign out" — a visitor who has never signed
  up is told, in the same breath, that they're both logged out and already
  logged in. Their own read: *"looks hacked or broken, not preview mode."*
  This is concrete, first-hand evidence for exactly the risk Blueprint 1
  (below) has flagged for two passes on architectural grounds alone — it's
  no longer hypothetical.
- **Shipped since last pass:** `penny-blueprints.md` reports Lowe's live
  with 45 published deals (hand-run, not yet automated — see that file's
  Blueprint 1). PR #4 (below) implements this file's former Blueprint 3
  (real-data landing hero) — now in-pr, not re-proposed.

**Standing correction (still true, reconfirmed again this pass):** pricing
is **Consumer $9.99/mo** and **Reseller $19/mo** (founding rate, 30 seats),
not "$75/mo" — confirmed again in `src/vendors/stripe.ts:29-30`,
`web/src/pages/site/Pricing.tsx`, `web/src/pages/app/Welcome.tsx`. Cheapest
genuine-scan-claiming reseller tool against Deal Soldier, Scavenger,
BrickSeek Extreme, and Penny VIP. (BUILD: `$75/mo` anywhere in code/copy is
a bug — none found this pass.)

## What's already shipped that overlaps with the brief's "strategic bets"

- **Profit/margin layer** — done (`Profit.tsx`, `src/resell/fees.ts`,
  `/api/profit`). Resale-comp suggestions (bigger bet #10, below) still open.
- **Public live-scan freshness bar** — code-complete in PR #2, not merged.
  See Blueprint 2.
- **Real-data landing hero** — code-complete in PR #4, not merged. See
  Blueprint 3.
- **Nationwide deal browsing** — shipped, but see this pass's correction
  above: whether the underlying feed is actually ZIP-sensitive for the deal
  list (vs. only for the stock overlay) is now an open question, not a
  settled claim.
- **Founding-seat scarcity** — done on `/pricing`, still missing from
  `Welcome.tsx` (reconfirmed this pass — no `seats_left` reference in
  `web/src/pages/app/Welcome.tsx`). See Blueprint 6.
- **Metro-gating honesty for scores** — done (`src/coverage.ts`, 14-day
  floor).

## In flight — do not re-propose

- **PR #1** (`company/night-2026-08-21` → `main`): wires the contact form to
  `/api/contact`. Still open, draft, no new commits since last pass.
- **PR #2** (`company/night-2026-08-21-freshness-bar` → `main`): implements
  the public freshness bar (`FreshnessBar.tsx`, wired into `SiteLayout.tsx`).
  Still open, draft. **Do not merge yet** — `penny-blueprints.md` Blueprint
  1/3 gates this on real, unattended `scan_runs` history existing first.
- **PR #3** (`company/night-2026-08-22-remove-amazon-claim` → `main`): still
  open, draft, no blockers found. Deletes the "Amazon Warehouse" line from
  `Landing.tsx`, `Welcome.tsx`, `Pricing.tsx`. This file's former Blueprint 4
  — in-pr, not re-proposed.
- **PR #4** (`company/night-2026-08-23-hero-live-penny` → `main`): new since
  last pass. Adds `GET /api/public/penny-spotlight` (unauthenticated, single
  most-recent confirmed penny find, stripped to title/price/discount/
  bucketed-distance/timestamp — no store number, no shelf count) and wires
  `Landing.tsx`'s hero to render it live, falling back to the old static
  example (now explicitly labeled "Example — not a live report yet.") when
  nothing real exists. This is this file's former Blueprint 3, exactly as
  specced. Still open, draft, no blockers found. **Same merge gate as PR #2**
  — a live query against `finds` is only honest once real, unattended finds
  are accumulating (`penny-blueprints.md` Blueprint 1/3); today it will
  almost always render the labeled fallback, which is fine, but don't treat
  the PR's existence as "the freshness problem is solved."

---

## Ranked backlog

### 1. Decide `PUBLIC_PREVIEW` on purpose — now with first-hand evidence of harm
**status:** todo — top priority, escalated this pass
**problem:** `src/api/middleware.ts`'s `loadUser` grants any anonymous
visitor a full logged-in **reseller-plan** identity when
`PUBLIC_PREVIEW=1` — no signup, no paywall, same feed a $19/mo subscriber
gets, no expiry, not listed in `.env.example`, and no record of whether
it's live on the production Railway deploy right now. Two passes running
this file has flagged it as an architectural risk. This pass adds a
concrete, first-hand finding from `company/sbb/2026-08-24-blueprints.md`
(a live measurement, not a hypothesis): the synthetic identity makes the
site header show "Create free account" beside "Sign out" simultaneously,
which that sector's own review called the largest unaddressed conversion
defect on the site — a visitor reasonably concludes they already have an
account and never signs up. The same review also flagged that the
landing page's primary CTA ("Start hunting") routes to `/app`, not
`/signup` — compounding the same leak: the entire product is reachable
without ever asking for an email, while telling the visitor they're
signed in the whole time.
**what to build:** (a) confirm today whether `PUBLIC_PREVIEW=1` is set on
the production deploy — a same-day check, not a build; (b) decide, on
purpose, what "preview mode" should look like to a visitor: at minimum the
header should never show both "Create free account" and "Sign out," and
the primary landing CTA should route somewhere that asks for an email
before or shortly after the preview, not around it entirely; (c) if kept as
a deliberate funnel, bound it the way Scavenger's own free-preview mechanic
is bounded (delayed feed, capped results, visible upgrade prompt) rather
than granting unlimited paid-tier access; (d) write the decision down,
dated, so it isn't an open toggle again next pass.
**why it beats today:** turns a silent risk with now-confirmed real-world
symptoms (confusing header, a CTA that routes around signup) into either a
real, bounded funnel or a closed gap — whichever the founder decides.
**effort:** S to check and decide the header/CTA fix; M if scoping a fully
bounded preview tier.
**success metric:** dated decision recorded in this file or a company note;
header never shows "Create free account" and "Sign out" together; if kept
as a funnel, preview traffic is visibly capped vs. paid with a measurable
preview→paid conversion path.

### 2. Public live-scan freshness bar — ship once real data backs it
**status:** in-pr (PR #2) — code done, merge gated
**problem:** unchanged in substance — this is still the one differentiator
(genuine machine-swept, timestamped per-store data) that Penny/
PennyCentral's crowdsourced-dressed-as-scanned copy and Scavenger's "24/7
scans" claim (now also under public trust scrutiny — see market snapshot)
can't be told apart from without proof on the page. Build side is done;
what's missing is real `scan_runs` history, tracked in
`penny-blueprints.md` Blueprint 1/3.
**what to build:** nothing new on the frontend. BUILD: merge PR #2 only
after `penny-blueprints.md`'s automation (Blueprint 1) or sweep (Blueprint
3) is producing real, unattended scan history — check that file's dated
results before re-promoting this.
**why it beats today:** a live, updating timestamp is something no
crowdsourced or trust-disputed competitor can fake without becoming an
actual scanner — but only once it's showing real numbers.
**effort:** S (a merge) once unblocked.
**success metric:** freshness bar live in production showing a real,
sub-26h timestamp, ≥95% of days.

### 3. Real-data landing hero — ship once real data backs it
**status:** in-pr (PR #4) — code done, merge gated
**problem:** `Landing.tsx`'s hero used to be permanently hardcoded; PR #4
fixes the code path (real endpoint, real fallback labeling) but the
underlying honesty problem — is there ever a real penny find to show —
is the same one gating Blueprint 2, and for the same reason
(`penny-blueprints.md` Blueprint 1/3 not yet producing unattended scan
history).
**what to build:** nothing new. BUILD: merge PR #4 on the same gate as PR
#2. Verify at merge time that the fallback copy ("Example — not a live
report yet.") is honest today and stays honest until real finds exist —
don't let "the PR shipped" get read as "the hero is now live."
**why it beats today:** pairs with Blueprint 2 — together they turn the
hero and the freshness bar from claims into one consistent live demo, once
both are true at the same time.
**effort:** S (a merge) once unblocked.
**success metric:** hero renders a real find on ≥80% of loads during active
scan hours once merged; zero "the example never changes" reports.

### 4. Answer "why pay when it's free/cheap elsewhere?" head-on
**status:** todo — unchanged since last pass, now with a sharper edge
available
**problem:** `Faq.tsx`'s "How is this different from the free tools?"
entry argues from the profit-tracking angle only, names zero competitors,
and never mentions the data-freshness/automated-scan distinction. This
pass's research adds a specific, usable edge: multiple rivals (Penny VIP,
Scavenger) hedge their own "automated" claims in their own copy ("where
available," "scan in store to confirm"), and one ($47/mo Scavenger) is the
subject of public complaints about charging before a deal can be verified
at all.
**what to build:** sharpen the existing FAQ entry (or add a second one)
with the specific tradeoff: most alternatives are broad, crowdsourced, or
ask you to pay before you can tell if a deal is real. deal-engine covers 2
retailers deeply with a machine-swept, timestamped scan, checked against
confirmed outcomes (`src/engine/reputation.ts`). Describe the pattern
("pay first, verify later" / "where available" hedges), don't name
Scavenger or any competitor directly — the ScamAdviser/GridinSoft
allegations aren't independently verified by this repo, and naming a rival
in a scam-adjacent context is a real legal/reputational risk for a
five-person company. Link to the freshness bar (Blueprint 2) as proof once
it's live with real data.
**why it beats today:** the profit-angle answer is good but incomplete —
leaving the data-freshness/trust objection unanswered means the prospect
who came specifically comparing scan quality still leaves unconvinced.
**effort:** S — editing an existing entry, not building a new page.
**success metric:** FAQ entry names the crowdsourced/pay-to-verify-vs-
automated tradeoff explicitly, without naming a competitor; track
conversion delta for visitors who read it, if analytics are wired.

### 5. Surface founding-seat scarcity before checkout, not during it
**status:** todo — unchanged since last pass
**problem:** `web/src/pages/site/Pricing.tsx` shows real `seats_left` out
of 30 for the reseller plan; `web/src/pages/app/Welcome.tsx`'s PathPicker
— the earlier, higher-traffic decision point — still shows static
"$9.99/$19" with no scarcity signal (reconfirmed this pass: no
`seats_left` reference in that file).
**what to build:** thread the same `/api/billing/plans` seats-left number
into `Welcome.tsx`'s reseller card, verbatim reuse of `Pricing.tsx`'s
fetch/format logic; optionally a small ambient mention on `Landing.tsx`
too.
**why it beats today:** real, server-verified scarcity is a strong lever in
a market this small — 30 seats against ~50-200 realistic SA payers.
**effort:** S
**success metric:** seats-left visible at both Welcome and Landing, no
mismatch with Pricing's number.

### 6. Close out the last small design-debt items in this file's scope
**status:** todo — narrower again this pass; most of the earlier list is
now owned/handled by the `sbb/` cycle instead
**problem:** two items remain that are squarely marketing/UI-copy scope
rather than the SBB cycle's general polish sweep: `web/src/pages/app/
RetailerDeals.tsx` already has an SVG placeholder for a missing
`image_url` (same pattern as `AllDeals.tsx`, reconfirmed this pass, lines
99-109) — that part is fine — but has no `onError` handler for an
`image_url` that 404s at render time, so a broken link still shows a
broken-image icon instead of falling back to the placeholder;
`Palettes.tsx` is still an unrouted scratch page.
**what to build:** add an `onError` handler on the `<img>` in
`RetailerDeals.tsx` that swaps to the same placeholder SVG `AllDeals.tsx`
already falls back to on a missing `image_url`; delete or explicitly route
`Palettes.tsx`.
**why it beats today:** small, zero-risk, prevents a broken-image state
from being a new user's first impression of a retailer deals page.
**effort:** S
**success metric:** no broken-image icon reachable in
`/app/deals/:retailer` even when `image_url` 404s; `Palettes.tsx` no
longer an orphaned file.

### 7. Capture demand outside San Antonio's *scored* coverage
**status:** todo — hold pending the ZIP-sensitivity question in this
pass's market snapshot
**problem:** `coverage.ts` still gates meaningful penny *scores* to 782xx
ZIPs with 14+ days of history — unchanged and still correct. The premise
this blueprint used last pass — "out-of-market visitors can already browse
the national deal feed, so capture their interest instead" — now has an
open question behind it: this pass's read of `sbb/2026-08-24-blueprints.md`
found the deal list itself may not actually vary by ZIP the way "browse
nationwide" implies (see market snapshot). Building a capture flow on top
of a browse experience that might not be doing what it claims risks
compounding the same kind of unverified-claim problem this backlog exists
to prevent.
**what to build:** hold until the ZIP-sensitivity question is resolved
(SBB's own queue, or a `penny-blueprints.md`/backend decision — out of
this file's scope to resolve). Once resolved: when a visitor is outside
782xx and hits the coverage-gated score view, show a lightweight "tell us
where you are, we'll email you when scored coverage arrives" capture (ZIP +
optional email). Roll up top requested ZIP prefixes on `Admin.tsx`.
**why it beats today:** turns a dead end into lead data for the next metro
pick — but only once the thing it's built on top of is confirmed to work
as described.
**effort:** M
**success metric:** waitlist table populated; ranked next-metro candidate
list exists after 30 days of the capture being live.

---

## Bigger strategic bets (not one-PR items — for planning, not immediate build)

### 8. Multi-metro expansion
**status:** todo (blocked on Blueprint 7's demand data + the lead-time
constraint documented in `coverage.ts` and `penny-blueprints.md` — new
metro scoring needs ~14+ days of real scan history before it can be sold
honestly, and per this pass's market-snapshot correction, whether the
browse feed itself reaches new metros the way last pass assumed is now an
open question rather than a given).

### 9. Reposition pricing/marketing around "cheapest verified data," not premium
**status:** todo
Unchanged thesis: at $9.99/$19, deal-engine already undercuts Deal Soldier,
Scavenger, BrickSeek Extreme, and Penny VIP — sharper now that one of those
rivals (Scavenger) carries public trust complaints of its own. The
marketing story should be "cheapest tool that's actually verified fresh,"
not "worth paying more for." Touches Landing, Pricing, How It Works
simultaneously; scope as its own review, not folded into the smaller copy
fixes above.

### 10. Deepen the profit layer with resale-comp suggestions
**status:** todo
`Profit.tsx` / `src/resell/fees.ts` compute real net/ROI after the sale. The
open step is suggesting an expected resale range at find-time, before
purchase — closing the loop from "here's a penny find" to "here's whether
it's worth your gas money," which none of the named competitors do. Needs a
resale-comp data source decision before this is buildable as PRs.
