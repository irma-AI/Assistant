# IRM-43: Pre-commit lints the staged files

Pre-commit lints the staged files (plan section 4, stage 1): make check-staged adds prettier and ESLint on the staged files only, next to the repository checks and the staged secret scan, so a commit gets format and lint feedback in seconds.

Acceptance criteria:
- A staged file that prettier or ESLint rejects fails the commit.
- Only staged files are linted, and a commit with no TypeScript files skips ESLint.

## Progress

- `make check-staged` runs prettier on the staged files (unknown types skipped) and ESLint on the staged .ts, .tsx and .js files (ignored ones skipped), after the repository checks and the staged secret scan.
- A staged badly formatted file failed it, a staged type assertion failed it on consistent-type-assertions, and a clean tree passed.

## Decisions

- Pre-push still runs all of `make check`, so type errors across files are caught before the push.

## Next step

Open the PR with auto-merge on.
