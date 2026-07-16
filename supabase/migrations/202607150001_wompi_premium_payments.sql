create table if not exists public.payment_products (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  provider text not null,
  environment text not null,
  plan_code text not null references public.subscription_plans(code),
  name text not null,
  amount_in_cents integer not null,
  currency text not null,
  duration_days integer not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_products_provider_check check (provider in ('wompi')),
  constraint payment_products_environment_check check (environment in ('sandbox', 'production')),
  constraint payment_products_amount_check check (amount_in_cents > 0),
  constraint payment_products_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payment_products_duration_check check (duration_days > 0),
  constraint payment_products_unique_code unique (provider, environment, code)
);

insert into public.payment_products (
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
)
values (
  'predigol-premium-30d',
  'wompi',
  'sandbox',
  'premium',
  'PrediGol Premium',
  2000000,
  'COP',
  30,
  true,
  jsonb_build_object('phase', '10B-local', 'source', 'approved_mvp_model')
)
on conflict (provider, environment, code) do update
set
  plan_code = excluded.plan_code,
  name = excluded.name,
  amount_in_cents = excluded.amount_in_cents,
  currency = excluded.currency,
  duration_days = excluded.duration_days,
  active = excluded.active,
  metadata = excluded.metadata,
  updated_at = now();

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.payment_products(id),
  provider text not null,
  environment text not null,
  reference text not null,
  amount_in_cents integer not null,
  currency text not null,
  status text not null default 'pending',
  checkout_url text,
  provider_checkout_id text,
  provider_payment_id text,
  approved_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_orders_provider_check check (provider in ('wompi')),
  constraint payment_orders_environment_check check (environment in ('sandbox', 'production')),
  constraint payment_orders_status_check check (status in ('pending', 'approved', 'declined', 'error', 'voided', 'refunded', 'chargeback', 'expired')),
  constraint payment_orders_amount_check check (amount_in_cents > 0),
  constraint payment_orders_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payment_orders_reference_unique unique (provider, environment, reference)
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders(user_id, created_at desc);

create index if not exists payment_orders_status_created_idx
  on public.payment_orders(provider, environment, status, created_at desc);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders(id) on delete cascade,
  provider text not null,
  environment text not null,
  provider_payment_id text not null,
  status text not null,
  amount_in_cents integer not null,
  currency text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payment_transactions_provider_check check (provider in ('wompi')),
  constraint payment_transactions_environment_check check (environment in ('sandbox', 'production')),
  constraint payment_transactions_amount_check check (amount_in_cents > 0),
  constraint payment_transactions_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint payment_transactions_provider_payment_unique unique (provider, environment, provider_payment_id)
);

create index if not exists payment_transactions_order_idx
  on public.payment_transactions(order_id, processed_at desc);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  environment text not null,
  provider_event_id text,
  event_hash text not null,
  event_type text,
  signature_valid boolean not null default false,
  processed_status text not null default 'received',
  order_id uuid references public.payment_orders(id) on delete set null,
  transaction_id uuid references public.payment_transactions(id) on delete set null,
  raw_payload jsonb not null default '{}'::jsonb,
  error_detail text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_webhook_events_provider_check check (provider in ('wompi')),
  constraint payment_webhook_events_environment_check check (environment in ('sandbox', 'production')),
  constraint payment_webhook_events_status_check check (processed_status in ('received', 'processed', 'duplicate', 'ignored', 'failed')),
  constraint payment_webhook_events_hash_unique unique (provider, environment, event_hash)
);

create unique index if not exists payment_webhook_events_provider_event_unique
  on public.payment_webhook_events(provider, environment, provider_event_id)
  where provider_event_id is not null;

create index if not exists payment_webhook_events_order_idx
  on public.payment_webhook_events(order_id, received_at desc);

create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  order_id uuid references public.payment_orders(id) on delete set null,
  event_type text not null,
  previous_expires_at timestamptz,
  new_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint subscription_events_type_check check (event_type in ('premium_activated', 'premium_extended', 'premium_refunded', 'premium_chargeback', 'premium_adjusted'))
);

create unique index if not exists subscription_events_order_activation_unique
  on public.subscription_events(order_id)
  where event_type in ('premium_activated', 'premium_extended');

create index if not exists subscription_events_user_created_idx
  on public.subscription_events(user_id, created_at desc);

alter table public.payment_products enable row level security;
alter table public.payment_orders enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.subscription_events enable row level security;

drop policy if exists "payment_products_read_authenticated" on public.payment_products;
create policy "payment_products_read_authenticated"
  on public.payment_products
  for select
  to authenticated
  using (active = true or public.predigol_es_admin());

drop policy if exists "payment_orders_own_read" on public.payment_orders;
create policy "payment_orders_own_read"
  on public.payment_orders
  for select
  to authenticated
  using (user_id = auth.uid() or public.predigol_es_admin());

drop policy if exists "payment_transactions_own_read" on public.payment_transactions;
create policy "payment_transactions_own_read"
  on public.payment_transactions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.payment_orders po
      where po.id = payment_transactions.order_id
        and (po.user_id = auth.uid() or public.predigol_es_admin())
    )
  );

drop policy if exists "subscription_events_own_read" on public.subscription_events;
create policy "subscription_events_own_read"
  on public.subscription_events
  for select
  to authenticated
  using (user_id = auth.uid() or public.predigol_es_admin());

