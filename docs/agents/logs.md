# Reading production logs

Production logs are in VictoriaLogs at `https://logs.petterannerwall.se/select/vmui/`. A session reaches it through its network proxy, which adds a read-only user. The log format and the events are in `docs/observability.md`.

The app is `{service="assistant-u5wrvv"}`. Today it writes one line per API request: `event:http_request`, `level`, `method`, `path`, `status` and `duration_ms`. `request_id`, `route`, `user_id`, `outcome`, the `client` stream and the other events in `docs/observability.md` are planned (IRM-193) and not in the logs yet; the queries below use only what exists.

## Quote events, never lines

An issue, PR or comment holds an `event`, a count, a time range and `request_id`s. A log line is never pasted: it may carry `user_id`, `org_id` or text from outside, and the repository is public.

## Queries

Last hour of errors, newest first:

```text
{service="assistant-u5wrvv"} level:error _time:1h | sort by (_time desc) | limit 50
```

Request count, error count and p95 latency per path:

```text
{service="assistant-u5wrvv"} event:http_request _time:1h | stats by (path) count() as requests, count() if (status:>=500) as errors, quantile(0.95, duration_ms) as p95_ms
```

Rejected requests (401 and 403) per path:

```text
{service="assistant-u5wrvv"} event:http_request (status:401 OR status:403) _time:24h | stats by (path) count() as n
```

The query text follows VictoriaLogs' LogsQL docs; check an unfamiliar pipe there before relying on it.
