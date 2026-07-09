# Entrenamiento Modelo Real

El flujo recomendado es importar datos historicos, guardar un dataset reproducible y luego ejecutar backtest. No entrenar ni validar directamente contra la API externa en vivo.

## Importar Dataset

```bash
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --save-local
```

El comando genera `reports/api_api_football_liga-39_temporada-2025_dataset.json` o un nombre equivalente indicado en la salida.

`--save-local` no requiere Supabase. `--save` queda reservado para persistir en Supabase y requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

Para historico minimo de Premier League, repetir dry-run y luego save para 2021, 2022, 2023, 2024 y 2025. No usar 2025-2026 como unica fuente de entrenamiento.

```bash
python scripts/listar_datasets.py
```

## Backtest V1/V2

Usar el archivo de dataset generado:

```bash
python scripts/backtest_v1_v2.py --dataset reports/api_api_football_liga-39_temporada-2025_dataset.json --min-training 30
```

Para combinar varias temporadas locales:

```bash
python scripts/backtest_v1_v2.py --datasets reports/api_api_football_liga-39_temporada-2021_dataset.json reports/api_api_football_liga-39_temporada-2022_dataset.json reports/api_api_football_liga-39_temporada-2023_dataset.json reports/api_api_football_liga-39_temporada-2024_dataset.json reports/api_api_football_liga-39_temporada-2025_dataset.json --season 2025 --min-training 30
```

O por patron:

```bash
python scripts/backtest_v1_v2.py --dataset-glob "reports/api_api_football_liga-39_temporada-*_dataset.json" --season 2025 --min-training 30
```

Para validacion real, entrenar con temporadas historicas anteriores y evaluar 2025-2026 con `--season 2025` o filtros de fecha. El backtest ordena cronologicamente y para cada partido solo entrena con partidos anteriores, evitando fuga temporal dentro del dataset. Los partidos pendientes se ignoran para entrenamiento/evaluacion.

## Metricas

El reporte comparativo incluye Brier score, log-loss, accuracy 1X2, MAE de goles local/visitante y combinado, calibracion simple por bins de confianza, cantidad de partidos evaluados, rango de fechas evaluado y resumen de calidad. V2 no debe declararse superior a V1 salvo que las metricas reales lo demuestren con muestra suficiente.

## Limitaciones

La calidad depende del plan y cobertura del proveedor externo. Los partidos pendientes pueden importarse para operacion, pero no deben usarse como historico finalizado para entrenamiento. Revisar aliases pendientes antes de tomar conclusiones definitivas.

Si el reporte indica una sola temporada, pocos partidos evaluados o aliases pendientes, la conclusion debe permanecer neutral: no hay evidencia suficiente para afirmar mejora de V2.
