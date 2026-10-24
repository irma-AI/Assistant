set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- pnr_hmac is HMAC-SHA256 of the personal identity number: login can find the user again,
-- and nothing here decrypts to the number. Null for demo users.
create table users (
  id uuid primary key default gen_random_uuid(),
  pnr_hmac bytea unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- token_hash is SHA-256 of the opaque token the client holds.
create table sessions (
  token_hash bytea primary key,
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('web', 'app', 'demo')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index sessions_user_id_idx on sessions (user_id);
