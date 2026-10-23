# IRM-44: Smoke-test production with Playwright after each deploy

Smoke test production after each deploy (plan 2.13): the Playwright suite runs against the deployed app in Playwright's image; if it fails, the previous image is pinned again and a deploy-failure issue opens. The release waits for the smoke test.

Acceptance criteria:
- After the deploy job, a smoke job runs e2e/ against the production URL, expecting /version to show the deployed commit.
- A failed smoke test pins the previous image again and opens a deploy-failure issue that says so.
- The release job runs only after the smoke test passes.

## Progress

- `playwright.config.ts` runs against `PLAYWRIGHT_BASE_URL` with no local server when it is set; the /version test expects `APP_VERSION` (or e2e locally). Locally 4 tests pass; against production with its real version (b7e0a19) 4 passed.
- `release.yml`: `deploy` outputs the previous image; `smoke` runs the suite in Playwright's image against production; `rollback` (after a failed smoke) runs `deploy.sh rollback` and opens the issue; `release` needs `smoke`. The issue creation moved to `.github/scripts/deploy-issue.sh`, shared by both jobs. zizmor passes.

- After merge: the release run on c4e3183 and every one since ran the smoke suite against production and passed. A failed smoke test, and so the rollback after it, hasn't happened yet.

## Decisions

- The rollback is its own job, because the smoke job runs in Playwright's image without the deploy key.

## Next step

Open the PR; the first smoke run happens on this PR's merge.
