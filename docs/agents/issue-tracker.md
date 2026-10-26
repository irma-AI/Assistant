# Issue tracker: Linear

Issues for this repository live in Linear, team **IRM**. Use the Linear connector's tools in sessions and routines.

## Conventions

- **Create an issue**: in team IRM, with one type label (`feature`, `bug`, `ui`, `chore`, `docs`) and the acceptance criteria in the description. Add `ci-change` at creation when the work changes a protected path; a label added after the issue reaches Ready doesn't count.
- **Read an issue**: by its identifier, such as `IRM-12`, with its description, labels and comments.
- **Comment on an issue**: as a comment on the issue.
- **Ready an issue**: move it to Ready when it can be built now: every issue it needs is linked as "blocked by"; every account, key or document it needs exists, or the owner task that provides it is linked as a blocker; it has one type label and acceptance criteria, and `ci-change` when it changes a protected path. Intake checks Linear every 2 minutes, so nothing else is needed.
- **Missing outside input**: make it its own small owner issue, linked as a blocker, not a line on IRM-54.
- **Answer a question**: reply on the issue and move it from Needs input to Ready. If it already has a pull request, the next session continues on it.
- **Local work**: the local worker adds the `local` label to the issues it claims, which keeps them out of the cloud's one-session count.
- **Ask the owner**: comment the question, then move the issue to Needs input. A question that official docs, law or established practice answers is research, not an owner question (`.claude/skills/shaping/SKILL.md`). Decisions sections use that skill's record fields: drivers, options, choice with source, accepted risks, revisit trigger.
- **Blocking**: Linear's native "blocked by" relation between issues.
- **Close**: a merged PR whose description says `Closes IRM-12` moves the issue to Done; every merge then archives closed issues.

## When a skill says "publish to the issue tracker"

Create a Linear issue in team IRM, in Ready when it is ready to build. A skill's `ready-for-agent` label means the same here: the Ready state with one type label, plus `ci-change` when the work changes a protected path. There is no such label.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.
