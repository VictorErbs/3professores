create table if not exists public.contract_metadata (
  contract_number text primary key,
  advisory_name text,
  collection_status text,
  client_region text,
  contemplated_indicator text,
  payment_method text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_contract_metadata_region on public.contract_metadata(client_region);
create index if not exists idx_contract_metadata_status on public.contract_metadata(collection_status);
