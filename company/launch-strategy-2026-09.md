# Summit Clearance — Launch Strategy & 24h Build Plan
_Authored 2026-09-03 (Thu) during the autonomous 24h push. Launch target: **Monday 2026-09-07.**_

This is the single strategy doc for the launch weekend. It answers the five things
the owner asked for: (1) the launch roadmap, (2) a realistic profit timeline,
(3) hidden-clearance solutions (incl. the DIY cloak scraper), (4) the best AI
harness, and (5) an SMS-notification plan — plus a brainstorm and the new
two-section IA. Every number here is either arithmetic from known inputs or is
tagged as an assumption. No invented figures.

---

## 0. The North Star (owner's correction, do not lose it again)

> "The original goal was to create a hidden clearance website that can detect
> HIDDEN clearance items and send you an alert, not just a catalog of easy-to-find
> clearance items. Nobody's gonna pay $20/month to look at clearance that's harder
> to find than just going into the app."

**The moat is HIDDEN clearance** — register-only / in-store-only prices you cannot
see by walking in or opening the retailer's own app. Regular markdowns are table
stakes (nice, but not worth $20/mo alone). The product must make the hidden feed
the star. Everything below serves that.

---

## 1. Launch roadmap — Thu 9/3 → Mon 9/7

Four build days. Marked **[me]** = I can do autonomously, **[you]** = needs the
owner (account creation, payment, phone, a decision).

### Thu 9/3 (tonight) — analysis + mobile + IA — ✅ SHIPPED (terminal run, by 12:15)
- ✅ Mobile hostile-critic analysis → ranked flaw list (8-lens panel) + a measured
  chrome budget: first deal was 640px down at 375x812, zero deals on screen.
- ✅ Top mobile fixes shipped (69dac0c, 1958436): duplicated ZIP banner, duplicate
  rail track, coaching line deleted; spool tabs + search/sort share rows.
  **Verified locally: first deal at 443px, two full cards above the fold.**
- ✅ Two-section IA (1ad6bf9 + d1effa1): Hidden is a first-class track AND only
  renders on stores with a real register-price pipeline (HD today); stale deep
  links resolve honestly; spool counts are store-scoped.
- ✅ Amazon frame (89b39b1): comp columns migrated, `npm run amazon:comps` stub
  (reports 4,871 published deals awaiting comps), honest card line wired.
- ⚠️ **Deploy blocked for the agent** (permission classifier refuses the Railway
  redeploy). All of the above is on origin/main, NOT live. Owner: one redeploy
  ships everything — or add a settings.json allow-rule so runs can self-deploy.

### Fri 9/4 — hidden-clearance depth + SMS frame
- ✅ **DONE EARLY (Thu, 6483821):** SMS frame shipped whole: sms_outbox +
  phone-verify flow (rate-limited) + Watchlist panel + register-confirmed finds
  ride along by text. Goes live the moment TWILIO_* env vars are set.
- **[me]** Wire the HD hidden-clearance GraphQL scan into a repeatable job so the
  Hidden section has real depth at launch (needs the Scrapfly key — see §3).
- **[you]** Decide Scrapfly $30/mo (turnkey hidden-clearance) vs the DIY cloak path.
- **[you]** Create the Twilio (or alt) SMS account when I hand off the frame.

### Sat 9/5 — polish + honesty pass + security
- **[me]** stop-slop pass on all launch copy (landing, FAQ, pricing, empty states).
- **[me]** Security re-verify (headers/CSP/rate-limits intact) before going loud.
- **[me]** Landing reframe: hero the HIDDEN moat, not "shipped to your door."

### Sun 9/6 — dogfood + fill the feed
- **[me]** /roleplay dogfood on mobile end-to-end; fix what burns a real user.
- **[me]** Run scans across all live retailers so launch day isn't a thin feed.
- **[you]** Set Railway env `APP_URL=https://summitclearance.com` (email links).

### Mon 9/7 — LAUNCH
- **[you]** Flip PUBLIC_PREVIEW decision (keep teaser or gate harder).
- **[you]** First marketing push (the reseller channels below).
- **[me]** Launch-day monitoring: canary the critical path, watch errors.

**Hard dependencies that only you can clear:** Scrapfly key (hidden depth), Twilio
account + a phone number + A2P 10DLC registration (SMS), and the go/no-go on paid
data spend. Everything else I can carry.

---

## 2. Realistic profit timeline (honest, not hype)

**Unit economics (arithmetic, not assumption):**
- Price: **$20.00/member/mo**. Stripe takes 2.9% + $0.30 = $0.88 → **net $19.12**.
- Fixed monthly cost at launch: **~$41** (Scrapfly $30 + Railway ~$10 + Neon free +
  domain ~$1.25 amortized). Verify Railway's actual bill.
