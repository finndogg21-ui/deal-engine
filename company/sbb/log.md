# SBB Cycle log

## Cycle 1 — 2026-08-22 (manual test run)

**Spotted:** 8 items (2 sequential browse agents; see 2026-08-22-spotted.md).
Standouts: zero signup surface in the app (BURN/conversion); landing hero's
fabricated-sounding claim + old-design brand break; 21-state sighting walls;
silent no-ZIP state; founder-mandated detail-page change.

**Blueprinted:** 5-advisor council, converged (peer review skipped per rule);
chairman merged CTA-first vs trust-first by shipping both together. Key
insight (Expansionist): the mandatory penny PAGE is itself the conversion
feature — every penny becomes a shareable URL. See 2026-08-22-blueprints.md.

**Built (commits 34132d3 + title-fix follow-up):**
1. /app/p/:reportId — every penny report is its own shareable page ($0.01
   replay on load, full receipt, sightings, HD store-mode link, trial CTA).
   Side panel removed; cards navigate.
2. Header "Start free trial" CTA (tape-styled).
3. Trust patches: state-wall truncation ("CA, KY, CO +18 more"), titleless
   records read "Home Depot item #<sku>", passive ZIP nudge strip.

**Verified (visibility standard, live prod):** ZIP nudge visible; header CTA
present; states truncated on the Packout card; card click navigates to
/app/p/5 with replay + CTA rendered; back returns to /app with spools. Deploy
b1b74f0d SUCCESS. Code review (low): 0 findings.

**Caught by verification:** title fallback missed — source titles read
"SKU …" without the "HD " prefix my pattern expected. Fixed (regex broadened)
and shipped same cycle.

**Deferred:** landing-page redesign + honest hero swap (full night of its
own, all five advisors concurred); Slickdeals thread-level extraction.

**Guardrails hit:** none. One deploy (+1 micro-fix redeploy).

## Cycle 2 — 2026-08-23 (first scheduled nightly run)

**Spotted:** 33 items (two sequential browser agents: a roleplay customer
journey + an inspector sweep; see 2026-08-23-spotted.md). 9 BURN, 14 MISLEAD,
6 FRICTION, 4 POLISH. The customer would NOT start a trial — not from
disinterest ("the hero and the penny detail page sold me") but because the site
invites an action four other surfaces deny exists, and cannot answer "is it at
my store?".

**Blueprinted:** 5 advisors in parallel; converged on two themes (kill the
trial lie subtractively, get real prices on the first screen) and one clash
(add signup links to marketing, or not). Clash resolved by reading the code:
/signup is NOT the 503 — it takes an email and a password and works. The 503 is
only /pricing's checkout. So: add the entry point, touch /pricing not at all.

**Verification overturned the council's unanimous #1.** All five advisors, and
both spot agents, said "the first viewport has no prices — read hd_discount and
hd_list, they're in the payload." Checked live before building: the cards DO
print a price (faint, `.now.pre-reveal`), and on the five hidden_clearance rows
that fill the first screen `hd_list` is null and `hd_discount` is "0.00" —
building it would have printed "0% off" on the best deals on the site. What the
payload actually holds is better: real clearance_price / clearance_pct on all
five ($7.03 off $29.98, $14.00 off $133.85, $3.00 off $11.98, $3.70 off $31.68,
$44.75 off $189.99 — 75-90% off), every one hidden behind "tap to see it".

**Shipped: 1 of 3 blueprints (commit af4c481).** The trial-claim truth pass —
header CTA "Start free trial" → "Create free account"; "Create free account" +
"Sign in" added to the marketing nav and footer (the site previously had 23
anchors and not one account entry point); the FAQ's "Is there a free trial? Not
yet" rewritten to the verified truth (free, no card, paid plans not open);
the hero's fake "live" dot deleted along with its orphaned CSS. Typecheck clean.
/pricing untouched by design (billing guardrail).

**Not shipped, and why — a concurrent session was writing this repo.** HEAD
moved three times mid-cycle (2a51a05 → 94b8ba4) and dashboard.css + AllDeals.tsx
changed on disk while I worked.
- **B1 (unhide the clearance price) was built and deployed by that other
  session** during my run — commit 94b8ba4, verified live: cards now read
  "AS LOW AS $7.03 / was $29.98 in store / Cheapest at Bitters Rd · scan yours
  to confirm", and "tap to see it" is gone from the page. Dropped from my build.
- **B2 (stop inventing the "was" price) is WRITTEN BUT NOT COMMITTED.** The
  edits sit in the working tree of web/src/pages/AllDeals.tsx — alongside that
  other session's unfinished percentage-as-hero redesign of the same file.
  Committing would have shipped someone else's half-built work at 3AM. Left
  in place for them or for the next cycle. The two edits are: read `hd_list`
  verbatim instead of back-computing `price / (1 - disc/100)` (live right now
  the Stanley 30 oz prints "was $45.92" when the feed's own hd_list says
  $45.49), and make the detail panel's Discount cell fall back to
  `clearance_pct` so hidden-clearance rows stop reading "Unknown" when the row
  itself says 75-90% off.

**Deploy path correction:** the RAILWAY_API_TOKEN in .env is dead — rejected by
`railway whoami`, by `RAILWAY_TOKEN railway status`, and by a direct
backboard.railway.com GraphQL call. The working deploy path is **git push to
origin/main**, which Railway builds automatically (confirmed: the asset hash
changed twice during this cycle as commits landed). No `railway up` was run.

