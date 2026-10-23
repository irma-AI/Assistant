# IRM-60: CI review: UI completeness counts as needed

The CI review doesn't run hooks, so its necessity lens (`ponytail-review`) and the task-fit judge could flag interface states, motion or responsive work as unneeded on a UI PR. Add one sentence to `policy`'s review prompt: for UI changes, what DESIGN.md or impeccable's craft floor (`.claude/skills/impeccable/reference/craft-floor.md`) requires counts as needed.

Acceptance criteria:
- `policy`'s review prompt says that for UI changes, what DESIGN.md or the craft floor requires counts as needed, and names the craft floor file by path.
- zizmor and `make check` pass.

## Progress

- `policy.yml`'s review prompt, on the `ponytail-review` lens: for UI changes, what DESIGN.md or impeccable's craft floor (`.claude/skills/impeccable/reference/craft-floor.md`) requires counts as needed and in scope, for necessity and for task fit. zizmor passes.
- guardrails 2.11 says the same, and why: hooks don't run in CI.

- Skeptic pass on 6266df7, one lens: P1, a bare "DESIGN.md" could only be found under `pr/` (main has none) and `src/DESIGN.md` is a free path, so a PR could write the bar it is judged by; fixed by naming the working directory's copy (the default branch's) and saying a PR's own DESIGN.md is a change to judge. P2, polish "in scope" had no bound; fixed by limiting it to the surfaces the issue touches. Checked: the prompt still parses as YAML, the craft floor exists on main.

## Decisions

- The sentence covers task fit too, because the judge files "work the issue didn't ask for" as P1 and would otherwise flag the states and polish the UI steps add.
- The craft floor is read from the default branch's checkout, like the lens files, so a PR can't rewrite the bar it is judged by.

## Next step

Open the PR.
