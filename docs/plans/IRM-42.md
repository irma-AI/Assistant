# IRM-42: Routes rule file, PR template, and the docs guard on rule files

Routes rule file and PR template (plan 2.5, 2.17): a rule file that loads only for src/routes/** with TanStack's file-route conventions and the warning to quote $ in shell paths, a PR template whose placeholders are comments so an unfilled template fails pr-sections, and the docs guard extended to rule files with a character budget.

Acceptance criteria:
- .claude/rules/routes.md is scoped to src/routes/** and covers $param, optional and splat segments, __root.tsx, pathless layouts and quoting $ in the shell.
- A PR description left as the unfilled template fails pr-sections.
- The docs guard checks every .claude/rules/*.md file's paths and its 3000-character budget.

## Progress

- `.claude/rules/routes.md` (paths `src/routes/**`) gives TanStack's file-route names, the `$` quoting rule, loaders through `*.functions.ts`, and route option order.
- `.github/pull_request_template.md` puts every placeholder in an HTML comment. Testing it showed `pr-sections` only stripped one-line comments, because jq's `s` flag doesn't let `.` match newlines; it now uses `[\s\S]*?`, and the unfilled template is a failing fixture.
- `guards/docs.sh` checks every `.claude/rules/*.md` against a 3000-character budget and its paths; two new fixtures cover both. `make check` passes.

## Decisions

- File-name patterns in the rule file are plain text, because the docs guard reads backticked names as paths that must exist.

## Next step

Open the PR with auto-merge on.
