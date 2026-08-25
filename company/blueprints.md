# Blueprint backlog — deal-engine

Maintained by the Ideator/Blueprints sector. BUILD executes from the top down.
Each run: re-read the code, open PRs/branches, and competitor state before
rewriting this file — don't re-propose shipped or in-flight work.

**Scope note:** this file covers marketing/UI/pricing/positioning. The
scan/score/verify data-method track has its own file, `company/
penny-blueprints.md` (own pass, most recently 2026-08-25) — don't duplicate
its backlog here. A third track, general UI/UX polish, runs as its own cycle
under `company/sbb/` (most recently `2026-08-24-blueprints.md`) — don't
duplicate its line items either.

**Last pass:** 2026-08-25 (this pass). Previous pass: 2026-08-24.

## Market snapshot (as of this pass)

- **Competitor pricing/positioning: no material change since 2026-08-24,
  reconfirmed by fresh WebSearch this pass.** Hidden Clearances (free, claims
  Amazon/HD/Lowe's/Walmart/Costco/Target, "refreshes every minute," free
  signup, no card required), Scavenger (~$47/mo via a 3-day trial, HD-only,
  "scans every store within 25 miles"), BrickSeek (free basic + Premium
  $14.99/Extreme $29.99), Penny (free + Pro $14.99 + VIP $29.99, HD
  crowdsourced), and Rebel Savings (free, community radius map) all still
  match prior figures.
- **Scavenger's trust problem is now more concrete, not just alleged.** This
  pass's search returns a specific, dated trust score (35/100, ScamAdviser)
  and a clearer pattern: a free or $1 trial converting to $47/mo billed
  through a third-party processor (Whop), plus recurring complaints of login
  loops and non-functional cancellation/support. Still **do not name
  Scavenger directly** in marketing copy — sharpens Blueprint 4's "pay
  before you can verify" framing without needing to name a name.
- Realistic paying market unchanged: ~30k-150k US penny/clearance hunters
  total, San Antonio's share roughly 50-200 people.
