set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Bank accounts of an organisation, the transactions imported into them, and one batch row per import.
-- A transaction is immutable once imported (the trigger holds for any login); IRM-147 adds the link to a posted entry.
create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  title text not null check (length(title) between 1 and 100),
  created_at timestamptz not null default now()
);

create index bank_accounts_organisation_id_idx on bank_accounts (organisation_id);

create table bank_imports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  bank_account_id uuid not null references bank_accounts (id) on delete cascade,
  file_name text not null check (length(file_name) between 1 and 255),
  format text not null,
  -- squawk-ignore prefer-bigint-over-int
  added integer not null default 0,
  -- squawk-ignore prefer-bigint-over-int
  skipped integer not null default 0,
  created_at timestamptz not null default now()
);

create index bank_imports_account_idx on bank_imports (bank_account_id, created_at desc);

-- amount_ore is signed: money in is positive. dedup_key is the bank's own ID, or a hash when the file has none.
create table bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  bank_account_id uuid not null references bank_accounts (id) on delete cascade,
  bank_import_id uuid not null references bank_imports (id) on delete cascade,
  bank_id text,
  dedup_key text not null,
  amount_ore bigint not null,
  booking_date date not null,
  value_date date,
  counterparty text,
  reference text,
  source text not null check (source in ('file', 'sync')),
  created_at timestamptz not null default now(),
  unique (bank_account_id, dedup_key)
);

create index bank_transactions_account_idx on bank_transactions (bank_account_id, booking_date desc);
create index bank_transactions_import_idx on bank_transactions (bank_import_id);

alter table bank_accounts enable row level security;
alter table bank_accounts force row level security;
create policy tenant on bank_accounts
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

alter table bank_imports enable row level security;
alter table bank_imports force row level security;
create policy tenant on bank_imports
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

alter table bank_transactions enable row level security;
alter table bank_transactions force row level security;
create policy tenant on bank_transactions
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

-- No update or delete on transactions; an import row is updated once, with its counts.
grant select, insert on bank_accounts to assistant_app;
grant select, insert, update on bank_imports to assistant_app;
grant select, insert on bank_transactions to assistant_app;

create function bank_transactions_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from organisations where id = old.organisation_id) then
    return old; -- the organisation itself is being deleted
  end if;
  raise exception 'bank transaction % is immutable', old.id using errcode = 'restrict_violation';
end $$;

create trigger bank_transactions_guard before update or delete on bank_transactions
  for each row execute function bank_transactions_guard();
