set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Stored files (receipts, invoice PDFs, attachments). The bytes live in file storage under storage_key; this row holds
-- what proves them (who uploaded it is in audit_events, so deleting an account never meets a document): the SHA-256 of the original bytes (BFL 7 kap. 1 §: kept as received). A document is a draft until
-- a posted entry links it by setting retain_until (31 December of the seventh year after the fiscal year, BFL 7 kap. 2 §).
create table documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations (id) on delete cascade,
  name text not null check (length(name) between 1 and 255),
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic')),
  -- At most 20 MB; bigint would reach Node as a string.
  -- squawk-ignore prefer-bigint-over-int
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key text not null unique,
  retain_until date,
  created_at timestamptz not null default now()
);

create index documents_organisation_id_idx on documents (organisation_id, created_at desc);

alter table documents enable row level security;
alter table documents force row level security;
create policy tenant on documents
  using (organisation_id = current_organisation_id())
  with check (organisation_id = current_organisation_id());

-- No delete grant: the app never deletes a document. The trigger below holds for any other login too.
grant select, insert, update on documents to assistant_app;

-- The content never changes; once linked (retain_until set) nothing does. Linking is the one allowed update.
create function documents_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.retain_until is not null and old.retain_until >= current_date then
      raise exception 'document % is retained until %', old.id, old.retain_until using errcode = 'restrict_violation';
    end if;
    return old;
  end if;
  if old.retain_until is not null then
    raise exception 'document % is linked and immutable', old.id using errcode = 'restrict_violation';
  end if;
  if (new.organisation_id, new.name, new.content_type, new.size_bytes, new.sha256, new.storage_key, new.created_at)
    is distinct from
    (old.organisation_id, old.name, old.content_type, old.size_bytes, old.sha256, old.storage_key, old.created_at) then
    raise exception 'document % content is immutable', old.id using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create trigger documents_guard before update or delete on documents
  for each row execute function documents_guard();
