# IRM-49: Protect the files that decide what CI runs

From the guardrails audit at fcad227 (2026-10-23). `protected-paths.sh` protected `Makefile` but not `package.json` (whose `e2e` script ci runs), the Vitest, Playwright and TanStack Router configuration, `scripts/`, the migration provider or `docs/agents/`, so an agent with a failing test job could switch the tests off without touching a protected path.

Acceptance criteria:
- make check-repo runs protected-paths.test.sh and it passes.
- CLAUDE.md, guardrails 2.12 and 2.28 name the same paths as the regex.

## Progress

- The regex adds the paths the audit named; `.github/scripts/protected-paths.test.sh` runs in `make check-repo`.
- Skeptic pass, round 1 (three lenses on af26643):
  - Correctness: the test couldn't catch over-matching. It now has near-miss cases (`scripts-old/x`, `src/package.json`, `docs/agents-x/a`, `Makefile.bak`); a mutated regex with `scripts` unanchored fails it.
  - Safety, confirmed by running the tools: make reads a new `GNUmakefile` or `makefile` before `Makefile`; a nested `src/eslint.config.js` replaces the root config; `.prettierignore`, `.prettierrc` and `prettier.config.*` and gitleaks' `.gitleaksignore` and `.gitleaks.toml` were unprotected; a rename showed only the new name. Configuration files now match at any depth, those names are added, and `policy` lists a renamed file under its old name too (from the PR files API's `previous_filename`).
  - Regression: none. Every PR that edits `package.json` (adding a dependency) now needs a `ci-change` issue, as do changes to `scripts/` and `docs/agents/`.
- 44 cases pass; `make check-repo` passes; CLAUDE.md is 3941 characters.

## Decisions

- Left unprotected, as out of this issue's scope: `Dockerfile`, `.dockerignore` and `pnpm-lock.yaml` (they change what ships, not whether CI passes), and test files (skipping a test is for the review to judge).

## Next step

Skeptic round 2, then the PR.
