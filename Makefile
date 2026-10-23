REPO ?= irma-AI/Assistant

.PHONY: check check-repo check-app check-staged check-push fix e2e install dev image-check setup skills github

# Everything CI runs.
check: check-repo check-app e2e

# Guards, skills and repository rules.
check-repo:
	.github/scripts/ci-change.test.sh
	.github/scripts/protected-paths.test.sh
	.github/scripts/review-usage.test.sh
	guards/run.sh --self-test
	guards/docs.test.sh
	guards/docs.sh
	guards/stack.sh
	bash .claude/hooks/test.sh
	zizmor --offline --no-progress .github/workflows
	gitleaks git --redact --no-banner
	.github/scripts/skills.sh check
	jq empty rulesets/*.json
	guards/synthetic-data.test.sh
	guards/synthetic-data.sh

# The app: generated files and the production build, format, type check, lint with size limits,
# unit and real-database tests.
# Needs DATABASE_URL pointing at a PostgreSQL 16 database the checks may migrate.
check-app: generate-check
	pnpm exec prettier --check .
	pnpm exec tsc --noEmit
	pnpm exec eslint .
	pnpm exec squawk migrations/*.sql
	node scripts/tanstack-skills.ts --check
	guards/layers.sh
	pnpm exec vitest run

test:
	pnpm exec vitest run

# Applies prettier and ESLint's automatic fixes.
fix:
	pnpm exec prettier --write .
	pnpm exec eslint --fix .

# The browser seam against a fresh production build; ci calls the same script in Playwright's
# image, which has no make.
e2e:
	pnpm e2e

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

# The pinned Node and pnpm, the dependencies from the lockfile only, and Playwright's WebKit.
install:
	mise install
	pnpm install --frozen-lockfile
	pnpm exec playwright install webkit

# The release image builds and serves VERSION on /version (needs Docker).
image-check:
	.github/scripts/image-check.sh $(VERSION)

# The app on http://localhost:3000.
dev:
	pnpm dev

# git hooks: pre-commit checks the repository and the staged files only; pre-push runs everything.
STAGED = git diff --cached --name-only --diff-filter=ACMR
check-staged: check-repo
	gitleaks git --pre-commit --staged --redact --no-banner
	@f=$$($(STAGED)); [ -z "$$f" ] || pnpm exec prettier --check --ignore-unknown $$f
	@f=$$($(STAGED) -- '*.ts' '*.tsx' '*.js'); [ -z "$$f" ] || pnpm exec eslint --no-warn-ignored $$f
check-push: check

# Points git at the repository's hooks. Cloud sessions do this in the SessionStart hook.
setup:
	git config core.hooksPath .githooks

# Downloads every pinned skill again from .claude/skills.lock.json, and copies TanStack's from node_modules.
skills:
	.github/scripts/skills.sh vendor
	node scripts/tanstack-skills.ts

# Applies the repository settings, the checks environment and the rulesets (admin only).
github:
	.github/scripts/apply-github.sh $(REPO)
