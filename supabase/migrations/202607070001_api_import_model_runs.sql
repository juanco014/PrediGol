alter table public.model_runs
  drop constraint if exists model_runs_run_type_check;

alter table public.model_runs
  add constraint model_runs_run_type_check
  check (run_type in ('diagnostic', 'prediction', 'dry_run', 'backtest', 'training', 'calibration', 'import_validation', 'api_import'));
