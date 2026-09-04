# Haste blueprint — Summit Clearance redesign (council verdict 2026-09-03)

**Direction:** Summit is a PROOF machine, not a prettier feed. The free rival
(hiddenclearances.com) gives the locator away; Summit wins on VERIFIABILITY. The
receipt/tape stops being site-wide wallpaper (an AI tell) and becomes ONE
load-bearing artifact: a real register receipt that proves a hidden HD markdown
is real and near you — then charges $20 for the aisle. Everything else goes
warm-dark, image-forward, calm.

## Palette (swap the :root tokens)
- **Register Black `#17140F`** → `--paper` (warm near-black canvas; not cool/true black)
- **Receipt Paper `#F3EDE1`** → `--ink` (text; also the receipt slip surface)
- **Register Orange `#FF4A1C`** → `--cut/--go/--sticker/--drop` (the ONE action+moat color: Unlock CTA, moat badge, register-only price ONLY. Redder than HD #F96302 & HC #F15A24)
- **Spotter Green `#2FB562`** → `--save` (money/trust only: "Save $X", verified chip)
- **Stamp Red `#C63A2E`** → `--stamp` (NEW; only inside the receipt stamp)
- **Ash `#7C776D`** → `--ink-faint` (timestamps, struck shelf price, hairlines)
- **Kill amber/`--grail`** (fold into orange for now; remove grail UI in card step)

## Type (all free/Google, CSP host OK; self-host via @fontsource later for LCP)
- **Display + price:** Bricolage Grotesque 700–800, tabular-nums on price. (NOT Space Grotesk — HC uses it.)
- **Body:** Hanken Grotesk 400/500/600. (NOT Inter, NOT DM Sans.)
- **Mono:** Spline Sans Mono — scoped to the receipt slip ONLY (retires site-wide IBM Plex Mono).
- Price is the loudest element on every card (~32–40px mobile), tabular. Title 2-line clamp.

## Layout — FOUR surfaces only
1. **Landing:** warm-charcoal hero, blunt proof copy, ONE ZIP field → on submit, a real nearby markdown renders as a fully-revealed receipt (aha before any wall) + one count-up stat + social proof beside the orange CTA + flat $20 (annual toggle). No tier ladder.
2. **App feed:** 2-up image-forward cards (photo ~50% → HD pill → 2-line title → giant orange tabular price + Ash strikethrough → green Save → timestamp → orange CTA). First slot = 1-up pinned fully-revealed "proof deal". Locked cards: blurred photo, show %OFF + Save $X, gate store/aisle/SKU/stock behind "Register-only markdown — unlock the aisle".
3. **Detail/unlock:** the receipt prints; store/aisle/bay/SKU/live stock + "Scan SKU" verify.
4. Trim nav to: logo + search + store chips (HD first) + In-Store/Online toggle + one orange CTA.

## Motion — frequency-gated
- Feed: near-zero. NO scroll-stagger, NO re-animate on filter/sort, NO hover-lift. Allowed: one-time first-paint fade-up (opacity+8px translateY, ≤250ms total), CTA press (scale .97, ~140ms).
- The whole budget goes to THE UNLOCK: the receipt PRINTS down (scale .96→1 + opacity, ~220ms, ease-out) + Stamp-Red stamp lands.
- Landing: one CSS scroll reveal per section (animation-timeline: view()) + hero count-up.
- Global physics: everything <300ms, ease-OUT only, transform+opacity only, scale from .96 (never 0), no bounce. prefers-reduced-motion day one → print becomes instant opacity reveal.

## Signature: THE REGISTER RECEIPT
A real register-tape slip (Spline Sans Mono on Receipt-Paper): shelf price struck
→ register-only price in orange, "verified in-store · ZIP", Spotter-Green chip,
Stamp-Red "MARKDOWN — NOT ON SHELF". Reused as landing proof, unlock reveal, detail body.

## Copy voice (stop-slop): blunt reseller-to-reseller, real numbers over adjectives
- Hero: **"$89 on the shelf tag. $12 at the register. We found the aisle. Enter your ZIP — see one near you, free."**
- CTA: **"Unlock the aisle — $20/mo"** (says what you GET, the locator)
- Paywall: **"Register-only Home Depot markdowns, before they sell out"** / "The deal's real. The 71% is real. The aisle is $20 away. One flip pays for five months." Never label the page "Pricing".

## Build order
1. **Token swap** (styles.css :root + dark blocks) + fonts — reskins whole app, no component edits. SHIP FIRST.
2. Feed card → 2-up image-forward.
3. Lock overlay + locked-card variant.
4. Receipt component (shared).
5. Unlock print transition + reduced-motion fallback.
6. Landing hero (ZIP → proof receipt, count-up, social proof, $20 toggle).
7. Detail: receipt reveal + Scan SKU + stock.
8. Trim to four surfaces.

## Risks (watch)
- Resembling HC is the fatal risk — differentiate on warmth + Bricolage/Hanken + the proof receipt; if it still reads HC, push warmth/type further, DON'T add decoration.
- The receipt PROVES accuracy → only ever show REAL spotter-verified markdowns (/audit-accuracy). Fabricated data makes the moat a liability.
- Keep orange redder than HD #F96302; name the store in text, never impersonate HD's logo.
- Receipt must stay a single artifact — if mono leaks site-wide it re-creates the broadsheet AI tell.
- Teaser urgency uses REAL stock/time only (no fake countdowns — FTC dark patterns poison the trust strategy).
