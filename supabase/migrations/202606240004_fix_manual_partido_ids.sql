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

revoke all on function public.crear_partido_manual(text, timestamptz, text, text, text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.crear_partido_manual(text, timestamptz, text, text, text, text, integer, text, text) to service_role;
