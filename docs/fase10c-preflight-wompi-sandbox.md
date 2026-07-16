# Fase 10C.1 - Preflight Wompi Sandbox

## 1. Estado inicial

- Repositorio: `C:\Users\manja\OneDrive\Escritorio\PrediGol2.0\PrediGol-monorepo`.
- Rama: `main`.
- Estado remoto: rama sincronizada con `origin/main` al inicio de la fase.
- Worktree inicial: limpio.
- Ultimo commit inicial: `2b29016 chore(supabase): remove rollback scripts from migrations`.
- Commits recientes confirmados: `2b29016`, `9bdc346`, `9294b5c`, `58e397b`, `572a26f`.
- `git diff --check` inicial: sin errores.

## 2. Alcance

Esta fase audita el estado local y prepara el runbook para aplicar despues la integracion Wompi en Supabase Sandbox.

No aplica cambios remotos, no configura secretos remotos, no despliega Edge Functions y no llama a Wompi.

## 3. Restricciones

No ejecutado en esta fase:

- `supabase link`.
- `supabase db push`.
- `supabase db pull`.
- `supabase migration repair`.
- `supabase functions deploy`.
- `supabase secrets set`.
- `supabase db reset --linked`.
- llamadas a API Wompi.
- checkout real.
- pagos sandbox o produccion.
- configuracion de webhook en Wompi.
- cambios en Supabase remoto.
- cambios en Wompi remoto.
- commit.
- push.

## 4. Estructura Supabase auditada

Archivos y directorios revisados:

- `supabase/config.toml`.
- `supabase/.gitignore`.
- `supabase/migrations/`.
- `supabase/rollbacks/`.
- `supabase/tests/`.
- `supabase/functions/_shared/`.
- `supabase/functions/wompi-create-checkout/`.
- `supabase/functions/wompi-payment-status/`.
- `supabase/functions/wompi-webhook/`.

Resultado:

- Los archivos `_down.sql` estan unicamente en `supabase/rollbacks`.
- No quedan archivos `_down.sql` en `supabase/migrations`.
- Las migraciones estan ordenadas cronologicamente por nombre.
- La migracion base `202606230001_predigol_base_schema.sql` se ejecuta antes de las incrementales.
- La migracion Wompi `202607150001_wompi_premium_payments.sql` se ejecuta antes de `202607160001_harden_runtime_grants.sql` y `202607160002_profiles_personal_update.sql`.
- No existen timestamps duplicados en `supabase/migrations`.
- `supabase/config.toml` no contiene `project_ref`, URL remota de proyecto ni secretos directos; usa configuracion local y placeholders `env(...)` de plantilla Supabase.
- `supabase/.gitignore` cubre `.branches`, `.temp`, `.env.keys`, `.env.local` y `.env.*.local`.

## 5. Inventario de migraciones

