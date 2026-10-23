# IRM-34: Edit-time hooks: format after edits, refuse edits to generated files

Edit-time hooks (plan section 4, stage 0): Claude Code hooks in the repository format each file right after the agent edits it, and refuse edits to generated files with the command that regenerates them.

Acceptance criteria:
- An Edit or Write to src/routeTree.gen.ts or src/server/db.gen.ts is refused with "run make generate".
- A file the agent edits is formatted with prettier right after the edit, following .prettierignore.
- Both hooks fail open on their own errors, because CI repeats the checks.

## Progress

- `.claude/hooks/generated-files.sh` (PreToolUse on Edit, Write and MultiEdit) exits 2 with the fix for `src/routeTree.gen.ts` and `src/server/db.gen.ts`; `.claude/hooks/format.sh` (PostToolUse) runs prettier on the edited file and ignores its own errors.
- `.claude/hooks/test.sh` runs both on sample tool calls (both generated files refused, a route and a migration allowed, an edited file formatted) and runs in `make check-repo`; all pass.

## Decisions

- Formatting fails open, since CI checks formatting again; the generated-file guard refuses only on a match.

## Next step

Open the PR with auto-merge on.
