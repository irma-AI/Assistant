REPO ?= irma-AI/Assistant

.PHONY: check github

# Everything CI runs.
check:
	.github/scripts/ci-change.test.sh
	guards/run.sh --self-test
	jq empty rulesets/*.json

# Applies the repository settings, the checks environment and the rulesets (admin only).
github:
	.github/scripts/apply-github.sh $(REPO)
