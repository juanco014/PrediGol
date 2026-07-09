create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  active boolean not null default true,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_push_subscriptions_user_idx
  on public.web_push_subscriptions(user_id, active);

alter table public.web_push_subscriptions enable row level security;

drop policy if exists "web_push_subscriptions_own_rows"
  on public.web_push_subscriptions;
create policy "web_push_subscriptions_own_rows"
  on public.web_push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.web_push_subscriptions
  to authenticated;
