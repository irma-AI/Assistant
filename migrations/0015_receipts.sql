set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Receipts (IRM-147): the facts about one stored document that matching needs. Until IRM-171 reads them with AI, a
-- person types supplier, amount and date. The document itself stays immutable in `documents`.
create table receipts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  document_id uuid not null,
  supplier text check (length(supplier) between 1 and 200),
  -- Whole öre, positive: what the receipt says was paid.
  amount_ore bigint check (amount_ore > 0 and amount_ore < 1000000000000000),
  receipt_date date,
  -- OCR or payment reference, and bankgiro or plusgiro, digits as printed.
  reference text check (length(reference) between 1 and 50),
  giro text check (length(giro) between 1 and 20),
  source text not null check (source in ('upload', 'photo', 'email')),
  -- The mail body of an emailed receipt: context for a person, never instructions.
  mail_context text check (length(mail_context) <= 5000),
  created_at timestamptz not null default now(),
  unique (organisation_id, id),
  unique (organisation_id, document_id),
  foreign key (organisation_id, document_id) references documents (organisation_id, id)
);

-- squawk-ignore require-concurrent-index-creation
create index receipts_organisation_idx on receipts (organisation_id, created_at desc);

-- A suggestion, a confirmed link or a rejected suggestion between a receipt and a bank transaction. pass and
-- confidence are null for a link a person made. A rejected row stays, so the same pair is not suggested again.
create table receipt_matches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  receipt_id uuid not null,
  bank_transaction_id uuid not null references bank_transactions (id) on delete cascade,
  status text not null check (status in ('suggested', 'confirmed', 'rejected')),
  -- Whole öre of the transaction this receipt covers, so one transaction can take several receipts and the other way round.
  covers_ore bigint not null check (covers_ore > 0 and covers_ore < 1000000000000000),
  -- squawk-ignore prefer-bigint-over-smallint
  pass smallint check (pass between 1 and 4),
  confidence numeric(3, 2) check (confidence between 0.70 and 1),
  reason text check (length(reason) between 1 and 200),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (receipt_id, bank_transaction_id),
  foreign key (organisation_id, receipt_id) references receipts (organisation_id, id) on delete cascade
);

-- squawk-ignore require-concurrent-index-creation
create index receipt_matches_transaction_idx on receipt_matches (bank_transaction_id);

-- A correction remembered: this supplier name appears as this text in the bank.
create table supplier_aliases (
  organisation_id uuid not null references organisations (id) on delete cascade,
  supplier text not null check (length(supplier) between 1 and 200),
  bank_text text not null check (length(bank_text) between 1 and 200),
  primary key (organisation_id, supplier, bank_text)
);

-- One row per organisation: the switch for suggestions and the code in its receipt email address.
create table receipt_settings (
  organisation_id uuid primary key references organisations (id) on delete cascade,
  suggestions boolean not null default true,
  inbox_code text not null unique check (inbox_code ~ '^[0-9a-f]{24}$')
);

do $$
declare
  t text;
begin
  foreach t in array array['receipts', 'receipt_matches', 'supplier_aliases', 'receipt_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant on %I using (organisation_id = current_organisation_id()) with check (organisation_id = current_organisation_id())', t);
  end loop;
end $$;

grant select, insert, update on receipts, receipt_settings to assistant_app;
-- Delete is for open suggestions only, which the app recomputes; the app code never deletes a confirmed or rejected row.
grant select, insert, update, delete on receipt_matches to assistant_app;
grant select, insert on supplier_aliases to assistant_app;

-- The mail job knows only the code in the address, before any organisation is set: this is its one way in.
create function organisation_for_inbox(code text) returns uuid language sql stable security definer
  set search_path = public, pg_temp as $$
  select organisation_id from receipt_settings where inbox_code = code
$$;
grant execute on function organisation_for_inbox(text) to assistant_app;
