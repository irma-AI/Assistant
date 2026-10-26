# Reading production logs

Production logs are in VictoriaLogs at `https://logs.petterannerwall.se/select/vmui/`. A session reaches it through its network proxy, which adds a read-only user. The log format and the events are in `docs/observability.md`.

The app is `{service="assistant-u5wrvv"}`. Every request but the deploy's health check writes one `event:request` line with `request_id`, `method`, `route` (the pattern, never the path), `status`, `duration_ms`, `db_ms`, `outside_ms`, `calls`, `user_id`, `org_id` and `outcome`; the response carries the same id in `x-request-id`. Step and event lines share the `request_id`. The events are listed in `src/server/log.server.ts`. The `client` stream is planned (IRM-194). The app's `service` field is its `SERVICE_NAME`, which the deployment sets to the container name.

## Quote events, never lines

An issue, PR or comment holds an `event`, a count, a time range and `request_id`s. A log line is never pasted: it may carry `user_id`, `org_id` or text from outside, and the repository is public.

## Queries

Last hour of errors, newest first:

```text
{service="assistant-u5wrvv"} level:error _time:1h | sort by (_time desc) | limit 50
```

Request count, error count and p95 latency per route:

```text
{service="assistant-u5wrvv"} event:request _time:1h | stats by (route) count() as requests, count() if (status:>=500) as errors, quantile(0.95, duration_ms) as p95_ms
```

Rejected requests (401 and 403) per route:

```text
{service="assistant-u5wrvv"} event:request (status:401 OR status:403) _time:24h | stats by (route) count() as n
```

The query text follows VictoriaLogs' LogsQL docs; check an unfamiliar pipe there before relying on it.