- **Break-even = 3 paying members.** The cost base is tiny; the whole game is
  acquisition, and acquisition is a function of whether the moat is obviously worth
  $20 (see §0).

**The signup curves below are ASSUMPTIONS** — illustrative demand, not data. We
have zero conversion history yet. Treat them as scenarios, not forecasts.

| Month | Conservative | Base | Optimistic |
|---|---|---|---|
| M1 (Sep) | 2 → -$3 | 3 → +$16 | 6 → +$73 |
| M2 | 4 → +$35 | 7 → +$93 | 15 → +$246 |
| M3 | 6 → +$73 | 12 → +$188 | 28 → +$494 |
| M4 | 9 → +$131 | 18 → +$303 | 45 → +$819 |
| M5 | 12 → +$188 | 26 → +$456 | 65 → +$1,202 |
| M6 | 16 → +$265 | 35 → +$628 | 90 → +$1,680 |

_(member count → monthly profit after the ~$41 fixed cost)_

**The honest read:**
- Break-even (3 members) is a low, reachable bar — possibly in month 1.
- "Real money" ($500+/mo ≈ 28 members) is a **3–6 month** horizon in the base case,
  and only if the moat converts and marketing works. Month 1 is a proof-of-demand
  month, not a payday.
- The single biggest lever is **not** cost — it's whether a reseller sees the hidden
  feed and thinks "I could not have found this myself." That is a product problem
  (§0, §3), not a pricing problem.
- Sensitivity: at 28 members you clear ~$495/mo even after adding a second data
  source. The model is robust to cost; it is fragile to churn. A member who signs
  up, sees a thin/duplicate-of-the-app feed, and cancels in week 1 is the real risk.

---

## 3. Hidden-clearance: the moat, and how to feed it cheaply

**What already exists and works (verified 2026-08-30):** `scripts/hd-clearance-scan-gql.mts`
reads Home Depot's *per-store* shelf price straight from HD's federation-gateway
GraphQL API, replayed through Scrapfly ASP (clears Akamai), ~25 credits/read, **no
API key required**. It cleanly separates a MARKDOWN (`value < original`) from a
true HIDDEN CLEARANCE (`clearance.value` with `alternatePriceDisplay=true` — the
number HD hides behind "See In-Store Clearance Price"). `storeId` is a query
variable, so we can read *any* store. This is the moat, and it is real.

**Its only cost is Scrapfly: $30/mo = 200k credits = ~8,000 reads/mo.** With triage
(read one anchor store, fan out only on a deal signal) that covers a meaningful
rotating catalog.

**The "build our own cloak scraper" question — honest answer (researched 2026-09-03):**
- A free stealth browser (nodriver / `stealth-browser-mcp`, both OSS) **can** clear
  Akamai's *browser-page* checks — nodriver produces authentic Chrome JA4
  fingerprints. Good for the SSR discovery pages.
- BUT the valuable part is the **GraphQL API** endpoint, where 2026 Akamai leans on
  **TLS (JA3/JA4) fingerprinting** and **IP reputation**. Replaying that at scale
  reliably needs **residential proxies** — which are **not free** (~$3–15/GB or a
  monthly plan). Datacenter IPs get burned.
- So the cloak browser **alone is not a free bypass**. This confirms the earlier
  finding. The realistic DIY cost (residential proxies + maintenance + an ongoing
  arms race) is *higher and riskier* than Scrapfly's $30/mo, which bundles proxies +
  TLS spoofing + retries.

**Recommendation:**
1. **For launch (Monday): use Scrapfly at $30/mo.** It's proven, within budget, and
   turns the Hidden section on immediately. This is the pragmatic call.
2. **One DIY experiment worth running (free, no proxies):** have a stealth browser
   (nodriver) open homedepot.com, acquire the real Akamai cookies *in the browser*,
   then replay the federation-gateway GraphQL **from that same browser context**
   (`page.evaluate(fetch(...))`). Because the request originates from a real Chrome
   with real cookies + real TLS, it may pass without a paid unlocker or proxies —
   from your home IP, low volume. If it works, it's a $0 fallback for low-volume
   reads. If it rate-limits or 403s, we keep Scrapfly. **I'll prototype this Fri.**
3. **Do not** market hidden clearance as "everywhere." At launch it's Home Depot
   (proven) + the community-reported register-only retailers (DG/TSC/Costco). Be
   honest; the honesty is part of the brand.

---

## 4. Best AI harness (researched 2026-09-03)

The question: what should run the autonomous ops (scanning, verification, alerts)
so it's low-maintenance by launch?

- **[verified] LangGraph** (v1.0 GA Oct 2025) — production standard for *stateful,
  long-running, observable* workflows: checkpointing, human-in-the-loop, LangSmith
  tracing, model-agnostic. Best if the orchestration becomes genuinely stateful.
