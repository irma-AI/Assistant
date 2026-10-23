# IRM-56: The review's usage as a PR comment

The review's usage on the PR (owner decision, 2026-10-23): after policy's AI review, one PR comment shows the model, the verdict, the turns, the time, and the tokens and API-equivalent cost per model, updated in place on every review. A separate job posts it, so the job holding the AI review stays read-only.

Acceptance criteria:
- Exactly one usage comment, updated on each later review, showing model, verdict, turns, time, and per-model input, cache-read, output tokens and estimated cost, with the commit and run it describes.
- It is posted by a job of its own with pull-requests: write, and the policy job's permissions are unchanged.
- A failed review still gets its numbers, with the verdict saying so.

## Progress

- `.github/scripts/review-usage.sh` reads the action's execution file (an array of messages, or one result object) and prints one line of JSON: model, verdict, open P0/P1 count, head SHA, turns, duration, and per-model tokens and cost. No session ID or finding text leaves the job.
- `.github/scripts/review-usage-comment.sh` renders the comment behind the marker `<!-- ai-review-usage -->`, and with `--post` patches the github-actions[bot] comment that starts with the marker, or posts one.
- `.github/scripts/review-usage.test.sh` (in `make check-repo`) checks pass, fail with findings, fail without output, thousands separators, small costs, a single result object and a run with no result message.
- `policy.yml`: the Verdict step has an id; "Record the review's usage" runs unless cancelled when the review left an execution file, never fails the job, and writes the `usage` job output; the `review-usage` job (pull-requests: write, contents: read) posts it on `pull_request_target`.
- Skeptic pass on da63f9a, two lenses (correctness, security): no P0 or P1. Fixed the two P2s: overlapping runs could post two comments or put an older commit's numbers over a newer one's, so the job now runs one at a time per PR and posts nothing when the PR's head has moved past the commit it describes; model keys with a date or `[1m]` suffix now render as "Sonnet 5.5". Left: cache-write tokens are not shown (not in the criteria).
- guardrails 2.11 describes the comment and why it is a separate job and not the description.

- After merge: PR 43 got exactly one usage comment (Opus 5.5, passed, 8 turns, 18 s, both models' tokens and estimates, commit 00addea and its run). The first criterion stays false until a later review updates it in place, and the third until a review fails.

## Decisions

- A comment, not a description footer: editing the description fires `edited`, which re-runs policy and its review.
- The estimate is the action's API list price; nothing is charged on the subscription, and the comment says so.

## Next step

Open the PR with auto-merge on. The first and third criteria show on the first PR after this one merges, since policy runs from the default branch.
