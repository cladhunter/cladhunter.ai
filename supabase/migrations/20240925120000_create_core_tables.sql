-- Core relational schema for Cladhunter
-- Users, sessions, ad watches, orders and rewards migrated from kv_store

create table if not exists public.profiles (
  id text primary key,
  energy integer not null default 0,
  boost_level integer not null default 0,
  last_watch_at timestamptz,
  boost_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sessions (
  id bigserial primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now())
);

create index if not exists sessions_user_id_started_at_idx
  on public.sessions (user_id, started_at desc);

create table if not exists public.ad_watches (
  id bigserial primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  ad_id text not null,
  reward integer not null,
  base_reward integer not null,
  multiplier numeric(8,4) not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists ad_watches_user_created_at_idx
  on public.ad_watches (user_id, created_at desc);

create table if not exists public.orders (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  boost_level integer not null,
  ton_amount numeric(18,8) not null,
  status text not null check (status in ('pending', 'paid', 'failed')),
  payload text not null,
  tx_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists orders_user_id_idx on public.orders (user_id);

create table if not exists public.reward_claims (
  id bigserial primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  partner_id text not null,
  reward integer not null,
  claimed_at timestamptz not null default timezone('utc', now()),
  unique (user_id, partner_id)
);

create index if not exists reward_claims_user_partner_idx
  on public.reward_claims (user_id, partner_id);

create table if not exists public.reward_logs (
  id bigserial primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  partner_id text not null,
  reward integer not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists reward_logs_user_created_at_idx
  on public.reward_logs (user_id, created_at desc);

-- Helper view for aggregated ad watch stats
create or replace view public.v_user_watch_stats as
  select
    user_id,
    count(*) as total_watches,
    coalesce(sum(reward), 0) as total_reward
  from public.ad_watches
  group by user_id;
