# Design System — Deal Engine

## Product Context
- **What this is:** A phone-first app that records retail clearance prices daily and alerts one person when something is about to hit a penny.
- **Who it's for:** Two audiences. Resellers hunting flips, and ordinary people who want a cheaper vacuum. UI leans consumer, because a reseller survives a simple interface and a consumer does not survive a dense one.
- **Space:** Deal aggregators, penny hunting, reseller tooling. Peers: HiddenClearances, BrickSeek, Polar Chefs, Slickdeals.
- **Project type:** Hybrid. Marketing site plus a data-dense web app.

## The memorable thing
**"Someone paid a penny for that."** Every design decision serves the moment a person sees a price that should not be possible. If a choice does not make that number land harder, it is decoration.

## Research (2026-08-15)

Measured, not guessed. Computed styles pulled from live sites:

| | Copilot Money | Ramp | Linear |
|---|---|---|---|
| h1 size | 112px | 64px | 64px |
| h1 weight | 600 | **400** | **510** |
| h1 letter-spacing | -2.24px | -0.01px | -1.41px |
| h1 line-height | 0.9 | 1.0 | 1.0 |
| body | — | 14px / 1.43 | 15px / 1.6 |
| radii | 24, 40px | 12, 6px | 6, 4px, pills |
| typeface | Jokker | Lausanne | Inter Variable |

**What every one of them does that we did not:**
1. Display type at 64–112px. Ours was 42px.
2. Display weight 400–600. **Never 700.** Ours was 700 everywhere.
3. Display line-height 0.9–1.0. Ours was 1.15.
4. A hierarchy of radii, not one value. Ours was 4px on everything.
5. A real licensed typeface. Ours was a system stack, which is the single loudest "generated" signal there is.

## Aesthetic Direction
- **Direction:** Utilitarian editorial. A tool that knows things, set with editorial typography.
- **Decoration level:** Minimal. Type, space, and one accent do all the work. No gradients, no texture, no illustration.
- **Mood:** Quietly authoritative. It should feel like a well-made instrument, not a lifestyle app and not a coupon site.

## Typography

Served from Fontshare, one CDN, both free for commercial use.

```html
<link rel="preconnect" href="https://api.fontshare.com" crossorigin>
<link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500&f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
```

- **Display:** Cabinet Grotesk — wide, confident, and it has excellent figures. The hero on this product is literally a price, so the numerals matter more than the letters.
- **Body / UI:** Satoshi — warm, highly legible, neutral without being anonymous.
- **Data / tables:** Satoshi with `font-variant-numeric: tabular-nums`. A third typeface would be noise.

### Scale
| Role | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| Hero | `clamp(52px, 9vw, 96px)` | 500 | -0.035em | 0.95 |
| Page title | `clamp(36px, 5vw, 54px)` | 500 | -0.03em | 1.05 |
| Section | `clamp(26px, 3.4vw, 34px)` | 500 | -0.02em | 1.15 |
| Subhead | 21px | 600 | -0.01em | 1.3 |
| Body | 17px | 400 | normal | 1.6 |
| Small | 15px | 400 | normal | 1.5 |
| Micro | 13.5px | 500 | normal | 1.4 |

**Rule: display sizes never use weight 700.** Authority at large sizes comes from scale, not from bold.

## Color
- **Approach:** Restrained. One accent, everything else neutral.
- **Accent (green):** `#1f5c3d` light / `#4fae7e` dark. Reserved for the deal itself: price, saving, score, primary action. Never used for structure.
- **Ink:** `#12150f` → soft `#3d443f` → faint `#555b56`
- **Paper:** `#faf9f5` → sunk `#efeee7`
- **Rules:** `#dcdad0` → strong `#b3b1a4`
- **Semantic:** money `#1f5c3d`, alert `#a53a22`
- **Dark mode:** surfaces redesigned rather than inverted. Paper `#0f1210`, sunk `#171b17`, accent lifted to `#4fae7e` for contrast on dark.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable on marketing, compact-capable in the app via a density toggle.
- **Scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96

## Layout
- **Approach:** Hybrid. Grid-disciplined in the app, editorial on marketing pages.
- **Max content width:** 940px marketing, 1240px app.
- **Radius hierarchy:** `sm 5px` (badges, chips) · `md 9px` (inputs, buttons) · `lg 16px` (cards, panels) · `full 9999px` (pills). One value everywhere is a generated-design tell.

## Motion
- **Approach:** Minimal-functional. Transitions only where they aid comprehension.
- **Duration:** micro 90ms, short 180ms.
- **Easing:** ease-out entering, ease-in leaving.
- No entrance animations on content. The hero price animation was cut for delaying the most important number on the page.

## Safe choices
- **Cards for deals.** Every product in this category uses them, and people recognise them instantly.
- **Green for money.** Conventional, and the convention is load-bearing here.
- **Store, distance, stock, time-ago on every card.** Category table stakes.

## Risks
1. **Display weight 500, never 700.** Reads more expensive and more considered. Costs some shouty impact on small screens.
2. **A serif-adjacent grotesque with wide figures, at 96px, on a discount product.** The category is all bold sans and orange urgency. This says "we are accurate" rather than "hurry up." Costs some impulse energy.
3. **No urgency copy at all.** No countdowns, no "these won't last." The honest line is "prices are from the last time we looked." Costs conversion on the margin, buys the trust the whole verification model depends on.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-15 | Design system created | Measured three well-designed comparables, found display type and typeface were the failures |
| 2026-08-15 | Cabinet Grotesk + Satoshi over a system stack | System fonts are the loudest generated-design signal; the hero is a number so figures matter |
| 2026-08-15 | Display weight capped at 500 | All three researched sites use 400–600; 700 at display size reads amateur |
| 2026-08-15 | Radius hierarchy 5/9/16/full | One uniform radius is a named AI-slop pattern |
| 2026-08-14 | Deep green accent | Chosen by Finnley over clearance yellow after seeing four palettes rendered |
