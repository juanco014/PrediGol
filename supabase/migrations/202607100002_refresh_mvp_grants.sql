do $$
begin
  if to_regprocedure('public.predigol_es_admin()') is not null then
    grant execute on function public.predigol_es_admin() to authenticated, service_role;
  end if;

  if to_regprocedure('public.obtener_plan_usuario()') is not null then
    grant execute on function public.obtener_plan_usuario() to authenticated, service_role;
  end if;

  if to_regprocedure('public.obtener_predicciones_visibles(integer)') is not null then
    grant execute on function public.obtener_predicciones_visibles(integer) to authenticated, service_role;
  end if;

  if to_regprocedure('public.obtener_prediccion_visible(bigint)') is not null then
    grant execute on function public.obtener_prediccion_visible(bigint) to authenticated, service_role;
  end if;

  if to_regprocedure('public.predigol_usuario_tiene_premium(uuid)') is not null then
    grant execute on function public.predigol_usuario_tiene_premium(uuid) to authenticated, service_role;
  end if;

  if to_regclass('public.subscription_plans') is not null then
    grant select on public.subscription_plans to authenticated;
    grant all on public.subscription_plans to service_role;
  end if;

  if to_regclass('public.user_subscriptions') is not null then
    grant select on public.user_subscriptions to authenticated;
    grant all on public.user_subscriptions to service_role;
  end if;

  if to_regclass('public.model_datasets') is not null then
    grant select on public.model_datasets to authenticated;
    grant all on public.model_datasets to service_role;
  end if;

  if to_regclass('public.model_runs') is not null then
    grant select on public.model_runs to authenticated;
    grant all on public.model_runs to service_role;
  end if;

  if to_regclass('public.team_aliases') is not null then
    grant select on public.team_aliases to authenticated;
    grant all on public.team_aliases to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
