# Routine — Tractor Supply member clearance reports

Run the Tractor Supply find-ingest cycle for deal-engine. Repo is this checkout,
live site https://web-production-cc975.up.railway.app, prod DB via DATABASE_URL
in the repo .env.

TSC is NOT a vendor sweep. See company/tractor-supply-recon.md: the site is
walled by Akamai (server curl → HTTP 000; even a real browser gets "Access
Denied" on the clearance category), the one Apify actor is deprecated/blocked,
and the deepest markdowns are in-store red-tag remnants that never touch the
website. So TSC rides the `community_reports` path only, as a CLEARANCE retailer.

## How TSC differs from Dollar General

- **Clearance, not penny.** A TSC report carries a real price and "was", and
  must clear the tiered floor. There is NO penny and NO price-ending code system
  — that is Home Depot folklore, mis-attributed to TSC. Depths run 40–80% off.
- **National pricing.** The clearance price is the same at every store (like Best
  Buy), so a report is a national price fact. Store location is about
  *availability*, which is YMMV — the stock is never national.
- Source tag: `tsc-members`, retailer `tractorsupply`, kind `clearance`.

## The one hard rule (same as DG): member finds, never copied lists

Report a member's OWN in-store find, confirmed on the shelf. Do not ingest a
third-party clearance list. The only existing TSC "tracker" is RebelSavings,
which this project already proved is 100% fabricated (item ids 404, wrong
brands, coords in Mexico — see src/ingest/community.ts). Never wire it.

## Future option (explicitly not built): proxied online-clearance scrape

TSC's shallow national online clearance (/tsc/clearance, was/now to ~$0.09) is
real but Akamai-walled. Reaching it needs a stealth headless browser
(Camoufox/Playwright) + residential proxies — real cost, fragile (it already
killed the Apify actor). If ever built, it clears the SAME fabrication gate and
tiered floor as every other source, and it is national (no per-store price).

RULES: never invent a TSC price — a clearance lead is a member's report, never a
guess. Touch only TSC rows. Budget $0. No deploys from this routine.
