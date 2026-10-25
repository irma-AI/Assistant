set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- The app's restricted role: no ownership, no BYPASSRLS, so row level security binds it. A role is cluster-wide,
-- so create it only when missing. Migrations of different databases can run at once, and the second create waits on
-- the first's open transaction, so retry until the role is visible. It cannot log in here; deployment gives it a
-- login and a password.
do $$
declare tries int := 0;
begin
  loop
    exit when exists (select from pg_roles where rolname = 'assistant_app');
    begin
      create role assistant_app nologin nobypassrls;
      exit;
    exception
      when duplicate_object or unique_violation then exit;
      when lock_not_available then
        tries := tries + 1;
        if tries >= 3 then raise; end if;
        perform pg_sleep(0.2);
    end;
  end loop;
end $$;

grant usage on schema public to assistant_app;

-- The organisation of the current transaction, set by inOrganisation. Unset gives null, and
-- `organisation_id = current_organisation_id()` is then never true, so a missing setting sees no rows.
create function current_organisation_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.organisation_id', true), '')::uuid
$$;

grant execute on function current_organisation_id() to assistant_app;
