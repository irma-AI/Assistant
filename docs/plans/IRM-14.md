# IRM-14: App foundation: TanStack Start with strict types and lint

App foundation, first slice (plan §8 step 8, 2.6, 2.26): a blank TanStack Start (React) app built by Nitro, with Node and pnpm pinned by mise, strict TypeScript, typescript-eslint strict-type-checked with no type assertions and size limits, and a /version route for the deploy check. make check and ci run format, type check, lint and build.

Acceptance criteria:
- mise.toml pins Node 24 and pnpm; ci installs them with mise and dependencies from the lockfile only.
- make check runs prettier, tsc --noEmit, eslint and the production build, and passes.
- GET /version returns {"version": APP_VERSION or "dev"}.
- The TypeScript, ESLint, Vite and pnpm configuration are protected paths.

## Progress

- Scaffolded with `@tanstack/cli create --blank --deployment nitro --toolchain eslint`; removed the editor and template files.
- Added typescript-eslint strict-type-checked, no type assertions, ts-expect-error only with a description, unused disable directives as errors, and max-lines, max-lines-per-function and complexity limits. A cast and a ts-ignore in a scratch file both failed lint.
- `make check` passes in about 6 s. A production build served `{"version":"abc1234"}` on /version with APP_VERSION=abc1234, and / returned 200.

## Decisions

- pnpm 12 refuses unapproved build scripts, so `pnpm-workspace.yaml` lists them; it is a protected path because it decides which dependency code runs at install.
- Prettier checks the app's files only; Markdown and the CI and guard files keep their own style.
- Database, tests, layers and live updates come in later issues of step 8.

## Next step

Open the PR with auto-merge on.
