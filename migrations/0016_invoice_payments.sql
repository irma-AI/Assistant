set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Payment watch (IRM-149): an incoming bank payment suggested for an invoice, then confirmed or rejected by a person.
-- Nothing is booked until it is confirmed; the settlement voucher is recorded on the confirmed row.
create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  invoice_id uuid not null,
  bank_transaction_id uuid not null references bank_transactions (id) on delete cascade,
  status text not null check (status in ('suggested', 'confirmed', 'rejected')),
  -- Whole öre of the invoice this payment settles. The payment's own amount is the transaction's; any more is an overpayment.
  covers_ore bigint not null check (covers_ore > 0 and covers_ore < 1000000000000000),
  -- squawk-ignore prefer-bigint-over-smallint
  pass smallint not null check (pass between 1 and 4),
  confidence numeric(3, 2) not null check (confidence between 0.70 and 1),
  reason text not null check (length(reason) between 1 and 200),
  voucher_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (invoice_id, bank_transaction_id),
  foreign key (organisation_id, invoice_id) references invoices (organisation_id, id) on delete cascade,
  foreign key (organisation_id, voucher_id) references vouchers (organisation_id, id) on delete restrict,
  check ((status = 'confirmed') = (voucher_id is not null))
);

-- squawk-ignore require-concurrent-index-creation
create index invoice_payments_transaction_idx on invoice_payments (bank_transaction_id);

-- One row per notice already sent about an invoice, so a job that runs twice tells nobody twice.
create table invoice_watch (
  invoice_id uuid not null,
  organisation_id uuid not null references organisations (id) on delete cascade,
  key text not null check (length(key) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (invoice_id, key),
  foreign key (organisation_id, invoice_id) references invoices (organisation_id, id) on delete cascade
);

-- squawk-ignore require-concurrent-index-creation
create index invoice_watch_organisation_idx on invoice_watch (organisation_id);

-- What is still unpaid on a sent invoice: its total less the payments a person confirmed and the credit notes sent
-- against it. Runs as the caller, so row level security applies.
create function invoice_open(p_invoice uuid) returns bigint language sql stable as $$
  select i.total
    - coalesce((select sum(p.covers_ore) from invoice_payments p where p.invoice_id = i.id and p.status = 'confirmed'), 0)
    - coalesce((select sum(c.total) from invoices c where c.credits_id = i.id and c.status = 'sent'), 0)
  from invoices i where i.id = p_invoice and i.status = 'sent' and i.kind = 'invoice'
$$;

do $$
declare
  t text;
begin
  foreach t in array array['invoice_payments', 'invoice_watch'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant on %I using (organisation_id = current_organisation_id()) with check (organisation_id = current_organisation_id())', t);
  end loop;
end $$;

-- Delete is for open suggestions only, which the app recomputes; the app code never deletes a confirmed or rejected row.
grant select, insert, update, delete on invoice_payments to assistant_app;
grant select, insert on invoice_watch to assistant_app;
