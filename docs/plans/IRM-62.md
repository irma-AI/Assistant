# IRM-62: Docs guard checks docs/agents

The docs guard checks paths, make targets and budgets only in `CLAUDE.md`, `next-step` and rule files. The routine prompts in `docs/agents/routines.md` and the tracker conventions in `docs/agents/issue-tracker.md` are the entry points every routine starts from (guardrails 2.28), and nothing checks what they name. The old repository's audit lists the docs-reference guard under "adopt".

Acceptance criteria:
- `guards/docs.sh` scans every `docs/agents/*.md` with a 4,000-character budget each, for backticked paths and make targets.
- `guards/docs.test.sh` fails a fake repository whose `docs/agents/` file names a missing path or runs over budget.
- guardrails 2.5 names the scanned documents.

## Progress

- `guards/docs.sh` adds every `docs/agents/*.md` with a 4,000-character budget; the real documents pass (`docs: scanned 66`, up from 62), with `routines.md` at 1,414 and `issue-tracker.md` at 1,253 characters.
- `guards/docs.test.sh`: an agent document over budget fails, one naming a missing path fails, one naming a real path passes.
- guardrails 2.5 names the scanned documents.

## Decisions

- 4,000 characters each, like `CLAUDE.md`: both documents are loaded by routines on every run.

## Next step

Open the PR.
