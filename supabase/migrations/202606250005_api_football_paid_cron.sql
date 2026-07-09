create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table if not exists public.predigol_api_football_sync_config (
  id text primary key default 'default',
  enabled boolean not null default false,
  sync_upcoming boolean not null default true,
  sync_live boolean not null default true,
  sync_results boolean not null default true,
  season integer,
  upcoming_limit integer not null default 15,
  updated_at timestamptz not null default now(),
  last_note text
);

insert into public.predigol_api_football_sync_config (id)
values ('default')
on conflict (id) do nothing;

alter table public.predigol_api_football_sync_config enable row level security;

drop policy if exists "api_football_sync_config_admin_read" on public.predigol_api_football_sync_config;
create policy "api_football_sync_config_admin_read"
  on public.predigol_api_football_sync_config
  for select
  to authenticated
  using (public.predigol_es_admin());

create or replace function public.obtener_api_football_sync_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.predigol_api_football_sync_config%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para ver la sincronizacion de API-Football.';
  end if;

  select *
  into v_config
  from public.predigol_api_football_sync_config
  where id = 'default';

  return to_jsonb(v_config);
end;
$$;

create or replace function public.guardar_api_football_sync_config(
  p_enabled boolean,
  p_season integer default null,
  p_upcoming_limit integer default 15,
  p_sync_upcoming boolean default true,
  p_sync_live boolean default true,
  p_sync_results boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.predigol_api_football_sync_config%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para configurar API-Football.';
  end if;

  if p_upcoming_limit < 1 or p_upcoming_limit > 50 then
    raise exception 'El limite debe estar entre 1 y 50.';
  end if;

  update public.predigol_api_football_sync_config
  set
    enabled = coalesce(p_enabled, false),
    season = p_season,
    upcoming_limit = p_upcoming_limit,
    sync_upcoming = coalesce(p_sync_upcoming, true),
    sync_live = coalesce(p_sync_live, true),
    sync_results = coalesce(p_sync_results, true),
    updated_at = now(),
    last_note = case
      when coalesce(p_enabled, false) then 'API-Football cron habilitado por admin.'
      else 'API-Football cron deshabilitado.'
    end
  where id = 'default'
  returning * into v_config;

  return to_jsonb(v_config);
end;
$$;

revoke all on function public.obtener_api_football_sync_config() from public, anon, authenticated;
revoke all on function public.guardar_api_football_sync_config(boolean, integer, integer, boolean, boolean, boolean) from public, anon, authenticated;

grant execute on function public.obtener_api_football_sync_config() to authenticated, service_role;
grant execute on function public.guardar_api_football_sync_config(boolean, integer, integer, boolean, boolean, boolean) to authenticated, service_role;

do $$
begin
  perform cron.unschedule('predigol-api-football-live-every-5-min');
exception
  when others then
    null;
end $$;

do $$
begin
  perform cron.unschedule('predigol-api-football-upcoming-hourly');
exception
  when others then
    null;
end $$;

do $$
begin
  perform cron.unschedule('predigol-api-football-results-hourly');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'predigol-api-football-live-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://aadkcyoyjxglrbiwfdgw.supabase.co/functions/v1/sync-live-fixtures?mode=live',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('trigger', 'pg_cron', 'mode', 'live', 'scheduled_at', now())
  )
  from public.predigol_api_football_sync_config
  where id = 'default'
    and enabled = true
    and sync_live = true;
  $$
);

select cron.schedule(
  'predigol-api-football-upcoming-hourly',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://aadkcyoyjxglrbiwfdgw.supabase.co/functions/v1/sync-live-fixtures?mode=upcoming'
      || case when season is not null then '&season=' || season::text else '' end
      || '&limit=' || upcoming_limit::text,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('trigger', 'pg_cron', 'mode', 'upcoming', 'scheduled_at', now())
  )
  from public.predigol_api_football_sync_config
  where id = 'default'
    and enabled = true
    and sync_upcoming = true;
  $$
);

select cron.schedule(
  'predigol-api-football-results-hourly',
  '45 * * * *',
  $$
  select net.http_post(
    url := 'https://aadkcyoyjxglrbiwfdgw.supabase.co/functions/v1/sync-live-fixtures?mode=results'
      || case when season is not null then '&season=' || season::text else '' end
      || '&limit=' || upcoming_limit::text,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('trigger', 'pg_cron', 'mode', 'results', 'scheduled_at', now())
  )
  from public.predigol_api_football_sync_config
  where id = 'default'
    and enabled = true
    and sync_results = true;
  $$
);
