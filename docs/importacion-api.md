# Importacion desde API-Football

PrediGol usa el proveedor real ya integrado en el proyecto: API-Football de API-Sports (`https://v3.football.api-sports.io`). La clave se lee solo desde `prediction-service/.env` o desde secretos seguros del backend/Edge Function.

Variables requeridas:

```text
API_FOOTBALL_KEY=
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

No uses `VITE_*` para claves privadas de API.

## Comandos

Desde la raiz `PrediGol/`:

```powershell
python scripts/preflight_modelos.py --liga "239" --temporada "2026"
python scripts/importar_desde_api.py --listar-ligas
python scripts/importar_desde_api.py --liga "239" --listar-temporadas
python scripts/importar_desde_api.py --liga "239" --temporada "2026" --dry-run
python scripts/importar_desde_api.py --liga "239" --temporada "2026" --confirm
python scripts/importar_desde_api.py --liga "239" --temporada "2026" --desde "2026-01-01" --hasta "2026-12-31" --solo-finalizados --confirm
python scripts/sincronizar_partidos_api.py --liga "239" --temporada "2026"
```

La temporada debe ser el valor que devuelve API-Football en `/leagues` dentro de `seasons[].year`. En la estructura existente de API-Football es numerica, por ejemplo `2025` o `2026`.

## Flujo

El importador valida clave, conectividad, liga/temporada, descarga `/fixtures` con paginacion, normaliza fechas/equipos, aplica `team_aliases`, detecta duplicados por `api_football_fixture_id` y por fallback, genera resumen de calidad y escribe reportes en `reports/`.

Dry-run es el comportamiento seguro recomendado. Solo `--confirm` escribe en Supabase y registra `model_datasets` y `model_runs` con `source_type='api'` y `run_type='api_import'`.

## Deduplicacion

Prioridad:

1. `fixture.id` de API-Football, guardado como `api_football_fixture_id`.
2. Identidad externa existente cuando venga en importaciones manuales/CSV.
3. Fallback deterministico con fecha normalizada, torneo, temporada, local, visitante y ronda.

Si un partido ya existe por ID o fallback, no se sobreescribe silenciosamente. Se omite y queda reportado como duplicado/conflicto para revision.

## Aliases

El nombre fuente queda conservado en `payload_api.raw` y `payload_api.raw_api_football`. El canonico aplicado queda en `local_nombre`, `visitante_nombre` y `payload_api.team_normalization`.

Si hay aliases pendientes, revisalos en `/admin/modelo` o en la tabla `team_aliases` antes de usar metricas definitivas.

## Plan o cuota

Si API-Football no permite una temporada por el plan contratado, `preflight_modelos.py --liga ... --temporada ...` o el importador marcaran `BLOQUEADO` por autenticacion/plan, cuota o respuesta vacia.
