# IRM-67: Synthetic-data check: multi-line people tables, bare name columns

Close the holes the CI review found in the synthetic-data check (IRM-66, PR 51), because the owner wants the generator guaranteed before any table stores people.

- A people table only tripped the check when `create table` and its name sat on one line with single spaces and no quoted schema: `CREATE TABLE\n  candidates (`, `create table  users` and `create table "public"."users"` got past it.
- A bare `name` column never tripped it outside a table on the people list, though the issue counts a name as personal data. A false hit only means building the generator sooner.
- An empty `migrations/` made the script exit without a message, and `' --'` inside a string still hid what followed it.

Acceptance criteria:
- `guards/synthetic-data.sh` matches a people table across line breaks, repeated spaces and a quoted schema, and trips on a bare `name` column.
- An empty `migrations/` passes with a count of 0, and a `--` inside a string literal no longer hides the columns after it.
- `guards/synthetic-data.test.sh` covers each case, and guardrails 2.8 says a bare `name` counts.

## Progress

- `guards/synthetic-data.sh` reads each migration flattened: string literals, `--` and `/* */` comments and double quotes removed, whitespace collapsed, lower-cased. A people table now trips it across line breaks, repeated spaces and a quoted schema, and a bare `name` column trips it anywhere. An empty `migrations/` passes with "scanned 0".
- `guards/synthetic-data.test.sh`: twenty-five cases, including the review's three table forms, a bare `name`, `' --'` inside a string, `name` only in a comment (passes) and an empty folder.
- guardrails 2.8 says any `name` column counts.

- Skeptic lens on the working tree: P1, an apostrophe in a comment (`-- the talent's contact details`) and `--` inside a block comment hid the table after them, because strings and comments were stripped in two passes; now one pass, whichever starts first wins, with dollar-quoted bodies and E-string escapes. P2, a byte that isn't UTF-8 made grep skip the flattened file as binary; the script now reads bytes (`LC_ALL=C`, `grep -a`). P3s taken: `create unlogged` and `temp` tables, and `respondents`, `talent`, `leads`, a bare `mail`, `vorname`, `nachname`, `voornaam`, `achternaam`. Left: `example.com` anywhere in the generator file satisfies the check, which the protected path keeps honest.

## Decisions

- Any `name` column counts, even a project's: a false hit only means building the generator sooner, which the owner prefers to a person's name slipping through.

## Next step

Open the PR.
