drop index if exists public.model_predictions_model_version_generated_idx;

drop function if exists public.guardar_model_prediction_settings(text);
drop function if exists public.obtener_model_prediction_settings();
drop table if exists public.model_prediction_settings;

alter table public.model_predictions
  drop column if exists model_parameters,
  drop column if exists history_matches_used,
  drop column if exists probabilities_calibrated,
  drop column if exists probabilities_uncalibrated,
  drop column if exists data_quality,
  drop column if exists quality_warnings;
