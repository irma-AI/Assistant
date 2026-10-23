# IRM-20: GitHub secret scanning with push protection, as code

GitHub secret scanning with push protection (plan 2.14), as code: make github turns both on, alongside the other repository settings.

Acceptance criteria:
- apply-github.sh enables secret_scanning and secret_scanning_push_protection.
- After make github, the repository's security_and_analysis shows both enabled.

## Progress

- `.github/scripts/apply-github.sh` now enables both settings. Both read `disabled` on 2026-10-22.

- After merge: after `make github` on 2026-10-23, `security_and_analysis` shows secret scanning and push protection enabled.

## Decisions

- Applying it changes repository settings, so the owner approves running `make github` after merge.

## Next step

Open the PR; run `make github` once the owner approves, then flip the second criterion.
