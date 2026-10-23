# IRM-59: next-step: impeccable's audit, fix and polish steps; intake stop line; proven criteria

Refine `next-step`'s UI steps with impeccable's own workflow, and finish IRM-57's loose ends.

- After `impeccable audit`, fix its P0 and P1 findings with the command it recommends, then run `impeccable polish`, as audit's reference says to end. A recommended command that changes the look or the words (`bolder`, `quieter`, `colorize`, `animate`, `delight`, `overdrive`, `clarify`, `distill`, `onboard`) is a question for the owner.
- The UI steps say that DESIGN.md and impeccable's craft floor set design completeness and ponytail governs code structure only, because routines read the skill by path, where the impeccable-scope hook doesn't fire.
- The intake prompt stops when no issue qualifies, not only when none is Ready (the review's P3 on IRM-57).
- Record what the merged PRs proved: IRM-50's strip step ran on PR 39, so its criterion passes. IRM-55 (Opus seen on PRs 42 and 43, Sonnet not yet) and IRM-56 (one comment on PR 43, no update or failed review yet) stay false, with what is still missing.

- The usage comment's test (IRM-56) fails at random: `grep -q` exits on the first match, the renderer then dies of SIGPIPE, and `pipefail` fails the case. The test reads the whole output instead.

Acceptance criteria:
- `next-step`'s UI steps run audit, the recommended fix commands with the listed exceptions as questions, then polish, and carry the ponytail and impeccable split.
- The intake prompt in `docs/agents/routines.md` stops when no issue qualifies.
- Each criterion of IRM-50, IRM-55 and IRM-56 that a run has proven reads true with that run, and each plan says what the others still need.
- `review-usage.test.sh` passes 30 runs in a row.

## Progress

- `next-step` UI step 2 says DESIGN.md and the craft floor set design completeness and ponytail governs code structure only; step 3 fixes audit's P0 and P1 findings with the command it recommends, asks the owner for the listed look and wording commands, then runs `impeccable polish` (audit's reference ends with polish when it recommended fixes).
- `docs/agents/routines.md`: "If no issue qualifies, stop."
- IRM-50's first criterion passes (PR 39's policy run 39957645408 logged the strip step). IRM-55 and IRM-56 record what PRs 42 and 43 showed and what is still missing.
- guardrails section 3's `ui` row matches.
- `review-usage.test.sh` redirects grep instead of `-q`; 30 runs in a row passed (a `make check-repo` run here had failed `marker first`).

## Decisions

- The ponytail and impeccable split is written into the UI steps as well as the impeccable-scope hook (IRM-58), because routines read `next-step` by path, where the hook on the Skill tool never fires.

## Next step

Run `make check`, then open the PR.
