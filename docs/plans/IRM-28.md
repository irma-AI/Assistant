# IRM-28: Deploy errors name Dokploy's reason

Deploy errors name Dokploy's reason: when a Dokploy API call fails, deploy.sh prints the HTTP status and Dokploy's error message, and never prints a successful answer, which can hold the app's environment variables.

Acceptance criteria:
- A failed Dokploy call prints "Dokploy <call> returned <status>: <message>".
- No successful Dokploy answer is printed to the log.

## Progress

- `api` in `.github/scripts/deploy.sh` captures the status code, prints only the message field on a non-2xx answer, and returns the body to its callers otherwise. A bogus key printed `Dokploy application.one?applicationId=x returned 401: Unauthorized`.
- The two deploys so far stopped at a bare `curl: (22) ... 401`, which didn't say why.

## Decisions

- Only `.message` (or `.error`) is printed, cut at 300 characters, because a successful `application.one` answer includes the app's env with the database password.

## Next step

Open the PR with auto-merge on; read the message from the deploy after merge.
