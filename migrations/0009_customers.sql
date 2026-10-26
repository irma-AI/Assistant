set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- An organisation's customers, businesses and consumers. No personnummer: ROT/RUT and Kivra add it when they need it.
-- Invoices copy these details when issued, so editing or deleting a row never rewrites an issued invoice.
create table customers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  kind text not null check (kind in ('business', 'consumer')),
  name text not null check (length(name) between 1 and 200),
  address text not null check (length(address) between 1 and 500),
  email text check (length(email) <= 254),
  language text not null default 'sv' check (language in ('sv', 'en')),
  org_number text check (length(org_number) <= 20),
  vat_number text check (length(vat_number) <= 20),
  contact text check (length(contact) <= 200),
  -- A day count up to 365; bigint would reach Node as a string.
  -- squawk-ignore prefer-bigint-over-smallint
  payment_terms_days smallint check (payment_terms_days between 0 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Only businesses carry these; payment terms default to 30 days (Räntelagen 4 §).
  check (kind = 'business' or (org_number is null and vat_number is null and contact is null and payment_terms_days is null)),
  check (kind = 'consumer' or payment_terms_days is not null)
);

create index customers_organisation_id_idx on customers (organisation_id, name);

alter table customers enable row level security;
alter table customers force row level security;
create policy tenant on customers
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

grant select, insert, update, delete on customers to assistant_app;
