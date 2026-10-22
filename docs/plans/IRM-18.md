# IRM-18: Secret and workflow scans: gitleaks and zizmor

Secret and workflow scans (plan 2.12, 2.14): gitleaks scans the staged changes at pre-commit and every commit in make check and ci, and zizmor audits the workflows for security problems in make check, both pinned through mise.

Acceptance criteria:
- A staged secret fails pre-commit, and gitleaks over the full history passes in make check and ci.
- zizmor reports no findings on .github/workflows, with the deliberate pull_request_target in policy.yml ignored inline with its reason.
- gitleaks and zizmor are pinned in mise.toml.

## Progress

- `make check-repo` runs `zizmor --offline` and `gitleaks git`; `make check-staged` adds `gitleaks git --pre-commit --staged`. ci checks out the full history so gitleaks sees the PR's commits.
- A staged file with a fake AWS key and GitHub token failed `make check-staged`; the clean tree passed. zizmor's one finding was the intended `pull_request_target`, now ignored inline. `make check` passes.

## Decisions

- zizmor runs offline, so the check doesn't depend on GitHub's API; the online audits can follow if needed.

## Next step

Open the PR with auto-merge on.
