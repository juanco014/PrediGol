# Preflight de modelos

Ejecuta desde `PrediGol/`:

```powershell
python scripts/preflight_modelos.py
python scripts/preflight_modelos.py --liga "239" --temporada "2026"
```

Estados posibles:

```text
OK
ADVERTENCIA
BLOQUEADO
```

El preflight valida Python, dependencias, `prediction-service/.env`, Supabase, tablas administrativas, aliases pendientes, historicos disponibles, preparacion V1/V2 y API-Football.

Para API-Football valida que `API_FOOTBALL_KEY` exista sin mostrarla, que no haya `VITE_API_FOOTBALL_KEY`, que `/status` responda, y si se pasan liga/temporada intenta consultar disponibilidad y una muestra de fixtures.

`--confirm` queda bloqueado si falta `SUPABASE_SERVICE_ROLE_KEY`, aunque el dry-run de API puede generar reportes si la clave de API esta configurada.
