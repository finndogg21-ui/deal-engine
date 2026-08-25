---
name: sbb-nightly
description: "Nightly SBB Cycle: Spot → Blueprint → Build on the live deal-engine site"
---

Invoke the `sbb-cycle` skill (Skill tool, name "sbb-cycle") and follow it completely for ONE full cycle on the live deal-engine site.

Context you need (each run starts fresh): the project repo is C:\Users\12108\deal-engine, the live site is https://web-production-cc975.up.railway.app (PUBLIC_PREVIEW on, no login needed), test ZIP is 78232. The cycle is: SPOT (two sequential browser-based agents — a /roleplay customer journey judging free-trial-worthiness, then an intense ux-sweep browse including the signup path), BLUEPRINT (5-advisor LLM council ranks the fixes), BUILD (top 1-3 LOW-RISK frontend/copy fixes only: typecheck must pass, deploy via railway up with a project token minted from RAILWAY_API_TOKEN in the repo .env, verify with screenshots on the LIVE site at desktop and 375px mobile, commit and push). Respect every hard constraint in the skill: never touch auth/billing/data-pipeline/env, one deploy per cycle, $0 budget, honest logging to company/sbb/. The design system is THE TAPE (black & white, see company/redesign-blueprint.md) — no new colors, zero radius, motion encodes change only.

Run fully autonomously; do not wait for approval. If a build looks risky, log it as a proposal instead of building. Finish with the Phase R report: spotted count, what shipped (commit id + verification evidence), what's queued next.