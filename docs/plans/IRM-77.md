# IRM-77: Two workers: claim by push, a local worker, and the cloud count

Two workers draw from the Ready queue: the cloud Intake routine (one session at most) and one local Claude Code session on `/loop`. Owner decisions 2026-10-24: no stall rule; budgeted files are rewritten for density, never cut; the local worker's prompt goes in routines.md.

Change:

* Claim by push: a worker claims an issue by committing to the branch named exactly after it (`irm-12`), the plan for a new issue or a claim line in Progress for a resumed one, and pushing without force. A rejected push means another worker holds it: end without changing the issue. `.claude/skills/next-step/SKILL.md` steps 1.2 and 1.3 carry this, rewritten for density to stay within 6,000 characters with every existing rule kept.
* `docs/agents/intake.md`: a local worker (so named in its prompt) adds the `local` label once its claim push succeeds and is never held back by cloud work; a routine run with no payload (the daily backstop) stops while an issue without `local` is In Progress or In Review.
* The dispatcher counts In Progress and In Review issues without `local` against MAX_PARALLEL (1), so a cloud session watching its PR still counts and the local worker never takes the cloud slot. Selection tests cover both.
* `docs/agents/routines.md`: a Local worker section with its `/loop` prompt and what it needs (own checkout, local database, gh, auto mode, machine awake, restart within 7 days).
* `docs/agents/issue-tracker.md`: the `local` label.
* `docs/guardrails.md` 2.20: the two-worker model, the claim and the count; the stale "neither has run yet" line from PR 62's review.
* `guards/docs.sh`: the over-budget message says to rewrite denser and keep every fact.

Acceptance criteria:

* next-step claims by a non-force push to `irm-<n>` and ends on rejection, within 6,000 characters, with every rule it had before still present.
* intake.md has the local worker's label step and the backstop's check.
* The dispatcher's tests show In Review counting, `local` issues not counting, and a `local` issue leaving the cloud slot free.
* routines.md holds the local worker's prompt and requirements; issue-tracker.md names the `local` label.
* guardrails 2.20 describes the two workers, and the docs guard's message asks for a denser rewrite.
* make check passes.

## Progress

- Plan written.

## Decisions

## Next step

Rewrite next-step steps 1.2 and 1.3 with the claim.
