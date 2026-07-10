# Despliegue PrediGol

## Alcance

Este runbook prepara el MVP para desplegar frontend y operar predicciones contra Supabase real. No incluye pagos reales, Stripe, PayPal, MercadoPago ni cambios de modelo. V1 queda como produccion y V2 como experimental.

## 1. Preparar Supabase

1. Crear o seleccionar proyecto Supabase definitivo.
2. Confirmar URL del proyecto y publishable/anon key publica.
3. Aplicar migraciones desde la raiz del repo:

```bash
npx supabase db push
```

4. Validar que existan tablas clave:

```sql
select to_regclass('public.model_predictions');
select to_regclass('public.model_runs');
select to_regclass('public.model_datasets');
select to_regclass('public.team_aliases');
select to_regclass('public.subscription_plans');
select to_regclass('public.user_subscriptions');
```

5. Validar RPCs clave:

```sql
select proname from pg_proc where proname in (
  'predigol_es_admin',
  'obtener_plan_usuario',
  'obtener_predicciones_visibles',
  'obtener_prediccion_visible',
  'predigol_usuario_tiene_premium'
);
```

## 2. Configurar Variables Frontend

En `predigol-web/.env.local` para local o en hosting:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
# VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=tu_vapid_public_key
```

No configurar service role, API-Football key ni claves privadas en frontend.

## 3. Configurar Prediction Service

En `prediction-service/.env` local o en el runner privado:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_solo_backend
FOOTBALL_API_PROVIDER=api_football
FOOTBALL_API_KEY=tu_api_football_key
FOOTBALL_API_DRY_RUN=true
```

Cambiar `FOOTBALL_API_DRY_RUN=false` solo cuando se vaya a consumir API real con cuota disponible.

## 4. Crear Admin Inicial

Metodo recomendado en Supabase SQL Editor, despues de que el usuario exista y tenga perfil:

```sql
update public.profiles
set rol = 'admin', es_admin = true
where id = 'UUID_DEL_USUARIO_ADMIN';
```

Validacion:

```sql
select id, email, rol, es_admin
from public.profiles
where rol = 'admin' or es_admin = true;
```

Existe RPC `reclamar_primer_admin()` para bootstrap controlado si no existe ningun admin, pero no se expone desde la UI de despliegue. No habilitar flujos donde cualquier usuario pueda elevarse desde frontend.

## 5. Generar Pronosticos Iniciales

Verificar Python:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
```

Planificar importacion sin consumir cuota:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --league 140 --seasons 2024 --dry-run
```

Importacion real solo con `FOOTBALL_API_KEY` configurada y cuota confirmada:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --league 140 --seasons 2024 --force
```

Generar pronosticos V1 desde dataset local:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-140_temporada-2024_dataset.json --model v1
```

Si se usa el runner del servicio contra Supabase, mantener V1 como default operativo y registrar predicciones en `model_predictions` desde backend/script, nunca desde frontend con service role.

## 6. Build Frontend

```bash
cd predigol-web
npm test
npm run lint
npm run build
npm run preview
```

Preview local esperado: Vite mostrara una URL local, normalmente `http://localhost:4173/`.

## 7. Validar Rutas

Probar en navegador real las rutas documentadas en `docs/qa-despliegue-predigol.md`. Confirmar recarga directa de rutas privadas en hosting para evitar 404.

## 8. Verificar Premium/RLS

Con usuario gratis:

```sql
select * from public.obtener_predicciones_visibles(10);
```

La respuesta de predicciones premium bloqueadas debe tener campos sensibles en `null` y `is_locked = true`.

Con admin o usuario premium activo debe devolver contenido completo si existen filas premium.

## 9. Rollback Basico

Frontend:

1. Revertir al despliegue anterior desde el proveedor de hosting.
2. Confirmar variables de entorno previas.
3. Invalidar cache si aplica.

Supabase:

1. No editar migraciones ya aplicadas.
2. Crear migracion correctiva si hay bug de schema.
3. Desactivar temporalmente cron/API si consume cuota o falla.
4. Mantener backups antes de cambios sensibles.

## 10. Pendiente Para Pagos Reales

- Checkout server-side.
- Webhooks idempotentes.
- Secretos del proveedor fuera del frontend.
- Auditoria de cambios de suscripcion.
- Reconciliacion de pagos y expiraciones.

## 11. Estado QA Post-Despliegue Fase 7

Ejecucion local 2026-07-10:

- Frontend: tests, lint, build y preview pasan.
- Python: tests y verificacion de dependencias pasan.
- Dataset local disponible: `reports/api_api_football_liga-39_temporada-2024_dataset.json`.
- Pronosticos V1 locales ya generados: `reports/pronosticos_api_api_football_liga-39_temporada-2024_dataset_v1.json`.
- Supabase real no se valido desde este workspace porque faltan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `prediction-service/.env` y no existe `predigol-web/.env.local`.

Antes de declarar el despliegue validado contra backend real, completar:

1. Configurar variables publicas frontend.
2. Configurar variables privadas del servicio Python.
3. Validar migraciones/RPC/RLS en Supabase definitivo.
4. Probar usuario gratis, admin y premium manual en navegador real.

## 12. Estado QA Fase 7B

Ejecucion local 2026-07-10:

- Tests frontend/lint/build pasaron.
- Preview local arranco.
- Tests Python pasaron.
- `scripts/verificar_python.py` sigue reportando Supabase sin configurar.
- `predigol-web/.env.local` no existe.
- `prediction-service/.env` existe, pero faltan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Se reemplazaron valores reales encontrados en `.env.example` por placeholders.

