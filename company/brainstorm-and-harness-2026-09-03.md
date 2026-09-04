# Brainstorm + AI harness — 2026-09-03 (24h launch run)

Owner ask: brainstorm website ideas, and pick the AI stack harness that makes
this easy to run by launch. Ranked by leverage × (low) risk. Everything here
respects the constitution ($50/mo data cap, no invented numbers, receipt design).

## A. Website / product ideas, ranked

1. **Turn the moat on (owner go/no-go).** Scrapfly $30/mo → the Hidden section
   fills daily. Every other idea is decoration if the paid section is thin on
   launch day. Alternative now on the table: the cloak self-scan (see §C) at $0.
2. **ZIP-first activation.** The one moment a visitor becomes a believer is
   typing a ZIP and seeing stock at *their* store. Make ZIP entry the FIRST
   thing on /app for anonymous users (it already sits in the header; consider
   autofocus on first visit). Zero data cost, pure conversion.
3. **Amazon comps on the top 30 deals** via retailerapi/mcp free tier
   (VERIFIED real: 7 retailers, 1,000 lookups/mo, no card). "$14.00 → sells for
   $89 on Amazon" is the line that makes $20/mo feel cheap. Card UI shipped
   today (89b39b1); needs only the API key + ~30 lookups/day.
4. **Daily "best 5" digest** (email now, SMS frame shipped today). Resellers
   check phones at 7am; the digest is the retention loop. The alerts pipeline
   already exists — this is a matcher rule + a cron entry, not a new system.
5. **Share cards for reseller groups.** Deal permalinks already exist; add OG
   images (receipt-styled price card). Reseller FB/Discord groups are the
   zero-CAC channel. ~1 day of work with the social-photo tooling.
6. **Public "recent wins" wall.** Verified finds (register receipts) as social
   proof on the landing page. Uses existing community_reports data. Trust is
   the whole sale for a $20 subscription from an unknown brand.
7. **Referral: give a month / get a month.** Stripe coupons; wire after there
   are members to refer (post-launch, month 2).
8. **Week-1 churn guard.** The launch-strategy doc's own risk call: a member
   who sees a thin feed cancels in week 1. Onboarding email on day 2 pointing
   at the hidden finds nearest THEIR ZIP; if their radius is empty, say so and
   show the nearest region with finds (honesty beats silence).

## B. AI stack harness — recommendation

**Principle: deterministic pipelines for data, AI only at judgment edges.**
The scan/ingest/alert path must never wait on a model; models judge, verify,
and improve — they don't move rows.

Recommended stack (all pieces already exist in this repo/machine):

| Layer | Tool | Why |
|---|---|---|
| Scans + ingest + alerts | **Railway cron running the npm scripts** (`scan`, `amazon:comps`, `alerts`) | Deterministic, ~$0, no AI failure modes in the money path |
| Deal judgment (floor, fabrication signatures) | **Claude API via src/vendors/llm.ts**, Haiku-tier for bulk judging | Cheap per-row judgment; escalate borderline rows to a bigger model |
| Nightly self-improvement | **Claude Code scheduled routine** running /sbb-cycle (spot → blueprint → build) | Already written for this exact repo; runs the roleplay + browse sweep + council |
| Periodic audits | **/deal-audit family** on a weekly routine | Accuracy is the product; scheduled, not ad-hoc |
| Site QA after deploys | **gstack browse daemon + /qa** | ~100ms/command headless checks, screenshots for evidence |
| Enrichment | **retailerapi MCP** (free tier) + **Playwright MCP** (OSS) | Verified free; UPC dedupe + price history + browser standardization |

**What NOT to adopt now:** multi-agent orchestration frameworks, LangChain-style
stacks, or a second LLM provider. One provider (Claude), one repo, cron + skills.
The harness you already run (Claude Code + gstack + the deal-engine skill
family) IS the recommendation — the gap was never tooling, it was scheduling
and permissions:

1. **Permissions:** add the Railway redeploy + npm script allowlist rules to
   `.claude/settings.json` so autonomous runs can deploy (today's run was
   blocked twice by the permission classifier on redeploy).
2. **Scheduling:** move the nightly sbb-cycle and weekly deal-audit onto
   scheduled routines so "while I'm gone" work actually runs — a session that
   ends cannot keep working; a schedule can.

## C. Sourcing pivot evidence (running today)

Cloak-browser probe (desktop session, 11:00): **160/160 HTTP 200** per-store
GraphQL pricing reads from the home IP, no proxy, 21.9 reads/min, 102 markdowns
captured, zero Akamai pushback at 1.8s spacing. The launch-strategy doc's
"cloak is not a free bypass" assumed replaying the API *outside* a browser;
the probe replays it *inside* the page context (real Chrome TLS + cookies +
residential IP), which is why it holds so far. A 600-read soak on 300 items is
running now; results land in launch-strategy §3 when done. If durability holds
across days, DIY drops fixed costs from ~$41 to ~$11/mo and break-even from 3
members to 1.
