# Scheduled routines — canonical copies

Scheduled tasks are PER MACHINE: the scheduler reads
`~/.claude/scheduled-tasks/{taskId}/SKILL.md` on whichever machine runs them.
These are the canonical copies so any machine can recreate them.

To set up on a new machine, ask Claude to create each scheduled task with the
matching cron and paste the corresponding file as the prompt:

| task | cron (local time) | what it does |
|---|---|---|
| deal-verify-publish | `3 0,6,9,12,15,18,21 * * *` | HD: searchModel discovery + 11-store verify |
| target-scan | `12 5,17 * * *` | Target: 120-page category sweep + shelf counts + re-check |
| lowes-scan | `37 4,16 * * *` | Lowe's: 7 deal lists + units guard + re-check |
| bestbuy-scan | `52 5,17 * * *` | Best Buy: gateway outlet sweep (2 facet passes) + re-check |
| sbb-nightly | `23 2 * * *` | Site self-improvement cycle (spot/blueprint/build) |

MIND THE PATHS: these files reference C:\Users\12108\deal-engine — adjust to
the repo path on the machine you are installing them on. Walmart has NO
routine yet; its sweep (scripts/walmart-sweep.browser.js) is run manually.
