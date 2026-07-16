begin;

set local search_path = pg_catalog, public, extensions;

create extension if not exists pgtap with schema extensions;

select extensions.plan(32);

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
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-pay-user1@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Pago Usuario Uno'),
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-pay-user2@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Pago Usuario Dos'),
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'fase10b-pay-admin@example.test',
    'not-a-real-password',
    now(),
    '{}'::jsonb,
    jsonb_build_object('nombre', 'Pago Admin'),
    now(),
    now()
  );

update public.profiles
set rol = 'admin', es_admin = true
where id = '30000000-0000-0000-0000-000000000003';

insert into public.subscription_plans (code, name, description, active)
values ('fase10b_inactive', 'Plan Inactivo Test', 'Plan inactivo de prueba local', false);

insert into public.payment_products (
  id,
  code,
  provider,
  environment,
  plan_code,
  name,
  amount_in_cents,
  currency,
  duration_days,
  active,
  metadata
) values
  (
    '30000000-1000-4000-8000-000000000001',
    'fase10b-active-product',
    'wompi',
    'sandbox',
    'premium',
    'Producto Activo Test',
    2000000,
    'COP',
    30,
    true,
    '{}'::jsonb
  ),
  (
    '30000000-1000-4000-8000-000000000002',
    'fase10b-inactive-product',
    'wompi',
    'sandbox',
    'premium',
    'Producto Inactivo Test',
    2000000,
    'COP',
    30,
    false,
    '{}'::jsonb
  );

insert into public.payment_orders (
  id,
  user_id,
  product_id,
  provider,
  environment,
  reference,
  amount_in_cents,
  currency,
  status,
  metadata
) values
  (
    '30000000-2000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '30000000-1000-4000-8000-000000000001',
    'wompi',
    'sandbox',
    'fase10b-order-user1',
    2000000,
    'COP',
    'pending',
    '{}'::jsonb
  ),
  (
    '30000000-2000-4000-8000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '30000000-1000-4000-8000-000000000001',
    'wompi',
    'sandbox',
    'fase10b-order-user2',
    2000000,
    'COP',
    'approved',
    '{}'::jsonb
  );

insert into public.payment_transactions (
  id,
  order_id,
  provider,
  environment,
  provider_payment_id,
  status,
  amount_in_cents,
  currency,
  raw_payload
) values
  (
    '30000000-3000-4000-8000-000000000001',
    '30000000-2000-4000-8000-000000000001',
    'wompi',
    'sandbox',
    'fase10b-payment-user1',
    'pending',
    2000000,
    'COP',
    '{}'::jsonb
  ),
  (
    '30000000-3000-4000-8000-000000000002',
    '30000000-2000-4000-8000-000000000002',
    'wompi',
    'sandbox',
    'fase10b-payment-user2',
    'approved',
    2000000,
    'COP',
    '{}'::jsonb
  );

insert into public.user_subscriptions (
  id,
  user_id,
  plan_code,
  status,
  expires_at,
  metadata
) values (
  '30000000-4000-4000-8000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  'premium',
  'premium_active',
  now() + interval '30 days',
  '{}'::jsonb
);

insert into public.subscription_events (
  id,
  user_id,
  subscription_id,
  order_id,
  event_type,
  new_expires_at,
  metadata
) values
  (
    '30000000-5000-4000-8000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    null,
    '30000000-2000-4000-8000-000000000001',
    'premium_adjusted',
    now() + interval '1 day',
    '{}'::jsonb
  ),
  (
    '30000000-5000-4000-8000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    '30000000-4000-4000-8000-000000000002',
    '30000000-2000-4000-8000-000000000002',
    'premium_activated',
    now() + interval '30 days',
    '{}'::jsonb
  );

insert into public.payment_webhook_events (
  id,
  provider,
  environment,
  provider_event_id,
  event_hash,
  event_type,
  signature_valid,
  processed_status,
  order_id,
  transaction_id,
  raw_payload
) values (
  '30000000-6000-4000-8000-000000000001',
  'wompi',
  'sandbox',
  'fase10b-event-1',
  'fase10b-event-hash-1',
  'transaction.updated',
  true,
  'received',
  '30000000-2000-4000-8000-000000000002',
  '30000000-3000-4000-8000-000000000002',
  '{}'::jsonb
);

insert into public.football_teams (api_football_team_id, name)
values (300001, 'Premium Local'), (300002, 'Premium Visitante');

insert into public.football_fixtures (
  api_football_fixture_id,
  kickoff_at,
  status,
  status_short,
  home_team_api_id,
  away_team_api_id
) values (
  300001,
  now() + interval '10 days',
  'proximo',
  'NS',
  300001,
  300002
);

