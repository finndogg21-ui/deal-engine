# Blueprint backlog — deal-engine

Maintained by the Ideator/Blueprints sector. BUILD executes from the top down.
Each run: re-read the code, open PRs/branches, and competitor state before
rewriting this file — don't re-propose shipped or in-flight work.

**Scope note:** this file covers marketing/UI/pricing/positioning. The
scan/score/verify data-method track has its own file, `company/
penny-blueprints.md` (own pass, most recently 2026-08-26) — don't duplicate
its backlog here. A third track, general UI/UX polish, runs as its own cycle
under `company/sbb/` (most recently `2026-08-24-blueprints.md`) — don't
duplicate its line items either.

**Last pass:** 2026-08-26 (this pass). Previous pass: 2026-08-25.

## Market snapshot (as of this pass)

- **Competitor pricing/positioning: no material change, reconfirmed by fresh
  WebSearch this pass.** Hidden Clearances (free, claims Amazon/HD/Lowe's/
  Walmart/Costco/Target, "9,000+ stores," AI-verified, no card required),
  Scavenger (~$47/mo via a 3-day/$1 trial billed through Whop, HD-only,
  free scanning/paid access split), BrickSeek (free basic + Premium $14.99/
  Extreme $29.99), Penny (free + Pro $14.99 + VIP $29.99), and Rebel Savings
  (free, community radius map) all still match prior figures. Scavenger's
  trust problem is still concrete and still worth not naming directly: this
  pass's search adds a dedicated scam-warning writeup (gridinsoft.com) to
  the existing ScamAdviser trust-score signal and the trial-to-$47
  complaint pattern — three independent sources now, still zero direct
  naming needed in our own copy (Blueprint 5 covers the framing).
- Realistic paying market unchanged: ~30k-150k US penny/clearance hunters
  total, San Antonio's share roughly 50-200 people.
