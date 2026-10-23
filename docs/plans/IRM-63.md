# IRM-63: Daily check of the live ruleset

The audit workflow checks the live ruleset only after a push to main, so a change made in GitHub's settings goes unseen until the next merge. The old repository's audit asks for a scheduled diff of the live ruleset.

Acceptance criteria:
- `audit.yml` also runs daily; the ruleset check runs on schedule and on push, the protected-path check only on push.
- A scheduled run that finds drift opens one Linear issue titled "The main ruleset drifted", and files none while one with that title is open.
- zizmor and `make check` pass.

## Progress

- `audit.yml` also runs daily at 06:17 UTC. The protected-path step runs only on push, since it judges the pushed commit; the issue step now fires on a step that failed, not one that was skipped.
- On a scheduled run, drift opens "The main ruleset drifted" unless an open issue with that title exists; the Linear query was run live and returned 0. zizmor passes.
- guardrails 2.12 describes the daily check, and 6.4 no longer lists the ruleset check among the jobs left unscheduled.

- Skeptic lens (workflows): no P0 or P1. Fixed P2: a Linear error answered with HTTP 200 made the open-issue count 0 and would have filed a duplicate; the count now fails on missing data. Fixed P3: the scheduled issue says the daily check found drift, not that a commit failed. Left: a GitHub API error reads as drift (as on push before; the dedupe caps it at one issue), and GitHub turns scheduled workflows off after 60 days without activity in the repository.

## Decisions

- The push-time title stays per commit ("Audit failed on main at <sha>"), because each failing merge is its own event.

## Next step

Skeptic pass, then open the PR.
