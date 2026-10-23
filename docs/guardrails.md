# Guardrails

How this repository keeps agent-built changes safe, and why each guard exists. It began as the build plan (2026-10-22), drawn from an audit of an earlier test project and from research into how OpenAI, Anthropic, xAI, GitHub, Stripe, Spotify, StrongDM and others run coding agents, and now describes what is built. `CLAUDE.md` holds the rules; this file holds the reasons.

## Background: the test project this learns from

The test project was a web app with a database, a backend and calls to an AI model. AI coding agents built almost all of it between 2026-10-12 and 2026-10-21 and merged 225 pull requests (PRs). One maintainer set the direction, answered questions and approved anything that spent money.

This learns from the scaffolding around that code: instructions for the agents (a root file plus smaller rule files), guards (small scripts that fail the build when a rule breaks), hooks that run on events such as an edit or a commit, a decision log, a paid evaluation workflow for the AI's behaviour, and a CI setup that agents merged through with nobody approving the PR. An audit of the full history found that rules a machine enforced kept holding, and rules written only as prose drifted within days.

## What this assumes

**The people.** One owner works with Linear only through Claude and checks production from time to time. Nobody files issues by hand, reviews code, approves a merge or commits: every commit in a PR and every change in Linear comes from Claude, and each squash commit on the default branch carries Claude as co-author.

**The agent.** Claude Code is the only agent harness. Building happens in cloud sessions and in routines (scheduled cloud agents), almost never on a local machine.

**The plans and services.**

- One individual Claude subscription (Pro or Max), and no other paid service.
- A public repository owned by a free GitHub organization, the only free setup where rulesets, the merge queue and auto-merge all exist.
- Linear on the Free plan, which caps a workspace at 250 unarchived issues.
- Claude's own GitHub App is installed, and cloud sessions reach GitHub through Claude's GitHub connection. No custom GitHub App is used.

**The stack.** A web app with a realtime UI (autosave and live updates), in TypeScript end to end.