- **Retailer coverage has grown again since last pass, and marketing copy's
  gap has grown with it — this is now the most urgent item in this file
  for the second pass running.** Since 2026-08-25: Best Buy went fully live
  (browser-gateway crack shipping rows today, official Products API built
  and waiting only on a key) and Dollar General shipped as a sixth retailer
  — community-reported only (DG's $0.01 price is register-only and exists
  on no public endpoint, so it's member-submitted, not scanned), with its
  submission endpoint (`POST /api/community-deals/report`) now actually
  built and live, not just wired as a label. `web/src/lib/retailers.ts`
  (source of truth) correctly lists all six. **But `web/src/pages/Landing.tsx`
  (the hero, step 1) and `web/src/pages/site/HowItWorks.tsx` (the matching
  step) still both say, verbatim, "Home Depot and Lowe's, store by store"**
  — confirmed unchanged in this pass's direct read of both files. Last pass
  this was stale by 2 retailers (Walmart, Target); it's now stale by 4
  (Walmart, Target, Best Buy, and DG's community layer), on the two
  highest-traffic pages in the marketing site (the literal first thing a
  visitor reads). `Faq.tsx`'s "Which stores are covered?" answer, by
  contrast, WAS fixed — directly on `main`, in the same commit that shipped
  Best Buy (`e6207ef`), not through open PR #6. See Blueprint 1.
- **PR #6 (`company/night-2026-08-25-faq-coverage-sync`) is now likely
  stale/redundant, not just open.** It was opened 2026-08-25 to sync FAQ
  coverage copy, but the FAQ fix it targets already landed straight to
  `main` the next day via `e6207ef` (the Best Buy commit) — before PR #6
  merged. BUILD should check whether PR #6's diff still applies cleanly or
  now conflicts/duplicates; if the FAQ portion is already satisfied on
  `main`, close PR #6 and fold any remaining scope (Landing/HowItWorks —
  see Blueprint 1) into a fresh PR rather than trying to land a PR against
  a moving target.
- **New, unrelated to marketing copy but worth flagging so it isn't
  mistaken for progress on Blueprint 8 below:** `main` picked up "App-level
  ZIP in the top bar; stock checks bounded to a 25-mile radius" — a single
  app-level ZIP field (not a repeated per-press prompt) that gates "Find
  stock" lookups to a 25-mile radius. This is a stock-check UX/correctness
  fix, not the ZIP-outside-coverage lead-capture flow this file's Blueprint
  8 describes — the two are unrelated despite both mentioning ZIP. No
  change to Blueprint 8's status.

## What's already shipped that overlaps with the brief's "strategic bets"

- **Profit/margin layer** — done (`Profit.tsx`, `src/resell/fees.ts`,
  `/api/profit`). Resale-comp suggestions (bigger bet #10, below) still open.
- **Public live-scan freshness bar** — code-complete in PR #2, not merged.
  See Blueprint 3.
- **Real-data landing hero** — code-complete in PR #4, not merged. See
  Blueprint 4.
- **Retailer coverage itself** — now six retailers total (five scanned:
  Home Depot, Lowe's, Walmart, Target, Best Buy; one community-reported:
  Dollar General), up from four last pass. Marketing copy has fallen
  further behind, not caught up — see Blueprint 1.
- **Founding-seat scarcity** — done on `/pricing`, still missing from
  `Welcome.tsx` (reconfirmed this pass — no `seats_left` reference in
  `web/src/pages/app/Welcome.tsx`). See Blueprint 6.
- **Metro-gating honesty for scores** — done (`src/coverage.ts`, 14-day
  floor).
- **`PUBLIC_PREVIEW` header contradiction** — fixed in open PR #5
  (frontend-only: never shows "Create free account" beside "Sign out"),
  still not merged. The underlying gating decision is still open. See
  Blueprint 2.

## In flight — do not re-propose

- **PR #1** (`company/night-2026-08-21` → `main`): wires the contact form to
  `/api/contact`. Still open, draft, no new commits.
- **PR #2** (`company/night-2026-08-21-freshness-bar` → `main`): implements
  the public freshness bar (`FreshnessBar.tsx`, wired into `SiteLayout.tsx`).
  Still open, draft. **Do not merge yet** — `penny-blueprints.md`'s
  Blueprint 6 gates this on real, unattended `scan_runs` history existing
  first (reconfirmed this pass: still gated on that file's Blueprints 2/3).
- **PR #3** (`company/night-2026-08-22-remove-amazon-claim` → `main`): still
  open, draft, no blockers found. Deletes the "Amazon Warehouse" line from
  `Landing.tsx`, `Welcome.tsx`, `Pricing.tsx`.
- **PR #4** (`company/night-2026-08-23-hero-live-penny` → `main`): adds
  `GET /api/public/penny-spotlight` and wires `Landing.tsx`'s hero to render
  it live, falling back to a labeled static example. Still open, draft, no
  blockers found. **Same merge gate as PR #2.**
- **PR #5** (`company/night-2026-08-24-preview-header-fix` → `main`): fixes
  the header so it never shows "Sign out" and "Create free account"
  simultaneously under `PUBLIC_PREVIEW`. Still open, draft, no blockers
  found. **Does not resolve** whether `PUBLIC_PREVIEW=1` is actually live in
  production, or whether the funnel should be bounded — see Blueprint 2.
- **PR #6** (`company/night-2026-08-25-faq-coverage-sync` → `main`): still
  open, draft — but see the market-snapshot note above. The FAQ fix it was
  built for already shipped directly to `main` in a later commit, and its
  Landing/HowItWorks retailer-copy fix now also has a superseding
  replacement (see Blueprint 1's 2026-08-26 note). BUILD: close PR #6 rather
  than merging or rebasing it.
- **PR #7** (`company/night-2026-08-26-landing-howitworks-retailer-sync` →
  `main`): this run. Rewrites `Landing.tsx`/`HowItWorks.tsx` step 1 to derive
  the retailer list from `retailers.ts` (now 7 retailers: 5 scanned, 2
  community-reported) instead of a hardcoded string. Supersedes PR #6's
  Landing/HowItWorks scope. Still open, draft, no blockers found.

---

## Ranked backlog

### 1. Sync Landing.tsx and HowItWorks.tsx to the real 6-retailer coverage — the gap has doubled since last pass
**status:** in-pr (new PR, this run) — see note below; FAQ portion
already done directly on `main`, Landing/HowItWorks now fixed in-pr

**2026-08-26 BUILD note:** shipped on `company/night-2026-08-26-landing-howitworks-retailer-sync`.
Also found that coverage grew again since this file's last pass — Tractor
Supply landed as a seventh retailer (community-reported, no penny mechanic)
in commits after this file was last written — so the real gap was Landing/
HowItWorks describing a 2-retailer product against an actual 7 (5 scanned +
2 community). Added `SCANNED_RETAILERS`, `COMMUNITY_RETAILERS`, and
`joinNames` to `retailers.ts` and rewrote both files' step-1 copy to derive
the retailer list from `retailers.ts` rather than hand-counting, per this
blueprint's own instruction — so the copy won't go stale again as coverage
keeps growing. **PR #6 is superseded, not extended**: it targeted the same
two files for the old 4-retailer count and predates both Best Buy/DG's
"live" status and Tractor Supply entirely; recommend closing it in favor of
this PR rather than trying to rebase it forward.
**problem:** `web/src/pages/Landing.tsx`'s hero step 1 and
`web/src/pages/site/HowItWorks.tsx`'s matching step both still read, word
for word, *"Home Depot and Lowe's, store by store."* `web/src/lib/
retailers.ts` — the single source of truth used by the store pages, nav,
and footer — has listed Walmart, Target, and now Best Buy as live, plus
Dollar General as community-reported, for days to weeks. `Faq.tsx` was
already corrected (directly on `main`, in the Best Buy commit) to name Home
Depot/Target as per-store-stock and Lowe's/Walmart/Best Buy as chain-wide
pricing — but the hero and the how-it-works page, arguably the two most-read
pages on the marketing site, still describe a 2-retailer product that has
not existed since 2026-08-24. This is the same shape of problem flagged
last pass, except the delta has grown from missing 2 retailers to missing
4, because Best Buy and Dollar General shipped in between.
**what to build:** rewrite `Landing.tsx`'s hero step 1 and `HowItWorks.tsx`'s
step 1 to describe the real lineup, using `retailers.ts` as ground truth
rather than a hand-written list (same approach the FAQ fix already used
successfully) — e.g. distinguish the five scanned retailers (per-store
stock at Home Depot/Target, chain-wide pricing at Lowe's/Walmart/Best Buy)
from Dollar General's community-reported penny layer, so the claim stays
accurate as coverage keeps growing. Do not hand-count retailers in copy
anywhere `retailers.ts` already has the answer.
**why it beats today:** closes a live, worsening factual gap on the two
highest-traffic marketing pages, and converts six real retailers — matching
or beating Hidden Clearances' breadth claim, without inheriting Hidden
Clearances' "verified daily" hand-wave or Scavenger's single-retailer,
trust-disputed scope — into an accurate, stated proof point instead of an
invisible asset.
**effort:** S — copy edits in two files, reusing `retailers.ts` data already
shaped for this (same pattern as the FAQ fix).
**success metric:** grep for "Home Depot and Lowe's" as a coverage claim
returns nothing outside historical/changelog context; Landing and
HowItWorks retailer counts match `retailers.ts`'s live/community count at
all times.

### 2. Decide `PUBLIC_PREVIEW` on purpose — header symptom fixed in PR #5 (unmerged), root decision still open
**status:** partially in-pr (PR #5 fixes the header contradiction, still
unmerged) — parts (a), (c), (d) below still todo
**problem:** `src/api/middleware.ts`'s `loadUser` still grants any anonymous
visitor a full logged-in **reseller-plan** identity when `PUBLIC_PREVIEW=1`
— no signup, no paywall, same feed a $19/mo subscriber gets, no expiry, not
listed in `.env.example`, and still no record of whether it's live on the
production Railway deploy. PR #5 fixes the one first-hand-confirmed symptom
but is explicitly frontend-only. `Landing.tsx`'s primary CTA ("Start
hunting") still routes straight to `/app`, not `/signup` — confirmed
unchanged this pass — so the full product is still reachable without ever
asking for an email.
**what to build:** (a) confirm today whether `PUBLIC_PREVIEW=1` is set on
the production deploy — needs the founder; no sector in this repo can check
the live Railway env from here; (b) merge PR #5 — nothing further needed on
the header once merged; (c) if kept as a deliberate funnel, bound it the
way a legitimate free-preview mechanic is bounded (delayed feed, capped
results, visible upgrade prompt) rather than granting unlimited paid-tier
access — a product/gating decision, not a copy fix; (d) write the decision
down, dated, so it isn't an open toggle again next pass.
**why it beats today:** merging PR #5 closes the one symptom with concrete
evidence of harm; (a) and (c) close the actual risk underneath it, which no
amount of frontend polish substitutes for.
**effort:** S to merge PR #5 and get the founder's same-day env check; M if
scoping a fully bounded preview tier.
**success metric:** PR #5 merged; dated decision recorded for (a)/(c); if
kept as a funnel, preview traffic is visibly capped vs. paid with a
measurable preview→paid conversion path.

### 3. Public live-scan freshness bar — ship once real data backs it
**status:** in-pr (PR #2) — code done, merge gated
**problem:** unchanged in substance — this is still the one differentiator
(genuine machine-swept, timestamped per-store data) that Hidden Clearances'
"verified daily" claim and Scavenger's disputed-trust scanning claim can't
be told apart from without proof on the page. Build side is done; what's
missing is real `scan_runs` history, tracked in `penny-blueprints.md`
Blueprint 6 (renumbered from Blueprint 1 last pass — still gated on that
file's automation Blueprints 2/3).
**what to build:** nothing new on the frontend. BUILD: merge PR #2 only
after `penny-blueprints.md`'s automation is producing real, unattended
scan history — check that file's dated results before re-promoting this.
**why it beats today:** a live, updating timestamp is something no
crowdsourced or trust-disputed competitor can fake without becoming an
actual scanner — but only once it's showing real numbers.
**effort:** S (a merge) once unblocked.
**success metric:** freshness bar live in production showing a real,
sub-26h timestamp, ≥95% of days.

### 4. Real-data landing hero — ship once real data backs it
**status:** in-pr (PR #4) — code done, merge gated
**problem:** `Landing.tsx`'s hero used to be permanently hardcoded; PR #4
fixes the code path (real endpoint, real fallback labeling) but the
underlying honesty problem — is there ever a real penny find to show — is
the same one gating Blueprint 3, and for the same reason.
**what to build:** nothing new. BUILD: merge PR #4 on the same gate as PR
#2. Verify at merge time that the fallback copy ("Example — not a live
report yet.") is honest today and stays honest until real finds exist.
Once merged, coordinate with Blueprint 1 so the hero's retailer framing
and its live-find example stay consistent with each other.
**why it beats today:** pairs with Blueprint 3 — together they turn the
hero and the freshness bar from claims into one consistent live demo, once
both are true at the same time.
**effort:** S (a merge) once unblocked.
**success metric:** hero renders a real find on ≥80% of loads during active
scan hours once merged; zero "the example never changes" reports.

### 5. Answer "why pay when it's free/cheap elsewhere?" head-on
**status:** todo — unchanged since last pass, now with a third independent
source backing the same edge
**problem:** `Faq.tsx`'s "How is this different from the free tools?" entry
argues from the profit-tracking angle only, names zero competitors, and
never mentions the data-freshness/automated-scan distinction. This pass's
research adds a dedicated scam-warning writeup to the existing trust-score
and trial-to-$47 complaint pattern already on file — three independent
sources now describe the same "pay first, verify later" risk on a rival
that markets itself as "scanning."
**what to build:** sharpen the existing FAQ entry (or add a second one)
with the specific tradeoff: most alternatives are broad, crowdsourced, ask
you to pay before you can tell if a deal is real, or make an unverifiable
"9,000+ stores, verified daily" claim. deal-engine covers six retailers
with a machine-swept, timestamped scan (five) plus labeled community
reports where scanning is structurally impossible (Dollar General),
checked against confirmed outcomes (`src/engine/reputation.ts`). Describe
the pattern, don't name any competitor directly — these allegations aren't
independently verified by this repo, and naming a rival in a scam-adjacent
context is real legal/reputational risk for a five-person company. Link to
the freshness bar (Blueprint 3) as proof once it's live with real data.
**why it beats today:** the profit-angle answer is good but incomplete —
leaving the data-freshness/trust objection unanswered means the prospect
who came specifically comparing scan quality still leaves unconvinced.
**effort:** S — editing an existing entry, not building a new page.
**success metric:** FAQ entry names the crowdsourced/pay-to-verify-vs-
automated tradeoff explicitly, without naming a competitor; track
conversion delta for visitors who read it, if analytics are wired.

### 6. Surface founding-seat scarcity before checkout, not during it
**status:** todo — unchanged since last pass
**problem:** `web/src/pages/site/Pricing.tsx` shows real `seats_left` out
of 30 for the reseller plan; `web/src/pages/app/Welcome.tsx`'s PathPicker —
the earlier, higher-traffic decision point — still shows static
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

### 7. Close out the last small design-debt items in this file's scope
**status:** todo — unchanged since last pass; most of the earlier list is
now owned/handled by the `sbb/` cycle instead
**problem:** two items remain that are squarely marketing/UI-copy scope
rather than the SBB cycle's general polish sweep: `web/src/pages/app/
RetailerDeals.tsx` has no `onError` handler for an `image_url` that 404s at
render time (reconfirmed this pass — still no `onError` in that file),
so a broken link still shows a broken-image icon instead of falling back
to the placeholder SVG `AllDeals.tsx` already uses (`web/DESIGN_AUDIT.md`
P2-6); `Palettes.tsx` is still an unrouted scratch page.
**what to build:** add an `onError` handler on the `<img>` in
`RetailerDeals.tsx` that swaps to the same placeholder SVG `AllDeals.tsx`
already falls back to on a missing `image_url`; delete or explicitly route
`Palettes.tsx`.
**why it beats today:** small, zero-risk, prevents a broken-image state
from being a new user's first impression of a retailer deals page — now
covering six retailers' worth of card images instead of two.
**effort:** S
**success metric:** no broken-image icon reachable in
`/app/deals/:retailer` even when `image_url` 404s; `Palettes.tsx` no
longer an orphaned file.

### 8. Capture demand outside San Antonio's *scored* coverage
**status:** todo — hold pending the ZIP-sensitivity question raised in
`sbb/2026-08-24-blueprints.md` (unresolved as of this pass)
**problem:** `coverage.ts` still gates meaningful penny *scores* to 782xx
ZIPs with 14+ days of history — unchanged and still correct. Whether the
national deal-browse feed itself actually varies by ZIP the way "browse
nationwide" implies is still an open question this file cannot resolve
(backend/product-logic call, tracked elsewhere). Note: the recent
"app-level ZIP in the top bar" ship (25-mile stock-check radius) is a
different feature and does not resolve this question either way.
**what to build:** hold until the ZIP-sensitivity question is resolved.
Once resolved: when a visitor is outside 782xx and hits the coverage-gated
score view, show a lightweight "tell us where you are, we'll email you when
scored coverage arrives" capture (ZIP + optional email). Roll up top
requested ZIP prefixes on `Admin.tsx`.
**why it beats today:** turns a dead end into lead data for the next metro
pick — but only once the thing it's built on top of is confirmed to work
as described.
**effort:** M
**success metric:** waitlist table populated; ranked next-metro candidate
list exists after 30 days of the capture being live.

---

## Bigger strategic bets (not one-PR items — for planning, not immediate build)

### 9. Multi-metro expansion
**status:** todo (blocked on Blueprint 8's demand data + the lead-time
constraint documented in `coverage.ts` and `penny-blueprints.md` — new
metro scoring needs ~14+ days of real scan history before it can be sold
honestly).

### 10. Reposition pricing/marketing around "cheapest verified data," not premium
**status:** todo
Unchanged thesis, now with a stronger hand: at $9.99/$19, deal-engine
already undercuts Deal Soldier, Scavenger, BrickSeek Extreme, and Penny VIP
— and now covers six retailers (five scanned, one community-reported) with
genuinely fresh, machine-swept data where scanning is possible, against a
market where the best-known "automated" competitor carries a public trust
problem documented by three independent sources. The marketing story should
be "cheapest tool that's actually verified fresh, across the most honestly
labeled retailer set," not "worth paying more for." Touches Landing,
Pricing, How It Works simultaneously; scope as its own review, not folded
into the smaller copy fixes above. Blueprint 1 (this pass) is a necessary
first step, not a substitute for this.

### 11. Deepen the profit layer with resale-comp suggestions
**status:** todo
`Profit.tsx` / `src/resell/fees.ts` compute real net/ROI after the sale. The
open step is suggesting an expected resale range at find-time, before
purchase — closing the loop from "here's a penny find" to "here's whether
it's worth your gas money," which none of the named competitors do. Needs a
resale-comp data source decision before this is buildable as PRs.
