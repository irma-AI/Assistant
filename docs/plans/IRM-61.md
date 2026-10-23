# IRM-61: Monthly ponytail audit routine

A monthly ponytail audit. In the old repository the on-demand ponytail audit was the part with a proven effect (two PRs removed a mechanism and a duplicate constant), while `shortcut:` debt grew from 2 to 42 and nobody ran the debt ledger.

- Add a routine to `docs/agents/routines.md`: monthly, follow `.claude/skills/ponytail-audit/SKILL.md` and `.claude/skills/ponytail-debt/SKILL.md`, then file one Linear issue per finding worth acting on, in Backlog for the owner to ready.
- The owner schedules the routine on claude.ai.

Acceptance criteria:
- `docs/agents/routines.md` lists the monthly ponytail audit with its prompt naming both skill files by path.
- The docs guard passes.

## Progress

- `docs/agents/routines.md` lists "Ponytail audit", monthly on the first Monday at 07:00 UTC, an hour after the claim sweep so they don't share a usage window. Its prompt names `.claude/skills/ponytail-audit/SKILL.md` and `.claude/skills/ponytail-debt/SKILL.md` by path, changes nothing, and files one Backlog issue per finding that no open issue covers. Both files exist (`ls`); the docs guard passes, though it scans only `CLAUDE.md`, `next-step` and rule files, not `routines.md`.

## Decisions

- Findings go to Backlog, not Ready: the audit's suggestions are deletions and refactors the owner should choose among, and intake builds whatever reaches Ready.

## Next step

Open the PR. After merge, the owner schedules the routine on claude.ai with this prompt.
