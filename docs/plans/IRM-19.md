# IRM-19: Architecture layers with dependency-cruiser

Architecture layers (plan 2.10): a dependency-cruiser config that lets only src/server/ (plus scripts and tests) import *.server.ts, makes routes and components reach src/server/ only through *.functions.ts, and forbids circular imports, run by a guard that first proves the rules catch a violation.

Acceptance criteria:
- A component or route importing *.server.ts fails the layers guard.
- Circular imports fail, except the generated route tree's type-only import of the router.
- The guard runs in make check, and .dependency-cruiser.cjs is a protected path.

## Progress

- `.dependency-cruiser.cjs` with three rules; a scratch route and component importing `*.server.ts` each failed both layer rules, and the real code passed (22 modules).
- `guards/layers.sh` writes a violating fixture, fails unless the rules catch it, removes it, then checks the code; it runs in `make check`, which passes.

## Decisions

- Type-only cycles are allowed, because the generated route tree imports the router's type back and the import is erased at build time.

## Next step

Open the PR with auto-merge on.
