# IRM-91: Add a demo organisation and demo login for store reviewers

Copied from Linear IRM-91 (the description and the 2026-10-25 audit comment are long; see the issue).

## Progress

- Built: `demo.server.ts` (login, ensure/recreate from snapshot, password deletion, per-IP throttle), `demo-password.server.ts` (Argon2id via node:crypto), `argon2.d.ts` (types missing in @types/node 22), snapshot + `seeds/demo*.ts`, `refuseDemo`, demo org-create refusal, `/app/login/demo` screen and link, `docs/demo-account.md`, records.md §1.
- Proof: `pnpm exec vitest run` (95 passed incl. `demo.server.test.ts`), tsc and eslint clean.

## Decisions

- Throttle is in-memory per process (one instance); marked `shortcut:`.
- Demo deletion removes demo user, members and organisation in one transaction (audit comment).
- Audit log (IRM-109) exists: `demo_created` and `login_success`/`login_failure` with kind demo.
- Not built: invite refusal wiring (no invite route until IRM-125), app screen for demo deletion.

## Next step

Open PR; watch CI.
