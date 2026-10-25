# IRM-85: Build the iOS and Android apps in CI

Compile-only CI jobs `android` (Ubuntu, Gradle assembleDebug) and `ios` (macos-26, xcodebuild simulator), both after `scripts/cap-sync.sh`, added to the `ci` gate.

## Progress
- Added both jobs to `.github/workflows/ci.yml`; CI on GitHub is the proof.

## Decisions
- No setup-java action: the runner's preinstalled Java 21 via `JAVA_HOME_21_X64`.

## Next step
Open PR, watch CI.
