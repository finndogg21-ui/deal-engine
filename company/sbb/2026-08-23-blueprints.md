# SBB Blueprints — 2026-08-23 (cycle 2)

Council: 5 advisors (Contrarian, First Principles, Expansionist, Outsider,
Executor), run in parallel, no peer-review round — they converged hard on two
themes and the one clash was resolvable from evidence.

## Where the council converged

- **All five** put the free-trial contradiction (issue 1) in their top 3, and
  **four of five** said resolve it SUBTRACTIVELY: there is no trial, so delete
  the claim rather than making four surfaces agree on a fiction.
- **All five** put "the first screen must show real prices" in their top 3.
- **All five** said: never back-compute a "was" price from a rounded discount
  (issue 15) — read the real field or print nothing.
- **All five** vetoed: wiring the ZIP (pipeline), the theme-flip bug (issue 30,
  unconfirmed), sort/filter/pagination (issues 22/28, a feature not a fix), and
  anything touching billing or auth.

## The one clash, and the chairman's resolution

**Contrarian** argued against adding a signup link to the marketing site: "a
door into a room with no floor" — /pricing's checkout returns 503, so pushing
visitors down that path converts a soft maybe into a hard no. The other four
wanted the link added.

**Resolved by evidence, in the Contrarian's favour on the part that mattered.**
`/signup` is *not* the 503 — reading `web/src/pages/site/Auth.tsx`, SignUp is
email + password only, no payment field, and it creates a real working account.
The 503 lives only in `/pricing`'s checkout button. So: add the entry point to
the free account (real, working, honest), and **do not touch /pricing at all**
tonight — no relabelled buy button, no rerouting to signup. That respects the
billing guardrail strictly and still gives the site the entry point it lacks.

## Where the council was WRONG, and how verification caught it

The council's unanimous #1 was "issue 6 — the first viewport has no prices; read
`hd_discount`/`hd_list`, they're already in the payload." Both spot agents
asserted it. **Checked against the live API and DOM before building — it is
wrong on both halves:**

1. The clearance cards **do** print a price: `$29.98 / Regular price`, rendered
   faint via `.card-price .now.pre-reveal { color: var(--ink-faint) }`. Not
   missing — de-emphasised.
2. On the five `hidden_clearance` rows that fill the first screen, `hd_list` is
   **null** and `hd_discount` is **"0.00"**. Building the council's fix would
   have printed "0% off" on the best deals on the site. The inspector had
   sampled a *different* row (a Target row) and generalised.

**What the live payload actually holds is better than what the council asked
for.** All 5 hidden_clearance rows carry a real `clearance_price`,
`clearance_pct`, `clearance_store` and `clearance_stores_checked`:

| Item | Regular | Clearance | Off | Store | Stores checked |
|---|---|---|---|---|---|
| RGBWIC Outdoor Strip Light | $29.98 | **$7.03** | 77% | Bitters Rd | 11 |
| Red Oak Hardwood Flooring | $133.85 | **$14.00** | 90% | Miami (Calle Ocho) | 11 |
| PACKOUT 4" Straight Hook | $11.98 | **$3.00** | 75% | Bitters Rd | 11 |
| Premium Flashing Tape | $31.68 | **$3.70** | 85% | Miami (Calle Ocho) | 11 |
| Philips Hue Gradient Strip | $189.99 | **$44.75** | 76% | Miami (Calle Ocho) | 11 |

These are the five best deals on the site. **Every one of them is hidden behind
a "tap to see it" click**, and the number the card shows loudly is the *regular*
price. Issue 31 ("the reveal pays off with the price you already had") is
refuted for the current data — the payoff is a 75–90% markdown. The real defect
is the inverse of what was reported, and it is worse.

## Build tonight (3 items, all low-risk frontend)

