# IRM-70: Intake dispatcher: fire the Intake routine from GitHub Actions

The dispatcher that replaces the hourly Intake schedule: a workflow that asks Linear whether there is work and only then fires the Intake routine's API trigger, so empty runs cost no session. The companion issue covers intake.md and the docs. Owner decision 2026-10-23.

Change:

* .github/workflows/intake-dispatch.yml: schedule every 10 minutes off the hour (3,13,23,33,43,53), push to main and workflow_dispatch; one workflow-level concurrency group without cancel-in-progress; environment checks, with LINEAR_API_TOKEN, the variable INTAKE_FIRE_URL and the secret INTAKE_FIRE_TOKEN; read-only permissions.
* The logic in a script under .github/scripts/, failing closed on any Linear or GitHub API error:
  1. Count IRM issues in the state named In Progress. Match by name, because Needs input and In Review share its state type (started). At MAX_PARALLEL (1) or more, exit without firing.
  2. Otherwise take the oldest Ready issue with no open PR whose body says Closes <ID>, and no inverse blocks relation whose blocker's state type isn't completed.
  3. The ID must match ^IRM-\d+$. POST once {"text": "<ID>"} with the bearer token, anthropic-version and the pinned header anthropic-beta: experimental-cc-routine-2026-04-01. Never retry, since the endpoint has no idempotency key; a non-2xx response fails the job. Log only the status and the ID: the response holds the session URL, and the repository's Actions logs are public.
* A test of the selection on stored sample responses, run by make check-repo.

Not in scope: resuming an In Progress issue whose session died. It needs next-step to push after every commit first.

Acceptance criteria:

* On sample data the selection fires nothing with nothing Ready, fires the one Ready issue, fires nothing while one is In Progress, and skips a Ready issue that an open PR closes or an unfinished issue blocks; the test runs in make check-repo.
* No step prints the fire response body.
* zizmor and make check pass.

## Progress

- `.github/scripts/intake-pick.jq`: the selection. It fails on a Linear answer without data or with more than one page, waits at MAX_PARALLEL In Progress issues, and otherwise picks the oldest Ready issue that no open PR closes (closes, fixes or resolves, as `guards/pr-issue.jq` reads them) and no blocker short of completed blocks.
- `.github/scripts/intake-pick.test.sh`: 12 cases, run by `make check-repo` (passes).
- `.github/workflows/intake-dispatch.yml`: schedule, push to main and workflow_dispatch; the pick, then one fire call whose body goes to /dev/null, with only the ID and status logged.
- The workflow's Linear query and `gh pr list`, run by hand against IRM with the owner's key, answered `wait: IRM-70 in progress` (Ready held only IRM-5).
- `zizmor` and `make check` pass.

## Decisions

- The selection lives in jq, as `ci-change.jq` does, so the test feeds it stored answers; the API calls stay in the workflow.
- A canceled blocker still blocks, matching "short of Done" in the routine prompt.
- anthropic-version 2026-10-21 as the fire endpoint's reference shows; the beta header is pinned because breaking changes ship behind new header dates.
- The fire step refuses to run without the URL and token, naming the missing one.

## Next step

Open the PR.
