-- Migration: Replace edge function logic with SQL stored procedures
-- Description: Creates normalized tables and SQL helper functions used by the frontend via Supabase RPC.

set check_function_bodies = off;

create extension if not exists pgcrypto;

-- Core tables ---------------------------------------------------------------
create table if not exists public.app_users (
  id text primary key,
  energy integer not null default 0,
  boost_level integer not null default 0,
  last_watch_at timestamptz,
  boost_expires_at timestamptz,
  wallet_address text,
  country_code text default 'ZZ',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ad_watch_counts (
  user_id text references public.app_users(id) on delete cascade,
  watch_date date not null,
  count integer not null default 0,
  primary key (user_id, watch_date)
);

create table if not exists public.ad_watch_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.app_users(id) on delete cascade,
  ad_id text not null,
  reward integer not null,
  base_reward integer not null,
  multiplier numeric(6,2) not null,
  country_code text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_orders (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.app_users(id) on delete cascade,
  boost_level integer not null,
  ton_amount numeric(12,4) not null,
  status text not null default 'pending',
  payload text not null,
  tx_hash text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.partner_reward_claims (
  user_id text references public.app_users(id) on delete cascade,
  partner_id text not null,
  reward integer not null,
  partner_name text not null,
  claimed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, partner_id)
);

create table if not exists public.partner_reward_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.app_users(id) on delete cascade,
  partner_id text not null,
  reward integer not null,
  partner_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text references public.app_users(id) on delete cascade,
  country_code text,
  created_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.app_settings (key, value)
values ('ton_merchant_address', 'UQDw8GgIlOX7SqLJKkpIB2JaOlU5n0g2qGifwtneUb1VMnVt')
on conflict (key) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger app_users_set_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

-- Helper lookup functions ---------------------------------------------------
create or replace function public.app_boost_multiplier(p_level integer)
returns numeric
language sql
stable
as $$
  select case p_level
    when 1 then 1.25
    when 2 then 1.50
    when 3 then 2.00
    when 4 then 3.00
    else 1.00
  end;
$$;

create or replace function public.app_boost_duration_days(p_level integer)
returns integer
language sql
stable
as $$
  select case p_level
    when 1 then 7
    when 2 then 14
    when 3 then 30
    when 4 then 60
    else 0
  end;
$$;

create or replace function public.app_boost_cost_ton(p_level integer)
returns numeric
language sql
stable
as $$
  select case p_level
    when 1 then 0.5
    when 2 then 1.2
    when 3 then 2.8
    when 4 then 6.0
    else 0
  end;
$$;

create or replace function public.app_boost_name(p_level integer)
returns text
language sql
stable
as $$
  select case p_level
    when 1 then 'Bronze'
    when 2 then 'Silver'
    when 3 then 'Gold'
    when 4 then 'Diamond'
    else 'Base'
  end;
$$;

-- Utility to sanitize input -------------------------------------------------
create or replace function public.app_normalize_text(p_value text)
returns text
language sql
stable
as $$
  select case when length(trim(coalesce(p_value, ''))) > 0 then trim(p_value) else null end;
$$;

-- Core procedures -----------------------------------------------------------
create or replace function public.app_ensure_user(
  p_user_id text,
  p_wallet_address text default null,
  p_country_code text default null
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_user public.app_users;
  v_wallet text := public.app_normalize_text(p_wallet_address);
  v_country text := coalesce(public.app_normalize_text(p_country_code), 'ZZ');
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception using message = 'USER_ID_REQUIRED';
  end if;

  select * into v_user
  from public.app_users
  where id = p_user_id
  for update;

  if not found then
    insert into public.app_users (id, wallet_address, country_code)
    values (p_user_id, v_wallet, v_country)
    returning * into v_user;
  else
    if v_wallet is not null then
      v_user.wallet_address := v_wallet;
    end if;
    if v_country is not null then
      v_user.country_code := v_country;
    end if;
    if v_user.boost_expires_at is not null and v_user.boost_expires_at < v_now then
      v_user.boost_level := 0;
      v_user.boost_expires_at := null;
    end if;
    update public.app_users
    set wallet_address = v_user.wallet_address,
        country_code = v_user.country_code,
        boost_level = v_user.boost_level,
        boost_expires_at = v_user.boost_expires_at,
        last_watch_at = v_user.last_watch_at
    where id = v_user.id
    returning * into v_user;
  end if;

  insert into public.user_sessions (user_id, country_code, created_at, last_activity_at)
  values (v_user.id, v_user.country_code, v_now, v_now);

  return v_user;
end;
$$;

create or replace function public.app_init_user(
  p_user_id text,
  p_wallet_address text default null,
  p_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
begin
  v_user := public.app_ensure_user(p_user_id, p_wallet_address, p_country_code);

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id,
      'energy', v_user.energy,
      'boost_level', v_user.boost_level,
      'boost_expires_at', v_user.boost_expires_at,
      'country_code', v_user.country_code
    )
  );
end;
$$;

create or replace function public.app_get_user_balance(
  p_user_id text,
  p_wallet_address text default null,
  p_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_multiplier numeric := 1;
begin
  v_user := public.app_ensure_user(p_user_id, p_wallet_address, p_country_code);
  v_multiplier := public.app_boost_multiplier(v_user.boost_level);

  return jsonb_build_object(
    'energy', v_user.energy,
    'boost_level', v_user.boost_level,
    'multiplier', v_multiplier,
    'boost_expires_at', v_user.boost_expires_at
  );
end;
$$;

create or replace function public.app_complete_ad_watch(
  p_user_id text,
  p_ad_id text,
  p_wallet_address text default null,
  p_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_now timestamptz := timezone('utc', now());
  v_base_reward integer := 10;
  v_multiplier numeric := 1;
  v_reward integer;
  v_today_count integer := 0;
  v_new_count integer := 0;
  v_daily_limit integer := 200;
  v_country text;
begin
  if p_ad_id is null or length(trim(p_ad_id)) = 0 then
    raise exception using message = 'AD_ID_REQUIRED';
  end if;

  v_user := public.app_ensure_user(p_user_id, p_wallet_address, p_country_code);
  v_country := v_user.country_code;

  if v_user.last_watch_at is not null and v_user.last_watch_at > v_now - interval '30 seconds' then
    raise exception using message = 'WATCH_COOLDOWN', errcode = 'P0001';
  end if;

  select count into v_today_count
  from public.ad_watch_counts
  where user_id = v_user.id and watch_date = v_now::date;

  v_today_count := coalesce(v_today_count, 0);

  if v_today_count >= v_daily_limit then
    raise exception using message = 'DAILY_LIMIT_EXCEEDED', errcode = 'P0001';
  end if;

  v_multiplier := public.app_boost_multiplier(v_user.boost_level);
  v_reward := floor(v_base_reward * v_multiplier)::integer;

  update public.app_users
  set energy = energy + v_reward,
      last_watch_at = v_now
  where id = v_user.id
  returning * into v_user;

  insert into public.ad_watch_counts (user_id, watch_date, count)
  values (v_user.id, v_now::date, 1)
  on conflict (user_id, watch_date)
  do update set count = public.ad_watch_counts.count + 1
  returning count into v_new_count;

  insert into public.ad_watch_logs (user_id, ad_id, reward, base_reward, multiplier, country_code, created_at)
  values (v_user.id, p_ad_id, v_reward, v_base_reward, v_multiplier, v_country, v_now);

  return jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'new_balance', v_user.energy,
    'multiplier', v_multiplier,
    'daily_watches_remaining', greatest(v_daily_limit - v_new_count, 0)
  );
end;
$$;

create or replace function public.app_create_order(
  p_user_id text,
  p_boost_level integer,
  p_wallet_address text default null,
  p_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_boost_name text;
  v_cost numeric;
  v_duration integer;
  v_order_id uuid := gen_random_uuid();
  v_payload text;
  v_merchant text;
begin
  if p_boost_level is null or p_boost_level < 1 or p_boost_level > 4 then
    raise exception using message = 'INVALID_BOOST_LEVEL';
  end if;

  v_user := public.app_ensure_user(p_user_id, p_wallet_address, p_country_code);

  v_boost_name := public.app_boost_name(p_boost_level);
  v_cost := public.app_boost_cost_ton(p_boost_level);
  v_duration := public.app_boost_duration_days(p_boost_level);
  v_payload := encode(format('boost_%s_%s_%s', p_boost_level, v_user.id, extract(epoch from timezone('utc', now()))::bigint)::bytea, 'base64');

  select value into v_merchant
  from public.app_settings
  where key = 'ton_merchant_address';

  if v_merchant is null then
    v_merchant := 'UQDw8GgIlOX7SqLJKkpIB2JaOlU5n0g2qGifwtneUb1VMnVt';
  end if;

  insert into public.app_orders (id, user_id, boost_level, ton_amount, status, payload)
  values (v_order_id, v_user.id, p_boost_level, v_cost, 'pending', v_payload);

  return jsonb_build_object(
    'order_id', v_order_id,
    'address', v_merchant,
    'amount', v_cost,
    'payload', v_payload,
    'boost_name', v_boost_name,
    'duration_days', v_duration
  );
end;
$$;

create or replace function public.app_confirm_order(
  p_user_id text,
  p_order_id uuid,
  p_tx_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.app_orders;
  v_user public.app_users;
  v_multiplier numeric;
  v_duration integer;
  v_now timestamptz := timezone('utc', now());
  v_expires timestamptz;
begin
  select * into v_order
  from public.app_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.user_id <> p_user_id then
    raise exception using message = 'ORDER_FORBIDDEN';
  end if;

  if v_order.status <> 'pending' then
    raise exception using message = 'ORDER_ALREADY_PROCESSED';
  end if;

  update public.app_orders
  set status = 'paid',
      tx_hash = coalesce(public.app_normalize_text(p_tx_hash), concat('manual_', extract(epoch from v_now)::bigint))
  where id = p_order_id
  returning * into v_order;

  select * into v_user
  from public.app_users
  where id = p_user_id
  for update;

  if not found then
    raise exception using message = 'USER_NOT_FOUND';
  end if;

  v_user.boost_level := v_order.boost_level;
  v_duration := public.app_boost_duration_days(v_order.boost_level);

  if v_duration > 0 then
    v_expires := v_now + (v_duration || ' days')::interval;
  else
    v_expires := null;
  end if;

  update public.app_users
  set boost_level = v_user.boost_level,
      boost_expires_at = v_expires
  where id = v_user.id
  returning * into v_user;

  v_multiplier := public.app_boost_multiplier(v_user.boost_level);

  return jsonb_build_object(
    'success', true,
    'boost_level', v_user.boost_level,
    'boost_expires_at', v_user.boost_expires_at,
    'multiplier', v_multiplier
  );
end;
$$;

create or replace function public.app_get_stats(
  p_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_totals record;
  v_today integer := 0;
  v_sessions integer := 0;
  v_limit integer := 200;
  v_multiplier numeric;
  v_watch_history jsonb := '[]'::jsonb;
  v_session_history jsonb := '[]'::jsonb;
  v_now timestamptz := timezone('utc', now());
  v_start_today timestamptz := date_trunc('day', v_now);
begin
  select * into v_user from public.app_users where id = p_user_id;
  if not found then
    raise exception using message = 'USER_NOT_FOUND';
  end if;

  select coalesce(sum(reward), 0) as total_earned,
         count(*) as total_watches
  into v_totals
  from public.ad_watch_logs
  where user_id = p_user_id;

  select count(*) into v_today
  from public.ad_watch_logs
  where user_id = p_user_id and created_at >= v_start_today;

  select count(*) into v_sessions
  from public.user_sessions
  where user_id = p_user_id;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_watch_history
  from (
    select id, user_id, ad_id, reward, base_reward, multiplier, country_code, created_at
    from public.ad_watch_logs
    where user_id = p_user_id
    order by created_at desc
    limit 20
  ) as t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_session_history
  from (
    select id, user_id, country_code, created_at, last_activity_at
    from public.user_sessions
    where user_id = p_user_id
    order by last_activity_at desc
    limit 20
  ) as t;

  v_multiplier := public.app_boost_multiplier(v_user.boost_level);

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'energy', v_user.energy,
      'watches', coalesce(v_totals.total_watches, 0),
      'earned', coalesce(v_totals.total_earned, 0),
      'sessions', v_sessions,
      'today_watches', v_today,
      'daily_limit', v_limit
    ),
    'boost', jsonb_build_object(
      'level', v_user.boost_level,
      'multiplier', v_multiplier,
      'expires_at', v_user.boost_expires_at
    ),
    'country_code', v_user.country_code,
    'watch_history', v_watch_history,
    'session_history', v_session_history
  );
end;
$$;

create or replace function public.app_get_reward_status(
  p_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed jsonb := '[]'::jsonb;
  v_available integer := 0;
begin
  select coalesce(jsonb_agg(partner_id), '[]'::jsonb)
  into v_claimed
  from public.partner_reward_claims
  where user_id = p_user_id;

  return jsonb_build_object(
    'claimed_partners', v_claimed,
    'available_rewards', v_available
  );
end;
$$;

create or replace function public.app_claim_reward(
  p_user_id text,
  p_partner_id text,
  p_reward integer,
  p_partner_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.app_users;
  v_now timestamptz := timezone('utc', now());
  v_partner text := coalesce(public.app_normalize_text(p_partner_name), 'Partner');
begin
  if p_partner_id is null or length(trim(p_partner_id)) = 0 then
    raise exception using message = 'PARTNER_ID_REQUIRED';
  end if;

  if p_reward is null or p_reward <= 0 then
    raise exception using message = 'INVALID_REWARD_AMOUNT';
  end if;

  v_user := public.app_ensure_user(p_user_id, null, null);

  insert into public.partner_reward_claims (user_id, partner_id, reward, partner_name, claimed_at)
  values (p_user_id, p_partner_id, p_reward, v_partner, v_now);

  update public.app_users
  set energy = energy + p_reward
  where id = p_user_id
  returning * into v_user;

  insert into public.partner_reward_logs (user_id, partner_id, reward, partner_name, created_at)
  values (p_user_id, p_partner_id, p_reward, v_partner, v_now);

  return jsonb_build_object(
    'success', true,
    'reward', p_reward,
    'new_balance', v_user.energy,
    'partner_name', v_partner
  );
exception
  when unique_violation then
    raise exception using message = 'REWARD_ALREADY_CLAIMED', errcode = '23505';
end;
$$;

-- Permissions ---------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update on public.app_users to anon, authenticated;

grant select, insert, update on public.ad_watch_counts to anon, authenticated;

grant select, insert on public.ad_watch_logs to anon, authenticated;

grant select, insert, update on public.app_orders to anon, authenticated;

grant select, insert on public.partner_reward_claims to anon, authenticated;

grant select, insert on public.partner_reward_logs to anon, authenticated;

grant select, insert on public.user_sessions to anon, authenticated;

grant select on public.app_settings to anon, authenticated;

grant execute on function
  public.app_ensure_user(text, text, text),
  public.app_init_user(text, text, text),
  public.app_get_user_balance(text, text, text),
  public.app_complete_ad_watch(text, text, text, text),
  public.app_create_order(text, integer, text, text),
  public.app_confirm_order(text, uuid, text),
  public.app_get_stats(text),
  public.app_get_reward_status(text),
  public.app_claim_reward(text, text, integer, text)
  to anon, authenticated;
