# Model runs y datasets

## Tablas

`model_runs` registra ejecuciones de diagnostico, dry-run, prediccion, backtest, entrenamiento, calibracion e importacion. Guarda modelo, tipo, estado, fechas, dataset, rango de datos, torneos, cantidades, configuracion, metricas, advertencias y errores.

`model_datasets` registra metadatos de conjuntos de datos. No duplica partidos: resume fuente, temporada, torneo, rango, calidad, descartes, version de normalizacion y checksum.

## Migraciones

- `supabase/migrations/202607060002_model_runs_datasets_team_aliases.sql`
- `supabase/migrations/202607060002_model_runs_datasets_team_aliases_down.sql`

## Uso desde scripts

El comparativo puede registrar dataset y run:

Desde la raiz del repositorio:

```powershell
python scripts/backtest_v1_v2.py --register
```

La importacion confirmada tambien registra dataset y run:

```powershell
python scripts/importar_temporada.py manual-data/temporada-ejemplo.csv --confirm
```

Si la migracion no esta aplicada, los scripts generan reportes locales y muestran un aviso.
