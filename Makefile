REPO ?= irma-AI/Assistant

.PHONY: check check-staged check-push setup github

# Everything CI runs.
check:
	.github/scripts/ci-change.test.sh
	guards/run.sh --self-test
	jq empty rulesets/*.json

# git hooks. shortcut: both run all of check while it takes about a second; split by stage once it doesn't.
check-staged: check
check-push: check

# Points git at the repository's hooks. Cloud sessions do this in the SessionStart hook.
setup:
	git config core.hooksPath .githooks

# Applies the repository settings, the checks environment and the rulesets (admin only).
github:
	.github/scripts/apply-github.sh $(REPO)
