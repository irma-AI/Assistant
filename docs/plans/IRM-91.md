# IRM-91: Add a demo organisation and demo login for store reviewers

See the Linear issue (description plus the 2026-10-25 correction comment, which overrides it: demo deletion removes the demo user and organisation together, and demo sessions can't create organisations).

## Progress
- `src/server/demo.server.ts`: fixed IDs, Argon2id check (`node:crypto`), throttle from audit events, `ensureDemo`, `demoLogin`, `demoDelete`, `refuseDemo`. Routes `auth/demo` and `auth/demo/delete`.
- Snapshot `src/server/demo-snapshot.json` from `seeds/demo.ts`; `@types/node` bumped to 24 for `argon2` types.
- `authenticateSession` returns the kind; org creation refuses demo; `addMember` refuses the demo user.
- UI: "Demokonto" link and `/app/login/demo`; password delete form on `/app/radera-konto`.
- Docs: `docs/demo-account.md`, `docs/privacy/records.md`.
- Proof: `pnpm exec vitest run src/server/demo` (9 tests, one per criterion).

## Decisions
- Throttle counts `login_failure` audit events with kind `demo` per truncated IP, so no migration.
- Audit: demo login is `login_success` with kind `demo`; re-creation is `demo_recreated`.
- Class of bug: demo safety lives in one `refuseDemo` check that later features must call.

## Next step
Open the PR.
