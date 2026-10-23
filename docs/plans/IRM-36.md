# IRM-36: Migrations run on deploy, inside the release image

Migrations run on deploy (plan 2.7, 2.13): the release image applies pending migrations from migrations/ to DATABASE_URL before it starts serving, so a deploy that needs a schema change brings it, and a failed migration keeps the container from becoming healthy, which the deploy job rolls back.

Acceptance criteria:
- The image runs scripts/migrate.ts before the server, and exits non-zero when a migration fails.
- ci's image check starts the image against a PostgreSQL service, so migrations are proven inside the image before merge.
- After the deploy, production's database has the migrations applied.

## Progress

- The Dockerfile gains a `prod-deps` stage (`pnpm install --prod`), and the runtime stage copies `migrations/`, `scripts/migrate.ts` and `src/server/migrate.server.ts`; its command runs `node scripts/migrate.ts && exec node .output/server/index.mjs`, with Node 24's built-in type stripping.
- `image-check.sh` now needs `DATABASE_URL` and runs the container on the host network against it; ci's `image` job gets the same PostgreSQL service as `checks`.
- A local Docker build isn't possible here (base image pulls stall), so ci's image job is the first run.

- After merge: the deploy of 14e2839 served the new commit, which the image only does after `node scripts/migrate.ts` succeeds against production's DATABASE_URL.

## Decisions

- Migrations run in the container rather than from CI, because the database is only reachable inside Dokploy's network.
- With Swarm's start-first update, the new container migrates while the old one still serves, so migrations must stay compatible with the previous release (add first, remove in a later release).

## Next step

Open the PR; after merge, confirm `kysely_migration` in production through the deploy log, then flip the last criterion.
