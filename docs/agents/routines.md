# Routines

Routines are scheduled cloud sessions on claude.ai. Each prompt only names a file in this repository, so what a routine does changes through a reviewed PR, never in claude.ai's settings.

| Routine | Schedule | Prompt |
|---|---|---|
| Intake | Its API trigger, fired by a GitHub Actions workflow when an issue is ready, plus a daily backstop | Read `docs/agents/intake.md` and follow it as a plain set of instructions. The issue ID for this run, if any, is in the routine-fire-payload block. |
| Claim sweep | Weekly, Monday 08:00 | Follow `.claude/skills/claim-sweep/SKILL.md`, as a plain set of instructions. |
| Ponytail audit | Weekly, Monday 09:00 | Follow `.claude/skills/ponytail-audit/SKILL.md` and then `.claude/skills/ponytail-debt/SKILL.md`, as plain sets of instructions, and change nothing. For each finding worth acting on that no open Linear issue covers, file one issue in team IRM, in Backlog, with one type label and acceptance criteria, plus `ci-change` when it touches a protected path. With more than 10 `shortcut:` comments, also file one issue to pay down the oldest five, unless one is open. The owner readies them. |

Schedules are in the claude.ai account's local time zone, not UTC. `.github/workflows/intake-dispatch.yml` fires Intake with the trigger's URL and token, kept in the `checks` environment as the variable `INTAKE_FIRE_URL` and the secret `INTAKE_FIRE_TOKEN`.

Every routine:

- runs on the repository's default branch, in the Assistant cloud environment, so the SessionStart hook sets up the tools, the database and the git hooks;
- has only the Linear connector on, connected to the workspace that holds team IRM;
- has "Auto-fix pull requests" on, so the run watches the CI and review comments of the PR it opens;
- reads the named file by path, so it follows the reviewed copy whether or not the skill loader picks the skill up.

## Local worker

One local Claude Code session can work the same queue beside the cloud. Start it in a checkout used for nothing else, with PostgreSQL running and `DATABASE_URL` set, `gh` signed in, auto mode on and the machine kept awake, and give it:

```text
/loop 10m You are the local Intake worker. Read docs/agents/intake.md and follow it as a plain set of instructions. There is no routine-fire-payload: take the next issue yourself.
```

A loop only fires while the session is idle, so it builds one issue at a time. It expires 7 days after it starts, so start it again within a week.
