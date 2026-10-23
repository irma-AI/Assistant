# IRM-69: Event-driven Intake: intake.md and the routine docs

Intake moves from an hourly routine to the routine's API trigger, fired by a GitHub Actions dispatcher (the companion issue), plus a daily backstop run. This issue is the routine side and the docs. Owner decision 2026-10-23.

Change:

* New docs/agents/intake.md, within the agent-doc budget. The payload must be exactly one ID matching ^IRM-\d+$ inside the routine-fire-payload block; anything else, stop. No payload means the daily backstop: pick the oldest Ready issue in team IRM that no open PR closes and nothing short of Done blocks, or stop. An issue in Ready: move it to In Progress, read it again and stop if it changed. In Progress: resume from its plan file. Any other state: stop. Then follow .claude/skills/next-step/SKILL.md by path.
* docs/agents/routines.md: the Intake row becomes the API trigger plus a daily backstop, with the prompt "Read docs/agents/intake.md and follow it as a plain set of instructions. The issue ID for this run, if any, is in the routine-fire-payload block." The ponytail audit becomes weekly, on Monday, with no date check. Schedules are in the claude.ai account's local time zone, not UTC, per the routines docs.
* docs/guardrails.md: 2.20 (the intake mechanism and why), 2.26 (weekly audit), 2.28 and 6.4 (the routines docs now say repository skills load in runs; reading by path stays), 6.3 (routines have native GitHub triggers for pull requests and releases, not issues; Linear has none; Actions starts Intake through the API trigger). Mark each new piece not checked.

Acceptance criteria:

* docs/agents/intake.md exists within the docs guard's budget and covers the payload check, the backstop, the claim step and the state rules above.
* routines.md shows the Intake trigger and prompt, the weekly ponytail audit and the time-zone note.
* guardrails 2.20, 2.26, 2.28, 6.3 and 6.4 say the above, with the new pieces marked not checked.
* make check passes.

## Progress

- `docs/agents/intake.md`: checks the payload, the daily backstop's pick, the claim (blocked or already-closed issues stop before it), the state rules, then `next-step` by path. 905 characters.
- `docs/agents/routines.md`: Intake's API trigger and prompt, the weekly ponytail audit on Monday 09:00, the local time zone, and where the trigger's URL and token live.
- `docs/guardrails.md`: 2.20, 2.26, 2.28, 6.3 and 6.4, with the new pieces marked not checked.
- `guards/docs.sh` passes (scanned 67); `make check` passes against PostgreSQL 16.

## Decisions

- The claim checks blockers and open PRs first, so an issue fired by hand while blocked isn't left In Progress, where `next-step` would end without changing it.
- Without automatic resume, a dead session leaves its issue In Progress and the dispatcher fires nothing until the owner acts. Recorded in 2.20 as the visible failure, rather than letting work run twice.
- Claim sweep at 08:00 and the audit at 09:00 local are today's 06:00 and 07:00 UTC in Stockholm summer time.

- Review on PR 55: the claim now reads the issue again and stops if anything besides its state changed; the trigger's secrets left `routines.md` for the dispatcher's PR; the dead-session bullet in 2.20 is marked not checked.

## Next step

Wait for `policy` on PR 55.
