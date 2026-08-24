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

## Cycle 3 — 2026-08-24 (second scheduled nightly run)

**Spotted:** 38 deduped items from two sequential browser agents — a roleplay
customer judging free-trial-worthiness (15) and an inspector sweep including
the signup path (30). 5 BURN, 13 MISLEAD, 16 FRICTION, 4 POLISH. See
`2026-08-24-spotted.md`. The customer would still NOT create an account, and
named the reason precisely: *"I set my ZIP to 78232, and the best deal in the
app is 'Cheapest at Miami (Calle Ocho)' with no distance on any card."*

**Blueprinted:** 5 advisors in parallel. They split 3-2 on what to build
first, and the split was settled by measurement rather than by a peer-review
round — see below. See `2026-08-24-blueprints.md`.

### VERIFICATION OVERTURNED THE COUNCIL AGAIN — second cycle running

Three advisors (First Principles, Outsider, Expansionist) wanted the
"invisible discount number" (S2) fixed tonight; the Outsider ranked it the #1
close-the-tab defect. The inspector had measured `color: rgba(0,0,0,0)` and
`-webkit-text-fill-color: rgba(0,0,0,0)` on 13 of 53 cards and scored it
**1.00:1 in both themes**. Two advisors who actually opened `dashboard.css`
(Contrarian, Executor) refused and called it the trap.

Measured live before building:
```
webkitTextStrokeWidth: 1.5px   webkitTextStrokeColor: rgb(17,17,17)
fontSize: 34px   --ink: #111111   count: 13   ["38","38","37","35","35"]
```
The numeral is painted as a 1.5px black outline on `#FAFAF7` paper — **hollow
by design**, the bottom rung of the four-tier ladder (grail ≥80 / deep ≥60 /
mid ≥40 / light else). The contrast script samples fill only, so a correctly
rendering hollow glyph will *always* read 1.00:1 to that instrument. Building
the "fix" would have given every 25-38% deal a solid 34px/900 numeral,
making the shallowest cuts look identical to the 90% ones. **S2 closed as a
measurement false positive, not a defect.**

*Tooling debt this exposes:* the ux-sweep contrast checklist must read
`-webkit-text-stroke-width` before calling a transparent fill a failure.
Queued as a skill fix, not a site fix.

**Built and shipped: all 3 blueprints (commit 1230b22, deploy 375efbc6
SUCCESS 09:27:42).**

1. **The filters now mean what they say.** The two community blocks rendered
   from their own arrays and answered to nothing but the tab. Both now take
   the store scope the clearance block already carried, plus the search term,
   plus the tab — so the arrays are exactly what is on screen and the empty
   state can read them. `shown`, the verified feed's render-critical memo, is
   untouched. (`AllDeals.tsx`)
2. **The 14px sort target and the 20px mobile overflow.** `.sortbox` is 38px
   but its `select` had no cross-size and collapsed to its 12px line box, so
   24px of the control was dead chrome. `.rail-item` was `flex: 1 1 0` with
   the default `min-width: auto`, so `flex-shrink` was inert, the ellipsis
   could never fire, and three chips pushed the document 20px past a 375px
   viewport — clipping Lowe's, the newest retailer. Two declarations.
   (`dashboard.css`, `sidebar.css`)
3. **The Lowe's truth pass.** The detail page read *"Verified against Lowe's's
   own store-level data"* — a doubled possessive, and "store-level" is the one
   genuinely false word in it, because `retailers.ts` already states on the
   record that Lowe's returned the same count at every store and *"we will not
   print it as one."* Same contradiction on `/stores/lowes`, badged "Live,
   with in-store stock" two inches above that paragraph. Lowe's is now
   `'online'`. Home Depot and Target genuinely are store-level and keep the
   wording. (`DealPage.tsx`, `retailers.ts`)

**Not extended to Home Depot or Target, deliberately.** The Executor
established that `source` is *seed* provenance, not price provenance —
`discovery.ts:174` re-judges a pennycentral-seeded candidate against Home
Depot's own answer before it can publish. Keying the sentence on
`source === 'pennycentral'` would have told a Home Depot customer their
HD-verified deal came off a third-party list — a NEW falsehood. Spotted item
S6's "printed over third-party records" framing is partly wrong; only the
Lowe's clause was actually false.

