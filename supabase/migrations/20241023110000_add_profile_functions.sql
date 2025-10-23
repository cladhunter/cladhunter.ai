create or replace function public.ensure_profile(
  p_user_id text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception 'user_id_missing';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select *
    into v_profile
    from public.profiles
   where id = p_user_id
   for update;

  if v_profile.boost_expires_at is not null and v_profile.boost_expires_at < v_now then
    v_profile.boost_level := 0;
    v_profile.boost_expires_at := null;

    update public.profiles
       set boost_level = v_profile.boost_level,
           boost_expires_at = v_profile.boost_expires_at
     where id = p_user_id;
  end if;

  return v_profile;
end;
$$;

create or replace function public.complete_ad_watch(
  p_user_id text,
  p_ad_id text,
  p_base_reward integer default 10,
  p_daily_limit integer default 200,
  p_cooldown_seconds integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_multiplier numeric := 1;
  v_seconds_since_last numeric;
  v_watches_today integer;
  v_reward integer;
  v_remaining integer;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception 'user_id_missing';
  end if;

  if p_ad_id is null or length(trim(p_ad_id)) = 0 then
    raise exception 'ad_id_missing';
  end if;

  if length(p_ad_id) > 128 then
    raise exception 'ad_id_too_long';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select *
    into v_profile
    from public.profiles
   where id = p_user_id
   for update;

  if not found then
    raise exception 'profile_missing';
  end if;

  if v_profile.boost_expires_at is not null and v_profile.boost_expires_at < v_now then
    v_profile.boost_level := 0;
    v_profile.boost_expires_at := null;
  end if;

  v_multiplier := case v_profile.boost_level
    when 1 then 1.25
    when 2 then 1.5
    when 3 then 2
    when 4 then 3
    else 1
  end;

  if v_profile.last_watch_at is not null then
    v_seconds_since_last := extract(epoch from (v_now - v_profile.last_watch_at));
    if v_seconds_since_last < p_cooldown_seconds then
      v_remaining := ceil(p_cooldown_seconds - v_seconds_since_last);
      raise exception 'cooldown_active'
        using errcode = 'P0001',
              detail = json_build_object('cooldown_remaining', v_remaining)::text;
    end if;
  end if;

  select count(*)
    into v_watches_today
    from public.ad_watches
   where user_id = p_user_id
     and created_at >= date_trunc('day', v_now)
     and created_at < date_trunc('day', v_now) + interval '1 day';

  if v_watches_today >= p_daily_limit then
    raise exception 'daily_limit_reached'
      using errcode = 'P0001',
            detail = json_build_object('daily_limit', p_daily_limit)::text;
  end if;

  v_reward := floor(p_base_reward * v_multiplier);

  update public.profiles
     set energy = energy + v_reward,
         last_watch_at = v_now,
         boost_level = v_profile.boost_level,
         boost_expires_at = v_profile.boost_expires_at
   where id = p_user_id
   returning * into v_profile;

  insert into public.ad_watches(user_id, ad_id, reward, base_reward, multiplier, created_at)
  values (p_user_id, p_ad_id, v_reward, p_base_reward, v_multiplier, v_now);

  return jsonb_build_object(
    'reward', v_reward,
    'new_balance', v_profile.energy,
    'multiplier', v_multiplier,
    'daily_watches_remaining', p_daily_limit - (v_watches_today + 1),
    'boost_level', v_profile.boost_level,
    'boost_expires_at', v_profile.boost_expires_at,
    'last_watch_at', v_profile.last_watch_at
  );
end;
$$;
