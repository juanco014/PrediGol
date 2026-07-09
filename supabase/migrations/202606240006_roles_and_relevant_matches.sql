alter table if exists public.profiles
  add column if not exists rol text not null default 'usuario';

alter table if exists public.partidos
  add column if not exists es_relevante boolean not null default false,
  add column if not exists prioridad_visual integer not null default 100;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_rol_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_rol_check
      check (rol in ('usuario', 'admin'));
  end if;
end $$;

update public.profiles
set rol = 'admin'
where es_admin = true;

update public.partidos
set
  es_relevante = true,
  prioridad_visual = least(prioridad_visual, 10)
where origen_datos = 'manual'
  and estado in ('proximo', 'en_vivo');

create index if not exists partidos_relevantes_fecha_idx
  on public.partidos(es_relevante, prioridad_visual, fecha_orden);

create or replace function public.predigol_es_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and (rol = 'admin' or es_admin = true)
    ),
    false
  );
$$;

create or replace function public.reclamar_primer_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesion.';
  end if;

  if exists (select 1 from public.profiles where rol = 'admin' or es_admin = true) then
    raise exception 'Ya existe un administrador.';
  end if;

  update public.profiles
  set
    es_admin = true,
    rol = 'admin'
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'No se encontro tu perfil.';
  end if;

  return to_jsonb(v_profile);
end;
$$;

create or replace function public.marcar_partido_relevante(
  p_partido_id text,
  p_es_relevante boolean,
  p_prioridad_visual integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partido public.partidos%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para administrar partidos.';
  end if;

  update public.partidos
  set
    es_relevante = p_es_relevante,
    prioridad_visual = coalesce(p_prioridad_visual, prioridad_visual)
  where id::text = p_partido_id
  returning * into v_partido;

  if not found then
    raise exception 'No se encontro el partido con id %.', p_partido_id;
  end if;

  return to_jsonb(v_partido);
end;
$$;

create or replace function public.crear_partido_manual(
  p_torneo text,
  p_fecha_orden timestamptz,
  p_local_nombre text,
  p_visitante_nombre text,
  p_local_corto text default null,
  p_visitante_corto text default null,
  p_temporada integer default null,
  p_ronda text default null,
  p_fuente_detalle text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture_id bigint := -nextval('public.manual_fixture_id_seq');
  v_home_team_id bigint := -nextval('public.manual_team_id_seq');
  v_away_team_id bigint := -nextval('public.manual_team_id_seq');
  v_season integer := coalesce(p_temporada, extract(year from p_fecha_orden at time zone 'America/Bogota')::integer);
  v_local_corto text := coalesce(nullif(trim(p_local_corto), ''), public.predigol_codigo_equipo(p_local_nombre));
  v_visitante_corto text := coalesce(nullif(trim(p_visitante_corto), ''), public.predigol_codigo_equipo(p_visitante_nombre));
  v_partido public.partidos%rowtype;
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para administrar partidos.';
  end if;

  if nullif(trim(p_torneo), '') is null then
    raise exception 'El torneo es obligatorio.';
  end if;

  if p_fecha_orden is null then
    raise exception 'La fecha del partido es obligatoria.';
  end if;

  if nullif(trim(p_local_nombre), '') is null or nullif(trim(p_visitante_nombre), '') is null then
    raise exception 'Local y visitante son obligatorios.';
  end if;

  insert into public.football_teams (
    api_football_team_id,
    name,
    code,
    country,
    national,
    raw_payload,
    updated_at
  )
  values
    (
      v_home_team_id,
      trim(p_local_nombre),
      v_local_corto,
      null,
      false,
      jsonb_build_object('source', 'manual'),
      now()
    ),
    (
      v_away_team_id,
      trim(p_visitante_nombre),
      v_visitante_corto,
      null,
      false,
      jsonb_build_object('source', 'manual'),
      now()
    );

  insert into public.football_fixtures (
    api_football_fixture_id,
    competition_api_id,
    season_start_year,
    round,
    kickoff_at,
    timezone,
    status,
    status_short,
    home_team_api_id,
    away_team_api_id,
    raw_payload,
    updated_at
  )
  values (
    v_fixture_id,
    null,
    v_season,
    p_ronda,
    p_fecha_orden,
    'America/Bogota',
    'proximo',
    'MANUAL',
    v_home_team_id,
    v_away_team_id,
    jsonb_build_object(
      'source', 'manual',
      'torneo', trim(p_torneo),
      'local', trim(p_local_nombre),
      'visitante', trim(p_visitante_nombre)
    ),
    now()
  );

  insert into public.partidos (
    id,
    torneo,
    fecha_texto,
    fecha_orden,
    local_nombre,
    visitante_nombre,
    local_corto,
    visitante_corto,
    estado,
    goles_local_final,
    goles_visitante_final,
    api_football_fixture_id,
    api_football_league_id,
    temporada,
    ronda,
    minuto,
    payload_api,
    actualizado_api_en,
    origen_datos,
    fuente_detalle,
    creado_manual_en,
    es_relevante,
    prioridad_visual
  )
  values (
    v_fixture_id,
    trim(p_torneo),
    to_char(p_fecha_orden at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI'),
    p_fecha_orden,
    trim(p_local_nombre),
    trim(p_visitante_nombre),
    v_local_corto,
    v_visitante_corto,
    'proximo',
    null,
    null,
    v_fixture_id,
    null,
    v_season,
    p_ronda,
    null,
    jsonb_build_object(
      'source', 'manual',
      'manual_fixture_id', v_fixture_id,
      'fuente_detalle', p_fuente_detalle
    ),
    now(),
    'manual',
    p_fuente_detalle,
    now(),
    true,
    10
  )
  returning * into v_partido;

  return to_jsonb(v_partido);
end;
$$;

revoke all on function public.predigol_es_admin() from public, anon, authenticated;
revoke all on function public.marcar_partido_relevante(text, boolean, integer) from public, anon, authenticated;

grant execute on function public.predigol_es_admin() to authenticated, service_role;
grant execute on function public.reclamar_primer_admin() to authenticated;
grant execute on function public.crear_partido_manual(text, timestamptz, text, text, text, text, integer, text, text) to authenticated, service_role;
grant execute on function public.marcar_partido_relevante(text, boolean, integer) to authenticated, service_role;
