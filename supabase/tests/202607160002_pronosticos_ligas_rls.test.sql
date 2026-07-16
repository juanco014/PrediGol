begin;

set local search_path = pg_catalog, public, extensions;

create extension if not exists pgtap with schema extensions;

select extensions.plan(22);

create or replace function pg_temp.try_sql(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return true;
exception
  when others then
    return false;
end;
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-ligas-user1@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Liga Usuario Uno'),
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-ligas-user2@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Liga Usuario Dos'),
    now(),
    now()
  );

insert into public.partidos (
  id,
  torneo,
  fecha_texto,
  fecha_orden,
  local_nombre,
  visitante_nombre,
  estado,
  es_relevante,
  prioridad_visual
) values (
  200001,
  'Liga Test',
  '20/07/2026 19:00',
  '2026-07-20 19:00:00-05',
  'Local Test',
  'Visitante Test',
  'proximo',
  true,
  10
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.ok(
  pg_temp.try_sql($sql$
    insert into public.pronosticos (usuario_id, partido_id, goles_local, goles_visitante)
    values ('20000000-0000-0000-0000-000000000001', 200001, 2, 1)
  $sql$),
  'usuario 1 puede insertar un pronostico propio'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.pronosticos (usuario_id, partido_id, goles_local, goles_visitante)
    values ('20000000-0000-0000-0000-000000000002', 200001, 1, 1)
  $sql$),
  'usuario 1 no puede insertar pronostico para usuario 2'
);

select extensions.is(
  (select count(*)::integer from public.pronosticos),
  1,
  'usuario 1 solo lee su propio pronostico'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.is(
  (select count(*)::integer from public.pronosticos),
  0,
  'usuario 2 no puede leer el pronostico de usuario 1'
);

select pg_temp.try_sql($sql$
  update public.pronosticos
  set goles_local = 3
  where usuario_id = '20000000-0000-0000-0000-000000000001'
    and partido_id = 200001
$sql$);

reset role;

select extensions.is(
  (
    select goles_local
    from public.pronosticos
    where usuario_id = '20000000-0000-0000-0000-000000000001'
      and partido_id = 200001
  ),
  2,
  'usuario 2 no puede actualizar el pronostico de usuario 1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.pronosticos (usuario_id, partido_id, goles_local, goles_visitante)
    values ('20000000-0000-0000-0000-000000000001', 200001, 0, 0)
  $sql$),
  'no se pueden duplicar pronosticos del mismo usuario para el mismo partido'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.pronosticos (usuario_id, partido_id, goles_local, goles_visitante)
    values ('20000000-0000-0000-0000-000000000001', 200001, -1, 0)
  $sql$),
  'goles_local rechaza valores menores que 0'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.pronosticos (usuario_id, partido_id, goles_local, goles_visitante)
    values ('20000000-0000-0000-0000-000000000001', 200001, 1, 100)
  $sql$),
  'goles_visitante rechaza valores mayores que 99'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.pronosticos (usuario_id, partido_id, goles_local, goles_visitante)
    values ('29999999-0000-0000-0000-000000000999', 200001, 1, 0)
  $sql$),
  'usuario_id referencia auth.users'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.pronosticos (usuario_id, partido_id, goles_local, goles_visitante)
    values ('20000000-0000-0000-0000-000000000001', 299999, 1, 0)
  $sql$),
  'partido_id referencia partidos'
);

select extensions.ok(
  pg_temp.try_sql($sql$
    insert into public.ligas (id, nombre, codigo, creador_id)
    values ('20000000-1000-4000-8000-000000000001', 'Liga Usuario Uno', 'PREDI20001', '20000000-0000-0000-0000-000000000001')
  $sql$),
  'usuario 1 puede crear liga donde creador_id = auth.uid()'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.ligas (id, nombre, codigo, creador_id)
    values ('20000000-1000-4000-8000-000000000002', 'Liga Indebida', 'PREDI20002', '20000000-0000-0000-0000-000000000002')
  $sql$),
  'usuario 1 no puede crear liga asignando a usuario 2 como creador'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.ligas (id, nombre, codigo, creador_id)
    values ('20000000-1000-4000-8000-000000000003', 'Liga Duplicada', 'PREDI20001', '20000000-0000-0000-0000-000000000001')
  $sql$),
  'codigo de liga es unico'
);

select extensions.ok(
  pg_temp.try_sql($sql$
    insert into public.liga_miembros (liga_id, usuario_id, rol)
    values ('20000000-1000-4000-8000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner')
  $sql$),
  'usuario 1 puede insertarse como miembro fundador'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    insert into public.liga_miembros (liga_id, usuario_id)
    values ('20000000-1000-4000-8000-000000000001', '20000000-0000-0000-0000-000000000002')
  $sql$),
  'usuario 1 no puede insertar arbitrariamente a usuario 2'
);

select extensions.is(
  (select count(*)::integer from public.liga_miembros),
  1,
  'usuario 1 solo lee directamente su propia membresia'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.try_sql($sql$
  delete from public.liga_miembros
  where liga_id = '20000000-1000-4000-8000-000000000001'
    and usuario_id = '20000000-0000-0000-0000-000000000001'
$sql$);

reset role;

select extensions.is(
  (
    select count(*)::integer
    from public.liga_miembros
    where liga_id = '20000000-1000-4000-8000-000000000001'
      and usuario_id = '20000000-0000-0000-0000-000000000001'
  ),
  1,
  'usuario 2 no puede eliminar la membresia de usuario 1'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.is(
  (select count(*)::integer from public.obtener_mis_ligas()),
  0,
  'obtener_mis_ligas() no devuelve ligas ajenas al usuario 2'
);

select extensions.ok(
  not pg_temp.try_sql($sql$
    select * from public.obtener_detalle_liga('20000000-1000-4000-8000-000000000001')
  $sql$),
  'obtener_detalle_liga(uuid) no expone detalle a usuario no autorizado'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.is(
  (select count(*)::integer from public.obtener_mis_ligas()),
  1,
  'obtener_mis_ligas() devuelve la liga del usuario autenticado'
);

select extensions.is(
  (select count(*)::integer from public.obtener_detalle_liga('20000000-1000-4000-8000-000000000001')),
  1,
  'obtener_detalle_liga(uuid) permite acceso al creador miembro'
);

select extensions.is(
  public.predigol_es_admin(),
  false,
  'predigol_es_admin() devuelve false para usuarios normales'
);

select * from extensions.finish();
rollback;
