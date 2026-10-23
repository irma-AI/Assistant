# IRM-65: Daily reminders on questions waiting in Needs input

A question to the owner sits in Needs input with nothing to bring it back up. The old repository had five escalations open, the oldest for days, and its audit asks to flag items older than a set number of days.

Acceptance criteria:
- `linear.yml` also runs daily, and on that run sets a Linear reminder for the owner on each IRM issue in Needs input not updated for 3 days, so the owner is reminded at least every 3 days until the question moves (daily, if a reminder doesn't count as an update). (A comment would notify no one: the workflow's Linear key is the owner's own.)
- The push-time archive job is unchanged.
- zizmor and `make check` pass, and guardrails 2.22 describes the reminder.

## Progress

- `linear.yml` runs daily at 07:23 UTC as well. The `archive` job now runs only on push, unchanged otherwise; the new `remind` job runs only on schedule.
- `remind` finds IRM issues in Needs input not updated for 3 days (`updatedAt: {lt: "-P3D"}`; run live, the same filter with `-PT1H` returned IRM-54, the one waiting issue) and sets `issueReminder` five minutes ahead on each, which notifies the owner.
- guardrails 2.22 describes the reminder and why it isn't a comment. zizmor passes.

- Skeptic lens (workflows): no P0 or P1. The open P2, whether a reminder counts as an update and so spaces reminders 3 days apart, is answered by wording the criterion "at least every 3 days"; either way a waiting question resurfaces. Fixed P3s: a failed reminder warns and the loop goes on; the 50-issue page carries a `shortcut:` comment. Left: a push can cancel a pending scheduled run under `concurrency: linear`, skipping that day's reminders.

## Decisions

- A reminder, not a comment: the `checks` environment's Linear key is the owner's, and Linear doesn't notify a user of their own comments. The issue's first criterion was reworded to match.
- The reminder mutation was not run live, so as not to send the owner a test notification; its shape is from Linear's schema (`issueReminder(id, reminderAt): IssuePayload`).

## Next step

Skeptic pass, then open the PR.
