create or replace function public.editar_partido_admin(
  p_partido_id text,
  p_torneo text,
  p_fecha_orden timestamptz,
  p_local_nombre text,
  p_visitante_nombre text,
  p_estado text,
  p_goles_local integer default null,
  p_goles_visitante integer default null,
  p_es_relevante boolean default true,
  p_prioridad_visual integer default 100,
  p_local_corto text default null,
  p_visitante_corto text default null,
  p_temporada integer default null,
  p_ronda text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partido public.partidos%rowtype;
  v_estado text := coalesce(nullif(trim(p_estado), ''), 'proximo');
  v_temporada integer := coalesce(p_temporada, extract(year from p_fecha_orden at time zone 'America/Bogota')::integer);
  v_local_corto text := coalesce(nullif(trim(p_local_corto), ''), public.predigol_codigo_equipo(p_local_nombre));
  v_visitante_corto text := coalesce(nullif(trim(p_visitante_corto), ''), public.predigol_codigo_equipo(p_visitante_nombre));
begin
  if not public.predigol_es_admin() then
    raise exception 'No tienes permiso para editar partidos.';
  end if;

  if nullif(trim(p_partido_id), '') is null then
    raise exception 'El partido es obligatorio.';
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

  if v_estado not in ('proximo', 'en_vivo', 'finalizado', 'cancelado') then
    raise exception 'Estado no permitido: %.', v_estado;
  end if;

  if v_estado = 'finalizado'
    and (p_goles_local is null or p_goles_visitante is null) then
    raise exception 'Los goles son obligatorios para finalizar el partido.';
  end if;

  if coalesce(p_goles_local, 0) < 0 or coalesce(p_goles_visitante, 0) < 0 then
    raise exception 'Los goles no pueden ser negativos.';
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
    local_corto = v_local_corto,
    visitante_corto = v_visitante_corto,
    estado = v_estado,
    goles_local_final = case when v_estado = 'finalizado' then p_goles_local else null end,
    goles_visitante_final = case when v_estado = 'finalizado' then p_goles_visitante else null end,
    temporada = v_temporada,
    ronda = p_ronda,
    minuto = case when v_estado = 'en_vivo' then minuto else null end,
    es_relevante = p_es_relevante,
    prioridad_visual = coalesce(p_prioridad_visual, prioridad_visual, 100),
    actualizado_api_en = now()
  where id::text = p_partido_id
  returning * into v_partido;

  if not found then
    raise exception 'No se encontro el partido con id %.', p_partido_id;
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
      updated_at = now()
    where api_football_fixture_id = v_partido.api_football_fixture_id;
  end if;

  return to_jsonb(v_partido);
end;
$$;

revoke all on function public.editar_partido_admin(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  boolean,
  integer,
  text,
  text,
  integer,
  text
) from public, anon, authenticated;

grant execute on function public.editar_partido_admin(
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  integer,
  integer,
  boolean,
  integer,
  text,
  text,
  integer,
  text
) to authenticated, service_role;
