drop function if exists public.actualizar_estado_team_alias(uuid, text, boolean, text, text, text);
drop function if exists public.guardar_team_alias(text, text, text, text, text, text, text, text, numeric, text);
drop function if exists public.obtener_model_admin_summary();

drop table if exists public.team_aliases;
drop table if exists public.model_runs;
drop table if exists public.model_datasets;
