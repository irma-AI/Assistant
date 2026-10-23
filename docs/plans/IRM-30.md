# IRM-30: Fast CI: parallel jobs, browser tests in Playwright's image

Fast CI (plan 2.12): ci runs as parallel jobs (repository and app checks with PostgreSQL, browser tests inside Playwright's own image, and the release image check) and ends in an always-run job named ci that passes only if every other job did. No job installs system packages with apt.

Acceptance criteria:
- The browser tests run in the pinned mcr.microsoft.com/playwright image, with no apt step.
- The required ci check passes only when checks, e2e and image all succeeded.
- A typical PR's ci finishes in under 3 minutes.

## Progress

- `ci.yml` now has `checks` (`make check-repo check-app` with PostgreSQL), `e2e` (`make e2e` in mcr.microsoft.com/playwright:v1.64.1-noble, pinned by digest, with only node and pnpm from mise) and `image` (`make image-check`), in parallel, then `ci`, which needs all three, always runs and fails unless all succeeded.
- `make check` still runs everything locally (8.5 s here); `check-app` no longer includes the browser tests, and `make e2e` builds first.
- Two runs stalled for over 6 minutes in `playwright install --with-deps` on apt, while the other runs took about 1.5 minutes.

## Decisions

- The required check keeps its name `ci`, so the ruleset doesn't change.
- `e2e` installs only node and pnpm from mise, not every repository tool.

## Next step

Open the PR; check the three jobs' times on its own run, then flip the last criterion.
