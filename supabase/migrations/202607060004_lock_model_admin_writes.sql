alter table public.model_datasets enable row level security;
alter table public.model_runs enable row level security;
alter table public.team_aliases enable row level security;

revoke insert, update, delete on public.model_datasets from anon, authenticated;
revoke insert, update, delete on public.model_runs from anon, authenticated;
revoke insert, update, delete on public.team_aliases from anon, authenticated;

grant select on public.model_datasets to authenticated;
grant select on public.model_runs to authenticated;
grant select on public.team_aliases to authenticated;

grant all on public.model_datasets to service_role;
grant all on public.model_runs to service_role;
grant all on public.team_aliases to service_role;
