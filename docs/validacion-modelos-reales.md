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
