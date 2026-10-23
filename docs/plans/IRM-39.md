# IRM-39: Close a PR after three failed fix rounds

Stop after three fix rounds (plan 2.11): when policy has failed on the first attempt and three fix rounds of a PR (four commits), a job closes the PR with a comment, and comments the reason on the Linear issue and moves it to Needs input.

Acceptance criteria:
- A PR whose policy check failed on four of its commits is closed with a comment giving the reason.
- The Linear issue the PR closes gets a comment with the run link and moves to Needs input.
- A PR with fewer failed commits is left alone.

## Progress

- `.github/scripts/fix-rounds.sh` counts the PR's commits whose `policy` check run failed; at four it comments on and closes the PR, then comments on the Linear issue and moves it to Needs input.
- A `fix-rounds` job in `policy.yml` runs it from the default branch's checkout when `policy` fails on a PR, in the `checks` environment, with `pull-requests: write` and `checks: read` only. zizmor passes.
- A dry run on PR 7 counted 1 failed commit and left it alone; the Linear lookup for the Needs input state was tested against IRM-38.

- After merge: a throwaway PR (#35, IRM-46) whose title broke pr-title was pushed four times; after the fourth failure `fix-rounds` closed it with the reason, commented on IRM-46 with the run link and moved it to Needs input.

## Decisions

- Rounds are counted per commit, so re-runs of `policy` after an edited description don't count as rounds.
- The job is separate from `policy`, so the job holding the AI review never gets write access to PRs.

## Next step

Open the PR with auto-merge on.
