# Launch blueprints — closing the ~60% gap to "people actually buy & stay"

From the honest assessment: site/funnel ~75%, moat/product ~40%, traffic/GTM ~15%.
The composite is gated by the weakest links (moat + traffic), so the blueprints
below are ordered by leverage, not by what's easy. **[me]** = autonomous.
**[you]** = needs the owner (money, accounts, a device, a decision).

═══════════════════════════════════════════════════════════════════════════
## WORKSTREAM A — THE MOAT (the #1 lever: a real, deep, VERIFIED feed)
The council called the "spotter-verified" receipt existential: it's a liability
the instant one deal is stale or fake. This workstream makes the claim true.

### A1. Lock the data source  [you decide + me set up]
- Decision: Scrapfly ($30/mo, proven, clears Akamai) vs the cloak self-scan
  ($0, held 600/600 one session, UNPROVEN across days).
- **[me]** Run the cloak scan on a schedule for a WEEK from the home IP and log
  the daily pass/fail + hidden-clearance yield. If it holds, DIY at ~$0.
- Blueprint gate: launch needs ONE source producing daily hidden-clearance depth.

### A2. Deal freshness / verification guard  [me — highest-value autonomous build]
- Build `src/ingest/verify-live.ts`: re-checks each PUBLISHED deal is still live
  + still marked down before it's shown as "verified". Stale → unpublish or flag.
- The receipt/`spotter-verified` chip renders ONLY for deals that passed a check
  within N hours; otherwise the chip is withheld (honest).
- Add `discovery.verified_at` timestamp; the feed + receipt read it.

### A3. Feed depth for launch day  [me + A1 source]
- Ensure a rotating catalog of real verified hidden-clearance (HD first) so the
  free teaser's 40 locked + the paid feed aren't thin on Monday.
- `saved_dollars` bug: some hidden_clearance rows compute $0 (no hd_list) — fix
  so the locked card shows a real "Save $X", not just "Big markdown".

═══════════════════════════════════════════════════════════════════════════
## WORKSTREAM B — TRAFFIC / GTM (the #2 lever: anyone landing at all)
Nobody knows this exists. Everything above converts nothing without traffic.

### B1. Conversion tracking  [DONE]
Pixel funnel + server-side CAPI Purchase shipped. Set the Meta env vars to arm it.

### B2. The one manual ad → a real CPA number  [you]
Run one FB/IG ad to the landing. Watch signup→paid via the CAPI Purchase event.
This turns "we think people buy" into a cost-per-paying-member number.

### B3. Organic seed  [you + me creative]
- **[me]** Draft reseller-channel posts + Higgsfield creative briefs (the receipt
  as the hook: "$133 shelf → $14 register, verified").
- **[you]** Post to reseller FB/Discord/Reddit. $0 CAC, de-risks the ad.

### B4. Meta AI auto-creator  [you, AFTER B2]
Only once B2 gives a CPA: point the auto-creator at Purchase as the goal so it
scales a proven funnel, not a guess.

═══════════════════════════════════════════════════════════════════════════
## WORKSTREAM C — SITE FINISH (the most-done; close it out)
### C1. Real-device iOS Safari QA  [you — 10 min on your phone]
The one thing I can't do headlessly; ~90% of ad traffic is mobile.
### C2. Council redesign fixes  [me]
- Receipt renders only from live/verified deals (ties to A2).
- Nudge the silhouette a half-step off the free rival (receipt/stamp/chip carry
  identity, not the orange).
- Retire remaining mono chips from app chrome (verify on prod).
### C3. Detail page + unlock  [me]
Detail page uses the receipt as its body; the "print-down" unlock animation.
### C4. SMS + Amazon comps  [you creds, me wire]
Twilio env vars → SMS live. RetailerAPI free key → Amazon comps on top deals.

═══════════════════════════════════════════════════════════════════════════
## EXECUTION ORDER (what I start now, autonomously)
1. **A2 deal-verification guard** — de-risks the existential receipt risk. START.
2. **A3 saved_dollars fix** — quick, makes locked cards show real savings.
3. **C2 council fixes** — receipt-only-from-live (ties to A2), silhouette nudge.
4. **A1 cloak week-long proof** — schedule the daily run + log.
5. **B3 creative drafts** — hand you post-ready copy.
Owner-gated (B2, B4, C1, C4, A1-decision) documented above, waiting on you.
