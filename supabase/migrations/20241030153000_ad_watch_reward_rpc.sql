-- Migration: RPC functions for ad watch completion and partner reward claims

create table if not exists public.partner_rewards (
  id text primary key,
  name text not null,
  reward integer not null check (reward >= 0),
  active boolean not null default true
);

insert into public.partner_rewards (id, name, reward, active)
values
  ('telegram_cladhunter_official', 'Cladhunter Official', 1000, true),
  ('telegram_crypto_insights', 'Crypto Insights', 750, true),
  ('x_cladhunter', 'Cladhunter X', 800, true),
  ('youtube_crypto_tutorials', 'Crypto Tutorials', 500, true)
on conflict (id) do update
  set name = excluded.name,
      reward = excluded.reward,
      active = excluded.active;

create or replace function public.complete_ad_watch(
  p_ad_id text default null,
  p_wallet_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := coalesce(nullif(auth.uid()::text, ''), nullif(request.jwt.claims ->> 'sub', ''));
  v_user_key text;
  v_now timestamptz := now();
  v_user jsonb;
  v_wallet text := nullif(trim(p_wallet_address), '');
  v_wallet_sanitized text;
  v_base_reward integer := 10;
  v_multiplier numeric;
  v_reward integer;
  v_watch_count_key text;
  v_watch_limit integer := 200;
  v_result jsonb;
  v_updated_user jsonb;
  v_watch_count integer := 0;
  v_daily_remaining integer := v_watch_limit;
  v_last_watch timestamptz;
  v_cooldown_seconds integer := 30;
  v_cooldown_remaining integer;
  v_watch_log_key text;
  v_watch_log jsonb;
  v_boost_level integer := 0;
begin
  if v_user_id is null then
    raise exception 'MISSING_USER' using errcode = '42501', hint = 'Authentication required to complete ad watch.';
  end if;

  v_user_key := 'user:' || v_user_id;

  if v_wallet is not null then
    v_wallet_sanitized := left(regexp_replace(v_wallet, '[^A-Za-z0-9_-]', '', 'g'), 256);
  end if;

  select value into v_user from public.kv_store_0f597298 where key = v_user_key;

  if v_user is null then
    v_user := jsonb_build_object(
      'id', v_user_id,
      'energy', 0,
      'boost_level', 0,
      'last_watch_at', null,
      'boost_expires_at', null,
      'created_at', v_now,
      'wallet_address', coalesce(v_wallet_sanitized, null)
    );

    insert into public.kv_store_0f597298(key, value)
    values (v_user_key, v_user)
    on conflict (key) do nothing;

    select value into v_user from public.kv_store_0f597298 where key = v_user_key;
  elsif v_wallet_sanitized is not null and (v_user ->> 'wallet_address') is distinct from v_wallet_sanitized then
    update public.kv_store_0f597298
    set value = jsonb_set(v_user, '{wallet_address}', to_jsonb(v_wallet_sanitized), true)
    where key = v_user_key
    returning value into v_user;
  end if;

  if (v_user ->> 'boost_expires_at') is not null and (v_user ->> 'boost_expires_at')::timestamptz < v_now then
    v_user := jsonb_set(v_user, '{boost_level}', to_jsonb(0), true);
    v_user := jsonb_set(v_user, '{boost_expires_at}', 'null'::jsonb, true);

    update public.kv_store_0f597298
    set value = v_user
    where key = v_user_key;
  end if;

  if (v_user ->> 'last_watch_at') is not null then
    v_last_watch := (v_user ->> 'last_watch_at')::timestamptz;
    if v_last_watch + make_interval(secs => v_cooldown_seconds) > v_now then
      v_cooldown_remaining := ceil(extract(epoch from (v_last_watch + make_interval(secs => v_cooldown_seconds) - v_now)));
      raise exception 'COOLDOWN_ACTIVE'
        using errcode = 'P0005',
              detail = jsonb_build_object('cooldown_remaining', v_cooldown_remaining)::text,
              hint = 'Ad watch cooldown is still active.';
    end if;
  end if;

  v_boost_level := coalesce((v_user ->> 'boost_level')::integer, 0);
  v_multiplier := case v_boost_level
    when 1 then 1.25
    when 2 then 1.5
    when 3 then 2
    when 4 then 3
    else 1
  end;

  v_reward := floor(v_base_reward * v_multiplier)::integer;
  if v_reward < 0 then
    v_reward := 0;
  end if;

  v_watch_count_key := format('watch_count:%s:%s', v_user_id, to_char(v_now, 'YYYY-MM-DD'));

  begin
    select public.increment_user_energy_and_watch_count(
      v_user_key,
      v_reward,
      v_now,
      v_watch_count_key,
      1,
      v_watch_limit
    )
    into v_result;
  exception
    when others then
      if sqlstate = 'P0001' then
        raise exception 'DAILY_LIMIT_REACHED'
          using errcode = 'P0001',
                hint = 'User has reached the daily ad watch limit.';
      else
        raise;
      end if;
  end;

  v_updated_user := coalesce(v_result -> 'user', '{}'::jsonb);
  v_watch_count := coalesce((v_result ->> 'watch_count')::integer, 0);
  v_daily_remaining := greatest(v_watch_limit - v_watch_count, 0);

  v_watch_log_key := format(
    'watch:%s:%s_%s',
    v_user_id,
    to_char(v_now, 'YYYYMMDDHH24MISSMS'),
    floor(random() * 1000000)::bigint
  );

  v_watch_log := jsonb_build_object(
    'user_id', v_user_id,
    'ad_id', coalesce(p_ad_id, 'unknown'),
    'reward', v_reward,
    'base_reward', v_base_reward,
    'multiplier', v_multiplier,
    'created_at', v_now
  );

  insert into public.kv_store_0f597298(key, value)
  values (v_watch_log_key, v_watch_log)
  on conflict (key) do nothing;

  return jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'new_balance', coalesce((v_updated_user ->> 'energy')::integer, 0),
    'multiplier', v_multiplier,
    'daily_watches_remaining', v_daily_remaining,
    'user', v_updated_user
  );
