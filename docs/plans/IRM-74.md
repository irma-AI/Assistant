# IRM-74: next-step watch: a two-hour cap, then ask

The review on PR 59 (IRM-73) found that next-step's watch has no end when the queue drops a PR and the drop notice is missed: the queue retests on its own commit, the head commit's checks stay green, and the backup poll restarts every 30 minutes while the issue sits In Review. Owner decision 2026-10-23: cap the watch.

Change:

* `.claude/skills/next-step/SKILL.md` step 3.4: after two hours with the PR still open and its checks green, ask (section 4) that the PR is stuck, and end the session.
* `docs/guardrails.md` 2.19: the watch bullet names the two-hour cap.

Acceptance criteria:

* next-step's watch ends after two hours with the PR open and green, asking through section 4, within its 6,000-character budget.
* guardrails 2.19 names the cap.
* make check passes.

## Progress

- Plan written.

## Decisions

## Next step

Add the cap.
