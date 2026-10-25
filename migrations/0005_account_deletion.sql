set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- A login attempt is either a login or a fresh BankID confirmation that the person wants the account deleted.
alter table login_attempts
  add column purpose text not null default 'login' check (purpose in ('login', 'delete'));
