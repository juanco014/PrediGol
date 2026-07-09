# Seguridad Supabase del modelo

## Tablas administrativas

- `model_runs`: registra ejecuciones de diagnostico, importacion, prediccion y backtest.
- `model_datasets`: registra metadatos de datasets, checksum, calidad y origen.
- `team_aliases`: registra aliases, estados de revision y normalizacion de equipos.

## Lectura

Las tablas tienen RLS habilitado. Los usuarios autenticados solo pueden leer si `public.predigol_es_admin()` retorna `true`.

`service_role` puede leer desde scripts Python, backend o Edge Functions de confianza.

## Escritura

Usuarios normales no deben insertar, actualizar ni borrar filas en estas tablas. La migracion `202607060004_lock_model_admin_writes.sql` revoca explicitamente `insert`, `update` y `delete` para `anon` y `authenticated`.

La migracion `202607060005_partidos_import_fallback_identity.sql` agrega un indice unico sobre `payload_api->fallback_identity->>key` para reforzar idempotencia de importaciones manuales/CSV/JSON sin identificador externo.

Las escrituras administrativas desde frontend pasan por RPCs con validacion interna de administrador. Las escrituras operativas de importacion/backtest usan `SUPABASE_SERVICE_ROLE_KEY` solo desde Python o backend seguro.

## RPCs

- `obtener_model_admin_summary()`: devuelve resumen administrativo del modelo. Requiere `predigol_es_admin()`.
- `guardar_team_alias(...)`: crea o actualiza un alias de equipo. Requiere `predigol_es_admin()` y valida estados permitidos.
- `actualizar_estado_team_alias(...)`: cambia estado, activacion y datos canonicos de un alias. Requiere `predigol_es_admin()` y valida estados permitidos.

Las funciones usan `security definer` con `set search_path = public` y validan administrador al inicio.

## Service Role Key

`SUPABASE_SERVICE_ROLE_KEY` nunca debe estar en React, Vite, archivos publicos ni variables `VITE_*`.

Debe vivir solo en `prediction-service/.env` para ejecucion local/servidor o en secretos de backend/Edge Functions. El frontend usa la clave publica `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Validar administradores

La funcion `public.predigol_es_admin()` considera administrador a:

- `auth.role() = 'service_role'`.
- Usuarios con `profiles.rol = 'admin'`.
- Usuarios con `profiles.es_admin = true`.

Antes de dar acceso al panel o ejecutar RPCs administrativas desde UI, confirma que el perfil del usuario tenga `rol = 'admin'` o `es_admin = true`.

## Verificacion recomendada

Desde la raiz del repositorio:

```powershell
python scripts/verificar_python.py
```

Luego verifica en Supabase que las migraciones esten aplicadas y que un usuario no admin no pueda leer ni escribir `model_runs`, `model_datasets` ni `team_aliases`.

Tambien puedes ejecutar:

```powershell
python scripts/preflight_modelos.py
```
