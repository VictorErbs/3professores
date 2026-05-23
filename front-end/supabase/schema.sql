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

alter table public.clients enable row level security;
alter table public.contracts enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.risk_scores enable row level security;
alter table public.alerts enable row level security;

-- The server uses the service role key, so it bypasses RLS when used server-side.