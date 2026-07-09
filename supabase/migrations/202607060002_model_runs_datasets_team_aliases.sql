create extension if not exists pgcrypto with schema extensions;

create table if not exists public.model_datasets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  description text,
  source_type text not null check (source_type in ('supabase', 'csv', 'api', 'manual', 'mixed')),
  source_name text,
  season integer,
  competition text,
  date_from timestamptz,
  date_to timestamptz,
  total_matches integer not null default 0 check (total_matches >= 0),
  finished_matches integer not null default 0 check (finished_matches >= 0),
  valid_matches integer not null default 0 check (valid_matches >= 0),
  discarded_matches integer not null default 0 check (discarded_matches >= 0),
  cleaning_criteria jsonb not null default '{}'::jsonb,
  team_normalization_version text,
  checksum text,
  status text not null default 'draft' check (status in ('draft', 'validated', 'active', 'archived', 'failed')),
  quality_summary jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  model_version text not null,
  run_type text not null check (run_type in ('diagnostic', 'prediction', 'dry_run', 'backtest', 'training', 'calibration', 'import_validation')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  requested_by uuid references auth.users(id),
  dataset_id uuid references public.model_datasets(id) on delete set null,
  date_from timestamptz,
  date_to timestamptz,
  tournaments text[] not null default array[]::text[],
  available_matches integer not null default 0 check (available_matches >= 0),
  used_matches integer not null default 0 check (used_matches >= 0),
  discarded_matches integer not null default 0 check (discarded_matches >= 0),
  model_config jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error_detail text,
  code_version text,
  config_hash text,
  admin_notes text
);

create table if not exists public.team_aliases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  canonical_name text not null,
  canonical_key text not null,
  alias text not null,
  alias_key text not null,
  tournament text,
  country text,
  active boolean not null default true,
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  source text not null default 'manual',
  confidence numeric(5, 4) not null default 0.5000 check (confidence >= 0 and confidence <= 1),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create unique index if not exists team_aliases_alias_scope_key
  on public.team_aliases(alias_key, coalesce(tournament, ''), coalesce(country, ''));

create index if not exists team_aliases_canonical_key_idx
  on public.team_aliases(canonical_key);
create index if not exists team_aliases_status_active_idx
  on public.team_aliases(status, active);
create index if not exists team_aliases_tournament_idx
  on public.team_aliases(tournament);

create index if not exists model_datasets_created_at_idx
  on public.model_datasets(created_at desc);
create unique index if not exists model_datasets_checksum_key
  on public.model_datasets(checksum);
create index if not exists model_datasets_status_idx
  on public.model_datasets(status);
create index if not exists model_datasets_competition_season_idx
  on public.model_datasets(competition, season);
create index if not exists model_datasets_date_range_idx
  on public.model_datasets(date_from, date_to);

create index if not exists model_runs_created_at_idx
  on public.model_runs(created_at desc);
create index if not exists model_runs_model_status_idx
  on public.model_runs(model_version, status, created_at desc);
create index if not exists model_runs_type_idx
  on public.model_runs(run_type, created_at desc);
create index if not exists model_runs_dataset_idx
  on public.model_runs(dataset_id, created_at desc);
create index if not exists model_runs_date_range_idx
  on public.model_runs(date_from, date_to);

alter table public.model_datasets enable row level security;
alter table public.model_runs enable row level security;
alter table public.team_aliases enable row level security;

drop policy if exists "model_datasets_admin_read" on public.model_datasets;
create policy "model_datasets_admin_read"
  on public.model_datasets for select to authenticated
  using (public.predigol_es_admin());

drop policy if exists "model_runs_admin_read" on public.model_runs;
create policy "model_runs_admin_read"
  on public.model_runs for select to authenticated
  using (public.predigol_es_admin());

drop policy if exists "team_aliases_admin_read" on public.team_aliases;
create policy "team_aliases_admin_read"
  on public.team_aliases for select to authenticated
  using (public.predigol_es_admin());

grant select on public.model_datasets to authenticated;
grant select on public.model_runs to authenticated;
grant select on public.team_aliases to authenticated;
grant all on public.model_datasets to service_role;
grant all on public.model_runs to service_role;
grant all on public.team_aliases to service_role;

