# IRM-26: Deploy recovery covers every failure and reports what happened

Deploy recovery covers every failure (review findings on IRM-24): a failed pin or deploy call also rolls back, and the deploy-failure issue says what actually happened: nothing deployed, rolled back, or rollback failed with production possibly down.

Acceptance criteria:
- A failure in saveDockerProvider or deploy for the new image pins the previous image again.
- The issue text distinguishes "nothing deployed", "rolled back" and "rollback failed".

## Progress

- `deploy.sh` runs the pin, the /version poll and the home page check as one condition, so a failed API call after the lookup also leads to the rollback; it writes `outcome` (not-started, deployed, rolled-back, rollback-failed) to the step's outputs.
- The issue step in `release.yml` words its description from that outcome. zizmor passes.
- The first real deploy (run on 528a24a) stopped at `application.one` with a 401, before anything was pinned; production kept serving 7eadda36.

## Decisions

- The 401 is the API key, which the owner checks; this issue only changes what the job does on failure.

## Next step

Open the PR with auto-merge on.
