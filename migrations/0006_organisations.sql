set local lock_timeout = '1s';
set local statement_timeout = '5s';

create table organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

-- Permissions are strings from the code list, roles are data. The unique (id, organisation_id) is the target
-- of memberships' composite foreign key, so a member's role must belong to the same organisation.
create table roles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  name text not null check (length(name) between 1 and 50),
  kind text not null check (kind in ('owner', 'custom')),
  permissions text[] not null default '{}',
  unique (organisation_id, name),
  unique (id, organisation_id)
);

-- Exactly one Ägare role per organisation.
create unique index roles_one_owner_idx on roles (organisation_id) where kind = 'owner';

create table memberships (
  user_id uuid not null references users (id),
  organisation_id uuid not null references organisations (id) on delete cascade,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, organisation_id),
  foreign key (role_id, organisation_id) references roles (id, organisation_id)
);

create index memberships_role_id_idx on memberships (role_id);
