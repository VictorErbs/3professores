-- Run this in the Supabase SQL editor before using the production database.
-- Run this in the Supabase SQL editor before using the production database.

-- STAGING tables (temporary import area)
create table if not exists public.staging_csv1 (
  id uuid primary key default gen_random_uuid(),
  raw jsonb not null,
  row_num integer,
  imported_at timestamptz not null default now(),
  processed boolean not null default false
);

create table if not exists public.staging_csv2 (
  id uuid primary key default gen_random_uuid(),
  raw jsonb not null,
  row_num integer,
  imported_at timestamptz not null default now(),
  processed boolean not null default false
);

-- Operational tables
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  cpf text not null default '',
  phone text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  contract_number text,
  start_date date,
  end_date date,
  total_value numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contracts(id) on delete cascade,
  installment_number integer,
  due_date date,
  amount numeric,
  status text default 'pending', -- pending, paid, overdue
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid references public.installments(id) on delete cascade,
  paid_at timestamptz,
  amount numeric,
  method text,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  score numeric,
  model text,
  computed_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  contract_id uuid references public.contracts(id),
  severity text,
  message text,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

create table if not exists public.source_cobranca_assessorias (
  id bigserial primary key,
  raw jsonb not null,
  imported_at timestamptz not null default now()
);

create table if not exists public.source_fluxo_pagamentos (
  id bigserial primary key,
  raw jsonb not null,
  imported_at timestamptz not null default now()
);

create table if not exists public.contract_metadata (
  contract_number text primary key,
  advisory_name text,
  collection_status text,
  client_region text,
  contemplated_indicator text,
  payment_method text,
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_clients_email on public.clients(email);
create unique index if not exists ux_clients_cpf on public.clients(cpf);
create unique index if not exists ux_contracts_contract_number on public.contracts(contract_number);
create unique index if not exists ux_installments_contract_number on public.installments(contract_id, installment_number);

alter table public.clients enable row level security;
alter table public.contracts enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.risk_scores enable row level security;
alter table public.alerts enable row level security;

-- The server uses the service role key, so it bypasses RLS when used server-side.

create or replace function public.creditguard_reset_and_load(
  p_clients jsonb,
  p_contracts jsonb,
  p_installments jsonb,
  p_payments jsonb,
  p_risk_scores jsonb,
  p_alerts jsonb,
  p_cobrancas jsonb,
  p_pagamentos jsonb
) returns void
language plpgsql
security definer
as $$
begin
  truncate table public.payments, public.installments, public.risk_scores, public.alerts, public.contracts, public.clients, public.source_cobranca_assessorias, public.source_fluxo_pagamentos restart identity cascade;
  truncate table public.contract_metadata;

  insert into public.source_cobranca_assessorias(raw)
  select value from jsonb_array_elements(coalesce(p_cobrancas, '[]'::jsonb));

  insert into public.source_fluxo_pagamentos(raw)
  select value from jsonb_array_elements(coalesce(p_pagamentos, '[]'::jsonb));

  insert into public.clients(name, email, cpf, phone)
  select distinct
    coalesce(value->>'name', ''),
    coalesce(value->>'email', ''),
    coalesce(value->>'cpf', ''),
    coalesce(value->>'phone', '')
  from jsonb_array_elements(coalesce(p_clients, '[]'::jsonb));

  insert into public.contracts(client_id, contract_number, start_date, end_date, total_value)
  select
    c.id,
    d.contract_number,
    d.start_date,
    d.end_date,
    d.total_value
  from (
    select distinct
      value->>'contract_number' as contract_number,
      nullif(value->>'start_date', '')::date as start_date,
      nullif(value->>'end_date', '')::date as end_date,
      nullif(value->>'total_value', '')::numeric as total_value
    from jsonb_array_elements(coalesce(p_contracts, '[]'::jsonb))
  ) d
  join public.clients c on c.email = ('cliente.' || lower(regexp_replace(d.contract_number, '[^a-zA-Z0-9]', '', 'g')) || '@creditguard.local');

  insert into public.installments(contract_id, installment_number, due_date, amount, status)
  select
    ctr.id,
    (value->>'installment_number')::integer,
    nullif(value->>'due_date', '')::date,
    coalesce((value->>'amount')::numeric, 0),
    coalesce(value->>'status', 'pending')
  from jsonb_array_elements(coalesce(p_installments, '[]'::jsonb)) v(value)
  join public.contracts ctr on ctr.contract_number = value->>'contract_number';

  insert into public.payments(installment_id, paid_at, amount, method)
  select
    i.id,
    (value->>'paid_at')::timestamptz,
    coalesce((value->>'amount')::numeric, 0),
    value->>'method'
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) v(value)
  join public.contracts ctr on ctr.contract_number = value->>'contract_number'
  join public.installments i on i.contract_id = ctr.id and i.installment_number = (value->>'installment_number')::integer;

  insert into public.risk_scores(client_id, score, model)
  select
    ctr.client_id,
    coalesce((value->>'score')::numeric, 0),
    coalesce(value->>'model', 'real_data_v1')
  from jsonb_array_elements(coalesce(p_risk_scores, '[]'::jsonb)) v(value)
  join public.contracts ctr on ctr.contract_number = value->>'contract_number';

  insert into public.alerts(client_id, contract_id, severity, message)
  select
    ctr.client_id,
    ctr.id,
    coalesce(value->>'severity', 'medium'),
    coalesce(value->>'message', 'Alerta de cobranca')
  from jsonb_array_elements(coalesce(p_alerts, '[]'::jsonb)) v(value)
  join public.contracts ctr on ctr.contract_number = value->>'contract_number';
end;
$$;
