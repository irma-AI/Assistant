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
- Skeptic pass, round 2 (on 78a000d), confirmed with the repo's tools: `.gitattributes` with `-diff` hid a committed secret from gitleaks; a nested `package.json` with a `prettier` key switched formatting checks off; `.gitignore` or `.ignore` inside `src/` made ast-grep skip a file; `mise.local.toml`, `.mise.toml` and `.config/mise.toml` change the tools and their `PATH`.
- Round 2 still finding bypasses meant the design needed another look, so the owner chose an allowlist (2026-10-23): only `src/`, `e2e/`, `migrations/` and `docs/plans/` are free, and inside them dotfiles, package manifests, `*.config.*`, tsconfigs, makefiles, `CLAUDE*.md` and the migration provider stay protected. Every bypass from both rounds is a test case; 64 cases pass, and blank lines in the file list are ignored.
- `CLAUDE.md` (3809 characters) and guardrails 2.12 describe the allowlist. `make check-repo` passes.

## Decisions

- An allowlist, because each tool reads more configuration files than any list can name, so new files are protected by default.
- Test files stay free: skipping a test is for the review to judge.

## Next step

Open the PR with auto-merge on.
