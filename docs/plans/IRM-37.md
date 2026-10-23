# IRM-37: Copy TanStack's own skills from the installed packages

TanStack's own skills (plan §3, 2.6, 2.10): copy the skills for TanStack Start and Router that ship inside the installed npm packages into .claude/skills as tanstack-<skill>, with links between copied skills rewritten, and fail make check when a copy differs from the installed version.

Acceptance criteria:
- make skills copies the allowlisted TanStack skills from node_modules, renamed tanstack-<skill>.
- make check fails when a copied TanStack skill differs from what the installed package would give.
- The skills lock lists them with source "tanstack".

## Progress

- `scripts/tanstack-skills.ts` copies 16 allowlisted skills from @tanstack/react-start, react-router, router-core, start-client-core and start-server-core (resolved through the direct dependencies), renames each to `tanstack-<skill>`, rewrites links between copied skills and marks the rest "not copied here".
- `--check` renders into a temp folder and compares; it passed on the fresh copy and failed with the fix after a copied SKILL.md was edited. It runs in `make check-app`; `make skills` writes the copies.
- The lock lists them with `"source": "tanstack"`, which `skills.sh` skips because the script checks them; their licence is in `.claude/vendor-licenses/TanStack__router.LICENSE`.

## Decisions

- Migration guides, code splitting, deployment, server components and the TanStack Query composition are left out, since nothing here uses them.

## Next step

Open the PR with auto-merge on.