- TypeScript in strict mode on Node LTS, with pnpm; mise pins both ([2.12](#212-ci-as-the-authority)).
- [TanStack Start](https://tanstack.com/start) (React) for pages and server code, with server-side rendering and typed server functions, built into a Node server by Nitro.
- [TanStack DB](https://tanstack.com/db) in the browser, with live updates over server-sent events ([2.29](#229-one-write-path-with-live-updates)).
- PostgreSQL, with Kysely for typed queries, plain `.sql` migrations and types generated from the schema ([2.7](#27-invariants-in-the-database-tested-against-the-real-database), [2.9](#29-generated-artifacts)).
- Vitest and Playwright for tests ([2.8](#28-declared-test-seams-swept)), and the AI model vendors' official TypeScript SDKs.
- An existing self-hosted [Dokploy](https://dokploy.com/), deployed from images in GitHub's container registry ([2.13](#213-done-means-seen-working)).
- make as the task runner ([2.1](#21-one-command-interface)).

**Where the pieces come from.** Most come from the old repository, adapted where they relied on its maintainer. Conventional commits and semantic versions, the heavier use of commit hooks and the pieces from the research are new.

**"Not checked".** A piece marked *not checked* has not been seen working on this platform yet, and doesn't count as a guard until it has held once. Everything else here was tested live on 2026-10-22 and 2026-10-23, in a scratch repository and then in this one. A piece marked *not built yet* waits for the first feature that needs it, such as login or the first table.

---

## 1. Principles carried over

### A rule without a check is a wish

The old instruction file listed "hard rules" and labelled several "soft: no check yet". Those are the ones that drifted:

- **Strict typing.** On day three, five files were allowed to opt out of strict type checking because the web framework's types were awkward. By day nine 39 files had opted out, about 90% of the web app's code, with no decision recorded and nothing counting them.
- **Infrastructure access.** The agent access doc banned DNS changes, and one PR created DNS records and a new hosting app anyway.

A maintainer may eventually notice drift like this. Nobody watches the code here, so there are no soft rules.

### Self-attestation is not enforcement

Several old gates accepted the agent's own word:

- **Ticket approval.** Work needed a ticket marked "ready", which the agent could create and mark ready itself.
- **Adversarial review.** A guard required certain PRs to record a second-agent review, but only checked for the PR section, so the review never had to run.
- **Eval receipts.** Prompt changes needed a receipt from a paid evaluation run. The agent copied it by hand from a CI log, and in one PR regenerated it locally without running the evaluation.
- **Usage and production scripts.** Usage readings were self-reported, and production scripts checked a "reviewed" hash the same agent produced.

A gate counts here only if something other than the author produces its evidence.

### A change must not be able to loosen the check that judges it

The old guards read their configuration from the target branch, so a PR could not shorten the protected-path list that checked it. The guard code, the task-runner file and the CI workflow still ran from the PR, so a PR could rewrite a guard and be judged by the new version. The decision log said a PR that edits guards "now merges unread".

### Fail closed

A check that cannot run refuses and says why, and never quietly passes: when the target branch can't be read, Linear is down or a hook crashes. The old helper for reading the target branch did this well; here it is universal.

### Shift left, but CI stays the authority

The earlier a check runs, the cheaper the mistake: seconds while the agent edits, a full push-and-wait cycle in CI, which the old repository paid 117 times in failing PR runs.

Local hooks can be skipped, though:

- git's `--no-verify` flag skips them;
- the old ones were only installed when an agent session started;
- one agent wrote code through a shell script, which went around the edit hook;
- the agent can edit the hooks inside its own session.

So every check runs as early as it can for speed, and again in CI for authority. Both call the same task-runner target, so they cannot disagree.

### Bound everything that grows

Agent-maintained documents grow because every change appends and nothing removes.

- The root instruction file stayed under its 120-line cap while its word count nearly doubled, because lines grew to as long as 1,489 characters.
- The architecture document grew from 2.4 KB to 37 KB.
- The decision log gained 737 lines in ten days.

Size limits here count characters or words, and are enforced.

---

## 2. Must-have pieces

### 2.1 One command interface

**What it is.** Agents, git hooks, CI jobs and scheduled jobs call named task-runner targets, never the underlying command. The exceptions are setup and platform calls the workflows make themselves (`pnpm install`, mise, `gh attestation verify`), and the browser tests in ci's `e2e` job and the production smoke test, which run through `pnpm` because Playwright's image has no make; `make e2e` runs the same script.

- Core targets: `check` (everything CI runs), `fix`, `generate`, `generate-check`, and `dev`, which boots the app so agents and the verification job ([2.13](#213-done-means-seen-working)) can exercise it. It seeds nothing yet; seed data comes with the synthetic-data generator ([2.8](#28-declared-test-seams-swept)).
- Hook targets such as `check-staged` (pre-commit) and `check-push` (pre-push).

**Why.**

- A command CI runs from its own copy drifts from what agents run.
- The old repository kept this rule for its whole history.
- It lets the same check run in a hook and in CI ([section 4](#4-where-each-check-runs)).

**Tools.** [make](https://www.gnu.org/software/make/), already on GitHub's runners and in the cloud VM.

### 2.2 Layered enforcement pipeline

**What it is.** Checks are spread across stages from the agent's edit to the deploy ([section 4](#4-where-each-check-runs)), each at the earliest stage that fits its time budget. CI repeats every check, because the agent can skip or edit the earlier stages.

- A SessionStart hook in the repository runs `git config core.hooksPath` at the start of every cloud session and routine run, and `make setup` does the same outside the cloud. A cloud session opened on the repository runs the hook and its git hooks fire; a routine run is *not checked* yet.
- Hooks are fast feedback and CI ([2.12](#212-ci-as-the-authority)) decides, so nothing depends on a hook holding.

**Why.**

- Early feedback is cheaper.
- On an individual plan a cloud session reads only the repository's own settings, which the agent can edit, and `--no-verify` skips git hooks. CI refuses again whatever a hook could: the ruleset blocks force-pushes to the default branch, and CI checks every commit.

**Tools.** No hook manager: two hook scripts call `make check-staged` and `make check-push` ([2.1](#21-one-command-interface)).

### 2.3 Guard framework

**What it is.** A guard is a small script in one folder, run by one runner, under one contract: each violation has a stable ID that rules ([2.4](#24-every-rule-maps-to-a-check)) and messages refer to; the message ends with the exact fix (a command, or the lines to add); it prints how many items it scanned, and 0 fails, so a guard that checks nothing cannot pass; and it exits with 1 on a violation.

**Fixtures.** Before the real run, each guard runs on tiny fake repositories. A failing fixture must make it fail, proving it catches what it should, and a passing fixture must make it pass, proving it doesn't block legitimate work. A guard that blocks something it shouldn't gets a passing fixture for the case, then is changed until both sets behave.

**Changes from the old repository.**

- **Passing fixtures are new.** A commit-author guard, tightened into an allow-list that left out GitHub (the committer of every squash merge), failed main's CI on seven pushes in a row over about 13 hours. A passing fixture shaped like a squash merge would have caught it.
- **Guards run from the target branch**, inside `policy` ([2.12](#212-ci-as-the-authority)), so a PR cannot rewrite its own judge. They and their fixtures are protected paths, so a PR that changes them fails unless its issue carries `ci-change`, and an agent cannot quietly loosen a guard to turn a build green.
- **The scanned count is honest.** The old guards printed the number of changed files plus one, so a guard with nothing to scan still passed.

**Stack guards.** Three guards target the mistakes agents make most with this stack:

- **Wrong framework.** It fails on `src/pages/`, `app/layout.tsx`, `"use server"`, `getServerSideProps`, imports from `next/`, `react-router-dom` or the non-existent `@tanstack/start`, and `createServerFn` imported from `@tanstack/react-router`. Its fixtures come from TanStack's own list of agent failure modes.
- **Server-function login.** Every `createServerFn` chains the login middleware or sits on an explicit public list ([2.8](#28-declared-test-seams-swept)). *Not built yet.*
- **Secrets in the browser.** It fails on a `process.env` read at module scope and on a secret with a `VITE_` prefix, which Vite ships to the browser ([2.14](#214-permissions-and-network-replace-stop-and-ask)).

**Why.**

- It was the old repository's most reliable piece: it blocked 113 of 117 failing PR runs, and each hole found was closed within a day or two.
- The protected paths do the job of the old guard that refused weakened guards, with no extra code.
- On an individual plan nothing inside a session can be enforced, because the agent can edit the repository's settings file. Blocking changes to that file in CI ([2.12](#212-ci-as-the-authority)) stops a weakened configuration from merging.

**Tools.** Guards that judge a PR are jq filters over the PR as data (`guards/*.jq`, each with a fixtures file). Guards about the shape of code are [ast-grep](https://ast-grep.github.io/) rules: `ast-grep test` checks each against passing and failing cases, and `.ts` and `.tsx` both parse as TSX, so each rule exists once. Guards that count or compare things stay plain scripts.

### 2.4 Every rule maps to a check

**What it is.** Each rule in the agent instructions names what enforces it: a guard ID, a test file or a platform setting, as in `Never import the web layer from the domain layer. [enforced: guard:layers]`. The docs-reference guard ([2.5](#25-instruction-layering-with-size-budgets)) fails a rule naming a check that doesn't exist, so no separate guard is needed. A rule that can't be checked is rewritten until it can be, or deleted.

**Why.**

- The old rules said "Rules 1 to 5 and 7 are soft: no check yet", meaning to add a check once someone noticed a rule being skipped.
- That assumes someone notices, and the rules that drifted were exactly the unchecked ones.

### 2.5 Instruction layering with size budgets

**What it is.** `CLAUDE.md`, which agents read in every session, holds only what every session needs.

- Detailed rules live in rule files that load only when the agent touches their paths, and the path patterns stay narrow.
- Each rule lives in one place. With one harness, there is no pointer file for other tools.
- A docs-reference guard checks that every path, command, task-runner target or check an agent document names exists. The agent documents are `CLAUDE.md`, `next-step`, the rule files and `docs/agents/`, where the routine prompts and the tracker conventions live, each within a character budget.
- `CLAUDE.md` has a character budget, held by a guard.
- A rule file scoped to `src/routes/**` holds TanStack's route conventions (`$id` parameters, optional segments, splat routes, `__root.tsx`) and says to quote paths containing `$` in shell commands.
- Edits to `CLAUDE.md`, rule files and skills follow [`writing-for-agents`](#3-skills).
- Ponytail's rules reach every session and every subagent through its hooks ([section 3](#3-skills)), outside `CLAUDE.md`'s budget. They are ponytail's own text, pinned like a skill, so `CLAUDE.md` carries no arbitration lines for them.

**Why.**

- The docs-reference guard caught real drift cheaply in the old repository.
- Only `CLAUDE.md` loads in every session, so one budget covers the cost that matters. Old rule files scoped to every source file of a language loaded on every edit, which made them always on.
- The old line cap was met with longer lines ([section 1](#1-principles-carried-over)), so the budget counts characters.
- Armin Ronacher reports agents editing `$param.tsx` through the shell and getting `.tsx`, because the shell expands `$param`. None of the TanStack rule sets cover it.

### 2.6 Strict static checks from the first commit

**What it is.** TypeScript's strictest settings and ESLint's strict rules are on before any code exists.

- No per-file opt-outs from strict mode. The TypeScript and ESLint configuration are protected paths ([2.12](#212-ci-as-the-authority)).
- A suppression comment (`// @ts-expect-error` or `// eslint-disable`) must name its rule and give a reason, and one that no longer silences anything fails.
- No type assertions on inferred values (`consistent-type-assertions` set to `never`), following TanStack's own rule: "Types are FULLY INFERRED. Never cast, never annotate inferred values."
- The type check runs as `tsc --noEmit` before the build, because TypeScript still runs code that fails the type check.

**Why.**

- Strict typing is cheapest to adopt before any code exists, and the old project rightly chose it on day one.
- Its opt-outs then grew from 5 files to 11, 20 and 39 with no decision recorded. A new repository starts at zero, so a ban is simpler than a count.
- GitHub cites a 2025 study on type-constrained decoding that found about 94% of compile errors in model-written code are type errors, so the type checker is the agent's cheapest reviewer.

**Tools.** [typescript-eslint](https://typescript-eslint.io/)'s `strict-type-checked` on ESLint 10, with `ban-ts-comment` requiring a description, eslint-comments' `require-description`, `reportUnusedDisableDirectives: "error"`, TanStack's router and query plugins, and an `only-throw-error` allow list for TanStack's `redirect()` and `notFound()`. TypeScript stays on 6.0 until typescript-eslint and dependency-cruiser support 7, and ESLint ignores `routeTree.gen.ts`, whose generated header disables both checkers.

### 2.7 Invariants in the database, tested against the real database

**What it is.** Rules that must never break live in PostgreSQL itself, as constraints, triggers or permissions. Examples: a status can only take certain values, and a log row can only be deleted after its retention period.

- Tests run against a real PostgreSQL, never a mock: a GitHub Actions service container in CI, and the PostgreSQL preinstalled in the cloud VM during a session. One major version runs everywhere: the VM's (16 today) is pinned in CI and on Dokploy. Each test tries the forbidden write and asserts that the database refuses it.
- Migrations are plain `.sql` files. Kysely's migrator runs them through one small provider that reads the files, all pending ones in a single transaction under an advisory lock, and that provider has its own test.
- A guard requires a PR that adds a migration to change a test.

**Why.**

- Every writer hits the same wall, including scripts and background jobs that skip the application code.
- It held in the old repository: 40 constraints, 14 of 33 migrations adding triggers or permissions, and no shipped migration edited afterwards.
- The old migration guard was this simple, and all 28 migration commits came with a related test. The AI review ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)) checks that the test fits the migration.
- Plain SQL keeps constraints and triggers readable and lets squawk lint them.

**Tools.** [Kysely](https://kysely.dev/) for typed queries, and [squawk](https://squawkhq.com/), installed from npm as `squawk-cli`, to flag migrations that lock or rewrite tables, which matters when every merge deploys. squawk assumes each migration runs in a transaction, and an index built `CONCURRENTLY` gets a migration run of its own outside one.

### 2.8 Declared test seams, swept

**What it is.** A test seam is where tests attach to the system and observe real behaviour.

- There are three: server functions tested with Vitest against a real PostgreSQL, pure functions tested on stored sample records, and the browser tested through Playwright. `CLAUDE.md` states them.
- Tests don't mock the project's own modules, and small local servers that behave like external services, such as an AI model's API, may stand in for them.
- Sweep tests check every member of a set, so a new member is tested automatically: every server function requires login or sits on an explicit public list ([2.3](#23-guard-framework)), and every value of a closed set is handled. Parity tests read both copies of any fact stored in two places and fail if they differ. *Not built yet.*
- A Playwright test with two browser contexts shows an edit in one appear in the other without a reload, and a write the database refuses roll back visibly ([2.29](#229-one-write-path-with-live-updates)). *Not built yet.*
- A synthetic-data generator, `src/server/synthetic.server.ts`, supplies tests, the seed data that `make dev` loads and the data in screenshots, so real personal data never goes into fixtures or a public PR. It makes deterministic people with email addresses at the domains RFC 2606 reserves (`example.com`, `example.org`, `example.net`) and phone numbers in a range the national regulator reserves for fiction. *Not built yet:* the app stores no personal data so far. `guards/synthetic-data.sh` fails `make check` as soon as a migration names a personal-data column (email, phone, a person's name, address, personal number, birth date, in English or Swedish) or creates a table of people (candidates, users, contacts and the like) while the generator doesn't exist or makes no `example.com` address, so it arrives with the first such table. The generator's file is a protected path, so a stub that only satisfies the check needs an issue the owner readied with `ci-change`. A false hit only means building the generator sooner; a people table that names nothing on the list, or a schema made outside `migrations/`, gets past it.
- A flaky test (one that passes or fails with no code change) gets a Linear issue and a fix, and is never skipped or retried until it passes.

**Why.**

- Tests were among the old repository's strongest parts: 1.7 times the size of the product code, a test with almost every fix, and sampled tests asserting real behaviour.
- Its one production outage came from code no seam covered. Three untested PRs changed one browser page's JavaScript within 33 minutes, and the second broke that page on every iPhone. The maintainer noticed by testing on a phone, which nobody does here.
- Login is swept on server functions, where the data is. TanStack's own guidance says a route's `beforeLoad` "is UX, not the data boundary".

**Tools.** [Vitest](https://vitest.dev/) for server and pure functions, and [Playwright](https://playwright.dev/) for the browser seam and for before and after screenshots in the PR, run on WebKit with iPhone device profiles. WebKit on Linux is close to, but not the same as, iOS Safari.

### 2.9 Generated artifacts

**What it is.** `generate` rebuilds every file a tool produces from the code: the route tree (`routeTree.gen.ts`) and the Kysely database types. The TanStack skills ([section 3](#3-skills)) are copied by `make skills` and checked by `node scripts/tanstack-skills.ts --check` in `make check-app`. `make generate` rewrites them in place, and `generate-check` runs it and fails, printing the fix command, if a committed copy changed.

- The database types come from kysely-codegen against the migrated schema, written into the repository and checked by `make generate-check`, which fails when a committed copy differs. Two runs give identical output.
- Route generation is proven by a production build, because TanStack's own guidance says "a typecheck alone does not prove route generation".

**Why.**

- In the old CI, generate-check caught a stale stylesheet and a model change with no migration.
- Run as a pre-commit check, it catches the problem before the commit.

### 2.10 Architecture layers, enforced

**What it is.** A dependency-cruiser config says which layers may import from which, and a guard in `policy` enforces it.

- Server-only code lives in `*.server.ts` files, such as `db.server.ts`, and only `src/server/**` may import them.
- Routes and components reach the server only through `*.functions.ts` files, which export `createServerFn` wrappers.
- TanStack's import protection fails the build when a `*.server.*` file reaches the browser bundle, so the boundary is checked twice before the AI review sees it.

**Why.**

- The old core service's layers held with no violations for the whole history.
- Its web app was a single layer. Its main view file grew to 1,009 lines and became the de facto service layer, with other modules importing business logic from it.
- TanStack Start runs code on both server and browser by default. dependency-cruiser reads imports before TanStack's compiler strips server code from the browser bundle, so the file convention is what makes the boundary checkable.

**Tools.** [dependency-cruiser](https://github.com/sverweij/dependency-cruiser), with `options.tsConfig` set so it resolves the `~/*` alias. `routeTree.gen.ts` stays in its graph, because it is the only file that imports the routes.

### 2.11 AI review and task-fit judge, run by CI on the subscription

**What it is.** Two AI checks run in the `policy` workflow ([2.12](#212-ci-as-the-authority)) on every PR, through [Claude Code's GitHub Action](https://github.com/anthropics/claude-code-action) and the one Claude subscription.

- **The review** runs one pass on the commit under review and applies each lens in turn, looking for a concrete counterexample: an input or sequence of events that breaks the change. It reads the lenses from the default branch's skill files: [`skeptic-pass`](#3-skills) for correctness, regression and safety, [`ponytail-review`](#3-skills) for necessity (on UI changes, what the default branch's DESIGN.md or impeccable's craft floor requires counts as needed on the surfaces the issue touches, because hooks don't run in CI to say so; a PR's own DESIGN.md is judged, never the bar), and [`agentic-actions-auditor`](#3-skills) when a PR changes `.github/`. One pass per lens would triple the usage per PR; it can split if findings get shallow. A PR that touches a protected path is reviewed with Opus 5.5, because that's where a loosened check would hide; every other PR with Sonnet 5.5, to spare the subscription's usage windows, which the review shares with building. A Sonnet reviewer also differs from the Opus sessions that write most of the code.
- **The task-fit judge**, built on the spec axis of [`code-review`](#3-skills), fails a diff that does work nobody asked for or leaves one of the Linear issue's acceptance criteria unmet.
- Both run in agent mode with a `claude setup-token` token stored in the `checks` environment ([2.12](#212-ci-as-the-authority)) and only the built-in `GITHUB_TOKEN`, so they need no Claude GitHub App. Their tools are read-only (Read, Grep, Glob), with no shell and no web access. `--max-turns` and a job timeout are set, with headroom on the turns, because going over the limit fails the job.
- Output follows a JSON schema, and a later step fails the job on any open P0 or P1 finding or on missing output. After three fix rounds (`policy` failed on four of the PR's commits), the `fix-rounds` job closes the PR, comments the reason on the issue and moves it to Needs input.
- They trigger on `pull_request_target`, never `push`, which the Action refuses ("Unsupported event type: push"). They read the full diff at the frozen head commit from a separate folder of the PR's files, which never run, and learn nothing from PR comments; a new reviewer rule arrives as a PR to a repository file.
- The review runs in the default branch's checkout, so its `CLAUDE.md`, `.claude/` and the lens files are the trusted copies. Before Claude starts, a step deletes every `CLAUDE.md`, `.claude/` and `.mcp.json` from the PR's files under `pr/` and fails if any remain, because Claude Code loads instruction files from the folders it reads; what the PR did to them is still in the diff, as a change to judge.
- After the review, the `review-usage` job keeps one comment on the PR with the model, the verdict, the turns, the time, and each model's tokens and API-equivalent cost, updated in place on every review. It is a job of its own because posting needs `pull-requests: write`, which the job holding the review never gets. A comment, not the PR description: editing the description re-runs `policy`.
- The token is valid for a year, and when it expires the checks fail, so PRs stall visibly until it is renewed. It works with an individual Pro or Max token on `pull_request_target`. The token is the one `claude setup-token` prints at the end; the code the browser shows fails with `401 Invalid bearer token`.

**Why.**

- In the old repository this review, the "skeptic pass", found the most real defects: about 21 of 35 risk-path PRs changed before merge because of it, over a spending limit that failed open, a cached invalid price, an approval bypass, an OAuth sign-in that granted operator powers and a database deadlock.
- The old guard only checked that a PR section existed. With no human review, the review has to run where the author cannot skip it.
- Spotify runs a task-fit judge as a veto on scope drift. The old repository caught scope creep only because the maintainer read the decision log.
- Only GitHub Apps can create check runs, and Claude's app can only read commit statuses, so a routine cannot fail a PR. The Action is the subscription's only way to.
- The reviewer reads untrusted text while holding a secret, so it gets no tool that could send data out. Review bots that learn from comments (CodeRabbit, Cursor Bugbot) would let the author agent teach them to stop flagging things.
- Stripe caps CI fix rounds at two and Bugbot its autofix at three, because returns drop fast after that.
- Others report 401 errors from the Action on Pro, Max and Team accounts (open on 2026-09-11; some were usage limits in disguise). A failed login fails the check, so PRs stall instead of slipping through. The fallback, a PR-triggered routine posting its verdict as a comment for CI to check, is weaker, because the authoring agent works under the same identity and could post a fake one.
- The consumer terms only clearly allow automated access through an API key. The docs describe the subscription token for "CI pipelines and scripts", which falls short of explicit permission.

### 2.12 CI as the authority

**What it is.** CI on GitHub Actions decides what merges.

- **Public repository in a free organization**, which unlocks rulesets, the merge queue, auto-merge and unlimited Actions minutes on GitHub Free.
- **Two required checks**, pinned to GitHub Actions as their source, so a status posted by hand doesn't count.
  - `ci` runs on `pull_request` and `merge_group` as parallel jobs (the repository and app checks with PostgreSQL, the browser tests in Playwright's image, the release image check) and ends in an always-run job named `ci` that passes only if every other job did. A run takes about 45 seconds.
  - `policy` runs on `pull_request_target` from the target branch's copy of the workflow, and reads the PR's diff as data without running it. It holds the guards ([2.3](#23-guard-framework)) and the AI checks ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)), and runs again when the PR is edited, so a title or description changed after a green run is judged again.
- **Protected paths** are everything except app code: only `src/`, `e2e/`, `migrations/` and `docs/plans/` are free, and inside them any dotfile or dot folder, package manifest, `*.config.*` file, tsconfig, makefile or `CLAUDE*.md`, the migration provider (`src/server/migrate.server.ts`) and the synthetic-data generator (`src/server/synthetic.server.ts`, [2.8](#28-declared-test-seams-swept)), stay protected. An allowlist because each tool reads more configuration files than any list can name: the skeptic pass on the first list (IRM-49) found a `GNUmakefile` overriding `Makefile`, nested ESLint and prettier configs, a `.gitattributes` hiding a secret from gitleaks, `.gitignore` files hiding code from ast-grep and `mise.local.toml` changing the tools. A renamed file counts under its old name too, and `.github/scripts/protected-paths.test.sh` checks both kinds of path in `make check-repo`. `policy` fails a PR that touches one unless its Linear issue carries `ci-change`, and it fails if the issue's history shows the label added after the issue reached Ready, so a build session cannot unlock the paths it works on. Linear folds changes made in the first minutes after creation into the creation entry, so a label or a move to Ready with no entry of its own counts as made at creation.
- **Merge queue.** Each PR is retested on the latest default branch with the PRs ahead of it. The `policy` workflow also triggers on `merge_group` with its job skipped, and a skipped job counts as passed, so the queue gets the check it waits for without judging the PR twice.
- **Secrets in a main-only environment.** Every secret lives in an environment named `checks` that only the default branch may deploy to, and none at repository level, because a branch's own workflows get every repository secret (seen in a live test). `policy` on `pull_request_target` runs as the default branch, so it gets them; a PR's own workflow does not.
- **Audit on every merge.** On each push to the default branch, a workflow opens a Linear issue if the change touched a protected path without a `ci-change` label added before Ready (the same rule and code as `policy`), or if one API call shows the ruleset inactive or no longer requiring both checks. The ruleset check also runs daily, because a change in GitHub's settings would otherwise wait for the next merge to show; a drift that lasts gets one issue, "The main ruleset drifted", not one a day.
- **Squash merges only**, one commit and message per PR, and **deploys only from green**, from a default branch that passed the queue.
- **Pinned supply chain.** Actions pinned to commit hashes and images to digests, dependencies installed from the pnpm lockfile only, workflows linted for security problems, and every configuration that ships built in CI. `mise.lock` pins every tool's download URL and checksum. The cloud setup script installs them with mise, and the SessionStart hook puts them on `PATH`, starts PostgreSQL and installs the dependencies in each session, because the environment cache keeps files but nothing that was running.
- **PR text through `env:`.** A PR title, body or branch name reaches a workflow through `env:`, never pasted into a shell command.
- **Branch rules as code.** A repository file creates and restores the rulesets, one of which blocks direct pushes to the default branch.

**Why.**

- On `pull_request`, GitHub runs the PR's own copy of the workflow, so a PR could rewrite `ci` to pass, and GitHub Free has no required workflows to stop it. `policy` runs from the default branch and blocks workflow edits the issue didn't ask for.
- Blocking whole paths is simpler than judging which workflow edits are harmless, and it catches the realistic failure: an agent loosening CI or a guard to turn a red build green.
- Large projects do the same. twentyhq/twenty guards `.github/`, `.claude/`, `CLAUDE.md` and `.mcp.json` with a required `pull_request_target` check (PR #28497, merged 2026-10-21), and n8n does it for its review and contributor checks. projen, faker, flutter and lean4 use the common merge-queue fix of skipping the job on `merge_group`.
- Like twenty, this accepts two limits: the label isn't tied to who set it, so a routine could set it, and a PR could add its own workflow with a passing job named `policy`, since the source pins only to GitHub Actions as a whole. The audit on every merge is the only defence against either. It reports minutes after a change lands, with no daily job to depend on, but only afterwards ([section 7](#7-open-risks)).
- A private repository on GitHub Free gets no rulesets, merge queue or auto-merge, which would leave CI a report nobody reads.
- In the old repository the live branch rules drifted from the committed file unnoticed, and deploys ran without waiting for CI: the default branch was red on 11 of 213 pushes, and each still deployed.

**Tools.** [zizmor](https://docs.zizmor.sh/) checks the workflows for security problems: risky triggers such as `pull_request_target`, injection, broad permissions and actions not pinned to a commit hash. [mise](https://mise.jdx.dev/) pins Node, pnpm and every command-line tool with checksums in its lockfile, so cloud sessions and CI run the same binaries; Dependabot doesn't update it, so those pins are bumped through an issue.

### 2.13 "Done" means seen working

**What it is.** Every deploy ships one attested image, and a verification job checks that it is the one running.

- CI builds a Docker image of the Nitro Node server, attests it with [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance), and pushes it to GitHub's container registry tagged with its commit hash, a tag that never moves.
- The deploy job verifies the attestation (`gh attestation verify`), pins the tag in Dokploy (`application.saveDockerProvider`, then `application.deploy`) and polls the app's `/version` route, because Dokploy's deploy call returns before the deploy finishes.
- Dokploy marks a deploy done before traffic moves, and reports a Swarm rollback as done while keeping the broken image, so `/version` alone decides. If it never shows the new commit, the job pins the previous tag again.
- A smoke job then runs the Playwright suite from [2.8](#28-declared-test-seams-swept) against production. If it fails, a rollback job pins the previous tag again. Each failure opens a Linear issue labelled `deploy-failure` that says what happened, which [`next-step`](#3-skills) starts with [`diagnosing-bugs`](#3-skills). *Not checked:* neither rollback path, after a bad image or after a failed smoke test, has run in production yet.
- The home page's `<h1>Assistant</h1>` heading is part of the deploy contract: `deploy.sh` checks it after `/version`, so changing it means changing the check too.
- The image applies pending migrations before it starts serving, so a failed migration keeps the container from turning healthy and the deploy rolls back. Because the new container migrates while the old one still serves, migrations stay compatible with the previous release.
- Dokploy's health check keeps the old container serving until the new one is healthy and rolls back if it never is, which CI sees on `/version` as a failed deploy.
- The release job ([2.18](#218-conventional-commits-semantic-versions-and-release-notes)) runs only after verification passes.

**Why.**

- The old definition of done included "confirmed live in its target environment", and one hard rule said a check protects nothing until it has been seen to hold once. The maintainer did that confirming by hand.
- The owner here checks production only now and then, and the old repository's worst outage passed every automated check and was found by a person.
- A tag that never moves means a redeploy can't pick up a different image by accident.

### 2.14 Permissions and network replace "stop and ask"

**What it is.** The old repository listed areas where an agent had to stop and ask the maintainer: legal wording shown to end users, contacting real people, adding vendors and changing deploy settings. Here each is made impossible for the agent, or routed to the owner as a question in Linear ([2.22](#222-asking-the-owner)).

- Credentials are scoped per project and per purpose, and cannot change DNS, billing or organization settings, or publish anything outside the release job.
- The Dokploy deploy key belongs to a dedicated member user that can reach only this app, because Dokploy scopes a key by its user, not per key. It lives in the `checks` environment. Changing the app's image needs Dokploy's "Create Services" permission, so that user can also create services in this project and read and write the app's environment variables, but not delete anything or touch Docker, Traefik, SSH or git settings ([section 7](#7-open-risks)).
- One known exception is still open: Claude's GitHub connection acts with the connected account's full rights. If that account owns the organization, the agent's GitHub tools can do anything it can, including turning off the ruleset or changing repository settings. The owner chose not to test a writer-only account (2026-10-23), so this stays a known risk: the ruleset check in the audit on every merge ([2.12](#212-ci-as-the-authority)) is the only defence, and it catches a change afterwards.
- Cloud environments use a Custom network allow-list no broader than the work needs, including Playwright's browser downloads (`cdn.playwright.dev`, `playwright.download.prss.microsoft.com`).
- Secrets live only as network secrets, which the proxy adds to requests leaving the VM, so the agent never sees them. Environment variables hold none, because the agent can read them.
- gitleaks (over the whole history in `make check-repo`, and over the staged changes at pre-commit) and GitHub's secret scanning with push protection (free on public repositories) catch committed secrets, and a stack guard ([2.3](#23-guard-framework)) keeps secrets out of the browser bundle.

**Why.**

- In the old repository only the area with machine gates held. The others relied on agents obeying prose, and at least one broke: an agent created DNS records despite the ban.
- The old deploy token could reach every project on the hosting platform, which the decision log called "a rule, not a scope".
- Untrusted text reaches the agent through issues. The allow-list removes the third part of Simon Willison's "lethal trifecta": private data, untrusted content and a way to send data out, together in one agent run.

**Tools.** [gitleaks](https://github.com/gitleaks/gitleaks), run as a single binary through a make target, scans the staged changes and CI.

### 2.15 Commit identity

**What it is.** Every commit in a PR comes from Claude: the `commit-identity` guard requires the author `noreply@anthropic.com` and a committer that is Claude or GitHub. The squash commit on the default branch is authored by the account that turned on auto-merge, with Claude kept as a `Co-authored-by:` trailer, so the guard covers the PR's commits only. Locally, the git and `gh` credentials are pinned to the owner's personal account, never the company one; that is a setting on the owner's machine (`.claude/settings.local.json` and the checkout's git config), not something in the repository.

**Why.**

- The owner never commits, so any other identity on a commit is a mistake or a leak.
- The platform's own Stop hook is reported to steer commits toward `noreply@anthropic.com`, so that address avoids fighting the platform.
- The old allow-list's first version forgot the squash committer and turned the default branch red ([2.3](#23-guard-framework)).
- Cloud sessions get their commit identity from the platform, and the old identity leak came from a local session, so a CI check is enough.
- Session links stay out of commits and PRs (the owner's decision, 2026-10-23): the repository is public, and a session holds the whole conversation, so a link would be one sharing setting away from exposing it. The PR, its Linear issue and the release notes are the provenance record.

### 2.16 Decision records for memory, bounded

**What it is.** Agents keep no memory between sessions, so the reasons behind choices live in the repository.

- A hard-to-reverse choice gets an architecture decision record (ADR): a short document with the context, the options considered and the consequences.
- Every other non-obvious choice, and every review finding the author declined, goes in the PR description.
- Squash merges use the PR title and description as the commit message (a repository setting), so each PR's reasoning, including its "First principles" section ([2.17](#217-pr-description-contract)), lands in `git log`. The merge queue follows this setting.

**Why.**

- The old decision log was clearly used: about 25 entries reversed or corrected earlier ones, and two findings that agents had declined later turned out to be real bugs.
- It was one file that every PR appended to. It grew 737 lines in ten days and needed a special git merge setting to avoid conflicts. The commit history holds the same reasoning with no file to maintain and no guard for its format.

### 2.17 PR description contract

**What it is.** Every PR description has two required sections, written with [`pr`](#3-skills), and a guard fails a PR whose sections are missing, empty or still template text.

- **First principles**, answering three questions:
  1. Why did the problem happen?
  2. What could be removed or simplified instead?
  3. What alternative was considered, and why was it rejected?
- **Not live yet**: what still has to be switched on after merge (a migration, a scheduled job, a secret), or "Nothing".

**Why.**

- In the old repository these sections were in 221 of 225 PRs, and 18 of 21 sampled PRs held real reasoning that named the mechanism and the rejected alternative.
- In its last days some PRs replaced the questions with other headings. Nothing checked the template, so it had started to drift.
- The "Not live yet" lines also feed the owner's release checklist ([2.18](#218-conventional-commits-semantic-versions-and-release-notes)).

### 2.18 Conventional commits, semantic versions and release notes

**What it is.** Commit messages follow conventional commits, `type(scope): summary`, with the type from a fixed set (`feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, `revert`) and a breaking change marked with `!` or a `BREAKING CHANGE:` footer. Releases follow semantic versioning, `MAJOR.MINOR.PATCH`.

- `policy` ([2.12](#212-ci-as-the-authority)) checks the PR title, which the squash merge uses as its commit message. Commits inside the PR never reach the default branch, so they aren't checked.
- After post-deploy verification passes, a release job on the default branch computes the next version from the commits since the last tag (`feat` raises the minor number, `fix` or `perf` the patch number, a breaking change the major number), then creates the tag and a GitHub Release with the built-in `GITHUB_TOKEN`. The release notes are the changelog, so nothing is committed and no release PR is needed.
- Each change in the notes links its Linear issue and PR, and each release ends with a short "what to check" list gathered from the PRs' "Not live yet" sections.
- The tag is the only source of the version, and any file that needs it is generated from it.

**Why.**

- The old repository tried to carry intent in branch names, but the agent runtime often assigned its own, 77 PRs broke the convention, and nothing checked it. The PR title is checkable and becomes the commit message.
- A PR opened with the built-in token gets no CI runs, so a release PR could never pass its required checks. A tag plus a GitHub Release needs no PR.
- The release notes make the owner's occasional production check quick, and tie it to what the owner asked for.

**Tools.** [git-cliff](https://git-cliff.org/) computes the next version and writes the notes, and `gh release create` publishes them; its notes turn issue IDs into Linear links.

### 2.19 Merging and deploying on GitHub's side

**What it is.** The agent opens each PR and turns on auto-merge. The merge queue merges once the required checks pass, and a workflow deploys.

- Right after opening the PR, the agent turns on auto-merge through the GitHub tools of Claude's GitHub connection (for example `enable_pr_auto_merge`). It never merges directly.
- The merge queue retests the PR and merges it. The rulesets ([2.12](#212-ci-as-the-authority)) keep the required checks in force whoever turned auto-merge on.
- A deploy workflow ([2.13](#213-done-means-seen-working)) runs on pushes to the default branch, and merges by the queue's own bot start it.

**Why.**

- The old repository ran this way for its whole history: agent sessions turned on auto-merge under the owner's account, and the PR queued and merged. The GitHub tools act with the connected account's own permissions, while `git` and `gh` in a cloud session go through a proxy that rejects GraphQL, so `gh pr merge` fails there.
- A queue merge after a person's account turned on auto-merge is an ordinary push, so the deploy workflow starts. Merges caused by GitHub's built-in token are known to start no push workflows.
- Turning on auto-merge hands the decision to the required checks. A direct merge would skip the queue's retest on top of the latest default branch.

### 2.20 Intake from Linear

**What it is.** Work enters only through Linear, picked up by a routine that polls it.

- The owner files issues and moves them to Ready by asking Claude in a cloud session on the repository. Claude interviews the owner with [`grilling`](#3-skills) and files the issues with [`to-tickets`](#3-skills), each with a type label and acceptance criteria.
- A routine runs every hour, the shortest interval routines allow, takes one Ready issue at a time that nothing unfinished blocks, and follows [`next-step`](#3-skills) for it. It does not check who created or readied the issue ([section 7](#7-open-risks)). *Not checked:* no routine has run yet.
- `next-step` tells the agent to drop zero-width characters and HTML comments from the issue text before reading it. Nothing strips them in code, because routines read Linear through the connector, where a script can't step in.

**Why.**

- Neither Linear nor GitHub issue events can start a routine, and Linear webhooks can't add the token a routine's trigger needs.
- Issue text is the most direct way to inject instructions into the agent. OpenAI's docs use a hidden instruction in a GitHub issue as their example, and GitHub strips hidden characters for its own coding agent.
- One issue at a time keeps sessions from competing for the same usage window.

### 2.21 Linear access

**What it is.** Claude reaches Linear through the claude.ai Linear connector, in the owner's conversations and in routines. GitHub Actions workflows that touch Linear (the quota keeper in [2.25](#225-linear-quota-keeper), the reminders and audits) use a Linear API key stored in the `checks` environment ([2.12](#212-ci-as-the-authority)), which routines never see.

**Why.**

- One connector is the simplest setup. A separate Linear identity for the agents only mattered for checking who filed or approved work, and those checks are left out ([6.2](#62-scoped-out-by-the-owner)).

### 2.22 Asking the owner

**What it is.** When an agent hits a decision it shouldn't make alone, it asks, and never in chat.

- A routine posts the question as a comment on the Linear issue, moves the issue to "Needs input" and picks up other work. An interactive cloud session asks with the Ask tool. *Not checked* from a routine yet.
- The owner asks Claude which issues need input and answers through Claude, which posts the answer as a comment.
- A daily workflow sets a Linear reminder for the owner on each issue that has waited in Needs input for 3 days without an update, so a question can't sit unseen. It is a reminder, not a comment, because the workflow's API key is the owner's, and Linear doesn't notify anyone of their own comments.
- `CLAUDE.md` words its ask-first rules as "comment on the issue and move it to Needs input".
- Typical questions: wording users will read, a new vendor, a product call, or an issue that can be read two ways.

**Why.**

- The old maintainer answered most of the queued questions the same day, and the answers changed what was built. OpenAI's agents also escalate "when judgment is required". The owner reads Linear through Claude, so the queue has a reader again.
- The Ask tool is reported missing in routines, and a routine waiting on an answer would just stop.
- In routines the auto-mode classifier reads `CLAUDE.md`'s ask-first rules. This wording gives it an action it can take, so it doesn't refuse.
- Questions never block a merge or a CI run.

### 2.23 Issue linkage, with the issue copied into the repository

**What it is.** Every PR closes exactly one Linear issue, and the issue's content is kept in the repository.

- The PR uses Linear's magic words ("Closes ABC-12"), so Linear moves the issue to Done on merge. A guard fails a PR that closes no issue, or more than one.
- When work starts, the issue's text and acceptance criteria are copied into the branch's plan file ([2.24](#224-restartable-execution-plans)).

**Why.**

- Without the link nothing ties a change to what the owner asked for, and the task-fit judge ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)) has nothing to compare against.
- Issues are archived soon after merge to stay under Linear's limit ([2.25](#225-linear-quota-keeper)), so the copy keeps the truth in the repository.

### 2.24 Restartable execution plans

**What it is.** Each issue's work has a plan file on its branch, which [`next-step`](#3-skills) creates when work starts and resumes from. It holds the copied issue, progress so far, decisions made and the next step, and a new session must be able to continue from it alone. Acceptance criteria live as JSON, and the agent may only flip each criterion's `passes` field.

**Why.**

- Cloud VMs pause and get reclaimed, and routine runs stop when the subscription's usage window runs out, until it resets. Work will stop mid-task regularly.
- OpenAI's ExecPlan format and Anthropic's guide to long-running agents both build on resuming from disk. Anthropic chose JSON for the criteria because the model is less likely to overwrite it than Markdown.

### 2.25 Linear quota keeper

**What it is.** When a PR merges, a workflow archives its issue through Linear's API, together with every other issue already Done or Canceled, which keeps the count well under the Free plan's 250 unarchived issues. The issue's text is in the repository by then ([2.23](#223-issue-linkage-with-the-issue-copied-into-the-repository)). The team's auto-archive setting stays on as a backstop. The first run archived three Done issues.

**Why.**

- At 250 unarchived issues Linear stops issue creation, which would stop the whole pipeline.
- Archived issues don't count toward the limit, and archiving through the API works (confirmed by the owner).
- Sweeping all closed issues on each merge also catches issues closed without a PR, with no scheduled job. Merges happen far more often than issues pile up.
- Linear's shortest auto-archive period is six months, far too slow to rely on.

### 2.26 Size limits

**What it is.** ESLint's `max-lines`, `max-lines-per-function` and `complexity` rules limit files and functions, and its configuration is a protected path ([2.12](#212-ci-as-the-authority)).

**Why.**

- In the old repository a view file reached 1,009 lines, and a locking mechanism "grew patch by patch" until the maintainer stepped in. Nobody will step in here.
- OpenAI enforces file-size limits as invariants for the same reason.

### 2.27 Weekly claim sweep

**What it is.** A weekly routine follows [`claim-sweep`](#3-skills) to compare what the agent documents say with the code, and opens a PR that fixes stale claims. The PR merges through the same gates as everything else. *Not checked:* the routine hasn't run yet.

**Why.**

- In the old repository the two manual claim sweeps found real drift, and their fixes landed.
- OpenAI runs a recurring doc-gardening agent for the same reason; cleaning up by hand on a fixed day didn't scale for them.

### 2.28 Routine prompts point into the repository

**What it is.** Each routine's prompt is a few lines naming a file to follow, such as `.claude/skills/next-step/SKILL.md` for [`next-step`](#3-skills). The instructions live in the repository, on the `policy` check's protected paths ([2.12](#212-ci-as-the-authority)): the skills under `.claude/skills/`, and the prompts in `docs/agents/routines.md`.

**Why.**

- Routine prompts are configured on claude.ai, outside version control, where nothing diffs or checks them.
- Repository skills are reported not to load in routines, so the routine reads the named file as plain instructions.

### 2.29 One write path, with live updates

**What it is.** The UI has no save buttons and no reloads: edits save as the user types and changes made elsewhere appear by themselves, while PostgreSQL stays the only judge of what is stored.

- Every write is a server function running Kysely in a transaction, so the constraints and triggers of [2.7](#27-invariants-in-the-database-tested-against-the-real-database) decide. It returns the transaction ID (`pg_current_xact_id()`).
- In the browser, [TanStack DB](https://tanstack.com/db) collections apply a write at once and call that server function, debounced for autosave. A write the database refuses rolls back in the UI with an error.
- A trigger sends `pg_notify` with the tenant, table and row of each change. Each Node instance holds one LISTEN connection and streams the events as server-sent events from a streaming server function, with a 25-second keep-alive; Dokploy's Traefik doesn't cut idle streams, and the keep-alive is for other proxies and for clients to notice a dead connection. The client refetches the affected collection, and everything after a reconnect.
- The two-context Playwright test in [2.8](#28-declared-test-seams-swept) proves both directions. A stream through Dokploy's Traefik stayed open for 5 minutes over HTTPS, and LISTEN reconnected by itself about 11 seconds after a database restart. *Not built yet:* this waits for the first feature that writes data.

**Why.**

- One server function per write keeps the database the authority ([2.7](#27-invariants-in-the-database-tested-against-the-real-database)) while the UI updates at once.
- It needs nothing beyond Node and PostgreSQL. Moving to Electric later changes only the client collection, because every write already returns the transaction ID it waits for.
- WebSockets inside TanStack Start are undocumented and reported broken in production builds, so a later feature that needs one, such as realtime voice, gets its own small Node service.
- NOTIFY delivers only on commit, in order, with a payload under 8000 bytes, so it carries keys and the client fetches the rows.

---

## 3. Skills

A skill is a Markdown file of instructions that Claude Code loads when it is called. These are the skills the repository ships, and the pieces in [section 2](#2-must-have-pieces) link here where they use one.

**How they load.**

- They live in one place, `.claude/skills/` in the repository. Skills from other repositories are copied in at a pinned commit and recorded with a hash in a lock file, and so are the hook scripts and agents that come with them (`.claude/hooks/ponytail-*`, `.claude/agents/impeccable-*.md`).
- `.claude/` is a protected path ([2.12](#212-ci-as-the-authority)), so adding or updating a skill needs a `ci-change` issue and goes through the AI review.
- A routine prompt names a skill's file by path, and the routine reads it as plain instructions ([2.28](#228-routine-prompts-point-into-the-repository)).
- The AI review in CI reads its lens files by path from the default branch, so a PR cannot change the lenses that judge it ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)).
- Interactive cloud sessions load the skills directly, for example `/next-step ABC-12`. Intake runs in a cloud session on the repository too, so it uses the same copies and can read the code.
- TanStack's skills ship inside its npm packages, so `make skills` copies the allowlisted ones into `.claude/skills/tanstack-<skill>/`, rewriting their names and relative links, and `scripts/tanstack-skills.ts --check` in `make check-app` keeps the copy equal to the installed version. The lockfile pins them, and `intent hooks install` is never run, because it edits `.claude/settings.json`.
- Two vendored packs run hooks, by the owner's decision of 2026-10-23, set in `.claude/settings.json`:
  - ponytail puts its rules in every session at start, tracks level changes, and puts them in every subagent except impeccable's (`PONYTAIL_SUBAGENT_MATCHER='^(?!impeccable-)'`);
  - impeccable runs its design detector at session start, after each edit and at stop, through `.claude/hooks/impeccable-engine.sh`, which runs its engine binary only at the checksums pinned in the skills lock, because the upstream release it downloads from can be replaced;
  - `.claude/hooks/impeccable-scope.sh` tells an impeccable task that DESIGN.md and impeccable's craft floor set design completeness, and that ponytail governs code structure only.

  `.claude/hooks/test.sh` runs each on sample events. *Not checked:* that cloud sessions have `node` on the path for ponytail's hooks, and that they can download impeccable's engine from GitHub.
- A claude.ai plugin that duplicates a repository skill is turned off in the owner's claude.ai settings, so each skill and hook loads once. The owner removes them.

| Skill | Source | Used in | Role |
|---|---|---|---|
| `next-step` | Rewritten from the old repository | [2.20](#220-intake-from-linear), [2.24](#224-restartable-execution-plans), [2.28](#228-routine-prompts-point-into-the-repository) | The build procedure for one issue (below) |
| `grilling` | [mattpocock/skills](https://github.com/mattpocock/skills) | [2.20](#220-intake-from-linear) | Interviews the owner at intake until the issue is clear |
| `to-tickets` | [mattpocock/skills](https://github.com/mattpocock/skills) | [2.20](#220-intake-from-linear) | Files the issues, each with a type label and acceptance criteria in the shape [2.24](#224-restartable-execution-plans) copies |
| `skeptic-pass` | The old repository | [2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription) | Correctness, regression and security lenses, each looking for a concrete counterexample |
| `code-review` | [mattpocock/skills](https://github.com/mattpocock/skills) | [2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription) | Its spec axis is the basis of the task-fit judge |
| `ponytail-review` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | [2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription) | A lens that asks whether every line is needed, against the review's habit of adding code |
| `agentic-actions-auditor` | [trailofbits/skills](https://github.com/trailofbits/skills) | [2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription) | A lens for PRs that change workflows, `pull_request_target` above all |
| `pr` | [mattpocock/skills](https://github.com/mattpocock/skills) | [2.17](#217-pr-description-contract) | Writes the PR description sections |
| `diagnosing-bugs` | [mattpocock/skills](https://github.com/mattpocock/skills) | [2.13](#213-done-means-seen-working) | Builds a feedback loop before any fix, for bugs and failed deploys |
| `claim-sweep` | The old repository | [2.27](#227-weekly-claim-sweep) | Checks what the agent documents claim against the code |
| `impeccable`, with its four agents | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `ui` flow | Design guidance for UI work; the agents serve its new-work flow in sessions with the owner |
| `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-help`, `ponytail-gain`, with ponytail's hooks | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | Every session | Always-on mode for the smallest complete change, a whole-repository audit, and the `shortcut:` debt ledger |
| `research` | [mattpocock/skills](https://github.com/mattpocock/skills) | [Section 5](#5-maybe) | Writes research notes that cite primary sources |
| `writing-for-agents` | [mattpocock/skills](https://github.com/mattpocock/skills) | [2.5](#25-instruction-layering-with-size-budgets) | Rules for editing `CLAUDE.md`, rule files and skills |
| TanStack's skills for Start, Router and DB | Inside the TanStack npm packages ([TanStack Intent](https://tanstack.com/intent)) | [2.6](#26-strict-static-checks-from-the-first-commit), [2.10](#210-architecture-layers-enforced), [2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription), [2.29](#229-one-write-path-with-live-updates) | TanStack's own rules: code runs on server and browser by default, server-only logic goes in `createServerFn`, types are inferred and never cast, and Next.js patterns are wrong here |

**`next-step`.** Given one Linear issue ID, from a routine or from `/next-step ABC-12`, it runs the issue to an open PR with auto-merge on. It never waits in a session: a question goes to Linear ([2.22](#222-asking-the-owner)) and the routine moves on.

- It starts by copying the issue into the plan file, or resuming from it ([2.23](#223-issue-linkage-with-the-issue-copied-into-the-repository), [2.24](#224-restartable-execution-plans)), and creating the branch.
- The issue's type label picks the flow, so the procedure never guesses:

  | Label | Flow |
  |---|---|
  | `feature` | Tests at a declared seam ([2.8](#28-declared-test-seams-swept)), then the code |
  | `bug` | `diagnosing-bugs`, a failing regression test, the fix, and one line on the wider class of bug |
  | `deploy-failure` (opened by [2.13](#213-done-means-seen-working)) | `diagnosing-bugs` first, then as `bug` |
  | `ui` | As `feature`, then `impeccable` inside the world DESIGN.md sets, an `impeccable audit` of the changed surface, its P0 and P1 findings fixed with the commands it recommends (one that changes the look or the words goes to the owner) and `impeccable polish`, with before and after screenshots of made-up data in the PR; a `feature` that adds or changes a page takes the same steps |
  | `chore`, `docs` | Straight to the end |

- It names each skill by file path, because routines read files, not skill names ([2.28](#228-routine-prompts-point-into-the-repository)). Whatever the label, a change to an agent document follows [`writing-for-agents`](#3-skills), and an unchecked outside fact gets [`research`](#3-skills) notes in the plan folder.
- An issue that an unfinished one blocks waits; intake skips it.
- It ends with `make check`, a description written with `pr`, the PR opened with auto-merge on ([2.19](#219-merging-and-deploying-on-githubs-side)), and up to three rounds of CI fixes ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)).
- It has a character budget like `CLAUDE.md`'s, and the docs-reference guard covers it ([2.5](#25-instruction-layering-with-size-budgets)).

**Why.**

- In the old repository the skeptic pass found the most real defects, the code-review lenses fixed smaller gaps on 13 tickets, and the ponytail review caught over-engineering that review fixes had added.
- The old router went wrong where a hook forced it on every session, it guessed the flow, and it stopped for approval. A label set at intake removes the guess, and Linear and CI hold the gates.
- An audit of the old repository advised keeping impeccable's audit as the review and skipping its full new-work flow, and found the old screenshot rule rarely followed.
- The owner keeps ponytail always on (2026-10-23). The old repository's audit found no measurable effect from the always-on mode, because it had no baseline, and two costs: arbitration with impeccable and a double injection when a plugin copy loaded too. Here the subagent matcher and the scope hook carry the arbitration, and the owner removes the plugin copies.
- Copying skills from the tip of upstream changed them under the old repository twice, once renaming a file and once removing a skill. A pinned copy changes only through a reviewed PR.

---

## 4. Where each check runs

Each stage has a rough time budget, so the fast checks run early and nothing slows the agent down much.

| Stage | Name | Time budget |
|---|---|---|
| 0 | Agent harness (Claude Code hooks) | Instant |
| 1 | Pre-commit | About 10 seconds, staged files only |
| 2 | Pre-push | About 2 minutes |
| 3 | CI: `ci` and `policy` | No limit |
| 4 | Merge queue | CI again, on top of the latest default branch |
| 5 | After merge | Audit, deploy, verify, release, archive |

Stages 1 and 2 run inside the cloud VM too; in a routine run they are *not checked* yet ([2.2](#22-layered-enforcement-pipeline)). Every check also runs in CI, and pre-push runs all of `make check`, so everything from stage 1 runs again at stage 2 on the whole repository; a dot marks the earliest stages where a check runs.

| Check | 0 | 1 | 2 | Later |
|---|---|---|---|---|
| Format each file right after the agent edits it | ● | | | |
| Refuse edits to generated files (regenerate instead) | ● | | | |
| Format and lint the staged files | | ● | | |
| Scan the staged changes for secrets | | ● | | |
| Agent-document references and the `CLAUDE.md` budget | | ● | | |
| Generated files up to date | | | ● | |
| Type check (`tsc --noEmit`), lint with size limits, and a production build | | | ● | |
| Unit tests and pure-function tests | | | ● | |
| Guard self-tests and stack guards | | ● | ● | |
| Layer rules | | | ● | |
| Real-store tests | | | ● | |
| PR title format, PR description sections, one closed issue, commit identity, a test change for every migration | | | | Stage 3 (`policy`) |
| Build every shipped configuration | | | | Stage 3 (`ci`) |
| Guards and protected-path check, loaded from the target branch | | | | Stage 3 (`policy`) |
| AI review and task-fit judge | | | | Stage 3 (`policy`) |
| The full `ci` run on the merge group, with `policy` skipped | | | | Stage 4 |
| Protected-path and ruleset audit | | | | Stage 5 |
| Deploy, smoke test, redeploy the previous tag on failure | | | | Stage 5 |
| Release, tag and release notes | | | | Stage 5 |
| Archive the merged issue and every other closed issue in Linear | | | | Stage 5 |
| Claim sweep | | | | Weekly routine |

**Stage 0** acts before the agent does anything, so it is the cheapest place to stop a mistake. The agent can edit it inside its own session, which is why stage 1 repeats its checks and CI repeats everything.

**Stage 2** is the last check before code leaves the VM, so anything that fits in about two minutes belongs there.

**Stage 3** is the authority, because stages 0 to 2 run where the agent has control. Of its two checks, `policy` is the one a PR cannot rewrite.

---

## 5. Maybe

These depend on what the new repository turns out to contain, or on a live test.

| Piece | Include when | How it works here |
|---|---|---|
| Behaviour evaluations for an AI model, with receipts | The product calls a model | Hash exactly what the model is sent: prompt, tool definitions, model ID and library versions. CI runs the evaluations itself through Claude Code's GitHub Action, with several samples and a pass-rate threshold, and writes the receipt with the run ID. No hand-copied receipts, and no rerunning a failed evaluation until it passes. |
| `shortcut: <the limit>, <when to upgrade>` comments marking deliberate shortcuts | Shortcuts are allowed at all | A CI check fails when their count grows, unless the same PR pays one down. In the old repository the count went from 2 to 42 in nine days, with about 5 paid down. |
| A contract for scripts that change production data: dry run by default, the target must match the environment, an audit line with IDs only | Scripts touch shared or production data | Without the old "reviewed digest" step, because the agent that runs the dry run would supply the digest. |
| A design-token parity test that holds the design document's colours equal to the stylesheet | There is a user interface with a design document | As in the old repository, where it worked. |
| Research notes that cite primary sources with the date each was read | Decisions depend on outside facts, such as law or vendor terms | As in the old repository, where they worked well. [`research`](#3-skills) writes them. |
| Automated dependency update PRs | The gates are trusted to judge them | Update PRs need a Linear issue like any other PR and merge through the same gates; in the old repository the guards refused the update bot's PRs, and the plan to redo them never ran. [Dependabot](https://docs.github.com/en/code-security/dependabot) opens them with conventional titles. Its committer joins the allow-list ([2.15](#215-commit-identity)), and `ci` needs no secrets, because Dependabot's runs get none. |
| OpenTelemetry export from cloud sessions | Telemetry on agent runs is wanted | Set through the cloud environment's variables with a write-only collector token, because the agent can read those variables. |
| Simulated stand-ins for third-party services | The product depends on outside services | Small local servers that behave like the real ones, so integrations get tested without live calls through the network allow-list. |
| A Stop hook that asks for evidence (a command and its output) before a session ends | Agents claim work is done too early | Advisory only: `onFailure` has no effect on Stop hooks, and the agent can edit it. |
| Shadow mode for new guards | New guards are added often | A new guard reports without failing for a set number of runs, then becomes blocking. Anthropic does this with new AI reviewers. |
| Mutation testing | The tests are established and CI time allows it | It breaks the code on purpose, one small change at a time, and checks that some test fails each time, on the modules a PR changed. Thoughtworks recommends it for agent-written tests, which otherwise get trusted on faith. [Stryker](https://stryker-mutator.io/) runs it on TypeScript. |

---

## 6. Excluded

### 6.1 Not brought over from the old repository

| Piece | Why it stays behind |
|---|---|
| Human gates: approval labels, required reviewers, code owners, approval environments, chat approval prompts | The owner works at intake and in production, not in review. The one exception is questions through Linear ([2.22](#222-asking-the-owner)), which never block a merge. |
| Gates passed by the author's own word: a PR section standing in for proof a review ran, agent-set "ready" labels, hand-copied receipts, self-reported usage, self-reviewed digests | The author alone could satisfy each ([section 1](#1-principles-carried-over)). |
| Soft rules marked "no check yet" | They are the rules that drifted ([2.4](#24-every-rule-maps-to-a-check)). |
| Line-count caps on documents | Met by writing 1,489-character lines. Characters or words instead. |
| Guard code that runs from the PR it judges | Lets a PR rewrite its own judge. The guards run inside `policy` instead ([2.3](#23-guard-framework), [2.12](#212-ci-as-the-authority)). |
| Merging with zero review as the only defence | Replaced by the AI review, the task-fit judge and the protected-path check, which are still weaker than a person ([section 7](#7-open-risks)). |
| Agents acting under a person's identity, and hiding that code was AI-written | The history stops showing who did what. Commits come from Claude with the session trailer ([2.15](#215-commit-identity)). |
| An always-on "minimal code" persona injected into every session, plus five stacked skill packs that need rules about which one wins | Its effect could not be measured. It was injected twice in some sessions and used up space in the root instructions. |
| Vendoring agent skills from `@latest` or the tip of a repository, and stripping the flags that stop the agent running some skills on its own | An unpinned supply chain for the agent's instructions. Copied skills are pinned and their upstream changes reviewed like code ([section 3](#3-skills)). |
| A usage gate tied to one vendor's harness | Only ever trialled, it relied on readings the agent reported itself, and has been inactive since. |
| An empty registry of scheduled agents | It documented something that did not exist. Add a registry with the first scheduled routine. |
| A decision log in files, with a format guard | 737 lines in ten days and constant conflicts. The squash commit message carries each PR's reasoning instead ([2.16](#216-decision-records-for-memory-bounded)). |
| Branch-name conventions | Some runtimes cannot follow them, and nothing checked them. Conventional commits carry the intent ([2.18](#218-conventional-commits-semantic-versions-and-release-notes)). |
| Deploying on merge without waiting for CI | Shipped a red default branch 11 times. |
| Rerunning a failed test or evaluation until it passes | Hides real flakiness. A failure stays a failure and opens a Linear issue. |
| A per-edit ticket hook with a session marker file | High friction, seven fix PRs in a week, and the value sits in the CI check ([2.23](#223-issue-linkage-with-the-issue-copied-into-the-repository)). |

### 6.2 Scoped out by the owner

| Piece | Note |
|---|---|
| Holdout acceptance scenarios (end-to-end checks kept where the coding agent can't see or edit them) | They were the main answer to the reviewer sharing the author's blind spots, so that risk stays open ([section 7](#7-open-risks)). |
| Spending limits | The subscription's usage windows still pause the work when they run out ([2.24](#224-restartable-execution-plans)). |
| A paid Anthropic API key for the CI checks | One subscription only, which leaves [2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription) exposed to the token risk. |
| Paid GitHub or Linear plans | This drives the public repository ([2.12](#212-ci-as-the-authority)) and the quota keeper ([2.25](#225-linear-quota-keeper)). |
| A custom GitHub App | Not trusted: its private key never expires on its own and acts as the app until revoked. The agent turns on auto-merge through Claude's GitHub connection instead ([2.19](#219-merging-and-deploying-on-githubs-side)). |
| Human commits, merge approvals and code review | The owner works at intake and in production. |
| Checks on who filed, readied or flagged work in Linear, including a separate Linear identity for the agents | Accepted risk, as twentyhq/twenty accepts its own: a routine could create or ready its own work, or set `ci-change`. The audit on every merge ([2.12](#212-ci-as-the-authority)) notices protected-path changes afterwards ([section 7](#7-open-risks)). |
| A GitHub identity for the agent that cannot write workflow files | It would stop a PR adding a fake `policy` job, but Claude's GitHub App has workflow write access, which an installer can't lower, and running cloud sessions without it is untested. |

### 6.3 Not available on these plans

| Piece | Why |
|---|---|
| Rulesets, merge queue and auto-merge on a private repository | GitHub Free offers them for public repositories only, and the merge queue only for organization-owned ones. |
| Organization rulesets and required workflows | GitHub Team or Enterprise only. The `policy` check ([2.12](#212-ci-as-the-authority)) replaces them. |
| Server-managed Claude Code settings | Claude Team or Enterprise only, which is why changes to the agent's configuration are blocked in CI ([2.12](#212-ci-as-the-authority)). |
| Push rules that block changes to workflow files | GitHub Team plan, private repositories only. The `policy` check's protected paths ([2.12](#212-ci-as-the-authority)) do this job instead. |
| Claude Code Review | Claude Team or Enterprise only, and its check never fails anyway. |
| A closed permission mode (`dontAsk` or bypass) in cloud | Cloud sessions offer Accept edits, Plan and Auto, and routines don't let you pick a mode. |
| The Ask tool in routines | Reported missing, so routines ask through Linear ([2.22](#222-asking-the-owner)). |
| Starting routines from Linear or GitHub issue events | Not supported, so intake polls ([2.20](#220-intake-from-linear)). |
| Routines publishing a check result to GitHub | Only GitHub Apps can create check runs, and Claude's app can only read commit statuses, so the AI checks run as a GitHub Action ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)). |
| A separate network phase for the setup script | The setup script runs at the same network level as the session. |
| Archiving by hand in Linear's app, or auto-archive under six months | Neither is offered, so archiving goes through the API ([2.25](#225-linear-quota-keeper)). |

### 6.4 Left out for other reasons

| Piece | Why |
|---|---|
| Instruction files for other agent tools, and an `AGENTS.md` pointer | Claude Code is the only harness. |
| A GitHub bot identity or machine account | Cloud commits use the GitHub user connected to the Claude account, and the consumer terms bar sharing account credentials. Claude's identity and the session trailer cover provenance ([2.15](#215-commit-identity)). |
| Reviewers that learn from PR comments | The author agent could teach the reviewer to stop flagging things ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)). |
| Relying on the skill loader inside routines | It is reported not to load repository skills there, so routines read skill files by path ([2.28](#228-routine-prompts-point-into-the-repository)). |
| Docker in the cloud VM as a requirement | Unproven there. CI is where it has to work. |
| Dokploy's preview deployments | Dokploy builds them from the PR with the app's settings, which on a public repository would skip the attested image and the green default branch ([2.13](#213-done-means-seen-working)). |
| Factory's agent-readiness score, "prefer boring tech", and a quality score per area of the code | Too vague to turn into a check. |
| A guard that refuses weakened guards (the old ratchet) | The guards and their fixtures are protected paths in `policy` ([2.12](#212-ci-as-the-authority)), which does the same job with no extra code. |
| A list of shell commands the harness refuses, and per-hook failure settings | Hooks are only fast feedback, and CI refuses everything they would ([2.2](#22-layered-enforcement-pipeline)). |
| Commit-message hooks and checks on every commit | Squash merges keep only the PR title, which `policy` checks ([2.18](#218-conventional-commits-semantic-versions-and-release-notes)). |
| Baselines for strict-mode opt-outs, suppressions, document sizes and file sizes | A new repository starts at zero. Opt-outs are banned, and the linter's own rules set the limits ([2.6](#26-strict-static-checks-from-the-first-commit), [2.26](#226-size-limits)). |
| Matching a migration's test to the object it creates | The simpler "a migration PR changes a test" held for every migration in the old repository, and the AI review checks the fit ([2.7](#27-invariants-in-the-database-tested-against-the-real-database)). |
| A guard that every source path maps to a test seam | One rule in `CLAUDE.md`, enforced by the AI review, covers the gap that caused the old outage ([2.8](#28-declared-test-seams-swept)). |
| Comparing error rates with the previous release after a deploy | Needs telemetry the project doesn't have yet. The smoke test and redeploy cover the outage case ([2.13](#213-done-means-seen-working)). |
| A reminder before the CI token expires | An expired token fails the checks, so PRs stall visibly once a year ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)). |
| Scheduled jobs for the protected-path audit and Linear archiving | They follow merges, so nothing depends on a daily job ([2.12](#212-ci-as-the-authority), [2.25](#225-linear-quota-keeper)). The ruleset check does run daily, since its drift doesn't come from a merge. |

---

## 7. Open risks

These remain after everything above.

- **Accepted, as twenty accepts it: the agent can approve its own changes.** Nothing checks who created or readied a Linear issue or set `ci-change`, so a routine, or text injected into an issue, could start its own work or unlock the protected paths. A PR could also add its own workflow with a passing job named `policy`, because the required check pins only to GitHub Actions as a whole. The audit on every merge ([2.12](#212-ci-as-the-authority)) reports protected-path changes right after they land; nothing prevents them.
- **A reviewer with the author's blind spots.** The AI review and the task-fit judge may share blind spots with the agent that wrote the code. Holdout scenarios were the answer and are scoped out. A different model for review is worth considering if the subscription offers one.
- **The CI checks' token.** The AI checks run on a subscription token. It works with an individual-plan token, and other users have open 401 reports ([2.11](#211-ai-review-and-task-fit-judge-run-by-ci-on-the-subscription)). If it fails for long, PRs stall, and the fallback verdict is one the author could forge.
- **Usage windows.** Building, the AI checks and the weekly claim sweep all draw on the same subscription limits. When a window runs out everything pauses, including the checks that would let finished work merge.
- **Unattended use of a consumer plan.** The consumer terms only clearly allow automated access through an API key. Routines look permitted, since they are sold on Pro and Max; the subscription token in CI is less clear.
- **Correct code that is the wrong call.** The owner answers the questions that reach Linear ([2.22](#222-asking-the-owner)), but an agent can still make a product decision without recognising it as one.
- **The GitHub connection's rights.** If the account behind Claude's GitHub connection owns the organization ([2.14](#214-permissions-and-network-replace-stop-and-ask)), an agent, or text injected into an issue or PR, could turn off the ruleset or change repository settings and then merge without the checks, and the audit on every merge only notices afterwards. Connecting an account that is only a writer on the repository might close this; the owner accepted the risk rather than test it (2026-10-23).
- **Deploy access.** The Dokploy panel faces the internet so GitHub's runners can reach its API, and the deploy user can read and write the app's environment variables, so a leaked deploy key exposes this app's secrets ([2.14](#214-permissions-and-network-replace-stop-and-ask)).
- **Backups.** Dokploy backs up PostgreSQL with `pg_dump`, so a restore loses everything since the last dump, and no free storage target for the dumps is chosen yet.
- **Young dependencies.** TanStack DB is in beta and TanStack Intent in alpha. Both are pinned, and their upgrades pass the same gates as any change.
- **The platform's behaviour.** Several pieces rest on behaviour that is undocumented and was only seen in live tests, and Claude Code, routines and GitHub Actions can change without notice.
