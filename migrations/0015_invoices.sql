set local lock_timeout = '1s';
set local statement_timeout = '30s';

-- squawk-ignore disallowed-unique-constraint, constraint-missing-not-valid
alter table customers add constraint customers_organisation_id_id_key unique (organisation_id, id);

-- Invoices and credit notes (IRM-145). Same principle as the vouchers: the law is enforced here, by triggers and
-- constraints, and a code path that hits one is wrong, not the trigger.

-- The invoice series: one row per organisation, only ever touched by invoices_guard. Credit notes share the series.
create table invoice_counters (
  organisation_id uuid primary key references organisations (id) on delete restrict,
  last_number bigint not null check (last_number > 0)
);

-- A draft is freely editable and has no number. Sending numbers it, computes its totals and freezes it. The buyer and
-- seller are copied into it when sent, so editing or deleting a customer never rewrites an issued invoice
-- (IRM-144 decision 4). customer_id is the one thing that follows a deleted customer: it becomes null.
create table invoices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete restrict,
  kind text not null default 'invoice' check (kind in ('invoice', 'credit_note')),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  number bigint check (number > 0),
  ocr text check (ocr ~ '^[0-9]{2,25}$'),
  credits_id uuid,
  customer_id uuid,
  invoice_date date not null,
  supply_date date not null,
  due_date date not null,
  reference text check (length(reference) between 1 and 100),
  buyer jsonb,
  seller jsonb,
  total_net bigint,
  total_vat bigint,
  total bigint,
  voucher_id uuid,
  document_id uuid,
  emailed_to text,
  emailed_at timestamptz,
  created_by uuid not null references users (id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  sent_by uuid references users (id) on delete restrict,
  sent_by_name text,
  sent_at timestamptz,
  unique (organisation_id, id),
  unique (organisation_id, number),
  foreign key (organisation_id, customer_id) references customers (organisation_id, id) on delete set null (customer_id),
  foreign key (organisation_id, credits_id) references invoices (organisation_id, id) on delete restrict,
  foreign key (organisation_id, voucher_id) references vouchers (organisation_id, id) on delete restrict,
  foreign key (organisation_id, document_id) references documents (organisation_id, id),
  check (due_date >= invoice_date),
  check ((kind = 'credit_note') = (credits_id is not null)),
  check ((status = 'draft') = (number is null)),
  check ((status = 'draft') = (sent_at is null)),
  check (
    status = 'draft' or (
      ocr is not null and buyer is not null and seller is not null and total_net is not null and total_vat is not null
      and total is not null and sent_by is not null and sent_by_name is not null
    )
  ),
  check (total is null or (total = total_net + total_vat and total > 0))
);

-- squawk-ignore require-concurrent-index-creation
create index invoices_organisation_id_idx on invoices (organisation_id, created_at desc);

-- Amounts are whole öre in SEK, the quantity is in thousandths. net is the one place a line's amount is rounded
-- (half up), so a total can never disagree with its lines.
create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  invoice_id uuid not null,
  -- A position under 1000; bigint would reach Node as a string.
  -- squawk-ignore prefer-bigint-over-smallint
  line_no smallint not null check (line_no between 1 and 999),
  description text not null check (length(description) between 1 and 500),
  quantity_milli bigint not null check (quantity_milli > 0 and quantity_milli <= 100000000),
  unit text not null default 'st' check (length(unit) between 1 and 10),
  unit_price bigint not null check (unit_price >= 0 and unit_price <= 100000000000),
  -- Until the VAT codes of IRM-163 exist: the Swedish rates and reverse charge.
  vat_code text not null check (vat_code in ('25', '12', '6', '0', 'rc')),
  net bigint not null generated always as (round(quantity_milli::numeric * unit_price / 1000)::bigint) stored,
  unique (invoice_id, line_no),
  check (net < 10000000000000),
  foreign key (organisation_id, invoice_id) references invoices (organisation_id, id) on delete cascade
);

-- Net and VAT per rate, the VAT rounded once per rate (Skatteverket asks for the taxable amount and VAT per rate).
-- Runs as the caller, so row level security applies.
create function invoice_rates(p_invoice uuid) returns table (vat_code text, net bigint, vat bigint)
language sql stable as $$
  select l.vat_code, sum(l.net)::bigint,
    round(sum(l.net) * (case l.vat_code when '25' then 25 when '12' then 12 when '6' then 6 else 0 end) / 100.0)::bigint
  from invoice_lines l where l.invoice_id = p_invoice group by l.vat_code order by l.vat_code
$$;

-- The payment reference (Bankgirot 10-modul): the invoice number, a length digit (the whole reference's length
-- modulo 10) and a Luhn check digit. It passes the soft control and the variable-length hard control.
create function ocr_reference(n bigint) returns text language plpgsql immutable as $$
declare
  base text := n::text;
  s int := 0;
  d int;
begin
  base := base || ((length(base) + 2) % 10)::text;
  for i in 1..length(base) loop
    d := substr(base, length(base) - i + 1, 1)::int;
    if i % 2 = 1 then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    s := s + d;
  end loop;
  return base || ((10 - s % 10) % 10)::text;
end $$;

