alter table if exists public.profiles
  add column if not exists es_admin boolean not null default false;

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
        and es_admin = true
    ),
    false
  );
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
    creado_manual_en
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
    now()
  )
  returning * into v_partido;

  return to_jsonb(v_partido);
end;
$$;

create or replace function public.cerrar_partido_manual(
  p_partido_id text,
  p_goles_local integer,
  p_goles_visitante integer
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

  if p_goles_local < 0 or p_goles_visitante < 0 then
    raise exception 'Los goles no pueden ser negativos.';
  end if;

  update public.partidos
  set
    estado = 'finalizado',
    fecha_texto = 'Finalizado',
    goles_local_final = p_goles_local,
    goles_visitante_final = p_goles_visitante,
    minuto = null,
    actualizado_api_en = now()
  where id::text = p_partido_id
  returning * into v_partido;

  if not found then
    raise exception 'No se encontro el partido con id %.', p_partido_id;
  end if;

  if v_partido.api_football_fixture_id is not null then
    update public.football_fixtures
    set
      status = 'finalizado',
      status_short = 'FT',
      elapsed = null,
      goals_home = p_goles_local,
      goals_away = p_goles_visitante,
      score_fulltime_home = p_goles_local,
      score_fulltime_away = p_goles_visitante,
      updated_at = now()
    where api_football_fixture_id = v_partido.api_football_fixture_id;
  end if;

  return to_jsonb(v_partido);
end;
$$;

create or replace function public.cancelar_partido_manual(p_partido_id text)
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
    estado = 'cancelado',
    fecha_texto = 'Cancelado',
    minuto = null,
    actualizado_api_en = now()
  where id::text = p_partido_id
  returning * into v_partido;

  if not found then
    raise exception 'No se encontro el partido con id %.', p_partido_id;
  end if;

  if v_partido.api_football_fixture_id is not null then
    update public.football_fixtures
    set
      status = 'cancelado',
      status_short = 'CANC',
      elapsed = null,
      updated_at = now()
    where api_football_fixture_id = v_partido.api_football_fixture_id;
  end if;

  return to_jsonb(v_partido);
end;
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

  if exists (select 1 from public.profiles where es_admin = true) then
    raise exception 'Ya existe un administrador.';
  end if;

  update public.profiles
  set es_admin = true
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'No se encontro tu perfil.';
  end if;

  return to_jsonb(v_profile);
end;
$$;

revoke all on function public.predigol_es_admin() from public, anon, authenticated;
revoke all on function public.crear_partido_manual(text, timestamptz, text, text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.cerrar_partido_manual(text, integer, integer) from public, anon, authenticated;
revoke all on function public.cancelar_partido_manual(text) from public, anon, authenticated;
revoke all on function public.reclamar_primer_admin() from public, anon, authenticated;

grant execute on function public.predigol_es_admin() to authenticated, service_role;
grant execute on function public.crear_partido_manual(text, timestamptz, text, text, text, text, integer, text, text) to authenticated, service_role;
grant execute on function public.cerrar_partido_manual(text, integer, integer) to authenticated, service_role;
grant execute on function public.cancelar_partido_manual(text) to authenticated, service_role;
grant execute on function public.reclamar_primer_admin() to authenticated;
