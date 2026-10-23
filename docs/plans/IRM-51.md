# IRM-51: Make the documents true

From the guardrails audit at fcad227 (2026-10-23): thirteen claims in `CLAUDE.md` and `docs/guardrails.md` to test against the code, with no new mechanism.

Acceptance criteria:
- Each claim is marked holds, stale or unverifiable in the PR description with its evidence.
- guards/docs.sh passes, and CLAUDE.md stays under 4000 characters.

## Progress

| # | Claim | Mark | Evidence and fix |
|---|---|---|---|
| 1 | "Every commit is authored by Claude" (`CLAUDE.md`, "What this assumes", 2.15) | stale | The last 8 commits on main are squash commits authored by the owner's account with `Co-authored-by: Claude`; `commit-identity` checks PR commits. Reworded to say exactly that. |
| 1 | `Claude-Session:` trailer and session links "stay switched on" (2.15) | stale | No commit, PR, comment or release carries one (searched all of them). Dropped by the owner's decision; 2.15 now says session links stay out, because the repository is public. |
| 1 | Credentials "pinned to the owner's personal account" (2.15) | holds, but local | It lives in `.claude/settings.local.json` and the checkout's git config; now says so. |
| 2 | `make screenshots` (2.8, §3 flow table) | stale | No such target in the `Makefile`. Now "before and after screenshots in the PR", as `next-step` says. |
| 3 | `generate-check` "rebuilds them in a scratch space" (2.9) | stale | `make generate` writes in place and `generate-check` diffs. Reworded; the TanStack skills come from `make skills`, checked by `scripts/tanstack-skills.ts --check` (also fixed in §3). |
| 4 | Targets "never the underlying command" (2.1) | stale | Workflows run `pnpm install`, mise and `gh attestation verify` themselves, and the e2e job and smoke test run `pnpm` because Playwright's image has no make. Exceptions named. |
| 5 | §4 stage table | stale | Generated-file refusal is stage 0 only; `generate-check` and the layer rules run at stage 2, not 1; the migration-test guard runs only in `policy`; pre-push runs all of `make check`. Rows and intro fixed. |
| 6 | Intake "strips hidden characters" (2.20) | stale | Only `next-step` tells the agent to; nothing strips in code. Reworded. |
| 7 | Plugins "turned off in `enabledPlugins`" (§3) | unverifiable | Not in the repository. Now an owner setting on claude.ai. |
| 8 | "A guard ... catches committed secrets" (2.14) | stale | gitleaks is a `make check-repo` step and a pre-commit step, not a guard. Reworded. |
| 9 | The review "fails a PR that adds code outside" the seams (2.8) | stale | The review prompt doesn't say so. Dropped. |
| 10 | `docs/agents/` and the migration provider are protected (2.12) | holds | True since IRM-49's allowlist merged. |
| 11 | Routines, asking from a routine, the weekly sweep, the rollbacks (2.20, 2.22, 2.27, 2.13) | unverifiable | None has run. Marked *not checked*. Archiving (2.25) holds: the first `linear` run archived IRM-8, IRM-7 and IRM-4 (run 39848421572). |
| 12 | `rulesets/main.json` matches the live rule | stale | The live `pull_request` rule carries `require_extra_approval_for_unattributed_changes: true`. Added, so `make github` can't change it. |
| 13 | The deploy check (2.13) | holds, now stated | `deploy.sh` greps `<h1>Assistant</h1>` after `/version`; 2.13 says the heading is part of the deploy contract. |

- Skeptic pass on 34d66e7: the correctness lens found four sentences still wrong (a stage 1 dot on the layer rules, the table intro, 2.9 claiming `generate` makes the TanStack skills, 2.1's "one exception"); all fixed in 6dc3533. The regression lens doubted the ruleset field; the live rule read from GitHub's API carries it.
- `guards/docs.sh` passes; `CLAUDE.md` is 3874 characters.

## Decisions

- Owner, 2026-10-23: drop the `Claude-Session` claim and keep the trailer off, because the repository is public.

## Next step

Open the PR with auto-merge on.
