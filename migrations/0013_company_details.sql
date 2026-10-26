set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- One row per organisation, so the unique org number needs no index on the existing table. Deleting the
-- organisation deletes the row and frees the number (IRM-153 decision 5). Luhn and the date rules live in
-- src/api/company.ts; here only the shapes the code relies on.
create table company_details (
  organisation_id uuid primary key references organisations (id) on delete cascade,
  org_number text not null unique check (org_number ~ '^[0-9]{10}$'),
  legal_name text not null check (length(legal_name) between 1 and 100),
  company_form text not null check (company_form in ('ab')),
  seat text not null check (length(seat) between 1 and 100),
  street text not null check (length(street) between 1 and 100),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  city text not null check (length(city) between 1 and 100),
  f_skatt boolean not null,
  vat_period text not null check (vat_period in ('yearly', 'quarterly', 'monthly')),
  accounting_method text not null check (accounting_method in ('invoice', 'cash')),
  payment_kind text not null check (payment_kind in ('bankgiro', 'plusgiro', 'iban')),
  payment_number text not null check (length(payment_number) between 1 and 34),
  swish text check (length(swish) between 1 and 20),
  contact_email text check (length(contact_email) between 3 and 254),
  contact_phone text check (length(contact_phone) between 3 and 30),
  fiscal_year_start date not null,
  fiscal_year_end date not null,
  updated_at timestamptz not null default now(),
  check (fiscal_year_end > fiscal_year_start)
);

alter table company_details enable row level security;
alter table company_details force row level security;
create policy tenant on company_details
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

grant select, insert, update on company_details to assistant_app;
