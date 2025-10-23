-- Tracking events and credit ledger tables used by /api/track endpoint
create table if not exists public.events (
  id uuid primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  event_type text not null check (char_length(event_type) > 0 and char_length(event_type) <= 64),
  amount integer not null check (amount >= 0),
  metadata jsonb,
  idempotency_key text not null check (char_length(idempotency_key) > 0 and char_length(idempotency_key) <= 255),
  ip_address text,
  occurred_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (idempotency_key)
);

create index if not exists events_user_id_created_at_idx
  on public.events (user_id, created_at desc);

create index if not exists events_ip_created_at_idx
  on public.events (ip_address, created_at desc)
  where ip_address is not null;

create table if not exists public.credit_ledger (
  id uuid primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  amount integer not null check (amount >= 0),
  reason text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id)
);

create index if not exists credit_ledger_user_created_at_idx
  on public.credit_ledger (user_id, created_at desc);
