# ☕ /coffee cycle — cybersecurity — 2026-09-02

## Phase 0 — SETUP ✅
Loaded `.coffee/project.md` (deal-engine). Live: https://web-production-cc975.up.railway.app.

## Phase 1 — FOCUS ✅
**cybersecurity** — an INDEPENDENT, research-driven re-check (owner explicitly wanted
verification, not "trust me it's fixed" after last night's single audit).

## Phase 2 — RESEARCH ✅  (workflow wwrrijfet — 5 agents, 35 criteria, all from OWASP/MDN/web.dev)
Established the 2025/2026 bar: full security-header set (incl. the modern cross-origin isolation
trio COOP/CORP/COEP + Cache-Control no-store on private responses), strict CSP guidance
(nonce/strict-dynamic ideal; script-src 'self' acceptable for a static SPA), auth/session (cookie
flags + __Host- prefix, CSPRNG ≥64-bit sessions, idle+absolute timeout, scrypt N=2^17/Argon2id,
enumeration resistance, per-ACCOUNT brute-force limits), API/injection (IDOR ownership re-check,
mass-assignment allow-lists, parameterized queries, strict input validation, SSRF allow-listing,
generic errors), rate-limiting + supply chain (per-account auth limits, body-size cap, npm ci +
committed lockfile, ignore-scripts, SCA in CI).

## Phase 3 — COMPARE ✅  (deal-engine vs the 35 criteria — mostly MEETS; last night held up)
MEETS: HSTS 1y+includeSubDomains · CSP locks script + object-src none + base-uri self · nosniff ·
frame-ancestors none + X-Frame DENY · Referrer-Policy · CSPRNG sessions (256-bit) · server-side
logout invalidation · scrypt N=2^17 · enumeration-safe signup+login · per-account rate limits ·
IDOR/mass-assignment/parameterized/validation · generic errors · 256kb body cap.
GAPS found (beyond last night's audit):
1. **COOP + CORP MISSING** (cross-origin isolation trio — now OWASP baseline). ← picked
2. **Cache-Control: no-store on API responses MISSING**. ← picked
3. **upgrade-insecure-requests in CSP MISSING** (minor; HSTS already forces https). ← picked
4. `/api/candidates` member read has no rate limit. → BACKLOG
5. `__Host-` cookie prefix; HSTS preload — deferred to domain-swap. → BACKLOG
6. idle + absolute session timeout — MODERATE risk (auth surface). → BACKLOG (needs owner call)
7. CSP nonce/strict-dynamic (vs script-src 'self') — higher effort for a static SPA. → BACKLOG
8. .npmrc ignore-scripts / npm ci in CI / SCA — no CI exists; esbuild postinstall risk. → BACKLOG

## Phase 4–5 — BRAINSTORM + BLUEPRINT ✅
Pick: the cohesive, LOW-RISK, header-only set that lifts us to the 2025 OWASP Secure Headers
baseline — COOP `same-origin` + CORP `same-origin` + `upgrade-insecure-requests` + `Cache-Control:
no-store` on `/api` — all in the single `src/api/server.ts` headers middleware. One file, one
deploy. Risk vs `high_risk`: NONE (header-only, no auth/billing/data/schema). Rejected for this
cycle: `/api/candidates` rate-limit (different concern → backlog); anything auth-surface (moderate
risk).

## Phase 6 — EXECUTE ✅  (commit 62d4c64)
Added to the headers middleware: `Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Resource-Policy: same-origin`, `upgrade-insecure-requests` (CSP), and
`Cache-Control: no-store` scoped to `/api/*` only (static assets keep their caching). Safe:
no cross-origin popups (Stripe redirect; buy-links use noopener), nothing loads our bundle/API
cross-origin. Typecheck 0 errors. Deployed.

## Phase 7 — CONCLUDE ✅  (verified live)
Document: COOP=same-origin, CORP=same-origin, CSP+upgrade-insecure-requests — all present.
/api response: Cache-Control: no-store. Static asset (/assets/index-*.js): still `public,max-age=0`
(NOT no-store — the /api-only scope works). No regression: teaser 12/200 locked, penny 402.

## Phase 8 — TEST ✅  (security-focus → live probe)
Browser-loaded /app under the new headers: SPA runs, Archivo/IBM-Plex fonts render, store chips +
buttons present, ZERO CSP/COOP/CORP violations in console (only the expected 402 paywall errors).
COOP/CORP did not break the same-origin app; buy-links unaffected (noopener).

## RESULT
Independent research-driven cybersecurity re-check: last night's hardening genuinely holds up
against the current OWASP bar. One real gap it MISSED — the modern cross-origin isolation headers —
found and shipped, plus no-store + upgrade-insecure-requests. Compounding continues via the backlog.
