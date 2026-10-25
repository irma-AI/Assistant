# IRM-92: Let users delete their account in the app

Copied from Linear IRM-92 (description is long; see the issue for the full text and acceptance criteria).

## Progress

- Merged main (IRM-110's login is in). Built per the owner's answers and the source-check comment: migration 0004 (`login_attempts.purpose`, `deleted_users`), `purpose: 'delete'` in the BankID start/complete flow (deletes the user the fresh BankID identifies; sessions cascade; cookie cleared), `/app/radera-konto` screen (also the public web path), link in `/app`, fake BankID returns the same person for the same IP, rule written into `docs/privacy/records.md`.
- Proof: `make check` passed (Vitest against PostgreSQL incl. deletion tests; Playwright `deletes the account after a fresh BankID confirmation`).

## Decisions

- Hard-delete the `users` row (no tombstone): nothing references it yet. The bookkeeping feature must keep ID and name (rule in records.md).
- The identity that confirms is the account that is deleted, so no separate pnr-match check against a session.
- IRM-109's audit log does not exist: noted in the PR and commented on IRM-109.
- Not built: the demo-account password confirmation (IRM-91 does not exist yet), the last-Ägare guided step (IRM-111).

## Next step

Open the PR, watch CI.
