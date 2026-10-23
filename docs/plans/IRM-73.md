# IRM-73: next-step watch: Auto-fix as the subscription, no auto-merge signal

The review on PR 58 (IRM-72) found that next-step reads "auto-merge goes off" as the queue dropping the PR. On PR 58 itself, auto-merge read as off (REST auto_merge null) from the moment it entered the queue at 21:19:54 while it waited normally (isInMergeQueue true, AWAITING_CHECKS), so the poll would exit and count a fix round for nothing. Separately, the owner turned on each routine's "Auto-fix pull requests" setting, which watches CI and review comments on the PRs a run opens and lets Claude push fixes.

Change:

* `.claude/skills/next-step/SKILL.md` step 3: the watch relies on the routine's Auto-fix subscription, or `subscribe_pr_activity` outside a routine; the REST poll stays only as a backup for a missed event and exits on a failed check, a merge or a close, 30 minutes at most. A notice that the queue removed the PR is handled like a failed check. Auto-merge state is no longer read as a signal.
* `docs/agents/routines.md`: every routine has Auto-fix pull requests on.
* `docs/guardrails.md` 2.19: the watch bullet matches, and the Why records that auto-merge clears when a PR is queued (seen on PR 58).

Acceptance criteria:

* next-step's watch no longer treats auto-merge going off as a drop, handles a queue-removal notice like a failed check, and names Auto-fix as the subscription in routines, within its 6,000-character budget.
* routines.md lists Auto-fix pull requests among every routine's settings.
* guardrails 2.19 matches next-step and records the PR 58 observation.
* make check passes.

## Progress

- `next-step` step 3.4: Auto-fix is the subscription in a routine, `subscribe_pr_activity` elsewhere; the REST poll exits on a failed check, a merge or a close, 30 minutes at most; auto-merge is named as no signal. Step 3.5: a queue-removal notice is handled like a failed check. 5,858 of 6,000 characters.
- `docs/agents/routines.md`: every routine has "Auto-fix pull requests" on.
- `docs/guardrails.md` 2.19: the watch bullet matches; the Why records PR 58's `auto_merge: null` while queued, and that queue state is GraphQL only.
- `guards/docs.sh` and `make check` pass.

## Decisions

- A drop is detected from the subscription's notice, not from a field: REST has no queue state, and the queue's own checks run on a temporary commit.

## Next step

Open the PR.