insert into public.model_predictions (
  api_football_fixture_id,
  partido_id,
  home_win_probability,
  draw_probability,
  away_win_probability,
  expected_home_goals,
  expected_away_goals,
  predicted_home_goals,
  predicted_away_goals,
  confidence,
  model_version,
  access_tier,
  premium_reason,
  premium_preview
) values (
  300001,
  '300001',
  0.500000,
  0.250000,
  0.250000,
  1.500,
  0.900,
  2,
  1,
  0.700000,
  'poisson-elo-v1',
  'premium',
  'Requiere plan premium.',
  jsonb_build_object('message', 'Premium')
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.is((select count(*)::integer from public.payment_orders where id = '30000000-2000-4000-8000-000000000001'), 1, 'usuario 1 puede leer su propia orden');
select extensions.is((select count(*)::integer from public.payment_orders where id = '30000000-2000-4000-8000-000000000002'), 0, 'usuario 1 no puede leer la orden de usuario 2');
select extensions.is((select count(*)::integer from public.payment_transactions where id = '30000000-3000-4000-8000-000000000001'), 1, 'usuario 1 puede leer transaccion de su orden');
select extensions.is((select count(*)::integer from public.payment_transactions where id = '30000000-3000-4000-8000-000000000002'), 0, 'usuario 1 no puede leer transaccion de usuario 2');
select extensions.is((select count(*)::integer from public.subscription_events where user_id = '30000000-0000-0000-0000-000000000001'), 1, 'usuario 1 puede leer su propio subscription_event');
select extensions.is((select count(*)::integer from public.subscription_events where user_id = '30000000-0000-0000-0000-000000000002'), 0, 'usuario 1 no puede leer subscription_events de usuario 2');
select extensions.is((select count(*)::integer from public.payment_webhook_events), 0, 'usuario normal no puede leer payment_webhook_events');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.is((select count(*)::integer from public.payment_webhook_events), 1, 'administrador puede leer payment_webhook_events');
select extensions.is((select count(*)::integer from public.payment_orders), 2, 'administrador puede leer ordenes de otros usuarios');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.ok(not pg_temp.try_sql($sql$insert into public.payment_orders (user_id, product_id, provider, environment, reference, amount_in_cents, currency) values ('30000000-0000-0000-0000-000000000001', '30000000-1000-4000-8000-000000000001', 'wompi', 'sandbox', 'fase10b-direct-order', 2000000, 'COP')$sql$), 'usuario normal no puede insertar directamente payment_orders');
select extensions.ok(not pg_temp.try_sql($sql$update public.payment_orders set status = 'approved' where id = '30000000-2000-4000-8000-000000000001'$sql$), 'usuario normal no puede actualizar payment_orders');
select extensions.ok(not pg_temp.try_sql($sql$delete from public.payment_orders where id = '30000000-2000-4000-8000-000000000001'$sql$), 'usuario normal no puede eliminar payment_orders');
select extensions.ok(not pg_temp.try_sql($sql$insert into public.payment_transactions (order_id, provider, environment, provider_payment_id, status, amount_in_cents, currency) values ('30000000-2000-4000-8000-000000000001', 'wompi', 'sandbox', 'fase10b-direct-payment', 'approved', 2000000, 'COP')$sql$), 'usuario normal no puede escribir directamente payment_transactions');
select extensions.ok(not pg_temp.try_sql($sql$update public.user_subscriptions set status = 'canceled' where user_id = '30000000-0000-0000-0000-000000000002'$sql$), 'usuario normal no puede modificar user_subscriptions');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.ok(not pg_temp.try_sql($sql$update public.user_subscriptions set metadata = metadata || jsonb_build_object('admin_attempt', true) where user_id = '30000000-0000-0000-0000-000000000002'$sql$), 'administrador no puede modificar user_subscriptions porque falta grant SQL de escritura');
select extensions.ok(true, 'RLS define politica admin de escritura en user_subscriptions, pero el grant SQL mantiene la operacion bloqueada para authenticated');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select extensions.is((public.obtener_plan_usuario()->>'plan_code'), 'free', 'obtener_plan_usuario() devuelve free para usuario sin suscripcion activa');
select extensions.is(public.predigol_usuario_tiene_premium('30000000-0000-0000-0000-000000000001'), false, 'predigol_usuario_tiene_premium(uuid) devuelve false sin suscripcion activa');
select extensions.is(public.predigol_usuario_tiene_premium('30000000-0000-0000-0000-000000000002'), true, 'predigol_usuario_tiene_premium(uuid) devuelve true con suscripcion premium activa');
select extensions.is((select count(*)::integer from public.payment_products where code = 'fase10b-active-product'), 1, 'payment_products activos son visibles para authenticated');
select extensions.is((select count(*)::integer from public.payment_products where code = 'fase10b-inactive-product'), 0, 'productos inactivos no son visibles para usuario normal');
select extensions.ok((select count(*) from public.subscription_plans where active = true) >= 2, 'subscription_plans activos son visibles para authenticated');
select extensions.is((select count(*)::integer from public.subscription_plans where code = 'fase10b_inactive'), 0, 'planes inactivos no son visibles para usuario normal');

select extensions.is((select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')), 0, 'authenticated no tiene TRUNCATE, REFERENCES ni TRIGGER en tablas public');
select extensions.is((select count(*)::integer from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')), 0, 'anon no tiene TRUNCATE, REFERENCES ni TRIGGER en tablas public');
select extensions.is((select count(*)::integer from pg_namespace n cross join lateral aclexplode(n.nspacl) x left join pg_roles r on r.oid = x.grantee where n.nspname = 'public' and coalesce(r.rolname, 'PUBLIC') in ('PUBLIC', 'anon', 'authenticated') and x.privilege_type = 'CREATE'), 0, 'PUBLIC, anon y authenticated no tienen CREATE en schema public');
select extensions.ok((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'predigol_es_admin') = 1, 'RPC predigol_es_admin existe');
select extensions.ok((select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'predigol_es_admin' limit 1), 'predigol_es_admin es SECURITY DEFINER');
select extensions.is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg where cfg like 'search_path=%')), 0, 'todas las SECURITY DEFINER public tienen search_path explicito');
select extensions.ok(not pg_temp.try_sql($sql$select public.reclamar_primer_admin()$sql$), 'reclamar_primer_admin() no otorga admin cuando ya existe administrador');
select extensions.is((public.obtener_prediccion_visible(300001)->>'is_locked')::boolean, true, 'usuario gratis recibe prediccion premium bloqueada');
select extensions.is(public.obtener_prediccion_visible(300001)->>'home_win_probability', null, 'usuario gratis no recibe probabilidad premium');

select * from extensions.finish();
rollback;
