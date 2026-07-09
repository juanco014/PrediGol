create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_error_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('react', 'window', 'promise')),
  message text not null check (char_length(message) between 1 and 500),
  route text not null default '/' check (char_length(route) <= 300),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_error_logs_created_at_idx
  on public.app_error_logs(created_at desc);

create index if not exists app_error_logs_user_created_idx
  on public.app_error_logs(user_id, created_at desc);

alter table public.app_error_logs enable row level security;

drop policy if exists "app_error_logs_admin_read" on public.app_error_logs;
create policy "app_error_logs_admin_read"
  on public.app_error_logs
  for select
  to authenticated
  using (public.predigol_es_admin());

grant select on public.app_error_logs to authenticated;

create or replace function public.registrar_error_cliente(
  p_source text,
  p_message text,
  p_route text default '/',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_source text;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesion para registrar un error.';
  end if;

  v_source := case
    when p_source in ('react', 'window', 'promise') then p_source
    else 'window'
  end;

  insert into public.app_error_logs (
    user_id,
    source,
    message,
    route,
    metadata
  )
  values (
    v_user_id,
    v_source,
    left(coalesce(nullif(trim(p_message), ''), 'Error sin mensaje'), 500),
    left(coalesce(nullif(split_part(p_route, '?', 1), ''), '/'), 300),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_error_cliente(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.registrar_error_cliente(text, text, text, jsonb)
  to authenticated;
