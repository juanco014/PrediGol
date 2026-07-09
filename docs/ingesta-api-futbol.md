# Ingesta API Futbol

PrediGol soporta una capa de ingesta configurable hacia proveedores externos. El proveedor inicial es `api_football` (API-Football/API-Sports). No se debe entrenar directamente contra la API en vivo: primero se importa, normaliza, valida y registra un dataset reproducible.

## Variables

Configurar `prediction-service/.env` sin subir claves reales:

```env
FOOTBALL_API_PROVIDER=api_football
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
FOOTBALL_API_KEY=
FOOTBALL_API_TIMEOUT_SECONDS=20
FOOTBALL_API_MAX_RETRIES=3
FOOTBALL_API_RATE_LIMIT_SLEEP_SECONDS=1
```

`FOOTBALL_API_KEY` debe configurarse solo en `prediction-service/.env` local. No hardcodear ni commitear claves reales.

## Dry-Run

Desde la raiz `PrediGol/`:

```bash
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --dry-run
```

Tambien se puede resolver por nombre, aunque el ID es mas reproducible:

```bash
python scripts/importar_temporada_api.py --provider api_football --league "Premier League" --season 2025 --dry-run
```

El dry-run consulta la API, normaliza, valida y escribe reportes locales en `reports/`, pero no escribe en Supabase. Para ligas europeas, `--season 2025` representa la temporada 2025-2026 cuando el proveedor usa el ano de inicio.

Si falta la clave, el comando debe fallar con `Missing FOOTBALL_API_KEY` y no genera importacion.

## Historico Premier League

Antes de validar 2025-2026, preparar temporadas anteriores:

```bash
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2021 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2022 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2023 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2024 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --dry-run
```

Ejecutar `--save` solo si los reportes no muestran errores graves de calidad.

## Guardar

```bash
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --save
```

`--save` escribe partidos en Supabase (`partidos`) y registra trazabilidad en `model_datasets` y `model_runs` si las tablas existen. Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `prediction-service/.env`.

Para entrenar/backtestear localmente sin Supabase, usar guardado local explicito:

```bash
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --save-local
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --save-local --output reports
```

`--save-local` genera reportes y un archivo `*_dataset.json` en `reports/` o en el directorio indicado con `--output`. No escribe en Supabase.

## Listar Datasets Locales

```bash
python scripts/listar_datasets.py
python scripts/listar_datasets.py --json
```

El listado muestra archivo, proveedor, liga, temporada, partidos totales/finalizados, rango de fechas, estado de calidad y checksum si existe.

## Formato Interno

Cada partido importado conserva la respuesta cruda en `payload_api.raw_api_football`, pero expone un formato estable en `payload_api.internal_match`:

```json
{
  "external_match_id": "123",
  "provider": "api-football",
  "league_id": 39,
  "league_name": "Premier League",
  "season": 2025,
  "match_date": "2025-08-16T14:00:00+00:00",
  "home_team": "Arsenal",
  "away_team": "Chelsea",
  "home_score": 2,
  "away_score": 1,
  "status": "finalizado",
  "round": "Regular Season - 1",
  "venue": "Emirates Stadium"
}
```

## Validaciones

Antes de guardar se valida que no haya equipos vacios, partidos finalizados sin marcador, duplicados por ID externo o fallback, fechas invalidas, temporadas mezcladas y aliases pendientes. Si el dataset no es valido para entrenamiento, `--save` queda bloqueado.
