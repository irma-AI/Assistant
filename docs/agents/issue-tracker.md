# Issue tracker: Linear

Issues for this repository live in Linear, team **IRM**. Use the Linear connector's tools in sessions and routines.

## Conventions

- **Create an issue**: in team IRM, with one type label (`feature`, `bug`, `ui`, `chore`, `docs`) and the acceptance criteria in the description. Add `ci-change` at creation when the work changes a protected path; a label added after the issue reaches Ready doesn't count.
- **Read an issue**: by its identifier, such as `IRM-12`, with its description, labels and comments.
- **Comment on an issue**: as a comment on the issue.
- **Ready an issue**: move it to Ready, then start the Intake dispatcher with `gh workflow run intake-dispatch.yml`, or the GitHub tools' `actions_run_trigger` for that workflow where `gh` can't reach GitHub. Its schedule drops most runs, so without this the issue waits for the next merge or the daily backstop.
- **Local work**: the local worker adds the `local` label to the issues it claims, which keeps them out of the cloud's one-session count.
- **Ask the owner**: comment the question, then move the issue to Needs input.
- **Blocking**: Linear's native "blocked by" relation between issues.
- **Close**: a merged PR whose description says `Closes IRM-12` moves the issue to Done; every merge then archives closed issues.

## When a skill says "publish to the issue tracker"

Create a Linear issue in team IRM, in Ready when it is ready to build, and start the dispatcher as in **Ready an issue**. A skill's `ready-for-agent` label means the same here: the Ready state with one type label, plus `ci-change` when the work changes a protected path. There is no such label.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.