**Code review caught two defects in my own diff, both fixed before commit:**
- `possessive("Lowe's")` returned `Lowe's’` — replacing the original typo with
  a different one. A brand name ending in s absorbs the genitive ("Lowe's own
  data"), which is what shipped.
- The first draft of `communityScope` was not tab-scoped, so a non-empty
  clearance list would have silenced the empty state on the `near` tab —
  a blank feed with neither cards nor a message. Scoped to the tab before
  typecheck.

### Cycle 3 — verification record (live prod, no screenshots available)

Screenshots still fail in a scheduled headless run (`the Browser pane is not
displayed, so the page is not compositing frames`) — for me and for both spot
agents. Substituted the stricter measurable half, as in cycle 2.

Bundle `index-BRRhAOnr.js` → **`index-B5I8UdyQ.js`** / `index-8h9VeYVM.css`.

**Build 1 — VERIFIED:**
- Search `zzzzqqqq` on `/app?tab=all` → **0 cards**, empty state reads
  "Nothing matches those filters…", `communityHeads: []`. Before: 3 cards
  still rendered underneath that same notice.
- `/app?store=target&tab=penny` → **0 cards**, honest empty state. Before: 54
  cards, every one `PENNY | Home Depot`.
- Clearing the search restores **55** cards.
- No regressions: `/app?tab=penny` (the DEFAULT view) still renders 54 cards
  with "Community penny reports"; `/app?tab=all` renders 55 with "Community
  clearance reports".

**Build 2 — VERIFIED, desktop and 375px:**
- Sort select **15px → 36px** inside its 38px box (desktop and mobile).
- 375px: `documentElement.scrollWidth` **395 → 375**, horizontal overflow
  **20px → 0**. `.rail` overflow **44px → 0**. All three chips on screen at
  93px each; Lowe's right edge **395 → 335**. `offscreen: 0`.

**Build 3 — VERIFIED:**
- `/app/d/lowes/5014566057` → "Verified against **Lowe's own published
  markdown data**, not a third-party list." `Lowe's's` matches nothing;
  `Lowe.s own store-level data` matches nothing.
- `/app/d/homedepot/324763342` → "Verified against Home Depot's own
  store-level data" (unchanged, correct).
- `/app/d/target/94939711` → "Verified against Target's own store-level data"
  (unchanged, correct).
- `/stores/lowes` header badge (y=643) → **"Live, online prices only"**. The
  "Other stores" block below still correctly reads Home Depot and Target as
  "Live, with in-store stock" and Walmart as "Not live yet".

**Contrast check on every element touched, BOTH themes — 0 failures.**
DARK: sort select `rgb(250,250,247)` on `rgb(17,17,17)` = **18.06:1**, h=36,
visible; all three rail items 18.06:1, h=45. LIGHT: sort select
`rgb(17,17,17)` on `rgb(250,250,247)` = **18.06:1**; rail items 18.06:1.
Sort label 7.45:1 dark / 6.80:1 light (untouched, passing).
Every app-originated request returned **200** (`/api/deals/published`,
`/api/coverage`, `/api/community-deals`, `/api/auth/me`, `/api/scan/health`,
`/api/stats/hit-rate`, `/api/deals/nearby`). The console 404/400/401 entries
in the tab are stale probe fetches from the spot agents, not app traffic.

### DEPLOY PATH — cycle 2's conclusion was wrong, and this run corrects it

Cycle 2 recorded "the working deploy path is git push to origin/main, which
Railway builds automatically." **That did not happen tonight.** Commit
1230b22 sat on `origin/main` for 30+ minutes with the site still serving
yesterday's bundle; `railway deployment list` showed the most recent
deployment as `af52db75` at **2026-08-23 21:22** — no build queued for today
at all.

Cycle 2 also recorded the CLI as unusable. Half right: the
**`RAILWAY_API_TOKEN` in `.env` is still dead** (`railway whoami` →
Unauthorized, re-confirmed tonight), but the CLI holds a **valid interactive
user session** — `railway whoami` with no env var returns
`Logged in as finndogg21@gmail.com`. The repo simply was not linked.

Working path, for future cycles:
```
railway link --project deal-engine --service web --environment production
railway up --ci --service web --environment production
```
That produced `375efbc6 | SUCCESS | 2026-08-24 09:27:42` and the new bundle.
`.gitignore` already excludes `node_modules/`, `dist/` and `.env`, so the
upload is clean. **Do not trust git-push-to-deploy without checking
`railway deployment list` for a build that actually started.**

**Queued next, in order:** (1) **S1, the ZIP does nothing** —
`/api/deals/nearby` returns the same 12 deals in the same order for San
Antonio, Bozeman AND Adak, including for ZIPs where it has itself determined
`nearby_stores: 0`; `/api/coverage` returns an honest "we do not cover you
yet" message on every load that nothing renders. Backend, and it is the single
reason the customer said no. (2) OG/Twitter tags + `robots.txt` +
`sitemap.xml` + favicon — the Expansionist's compounding move, near-zero risk
(`express.static` runs before the SPA catch-all), cut only for budget.
(3) S20, the tab counts: `all` excludes `pennyReports` while `penny` adds
them, so the subset outruns its own superset (52 vs 54 measured live tonight).

**Guardrails hit:** three. Auth (refused S5, the header showing "Create free
account" beside "Sign out" — four of five advisors wanted it, and it is the
biggest conversion defect I am not allowed to touch; flagged below). Billing
(`/pricing` untouched again). Data pipeline (refused S1, S3, S4, S11, S12 —
all upstream). One deploy this cycle, and no micro-fix redeploy was needed.

**Concurrent-writer hazard, handled cleanly this time.** `origin/main` moved
three commits during the cycle (`2a89764` → `592449f`, penny/retailer recon
docs). Zero file overlap with my changes, so a rebase was safe — verified
with `git diff --stat HEAD...origin/main` before rebasing rather than
assuming.

### FLAGGED FOR THE FOUNDER — the biggest conversion defect is behind a guardrail

Every anonymous visitor receives `{"user_id":1,"email":
"preview@deal-engine.local","plan":"reseller","role":"member","zip":null}`
from `/api/auth/me`. The app therefore renders **"Create free account" and
"Sign out" side by side** in the same header (measured: x=911 and x=1138,
both visible), and a visitor reasonably concludes they already have an
account. The Outsider ranked it #2 of the things that make a reseller close
the tab — *"looks hacked or broken, not preview mode."* Compounding it, the
landing page's largest CTA ("Start hunting", 150x53 solid black) points at
`/app`, not `/signup` — so a visitor can traverse the entire product without
ever being asked for an email, while being told they are signed in.

This is a product decision about what PUBLIC_PREVIEW should feel like, not an
overnight patch, and it sits squarely inside the auth guardrail. It is the
highest-value item on the board that is not the ZIP. Both need a human.
