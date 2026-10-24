set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- One row per BankID login in progress, tied to the browser by the id in its HttpOnly cookie.
-- Deleted when the order completes, fails or is cancelled, and by a sweep every 15 minutes for any older than 30 minutes.
create table login_attempts (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null,
  qr_start_token text not null,
  qr_start_secret text not null,
  nonce text,
  end_user_ip text not null,
  created_at timestamptz not null default now(),
  last_collect_at timestamptz
);

create index login_attempts_created_at_idx on login_attempts (created_at);
