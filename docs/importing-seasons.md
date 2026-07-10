# Importacion de temporadas

## Formatos soportados

- CSV.
- JSON.
- Excel queda documentado como pendiente porque no hay dependencia compatible instalada.
- API-Football mediante `scripts/importar_temporada_api.py` y `scripts/importar_ligas_temporadas.py`.

## Columnas esperadas

- `fecha`
- `torneo`
- `temporada`
- `local`
- `visitante`
- `goles_local`
- `goles_visitante`
- `estado`
- `external_id` opcional
- `jornada` opcional
- `pais` opcional

Ejemplo: `manual-data/temporada-ejemplo.csv`.

## Dry-run

Desde la raiz del repositorio en PowerShell:

```powershell
python scripts/importar_temporada.py manual-data/temporada-ejemplo.csv
```

## Confirmar importacion

```powershell
python scripts/importar_temporada.py manual-data/temporada-ejemplo.csv --confirm
```

## Deduplicacion

La importacion detecta duplicados con esta prioridad:

1. `external_id`, si existe.
2. `api_football_fixture_id` o `fixture_id`, si existen.
3. Fallback deterministico por `fecha`, `torneo`, `temporada`, `local`, `visitante` y `jornada/ronda`.

El fallback usa nombres normalizados y aliases aprobados cuando existan. Dos partidos entre los mismos equipos en fechas diferentes no se consideran duplicados. La misma fecha en torneos diferentes tampoco se considera duplicada.

El dry-run genera JSON y CSV en `reports/` con filas validas, descartadas, duplicados internos, duplicados contra Supabase cuando hay conexion, aliases pendientes, torneos, rango de fechas, equipos y advertencias.

Con `--confirm`, los partidos ya existentes se omiten; no se reemplazan ni borran historicos existentes automaticamente. Se registran `model_datasets` por checksum y un `model_runs` por ejecucion.

## Importacion multi-liga desde API-Football

Para ampliar la validacion real sin hacer tuning sobre una sola liga, se puede generar un set local de datasets para varias ligas y temporadas:

```powershell
python scripts/importar_ligas_temporadas.py --seasons 2022,2023,2024
```

Ligas por defecto:

| Liga | API-Football ID |
| --- | ---: |
| Premier League | 39 |
| LaLiga | 140 |
| Serie A | 135 |
| Bundesliga | 78 |
| Ligue 1 | 61 |

Tambien se puede pasar una lista explicita:

```powershell
python scripts/importar_ligas_temporadas.py --league "Premier League:39" --league "LaLiga:140" --seasons 2022,2023,2024
```

El script requiere `FOOTBALL_API_KEY` o `API_FOOTBALL_KEY` en `prediction-service/.env` o en el entorno. Si un dataset ya existe en `reports/`, se omite para no gastar cuota. Para regenerarlo, usar `--force`.

Los archivos se guardan con el patron usado por el backtest:

```text
reports/api_api_football_liga-{id}_temporada-{season}_dataset.json
```

El resumen por liga/temporada incluye partidos descargados, finalizados, descartados y ruta del dataset. Si falla una liga, el script registra el error y continua con las demas.

Luego de importar, ejecutar el backtest multi-dataset:

```powershell
python scripts/backtest_v1_v2.py --dataset-glob "reports/api_api_football_liga-*_temporada-*_dataset.json" --min-training 30
```

Esta importacion solo amplia datos de validacion. No implica cambiar defaults, no modifica V1/V2 y no justifica declarar superioridad de V2 sin estabilidad en Brier/log-loss, calibracion y resultados por liga/temporada.
