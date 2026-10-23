# IRM-21: Browser seam: Playwright smoke tests on WebKit iPhone profiles

Browser seam (plan 2.8): Playwright tests in e2e/ against the production build, in WebKit with iPhone profiles, run by make check and ci, starting with a smoke test of the home page and /version.

Acceptance criteria:
- make check runs the Playwright tests in WebKit on iPhone 15 and iPhone SE profiles against the production server.
- ci installs WebKit with its system dependencies and runs them.
- CLAUDE.md names the three test seams.

## Progress

- `playwright.config.ts` starts `.output/server/index.mjs` on port 3100 and runs `e2e/` on iPhone 15 and iPhone SE (WebKit). `e2e/smoke.spec.ts` checks the heading on / and the JSON on /version; 4 tests passed in 5.4 s.
- `make check` runs them after Vitest; `make install` installs WebKit; ci adds `playwright install --with-deps webkit`. `make check` passes.

## Decisions

- Retries are off and `forbidOnly` is on, so a flaky or focused test fails instead of passing on a second try.
- The two-browser live-update test waits for the first feature that writes data.

## Next step

Open the PR with auto-merge on.