| Migracion | Funcion |
| --- | --- |
| `202606230001_predigol_base_schema.sql` | Esquema base: profiles, partidos, pronosticos, ligas, membresias, RLS, RPCs base y grants iniciales. |
| `202606240001_api_football_predictions.sql` | Tablas y columnas para API-Football, fixtures, equipos, competiciones, snapshots y predicciones de modelo. |
| `202606240002_fix_partidos_api_upsert_constraint.sql` | Ajusta constraint/indice para upserts por fixture API-Football. |
| `202606240003_hybrid_free_manual_flow.sql` | Soporte de flujo hibrido manual/API para partidos. |
| `202606240004_fix_manual_partido_ids.sql` | Ajusta IDs manuales de partidos. |
| `202606240005_admin_manual_match_panel.sql` | Soporte DB para panel admin de partidos manuales. |
| `202606240006_roles_and_relevant_matches.sql` | Roles/admin en perfiles y flags de partidos relevantes. |
| `202606250001_google_sheet_imports.sql` | Importacion desde Google Sheet y trazabilidad externa. |
| `202606250002_google_sheet_auto_sync.sql` | Automatizacion/sync de Google Sheet con extensiones necesarias. |
| `202606250003_admin_match_editing.sql` | Edicion admin de partidos. |
| `202606250004_predictions_scoring_ranking.sql` | Scoring de pronosticos y rankings global/liga. |
| `202606250005_api_football_paid_cron.sql` | Configuracion cron/sync pagado para API-Football. |
| `202607010001_api_football_sync_monitoring.sql` | Monitoreo de ejecuciones de sync API-Football. |
| `202607010002_model_evaluations.sql` | Evaluaciones de modelo. |
| `202607010003_app_error_monitoring.sql` | Registro de errores de aplicacion. |
| `202607030001_favorites_notification_preferences.sql` | Favoritos y preferencias de notificacion por usuario. |
| `202607030002_segmented_rankings.sql` | Rankings segmentados. |
| `202607030003_web_push_subscriptions.sql` | Suscripciones Web Push. |
| `202607030004_web_push_dispatch.sql` | Despacho Web Push y configuracion relacionada. |
| `202607060001_model_v2_metadata.sql` | Metadata para modelo V2. |
| `202607060002_model_runs_datasets_team_aliases.sql` | Runs, datasets y alias de equipos para trazabilidad de modelos. |
| `202607060003_model_dataset_checksum_unique.sql` | Unicidad por checksum en datasets. |
| `202607060004_lock_model_admin_writes.sql` | Bloqueo/endurecimiento de escrituras admin de modelo. |
| `202607060005_partidos_import_fallback_identity.sql` | Identidad fallback para importacion de partidos. |
| `202607070001_api_import_model_runs.sql` | Registro de runs de importacion API. |
| `202607100001_freemium_premium_access.sql` | Planes, suscripciones, entitlement premium y RPCs de visibilidad. |
| `202607100002_refresh_mvp_grants.sql` | Refresco de grants MVP. |
| `202607150001_wompi_premium_payments.sql` | Tablas Wompi, producto sandbox, ordenes, transacciones, webhooks, eventos de suscripcion y RPC de activacion premium. |
| `202607160001_harden_runtime_grants.sql` | Revoca permisos peligrosos runtime/default para `anon` y `authenticated`. |
| `202607160002_profiles_personal_update.sql` | Corrige update personal de profiles con grants por columna. |

## 6. Auditoria de secretos

Comandos de inspeccion usados:

- `git ls-files "*env*"`.
- `git ls-files supabase`.
- `git grep` con patrones `WOMPI`, `SUPABASE_SERVICE_ROLE_KEY`, `SERVICE_ROLE`, `PRIVATE_KEY`, `PUBLIC_KEY`, `EVENTS_SECRET`, `INTEGRITY_SECRET`, `Bearer`, `Authorization`, `sandbox`, `production`, `prod`, con salida redactada.

Resultado:

- Archivos `.env` versionados: ninguno.
- Archivos de ejemplo versionados: `.env.example`, `prediction-service/.env.example`, `predigol-web/.env.example`.
- Secretos directos encontrados: no se detectaron valores reales completos en archivos versionados.
- Claves que aparenten ser reales: no detectadas.
- Coincidencias encontradas: placeholders, documentacion, nombres de variables, constantes sandbox, tests con valores ficticios como `test_integrity_secret`, `test_events_secret`, `pub_test_placeholder` y fixtures de unit tests.
- No se abrieron archivos locales ignorados que puedan contener credenciales reales.

## 7. Variables de entorno exactas

Variables detectadas exclusivamente a partir de `Deno.env.get(...)` y llamadas a `readRequiredEnv(...)` en funciones Wompi.

