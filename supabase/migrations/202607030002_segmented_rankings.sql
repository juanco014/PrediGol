drop function if exists public.obtener_ranking_segmentado(text, text);
create or replace function public.obtener_ranking_segmentado(
  p_periodo text default 'global',
  p_torneo text default null
)
returns table (
  usuario_id uuid,
  nombre text,
  username text,
  avatar_url text,
  puntos integer,
  aciertos integer,
  pronosticos integer,
  exactos integer,
  posicion bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periodo text := lower(coalesce(nullif(trim(p_periodo), ''), 'global'));
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Debes iniciar sesion para consultar el ranking.';
  end if;

  if v_periodo not in ('global', 'semanal', 'torneo') then
    raise exception 'Periodo de ranking no valido.';
  end if;

  if v_periodo = 'torneo' and nullif(trim(coalesce(p_torneo, '')), '') is null then
    raise exception 'Debes seleccionar un torneo.';
  end if;

  return query
  with partidos_filtrados as (
    select p.*
    from public.partidos p
    where p.estado = 'finalizado'
      and p.goles_local_final is not null
      and p.goles_visitante_final is not null
      and (
        v_periodo = 'global'
        or (
          v_periodo = 'semanal'
          and p.fecha_orden >= (
            date_trunc('week', now() at time zone 'America/Bogota')
            at time zone 'America/Bogota'
          )
        )
        or (
          v_periodo = 'torneo'
          and lower(trim(p.torneo)) = lower(trim(p_torneo))
        )
      )
  ),
  resueltos as (
    select
      pr.usuario_id,
      public.predigol_calcular_puntos(
        pr.goles_local,
        pr.goles_visitante,
        p.goles_local_final,
        p.goles_visitante_final
      ) as puntos
    from public.pronosticos pr
    join partidos_filtrados p on p.id::text = pr.partido_id::text
  ),
  agregados as (
    select
      r.usuario_id,
      count(*)::integer as pronosticos,
      coalesce(sum(r.puntos), 0)::integer as puntos,
      count(*) filter (where r.puntos > 0)::integer as aciertos,
      count(*) filter (where r.puntos = 5)::integer as exactos
    from resueltos r
    group by r.usuario_id
  ),
  base as (
    select
      p.id as usuario_id,
      coalesce(nullif(trim(p.nombre), ''), 'Hincha PrediGol') as nombre,
      p.username,
      p.avatar_url,
      coalesce(a.puntos, 0)::integer as puntos,
      coalesce(a.aciertos, 0)::integer as aciertos,
      coalesce(a.pronosticos, 0)::integer as pronosticos,
      coalesce(a.exactos, 0)::integer as exactos
    from public.profiles p
    left join agregados a on a.usuario_id = p.id
  )
  select
    b.usuario_id,
    b.nombre,
    b.username,
    b.avatar_url,
    b.puntos,
    b.aciertos,
    b.pronosticos,
    b.exactos,
    row_number() over (
      order by b.puntos desc, b.aciertos desc, b.exactos desc, b.nombre asc, b.usuario_id asc
    ) as posicion
  from base b
  order by posicion asc;
end;
$$;

grant execute on function public.obtener_ranking_segmentado(text, text)
  to authenticated, service_role;
