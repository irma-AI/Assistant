set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- BankID orders last 30 seconds, so a QR login places a new order before the last one ends, until qr_until.
-- order_at is when the current order was placed: the QR data counts seconds from it.
alter table login_attempts
  add column order_at timestamptz not null default now(),
  add column qr_until timestamptz not null default now() + interval '5 minutes';
