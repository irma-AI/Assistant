# IRM-95 research: an isolated environment per PR

Read on 2026-10-24.

Read-only research; nothing was changed. ✅ answered · ⚠️ partly answered, needs a live test · ➕ branch added during the research.

Goal: every PR is tested in its own running copy of the app and database, so an unmerged change never affects another PR's testing.

## Research tree

1. Is the problem real in today's flow?
   - 1.1 ✅ The staging design (shape A: promote the same image from staging to prod on `main`) only ever deploys **merged** `main`, about 2 minutes ahead of prod. Unmerged changes never reach it, so cross-PR contamination only appears with a *shared pre-merge* environment.
   - 1.2 ✅ Combined effects between PRs are already tested: the merge queue reruns `ci` on each PR on top of `main` plus the PRs queued ahead of it. A per-PR environment tests a PR **alone**, and the queue tests it **combined**. The two complement each other.
   - 1.3 ➕✅ PR pace (GitHub API, 66 PRs): 47 PRs opened on 2026-10-23 alone. The median PR lives **3 minutes** from open to merge, the slowest 10% over **16 minutes**, and at most **4 were open at once**. A preview that isn't a required check finishes after the merge and tests nothing. As a gate, it adds roughly 2–3 minutes to every PR.

2. Trust and secrets (public repository)
   - 2.1 ✅ Anyone can open a PR on a public repo. So far there have been 0 fork PRs; all PRs come from branches in the repo. Previews should only run for same-repo branches (`head.repo == base.repo`) by allowed authors.
   - 2.2 ✅ The `ci` workflow (`pull_request`) has no secrets by design, and its `image` job only builds and checks the image locally (`make image-check`). A deploy needs the Dokploy key, so it has to run in a **trusted** workflow: `workflow_run` after `ci`, running `main`'s copy of the workflow. That's the same idea as `policy`'s `pull_request_target`, and zizmor needs an ignore with a reason. The PR's image travels as an artifact (`docker save`) and is treated as data. It's pushed to GHCR as `pr-<n>-<sha>`, never as a `main` tag.
   - 2.3 ✅ Use a new GitHub environment `previews` (secrets and branch rules are available on Free for public repos), holding a Dokploy **member** key limited to the Assistant project's `previews` environment. The Dokploy key a cloud session reaches today belongs to an owner and reaches every project on the server.
   - 2.4 ⚠️ Running PR code on the server: preview containers join `dokploy-network` by default, the same overlay network as `assistant-db` (prod) and the other projects' services. Dokploy's `application.update` has `detachDokployNetwork` and `networkIds`, and `network.create` supports `internal: true`, so previews could live on their own network. ⚠️ Traefik routes through `dokploy-network`, so a detached app needs Traefik attached to the previews network. Only a live test can confirm that.

3. Hostnames and TLS (the hard limit)
   - 3.1 ✅ Let's Encrypt allows 50 new certificates per registered domain per 7 days, shared by every subdomain of petterannerwall.se (redo, chat, dokploy, …). Renewals are exempt. At 47 PRs a day, a new certificate per PR breaks within a day.
   - 3.2 ✅ sslip.io, traefik.me and nip.io are **not** on the Public Suffix List (checked), so their hosts share one global limit with everyone else. That's unreliable.
   - 3.3 ✅ A wildcard certificate (`*.preview.redo.petterannerwall.se`) needs DNS-01. Lego has a **HostUp** DNS provider (`HOSTUP_API_KEY`, scopes `read:dns write:dns read:domains`), but only **since lego v5.0.0**. ⚠️ I couldn't see whether Dokploy's Traefik bundles lego v5. The fallbacks are an uploaded certificate (`certificates.create`) renewed by a scheduled lego job, or the `exec` provider.
   - 3.4 ✅ **A fixed pool of slots avoids the limit entirely:** `pr-1 … pr-6.preview.redo.petterannerwall.se`, each issued once and then only renewed. That's one wildcard A record or six A records at HostUp, and no DNS or TLS work per PR.

4. Database isolation
   - 4.1 ✅ One Postgres service per slot (`postgres.create` in the `previews` environment). PR code never holds admin credentials for another slot's database. A shared cluster with a database per PR would need admin credentials somewhere a PR can reach.
   - 4.2 ⚠️ Reset per PR: delete and recreate the slot's Postgres (`postgres.remove` then `postgres.create`) to get a fresh volume, then the app's own migrations run at start. Timing needs a live test, probably 20–40 seconds.
   - 4.3 ✅ Data: fake seed data only (guardrails 2.7 plans faker seeds, not built yet). Never prod data.
   - 4.4 ✅ Migrations: each PR migrates its own fresh database from zero. That proves the migration applies cleanly, but not against prod-shaped data or under the previous release (only a staging run of the previous image against the new schema shows that).