**B1 — Unhide the clearance price.** *Problem:* the site's five strongest finds
sit behind a reveal gate, and the card's loud number is the regular price, so
the first screen advertises full price. *Change:* drop the `revealed` gate in
`Card` — render the already-existing revealed branch directly ("As low as
$7.03 / was $29.98 in store / Cheapest at Bitters Rd · scan yours to confirm").
Every hedge word is kept verbatim; nothing new is claimed. *Files:*
`web/src/pages/AllDeals.tsx` (Card). *Risk:* LOW — deleting a gate on a branch
that already ships and is already reachable by one click. *Effect:* CX + CONV,
the largest available. Endorsed in substance by all five advisors ("put prices
on the first screen" — Outsider).

**B2 — Stop inventing the "was" price.** *Problem:* the published-feed mapping
computes `list = price / (1 - disc/100)`, which disagrees with the real
`hd_list` the same payload carries — live right now, the Stanley 30 oz prints
**was $45.92** when `hd_list` is **$45.49**. `saves` inherits the error.
*Change:* read `hd_list` verbatim; when it is absent, render no "was" line and
no `saves` rather than a computed one. Also stop the detail panel printing
"Discount Unknown" on hidden-clearance rows when `clearance_pct` (75–90%) is
right there. *Files:* `web/src/pages/AllDeals.tsx` (mapping + detail cell).
*Risk:* LOW, display-only, verifiable against the API to the cent. Unanimous.

**B3 — The trial-claim truth pass.** *Problem:* the app header promises a free
trial that /faq denies, /signup never mentions, and /pricing cannot sell; and
the marketing site has zero account entry points across 23 anchors. *Change:*
(a) header CTA "Start free trial" → "Create free account"; (b) add "Create free
account" + "Sign in" to the marketing nav and footer; (c) rewrite the FAQ answer
to the verified truth — accounts are free, no card, paid plans not open yet
(verified against Auth.tsx: SignUp takes email + password only); (d) delete the
landing hero's fake `<span className="live" />` dot, which is both a fabricated
liveness signal and a colour (`var(--go)`) on a pure black-and-white system.
*Files:* `AppShell.tsx`, `SiteLayout.tsx`, `site/Faq.tsx`, `Landing.tsx`,
`site.css`. *Risk:* LOW — strings, anchors, one deletion. **Explicitly NOT
touching /pricing** (billing guardrail; see the clash resolution above).

## Queued for the next cycle (root-caused tonight, not built)

- **Search dead on the Penny tab (issue 8) — root cause found.** `shown` filters
  `rows`, but the Penny tab renders `pennyReports` as a separate list
  (`AllDeals.tsx:832-841`) that never passes through the filter. Fix is to apply
  the same `q` term to `pennyReports` at render. Held only because tonight's cap
  is three. **This is next cycle's first build.**
- **Expansionist's compounding move:** replace the landing hero's unverifiable
  anecdote with a real record from the feed the SPA already loads, linked to its
  `/app/p/:id`. Turns the highest-traffic surface into a funnel to the one page
  that converts. Needs a copy pass, so it deserves its own night.
- **Expansionist's "Penny Pass"** — an inverted take-to-the-store slab on
  `/app/p/:id` (SKU/Model/UPC large, copy button, the three-step scan script).
  Designed to be the screenshot that gets pasted into penny groups.
- ZIP honesty relabel (issues 4/5/12/27), the Lowe's "Live" mislabel (13),
  /pricing copy incl. "30 of 30 seats left" (18), the missing placeholder SVG
  (10), "Find stock" → nonexistent watchlist (9), mobile above-the-fold (20).

## Deliberately NOT built (with reasons)

- **Anything in /pricing or checkout** — billing guardrail, unanimous.
- **Wiring or validating the ZIP** — the feed is ZIP-independent upstream; every
  frontend "fix" either fabricates a distance or upgrades an inert control into
  a lying one (Contrarian's strongest point, seconded by Expansionist).
- **The theme-flip contrast bug (30)** — PLAUSIBLE not confirmed, needs an
  OS-level scheme flip with no reload, clean on fresh load in both schemes.
  Speculative edits to CSS custom properties with 220 elements downstream is the
  highest-blast-radius change available. Unanimous veto.
- **Sort/filter/hide, pagination, performance** — features, not fixes; none is
  why the customer bounced.
- **The score badge "0" (7)** — `scores_meaningful:false` is a pipeline fact.
  Hiding it is defensible but belongs with the real fix.
- **The Milwaukee Packout detail page** — the Outsider's instruction, and the
  right one: it is the only page that made the customer want to act. Nobody
  touches it.
