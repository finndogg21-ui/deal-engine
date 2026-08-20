# Frontend design & correctness audit

Scope: `web/src` (React 19 + Vite + TS). Backend under `src/` was read only to
confirm data contracts, never edited. Rankings: **P0** broken, **P1** clearly
wrong, **P2** polish. Items marked ✅ were fixed in this pass; ▫️ were left
(reason given).

---

## P0 — broken

### P0-1 ✅ Deep links to a specific deal never opened the deal
`/app/deal/:productId/:storeId` renders `AllDeals`, but `AllDeals` never read
the route params, so it just showed the generic list. Every "open this exact
deal" CTA was affected:
- PennyWatch **"Open"** (`PennyWatch.tsx:223`)
- RetailerDeals **"See this deal"** (`RetailerDeals.tsx`)
- Notification **alert links** (`Notifications.tsx` → `a.href`)

All three dumped the user on the unfiltered All-deals grid instead of the deal
they clicked. **Fix:** `AllDeals` now reads `useParams()` and opens the detail
panel on mount when a product/store is present.

---

## P1 — clearly wrong

### P1-1 ✅ "Home Depot" store chip silently filtered to zero deals
`AllDeals` store chips carry lib slugs (`home-depot`), but the API's `retailer`
field is the hyphen-less `homedepot` (confirmed in `src/api/routes/watchlists.ts`
and `src/api/routes/stock.ts`). `c.retailer === store` therefore never matched
Home Depot — the single most important store filter returned an empty grid.
Lowe's happened to work (slug already `lowes`). **Fix:** compare both the slug
and its hyphen-stripped form.

### P1-2 ✅ Watchlist offered a "0% off" minimum discount (violates 25% floor)
`Watchlist.tsx` min-discount select was `[0, 25, 40, 50, 70, 90]`. A 0%-off
watch fires on everything and breaks the product's 25% discount floor.
**Fix:** removed the `0` option → `[25, 40, 50, 70, 90]` (default 40 unchanged).

### P1-3 ✅ Dead "Change" ZIP control
The `zipchip` "Change" button in `AllDeals` had no handler — a control that did
nothing. **Fix:** wired to `/welcome` (the only surface that edits ZIP/radius).

### P1-4 ✅ Unguarded detail fetch could crash the detail panel
`open()` did `setSel(await r.json())` with no status/shape check. A non-200 (or
an error object) would set a malformed `sel`, and the detail panel reads
`sel.price_history` / `sel.store` and would throw during render. **Fix:**
consolidated into `openById()` with an `r.ok` + object guard; the deep-link
open reuses it.

---

## P2 — polish

### P2-1 ✅ App-home title was the smallest heading in the app
`.dash-top h1` was `26px` while every sub-page title (`.pw-title`, `.rs-title`,
`.wl-title`, `.qd-title`) is `clamp(36px, 5vw, 54px)`. The landing screen of the
app had the weakest hierarchy. **Fix:** bumped to `clamp(28px, 3.4vw, 38px)` —
raised toward the shared scale while staying inside the header row ("All deals"
is short, no wrap risk).

### P2-2 ✅ Scan-health staleness signalled by colour alone
The `.health` chip conveyed "stale" only by turning red — invisible to
colour-blind users. **Fix:** append textual ` · stale` when stale.

### P2-3 ✅ RetailerDeals cards showed an empty grey box when a product had no image
AllDeals/PennyWatch render a placeholder glyph; RetailerDeals didn't, which
reads as unfinished. **Fix:** added the same `.ph` placeholder SVG.

### P2-4 ▫️ "Penny deals" **tab** on All deals is looser than the Penny **page**
The `AllDeals` tab labelled "Penny deals" filters `stage === 'penny_candidate'
|| penny_score >= 70`, whereas the dedicated `/app/penny` page is literal
pennies only. Two same-named surfaces with different meanings is a mild
consistency snag. **Left unchanged** to respect the hard constraint against
touching penny-surface filters/copy; the tab is a client-side view within All
deals, not the Penny page.

### P2-5 ▫️ Consumer plan copy promises "Amazon Warehouse" deals
`Landing.tsx` / `Pricing.tsx` list "Amazon Warehouse and clearance deals," but
the live scan covers Home Depot + Lowe's only. This is a marketing/roadmap copy
decision, not a frontend defect — **left for the product owner** rather than
silently reworded.

### P2-6 ▫️ RetailerDeals `<img>` has no `onError` fallback
AllDeals swaps to a placeholder on image load failure; RetailerDeals would show
a broken-image icon for a dead URL. **Left** — a proper fix needs per-card
state/refactor; the missing-URL placeholder (P2-3) covers the common case.

### P2-7 ▫️ Minor dead code (harmless, not user-facing)
- Unused CSS: `.card-store*`, `.card-compare` (`dashboard.css`);
  `.icon-btn`, `.sb-group`, `.sb-caret`, `.sb-group-head` (`sidebar.css`).
- `pages/Palettes.tsx` exists but is not routed in `App.tsx` (design scratch
  page; no link points to it, so it is not a dead *link*).
Left as-is — removing them is churn with no user-visible benefit.

---

## Confirmed healthy (spot-checked, no change needed)

- **Non-array API guards:** `AllDeals.load()` explicitly handles 402/non-array
  (the prior F11 blank-page crash). Other list pages fetch through `api<T[]>()`
  inside try/catch, which throws on non-2xx.
- **Card constraints honoured:** deal cards never print a store number or
  shelf/stock count; they show "Possible deal · check your store".
- **min-width:0 overflow:** the known trap is handled — `.deckwrap`/`.app-shell`
  use `minmax(0, 1fr)`, and `queue.css` rows/titles set `min-width: 0` with
  explanatory comments.
- **Colour-plus-text signalling:** unread notifications (weight + left border),
  order/scan status pills (text labels), negative money (shows `-`).
- **Dark mode:** full token set redefined under both `prefers-color-scheme` and
  `[data-theme]`; accent/on-accent contrast holds in both.
- **Focus states:** global `:focus-visible` outline plus per-control overrides.
- **Tap targets:** 44px minimum enforced globally on interactive elements.
- **Auth gating** (signup → survey → app) left untouched.

## Files changed
- `web/src/pages/app/Watchlist.tsx` — remove 0% discount option.
- `web/src/pages/AllDeals.tsx` — deep-link open, store-slug filter fix, guarded
  fetch, live "Change" button, textual stale indicator.
- `web/src/pages/app/RetailerDeals.tsx` — image placeholder.
- `web/src/dashboard.css` — larger, consistent All-deals title.

`npx tsc --noEmit -p web/tsconfig.json` → clean (exit 0).
