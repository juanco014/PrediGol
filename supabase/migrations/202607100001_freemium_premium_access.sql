create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_plans (code, name, description, active)
values
  ('free', 'Gratis', 'Acceso gratuito a pronosticos basicos.', true),
  ('premium', 'Premium', 'Acceso premium preparado para activacion manual o pasarela futura.', true)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active,
  updated_at = now();

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  status text not null default 'free',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_subscriptions_status_check
    check (status in ('free', 'premium_active', 'premium_expired', 'canceled', 'trial'))
);

create index if not exists user_subscriptions_user_status_idx
  on public.user_subscriptions(user_id, status, expires_at desc);

create unique index if not exists user_subscriptions_one_active_plan_idx
  on public.user_subscriptions(user_id)
  where status in ('premium_active', 'trial');

alter table public.subscription_plans enable row level security;
alter table public.user_subscriptions enable row level security;

drop policy if exists "subscription_plans_read_authenticated" on public.subscription_plans;
create policy "subscription_plans_read_authenticated"
  on public.subscription_plans
  for select
  to authenticated
  using (active = true or public.predigol_es_admin());

drop policy if exists "user_subscriptions_own_read" on public.user_subscriptions;
create policy "user_subscriptions_own_read"
  on public.user_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid() or public.predigol_es_admin());

drop policy if exists "user_subscriptions_admin_write" on public.user_subscriptions;
create policy "user_subscriptions_admin_write"
  on public.user_subscriptions
  for all
  to authenticated
  using (public.predigol_es_admin())
  with check (public.predigol_es_admin());

alter table public.model_predictions
  add column if not exists access_tier text not null default 'free',
  add column if not exists premium_reason text,
  add column if not exists premium_preview jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'model_predictions_access_tier_check'
      and conrelid = 'public.model_predictions'::regclass
  ) then
    alter table public.model_predictions
      add constraint model_predictions_access_tier_check
      check (access_tier in ('free', 'premium'));
  end if;
end $$;

create index if not exists model_predictions_access_tier_generated_idx
  on public.model_predictions(access_tier, generated_at desc);

create or replace function public.predigol_usuario_tiene_premium(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    public.predigol_es_admin()
    or exists (
      select 1
      from public.user_subscriptions us
      where us.user_id = p_user_id
        and us.status in ('premium_active', 'trial')
        and (us.expires_at is null or us.expires_at > now())
    ),
    false
  );
$$;

create or replace function public.obtener_plan_usuario()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription record;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Debes iniciar sesion.';
  end if;

  select us.*
  into v_subscription
  from public.user_subscriptions us
  where us.user_id = auth.uid()
    and us.status in ('premium_active', 'trial')
    and (us.expires_at is null or us.expires_at > now())
  order by us.started_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'plan_code', v_subscription.plan_code,
      'status', v_subscription.status,
      'is_premium', true,
      'expires_at', v_subscription.expires_at,
      'source', 'user_subscriptions'
    );
  end if;

  return jsonb_build_object(
    'plan_code', 'free',
    'status', 'free',
    'is_premium', false,
    'expires_at', null,
    'source', 'default_free'
  );
end;
$$;

drop policy if exists "model_predictions_read_authenticated" on public.model_predictions;
create policy "model_predictions_read_by_entitlement"
  on public.model_predictions
  for select
  to authenticated
  using (
    access_tier = 'free'
    or public.predigol_es_admin()
    or public.predigol_usuario_tiene_premium(auth.uid())
  );

create or replace function public.predigol_prediction_visible_row(p_prediction public.model_predictions)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_access boolean;
begin
  v_can_access := p_prediction.access_tier = 'free'
    or public.predigol_es_admin()
    or public.predigol_usuario_tiene_premium(auth.uid());

  return jsonb_build_object(
    'api_football_fixture_id', p_prediction.api_football_fixture_id,
    'partido_id', p_prediction.partido_id,
    'access_tier', p_prediction.access_tier,
    'is_locked', not v_can_access,
    'user_can_access', v_can_access,
    'preview_message', case when v_can_access then null else coalesce(p_prediction.premium_reason, 'Requiere plan premium.') end,
    'home_win_probability', case when v_can_access then p_prediction.home_win_probability else null end,
    'draw_probability', case when v_can_access then p_prediction.draw_probability else null end,
    'away_win_probability', case when v_can_access then p_prediction.away_win_probability else null end,
    'expected_home_goals', case when v_can_access then p_prediction.expected_home_goals else null end,
    'expected_away_goals', case when v_can_access then p_prediction.expected_away_goals else null end,
    'predicted_home_goals', case when v_can_access then p_prediction.predicted_home_goals else null end,
    'predicted_away_goals', case when v_can_access then p_prediction.predicted_away_goals else null end,
    'confidence', case when v_can_access then p_prediction.confidence else null end,
    'model_version', case when v_can_access then p_prediction.model_version else null end,
    'generated_at', p_prediction.generated_at,
    'metadata', case when v_can_access then p_prediction.metadata else p_prediction.premium_preview end
  );
end;
$$;

create or replace function public.obtener_predicciones_visibles(p_limit integer default 24)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Debes iniciar sesion.';
  end if;

  return query
  select public.predigol_prediction_visible_row(mp)
  from public.model_predictions mp
  order by mp.generated_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 100));
end;
$$;

create or replace function public.obtener_prediccion_visible(p_api_football_fixture_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prediction public.model_predictions%rowtype;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Debes iniciar sesion.';
  end if;

  select *
  into v_prediction
  from public.model_predictions
  where api_football_fixture_id = p_api_football_fixture_id
  limit 1;

  if not found then
    return null;
  end if;

  return public.predigol_prediction_visible_row(v_prediction);
end;
$$;

revoke all on public.subscription_plans from anon;
revoke all on public.user_subscriptions from anon;
revoke insert, update, delete on public.subscription_plans from anon, authenticated;
revoke insert, update, delete on public.user_subscriptions from anon, authenticated;

grant select on public.subscription_plans to authenticated;
grant select on public.user_subscriptions to authenticated;
grant all on public.subscription_plans to service_role;
grant all on public.user_subscriptions to service_role;
grant execute on function public.predigol_usuario_tiene_premium(uuid) to authenticated, service_role;
grant execute on function public.obtener_plan_usuario() to authenticated, service_role;
grant execute on function public.obtener_predicciones_visibles(integer) to authenticated, service_role;
grant execute on function public.obtener_prediccion_visible(bigint) to authenticated, service_role;
