# IRM-13: next-step skill: run one issue to a PR with auto-merge

The next-step skill (plan §3, 2.24): given one Linear issue, run it to an open PR with auto-merge on. The type label picks the flow, a plan file on the branch makes the work resumable, and questions go to Linear instead of waiting.

Acceptance criteria:
- next-step creates or resumes docs/plans/<ID>.md and <ID>.criteria.json, and only flips passes after running the proving command.
- The flow table covers feature, bug, deploy-failure, ui, chore and docs.
- The docs guard covers next-step with a 6000-character budget.

## Progress

- Wrote `.claude/skills/next-step/SKILL.md` and listed it as local in `.claude/skills.lock.json`.
- Extended `guards/docs.sh` to next-step with a 6000-character budget; `guards/docs.test.sh` covers both new failures. `make check` passes.

## Decisions

- Branches are named after the issue (`irm-12-...`), so a resumed run finds its work with `git fetch` alone.
- Plans live in `docs/plans/` and stay after merge, because merged issues are archived in Linear.

## Next step

Open the PR with auto-merge on.
