# IRM-40: Use the review skills: CI lenses from skill files, skeptic-pass in next-step

Use the review skills (plan 2.11, §3): policy's AI review reads its lenses from the default branch's skill files (skeptic-pass for correctness, regression and safety, ponytail-review for necessity, agentic-actions-auditor when the PR changes .github/), and next-step runs skeptic-pass before the PR on changes to access control, data deletion, migrations, CI or guards.

Acceptance criteria:
- The review prompt names the three lens files by path, read from the default branch's checkout, and keeps the task-fit judge and severities.
- next-step runs skeptic-pass on the frozen head before the PR for those risk paths.

## Progress

- `policy.yml`'s review prompt names `.claude/skills/skeptic-pass/SKILL.md`, `.claude/skills/ponytail-review/SKILL.md` and, for changes under `.github/`, `.claude/skills/agentic-actions-auditor/SKILL.md`, read from the default branch's checkout; the task-fit judge and severities are unchanged, and `--max-turns` goes from 30 to 40 for the extra reading.
- `next-step` runs `skeptic-pass` on the frozen head before the PR for access control, data deletion, migrations, CI or guards. `make check-repo` passes.

## Decisions

- The review applies the skeptic lenses one after another, because it has no subagents and only read tools.

## Next step

Open the PR; the new prompt takes effect for the PR after this one.