end;
$$;

create or replace function public.claim_partner_reward_v2(
  p_partner_id text,
  p_wallet_address text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := coalesce(nullif(auth.uid()::text, ''), nullif(request.jwt.claims ->> 'sub', ''));
  v_user_key text;
  v_user jsonb;
  v_wallet text := nullif(trim(p_wallet_address), '');
  v_wallet_sanitized text;
  v_partner record;
  v_now timestamptz := now();
  v_claim_key text;
  v_claim jsonb;
  v_result jsonb;
  v_updated_user jsonb;
  v_reward integer;
  v_log_key text;
  v_log_value jsonb;
  v_new_balance integer := 0;
begin
  if v_user_id is null then
    raise exception 'MISSING_USER' using errcode = '42501', hint = 'Authentication required to claim rewards.';
  end if;

  if p_partner_id is null or length(trim(p_partner_id)) = 0 then
    raise exception 'INVALID_PARTNER' using errcode = 'P0006', hint = 'Partner identifier is required.';
  end if;

  select id, name, reward, active
  into v_partner
  from public.partner_rewards
  where id = p_partner_id;

  if not found then
    raise exception 'PARTNER_NOT_FOUND' using errcode = 'P4040', hint = 'Partner is not registered.';
  end if;

  if not v_partner.active then
    raise exception 'PARTNER_INACTIVE' using errcode = 'P4030', hint = 'Partner reward is currently inactive.';
  end if;

  v_user_key := 'user:' || v_user_id;

  if v_wallet is not null then
    v_wallet_sanitized := left(regexp_replace(v_wallet, '[^A-Za-z0-9_-]', '', 'g'), 256);
  end if;

  select value into v_user from public.kv_store_0f597298 where key = v_user_key;

  if v_user is null then
    v_user := jsonb_build_object(
      'id', v_user_id,
      'energy', 0,
      'boost_level', 0,
      'last_watch_at', null,
      'boost_expires_at', null,
      'created_at', v_now,
      'wallet_address', coalesce(v_wallet_sanitized, null)
    );

    insert into public.kv_store_0f597298(key, value)
    values (v_user_key, v_user)
    on conflict (key) do nothing;

    select value into v_user from public.kv_store_0f597298 where key = v_user_key;
  elsif v_wallet_sanitized is not null and (v_user ->> 'wallet_address') is distinct from v_wallet_sanitized then
    update public.kv_store_0f597298
    set value = jsonb_set(v_user, '{wallet_address}', to_jsonb(v_wallet_sanitized), true)
    where key = v_user_key
    returning value into v_user;
  end if;

  if (v_user ->> 'boost_expires_at') is not null and (v_user ->> 'boost_expires_at')::timestamptz < v_now then
    v_user := jsonb_set(v_user, '{boost_level}', to_jsonb(0), true);
    v_user := jsonb_set(v_user, '{boost_expires_at}', 'null'::jsonb, true);

    update public.kv_store_0f597298
    set value = v_user
    where key = v_user_key;
  end if;

  v_reward := coalesce(v_partner.reward, 0);

  v_claim_key := format('reward_claim:%s:%s', v_user_id, p_partner_id);
  v_claim := jsonb_build_object(
    'partner_id', p_partner_id,
    'user_id', v_user_id,
    'reward', v_reward,
    'claimed_at', v_now
  );

  begin
    select public.claim_partner_reward(
      v_user_key,
      v_reward,
      v_claim_key,
      v_claim
    )
    into v_result;
  exception
    when unique_violation then
      raise exception 'REWARD_ALREADY_CLAIMED'
        using errcode = '23505',
              hint = 'This partner reward has already been claimed.';
  end;

  v_updated_user := coalesce(v_result -> 'user', '{}'::jsonb);
  v_new_balance := coalesce((v_updated_user ->> 'energy')::integer, 0);

  v_log_key := format(
    'reward_log:%s:%s_%s',
    v_user_id,
    to_char(v_now, 'YYYYMMDDHH24MISSMS'),
    floor(random() * 1000000)::bigint
  );

  v_log_value := v_claim || jsonb_build_object('partner_name', v_partner.name);

  insert into public.kv_store_0f597298(key, value)
  values (v_log_key, v_log_value)
  on conflict (key) do nothing;

  return jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'partner_name', v_partner.name,
    'new_balance', v_new_balance,
    'user', v_updated_user
  );
end;
$$;
