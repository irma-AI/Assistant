# IRM-24: Deploy to Dokploy from green main, with rollback on failure

Deploy to Dokploy from a green main (plan 2.13, 2.19): after the image job, verify the image's attestation, pin the commit's tag in Dokploy and deploy, and wait until /version serves that commit and the home page renders. On failure, pin the previous image again and open a deploy-failure issue in Linear. The release runs only after the deploy passes.

Acceptance criteria:
- A push to main deploys ghcr.io/irma-ai/assistant:<commit>, and the job passes only once the app's /version serves that commit.
- A failed check pins the previous image again and opens a Linear issue with the run link.
- The release job waits for the deploy job.

## Progress

- `.github/scripts/deploy.sh` reads the current image from `application.one`, pins the new tag with `application.saveDockerProvider`, deploys, and polls /version for up to 5 minutes, then checks the home page heading. On failure it pins the previous image and deploys again.
- `release.yml` gets a `deploy` job between `image` and `release`, in the `checks` environment with `DOKPLOY_API_KEY`; zizmor passes. The Linear lookup for the issue was tested against the workspace.
- The app (`QBnL1Yn7fZ0Ficd4cbI36`) already serves 7eadda36 on its domain with a valid Let's Encrypt certificate.

## Decisions

- The workspace has no `deploy-failure` label yet, so the issue opens without one until it exists.
- The smoke test is `/version` plus the home page heading for now; the Playwright suite against production comes with the first feature.
- Production migrations come with the first real migration.

## Next step

Open the PR; after merge, confirm the first deploy run, then flip the first criterion.
