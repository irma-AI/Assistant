# IRM-88: Add a BankID client with fake, test and production modes

See the Linear issue for the full description and acceptance criteria.

## Progress

- Claimed. The owner pasted BankID's published QR example in a Linear comment (read 2026-10-24 from developers.bankid.com), so the QR test uses those values.
- Wrote `src/server/auth/bankid.server.ts` (auth, collect, cancel, QR data, mode check), `bankid-fake.server.ts` and `bankid.server.test.ts`; `startup.server.ts` calls `checkBankidConfig()`.
- Proof: `pnpm exec vitest run src/server/auth` passes all 7 tests (QR t=0,1,2; fake pending then complete; pending then userCancel; cancel; unset mode is fake and warns; production with `BANKID_FAKE_PORT` throws).
- `make check` run before the PR.

## Decisions

- A "fake setting" is any env var starting `BANKID_FAKE`; `BANKID_FAKE_PORT` picks the fake's port (default: a free one).
- The fake fails an order with `userCancel` when `endUserIp` is 192.0.2.1 (TEST-NET-1); it never lets the caller choose the identity.
- Test and production read `BANKID_P12_BASE64`, `BANKID_P12_PASSPHRASE` and `BANKID_ROOT_CA_PEM` inside the request function; the root CA PEM is a secret too, because it could not be fetched and verified here.
- The fake builds people from small name lists and a Luhn-valid number instead of Faker, which is a dev dependency the deployed container may lack.

## Next step

PR open; watch it until it merges.
