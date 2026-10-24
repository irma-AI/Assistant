# IRM-77: Two workers: a local worker beside the cloud, claim first

A second worker beside the cloud: one local Claude Code session on a /loop, drawing from the same Ready queue, while the cloud still runs one session at a time. Rescoped on 2026-10-24 after PR 63 closed: the owner chose the simple version. A worker claims an issue by moving it to In Progress as its first write; two workers picking the same issue within the same few seconds is rare enough at 20-40 PRs a day on a 10-minute loop that nothing more handles it. next-step does not change.

Change:

* `docs/agents/intake.md`: once a Ready issue is picked and its blockers and open PRs checked, the first write moves it to In Progress, and the local worker (so named in its prompt) adds the `local` label in the same update. A routine run with no payload (the daily backstop) stops while an issue without `local` is In Progress or In Review.
* The dispatcher counts In Progress and In Review issues without `local` against MAX_PARALLEL (1), so a cloud session watching its PR still counts and the local worker never takes the cloud slot. Selection tests cover In Review, other states and `local` issues.
* `docs/agents/routines.md`: a Local worker section with its /loop prompt and what it needs (its own checkout, git identity `Claude <noreply@anthropic.com>`, local database, gh, auto mode, machine awake, restart within 7 days).
* `docs/agents/issue-tracker.md`: the `local` label.
* `docs/guardrails.md` 2.20: the two workers, the claim and the count, and the first fire (IRM-75) in place of the stale "neither has run yet" line.
* `guards/docs.sh`: the over-budget message says to rewrite denser and keep every fact.

Acceptance criteria:

* intake.md claims with In Progress as the first write, adds `local` for the local worker, and has the backstop's count check.
* The dispatcher's tests show In Review counting, other states not counting, and `local` issues leaving the cloud slot free.
* routines.md holds the local worker's prompt and requirements; issue-tracker.md names the `local` label.
* guardrails 2.20 describes the two workers, and the docs guard's message asks for a denser rewrite.
* next-step is unchanged, and make check passes.

## Progress

- The dispatcher's count and its tests come from the closed PR 63 unchanged; that part passed its reviews. `intake-pick.test.sh`: 16 cases pass, including In Review counting, Needs input not counting and `local` issues leaving the cloud slot free.
- `docs/agents/intake.md`: the two workers, the backstop's count check, and the claim as the first write with `local` added by the local worker. 1,349 characters.
- `docs/agents/routines.md`: the Local worker section from PR 63, with the git identity. `issue-tracker.md`: the `local` label. guardrails 2.20: the two workers, the claim, the count, the unhandled same-seconds race, the first fire. `guards/docs.sh`: rewrite denser.
- `git diff origin/main -- .claude/skills/next-step` is empty. `guards/docs.sh` and `make check` pass.
- The old `irm-77` branch with the push-claim design is deleted.

## Decisions

- No claim protocol beyond In Progress as the first write (owner): at 20 to 40 PRs a day on a 10-minute loop, two workers picking the same issue within seconds is rare and costs one duplicate session.

## Next step

Open the PR.
