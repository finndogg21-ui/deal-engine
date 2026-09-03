# First look at mobile, as a human — 2026-09-03 (Playwright, 375×812, live summitclearance.com)

Method: LOOK at the rendered page like a first-time visitor on a phone, react, then diagnose. Not computed-pixel measurement (that comes from capture.mjs metrics). These feed the critic panel as a seed, tagged OBSERVED.

## Landing page (/) — 4,505px tall at 375 = ~12 screens

OBSERVED, severity HIGH
- **The hero headline reads as two broken fragments.** "The best clearance," sits alone, then a visible gap, then "on a shelf **near you**, and shipped to your door." on the next block. Looks like a rendering bug (an animated/blocked span + margin), not a design choice. First thing a visitor sees.
- **The first promise is the wrong one.** "…shipped to your door" and step 1 "Online deals, shipped to you" lead; the moat ("the in-store clearance price your store never puts online") is a trailing clause in the subhead and step 2. Direct violation of the North Star (hidden clearance is the product). A visitor could leave thinking this is a Slickdeals clone.
- **Zero visual proof anywhere.** Twelve screens and not one deal card, real price, or "$4.00 · was $39.97 · 90% off at your store" example. A cold visitor reads text about deals instead of seeing one. Put a real hidden-clearance card in the hero.

OBSERVED, severity MEDIUM
- Text walls: How-it-works is three long paragraphs; Who-it's-for is two bullet cards. ~5.5 screens of body copy before the pricing CTA. Needs tighter copy + progressive disclosure ("The longer version" button exists but the short version is already long).
- Footer is a single vertical column ~1,000px tall (Product / Stores ×8 / Company / Legal). Nobody taps eight store links from a footer on a phone. Two columns or a collapsed accordion.
- CTA copy is vague: "Start hunting." Action-specific beats clever: "See hidden clearance near you" / "Enter your ZIP".
- Eyebrow "Clearance & markdowns, tracked daily" is generic — says nothing about *hidden*.

OBSERVED, positive (keep)
- Type is readable (no tiny text spotted), tap targets look ≥44px, no horizontal overflow, zero-radius receipt aesthetic is consistent, the black square 1/2/3 badges are on-brand.

## /app?tab=hidden (mobile) — see next section (appended after viewing)

## /app?tab=hidden (mobile, live after deploy 1ad6bf9) — LOOKED, not measured

OBSERVED, severity CRITICAL
- **The first deal card starts at ~770px on an 812px screen: zero deals visible on load.** Above it: header (wordmark + two account buttons + "Set once…" hint + STORES NEAR + ZIP field ≈195px), the Tracks/stores chip rail (≈55), a dashed "SET YOUR ZIP TO SEE STOCK NEAR YOU →" banner (≈55), the spools wrapping to TWO rows (≈130), search (≈55), sort (≈55), a "No scan yet" pill (≈40), the hidden caption (≈110). This is THE mobile problem — and my Hidden-track deploy made it ~200px worse (Tracks group + caption). Fix = a cohesive chrome redesign, not trims (swing #1 below).
- **Duplicate controls.** "ALL DEALS" and "HIDDEN CLEARANCE" each appear TWICE on one screen (rail chip + spool tab), both amber/active at once. A visitor reads the same button twice. Self-inflicted by the Tracks rail group. One set of tabs, not two.

OBSERVED, severity HIGH
- **The ZIP placeholder IS clipped** ("ZIP coc" is what renders). The 12:13 cycle measured `zipClips:false` and called it a false alarm — the measurement was wrong; the render shows the cut. This is exactly the measure-vs-look failure the owner named. Fix: wider field or placeholder "ZIP".
- **Three ZIP prompts on one screen:** "Set once; every stock check uses it" + the STORES NEAR field + the dashed banner. One is enough (the field).
- **Anonymous visitors fire four 402s** (community-deals ×2, stats/hit-rate, scan/health): the client calls member-gated endpoints for preview users. The gate is correct; the calls are waste, and the failed scan/health is why a meaningless "No scan yet" pill shows. Skip gated fetches for preview users; drop the pill for anon.

OBSERVED, severity MEDIUM
- "ALL DEALS 12": the anon teaser scope is 12 rows; reads thin to a first visitor. Launch decision: teaser size / copy ("12 of 4,871 — create a free account to see all").
- Bare "Loading" text top-left, no skeleton, for ~1–2s on route entry.
- Positives: the amber Hidden treatment is legible and distinct; cards are 2-across with "In store" badges; the caption copy is honest.

## The swings this implies (cohesive, not nits)
1. **Mobile chrome redesign → ≤200px above the first card.** One sticky row (wordmark · ZIP field · account glyph); ONE horizontal chip row (Tracks, then stores, scrollable); search+sort merged into one row; no banner, no pill, no duplicate tabs; the caption becomes a one-line sub-label under the active chip with a "?" for the long version. Goal: 2 cards fully visible on load at 375×812.
2. **Landing hero → the moat, with proof.** Fix the split h1; lead with the hidden in-store price; embed one REAL hidden-clearance card above the fold; action-specific CTA.
3. **Anon/preview honesty.** No gated calls for preview users, no internal status pills, honest thin-teaser copy.

## Desktop /app (1280×800) + the full mobile feed — LOOKED (capture set 2026-09-03 ~10:55)

OBSERVED, severity CRITICAL (product, not layout)
- **The hidden-clearance rows are at stores 1,000+ miles from the user.** Cards read "Cheapest at Miami Calle Ocho (FL) · scan yours to confirm", "South Philadelphia (PA)", "Manhattan W 23rd (NY)", "Midtown (GA)" — to a San Antonio visitor. Hidden clearance that is not at YOUR store is not worth $20/mo; this is the exact "harder than opening the retailer's app" failure the owner named. Root cause: the 8 rows came from scans of far-away big stores, and hidden clearance is per-store. Fix is the scanner, not the card: scan the user's LOCAL stores at volume (the free cloak probe is doing ~200 reads/6 min at 200 OK, no proxy) and only show hidden rows within the user's radius, labeled with distance.

OBSERVED, severity HIGH
- Desktop ZIP placeholder is clipped too ("ZIP coc"), and the rail's "HIDDEN CLEARAN…" is truncated with an ellipsis (icon + name don't fit 208px). The moat's own label is cut off.
- Desktop: 0 cards fully visible on load is a near-miss, not a crisis: chrome 220px + ~580px card puts the "SEE THIS DEAL" button exactly on the fold. Trimming ~40px (banner or pill) shows a full row.
- Mobile 2-across cards themselves are READABLE (title 2 lines, big amber % block, price, was, margin, store, age). The card is not the problem; the chrome above it is.

OBSERVED, severity MEDIUM
- Teaser footer says "Showing 12 of 200 deals" while prod holds 4,871 published rows: either a cap presented as a total, or wrong. Honesty check required (see api).
- The same four internal/gated 402s fire on desktop for anonymous visitors.
- minFont 9px on every /app page comes from `.deck .retailer { font-size: 9px }` (dashboard.css:767) and a 9px rule at :1057 — a density-mode chip; it should never render below ~11px on either viewport.
