-- Migration: Ensure KV store table exists for edge function persistence

create table if not exists public.kv_store_0f597298 (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.kv_store_0f597298_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger kv_store_0f597298_set_updated_at
before update on public.kv_store_0f597298
for each row
execute function public.kv_store_0f597298_set_updated_at();
