-- Migration: Add relational tables for watch analytics and session tracking

-- Create watch_logs table for ad watch events
create table if not exists public.watch_logs (
  id bigserial primary key,
  user_id text not null,
  ad_id text not null,
  reward integer not null,
  base_reward integer not null,
  multiplier numeric(6,3) not null,
  country_code text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists watch_logs_user_id_idx on public.watch_logs(user_id);
create index if not exists watch_logs_created_at_idx on public.watch_logs(created_at);

-- Create user_sessions table to keep track of login activity
create table if not exists public.user_sessions (
  id bigserial primary key,
  user_id text not null,
  country_code text,
  created_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_sessions_user_id_idx on public.user_sessions(user_id);
create index if not exists user_sessions_created_at_idx on public.user_sessions(created_at);

-- Function to track/update user sessions (usable from RPC or triggers)
create or replace function public.track_user_session(
  p_user_id text,
  p_activity_at timestamptz default timezone('utc', now()),
  p_country_code text default null
)
returns boolean
language plpgsql
as $$
declare
  existing_id bigint;
begin
  select id
  into existing_id
  from public.user_sessions
  where user_id = p_user_id
    and last_activity_at >= p_activity_at - interval '30 minutes'
  order by last_activity_at desc
  limit 1;

  if existing_id is null then
    insert into public.user_sessions (user_id, country_code, created_at, last_activity_at)
    values (p_user_id, p_country_code, p_activity_at, p_activity_at);
  else
    update public.user_sessions
    set
      last_activity_at = greatest(last_activity_at, p_activity_at),
      country_code = coalesce(country_code, p_country_code)
    where id = existing_id;
  end if;

  return true;
end;
$$;

-- Trigger to automatically track sessions whenever a watch log is inserted
create or replace function public.watch_logs_track_session()
returns trigger
language plpgsql
as $$
begin
  perform public.track_user_session(new.user_id, new.created_at, new.country_code);
  return new;
end;
$$;

create trigger watch_logs_after_insert_track_session
after insert on public.watch_logs
for each row
execute function public.watch_logs_track_session();

-- Update RPC to append watch log rows and leverage the relational tables
create or replace function public.increment_user_energy_and_watch_count(
  user_key text,
  energy_delta integer,
  last_watch_at timestamptz,
  watch_count_key text,
  watch_increment integer,
  daily_limit integer,
  watch_ad_id text,
  watch_base_reward integer,
  watch_multiplier numeric,
  watch_country_code text
)
returns jsonb
language plpgsql
as $$
declare
  watch_count integer;
  updated_user jsonb;
  extracted_user_id text;
  effective_watch_at timestamptz := coalesce(last_watch_at, timezone('utc', now()));
  effective_ad_id text := coalesce(nullif(watch_ad_id, ''), 'unknown');
  effective_country text := nullif(watch_country_code, '');
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
      to_jsonb(effective_watch_at)
    )
  where key = user_key
  returning value into updated_user;

  if updated_user is null then
    raise exception using message = 'USER_NOT_FOUND', errcode = 'P0002';
  end if;

  extracted_user_id := split_part(user_key, ':', 2);

  insert into public.watch_logs (user_id, ad_id, reward, base_reward, multiplier, country_code, created_at)
  values (extracted_user_id, effective_ad_id, energy_delta, watch_base_reward, watch_multiplier, effective_country, effective_watch_at);

  perform public.track_user_session(extracted_user_id, effective_watch_at, effective_country);

  return jsonb_build_object(
    'user', updated_user,
    'watch_count', watch_count
  );
end;
$$;
