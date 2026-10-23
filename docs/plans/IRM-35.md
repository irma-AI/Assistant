# IRM-35: Migration lint with squawk

Migration lint (plan 2.7): squawk checks every migration for statements that lock or rewrite tables, which matters because every merge deploys. It assumes each migration runs in a transaction, as Kysely's migrator runs them, and targets PostgreSQL 16.

Acceptance criteria:
- make check runs squawk on migrations/*.sql.
- A migration that adds a NOT NULL column without a default, or creates an index without CONCURRENTLY on an existing table, fails make check.

## Progress

- squawk-cli 2.70.0 as a dev dependency, `.squawk.toml` with `pg_version = "16.0"` and `assume_in_transaction = true`, and `pnpm exec squawk migrations/*.sql` in `make check-app`.
- `migrations/0001_init.sql` passes. A scratch migration adding a NOT NULL column without a default and a plain `create index` exited 1 with five warnings, including adding-required-field and require-concurrent-index-creation.
- `.squawk.toml` joins the protected paths. `make check` passes.

## Decisions

- An index that must be built CONCURRENTLY gets a migration file of its own, outside the shared transaction; that comes with the first such index.

## Next step

Open the PR with auto-merge on.
