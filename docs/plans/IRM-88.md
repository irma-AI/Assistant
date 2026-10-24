# IRM-88: Add a BankID client with fake, test and production modes

See the Linear issue for the full description and acceptance criteria.

## Progress

- Claimed; no code yet.
- The session's network policy blocks developers.bankid.com (403 on CONNECT), so BankID's published QR example values could not be read.

## Decisions

None yet.

## Next step

Waiting on the owner (Linear comment): the published QR strings at t=0, 1, 2 for the example start token `67df3917-…` and secret `d28db9a7-…`. Then write the QR test first, then `src/server/auth/bankid.server.ts`, the fake server and `BANKID_MODE` handling.