5. Lifecycle (with slots)
   - 5.1 ✅ PR opened or pushed, after `ci` is green → the trusted workflow claims a free slot (lease = slot app's `description` = PR number; a `concurrency: previews` group prevents races) → reset the database → `saveDockerProvider pr-<n>-<sha>` → deploy → `deploy.sh`-style `/version` poll → Playwright against the slot URL → commit status `preview` with the URL.
   - 5.2 ✅ PR closed or merged → release the slot (`application.stop`, clear the lease). A sweep on every merge releases leases whose PR is closed, following the guardrails' preference for merge-triggered jobs over schedules.
   - 5.3 ✅ All slots busy → wait in the `concurrency` group. With at most 4 open PRs, 4–6 slots are enough.
   - 5.4 ✅ Dokploy API coverage: `application.create/update/delete/stop/start/saveDockerProvider/saveEnvironment/deploy`, `domain.create/delete`, `postgres.create/remove`, `environment.create`. Everything is scriptable, with no UI steps per PR.

6. Making it a gate
   - 6.1 ✅ `workflow_run` results don't attach to the PR on their own. The trusted job posts a commit status (`statuses: write`) on the PR head SHA, and the ruleset requires it.
   - 6.2 ✅ The merge queue tests a temporary merge ref, not the PR head. Like `policy`, the `preview` status would be reported as passed (skipped) for `merge_group`, so the queue relies on `ci` for combined effects.
   - 6.3 ✅ Cost per PR: artifact upload and download (~100–200 MB image), plus deploy and smoke ≈ +2–3 min on a PR that takes 3 minutes today.

7. Capacity
   - 7.1 ⚠️ About 6 slots × (Node app ~70–100 MB + Postgres ~40 MB) ≈ 0.7–0.9 GB RAM when all are running. Stopped slots use about none. Server headroom is still unknown (needs the Dokploy panel).

8. Alternatives considered
   - 8.1 ✅ Dokploy preview deployments: already rejected (guardrails 6.4). They build from PR source with the app's settings and skip the attested image, and they need the GitHub-source app type, not a Docker image.
   - 8.2 ✅ A new environment, domain and certificate per PR: blocked by Let's Encrypt's limit (3.1) unless the wildcard path (3.3) works.
   - 8.3 ✅ A hosted branching database (e.g. Neon) or a hosted preview platform: a new vendor, which is the owner's decision, and guardrails assume no other paid service.
   - 8.4 ✅ Tests on fresh, isolated databases in CI only (what `ci`'s Postgres service already does): this covers the server-function and database seams in isolation already. Per-PR environments add the deployed container, Traefik and real-browser behaviour against a deployed URL.

## Recommendation
- Model: **a pool of 4–6 preview slots** in a Dokploy `previews` environment, each with a fixed hostname, its own Postgres reset per PR, a scoped Dokploy member key, and a trusted `workflow_run` deploy that posts a required `preview` status. The merge queue keeps testing combined effects, and staging (shape A) becomes optional.
- When: it only pays off once tests do things CI can't (real third-party sandboxes, mobile builds against a URL, deployed-only behaviour). Until then, `ci` already runs each PR in isolation against a fresh database.
- Before building: test network isolation (2.4) and database reset timing (4.2) live.

## Unverified
- Traefik's lego version (3.3), whether a detached app can still be routed (2.4), database reset timing (4.2), server headroom (7.1).


## Sources

All read on 2026-10-24.

- Live Dokploy API, v0.30.7: `settings.getOpenApiDocument`, `project.all`, `application.one` (env var names only), `postgres.one`, `settings.readTraefikConfig`, `user.get`.
- GitHub REST API: `GET /repos/irma-AI/Assistant/pulls?state=all` (66 PRs, their open and close times).
- Let's Encrypt rate limits: https://letsencrypt.org/docs/rate-limits/
- Public Suffix List: https://publicsuffix.org/list/public_suffix_list.dat
- lego HostUp DNS provider: https://go-acme.github.io/lego/dns/hostup/
- Traefik ACME: https://doc.traefik.io/traefik/https/acme/
- GitHub deployments and environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- Dokploy permissions: https://docs.dokploy.com/docs/core/permissions
- Dokploy variables: https://docs.dokploy.com/docs/core/variables