- **[verified] Claude Agent SDK** (renamed from Claude Code SDK, early 2026) —
  Anthropic's official, safety-first: tool use, hooks, MCP, skills, subagents. This
  is *literally the environment we're already in* (this session is Claude Code).

**Recommendation — don't over-harness:**
1. **Deterministic scans need no LLM.** The HD GraphQL scan, the RedSky/Target fetch,
   the ingest — these are plain HTTP + rules. Run them as **scheduled scripts on
   Railway cron** (or a tiny worker). Cheapest, most reliable, zero token cost.
2. **The judgment layer** (verify a deal is real, dedup, anomaly/price-sanity, the
   nightly self-improvement /coffee cycles) is where an agent earns its keep → keep
   it on the **Claude Agent SDK** we already run. No migration needed for launch.
3. **Adopt LangGraph only when** the orchestration grows past "run script → ingest →
   alert" into multi-step stateful flows with retries you need to observe. Not a
   launch-blocker; a month-2+ upgrade if volume demands it.

Net: **keep the current Claude Code / Agent SDK loop + move deterministic scans to
Railway cron.** That's the "easy by launch" answer — reliability from *removing* the
LLM from the deterministic path, not from adopting a heavier framework.

Sources: langfuse agent comparison, zerotoai LangGraph-vs-Claude-SDK, morphllm SDK roundup.

---

## 5. SMS notifications — the frame (owner said SMS, not email)

**Constraint:** I can build the frame; I **cannot** create the SMS account, buy a
number, complete carrier registration, or send a real text (those need your
identity/payment and, in the US, A2P 10DLC brand+campaign registration).

**The frame I'm building:**
- **Schema:** `alert_subscriptions` (user_id, phone E.164, verified_at, filters:
  retailer / min_discount / hidden-only / keyword) + `alert_sends` (dedupe + audit).
  _(Schema = high-risk → blueprinted for your approval, not auto-migrated.)_
- **Opt-in UX:** a phone field + "text me when a hidden clearance matches" toggle,
  with an explicit consent line (required for compliance) and a verify-code step.
- **Adapter:** `src/alerts/sms.ts` — a provider-agnostic `sendSms()` that reads
  `SMS_PROVIDER` + creds from env and **no-ops with a clear log when unset**, so the
  whole path is testable before a dollar is spent.
- **Matcher:** reuse the existing `src/alerts/deliver.ts` digest logic; add an SMS
  channel alongside the in-app bell.

**Provider decision (yours):** Twilio is the default (best docs, A2P support). This
is where you "check in for SMS": account, a number, and the 10DLC registration. I'll
flag the exact moment I need you.

---

## 6. Two-section IA — Regular vs Hidden Clearance (shipping this weekend)

Today, `hidden_clearance` rows are **interleaved** into "All deals," and the only
split is a Home-Depot-only "Penny" tab. That's the gap. The fix (frontend-only, low
risk — the data already carries the flag):

- **Two clear sections/tracks:** **Regular Clearance** (published markdowns) and
  **Hidden Clearance** (register-only / in-store-only: HD `hidden_clearance` rows +
  penny + the community register-only retailers).
- Hidden gets **visually distinct treatment** (it's the moat — it should look like a
  different species), a real heading, and its own count — on **every** store that
  actually has hidden clearance, not just when you happen to be scoped to HD.
- Honesty preserved: a store with no hidden tier doesn't fake one.

---

## 7. Brainstorm — ideas to make the moat undeniable

Ranked by leverage on "worth more than walking into the store":
1. **Hidden-only alert** (the SMS): the product's one-liner becomes "we text you the
   register price before you drive." That is the thing you cannot self-serve.
2. **"You couldn't have found this" badge** on hidden rows — state *why* it's hidden
   (register-only, not on the site, not in the app) so the value is legible.
3. **Resale comp (Amazon/Keepa)** on every deal → rank by *profit*, not discount.
   Turns a clearance finder into a flip decision engine. (Frame going in now.)
4. **Store-run sheet:** pick a store, get every hidden clearance there, sorted by
   margin, with aisle/bay — a printable/one-screen hunting list. Resellers love this.
5. **Penny-day countdown** per SKU (markdown-ladder position → "1–2 Tuesdays from a
   penny"). Predictive, not just current.
6. **Referral:** a member who brings a member gets a month free. Cheap growth for a
   community-driven niche.
7. **Proof feed:** anonymized "someone just found $X hidden clearance near 78232" —
   social proof that the moat is live and local.

---

## 8. Status ledger (updated as the push runs)
- [in progress] Mobile critic analysis + fixes (Thu)
- [in progress] Two-section IA
- [in progress] Amazon frame
- [pending] SMS frame (Fri) — needs your Twilio hand-off
- [pending] DIY cloak prototype (Fri) — $0 experiment
- [pending] Landing moat-reframe + stop-slop copy pass (Sat)
- [owner] Scrapfly key · Twilio account · Railway APP_URL · launch-day marketing
