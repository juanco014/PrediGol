create or replace function public.predigol_calcular_puntos(
  p_goles_local integer,
  p_goles_visitante integer,
  p_final_local integer,
  p_final_visitante integer
)
returns integer
language sql
immutable
as $$
  select case
    when p_goles_local is null
      or p_goles_visitante is null
      or p_final_local is null
      or p_final_visitante is null
      then 0
    when p_goles_local = p_final_local
      and p_goles_visitante = p_final_visitante
      then 5
    when sign(p_goles_local - p_goles_visitante) <> sign(p_final_local - p_final_visitante)
      then 0
    when abs(p_goles_local - p_goles_visitante) = abs(p_final_local - p_final_visitante)
      then 4
    else 3
  end;
$$;

create or replace function public.predigol_validar_pronostico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partido record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null then
      raise exception 'Debes iniciar sesion para guardar pronosticos.';
    end if;

    if new.usuario_id is distinct from auth.uid() then
      raise exception 'No puedes guardar pronosticos para otro usuario.';
    end if;
  end if;

  if new.goles_local is null or new.goles_visitante is null then
    raise exception 'Debes ingresar marcador local y visitante.';
  end if;

  if new.goles_local < 0 or new.goles_visitante < 0 then
    raise exception 'Los goles no pueden ser negativos.';
  end if;

  if new.goles_local > 99 or new.goles_visitante > 99 then
    raise exception 'El marcador maximo permitido es 99.';
  end if;

  select
    p.estado,
    p.fecha_orden
  into v_partido
  from public.partidos p
  where p.id::text = new.partido_id::text
  limit 1;

  if not found then
    raise exception 'No existe el partido para este pronostico.';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and (v_partido.estado <> 'proximo' or v_partido.fecha_orden <= now()) then
    raise exception 'Este partido ya inicio o finalizo y no admite pronosticos.';
  end if;

  new.actualizado_en = now();

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.pronosticos') is not null then
    drop trigger if exists predigol_validar_pronostico_tg on public.pronosticos;

    create trigger predigol_validar_pronostico_tg
      before insert or update on public.pronosticos
      for each row
      execute function public.predigol_validar_pronostico();
  end if;
end $$;

drop function if exists public.obtener_ranking_global();
create or replace function public.obtener_ranking_global()
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
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Debes iniciar sesion para consultar el ranking.';
  end if;

  return query
  with resueltos as (
    select
      pr.usuario_id,
      pr.partido_id,
      p.estado,
      public.predigol_calcular_puntos(
        pr.goles_local,
        pr.goles_visitante,
        p.goles_local_final,
        p.goles_visitante_final
      ) as puntos
    from public.pronosticos pr
    join public.partidos p on p.id::text = pr.partido_id::text
  ),
  agregados as (
    select
      r.usuario_id,
      count(*)::integer as pronosticos,
      coalesce(sum(r.puntos), 0)::integer as puntos,
      count(*) filter (where r.estado = 'finalizado' and r.puntos > 0)::integer as aciertos,
      count(*) filter (where r.estado = 'finalizado' and r.puntos = 5)::integer as exactos
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

drop function if exists public.obtener_ranking_liga(uuid);
drop function if exists public.obtener_ranking_liga(text);
create or replace function public.obtener_ranking_liga(p_liga_id uuid)
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
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Debes iniciar sesion para consultar la liga.';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
    and not exists (
      select 1
      from public.liga_miembros lm
      where lm.liga_id = p_liga_id
        and lm.usuario_id = auth.uid()
    ) then
    raise exception 'No haces parte de esta liga.';
  end if;

  return query
  with miembros as (
    select lm.usuario_id
    from public.liga_miembros lm
    where lm.liga_id = p_liga_id
  ),
  resueltos as (
    select
      pr.usuario_id,
      pr.partido_id,
      p.estado,
      public.predigol_calcular_puntos(
        pr.goles_local,
        pr.goles_visitante,
        p.goles_local_final,
        p.goles_visitante_final
      ) as puntos
    from public.pronosticos pr
    join public.partidos p on p.id::text = pr.partido_id::text
    join miembros m on m.usuario_id = pr.usuario_id
  ),
  agregados as (
    select
      r.usuario_id,
      count(*)::integer as pronosticos,
      coalesce(sum(r.puntos), 0)::integer as puntos,
      count(*) filter (where r.estado = 'finalizado' and r.puntos > 0)::integer as aciertos,
      count(*) filter (where r.estado = 'finalizado' and r.puntos = 5)::integer as exactos
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
    from miembros m
    join public.profiles p on p.id = m.usuario_id
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

grant execute on function public.predigol_calcular_puntos(integer, integer, integer, integer) to authenticated, service_role;
grant execute on function public.obtener_ranking_global() to authenticated, service_role;
grant execute on function public.obtener_ranking_liga(uuid) to authenticated, service_role;
