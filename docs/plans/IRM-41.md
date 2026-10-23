# IRM-41: Lint: ESLint 10, disable comments need a reason, TanStack router rules, make fix

Lint gaps from the plan (2.1, 2.6): ESLint 10, eslint-comments' require-description so every disable comment gives its reason, TanStack's router lint plugin, and a make fix target that applies prettier and ESLint's automatic fixes.

Acceptance criteria:
- ESLint is on 10, and make check passes.
- An eslint-disable comment without a description fails lint.
- @tanstack/eslint-plugin-router's recommended rules run on src/.
- make fix formats and applies lint fixes.

## Progress

- ESLint 10.13.0 with typescript-eslint 8.72, @eslint-community/eslint-plugin-eslint-comments 4.8.1 (`recommended` plus `require-description`) and @tanstack/eslint-plugin-router 1.162.0 (`flat/recommended`: `create-route-property-order`, `route-param-names`).
- A scratch `// eslint-disable-next-line no-console` failed with require-description; the existing code lints clean.
- `make fix` runs `prettier --write .` and `eslint --fix .`, and left the tree unchanged. `CLAUDE.md` gains the rule on casts and suppressions. `make check` passes.

## Decisions

- TanStack's Query lint plugin waits until the app uses TanStack Query or DB.

## Next step

Open the PR with auto-merge on.
