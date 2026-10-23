# IRM-64: shortcut: comments: a format check and a paydown routine

Ponytail is always on and tells agents to mark deliberate shortcuts as `shortcut: <the limit>, <when to upgrade>`, and nothing checks them. In the old repository they went from 2 to 42 in nine days with about 5 paid down. A check that fails when the count grows would, from zero, block the first honest shortcut and teach agents to leave the comment out, so this checks the form and makes paydown someone's job instead.

Acceptance criteria:
- A check in `make check-repo` fails on a `shortcut:` comment in `src/`, `e2e/`, `scripts/` or `migrations/` that doesn't read `shortcut: <the limit>, <when to upgrade>`, and its test has a passing and a failing case.
- The monthly ponytail audit routine files one Backlog issue to pay down the oldest five shortcuts once there are more than 10, unless such an issue is open.
- guardrails section 5's shortcut row moves into the plan with what it now does.

## Progress

- `guards/shortcuts.sh` fails a `shortcut:` comment in `src/`, `e2e/`, `scripts/` or `migrations/` that doesn't read `shortcut: <the limit>, <when to upgrade>` (git-tracked files only, so generated and vendored files outside those folders don't count). It runs in `make check-repo` with `guards/shortcuts.test.sh` (ten cases, passing and failing). The repository has 0 today.
- The ponytail audit routine's prompt files one paydown issue for the oldest five past 10 shortcuts, unless one is open.
- guardrails: the shortcut row leaves section 5 for 2.26 Size limits, with the check, the routine and why the count isn't capped.

- Skeptic lens (guards): no P0 or P1. Fixed P2s: a comma inside the limit ("1,000 rows") or two spaces after the comma failed a well-formed comment; UI text such as `title="Keyboard shortcut: Ctrl+K"` failed, so only comments (`//`, `#`, `--`, `/*`) count now, matched case-insensitively; outside a git repository the guard passed silently, and now fails. Left: a comment wrapped across two lines fails, and `shortcut: x, ,`-style filler passes; the routine counts what `ponytail-debt` reports, which may cover more than the four folders.

- The pre-commit hook caught a real bug in the test: git exports `GIT_INDEX_FILE` to hooks, so the test's throwaway repositories wrote into the branch's own index. The test now unsets git's hook variables first; a commit through the hook leaves the index as staged.

## Decisions

- Form, not count: from zero, a growth check blocks the first honest shortcut and rewards leaving the comment out; the audit asked for a report with a paydown owner.

## Next step

Skeptic pass, then open the PR.
