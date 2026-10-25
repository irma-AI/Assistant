# Bookkeeping foundations

Decided in IRM-133 (2026-10-25). Every item is one-way once books hold data, so IRM-151's first bookkeeping migration implements them all. The principle: the law is enforced by PostgreSQL triggers and constraints, not by convention. A code path that hits a trigger is wrong, not the trigger. Each invariant gets a Vitest test against real PostgreSQL.

## Already in the repository

- Role `assistant_app` (no ownership, no BYPASSRLS), `current_organisation_id()` and `inOrganisation` (`src/server/tenant.server.ts`).
- `src/server/bypass.test.ts` fails if a migration or source file disables triggers or sets `session_replication_role`.

## Tenant isolation

- Every tenant table has `organisation_id`, composite foreign keys that carry it, `ENABLE` and `FORCE ROW LEVEL SECURITY`, and the policy `organisation_id = current_organisation_id()` (with check). Grant it to `assistant_app` table by table.
- The app connects as `assistant_app`; migrations keep the owner login. Deployment (Dokploy, a `ci-change` step) gives the role `LOGIN` and a password from a second secret.
- Each request runs through `inOrganisation`. No setting means no rows.
- Foreign-key and unique checks bypass RLS, which is why the composite keys stay.

## Entries and corrections

- Autosave covers drafts and settings. Booking is an explicit "Bokför". Unbooked drafts only get reminders (IRM-156), never automatic booking.
- Posted entries and their lines reject `UPDATE` and `DELETE`; the one allowed change is `posted` to `reversed`, made by a storno.
- Corrections are storno only (BFNAR 2013:2 point 2.17): a new entry in the period where the error was found, linked from the original, with who and when.
- Each entry stores its author's name as written and `users.id` with `ON DELETE RESTRICT`. Working assumption: a name is enough for "vem" (open question for the lawyer, IRM-54).
- Balanced: a `DEFERRABLE INITIALLY DEFERRED` constraint trigger checks debit equals credit and both are above zero when the entry is posted.
- A line has `debit >= 0`, `credit >= 0` and exactly one side above zero.
- Amounts are `bigint` öre in SEK; foreign amounts sit beside them with their rate.
- Account numbers are text with a required foreign key to the organisation's chart of accounts. No `ON DELETE SET NULL`.

## Voucher numbers

One series per fiscal year. One database function assigns the number at posting by locking and incrementing the series row in the posting's transaction, never a sequence, so a rollback rolls the number back (BFNAR 2013:2 point 5.9). The app never sets it. A check proves no gaps.

## Periods, retention and documents

- Triggers reject writes dated inside a locked or closed period or before the organisation's lock date, for entries and their documents.
- The period stores its retention date: 31 December of the seventh year after the calendar year in which the fiscal year ended (BFL 7 kap. 2 §). A trigger blocks deleting entries or their documents before it and writes the block to the audit log.
- Once an entry is posted, its documents' metadata and content are immutable. Store a content hash.

## Processing history (BFL 5 kap. 11 §)

It is räkenskapsinformation (BFN comment to 9.16): kept per organisation like the records, append-only. Each entry stores its registration time and the app version; changes to the chart of accounts and VAT codes are logged per organisation; releases that change posting rules are listed with dates.

## No bypass

No session setting switches a ledger trigger off. `bypass.test.ts` guards this in migrations and source.

## Later issues

- Credit note not above its invoice, opening balances locked, a sent invoice's document undeletable: IRM-145. A booked bank transaction cannot be re-linked: IRM-142.
- Closing a sole-member organisation (export, read-only, purge after the BFL period): with IRM-92.
- Personnummer beyond login: the "hash only" claim in IRM-113 covers login only; assess the rest under dataskyddslagen 3 kap. 10 §.
- Add `key_version` per row at the first HMAC key rotation, and never drop a key while rows use it.
