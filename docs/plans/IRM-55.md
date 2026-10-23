# IRM-55: Review protected-path PRs with Opus, the rest with Sonnet

Opus for the riskiest reviews (owner decision, 2026-10-23; the CI token is on Pro): policy's AI review runs on Opus 5.5 when the PR touches a protected path, and on Sonnet 5.5 otherwise, both named explicitly so a change in Claude Code's default can't move them.

Acceptance criteria:
- A PR that touches a protected path is reviewed with claude-opus-5-5, and any other PR with claude-sonnet-5-5.
- The choice uses the same protected-path rule as policy's check, with no network call.
- guardrails 2.11 says which model reviews what, and why.

## Progress

- `policy.yml` gets a "Pick the review model" step after the file list is collected: Sonnet 5.5 only when `review/files.txt` is non-empty and `protected-paths.sh` with an empty MESSAGE exits 0 (no protected path, offline); Opus 5.5 otherwise. The review gets `--model` in `claude_args`. Locally, `src/routes/index.tsx` picked Sonnet and `Makefile` picked Opus.
- Skeptic pass on 6f0c482, two lenses, no counterexamples: any script error, odd file name or protected path picks Opus; the value is one of two literals, so nothing from the PR reaches `claude_args`; both IDs are valid, Opus is available on Pro, and `--model` is honoured by the pinned action. The one fail-open edge, a missing file list picking Sonnet, is closed with the `-s` check.
- guardrails 2.11 says which model reviews what, and why.

- After merge: PRs 42 and 43, both touching protected paths, were reviewed with claude-opus-5-5 ("review model: claude-opus-5-5" in their policy runs). The first criterion stays false until a PR without a protected path shows Sonnet.

## Decisions

- Sonnet still reviews `src/server/` and `migrations/`; widening Opus to those is the next step if the usage windows allow it.
- The first criterion is shown on the first protected-path PR after this one, since policy runs from the default branch.

## Next step

Open the PR with auto-merge on.
