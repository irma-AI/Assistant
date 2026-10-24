# Package /app as iOS and Android apps with Capacitor 8

Full description and acceptance criteria: Linear IRM-84.

## Progress

- Claimed the issue, wrote the plan.
- `pnpm cap:sync` builds, copies `.output/public` to `.output/native` with `app/index.html` as root `index.html` (no `<h1>`) and syncs both projects: criteria 1 and 2.
- `pnpm exec vitest run src/platform` passes both branches of the base URL: criteria 3 and 6. `guards/layers.sh` covers criterion 4.
- `grep` of `ios/` and `android/` shows deployment target 16.0, minSdkVersion 28, `se.example.redo`: criterion 5.

## Decisions

- Developing on `irm-84-capacitor-apps`.

## Next step

Run make check, open the PR, enable auto-merge.
