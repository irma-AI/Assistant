# IRM-15: Release image: build, check, push and attest on every merge

Release image (plan 2.13, §8 step 7, first part): a Dockerfile for the Nitro Node server with pinned base images, checked in ci by building it and reading /version from the container, and a release workflow that pushes every main commit to ghcr.io/irma-ai/assistant tagged with its commit, attests it and verifies the attestation.

Acceptance criteria:
- ci builds the image and fails unless the container serves the commit on /version.
- A push to main pushes ghcr.io/irma-ai/assistant:<commit>, attested with actions/attest-build-provenance, and gh attestation verify passes.
- Base images are pinned to a digest, and pnpm's version comes from mise.toml.

## Progress

- Added `Dockerfile` (two stages on node:24.22.1-alpine by digest, runtime as the node user with a /version health check), `.github/scripts/image-check.sh` behind `make image-check` in ci, and `.github/workflows/release.yml`.
- `make check` passes. The image itself is first built by ci on this PR; a local Docker build stalled on the base image pull.

## Decisions

- The deploy to Dokploy is a separate issue: it needs a Dokploy app, a member user scoped to it and its key in the checks environment.

## Next step

Open the PR with auto-merge on; check the first release run after merge.