| Variable | Funcion que la usa | Obligatoria | Proposito | Sandbox/general | Fuente | Riesgo si falta | Frontend |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL` | `wompi-create-checkout`, `wompi-payment-status`, `wompi-webhook` | Si | URL del proyecto Supabase para crear clientes server-side. | General | Proporcionada por Supabase Edge Runtime en despliegue; local/remoto debe existir. | Las funciones fallan con error 500 o no pueden validar usuario/procesar webhook. | No debe usarse como secreto; en frontend puede existir URL publica separada, pero esta variable de funcion no debe gestionarse desde navegador. |
| `SUPABASE_SECRET_KEYS` | `wompi-create-checkout`, `wompi-payment-status`, `wompi-webhook` | Opcional | Nuevo contenedor de secret keys; si existe se usa para derivar la key server-side. | General | Supabase/platforma. | Si falta, se usa fallback `SUPABASE_SERVICE_ROLE_KEY`. | No debe estar disponible en frontend. |
| `SUPABASE_SERVICE_ROLE_KEY` | `wompi-create-checkout`, `wompi-payment-status`, `wompi-webhook` | Condicional | Fallback de service role para operaciones server-side y bypass controlado de RLS. | General | Supabase/platforma o secreto manual segun entorno. | Si falta junto con `SUPABASE_SECRET_KEYS`, las funciones fallan. | Nunca debe estar disponible en frontend. |
| `WOMPI_PUBLIC_KEY_SANDBOX` | `wompi-create-checkout` | Si | Llave publica sandbox incluida en URL de checkout alojado. | Sandbox | Manual, desde Wompi Sandbox. | No se puede construir checkout sandbox. | No debe almacenarse en frontend en esta arquitectura; la URL se genera server-side. |
| `WOMPI_INTEGRITY_SECRET_SANDBOX` | `wompi-create-checkout` | Si | Secreto para calcular firma de integridad server-side. | Sandbox | Manual, desde Wompi Sandbox. | Checkout sin firma valida o fallo de funcion. | Nunca debe estar disponible en frontend. |
| `WOMPI_CHECKOUT_BASE_URL_SANDBOX` | `wompi-create-checkout` | No | Override de URL base del checkout alojado. Default: `https://checkout.wompi.co/p/`. | Sandbox | Manual opcional. | Si se configura mal, redirige a checkout incorrecto. Si falta, usa default. | No debe estar disponible en frontend. |
| `WOMPI_REDIRECT_URL_SANDBOX` | `wompi-create-checkout` | No | URL de retorno post-checkout. | Sandbox | Manual opcional. | Si falta, Wompi no recibe redirect-url explicita; no bloquea creacion de orden. | No debe estar disponible en frontend. |
| `WOMPI_EVENTS_SECRET_SANDBOX` | `wompi-webhook` | Si | Secreto para verificar firma de eventos webhook. | Sandbox | Manual, desde Wompi Sandbox. | El webhook no puede validar eventos y falla. | Nunca debe estar disponible en frontend. |

Variables comprobadas especialmente:

- URL de Supabase: `SUPABASE_URL` existe.
- Anon key: no aparece en funciones Wompi.
- Service role key: `SUPABASE_SECRET_KEYS` o `SUPABASE_SERVICE_ROLE_KEY`.
- Llave publica Wompi sandbox: `WOMPI_PUBLIC_KEY_SANDBOX`.
- Llave privada Wompi sandbox: no aparece; no es necesaria porque esta fase no consulta API Wompi server-to-server.
- Secreto de integridad: `WOMPI_INTEGRITY_SECRET_SANDBOX`.
- Secreto de eventos: `WOMPI_EVENTS_SECRET_SANDBOX`.
- Ambiente: no hay env var; se usa constante `WOMPI_SANDBOX_ENVIRONMENT = "sandbox"`.
- URL publica frontend: no aparece como variable generica; se usa `WOMPI_REDIRECT_URL_SANDBOX` opcional para retorno.
- URL de checkout: `WOMPI_CHECKOUT_BASE_URL_SANDBOX` opcional con default.
- URL de redireccion: `WOMPI_REDIRECT_URL_SANDBOX` opcional.
- CORS: no hay variable; `Access-Control-Allow-Origin` esta hardcodeado como `*` en checkout/status.

Hallazgos de variables:

- No hay inconsistencia de nombres entre funciones para Supabase service role.
- No hay variable de ambiente Wompi configurable; el entorno esta hardcodeado a sandbox, lo cual es intencional para esta fase.
- `WOMPI_PRIVATE_KEY_SANDBOX` no existe y no es bloqueante porque no hay llamadas directas a API Wompi.

## 8. Separacion sandbox/produccion

