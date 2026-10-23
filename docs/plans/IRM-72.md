# IRM-72: next-step watch: end on a dropped or closed PR, and the gh fallback

The CI review on PR 57 (IRM-71) found four problems in the new watch step of next-step.

* The watch can hang. The background poll exits only on a failed check on the head commit or a merge. The merge queue retests on its own commit, so a failed retest, a conflict, a closed PR or auto-merge turned off leaves every head check green and nothing ends the wait, while the issue sits In Review.
* Step 3 dropped the `gh pr merge --auto` fallback, so a local run without the GitHub tools has no documented way to turn on auto-merge.
* "ask (step 4)" in section 3 now reads two ways, because item 4 of that list is the watch.
* guardrails section 3 still says skills are named by path "because routines read files, not skill names", which next-step no longer says.

Change:

* `.claude/skills/next-step/SKILL.md`: the poll also exits when the PR closes or auto-merge goes off, and after 30 minutes at most, and is restarted while the PR is open and queued; a PR the queue dropped is fixed, auto-merge turned on again, and counted as a round; a PR closed by fix-rounds ends the session. `gh pr merge --auto` returns as the fallback where `gh` reaches GitHub's GraphQL API. References to the ask section say "section 4".
* `docs/guardrails.md`: 2.19's watch bullet and section 3's reason for naming skills by path match next-step.

Acceptance criteria:

* next-step's watch ends on a merge, a close, auto-merge going off or a failed check, never waits more than 30 minutes per poll, and stays within its 6,000-character budget.
* next-step names `gh pr merge --auto` as the fallback.
* Every reference to the ask section in next-step reads "section 4".
* guardrails 2.19 and section 3 match next-step.
* make check passes.

## Progress

- Plan written.

## Decisions

## Next step

Change next-step step 3.
