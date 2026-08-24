# SBB Cycle 3 — BLUEPRINTS (2026-08-24)

Five advisors ran concurrently on `2026-08-24-spotted.md` (38 items):
Contrarian, First Principles, Expansionist, Outsider, Executor. Peer review
was **run in effect but not as a separate round** — the advisors clashed hard
enough on one item that the chairman resolved it by measurement instead of by
opinion, which is the stronger form of the same check.

---

## The clash, and how it was settled: S2 is REFUTED

Three advisors (First Principles #3, Outsider #1, Expansionist #4) wanted the
"invisible discount number" fixed tonight. The Outsider called it a
close-the-tab defect. Two advisors who read the source (Contrarian, Executor)
refused, and named it the trap.

`web/src/dashboard.css:922-927`:
```css
/* Under 40% — hollow. Present, honest, and visibly the shallowest cut. */
.card-off.tier-light .off-n {
  color: transparent;
  -webkit-text-stroke: 1.5px var(--ink);
}
```

**Chairman's measurement on the live site, before any build:**
```
color: rgba(0,0,0,0)   webkitTextFillColor: rgba(0,0,0,0)
webkitTextStrokeWidth: 1.5px   webkitTextStrokeColor: rgb(17,17,17)
fontSize: 34px   rect: 42x28   --ink: #111111   theme: light
count: 13   sampleText: ["38","38","37","35","35"]
```

The property parsed and resolved: the numeral is painted as a 1.5px black
outline on `#FAFAF7` paper. It is **hollow by design**, the bottom rung of a
four-tier ladder (`AllDeals.tsx:239` — grail ≥80 / deep ≥60 / mid ≥40 /
light else). The inspector's contrast script sampled `color` and
`-webkit-text-fill-color` only; it has no way to see outline paint, so a
correctly-rendering hollow glyph will *always* read 1.00:1 to that instrument.

Building the "fix" would have given every 25-38% deal a solid 34px/900 numeral
— making the shallowest cuts look exactly like the 90% ones. **That is the
second cycle running in which verification overturned a top-ranked council
finding.** S2 is closed as a measurement false positive, not a defect.

*Residual, not built:* the contrast script cannot see stroke paint. Worth
teaching the ux-sweep checklist to read `-webkit-text-stroke-width` before
calling a transparent fill a failure. Queued as a tooling fix, not a site fix.

---

## Where the advisors actually converged

- **S1 (the ZIP does nothing) is the real #1 and cannot be built tonight.**
  All five said so independently. `/api/deals/nearby` returns the same 12
  deals in the same order for San Antonio, Bozeman, and Adak — a server-side
  query defect in the data path. Three advisors proposed an honesty-only
  frontend slice (render the `/api/coverage` message the app already fetches
  and never shows). The chairman defers even that: the coverage banner is
  gated inside the empty-state branch at `AllDeals.tsx:1030`, and the feed
  never returns empty, so hoisting it means touching the feed's render
  condition — the one path that decides what all 53 cards say. Not at 3AM
  with no screenshots. **Queued as next cycle's #1.**
- **S5 (header shows "Create free account" beside "Sign out") is inside the
  auth guardrail.** Four advisors wanted it; the Outsider ranked it the #2
  close-the-tab item. The Executor's read is decisive: `PUBLIC_PREVIEW` makes
  `/api/auth/me` return a real `user_id:1` session, so any fix changes how the
  app decides who is signed in. **Refused under the hard constraint. Logged as
  a founder proposal below.**
- **The copy-truth cluster (S7 score, S8 coverage, S13 hero, S28/S29 pricing
  and FAQ) is one deliberate pass with a human, not a grab-bag overnight.**
  Contrarian, First Principles, and Executor all warned that a partial rewrite
  adds a fifth inconsistent answer. Narrow, self-contained slices are the
  exception — see B3.
- **Nothing gets an accent color.** First Principles wanted visible form
  errors and explicitly refused to add a red token, proposing weight + a glyph
  instead. THE TAPE holds.

---

## Ranked blueprint

### B1 — Community reports stop leaking past the search box and the store rail
**Problem (S19, S20-adjacent).** The two community blocks render from their own
arrays and are gated on `tab` alone. Searching `zzzzqqqq` prints "Nothing
matches those filters" **above three live cards**; `?store=target&tab=penny`
prints 54 cards every one of which says `PENNY | Home Depot`. This is cycle
2's queued #1 ("search is dead on the Penny tab"), now root-caused exactly.
**Exact change.** `web/src/pages/AllDeals.tsx` — two derived arrays beside the
existing `sortedPennyReports` memo, applying the same store scope the
clearance block already has (`AllDeals.tsx:1064`) plus the search term; the
two render guards and the empty-state condition switch to them. The `shown`
memo — the verified feed's render-critical path — is not touched.
**Files.** `web/src/pages/AllDeals.tsx` only.
**Risk.** LOW — additive, community-only, `.filter` on an already-typed array.
**Effort.** ~20 min. **Effect.** Experience: the filters finally mean what
they say. Conversion: a feed that contradicts its own empty state reads as
broken.

### B2 — The 14px sort target and the 20px mobile overflow
**Problem (S21, S22).** `.sortbox` is a 38px box whose `select` collapses to
its 12px line box, so 24px of the control is dead chrome — the whole sort UI
is a 14px tap target on a phone-first product. Separately `.rail-item` is
`flex: 1 1 0` with the default `min-width: auto`, so `flex-shrink` is inert,
the `text-overflow: ellipsis` at `sidebar.css:130` can never fire, and the
rail pushes the document 20px past a 375px viewport — clipping Lowe's, the
newest retailer.
**Exact change.** `web/src/dashboard.css` — `align-self: stretch` on
`.sortbox select`. `web/src/sidebar.css` — `min-width: 0` on the mobile
`.rail-item`. Two declarations.
**Files.** `web/src/dashboard.css`, `web/src/sidebar.css`.
**Risk.** LOW — CSS-only; typecheck cannot regress on it.
**Effort.** ~10 min. **Effect.** Experience, on the device this product is
actually used from: a Home Depot parking lot.

### B3 — The Lowe's truth pass
**Problem (S6, S9).** Three separate false or broken claims about one
retailer. `/app/d/lowes/...` renders **`Verified against Lowe's's own
store-level data`** — a double possessive, and "store-level" is the one
genuinely false word in the sentence, because `retailers.ts:70` already states
on the record that Lowe's returned the same count at every store and *"we will
not print it as one."* And `/stores/lowes` badges **"Live, with in-store
stock"** two inches above that same paragraph.
**Exact change.** `web/src/pages/DealPage.tsx:225-227` — a possessive helper
(names ending in `s` take a bare apostrophe) and a per-retailer noun so Lowe's
reads "published markdown data". `web/src/lib/retailers.ts:54` — Lowe's
`coverage: 'in-store'` → `'online'`, which the existing `COVERAGE_LABEL` map
already renders as "Live, online prices only" — matching the page's own
`weCannot` copy. `live = coverage !== 'planned'` stays true, so nothing else
branches.
**Files.** `web/src/pages/DealPage.tsx`, `web/src/lib/retailers.ts`.
**Risk.** LOW — copy and one enum value; no new request, no API change.
**Effort.** ~15 min. **Effect.** Conversion: this is the honesty the product
sells itself on, contradicted on its own retailer page.

**Not extended to Home Depot or Target, deliberately.** The Executor
established that `source` is *seed* provenance, not price provenance —
`src/engine/discovery.ts:174` re-judges a pennycentral-seeded candidate
against Home Depot's own answer before it can publish, and Target rows come
from RedSky directly with real per-store counts. Keying the sentence on
`source === 'pennycentral'` would have told a Home Depot customer their
HD-verified deal came off a third-party list — **a new falsehood**. S6's
"printed over third-party records" framing is partly wrong; only the Lowe's
clause is actually false.

---

## Blueprinted, explicitly NOT built tonight

| # | Item | Why not |
|---|---|---|
| P1 | **S1 — make the ZIP work** | Backend query defect. Blast radius = every card's stock line. Next cycle's #1. |
| P2 | **S5 — header dual identity** | Auth guardrail. Needs a founder decision on how PUBLIC_PREVIEW presents itself. |
| P3 | **S25/S26 — OG tags, robots.txt, sitemap.xml, favicon** | The Expansionist's compounding move and near-zero risk (`express.static` runs before the SPA catch-all, so `web/public/` files serve as-is). Cut only because the budget is three. **Queued #2.** |
| P4 | **S20 — tab counts** | `all` excludes `pennyReports` while `penny` adds them, so the subset outruns its superset. Correct ~15-line memo fix; a fourth item. **Queued #3.** |
| P5 | **S15/S16 — form error color, `method="get"`** | Auth surface, and S15 needs an error token the design system does not have. |
| P6 | **S4/S11/S12/S31 — cross-record fabrication** | Server-side record joining. A frontend band-aid hides the join bug instead of fixing it. |
| P7 | **S7/S8/S13/S28/S29 — copy-truth cluster** | One deliberate pass with a human. `/pricing` also carries the billing guardrail. |
| P8 | **S32 — alerts have no UI** | A working backend with no frontend is tempting, but this is a feature launch, not polish. |

---

## Flagged for the founder

**The `preview@deal-engine.local` identity is the largest conversion defect on
the site and I am not allowed to touch it.** Every anonymous visitor receives
`{"plan":"reseller","role":"member","user_id":1}`, so the app renders "Create
free account" and "Sign out" side by side, and the visitor reasonably concludes
they already have an account. The Outsider ranked it #2 of the things that make
a reseller close the tab — *"looks hacked or broken, not preview mode."*
Meanwhile the landing page's largest CTA ("Start hunting", 150x53 solid) points
at `/app`, not `/signup`. A visitor can therefore traverse the entire product
without ever being asked for an email, and be told they are signed in while
doing it. Fixing this is a product decision about what PUBLIC_PREVIEW should
feel like, not an overnight patch — but it is the highest-value item on the
board that is not the ZIP.
