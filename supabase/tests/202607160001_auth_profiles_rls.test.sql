begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

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
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-user1@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Usuario Uno'),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-user2@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Usuario Dos'),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-self-admin@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Intento Admin', 'rol', 'admin', 'es_admin', true),
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-admin@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Admin Local'),
    now(),
    now()
  );

update public.profiles
set rol = 'admin', es_admin = true
where id = '10000000-0000-0000-0000-000000000004';

select ok(
  exists (select 1 from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'insertar en auth.users genera una fila en profiles'
);

select is(
  (select id from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'profiles.id coincide con auth.users.id'
);

select is(
  (select nombre from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'Usuario Uno',
  'profiles.nombre se toma de raw_user_meta_data.nombre'
);

select is(
  (select rol from public.profiles where id = '10000000-0000-0000-0000-000000000003'),
  'usuario',
  'raw_user_meta_data.rol no concede privilegios administrativos'
);

select is(
  (select es_admin from public.profiles where id = '10000000-0000-0000-0000-000000000003'),
  false,
  'raw_user_meta_data.es_admin no concede privilegios administrativos'
);

select is(
  (select rol from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'usuario',
  'el rol inicial seguro es usuario'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*)::integer from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  1,
  'usuario autenticado puede leer su propio perfil'
);

select is(
  (select count(*)::integer from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  1,
  'politica actual permite lectura autenticada de perfiles ajenos'
);

select ok(
  pg_temp.try_sql($sql$
    update public.profiles
    set nombre = 'Usuario Uno Editado', username = 'usuario_uno', avatar_url = 'avatar-local.png'
    where id = '10000000-0000-0000-0000-000000000001'
  $sql$),
  'usuario normal puede actualizar campos personales manteniendo rol normal'
);

select results_eq(
  $sql$
    select nombre, username, avatar_url
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
  $sql$,
  $$ values ('Usuario Uno Editado'::text, 'usuario_uno'::text, 'avatar-local.png'::text) $$,
  'la actualizacion de nombre, username y avatar_url queda visible'
);

select ok(
  not pg_temp.try_sql($sql$
    update public.profiles
    set rol = 'admin'
    where id = '10000000-0000-0000-0000-000000000001'
  $sql$),
  'usuario normal no puede cambiar rol'
);

select ok(
  not pg_temp.try_sql($sql$
    update public.profiles
    set es_admin = true
    where id = '10000000-0000-0000-0000-000000000001'
  $sql$),
  'usuario normal no puede cambiar es_admin'
);

select ok(
  not pg_temp.try_sql($sql$
    update public.profiles
    set id = '10000000-0000-0000-0000-000000000099'
    where id = '10000000-0000-0000-0000-000000000001'
  $sql$),
  'usuario normal no puede cambiar id'
);

select pg_temp.try_sql($sql$
  update public.profiles
  set nombre = 'Edicion indebida'
  where id = '10000000-0000-0000-0000-000000000002'
$sql$);

reset role;

select is(
  (select nombre from public.profiles where id = '10000000-0000-0000-0000-000000000002'),
  'Usuario Dos',
  'usuario normal no puede actualizar el perfil de otro usuario'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  not pg_temp.try_sql($sql$
    insert into public.profiles (id, nombre, rol, es_admin)
    values ('10000000-0000-0000-0000-000000000002', 'Perfil ajeno', 'usuario', false)
  $sql$),
  'usuario normal no puede insertar perfil para otro usuario'
);

select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
  ),
  0,
  'authenticated no tiene TRUNCATE, REFERENCES ni TRIGGER en profiles'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.predigol_es_admin(),
  true,
  'usuario preparado como admin es reconocido por predigol_es_admin()'
);

select ok(
  pg_temp.try_sql($sql$
    update public.profiles
    set nombre = 'Admin Local Editado', username = 'admin_local', avatar_url = 'admin-avatar.png'
    where id = '10000000-0000-0000-0000-000000000004'
  $sql$),
  'admin autenticado deberia poder editar campos personales sin perder privilegios'
);

select ok(
  not pg_temp.try_sql($sql$
    update public.profiles
    set rol = 'usuario', es_admin = false
    where id = '10000000-0000-0000-0000-000000000004'
  $sql$),
  'admin autenticado no puede modificar rol ni es_admin por cliente'
);

select results_eq(
  $sql$
    select rol, es_admin
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000004'
  $sql$,
  $$ values ('admin'::text, true) $$,
  'admin conserva rol y es_admin despues de actualizar campos personales'
);

select * from finish();
rollback;
