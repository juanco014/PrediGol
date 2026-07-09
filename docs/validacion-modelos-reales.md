# Validacion con datos reales

Antes de afirmar que V2 supera a V1 se necesitan historicos reales suficientes, aliases revisados y comparacion sobre el mismo conjunto de partidos.

Flujo recomendado:

```powershell
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2021 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2022 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2023 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2024 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --dry-run
python scripts/listar_datasets.py
python scripts/backtest_v1_v2.py --dataset-glob "reports/api_api_football_liga-39_temporada-*_dataset.json" --season 2025 --min-training 30
```

Revisa los reportes en `reports/` antes de confirmar importaciones. Si hay pocos partidos, aliases pendientes, temporadas no disponibles por plan, o duplicados/conflictos, el backtest solo sirve como diagnostico preliminar.

V1 y V2 deben evaluar exactamente las mismas fechas, torneos y partidos finalizados. No uses partidos futuros al preparar historicos de backtest.

No hay evidencia valida para afirmar que V2 es mejor que V1 hasta completar este flujo con datos reales y metricas comparables.
## Ingesta API Externa

Para validar con datos reales importados desde proveedor externo:

```bash
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --save-local
python scripts/backtest_v1_v2.py --dataset reports/api_api_football_liga-39_temporada-2025_dataset.json
```

Usar `--save` solo cuando se quiera guardar en Supabase y existan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Para validacion local reproducible, preferir `--save-local`.

Para validacion seria, combinar historico previo y evaluar 2025-2026:

```bash
python scripts/backtest_v1_v2.py --datasets reports/api_api_football_liga-39_temporada-2021_dataset.json reports/api_api_football_liga-39_temporada-2022_dataset.json reports/api_api_football_liga-39_temporada-2023_dataset.json reports/api_api_football_liga-39_temporada-2024_dataset.json reports/api_api_football_liga-39_temporada-2025_dataset.json --season 2025 --min-training 30
```

No mezclar partidos futuros dentro del entrenamiento. El backtest compara V1 y V2 cronologicamente, ignora partidos pendientes y no declara superioridad de V2 si las metricas no lo prueban. El reporte incluye accuracy 1X2, Brier score, log-loss, MAE de goles, calibracion por bins, fechas de evaluacion y advertencias anti-leakage.

## Resultado Premier League 2024

Backtest base analizado: `reports/backtest_v1_v2_20260709T162534Z.json`.

Datos usados: Premier League 2022, 2023 y 2024 desde datasets locales API-Football, con 1140 partidos finalizados. Evaluacion: temporada 2024, 380 partidos, desde `2024-08-16T19:00:00+00:00` hasta `2025-05-25T15:00:00+00:00`.

Metricas base:

| Modelo | Brier | Log-loss | Accuracy 1X2 | Exact score | Goals MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| V1 | 0.612233 | 1.019543 | 0.510526 | 0.110526 | 0.949025 |
| V2 rho=-0.08 | 0.615427 | 1.026795 | 0.471053 | 0.123684 | 1.040328 |

Diagnostico base: V2 solo mejora exact score. Empeora Brier, log-loss, accuracy 1X2 y MAE de goles frente a V1. V2 predice demasiados locales como clase final (`294` locales y `86` visitantes, sin empates), mientras los resultados reales fueron `155` locales, `93` empates y `132` visitantes. La probabilidad media de empate de V2 fue `0.2226`, por debajo de la frecuencia real de empates (`0.2447`). El total medio de goles esperados de V2 fue `3.764`, por encima del total real `2.934`, por lo que el MAE de goles queda peor que V1.

Cambio aplicado en V2: ajuste pequeno y configurable de Dixon-Coles, cambiando `dixon_coles_rho` por defecto de `-0.08` a `-0.20`. Este cambio afecta solo la redistribucion de probabilidades en marcadores bajos; no cambia V1, rutas publicas, Supabase/RLS, backend ni importacion CSV.

Backtest posterior: `reports/backtest_v1_v2_20260709T202955Z.json`.

Metricas posteriores:

| Modelo | Brier | Log-loss | Accuracy 1X2 | Exact score | Goals MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| V1 | 0.612233 | 1.019543 | 0.510526 | 0.110526 | 0.949025 |
| V2 rho=-0.20 | 0.614925 | 1.025598 | 0.471053 | 0.136842 | 1.040328 |

Conclusion: el ajuste mejora levemente V2 contra su base en Brier, log-loss y exact score, pero no mejora accuracy 1X2 ni MAE de goles, y V2 sigue sin superar a V1. La conclusion debe permanecer neutral: no existe evidencia suficiente para concluir que V2 sea superior. La muestra de 380 partidos es util como holdout real inicial, pero sigue limitada a una liga y una temporada de evaluacion.