create or replace function public.obtener_model_admin_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_last_success jsonb;
  v_last_backtest jsonb;
  v_last_import jsonb;
  v_history jsonb;
  v_aliases jsonb;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para consultar administracion del modelo.';
  end if;

  select coalesce(public.obtener_model_prediction_settings(), '{"active_model":"V1"}'::jsonb)
  into v_settings;

  select to_jsonb(run) into v_last_success
  from public.model_runs run
  where run.status = 'completed'
  order by run.finished_at desc nulls last, run.created_at desc
  limit 1;

  select to_jsonb(run) into v_last_backtest
  from public.model_runs run
  where run.run_type = 'backtest'
  order by run.finished_at desc nulls last, run.created_at desc
  limit 1;

  select to_jsonb(dataset) into v_last_import
  from public.model_datasets dataset
  where dataset.source_type in ('csv', 'api', 'manual', 'mixed')
  order by dataset.updated_at desc, dataset.created_at desc
  limit 1;

  select jsonb_build_object(
    'valid_matches', count(*) filter (
      where estado = 'finalizado'
        and goles_local_final is not null
        and goles_visitante_final is not null
    ),
    'finished_matches', count(*) filter (where estado = 'finalizado'),
    'date_from', min(fecha_orden) filter (
      where estado = 'finalizado'
        and goles_local_final is not null
        and goles_visitante_final is not null
    ),
    'date_to', max(fecha_orden) filter (
      where estado = 'finalizado'
        and goles_local_final is not null
        and goles_visitante_final is not null
    ),
    'tournaments', coalesce(jsonb_agg(distinct torneo) filter (where torneo is not null), '[]'::jsonb)
  ) into v_history
  from public.partidos;

  select jsonb_build_object(
    'normalized_teams', count(distinct canonical_key) filter (where active and status = 'approved'),
    'pending_aliases', count(*) filter (where active and status = 'pending_review'),
    'total_aliases', count(*)
  ) into v_aliases
  from public.team_aliases;

  return jsonb_build_object(
    'settings', coalesce(v_settings, '{"active_model":"V1"}'::jsonb),
    'last_successful_run', v_last_success,
    'last_backtest', v_last_backtest,
    'last_import', v_last_import,
    'history', coalesce(v_history, '{}'::jsonb),
    'aliases', coalesce(v_aliases, '{}'::jsonb),
    'supabase', jsonb_build_object('configured', true),
    'python', jsonb_build_object('status', 'external_script_required')
  );
end;
$$;

create or replace function public.guardar_team_alias(
  p_canonical_name text,
  p_canonical_key text,
  p_alias text,
  p_alias_key text,
  p_tournament text default null,
  p_country text default null,
  p_status text default 'approved',
  p_source text default 'manual',
  p_confidence numeric default 1.0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.team_aliases%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para guardar alias de equipos.';
  end if;

  if p_status not in ('pending_review', 'approved', 'rejected') then
    raise exception 'Estado de alias invalido.';
  end if;

  insert into public.team_aliases (
    canonical_name, canonical_key, alias, alias_key, tournament, country,
    status, source, confidence, notes, created_by, updated_by
  ) values (
    trim(p_canonical_name), p_canonical_key, trim(p_alias), p_alias_key, nullif(trim(p_tournament), ''),
    nullif(trim(p_country), ''), p_status, coalesce(nullif(trim(p_source), ''), 'manual'),
    least(greatest(coalesce(p_confidence, 0.5), 0), 1), p_notes, auth.uid(), auth.uid()
  )
  on conflict (alias_key, (coalesce(tournament, '')), (coalesce(country, ''))) do update
  set canonical_name = excluded.canonical_name,
      canonical_key = excluded.canonical_key,
      alias = excluded.alias,
      active = true,
      status = excluded.status,
      source = excluded.source,
      confidence = excluded.confidence,
      notes = excluded.notes,
      updated_at = now(),
      updated_by = auth.uid()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.actualizar_estado_team_alias(
  p_alias_id uuid,
  p_status text,
  p_active boolean default true,
  p_canonical_name text default null,
  p_canonical_key text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.team_aliases%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para actualizar alias de equipos.';
  end if;

  if p_status not in ('pending_review', 'approved', 'rejected') then
    raise exception 'Estado de alias invalido.';
  end if;

  update public.team_aliases
  set status = p_status,
      active = coalesce(p_active, active),
      canonical_name = coalesce(nullif(trim(p_canonical_name), ''), canonical_name),
      canonical_key = coalesce(nullif(trim(p_canonical_key), ''), canonical_key),
      notes = coalesce(p_notes, notes),
      updated_at = now(),
      updated_by = auth.uid()
  where id = p_alias_id
  returning * into v_row;

  if not found then
    raise exception 'Alias no encontrado.';
  end if;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.obtener_model_admin_summary() to authenticated, service_role;
grant execute on function public.guardar_team_alias(text, text, text, text, text, text, text, text, numeric, text) to authenticated, service_role;
grant execute on function public.actualizar_estado_team_alias(uuid, text, boolean, text, text, text) to authenticated, service_role;
