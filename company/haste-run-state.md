# Haste run — live state (resume breadcrumb)

Started 2026-09-03 ~21:20. Owner away until 6AM. Autonomous full redesign.
Pace SLOW through the night; if usage limit hits, PAUSE and resume after reset —
do not thrash. Model: fable.

## Untouchables (never change)
Deals/data, name "Summit Clearance", security/auth/CSP/rate-limits, paywall
(PUBLIC_PREVIEW teaser + $20/mo gate + Stripe). Reskin only.

## Progress
- [x] Created skill: haste (~/.claude/skills/haste)
- [x] Created skill: token-thrift (~/.claude/skills/token-thrift)
- [x] Captured before-screenshots: /tmp/haste-before/*.png
- [x] Launched research+council Workflow: run wf_852f08f0-871
      (script: .../workflows/scripts/haste-research-council-wf_852f08f0-871.js)
- [ ] Blueprint received → write company/haste-blueprint.md
- [ ] Build: tokens/theme → landing → app feed → detail → pricing → auth → empties
- [ ] Deploy coherent redesign, verify live, log run

## Rules while building
- Local + screenshot-verify each screen at 375px AND desktop before moving on.
- Gates before deploy: npx tsc --noEmit && npm run web:build.
- Keep live site on WORKING version until a coherent redesign exists; deploy once.
- stop-slop all copy; design-review AI-slop check before ship.

## Next action on resume
If blueprint not yet written: read workflow journal at
.../subagents/workflows/wf_852f08f0-871/journal.jsonl for the chairman result,
write company/haste-blueprint.md, then start the token/theme build.

## Token architecture (reskin flows from here — key finding)
The whole visual identity is one :root block in web/src/styles.css:
- Colors: --ink #111, --paper #FAFAF7, --cut #C2410C, --save #15803D, --grail #A16207
- Fonts: --display/--sans = Archivo, --mono = IBM Plex Mono
- Radius: --r-sm..--r-full ALL 0px (the hard-edge receipt look)
- Spacing: --s1..--s9 (4..96px)
So a reskin = retune these tokens + swap fonts (index.html) + per-screen layout +
motion + copy. Component structure mostly stays. Cheapest high-impact lever.
Per-screen CSS: landing.css, dashboard.css, site.css, sidebar.css, welcome.css,
penny.css, resell.css, queue.css, notifications.css, admin.css.

## NETWORK NOTE (2026-09-04 ~02:52)
This Mac's connection to Neon (port 5432) is dropping intermittently
(ETIMEDOUT/EHOSTUNREACH) → local /api/deals/published & /api/coverage 500 at
random, so the local app feed shows 0 cards. NOT a redesign bug (CSS/fonts).
Landing (static) verifies fine locally. Plan: verify static screens locally,
verify the data-driven FEED on PRODUCTION after deploy (prod→Neon is stable).

## Haste build progress
- [x] Step 1: token swap (palette+fonts) — committed 539e518, landing verified.
- [ ] Step 6 landing hero copy (blunt proof, stop-slop) — verifiable local
- [ ] Step 2 feed card 2-up image-forward — verify on prod
- [ ] Step 3 lock overlay / Step 4 receipt component / Step 5 unlock print
- [ ] Deploy coherent v1, verify feed on prod
