# IRM-76: Readying an issue starts the Intake dispatcher

The dispatcher's 10-minute schedule ran twice in about 8.5 hours after it landed (23:50 and 02:01 UTC on 2026-10-23/24); GitHub's docs say queued scheduled jobs may be dropped. Merges start the dispatcher through push, but an issue readied while nothing merges waits for a scheduled run that may not come, or for the daily backstop. Owner decision 2026-10-24: whoever readies an issue also starts the dispatcher, and the result is evaluated in use.

Change:

* `docs/agents/issue-tracker.md`: a "Ready an issue" convention: move it to Ready, then start `.github/workflows/intake-dispatch.yml` (`gh workflow run intake-dispatch.yml`, or the GitHub tools' `actions_run_trigger` where `gh` can't reach GitHub). The "publish to the issue tracker" section points at it for issues filed straight into Ready.
* `docs/guardrails.md` 2.20: says the session that readies an issue starts the dispatcher, why (the schedule's dropped runs), and that an issue readied in Linear's own app waits for a merge, a scheduled run or the backstop. Not checked.

Acceptance criteria:

* issue-tracker.md tells whoever readies an issue to start the dispatcher, with both ways to start it.
* guardrails 2.20 records the step, the schedule observation and the gap for issues readied outside Claude, marked not checked.
* make check passes.

## Progress

- Plan written.

## Decisions

## Next step

Edit issue-tracker.md.