**Verification standard, honestly reported:** screenshots could NOT be captured
this run — `computer{action:"screenshot"}` fails with "the Browser pane is not
displayed, so the page is not compositing frames" in a scheduled headless run,
for me and for both spot agents. Substituted the stricter measurable half:
live-DOM text, `getBoundingClientRect` for actual visibility (not mere DOM
presence), and the mandated computed `color` vs `backgroundColor` contrast
check in both themes. Recorded in the Phase R report.

**Queued next, in order:** (1) search is dead on the Penny tab — root-caused
this cycle: `shown` filters `rows`, but the Penny tab renders `pennyReports` as
a separate list (AllDeals.tsx:832-841) that never passes through the filter;
(2) B2 above, if the other session has not taken it; (3) the Expansionist's
compounding move — replace the hero's unverifiable anecdote with a real record
from the feed the SPA already loads, linked to its /app/p/:id.

**Guardrails hit:** two. Billing (left /pricing entirely alone despite three
advisors wanting its copy fixed), and the concurrent-writer hazard (declined to
commit a file another session was mid-edit in). One deploy this cycle.

### Cycle 2 — verification record (live prod, no screenshots available)

Deploy path: git push to origin/main → Railway auto-build. Asset went
index-CJrMF7pY.js → index-D5ietoG5.js, confirming af4c481 + f5b1917 shipped.

**B3 (commit af4c481) — VERIFIED LIVE:**
- Marketing nav renders, in order: How it works, Pricing, Stores, FAQ,
  **Sign in** (/signin), Open the app, **Create free account** (/signup).
  Footer carries /signup and /signin too. The site went from 23 anchors with
  zero account entry points to 27 with four.
- Landing eyebrow reads "San Antonio, watching 5 stores"; `.live` dot element
  count on the page is **0**. Orphaned CSS rule deleted with it.
- App header CTA reads "Create free account". `/free trial/i` matches **nothing**
  on the app page. The four-surface contradiction is closed.
- 375px: no horizontal overflow, zero offscreen elements, every nav tap target
  50-52px (≥44 minimum). Cost noted honestly: the nav now wraps to 3 rows on
  mobile and the hero starts at y=246 instead of y~190. Still well above fold.

**B2 (rode in on the other session's commit f5b1917) — VERIFIED LIVE:**
- Stanley 30 oz card now reads "$22.50 / was **$45.49**" — the feed's real
  hd_list. The string "45.92" (the old back-computed figure) appears **nowhere**
  on the page. "Save $22.99" is now arithmetically true.
- Rows where the back-computation happened to agree (the Target $40.00 items)
  are unchanged, as intended.
- The "Discount: Unknown" cell is gone — though credit is shared: the other
  session replaced the old detail PANEL with a detail PAGE
  (/app/d/:retailer/:id) that renders "77 % OFF / AS LOW AS $7.03 / was $29.98
  in store / SAVE $22.95 / Cheapest at Bitters Rd · 11 stores checked". Zero
  occurrences of "Unknown" on that page. My one-line clearance_pct fallback is
  now dead code on that path; the user-facing defect is resolved either way.

**THE CONTRAST CHECK EARNED ITS KEEP — it caught a bug I shipped.**
The new "Create free account" button measured `color rgb(214,214,208)` on
`backgroundColor rgb(250,250,247)` — **1.4:1, an unreadable solid button**,
in BOTH themes. Cause: `.nav-links a` (specificity 0,1,1) outranks `.btn`
(0,1,0), so the nav's --ink-soft overrode the button's --on-accent. The
screenshot I could not take would not have saved me; the computed-style sample
did. Fixed in **commit 76855a8** (`.nav-links a.btn { color: var(--on-accent) }`
plus the quiet and hover variants), typecheck clean, pushed. This is the second
deploy of the cycle and it exists only to repair a defect from the first —
same precedent as cycle 1's micro-fix redeploy.

Every other nav link measured 12.94:1 and was never affected.

**Contrast fix verified live (commit 76855a8, /assets/index-CBWFuy6s.css):**
- DARK: "Create free account" = rgb(17,17,17) on rgb(250,250,247) → **18.06:1**
  (was 1.4:1). 22 nav+footer links sampled, **0 below 4.5:1**, all visible.
- LIGHT: same button = rgb(250,250,247) on rgb(17,17,17) → **18.06:1**.
  22 sampled, **0 below 4.5:1**, all visible. Live dot count 0, eyebrow clean.

**FLAGGED FOR THE FOUNDER — a design-constitution conflict I did not create and
did not revert.** While this cycle ran, the parallel session pushed 010bf28
"Grail tier: spend colour only where the discount earns it", which is live now:
`.card-off.tier-grail { background: rgb(161, 98, 7) }` — amber — on 2 of 38
discount badges (the 80%+ finds), plus an `is-grail` card treatment. THE TAPE
says "No accent color. None. Inversion + weight carry all meaning."
Mitigating facts, stated fairly: it is used sparingly (2 badges), it is
legible (white on amber ≈ 5.6:1), and the reasoning ("spend colour only where
the discount earns it") is a coherent argument for amending the constitution
rather than an accident. But it IS an amendment, and it was not put to the
council. Someone should decide deliberately: amend THE TAPE to allow one
earned accent, or revert the amber to inversion. Not an overnight call.