| Control | Estado | Evidencia |
| --- | --- | --- |
| Producto creado en ambiente `sandbox` | OK | `202607150001_wompi_premium_payments.sql` inserta `payment_products.environment = 'sandbox'`. |
| Ordenes identificadas por ambiente | OK | `payment_orders.environment` existe y checkout inserta `WOMPI_SANDBOX_ENVIRONMENT`. |
| Eventos identificados por ambiente | OK | `payment_webhook_events.environment` existe y webhook inserta `WOMPI_SANDBOX_ENVIRONMENT`. |
| Referencias distinguibles como sandbox | OK | `buildPaymentReference()` genera prefijo `predigol-sandbox-...`; test lo valida. |
| Activacion premium bloqueada para ambientes distintos a sandbox | OK | RPC `predigol_apply_paid_premium_order` rechaza `v_order.environment <> 'sandbox'`. |
| URL de checkout correspondiente al entorno esperado | RIESGO | Default `https://checkout.wompi.co/p/` y public key sandbox. No hay endpoint de produccion hardcodeado, pero un override mal configurado podria apuntar a URL incorrecta. |
| Ausencia de llaves o endpoints de produccion | OK | No se detectaron secrets reales ni variables `*_PRODUCTION`; constraints aceptan `production` para futuro pero flujo usa constante sandbox. |
| Ausencia de fallback automatico sandbox hacia produccion | OK | No existe fallback a produccion; ambiente hardcodeado a sandbox. |
| Monto obtenido desde base de datos | OK | Checkout consulta `payment_products.amount_in_cents`; no confia monto del body. |
| Moneda validada server-side | OK | Checkout usa `payment_products.currency`; DB check valida ISO uppercase. Webhook compara moneda contra orden. |
| Firma de integridad calculada server-side | OK | `generateIntegritySignature()` usa reference, amount, currency y `WOMPI_INTEGRITY_SECRET_SANDBOX`. |
| Firma de webhook verificada server-side | OK | `verifyWompiEventSignature()` se ejecuta antes de procesar aprobacion; firma invalida marca evento failed. |
| Idempotencia para evitar activacion duplicada | OK | Unique indexes en webhook/transaction/subscription_events y RPC retorna idempotent si ya existe evento de activacion/extension. |
| Checkout real no llamado en preflight | OK | Esta fase no ejecuto Wompi ni pagos. |

## 9. Autenticacion y autorizacion

### `wompi-create-checkout`

- Requiere metodo `POST`.
- Lee `Authorization` del request.
- Usa cliente con service role mas header de usuario para `auth.getUser()`.
- Rechaza si no hay usuario autenticado.
- No acepta `user_id` desde el cliente.
- Acepta solo `plan_id`, default `predigol-premium-30d`, y rechaza otros valores.
- Obtiene producto, precio, moneda, duracion y ambiente desde `payment_products` usando service role.
- Crea orden con `user_id = userData.user.id`.
- Calcula firma de integridad server-side.
- Devuelve checkout_url, amount, currency y environment; no devuelve service role ni secretos.

### `wompi-payment-status`

- Requiere metodo `GET`.
- Requiere usuario autenticado por JWT.
- Permite consultar por `order_id` o `reference`.
- Filtra `payment_orders` con `.eq("user_id", userData.user.id)`.
- No consulta API Wompi.
- No devuelve transacciones de otros usuarios; devuelve solo la orden propia filtrada.

### `wompi-webhook`

- Requiere metodo `POST`.
- No depende de sesion de usuario.
- Usa service role server-side.
- Registra evento con hash e id de proveedor antes de procesar.
- Verifica firma con `WOMPI_EVENTS_SECRET_SANDBOX`.
- Rechaza firma invalida antes de buscar orden o activar premium.
- Busca orden por provider, environment sandbox y reference.
- Compara reference, amount, currency y environment contra la orden.
- Registra transaccion por upsert idempotente.
- Actualiza orden y llama RPC server-side solo si estado interno es `approved`.
- La RPC evita doble activacion mediante evento de suscripcion unico por orden.
- No acepta aprobacion basada solo en frontend.

## 10. Pruebas locales

Supabase local:

- `npx --yes supabase@2.109.1 db reset --local --no-seed`: PASS.
- Evidencia: migraciones aplicadas hasta `202607160002_profiles_personal_update.sql`; reset finalizado en branch `main`.
- `npx --yes supabase@2.109.1 test db`: PASS.
- Resultado: `Files=3, Tests=74, Result: PASS`.

Deno:

- `deno --version`: `deno 2.9.2`.
- `deno fmt --check ...`: PASS, `Checked 5 files`.
- `deno lint ...`: PASS, `Checked 5 files`.
- `deno check supabase/functions/_shared/wompi.ts`: PASS.
- `deno check supabase/functions/wompi-create-checkout/index.ts`: PASS.
- `deno check supabase/functions/wompi-payment-status/index.ts`: PASS.
- `deno check supabase/functions/wompi-webhook/index.ts`: PASS.
- `deno test supabase/functions/_shared/wompi_test.ts`: PASS, `6 passed | 0 failed`.

## 11. Bloqueantes y riesgos

Bloqueantes:

- Ningun bloqueante tecnico local detectado para preparar aplicacion en Supabase Sandbox.

Riesgos:

