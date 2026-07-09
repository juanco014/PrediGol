alter table if exists public.partidos
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists importado_externo_en timestamptz,
  add column if not exists raw_import_payload jsonb;

create unique index if not exists partidos_external_source_id_key
  on public.partidos(external_source, external_id)
  where external_source is not null
    and external_id is not null;

create or replace function public.importar_partido_externo(
  p_external_source text,
  p_external_id text,
  p_torneo text,
  p_fecha_orden timestamptz,
  p_local_nombre text,
  p_visitante_nombre text,
  p_local_corto text default null,
  p_visitante_corto text default null,
  p_temporada integer default null,
  p_ronda text default null,
  p_fuente_detalle text default 'google sheets',
  p_es_relevante boolean default true,
  p_prioridad_visual integer default 10,
  p_estado text default 'proximo',
  p_goles_local integer default null,
  p_goles_visitante integer default null,
  p_raw_import_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id text;
  v_partido public.partidos%rowtype;
  v_created jsonb;
  v_estado text := coalesce(nullif(trim(p_estado), ''), 'proximo');
  v_temporada integer := coalesce(p_temporada, extract(year from p_fecha_orden at time zone 'America/Bogota')::integer);
  v_external_source text := lower(nullif(trim(p_external_source), ''));
  v_external_id text := nullif(trim(p_external_id), '');
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para importar partidos.';
  end if;

  if v_external_source is null then
    raise exception 'La fuente externa es obligatoria.';
  end if;

  if v_external_id is null then
    raise exception 'El id externo es obligatorio.';
  end if;

  if v_estado not in ('proximo', 'en_vivo', 'finalizado', 'cancelado') then
    raise exception 'Estado no permitido: %.', v_estado;
  end if;

  if v_estado = 'finalizado'
    and (p_goles_local is null or p_goles_visitante is null) then
    raise exception 'Los goles son obligatorios para importar un partido finalizado.';
  end if;

  select id::text
  into v_existing_id
  from public.partidos
  where external_source = v_external_source
    and external_id = v_external_id
  limit 1;

  if v_existing_id is null then
    v_created := public.crear_partido_manual(
      p_torneo => p_torneo,
      p_fecha_orden => p_fecha_orden,
      p_local_nombre => p_local_nombre,
      p_visitante_nombre => p_visitante_nombre,
      p_local_corto => p_local_corto,
      p_visitante_corto => p_visitante_corto,
      p_temporada => v_temporada,
      p_ronda => p_ronda,
      p_fuente_detalle => p_fuente_detalle
    );

    v_existing_id := v_created->>'id';
  end if;

  update public.partidos
  set
    torneo = trim(p_torneo),
    fecha_texto = case
      when v_estado = 'finalizado' then 'Finalizado'
      when v_estado = 'cancelado' then 'Cancelado'
      when v_estado = 'en_vivo' then 'En vivo'
      else to_char(p_fecha_orden at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI')
    end,
    fecha_orden = p_fecha_orden,
    local_nombre = trim(p_local_nombre),
    visitante_nombre = trim(p_visitante_nombre),
    local_corto = coalesce(nullif(trim(p_local_corto), ''), public.predigol_codigo_equipo(p_local_nombre)),
    visitante_corto = coalesce(nullif(trim(p_visitante_corto), ''), public.predigol_codigo_equipo(p_visitante_nombre)),
    estado = v_estado,
    goles_local_final = case when v_estado = 'finalizado' then p_goles_local else null end,
    goles_visitante_final = case when v_estado = 'finalizado' then p_goles_visitante else null end,
    temporada = v_temporada,
    ronda = p_ronda,
    minuto = null,
    actualizado_api_en = now(),
    origen_datos = 'google_sheets',
    fuente_detalle = p_fuente_detalle,
    es_relevante = p_es_relevante,
    prioridad_visual = coalesce(p_prioridad_visual, prioridad_visual, 100),
    external_source = v_external_source,
    external_id = v_external_id,
    importado_externo_en = now(),
    raw_import_payload = p_raw_import_payload,
    payload_api = jsonb_build_object(
      'source', v_external_source,
      'external_id', v_external_id,
      'raw', p_raw_import_payload
    )
  where id::text = v_existing_id
  returning * into v_partido;

  if not found then
    raise exception 'No se pudo importar el partido externo %.%.', v_external_source, v_external_id;
  end if;

  if v_partido.api_football_fixture_id is not null then
    update public.football_fixtures
    set
      season_start_year = v_temporada,
      round = p_ronda,
      kickoff_at = p_fecha_orden,
      status = v_estado,
      status_short = case
        when v_estado = 'finalizado' then 'FT'
        when v_estado = 'cancelado' then 'CANC'
        when v_estado = 'en_vivo' then 'LIVE'
        else 'MANUAL'
      end,
      goals_home = case when v_estado = 'finalizado' then p_goles_local else null end,
      goals_away = case when v_estado = 'finalizado' then p_goles_visitante else null end,
      score_fulltime_home = case when v_estado = 'finalizado' then p_goles_local else null end,
      score_fulltime_away = case when v_estado = 'finalizado' then p_goles_visitante else null end,
      raw_payload = jsonb_build_object(
        'source', v_external_source,
        'external_id', v_external_id,
        'raw', p_raw_import_payload
      ),
      updated_at = now()
    where api_football_fixture_id = v_partido.api_football_fixture_id;
  end if;

  return jsonb_build_object(
    'partido', to_jsonb(v_partido),
    'action', case when v_created is null then 'updated' else 'created' end
  );
end;
$$;

revoke all on function public.importar_partido_externo(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  boolean,
  integer,
  text,
  integer,
  integer,
  jsonb
) from public, anon, authenticated;

grant execute on function public.importar_partido_externo(
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  boolean,
  integer,
  text,
  integer,
  integer,
  jsonb
) to authenticated, service_role;
