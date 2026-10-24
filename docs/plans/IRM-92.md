# IRM-92: Let users delete their account in the app

Copied from Linear IRM-92 (description is long; see the issue for the full text and acceptance criteria).

## Progress

- Claimed the issue, read the code. Nothing implemented.

## Decisions

None yet.

## Next step

Waiting on the owner (issue is in Needs input). Questions:
1. No DESIGN.md or PRODUCT.md exists, so the look of "Radera mitt konto" is the owner's call.
2. The issue needs a fresh BankID login, but no login route exists yet (only /api/v1/me and /logout), so Playwright cannot log in against the fake BankID.
3. No organisation or admin model exists, so the last-admin refusal has nothing to read. Options: a minimal `memberships` table in this issue, or move that refusal and its test to the first issue that adds organisations.
