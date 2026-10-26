set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- A user's own address for notices, confirmed with a link before anything is sent to it. Changing the address
-- clears email_verified_at. Account deletion removes the row and with it both columns.
alter table users add column email text;
alter table users add column email_verified_at timestamptz;

-- A pending confirmation: SHA-256 of the link's token, the address it confirms and when it stops working. The row is
-- deleted when used, so a link works once.
create table email_confirmations (
  token_hash bytea primary key,
  user_id uuid not null references users (id) on delete cascade,
  email text not null check (length(email) <= 254),
  expires_at timestamptz not null
);
create index email_confirmations_user_id_idx on email_confirmations (user_id);

-- What happened in an organisation. Who sees it follows from the type's permission in the code, so a role change
-- takes effect at once. The payload holds no personal data beyond what a recipient may already see.
create table notification_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  type text not null check (length(type) between 1 and 50),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (id, organisation_id)
);
create index notification_events_organisation_id_idx on notification_events (organisation_id, created_at desc);

create table notification_reads (
  event_id uuid not null,
  organisation_id uuid not null,
  user_id uuid not null references users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (event_id, organisation_id) references notification_events (id, organisation_id) on delete cascade
);
create index notification_reads_user_id_idx on notification_reads (user_id);
create index notification_reads_organisation_id_idx on notification_reads (organisation_id);

-- One email to one member. last_error is a short code, never the server's message, which can name the address.
create table notification_deliveries (
  event_id uuid not null,
  organisation_id uuid not null,
  user_id uuid not null references users (id) on delete cascade,
  -- A small count; bigint would reach Node as a string.
  -- squawk-ignore prefer-bigint-over-int
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text check (length(last_error) <= 100),
  primary key (event_id, user_id),
  foreign key (event_id, organisation_id) references notification_events (id, organisation_id) on delete cascade
);
create index notification_deliveries_user_id_idx on notification_deliveries (user_id);
create index notification_deliveries_pending_idx on notification_deliveries (organisation_id, next_attempt_at)
  where sent_at is null and failed_at is null;

-- Which channels a user turned off per event type; no row means the default. In-app is always on, so only email is stored.
create table notification_preferences (
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (length(type) between 1 and 50),
  email boolean not null,
  primary key (user_id, type)
);

alter table notification_events enable row level security;
alter table notification_events force row level security;
create policy tenant on notification_events
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

alter table notification_reads enable row level security;
alter table notification_reads force row level security;
create policy tenant on notification_reads
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

alter table notification_deliveries enable row level security;
alter table notification_deliveries force row level security;
create policy tenant on notification_deliveries
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

grant select, insert, update, delete on notification_events to assistant_app;
grant select, insert, update, delete on notification_reads to assistant_app;
grant select, insert, update, delete on notification_deliveries to assistant_app;
