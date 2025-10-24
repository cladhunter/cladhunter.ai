-- Migration: Atomic KV store updates for energy and rewards

create or replace function public.increment_user_energy_and_watch_count(
  user_key text,
  energy_delta integer,
  last_watch_at timestamptz,
  watch_count_key text,
  watch_increment integer,
  daily_limit integer
)
returns jsonb
language plpgsql
as $$
declare
  watch_count integer;
  updated_user jsonb;
begin
  with watch_upsert as (
    insert into public.kv_store_0f597298(key, value)
    values (watch_count_key, to_jsonb(watch_increment))
    on conflict (key) do update
      set value = to_jsonb(
        ( (public.kv_store_0f597298.value::text)::integer + watch_increment )
      )
    returning (value::text)::integer as new_count
  )
  select new_count into watch_count from watch_upsert;

  if watch_count is null then
    watch_count := watch_increment;
  end if;

  if daily_limit is not null and watch_count > daily_limit then
    raise exception using message = 'DAILY_LIMIT_EXCEEDED', errcode = 'P0001';
  end if;

  update public.kv_store_0f597298
  set value = jsonb_set(
      jsonb_set(
        value,
        '{energy}',
        to_jsonb(coalesce((value ->> 'energy')::integer, 0) + energy_delta)
      ),
      '{last_watch_at}',
      to_jsonb(last_watch_at)
    )
  where key = user_key
  returning value into updated_user;

  if updated_user is null then
    raise exception using message = 'USER_NOT_FOUND', errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'user', updated_user,
    'watch_count', watch_count
  );
end;
$$;

create or replace function public.claim_partner_reward(
  user_key text,
  energy_delta integer,
  claim_key text,
  claim_value jsonb
)
returns jsonb
language plpgsql
as $$
declare
  updated_user jsonb;
begin
  insert into public.kv_store_0f597298(key, value)
  values (claim_key, claim_value);

  update public.kv_store_0f597298
  set value = jsonb_set(
      value,
      '{energy}',
      to_jsonb(coalesce((value ->> 'energy')::integer, 0) + energy_delta)
    )
  where key = user_key
  returning value into updated_user;

  if updated_user is null then
    raise exception using message = 'USER_NOT_FOUND', errcode = 'P0002';
  end if;

  return jsonb_build_object('user', updated_user);
exception
  when unique_violation then
    raise exception using message = 'REWARD_ALREADY_CLAIMED', errcode = '23505';
end;
$$;
