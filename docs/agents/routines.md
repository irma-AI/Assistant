# Routines

Routines are scheduled cloud sessions on claude.ai. Each prompt only names a file in this repository, so what a routine does changes through a reviewed PR, never in claude.ai's settings.

| Routine | Schedule | Prompt |
|---|---|---|
| Intake | Every hour | Pick the oldest issue in Linear team IRM that is in Ready and that no open pull request closes, and follow `.claude/skills/next-step/SKILL.md` for it, as a plain set of instructions. If no issue is Ready, stop. |
| Claim sweep | Weekly, Monday 06:00 UTC | Follow `.claude/skills/claim-sweep/SKILL.md`, as a plain set of instructions. |

Every routine:

- runs on the repository's default branch, in the Assistant cloud environment, so the SessionStart hook sets up the tools, the database and the git hooks;
- has only the Linear connector on, connected to the workspace that holds team IRM;
- reads the named file by path, because repository skills may not load in routines.
