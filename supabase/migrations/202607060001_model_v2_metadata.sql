alter table public.model_predictions
  add column if not exists quality_warnings jsonb not null default '[]'::jsonb,
  add column if not exists data_quality jsonb not null default '{}'::jsonb,
  add column if not exists probabilities_uncalibrated jsonb,
  add column if not exists probabilities_calibrated jsonb,
  add column if not exists history_matches_used integer,
  add column if not exists model_parameters jsonb not null default '{}'::jsonb;

create table if not exists public.model_prediction_settings (
  id text primary key default 'default',
  active_model text not null default 'V1' check (active_model in ('V1', 'V2')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.model_prediction_settings (id, active_model)
values ('default', 'V1')
on conflict (id) do nothing;

alter table public.model_prediction_settings enable row level security;

drop policy if exists "model_prediction_settings_admin_read" on public.model_prediction_settings;
create policy "model_prediction_settings_admin_read"
  on public.model_prediction_settings
  for select
  to authenticated
  using (public.predigol_es_admin());

create or replace function public.obtener_model_prediction_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.model_prediction_settings%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para consultar la configuracion del modelo.';
  end if;

  select * into v_settings
  from public.model_prediction_settings
  where id = 'default';

  return jsonb_build_object(
    'active_model', coalesce(v_settings.active_model, 'V1'),
    'updated_at', v_settings.updated_at
  );
end;
$$;

create or replace function public.guardar_model_prediction_settings(p_active_model text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para cambiar la configuracion del modelo.';
  end if;

  if p_active_model not in ('V1', 'V2') then
    raise exception 'Modelo invalido. Usa V1 o V2.';
  end if;

  insert into public.model_prediction_settings (id, active_model, updated_by)
  values ('default', p_active_model, auth.uid())
  on conflict (id) do update
  set active_model = excluded.active_model,
      updated_at = now(),
      updated_by = auth.uid();

  return public.obtener_model_prediction_settings();
end;
$$;

grant execute on function public.obtener_model_prediction_settings() to authenticated, service_role;
grant execute on function public.guardar_model_prediction_settings(text) to authenticated, service_role;

create index if not exists model_predictions_model_version_generated_idx
  on public.model_predictions(model_version, generated_at desc);
