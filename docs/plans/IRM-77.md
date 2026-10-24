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

- `next-step` 1.2 and 1.3: the branch is exactly `irm-12`; a resumed issue gets a claim line in **Progress**, a new one its plan; step 1.3 pushes without force before moving the issue to In Progress, and a rejected push ends the session. Tightened four sentences (the opening, the path line, step 1.1's text rule, the UI screenshots, the watch and the ask's last line) without dropping a fact: 5,963 of 6,000 characters.
- `docs/agents/intake.md`: the two workers, the backstop's count check, and the local worker's `local` label after the claim push.
- Dispatcher: `inFlight` counts In Progress and In Review without `local`; three new cases in `intake-pick.test.sh` (one in flight, a local issue leaves the slot free, a cloud issue beside a local one). The new query, run live against IRM, answered `wait: IRM-77 in flight`.
- `docs/agents/routines.md`: the Local worker section with its `/loop` prompt and needs; `issue-tracker.md`: the `local` label; guardrails 2.20: the two workers, the claim and the count, and the first fire replacing the stale not-checked line; `guards/docs.sh`: the over-budget fix says rewrite denser.
- The `local` label exists in IRM.
- `guards/docs.sh` first failed on a backticked `/loop`, read as a path; it is plain text now. `guards/docs.sh`, zizmor and `make check` pass.

- Review on PR 63: a worker fired for an issue another took meanwhile would see it In Progress, resume it and land a fast-forward. Fixed: intake stops on any state but Ready, so a stuck issue resumes only by moving back to Ready. The winner of the push now sets the `local` label to match itself (cloud removes it), so a stale label can't hide a cloud session. The selection reads each issue's state and counts In Progress and In Review; two new cases (In Review counts, Needs input doesn't). guardrails 2.20's older sentences match. 16 cases pass; `make check` passes.

## Decisions

- No stall rule (owner): a dead worker's issue holds the cloud slot until the owner moves it.
- The claim is a plain push of a new commit, not a branch-create, so it also serialises two workers resuming the same issue from Needs input.
- The local worker labels its issue only after its push wins, so a lost race can't mislabel the cloud's issue.

- Between moving an issue to In Progress and its label, the local worker's issue counts as the cloud's for seconds. That holds the cloud back and never starts an extra session; a local worker that dies there leaves the issue for the owner, as any dead worker does.

## Next step

Wait for `policy` on PR 63.