Bloqueante para validar backend real: completar variables locales y reejecutar QA. Si las claves detectadas en `.env.example` estuvieron expuestas previamente, rotarlas antes del despliegue publico.

## 13. Reejecucion Fase 7B Con Credenciales

Ejecucion local 2026-07-10:

- `predigol-web/.env.local` existe y esta ignorado.
- `prediction-service/.env` existe y esta ignorado.
- Frontend tests/lint/build pasan.
- Python tests pasan.
- `scripts/verificar_python.py` conecta a Supabase.
- Supabase real tiene `profiles` y `model_predictions` accesibles.
- Supabase real no expone o no tiene aplicadas las tablas admin/freemium `model_runs`, `model_datasets`, `team_aliases`, `subscription_plans`, `user_subscriptions`.
- RPCs freemium/admin esperadas no estan disponibles por REST.

Accion antes de QA funcional real: aplicar/verificar migraciones del MVP en Supabase definitivo con `npx supabase db push` o revisar el historial de migraciones aplicado en el dashboard/CLI.

## 14. Fase 7C - Inventario De Migraciones MVP

Supabase CLI no esta disponible en este entorno (`supabase: command not found`), por lo que no se aplicaron migraciones automaticamente. No hacer `db reset` sobre la base real.

| Migracion | Tablas | RPC/funciones | RLS/policies | Estado en Supabase real |
| --- | --- | --- | --- | --- |
| `202606240001_api_football_predictions.sql` | `model_predictions`, football API tables | N/D | RLS en `model_predictions` y tablas football | Parcial: `model_predictions` OK. |
| `202606240005_admin_manual_match_panel.sql` | Ajustes `profiles` | `predigol_es_admin`, `reclamar_primer_admin`, RPC admin partidos | Grants admin | Parcial: `predigol_es_admin` no ejecutable por REST en QA. |
| `202606240006_roles_and_relevant_matches.sql` | `profiles.rol`, flags partidos | `predigol_es_admin`, `reclamar_primer_admin`, `marcar_partido_relevante` | Grants admin | Parcial: `profiles` OK; validar funcion tras aplicar migraciones. |
| `202607060001_model_v2_metadata.sql` | `model_prediction_settings`, columnas metadata en `model_predictions` | `obtener_model_prediction_settings`, `guardar_model_prediction_settings` | RLS admin settings | Pendiente/no verificado. |
| `202607060002_model_runs_datasets_team_aliases.sql` | `model_datasets`, `model_runs`, `team_aliases` | `obtener_model_admin_summary`, `guardar_team_alias`, `actualizar_estado_team_alias` | RLS admin read | Faltante en Supabase real. |
| `202607060003_model_dataset_checksum_unique.sql` | Indice `model_datasets` | N/D | N/D | Faltante hasta que exista `model_datasets`. |
| `202607060004_lock_model_admin_writes.sql` | N/D | N/D | Revoca escrituras auth y mantiene service role | Faltante hasta que existan tablas admin. |
| `202607070001_api_import_model_runs.sql` | Ajusta constraint `model_runs` | N/D | N/D | Faltante hasta que exista `model_runs`. |
| `202607100001_freemium_premium_access.sql` | `subscription_plans`, `user_subscriptions`, columnas premium en `model_predictions` | `predigol_usuario_tiene_premium`, `obtener_plan_usuario`, `obtener_predicciones_visibles`, `obtener_prediccion_visible` | RLS premium/admin | Faltante en Supabase real. |

### Verificacion Real Fase 7C

Comando agregado:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_supabase_mvp.py
```

Resultado actual:

- OK: `profiles`, `model_predictions`.
- Faltante: `model_runs`, `model_datasets`, `team_aliases`, `subscription_plans`, `user_subscriptions`.
- RPC faltantes/no disponibles: `obtener_plan_usuario`, `obtener_predicciones_visibles`, `obtener_prediccion_visible`, `predigol_usuario_tiene_premium`.
- `predigol_es_admin`: error de permisos o grant/RLS insuficiente en llamada REST.

### Aplicacion Segura De Migraciones

Opcion A, CLI en una maquina con Supabase CLI configurado:

```bash
supabase --version
supabase status
supabase migration list
supabase db push
```

Reglas:

- No ejecutar `supabase db reset` en la base real.
- Hacer backup antes de `db push`.
- Revisar el diff/plan del CLI antes de confirmar.
- Reejecutar `scripts/verificar_supabase_mvp.py` despues.

Opcion B, SQL Editor si no hay CLI:

1. Hacer backup/snapshot del proyecto Supabase.
2. Aplicar en orden los archivos faltantes listados arriba.
3. No editar migraciones historicas; copiar el SQL exacto del repo.
4. Ejecutar primero en staging si existe.
5. Reejecutar `scripts/verificar_supabase_mvp.py` y `scripts/verificar_python.py`.

Orden minimo recomendado para alinear el MVP detectado:

1. `202606240005_admin_manual_match_panel.sql` y `202606240006_roles_and_relevant_matches.sql` si `predigol_es_admin` no existe/grants fallan.
2. `202607060001_model_v2_metadata.sql`.
3. `202607060002_model_runs_datasets_team_aliases.sql`.
4. `202607060003_model_dataset_checksum_unique.sql`.
5. `202607060004_lock_model_admin_writes.sql`.
6. `202607070001_api_import_model_runs.sql`.
7. `202607100001_freemium_premium_access.sql`.

No se creo migracion correctiva nueva porque el repo ya contiene las tablas/RPC faltantes; el problema esta en la instancia real no alineada.
