set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Who did what, when and from where. user_id is internal and has no foreign key so the row outlives the user;
-- ip is truncated by the writer (IPv4 /24, IPv6 /48). prev_hash and hash chain the rows so a removed or
-- edited row shows up in a verification pass.
create table audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  session_kind text check (session_kind in ('web', 'app', 'demo')),
  event text not null,
  ip text,
  detail jsonb not null default '{}',
  prev_hash bytea,
  hash bytea not null
);

create index audit_events_at_idx on audit_events (at);

-- One writer at a time, so the chain has no forks.
create function audit_events_chain() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('audit_events'));
  select hash into new.prev_hash from audit_events order by id desc limit 1;
  new.hash := sha256(convert_to(
    concat_ws('|', coalesce(encode(new.prev_hash, 'hex'), ''), new.at::text, coalesce(new.user_id::text, ''),
      coalesce(new.session_kind, ''), new.event, coalesce(new.ip, ''), new.detail::text), 'UTF8'));
  return new;
end $$;

create trigger audit_events_chain before insert on audit_events
  for each row execute function audit_events_chain();

-- Only the retention job sets audit.retention, inside its own transaction. The database owner can still bypass this.
create function audit_events_append_only() returns trigger language plpgsql as $$
begin
  if current_setting('audit.retention', true) = 'on' and tg_op = 'DELETE' then
    return old;
  end if;
  raise exception 'audit_events is append-only';
end $$;

create trigger audit_events_append_only before update or delete on audit_events
  for each row execute function audit_events_append_only();
create trigger audit_events_no_truncate before truncate on audit_events
  for each statement execute function audit_events_append_only();
