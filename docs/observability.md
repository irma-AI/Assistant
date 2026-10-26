# Observability

How the app logs, what is measured from the logs and how an alert reaches its owner. Decided with the owner on 2026-10-25 (IRM-137). Logs are the only signal: metrics and alerts are queries over them.

## Where logs go

Vector ships the stdout and stderr of the app and database containers to VictoriaLogs (Dokploy compose `logs`). Logs are kept 14 days (revisit: first customer, or a bug that needed older logs) and grouped by the `service` stream field. The stream field `service` is the container name (`assistant-u5wrvv` for the app) and the app's own `service` field is its `SERVICE_NAME` environment variable (default `app`), so the deployment sets `SERVICE_NAME` to the container name; the examples below write `app` for it. People read them in the VictoriaLogs UI behind Pocket ID; agents use a read-only user. LogsQL examples are in `docs/agents/logs.md`.

Traefik's access log stays off: the app's own summary line covers traffic without IP addresses (GDPR data minimisation).

## Alerts

An alert is actionable, owned, specific and low noise. Anything that fails one of these is a dashboard query or a digest line.

Every rule states five fields, held as the rule's labels in vmalert, except Message, which is its annotation:

| Field | Meaning |
|---|---|
| Owner | `agent` or `owner`, who maintains the rule and responds |
| Name | the affected service or component |
| Environment | `production`, `staging` |
| Severity | `critical`, `error` or `warning` |
| Message | what the reader needs, including what to do |

A rule without an action and an owner is a saved query, not an alert.

**Severity.**

| Severity | Meaning | Delivery |
|---|---|---|
| Critical | Users can't reach the app or log in: app down, database unreachable, BankID failing for everyone | Urgent Linear issue, acted on at once; Linear's app pushes it to the owner's phone |
| Error | One feature fails, or unhandled errors appear | Linear issue, same or next working day |
| Warning | Degraded but working: slow responses, migrations ahead of the code, fake BankID in production | Daily digest, never a notification |

**Ownership follows what the fix needs.** The agent owns every alert whose fix is code, at every severity: it reads production logs and ships the fix as a PR through the merge queue, so a code incident takes at least one merge cycle (accepted). Each such alert becomes a Linear `bug` with the `incident` label in Ready, and intake takes `incident` issues before the oldest Ready one. The owner owns alerts whose fix is infrastructure (server, Dokploy, database container, disk, TLS, network); those issues are assigned to the owner. A critical agent-owned alert is both an Urgent issue and in Ready.

**Engine.** vmalert runs LogsQL rules against VictoriaLogs, the same stack. Repeated identical errors are grouped in the rule (by `event` and `route`), never deduplicated in the logs, so one incident makes one issue.

**No outside uptime check until go-live** (IRM-94; IRM-106 blocks it). Accepted risk: a whole-server outage raises nothing, because vmalert runs on that server; the next deploy's smoke test or a person sees it. Revisit: go-live.

Examples:

```yaml
- alert: AppErrors
  expr: '{service="app", level="error"} | stats count() as n | filter n:>0'
  for: 5m
  labels:
    owner: agent
    name: app
    environment: production
    severity: error
  annotations:
    message: >-
      Unhandled errors in the app. Group by event and route, find the first
      request_id in docs/agents/logs.md, reproduce, fix by PR.

- alert: LoginFailingForAll
  expr: '{service="app", event="login"} | stats count() if (outcome:failed) as failed, count() if (outcome:ok) as ok | filter failed:>10 ok:0'
  for: 10m
  labels:
    owner: agent
    name: bankid-login
    environment: production
    severity: critical
  annotations:
    message: >-
      More than 10 failed logins in 10 minutes and not one success. Check
      bankid.* step lines for the outside call result; fix by PR, or tell the
      owner if BankID itself is down.

- alert: DatabaseUnreachable
  expr: '{service="app", event="db_error"} | stats count() as n | filter n:>0'
  for: 2m
  labels:
    owner: owner
    name: assistant-db
    environment: production
    severity: critical
  annotations:
    message: >-
      The app cannot reach the database. Check the assistant-db container,
      disk and Dokploy on the server.

- alert: SlowResponses
  expr: '{service="app", event="request"} | stats quantile(0.95, duration_ms) as p95 | filter p95:>1500'
  for: 30m
  labels:
    owner: agent
    name: app
    environment: production
    severity: warning
  annotations:
    message: >-
      p95 request time over 1.5 s for 30 minutes. In the daily digest; find the
      slowest routes and the db_ms share on the summary line.
```

