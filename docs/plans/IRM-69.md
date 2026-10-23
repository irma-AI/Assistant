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

- Plan written.

## Decisions

## Next step

Write `docs/agents/intake.md`.
