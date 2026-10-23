# Assistant

Agents build this repository end to end; nobody reviews code by hand. CI on GitHub is the authority, and every rule below names the check that enforces it. Why each guard exists, and the known risks, are in `docs/guardrails.md`.

## Workflow

- The app is TanStack Start (React) on Node, with pnpm; `make install` sets up the pinned tools and dependencies, and `make dev` serves it. `make check` needs `DATABASE_URL` pointing at a PostgreSQL 16 database it may migrate.
- Tests attach at three seams: server functions with Vitest against a real PostgreSQL, pure functions on stored sample records, and the browser through Playwright in `e2e/` (WebKit, iPhone profiles).
- Work starts from one Linear issue in the IRM team. Run it with the `next-step` skill (`.claude/skills/next-step/SKILL.md`), which keeps the issue's plan in `docs/plans/` on the branch.
- Run `make check` before you open a PR. The git hooks run it too once `make setup` (or the SessionStart hook) has pointed git at `.githooks/`.
- Open the PR, then turn on auto-merge. The merge queue retests and merges it.
- When a decision is the owner's to make (wording users read, a new vendor, a product call, an issue that reads two ways), comment the question on the Linear issue and move it to Needs input, then pick up other work.

## Agent skills

Issues live in Linear, team IRM, with type labels `feature`, `bug`, `ui`, `chore` and `docs`. See `docs/agents/issue-tracker.md`. Scheduled routines and their prompts are in `docs/agents/routines.md`.

## Rules

- The PR title is a conventional commit, `type(scope): summary`, because it becomes the squash commit's subject. [enforced: guard:pr-title]
- The PR description has a `## First principles` section answering why the problem happened, what could be removed instead and which alternative was rejected, plus a `## Not live yet` section ("Nothing" when nothing is). [enforced: guard:pr-sections]
- The PR description closes exactly one Linear issue, as `Closes IRM-12`. [enforced: guard:pr-issue]
- Every commit in a PR is authored by `Claude <noreply@anthropic.com>`; the squash commit on `main` carries Claude as co-author. [enforced: guard:commit-identity]
- Every path outside `src/`, `e2e/`, `migrations/` and `docs/plans/` is protected, and so is any dotfile, package manifest, `*.config.*` file, tsconfig, makefile or `CLAUDE*.md` inside them, and the migration provider; a renamed file counts under its old name. A change to one needs an issue that carried the `ci-change` label when it reached Ready. [enforced: path:.github/scripts/protected-paths.sh]
- Changes reach `main` only through a PR in the merge queue, with `ci` and `policy` green. [enforced: path:rulesets/main.json]
- Every rule in this file names an existing check, and this file stays under 4000 characters. [enforced: guard:docs]
- Skills copied from other repositories match the commit pinned in `.claude/skills.lock.json`. [enforced: path:.github/scripts/skills.sh]
- A PR that adds or changes a file in `migrations/` also changes a test that exercises it against the real database. [enforced: guard:pr-migration-test]
- Routes and server code use TanStack Start (`createServerFn` from `@tanstack/react-start`, routes in `src/routes/`), and server code reads environment variables inside the function that needs them. [enforced: guard:stack]
- No secret is committed, and workflows pass zizmor's security audit; a deliberate exception carries a `zizmor: ignore[...]` comment with the reason. [enforced: make:check-repo]
- Server-only code lives in `*.server.ts` files that only `src/server/` imports; routes and components reach the server through `*.functions.ts` files of `createServerFn` wrappers. [enforced: guard:layers]
- Types are inferred, never cast, and a lint or type-check suppression names its rule and gives the reason. [enforced: make:check-app]
