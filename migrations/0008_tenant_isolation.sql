set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- The app's restricted role: no ownership, no BYPASSRLS, so row level security binds it. A role is cluster-wide,
-- so create it only when missing. It cannot log in here; deployment gives it a login and a password.
do $$ begin
  if not exists (select from pg_roles where rolname = 'assistant_app') then
    create role assistant_app nologin nobypassrls;
  end if;
end $$;

grant usage on schema public to assistant_app;

-- The organisation of the current transaction, set by inOrganisation. Unset gives null, and
-- `organisation_id = current_organisation_id()` is then never true, so a missing setting sees no rows.
create function current_organisation_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.organisation_id', true), '')::uuid
$$;

grant execute on function current_organisation_id() to assistant_app;
