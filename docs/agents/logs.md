# Reading production logs

Production logs are in VictoriaLogs at `https://logs.petterannerwall.se/select/vmui/`. A session reaches it through its network proxy, which adds a read-only user. The log format and the events are in `docs/observability.md`.

Today the `service` stream field is the container name (`{service="assistant-u5wrvv"}` for the app); the queries below say `app` and `client` as `docs/observability.md` plans.

## Quote events, never lines

An issue, PR or comment holds an `event`, a count, a time range and `request_id`s. A log line is never pasted: it may carry `user_id`, `org_id` or text from outside, and the repository is public.

## Queries

Last hour of errors, newest first:

```text
{service="app"} level:error _time:1h | sort by (_time desc) | limit 50
```

Everything one request did, from a `request_id` in a user's report:

```text
{service=~"app|client"} request_id:"<id>" | sort by (_time)
```

Error count by event and route:

```text
{service="app"} level:error _time:24h | stats by (event, route) count() as n | sort by (n desc)
```

Request rate, error rate and p95 latency per route (summary lines):

```text
{service="app"} event:request _time:1h | stats by (route) count() as requests, count() if (status:>=500) as errors, quantile(0.95, duration_ms) as p95_ms
```

Denied requests and failed logins:

```text
{service="app"} (outcome:denied OR event:login outcome:failed) _time:24h | stats by (event, route) count() as n
```

Browser and phone app errors:

```text
{service="client"} level:error _time:24h | stats by (error.name, route) count() as n
```

The query text follows VictoriaLogs' LogsQL docs; check an unfamiliar pipe there before relying on it.