- `WOMPI_CHECKOUT_BASE_URL_SANDBOX` es opcional y permite override; si se configura mal, puede apuntar a URL incorrecta. Recomendacion: dejar default o validar manualmente antes del smoke.
- CORS en `wompi-create-checkout` y `wompi-payment-status` usa `Access-Control-Allow-Origin: *`. No expone secretos por si solo, pero debe revisarse antes de produccion.
- `WOMPI_REDIRECT_URL_SANDBOX` es opcional; si no se configura, el retorno post-checkout puede no ser el esperado.
- No se ejecuto smoke real contra Wompi Sandbox en esta fase por restriccion explicita.
- Las constraints DB admiten `production` para futuro, aunque el flujo actual usa sandbox hardcodeado y la activacion bloquea no-sandbox.

## 12. Orden futuro recomendado para sandbox

1. Identificar el proyecto Supabase sandbox correcto.
2. Comparar historial local y remoto.
3. Configurar secretos sandbox.
4. Aplicar migraciones pendientes.
5. Desplegar Edge Functions.
6. Obtener URL publica del webhook.
7. Configurar URL de eventos en Wompi sandbox.
8. Ejecutar smoke test controlado.
9. Verificar orden, transaccion, webhook y activacion premium.
10. Confirmar idempotencia con evento duplicado.

## 13. Comandos remotos propuestos - NO EJECUTADOS

Los comandos siguientes son propuesta futura. No fueron ejecutados en esta fase.

```powershell
# NO EJECUTADO
npx --yes supabase@2.109.1 link --project-ref <SUPABASE_SANDBOX_PROJECT_REF>

# NO EJECUTADO
npx --yes supabase@2.109.1 migration list

# NO EJECUTADO
npx --yes supabase@2.109.1 secrets set `
  WOMPI_PUBLIC_KEY_SANDBOX=<redacted> `
  WOMPI_INTEGRITY_SECRET_SANDBOX=<redacted> `
  WOMPI_EVENTS_SECRET_SANDBOX=<redacted> `
  WOMPI_REDIRECT_URL_SANDBOX=<redacted>

# NO EJECUTADO
npx --yes supabase@2.109.1 db push

# NO EJECUTADO
npx --yes supabase@2.109.1 functions deploy wompi-create-checkout
npx --yes supabase@2.109.1 functions deploy wompi-payment-status
npx --yes supabase@2.109.1 functions deploy wompi-webhook
```

No incluir valores reales de secretos en terminal compartida, documentacion, commits ni issues.

## 14. Plan de rollback

Rollback recomendado si algo falla en sandbox:

1. Detener smoke tests y no configurar produccion.
2. Deshabilitar o quitar URL de webhook en Wompi Sandbox.
3. Rotar secretos sandbox si hubo exposicion operacional.
4. Desplegar version anterior de Edge Functions o remover funciones recien desplegadas si aplica.
5. Si las migraciones ya se aplicaron y deben revertirse, preparar rollback manual revisado contra sandbox, con backup previo. No usar scripts `_down.sql` automaticamente.
6. Revocar grants o desactivar producto Wompi sandbox con migracion correctiva si fuera necesario.
7. Verificar que `user_subscriptions`, `payment_orders`, `payment_transactions`, `payment_webhook_events` y `subscription_events` queden consistentes.
8. Documentar incidente y evidencia antes de reintentar.

## 15. Evidencia de no acceso remoto

Durante esta fase solo se ejecutaron comandos locales y de Git de lectura/validacion.

No se ejecuto:

- `supabase link`.
- `supabase db push`.
- `supabase db pull`.
- `supabase migration repair`.
- `supabase functions deploy`.
- `supabase secrets set`.
- `supabase db reset --linked`.
- llamadas Wompi.
- configuracion Wompi remota.
- pagos.

## 16. Estado final Git

Estado esperado al cierre:

- Solo archivo nuevo de documentacion: `docs/fase10c-preflight-wompi-sandbox.md`.
- Sin cambios staged.
- Sin commit.
- Sin push.

## 17. Recomendacion

Recomendacion: `LISTO PARA APLICAR EN SANDBOX`.

Condiciones antes de ejecutar el despliegue real:

- Confirmar project ref sandbox correcto.
- Configurar solo credenciales sandbox.
- Validar manualmente redirect URL sandbox.
- No usar secretos de produccion.
- Ejecutar smoke controlado despues del despliegue.
