REPO ?= irma-AI/Assistant

.PHONY: check check-repo check-app check-staged check-push install dev setup skills github

# Everything CI runs.
check: check-repo check-app

# Guards, skills and repository rules.
check-repo:
	.github/scripts/ci-change.test.sh
	guards/run.sh --self-test
	guards/docs.test.sh
	guards/docs.sh
	.github/scripts/skills.sh check
	jq empty rulesets/*.json

# The app: format, type check before the build, lint with size limits, production build.
check-app:
	pnpm exec prettier --check .
	pnpm exec tsc --noEmit
	pnpm exec eslint .
	pnpm build

# The pinned Node and pnpm, then the dependencies from the lockfile only.
install:
	mise install
	pnpm install --frozen-lockfile

# The app on http://localhost:3000.
dev:
	pnpm dev

# git hooks. shortcut: pre-commit runs the repository checks and pre-push everything; lint only staged files once check-app outgrows 10 s.
check-staged: check-repo
check-push: check

# Points git at the repository's hooks. Cloud sessions do this in the SessionStart hook.
setup:
	git config core.hooksPath .githooks

# Downloads every pinned skill again from .claude/skills.lock.json.
skills:
	.github/scripts/skills.sh vendor

# Applies the repository settings, the checks environment and the rulesets (admin only).
github:
	.github/scripts/apply-github.sh $(REPO)
