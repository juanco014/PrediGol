# Importacion de temporadas

## Formatos soportados

- CSV.
- JSON.
- Excel queda documentado como pendiente porque no hay dependencia compatible instalada.
- API futura queda preparada mediante placeholder, sin claves ni llamadas pagas.

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