- **New this pass — the retailer stack has grown from 2 to 4 live, with a
  5th built and pending, and marketing copy has NOT kept up.** Since last
  pass: Walmart shipped (first-party Clearance-badged markdowns, online-only,
  $0 cost) and Best Buy's adapter is built and code-complete, waiting only on
  an API key (`bestbuy-direct.ts`, official Products API — no scraping).
  Combined with the already-live Target (in-store, per-store counts) and
  Home Depot/Lowe's, `web/src/lib/retailers.ts` — the single source of truth
  used by the store pages, nav, and footer — now correctly lists **four live
  retailers** (Home Depot, Lowe's, Walmart, Target) and Best Buy as
  `'planned'`. But three other surfaces still say only "Home Depot and
  Lowe's": `Landing.tsx`'s hero step 1, `HowItWorks.tsx`'s matching step, and
  — worse — `Faq.tsx`'s "Which stores are covered?" answer states outright
  that "Walmart and Target are planned but not live," which is now simply
  false. A visitor who reads the FAQ, then opens `/stores/walmart` or the
  app, sees the site contradict itself. See Blueprint 1 (new, top of this
  pass) below — this is now the single most actionable, lowest-risk,
  highest-value item in this file: a factual correction, not a judgment
  call, and it turns real coverage growth (4 fresh-scanned retailers,
  matching Hidden Clearances' breadth claim but without the staleness) into
  a stated proof point instead of a hidden asset.
- **Shipped since last pass:** Walmart retailer (see above). PR #5
  (`company/night-2026-08-24-preview-header-fix`) opened, implementing part
  of this file's former #1 (`PUBLIC_PREVIEW` header contradiction) — still
  open/draft, not yet merged to `main`. See renumbered Blueprint 2.

**Standing correction (still true, reconfirmed again this pass):** pricing
is **Consumer $9.99/mo** and **Reseller $19/mo** (founding rate, 30 seats),
not "$75/mo" — confirmed again in `src/vendors/stripe.ts:29-30`,
`web/src/pages/site/Pricing.tsx`. Cheapest genuine-scan-claiming reseller
tool against Deal Soldier, Scavenger, BrickSeek Extreme, and Penny VIP.
(BUILD: `$75/mo` anywhere in code/copy is a bug — none found this pass.)

## What's already shipped that overlaps with the brief's "strategic bets"

- **Profit/margin layer** — done (`Profit.tsx`, `src/resell/fees.ts`,
  `/api/profit`). Resale-comp suggestions (bigger bet #10, below) still open.
- **Public live-scan freshness bar** — code-complete in PR #2, not merged.
  See Blueprint 3.
- **Real-data landing hero** — code-complete in PR #4, not merged. See
  Blueprint 4.
- **Retailer coverage itself** — grew from 2 to 4 live this pass (see market
  snapshot); the gap is now purely that marketing copy hasn't caught up. See
  Blueprint 1.
- **Founding-seat scarcity** — done on `/pricing`, still missing from
  `Welcome.tsx` (reconfirmed this pass — no `seats_left` reference in
  `web/src/pages/app/Welcome.tsx`). See Blueprint 6.
- **Metro-gating honesty for scores** — done (`src/coverage.ts`, 14-day
  floor).
- **`PUBLIC_PREVIEW` header contradiction** — partially fixed in open PR #5
  (frontend-only: never shows "Create free account" beside "Sign out"). The
  underlying gating decision is still open. See Blueprint 2.

## In flight — do not re-propose

- **PR #1** (`company/night-2026-08-21` → `main`): wires the contact form to
  `/api/contact`. Still open, draft, no new commits since last pass.
- **PR #2** (`company/night-2026-08-21-freshness-bar` → `main`): implements
  the public freshness bar (`FreshnessBar.tsx`, wired into `SiteLayout.tsx`).
  Still open, draft. **Do not merge yet** — `penny-blueprints.md` Blueprint
  1/3 gates this on real, unattended `scan_runs` history existing first
  (reconfirmed this pass: that file's own Blueprint 1 is still `todo`, top
  priority, fourth pass running).
- **PR #3** (`company/night-2026-08-22-remove-amazon-claim` → `main`): still
  open, draft, no blockers found. Deletes the "Amazon Warehouse" line from
  `Landing.tsx`, `Welcome.tsx`, `Pricing.tsx`.
- **PR #4** (`company/night-2026-08-23-hero-live-penny` → `main`): adds
  `GET /api/public/penny-spotlight` (unauthenticated, single most-recent
  confirmed penny find) and wires `Landing.tsx`'s hero to render it live,
  falling back to a labeled static example when nothing real exists. Still
  open, draft, no blockers found. **Same merge gate as PR #2** — real
  unattended scan history isn't flowing yet.
- **PR #5** (`company/night-2026-08-24-preview-header-fix` → `main`): new
  since last pass. Implements the header half of the old Blueprint 1 only —
  `AppShell.tsx` now checks `me.email === 'preview@deal-engine.local'` (the
  identity `loadUser` assigns under `PUBLIC_PREVIEW=1`) and shows either
  "Sign out" (real account) or "Previewing — no account yet" + "Create free
  account" (preview) — never both. Frontend-only, no change to gating logic.
  Still open, draft, no blockers found. **Does not resolve** whether
  `PUBLIC_PREVIEW=1` is actually live in production, or whether the funnel
  should be bounded — see Blueprint 2.

---

## Ranked backlog

### 1. Fix the FAQ's now-false "Walmart and Target are planned but not live" — and sync all copy to the real 4-retailer coverage
**status:** todo — new this pass, top priority
**problem:** `web/src/lib/retailers.ts` (the single source of truth for the
nav, footer, store pages, and app sidebar) has correctly listed Walmart and
Target as live since they shipped — but three other surfaces never got the
update. Worst: `web/src/pages/site/Faq.tsx`'s "Which stores are covered?"
answer says outright, *"Walmart and Target are planned but not live, because
we cannot yet get reliable per-store quantities for them."* That statement
is no longer true — Walmart shipped online-only clearance on 2026-08-24 and
Target has been live with per-store counts since 2026-08-23. A visitor who
reads the FAQ and then opens `/stores/walmart`, `/stores/target`, or the app
itself sees the site directly contradict its own FAQ, which is worse for
trust than simply being behind — it reads as either stale or dishonest, and
this is exactly the kind of unforced, checkable claim a skeptical reseller
tests first. Two lower-stakes but same-shaped misses: `Landing.tsx`'s hero
step 1 ("Home Depot and Lowe's, store by store") and `HowItWorks.tsx`'s
matching step both undersell the product by two retailers.
**what to build:** rewrite `Faq.tsx`'s "Which stores are covered?" answer to
list all four live retailers accurately, using each retailer's actual
`coverage` value from `retailers.ts` (Home Depot/Target = in-store per-store
counts, Lowe's/Walmart = online pricing only) rather than a blanket claim;
mention Best Buy as built-and-pending if it reads naturally. Update
`Landing.tsx`'s and `HowItWorks.tsx`'s step-1 copy the same way. Treat
`retailers.ts` as ground truth throughout — don't hand-write a retailer list
anywhere copy touches it.
**why it beats today:** turns a live factual error (bad for trust, no
upside) into a corrected page, and simultaneously converts real, already-built
coverage growth into a stated competitive point: 4 genuinely fresh-scanned
retailers, honestly labeled by what's actually visible at each one, is a
direct answer to Hidden Clearances' breadth claim without inheriting Hidden
Clearances' staleness problem.
**effort:** S — copy edits in three files, reusing `retailers.ts` data
already shaped for this.
**success metric:** zero pages state or imply Walmart/Target are not live;
grep for "Home Depot and Lowe's" as a coverage claim returns nothing outside
historical/changelog context.

### 2. Decide `PUBLIC_PREVIEW` on purpose — header symptom fixed in PR #5, root decision still open
**status:** partially in-pr (PR #5 fixes the header contradiction only) —
parts (a), (c), (d) below still todo
**problem:** `src/api/middleware.ts`'s `loadUser` still grants any anonymous
visitor a full logged-in **reseller-plan** identity when
`PUBLIC_PREVIEW=1` — no signup, no paywall, same feed a $19/mo subscriber
gets, no expiry, not listed in `.env.example`, and still no record of
whether it's live on the production Railway deploy. PR #5 (open, not yet
merged) fixes the one first-hand-confirmed symptom — the header showing
"Create free account" beside "Sign out" simultaneously — but is explicitly
frontend-only and doesn't touch the gate itself. `Landing.tsx`'s primary CTA
("Start hunting") still routes straight to `/app`, not `/signup` —
confirmed unchanged this pass — so the full product is still reachable
without ever asking for an email.
**what to build:** (a) confirm today whether `PUBLIC_PREVIEW=1` is set on
the production deploy — this needs the founder; no sector in this repo can
check the live Railway env from here; (b) **done in PR #5** — merge it,
nothing further needed on the header; (c) if kept as a deliberate funnel,
bound it the way a legitimate free-preview mechanic is bounded (delayed
feed, capped results, visible upgrade prompt) rather than granting unlimited
paid-tier access — this is a product/gating decision, not a copy fix; (d)
write the decision down, dated, so it isn't an open toggle again next pass.
**why it beats today:** merging PR #5 closes the one symptom with concrete
evidence of harm; (a) and (c) close the actual risk underneath it, which no
amount of frontend polish can substitute for.
**effort:** S to merge PR #5 and get the founder's same-day env check; M if
scoping a fully bounded preview tier.
**success metric:** PR #5 merged; dated decision recorded for (a)/(c); if
kept as a funnel, preview traffic is visibly capped vs. paid with a
measurable preview→paid conversion path.

### 3. Public live-scan freshness bar — ship once real data backs it
**status:** in-pr (PR #2) — code done, merge gated
**problem:** unchanged in substance — this is still the one differentiator
(genuine machine-swept, timestamped per-store data) that Penny/Scavenger's
scanning claims (now with a concrete 35/100 trust score attached to one of
them — see market snapshot) can't be told apart from without proof on the
page. Build side is done; what's missing is real `scan_runs` history,
tracked in `penny-blueprints.md` Blueprint 1.
**what to build:** nothing new on the frontend. BUILD: merge PR #2 only
after `penny-blueprints.md`'s automation (Blueprint 1) is producing real,
unattended scan history — check that file's dated results before
re-promoting this.
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
the same one gating Blueprint 3, and for the same reason (`penny-
blueprints.md` Blueprint 1 not yet producing unattended scan history).
**what to build:** nothing new. BUILD: merge PR #4 on the same gate as PR
#2. Verify at merge time that the fallback copy ("Example — not a live
report yet.") is honest today and stays honest until real finds exist.
**why it beats today:** pairs with Blueprint 3 — together they turn the
hero and the freshness bar from claims into one consistent live demo, once
both are true at the same time.
**effort:** S (a merge) once unblocked.
**success metric:** hero renders a real find on ≥80% of loads during active
scan hours once merged; zero "the example never changes" reports.

### 5. Answer "why pay when it's free/cheap elsewhere?" head-on
**status:** todo — unchanged since last pass, now with a sharper, more
specific edge available
**problem:** `Faq.tsx`'s "How is this different from the free tools?" entry
argues from the profit-tracking angle only, names zero competitors, and
never mentions the data-freshness/automated-scan distinction. This pass's
research adds a more concrete edge than before: a specific trust score
(35/100) and a named pattern (trial-to-$47/mo via a third-party processor,
plus cancellation complaints) now attaches to one rival that markets itself
as "scanning," not just a hedge in their own copy.
**what to build:** sharpen the existing FAQ entry (or add a second one)
with the specific tradeoff: most alternatives are broad, crowdsourced, or
ask you to pay before you can tell if a deal is real. deal-engine covers
four retailers deeply with a machine-swept, timestamped scan, checked
against confirmed outcomes (`src/engine/reputation.ts`). Describe the
pattern ("pay first, verify later"), don't name any competitor directly —
these allegations aren't independently verified by this repo, and naming a
rival in a scam-adjacent context is real legal/reputational risk for a
five-person company. Link to the freshness bar (Blueprint 3) as proof once
it's live with real data.
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
render time, so a broken link still shows a broken-image icon instead of
falling back to the placeholder SVG `AllDeals.tsx` already uses (confirmed
still open in `web/DESIGN_AUDIT.md` P2-6, reconfirmed this pass);
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

### 8. Capture demand outside San Antonio's *scored* coverage
**status:** todo — hold pending the ZIP-sensitivity question raised in
`sbb/2026-08-24-blueprints.md` (unresolved as of this pass)
**problem:** `coverage.ts` still gates meaningful penny *scores* to 782xx
ZIPs with 14+ days of history — unchanged and still correct. Whether the
national deal-browse feed itself actually varies by ZIP the way "browse
nationwide" implies is still an open question this file cannot resolve
(backend/product-logic call, tracked elsewhere).
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
— and now covers four retailers (soon five) with genuinely fresh,
machine-swept data, against a market where the best-known "automated"
competitor carries a public 35/100 trust score. The marketing story should
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