The expressions show the shape; the build issue fixes the final LogsQL.

## Log lines

One JSON object per line on stdout, written by a small helper in `src/server/`, with no logging library and no vendor.

**Fields.** `time`, `level`, `service` (`app`, `client`), `env`, `event`, `msg`, `request_id`, `method`, `route`, `status`, `duration_ms`, `user_id`, `org_id`, `outcome`, and `error.name`, `error.message`, `error.stack`. `event` is one specific name per kind of event, from a fixed list in code. On an `error` line `msg` says what to check.

**Levels mirror severity.**

- `error`: someone must act. An `error` line that needs no action is a bug in the logging: downgrade it.
- `warn`: unexpected but handled.
- `info`: normal operation.
- `debug` is never on in production.

### What is logged

1. **One summary line per request** (a canonical log line), written when it finishes: `route`, `status`, `duration_ms`, `request_id`, `user_id`, `org_id`, `outcome`, the time spent on the database and on outside calls, and each outside call's name and result. Every request, not only `/api/`; `/version` is skipped. Queries and alert rules read this line first, and the four golden signals (rate, errors, latency, saturation) come from it as LogsQL stats; there is no separate metrics stack (revisit: when log volume makes stats queries slow).
2. **Step lines** at `info`, carrying the same `request_id`: session resolved, permission decision, each outside call (BankID, later Skatteverket and the bank) and each write transaction. Never a line per function or inside a loop. Accepted risk: more volume, small today; revisit: when VictoriaLogs storage or query time strains, move step lines to `debug`.
3. **A diverging path** (denied, fallback, retry, cancelled) is a field on the summary line (`outcome: "denied"`, `bankid: "cancelled"`, `retries: 2`) and on the step line for that step, never a line at every branch.
4. **Separate event lines**, only for work outside a request (start-up, shutdown, migrations and jobs, one line each when they finish) and for OWASP's always-log events: login success and failure, access-control failure, input validation failure, session tampering, data export and import.
5. **Unhandled errors** are logged once, by the code that handles them: log or throw, never both.
6. **Errors from the phone app and the browser** reach the logs through a small rate-limited `/api/v1/client-errors` endpoint. It accepts only error name, message, stack, route pattern and app version, with no personal data and no vendor; the line's `service` is `client`.

Not logged: clicks and screen views (that is analytics), and high-risk actions, which go to the audit table. Logs run the service; the audit table records who did what.

### Correlation

Each request gets a `request_id`, sent back as the `x-request-id` header and shown on error screens, so a user's report leads to the exact lines.

### Personal data

Personal data never enters a log call; it is not redacted afterwards.

- `route` is the route pattern (`/api/v1/invites/:token`), never the raw path, because invite tokens sit in paths.
- The only people in a line are the internal `user_id` and `org_id`. Never a name, personnummer, token or full IP address. They are pseudonymous personal data, listed in `docs/privacy/records.md` and kept 14 days.
- Outside text (user input, error messages from other services) is cut to a fixed length.
- The test in `login.server.test.ts` (IRM-100) extends to every new event.

## Sources

Google SRE book, "Monitoring Distributed Systems"; OpenTelemetry Logs Data Model; OWASP Logging Cheat Sheet; Stripe, "Canonical log lines" (2019); VictoriaLogs docs, vmalert integration; GDPR Art. 5(1)(c).
