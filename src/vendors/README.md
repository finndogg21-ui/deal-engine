# Vendor adapters — NOT WIRED

Every external data source lives behind one file in this folder. Each one
currently throws a loud error naming the environment variable it needs.

Nothing downstream imports a vendor SDK directly. The engine, the matcher and
the API all work against the shared contracts in `contracts.ts`, so wiring a
real vendor is one file each, never a refactor.

| File | Vendor | Needs | Blueprint |
|---|---|---|---|
| `apify.ts` | Apify DealWatch | `APIFY_TOKEN` | P0 — the daily clearance sweep |
| `unwrangle.ts` | Unwrangle | `UNWRANGLE_KEY` | Store-level stock, aisle, `discontinued` |
| `keepa.ts` | Keepa | `KEEPA_KEY` | Amazon deals and price history |
| `stripe.ts` | Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing |
| `mailer.ts` | any SMTP or API sender | `MAIL_FROM`, `MAIL_URL` | Auth emails, alerts, contact |

## How to wire one

1. Put the key in `.env` (never in the repo, never in the Obsidian vault).
2. Replace the `notWired()` call with the real request.
3. Map the response onto the contract type. Do not change the contract to suit
   the vendor; that is what keeps them swappable.
4. Store the raw payload on `deal_events.raw_payload` so a parser fix can be
   replayed over history instead of losing the data.

## Why they throw instead of returning fake data

A stub that silently returns `[]` looks exactly like a working scan finding
nothing, which is the failure mode most likely to cost the price history. These
throw with the variable name in the message so the cause is unambiguous.
