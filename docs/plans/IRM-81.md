# IRM-81: Release checks use redo.petterannerwall.se

The app now serves at https://redo.petterannerwall.se. A HostUp A record points it at 207.2.120.210, and a Dokploy domain with a Let's Encrypt certificate serves it. The release workflow still deploys to and checks the temporary sslip.io address, so its checks should use the new domain.

Acceptance criteria:
- `.github/workflows/release.yml` uses `https://redo.petterannerwall.se` for `APP_URL` (deploy and rollback) and `PLAYWRIGHT_BASE_URL` (smoke), and the sslip.io address appears nowhere else in the workflow.
- After the merge, the release workflow's deploy and smoke jobs pass against https://redo.petterannerwall.se.

## Progress

- Outside the repo: HostUp A record `redo.petterannerwall.se → 207.2.120.210` (record `drr_06gpvkw792kqd2n9ntrzx6kpr0`) and Dokploy domain `YDLBrbaQkUNu7AJXK8cYY` on application `QBnL1Yn7fZ0Ficd4cbI36`. `curl https://redo.petterannerwall.se/version` answered `dcd2b6a…` with a valid certificate, and the home page serves `<h1>Assistant</h1>`.
- `release.yml`: the three sslip.io URLs now point at redo. `grep -rn sslip` outside `docs/plans` finds nothing.

## Decisions

- The sslip.io domain stays on the Dokploy app until a release passes on redo, so production keeps an address that already works during the switch.
- This session's work is on branch `claude/eloquent-hawking-qjesri` instead of `irm-81-...`. The issue was opened directly in In Progress, so no cloud session picks it up.

## Next step

After the merge, check that the release run is green against redo, then remove the sslip.io domain in Dokploy.
