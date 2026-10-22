REPO ?= irma-AI/Assistant

.PHONY: check check-repo check-app check-staged check-push install dev image-check setup skills github

# Everything CI runs.
check: check-repo check-app

# Guards, skills and repository rules.
check-repo:
	.github/scripts/ci-change.test.sh
	guards/run.sh --self-test
	guards/docs.test.sh
	guards/docs.sh
	guards/stack.sh
	zizmor --offline --no-progress .github/workflows
	gitleaks git --redact --no-banner
	.github/scripts/skills.sh check
	jq empty rulesets/*.json

# The app: generated files and the production build, format, type check, lint with size limits, tests.
# Needs DATABASE_URL pointing at a PostgreSQL 16 database the checks may migrate.
check-app: generate-check
	pnpm exec prettier --check .
	pnpm exec tsc --noEmit
	pnpm exec eslint .
	guards/layers.sh
	pnpm exec vitest run

test:
	pnpm exec vitest run

migrate:
	node scripts/migrate.ts

GENERATED = src/server/db.gen.ts src/routeTree.gen.ts

# Rebuilds every generated file: the database types from the migrated schema, and the route tree,
# which only the production build writes with TanStack Start's types.
generate: migrate
	pnpm exec kysely-codegen --dialect postgres --url "$$DATABASE_URL" --out-file src/server/db.gen.ts --exclude-pattern 'kysely_migration*'
	pnpm build

generate-check: generate
	@{ git diff --name-only -- $(GENERATED); git ls-files --others --exclude-standard -- $(GENERATED); } | grep . && { echo "::error::Generated files are out of date. Fix: make generate, then commit them."; exit 1; } || echo "generated files up to date"

# The pinned Node and pnpm, then the dependencies from the lockfile only.
install:
	mise install
	pnpm install --frozen-lockfile

# The release image builds and serves VERSION on /version (needs Docker).
image-check:
	.github/scripts/image-check.sh $(VERSION)

# The app on http://localhost:3000.
dev:
	pnpm dev

# git hooks. shortcut: pre-commit runs the repository checks and pre-push everything; lint only staged files once check-app outgrows 10 s.
check-staged: check-repo
	gitleaks git --pre-commit --staged --redact --no-banner
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