-- SECURITY DEFINER so the series row stays out of the app role's reach; row level security still applies to the owner
-- (FORCE), and the transaction's organisation setting is what lets it through.
create function invoices_guard() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  fy fiscal_years;
  orig invoices;
  credited bigint;
  net_sum bigint;
  vat_sum bigint;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'an invoice starts as a draft' using errcode = 'restrict_violation';
    end if;
    if new.credits_id is not null then
      select * into orig from invoices where organisation_id = new.organisation_id and id = new.credits_id;
      if orig.status is distinct from 'sent' or orig.kind <> 'invoice' then
        raise exception 'only a sent invoice can be credited' using errcode = 'restrict_violation';
      end if;
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'invoice % is sent and cannot be deleted', old.id using errcode = 'restrict_violation';
    end if;
    return old;
  end if;
  if old.status = 'draft' and new.status = 'draft' then
    if (new.kind, new.credits_id) is distinct from (old.kind, old.credits_id) then
      raise exception 'invoice % cannot change what it credits', old.id using errcode = 'restrict_violation';
    end if;
    return new;
  end if;
  if old.status = 'draft' and new.status = 'sent' then
    if not exists (select 1 from invoice_lines where invoice_id = new.id) then
      raise exception 'invoice % has no lines', new.id using errcode = 'check_violation';
    end if;
    select * into fy from fiscal_years
      where organisation_id = new.organisation_id and new.invoice_date between starts_on and ends_on;
    if not found then
      raise exception 'invoice date % is outside its fiscal year', new.invoice_date using errcode = 'check_violation';
    end if;
    if fy.locked_through is not null and new.invoice_date <= fy.locked_through then
      raise exception 'the period up to % is locked', fy.locked_through using errcode = 'restrict_violation';
    end if;
    select coalesce(sum(r.net), 0), coalesce(sum(r.vat), 0) into net_sum, vat_sum from invoice_rates(new.id) r;
    if net_sum + vat_sum <= 0 then
      raise exception 'invoice % has no amount', new.id using errcode = 'check_violation';
    end if;
    new.total_net := net_sum;
    new.total_vat := vat_sum;
    new.total := net_sum + vat_sum;
    if new.credits_id is not null then
      -- Locking the original makes two concurrent credit notes take turns.
      select * into orig from invoices
        where organisation_id = new.organisation_id and id = new.credits_id for update;
      if orig.status is distinct from 'sent' or orig.kind <> 'invoice' then
        raise exception 'only a sent invoice can be credited' using errcode = 'restrict_violation';
      end if;
      if new.invoice_date < orig.invoice_date then
        raise exception 'a credit note is dated before its invoice' using errcode = 'check_violation';
      end if;
      select coalesce(sum(total), 0) into credited from invoices
        where organisation_id = new.organisation_id and credits_id = new.credits_id and status = 'sent';
      if credited + new.total > orig.total then
        raise exception 'credit notes exceed the original invoice' using errcode = 'check_violation';
      end if;
    end if;
    -- Lock and increment the series row in this transaction, so a rollback rolls the number back. Whatever the
    -- caller sent is ignored.
    insert into invoice_counters (organisation_id, last_number) values (new.organisation_id, 1)
      on conflict (organisation_id) do update set last_number = invoice_counters.last_number + 1
      returning last_number into new.number;
    new.ocr := ocr_reference(new.number);
    new.sent_at := now();
    return new;
  end if;
  -- A sent invoice takes only these changes: its PDF and booking, once each; when it was emailed; and its customer
  -- link following a deleted customer.
  if old.status = 'sent' and new.status = 'sent'
     and (to_jsonb(new) - 'document_id' - 'voucher_id' - 'emailed_to' - 'emailed_at' - 'customer_id')
       = (to_jsonb(old) - 'document_id' - 'voucher_id' - 'emailed_to' - 'emailed_at' - 'customer_id')
     and (new.document_id is not distinct from old.document_id or old.document_id is null)
     and (new.voucher_id is not distinct from old.voucher_id or old.voucher_id is null)
     and (new.customer_id is not distinct from old.customer_id or new.customer_id is null) then
    return new;
  end if;
  raise exception 'invoice % is sent and immutable', old.id using errcode = 'restrict_violation';
end $$;

create trigger invoices_guard before insert or update or delete on invoices
  for each row execute function invoices_guard();

-- Lines follow their invoice: free while it is a draft, frozen after.
create function invoice_children_guard() returns trigger language plpgsql as $$
declare
  s text;
begin
  if tg_op = 'UPDATE' and new.invoice_id <> old.invoice_id then
    raise exception 'a line stays on its invoice' using errcode = 'restrict_violation';
  end if;
  select status into s from invoices where id = coalesce(new.invoice_id, old.invoice_id);
  -- No parent row: the foreign key rejects an insert, and a cascade from a deleted draft passes.
  if s is not null and s <> 'draft' then
    raise exception 'invoice is sent and immutable' using errcode = 'restrict_violation';
  end if;
  return coalesce(new, old);
end $$;

create trigger invoice_lines_guard before insert or update or delete on invoice_lines
  for each row execute function invoice_children_guard();

do $$
declare
  t text;
begin
  foreach t in array array['invoice_counters', 'invoices', 'invoice_lines'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant on %I using (organisation_id = current_organisation_id()) with check (organisation_id = current_organisation_id())', t);
  end loop;
end $$;

grant select, insert, update, delete on invoices, invoice_lines to assistant_app;
