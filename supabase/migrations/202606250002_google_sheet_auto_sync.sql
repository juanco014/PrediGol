create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

create table if not exists public.predigol_google_sheet_sync_config (
  id text primary key default 'default' check (id = 'default'),
  csv_url text,
  enabled boolean not null default false,
  import_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  last_synced_at timestamptz,
  last_result jsonb,
  last_error text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.predigol_google_sheet_sync_config enable row level security;

revoke all on table public.predigol_google_sheet_sync_config from public, anon, authenticated;

insert into public.predigol_google_sheet_sync_config (id)
values ('default')
on conflict (id) do nothing;

create or replace function public.obtener_google_sheet_sync_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.predigol_google_sheet_sync_config%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para ver la sincronizacion.';
  end if;

  select *
  into v_config
  from public.predigol_google_sheet_sync_config
  where id = 'default';

  if not found then
    insert into public.predigol_google_sheet_sync_config (id)
    values ('default')
    returning * into v_config;
  end if;

  return jsonb_build_object(
    'csv_url', v_config.csv_url,
    'enabled', v_config.enabled,
    'last_synced_at', v_config.last_synced_at,
    'last_result', v_config.last_result,
    'last_error', v_config.last_error,
    'updated_at', v_config.updated_at
  );
end;
$$;

create or replace function public.guardar_google_sheet_sync_config(
  p_csv_url text,
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config public.predigol_google_sheet_sync_config%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para configurar la sincronizacion.';
  end if;

  if p_enabled = true and nullif(trim(p_csv_url), '') is null then
    raise exception 'La URL de Google Sheets es obligatoria para activar la sincronizacion.';
  end if;

  insert into public.predigol_google_sheet_sync_config (
    id,
    csv_url,
    enabled,
    updated_by,
    updated_at
  )
  values (
    'default',
    nullif(trim(p_csv_url), ''),
    p_enabled,
    auth.uid(),
    now()
  )
  on conflict (id) do update
  set
    csv_url = excluded.csv_url,
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_config;

  return jsonb_build_object(
    'csv_url', v_config.csv_url,
    'enabled', v_config.enabled,
    'last_synced_at', v_config.last_synced_at,
    'last_result', v_config.last_result,
    'last_error', v_config.last_error,
    'updated_at', v_config.updated_at
  );
end;
$$;

create or replace function public.registrar_google_sheet_sync_result(
  p_result jsonb,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.predigol_google_sheet_sync_config
  set
    last_synced_at = now(),
    last_result = p_result,
    last_error = p_error,
    updated_at = now()
  where id = 'default';
end;
$$;

revoke all on function public.obtener_google_sheet_sync_config() from public, anon, authenticated;
revoke all on function public.guardar_google_sheet_sync_config(text, boolean) from public, anon, authenticated;
revoke all on function public.registrar_google_sheet_sync_result(jsonb, text) from public, anon, authenticated;

grant execute on function public.obtener_google_sheet_sync_config() to authenticated, service_role;
grant execute on function public.guardar_google_sheet_sync_config(text, boolean) to authenticated, service_role;
grant execute on function public.registrar_google_sheet_sync_result(jsonb, text) to service_role;

do $$
begin
  perform cron.unschedule('predigol-sync-google-sheet-fixtures-hourly');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'predigol-sync-google-sheet-fixtures-hourly',
  '0 * * * *',
  $$
  select
    net.http_post(
      url := 'https://aadkcyoyjxglrbiwfdgw.supabase.co/functions/v1/import-google-sheet-fixtures',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-import-secret', import_secret
      ),
      body := jsonb_build_object(
        'trigger', 'pg_cron',
        'scheduled_at', now()
      )
    ) as request_id
  from public.predigol_google_sheet_sync_config
  where id = 'default'
    and enabled = true
    and nullif(trim(csv_url), '') is not null;
  $$
);
