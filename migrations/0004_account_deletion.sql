set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- A login attempt is either a login or a fresh BankID confirmation that the person wants the account deleted.
alter table login_attempts
  add column purpose text not null default 'login' check (purpose in ('login', 'delete'));

-- IDs of deleted accounts and when, with no other data, so restoring a backup can delete them again.
create table deleted_users (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);