drop policy if exists "payment_webhook_events_admin_read" on public.payment_webhook_events;
create policy "payment_webhook_events_admin_read"
  on public.payment_webhook_events
  for select
  to authenticated
  using (public.predigol_es_admin());

revoke all on public.payment_products from anon;
revoke all on public.payment_orders from anon;
revoke all on public.payment_transactions from anon;
revoke all on public.payment_webhook_events from anon;
revoke all on public.subscription_events from anon;

revoke insert, update, delete on public.payment_products from authenticated;
revoke insert, update, delete on public.payment_orders from authenticated;
revoke insert, update, delete on public.payment_transactions from authenticated;
revoke insert, update, delete on public.payment_webhook_events from authenticated;
revoke insert, update, delete on public.subscription_events from authenticated;

grant select on public.payment_products to authenticated;
grant select on public.payment_orders to authenticated;
grant select on public.payment_transactions to authenticated;
grant select on public.subscription_events to authenticated;
grant select on public.payment_webhook_events to authenticated;

grant all on public.payment_products to service_role;
grant all on public.payment_orders to service_role;
grant all on public.payment_transactions to service_role;
grant all on public.payment_webhook_events to service_role;
grant all on public.subscription_events to service_role;

create or replace function public.predigol_apply_paid_premium_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_product public.payment_products%rowtype;
  v_subscription public.user_subscriptions%rowtype;
  v_existing_event public.subscription_events%rowtype;
  v_previous_expires_at timestamptz;
  v_base_expires_at timestamptz;
  v_new_expires_at timestamptz;
  v_event_type text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Solo el servicio puede activar Premium por pagos.';
  end if;

  select *
  into v_order
  from public.payment_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Orden de pago no encontrada.';
  end if;

  select *
  into v_existing_event
  from public.subscription_events
  where order_id = v_order.id
    and event_type in ('premium_activated', 'premium_extended')
  limit 1;

  if found then
    return jsonb_build_object(
      'applied', false,
      'idempotent', true,
      'subscription_id', v_existing_event.subscription_id,
      'expires_at', v_existing_event.new_expires_at
    );
  end if;

  if v_order.status <> 'approved' then
    raise exception 'La orden no esta aprobada.';
  end if;

  if v_order.environment <> 'sandbox' then
    raise exception 'La primera integracion local solo acepta sandbox.';
  end if;

  select *
  into v_product
  from public.payment_products
  where id = v_order.product_id
  for update;

  if not found then
    raise exception 'Producto de pago no encontrado.';
  end if;

  if v_product.provider <> v_order.provider
    or v_product.environment <> v_order.environment
    or v_product.amount_in_cents <> v_order.amount_in_cents
    or v_product.currency <> v_order.currency then
    raise exception 'La orden no coincide con el producto aprobado.';
  end if;

  select *
  into v_subscription
  from public.user_subscriptions
  where user_id = v_order.user_id
    and status in ('premium_active', 'trial')
    and (expires_at is null or expires_at > now())
  order by started_at desc
  limit 1
  for update;

  if found then
    v_previous_expires_at := v_subscription.expires_at;
    v_base_expires_at := greatest(coalesce(v_subscription.expires_at, now()), now());
    v_new_expires_at := v_base_expires_at + make_interval(days => v_product.duration_days);
    v_event_type := 'premium_extended';

    update public.user_subscriptions
    set
      plan_code = v_product.plan_code,
      status = 'premium_active',
      expires_at = v_new_expires_at,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'wompi',
        'environment', v_order.environment,
        'last_payment_order_id', v_order.id,
        'last_payment_reference', v_order.reference
      ),
      updated_at = now()
    where id = v_subscription.id
    returning * into v_subscription;
  else
    v_previous_expires_at := null;
    v_new_expires_at := now() + make_interval(days => v_product.duration_days);
    v_event_type := 'premium_activated';

    insert into public.user_subscriptions (
      user_id,
      plan_code,
      status,
      started_at,
      expires_at,
      metadata
    ) values (
      v_order.user_id,
      v_product.plan_code,
      'premium_active',
      now(),
      v_new_expires_at,
      jsonb_build_object(
        'source', 'wompi',
        'environment', v_order.environment,
        'payment_order_id', v_order.id,
        'payment_reference', v_order.reference
      )
    )
    returning * into v_subscription;
  end if;

  insert into public.subscription_events (
    user_id,
    subscription_id,
    order_id,
    event_type,
    previous_expires_at,
    new_expires_at,
    metadata
  ) values (
    v_order.user_id,
    v_subscription.id,
    v_order.id,
    v_event_type,
    v_previous_expires_at,
    v_new_expires_at,
    jsonb_build_object('provider', v_order.provider, 'environment', v_order.environment)
  );

  update public.payment_orders
  set
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'subscription_applied', true,
      'subscription_id', v_subscription.id,
      'subscription_expires_at', v_new_expires_at
    ),
    updated_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'applied', true,
    'idempotent', false,
    'subscription_id', v_subscription.id,
    'expires_at', v_new_expires_at
  );
end;
$$;

revoke all on function public.predigol_apply_paid_premium_order(uuid) from anon, authenticated;
grant execute on function public.predigol_apply_paid_premium_order(uuid) to service_role;
