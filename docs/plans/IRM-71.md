# IRM-71: next-step watches its PR until it merges

A next-step session ends once it opens the PR, before `ci` and `policy` finish, so a failed check is left to nobody: fix-rounds only acts after four failed commits, and Intake never revisits an issue In Review. Local runs hid this because the interactive session watched each PR by hand. A cloud session tested on 2026-10-23 can do the same: `enable_pr_auto_merge` worked as the owner's account, `subscribe_pr_activity` delivered the enqueued and merged events, a finished background command woke the session, REST `gh api` read the check runs, and `gh pr` commands got a GraphQL 403.

Change:

* `.claude/skills/next-step/SKILL.md` step 3: after auto-merge, watch the PR until it merges, subscribed to its activity and with a background command that polls the PR and its head commit's check runs over REST and exits when a check fails or the PR merges. A failed `ci` or `policy` gets read, fixed and pushed, then watched again; after three rounds, ask. The session ends when the PR has merged. The description says "to a merged PR". The path-reading line drops "routines may not load skills by name".
* `docs/guardrails.md`: 2.19 records the cloud facts above (not checked in a routine run) and why the session waits; the `next-step` entry in section 3 matches.
* `docs/agents/routines.md`: names `INTAKE_FIRE_URL` and `INTAKE_FIRE_TOKEN` in the `checks` environment, now that the dispatcher uses them.

Acceptance criteria:

* next-step step 3 has the watch, the REST poll as a backup, the fix loop with the three-round limit, and the end at merge, within its 6,000-character budget.
* guardrails 2.19 and section 3 say the same, with the routine-run part marked not checked.
* routines.md names the two values the dispatcher reads.
* make check passes.

## Progress

- `next-step` step 3: auto-merge through `enable_pr_auto_merge`, then steps 4 and 5 watch the PR (the subscription, a background REST poll that exits on a failed check or the merge), fix and push on red, three rounds, end at merge. The description and opening say "until its PR merges"; the path line no longer says routines may not load skills. 5,557 of 6,000 characters.
- `docs/guardrails.md` 2.19: the watch (not checked in a routine run), the cloud facts tested on 2026-10-23 and why the session waits; section 3's `next-step` entry matches.
- `docs/agents/routines.md`: names the dispatcher, `INTAKE_FIRE_URL` and `INTAKE_FIRE_TOKEN`.
- `guards/docs.sh` passes (scanned 68); `make check` passes against PostgreSQL 16.

## Decisions

- One background poll covers both a missed event and the merge, so the session has one thing to wait on besides the subscription.
- "Never waits in a session" became "never waits on the owner": the rule was about questions, and waiting on CI is now the point.

## Next step

Open the PR.
