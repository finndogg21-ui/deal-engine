# Redesign blueprint — "The Tape" (black & white, two views, animated)

**Date:** 2026-08-22. **Method:** 5-advisor design council (Contrarian, First
Principles, Expansionist, Outsider, Executor) + frontend-design principles.
**Status: awaiting founder approval before build.**

## The verdict in one line

The page is a **triage instrument styled as a thermal receipt** — black & white
because thermal printers only print black (the "non-AI alibi"), animated only
where data *changes*, honest field-report framing as the trust asset.

## Where the council agreed (binding)

- **Identity comes from the data only this product has** — penny price, was-price
  gap, sighting counts, last-seen age. "If the design would still make sense
  selling sneakers, it's templated." (Contrarian)
- **Cards are fixed-slot triage rows**: price pair dominates, recency + distance
  instantly locatable, title small, tabular figures, same slot every card —
  scanning = saccades down a column. (First Principles)
- **Motion encodes change, never arrival**: new deals print in; sort transitions
  preserve object permanence; NO scroll-triggered entrance theater, NO marquee
  ticker, NO fake "live" pulsing dots on hours-old data, NO noise overlays.
  (Contrarian + First Principles + Outsider)
- **Cards read as field reports / tickets, not product listings** — there is no
  Buy button, so don't look like a store. Plain-word decoders shown once:
  "Reported by shoppers in Texas (2)", "take it to the self-checkout scanner —
  the price there is the truth". Honesty leads; hype buried. (Outsider)
- **Penny cards are INVERTED** — black ground, white type: a different species
  at any scroll speed. Inversion, not color, is the semaphore (pure B&W kept).

## The signature — The Tear (Expansionist, disciplined by the council)

The receipt is **material plus three reserved moments**, not a gimmick coat:

1. **The Tear**: switching All deals ↔ Penny deals rips the current view off
   along a serrated perforation (~200ms diagonal tear). The brand gesture.
2. **The $0.01 replay**: opening a penny detail prints the markdown ladder —
   $49.98… $24.99… $12.49… beat… **$0.01** huge with slight thermal bleed.
   Replaying the myth every hunter chases. (Respects reduced-motion.)
3. **The barcode**: penny detail renders the SKU as a real scannable barcode
   (pure CSS stripes from the digits) — resellers walk into the store with the
   screen open. The flourish is equipment.

Everything else stays quiet and disciplined. Chanel rule applied.

## Tokens

- **Paper** `#FAFAF7` (receipt-warm white, page ground)
- **Ink** `#111111` (text, borders, penny-card ground)
- **Faint** `#585858` (secondary data), **Rule** `#D9D9D4` (hairlines)
- **No accent color. None.** Inversion + weight carry all meaning.
- Hard 1px ink borders, **zero border-radius**, hard offset shadows
  (`4px 4px 0 #111`) on hover lift.

## Type (resolving Executor vs Contrarian: NO Space Grotesk, NO JetBrains Mono — both named AI-default)

- **Display/UI: Archivo** (semi-expanded 600–900) — hardware-store poster
  energy, real character in the heavy weights, not the brutalist cliché.
- **Data/prices/SKUs: IBM Plex Mono** — receipt voice, tabular figures.
- Two families via Google Fonts, `display=swap`, real fallback stacks.

## Layout (one page: Find)

```
┌──────────────────────────────────────────────────┐
│ FINNLEY'S ▚ tear-edge wordmark   ZIP [78232] ▍   │  slim header
│ ┌─────────────┬─────────────┐                    │
│ │  ALL DEALS  │ PENNY DEALS │  ← spool toggle    │
│ └─────────────┴─────────────┘  (tear on switch)  │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│ │ card │ │ card │ │ card │ │▓penny▓│  fixed-slot │
│ └──────┘ └──────┘ └──────┘ └──────┘  grid        │
│                              [detail rail prints │
│                               beside grid]       │
└──────────────────────────────────────────────────┘
```

- **Cull (delete from the app):** watchlist, inventory, orders, profit,
  stock-check pages, per-retailer deal pages, notifications bell, retailer
  chips, sort dropdown, compact toggle, "Closest to me" as a separate tab
  (its per-ZIP stock line already lives on every card). Sidebar dies; slim
  header replaces it.
- **Kept working (protect list):** ZIP flow, per-ZIP instant stock lines,
  penny detail (all info + sightings), store-mode HD links, hedging copy
  byte-identical, tiered floor, mobile single-column, reduced-motion.
- **Marketing site pages (/, /pricing, /faq…) are OUTSIDE /app** — untouched
  this pass; separate decision.

## Motion budget (each earns its line)

| Moment | Motion | Budget |
|---|---|---|
| New deals arriving | print-in (clip reveal + 1px jitter) | 250ms, new rows only |
| Toggle All/Penny | the Tear | 200ms |
| Hover | lift + hard offset shadow | 120ms |
| Penny detail open | $0.01 ladder replay | 900ms, once |
| Detail rail | slide-print from right | 180ms |
| `prefers-reduced-motion` | all of the above off, instant states | — |

## Build order (Executor, amended)

1. Token + type swap (dashboard.css token block) — the whole skin.
2. Nav cull + slim header (router + Sidebar → Header).
3. Fixed-slot card layout + inverted penny cards.
4. The three signature moments + hover/stagger motion.
5. Protect-list verification (desktop + 375px mobile + reduced-motion),
   deploy, live checks.

## Success criteria

- A screenshot could not be mistaken for a template or another deal site.
- 40 cards scannable in seconds: price gap → age → distance without re-parsing.
- A stranger understands "reported sighting, go scan it" inside 3 seconds.
- Zero broken flows from the protect list.
