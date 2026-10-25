set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Only the SHA-256 of the link's token is stored. created_by has no foreign key, like audit_events, so a
-- deleted account leaves the invite intact. Deleting a role takes its pending invites with it.
create table invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  role_id uuid not null,
  created_by uuid not null,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  foreign key (role_id, organisation_id) references roles (id, organisation_id) on delete cascade
);

create index invites_organisation_id_idx on invites (organisation_id);
create index invites_role_id_idx on invites (role_id, organisation_id);
