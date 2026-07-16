# Fase 10C.3 - Aplicacion controlada de migraciones en Supabase Sandbox

## 1. Fecha

- Fecha de ejecucion: 2026-07-16
- Hora de inicio: 2026-07-16 20:14:48 UTC

## 2. Alcance

Aplicar exclusivamente las 30 migraciones SQL locales al proyecto Supabase Sandbox enlazado y validar historial remoto, dry-run posterior, lint remoto, pruebas pgTAP remotas, secretos y Edge Functions sin configurar ni desplegar integraciones Wompi.

## 3. Estado Git inicial

- Rama: `main`
- Sincronizacion: rama actualizada con `origin/main`
- Worktree: limpio
- Staged: sin archivos staged
- `git diff --check`: sin salida
- Diagnostico 10C.2 versionado en commit `0636016 docs(supabase): add sandbox remote diagnosis`

## 4. Project-ref enmascarado

- Project-ref: `slup...cpda`
- `supabase/.temp/project-ref`: existe
- Enlace local comparado internamente contra `SUPABASE_SANDBOX_PROJECT_REF`: coincide

## 5. Version Supabase CLI

- Comando: `npx --yes supabase@2.109.1 --version`
- Resultado: `2.109.1`

## 6. Resultado del migration list previo

- Comando: `npx --yes supabase@2.109.1 migration list --linked`
- Resultado: remoto sin migraciones aplicadas
- Migraciones locales pendientes: 30
- Migraciones solo remotas: 0
- Timestamps desalineados: 0
- Estado: coincide con Fase 10C.2

## 7. Resultado del dry-run previo

- Comando: `npx --yes supabase@2.109.1 db push --linked --dry-run`
- Resultado: propone exactamente 30 migraciones
- Primera migracion propuesta: `202606230001_predigol_base_schema.sql`
- Ultima migracion propuesta: `202607160002_profiles_personal_update.sql`
- Seed: no propuesto
- Roles: no propuesto
- `--include-all`: no requerido y no utilizado
- Advertencias nuevas: ninguna observada
- Confirmacion de proyecto Sandbox vacio: remoto sin migraciones aplicadas

## 8. Lista ordenada de las 30 migraciones

1. `202606230001_predigol_base_schema.sql`
2. `202606240001_api_football_predictions.sql`
3. `202606240002_fix_partidos_api_upsert_constraint.sql`
4. `202606240003_hybrid_free_manual_flow.sql`
5. `202606240004_fix_manual_partido_ids.sql`
6. `202606240005_admin_manual_match_panel.sql`
7. `202606240006_roles_and_relevant_matches.sql`
8. `202606250001_google_sheet_imports.sql`
9. `202606250002_google_sheet_auto_sync.sql`
10. `202606250003_admin_match_editing.sql`
11. `202606250004_predictions_scoring_ranking.sql`
12. `202606250005_api_football_paid_cron.sql`
13. `202607010001_api_football_sync_monitoring.sql`
14. `202607010002_model_evaluations.sql`
15. `202607010003_app_error_monitoring.sql`
16. `202607030001_favorites_notification_preferences.sql`
17. `202607030002_segmented_rankings.sql`
18. `202607030003_web_push_subscriptions.sql`
19. `202607030004_web_push_dispatch.sql`
20. `202607060001_model_v2_metadata.sql`
21. `202607060002_model_runs_datasets_team_aliases.sql`
22. `202607060003_model_dataset_checksum_unique.sql`
23. `202607060004_lock_model_admin_writes.sql`
24. `202607060005_partidos_import_fallback_identity.sql`
25. `202607070001_api_import_model_runs.sql`
26. `202607100001_freemium_premium_access.sql`
27. `202607100002_refresh_mvp_grants.sql`
28. `202607150001_wompi_premium_payments.sql`
29. `202607160001_harden_runtime_grants.sql`
30. `202607160002_profiles_personal_update.sql`

## 9. Comando real ejecutado

- Comando ejecutado una unica vez: `npx --yes supabase@2.109.1 db push --linked`
- Flags no utilizados: `--include-all`, `--include-seed`, `--include-roles`, `--dry-run`

## 10. Resultado del db push

- Codigo de salida: 0
- Mensaje final de CLI: `Finished supabase db push.`
- Migraciones indicadas como aplicadas: 30
- Primer error: ninguno observado
- Ultima migracion confirmada: `202607160002_profiles_personal_update.sql`
- Advertencias observadas: fallo al cachear catalogo de migraciones por Docker Desktop no disponible (`dockerDesktopLinuxEngine`). La advertencia aparecio despues de aplicar la ultima migracion y no detuvo el push.

## 11. Migraciones aplicadas

Todas las migraciones fueron aplicadas en el siguiente orden:

1. `202606230001_predigol_base_schema.sql`
2. `202606240001_api_football_predictions.sql`
3. `202606240002_fix_partidos_api_upsert_constraint.sql`
4. `202606240003_hybrid_free_manual_flow.sql`
5. `202606240004_fix_manual_partido_ids.sql`
6. `202606240005_admin_manual_match_panel.sql`
7. `202606240006_roles_and_relevant_matches.sql`
8. `202606250001_google_sheet_imports.sql`
9. `202606250002_google_sheet_auto_sync.sql`
10. `202606250003_admin_match_editing.sql`
11. `202606250004_predictions_scoring_ranking.sql`
12. `202606250005_api_football_paid_cron.sql`
13. `202607010001_api_football_sync_monitoring.sql`
14. `202607010002_model_evaluations.sql`
15. `202607010003_app_error_monitoring.sql`
16. `202607030001_favorites_notification_preferences.sql`
17. `202607030002_segmented_rankings.sql`
18. `202607030003_web_push_subscriptions.sql`
19. `202607030004_web_push_dispatch.sql`
20. `202607060001_model_v2_metadata.sql`
21. `202607060002_model_runs_datasets_team_aliases.sql`
22. `202607060003_model_dataset_checksum_unique.sql`
23. `202607060004_lock_model_admin_writes.sql`
24. `202607060005_partidos_import_fallback_identity.sql`
25. `202607070001_api_import_model_runs.sql`
26. `202607100001_freemium_premium_access.sql`
27. `202607100002_refresh_mvp_grants.sql`
28. `202607150001_wompi_premium_payments.sql`
29. `202607160001_harden_runtime_grants.sql`
30. `202607160002_profiles_personal_update.sql`

## 12. Resultado del historial posterior

- Comando: `npx --yes supabase@2.109.1 migration list --linked`
- Resultado: 30 migraciones locales y 30 migraciones remotas
- Timestamps: todos coinciden
- Migraciones solo locales: 0
- Migraciones solo remotas: 0
- Migraciones desalineadas: 0
- Clasificacion: `APLICADA EN AMBOS` para las 30 migraciones
- `migration repair`: no ejecutado

## 13. Resultado del dry-run posterior

- Comando: `npx --yes supabase@2.109.1 db push --linked --dry-run`
- Resultado: `Remote database is up to date.`
- Migraciones pendientes: 0
- Segundo push real: no ejecutado

## 14. Resultado del lint remoto

- Comando: `npx --yes supabase@2.109.1 db lint --linked --level error --fail-on error`
- Codigo de salida: 0
- Esquemas linted: `extensions`, `public`
- Errores encontrados: ninguno
- Funcion, tabla o esquema afectado: ninguno
- Resultado final: `No schema errors found`

## 15. Resultado pgTAP remoto

- Comando: `npx --yes supabase@2.109.1 test db --linked`
- Resultado esperado no alcanzado: `Files=3`, `Tests=74`, `Result: PASS`
- Resultado observado: no ejecutado correctamente por limitacion de entorno local; la CLI no pudo conectar con Docker Desktop para usar `pg_prove`.
- Error principal: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`
- Imagen requerida: `public.ecr.aws/supabase/pg_prove:3.36` o alternativas equivalentes
- Archivos pgTAP: no llegaron a ejecutarse, por lo que no hay numero de prueba ni asercion SQL fallida.
- Validacion local comparativa: no ejecutada por la misma limitacion de Docker.
- Clasificacion: `BLOQUEADO - PRUEBAS REMOTAS NO APROBADAS`

## 16. Confirmacion de rollback de datos ficticios

- Evidencia usada: archivos pgTAP versionados, sin consultas SQL manuales de borrado.
- `supabase/tests/202607160001_auth_profiles_rls.test.sql`: contiene `begin;`, `select * from finish();` y `rollback;`.
- `supabase/tests/202607160002_pronosticos_ligas_rls.test.sql`: contiene `begin;`, `select * from finish();` y `rollback;`.
- `supabase/tests/202607160003_payments_subscriptions_rls.test.sql`: contiene `begin;`, `select * from finish();` y `rollback;`.
- Conclusión: los tests estan disenados para revertir sus usuarios y datos ficticios. En esta fase no se insertaron datos manualmente para completar pruebas.

## 17. Variables automaticas de Supabase

- Comando: `npx --yes supabase@2.109.1 secrets list --project-ref $SUPABASE_SANDBOX_PROJECT_REF`
- Resultado: lista vacia de secretos personalizados.
- Variables automaticas que no deben configurarse manualmente: `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`.
- Su ausencia en `secrets list` no se clasifica como error.

## 18. Secretos Wompi pendientes

- `WOMPI_PUBLIC_KEY_SANDBOX`: `PENDIENTE PARA FASE 10C.4`
- `WOMPI_INTEGRITY_SECRET_SANDBOX`: `PENDIENTE PARA FASE 10C.4`
- `WOMPI_CHECKOUT_BASE_URL_SANDBOX`: `PENDIENTE PARA FASE 10C.4`
- `WOMPI_REDIRECT_URL_SANDBOX`: `PENDIENTE PARA FASE 10C.4`
- `WOMPI_EVENTS_SECRET_SANDBOX`: `PENDIENTE PARA FASE 10C.4`
- `supabase secrets set`: no ejecutado
- `supabase secrets unset`: no ejecutado

## 19. Edge Functions pendientes

- Comando: `npx --yes supabase@2.109.1 functions list --project-ref $SUPABASE_SANDBOX_PROJECT_REF`
- Resultado: lista remota vacia
- `wompi-create-checkout`: `NO DESPLEGADA`
- `wompi-payment-status`: `NO DESPLEGADA`
- `wompi-webhook`: `NO DESPLEGADA`
- `supabase functions deploy`: no ejecutado
- `supabase functions delete`: no ejecutado

## 20. Riesgos

- Las migraciones ya quedaron aplicadas remotamente en Sandbox.
- Las pruebas pgTAP remotas no quedaron aprobadas por limitacion del entorno local: Docker Desktop no esta disponible para `pg_prove`.
- La advertencia de cache de catalogo durante el push tambien apunta a Docker no disponible, pero ocurrio despues de aplicar todas las migraciones y el historial posterior quedo alineado.
- No se validaron llamadas Wompi, pagos, webhook ni Edge Functions en esta fase.

## 21. Bloqueantes

- Bloqueante actual: pruebas pgTAP remotas no aprobadas porque la CLI no pudo ejecutar `pg_prove` sin Docker Desktop.
- No hay bloqueante de historial de migraciones: local y remoto estan alineados.
- No hay bloqueante de lint remoto: no se encontraron errores de esquema.

## 22. Operaciones remotas ejecutadas

- `migration list --linked` previo
- `db push --linked --dry-run` previo
- `db push --linked` real, una unica vez
- `migration list --linked` posterior
- `db push --linked --dry-run` posterior
- `db lint --linked --level error --fail-on error`
- `test db --linked`, fallido por limitacion de Docker local antes de ejecutar pruebas
- `secrets list --project-ref ...`
- `functions list --project-ref ...`

## 23. Operaciones remotas no ejecutadas

- `supabase db reset --linked`
- `supabase migration repair`
- `supabase db pull`
- `supabase migration up --linked`
- `supabase db push --include-all`
- `supabase db push --include-seed`
- `supabase db push --include-roles`
- Segundo `db push` real
- SQL manual remoto
- Cambios mediante Dashboard
- `supabase secrets set`
- `supabase secrets unset`
- `supabase functions deploy`
- `supabase functions delete`
- Configuracion del webhook Wompi
- Llamadas a Wompi
- Checkout Wompi
- Pagos de prueba o produccion
- Uso de llaves de produccion
- Commit automatico
- Push automatico

## 24. Estado Git final

- Verificado antes de entrega: solo `docs/fase10c3-aplicacion-migraciones-sandbox.md` aparece como archivo nuevo `untracked`.
- `git diff --name-status`: sin salida porque el archivo nuevo no esta staged.
- `git diff --check`: sin salida.
- `git diff --cached --name-status`: sin salida.
- `supabase/.temp/project-ref`: permanece ignorado y no se versiona.
- `git add`: no ejecutado
- Commit: no ejecutado
- Push: no ejecutado

## 25. Recomendacion

`BLOQUEADO — PRUEBAS REMOTAS NO APROBADAS`

## Reintento pgTAP con Docker Desktop disponible

### 1. Confirmacion de Docker

- `docker version`: cliente responde y servidor responde.
- Cliente Docker: `29.6.1`.
- Servidor Docker: Docker Desktop `4.82.0`, Engine `29.6.1`.
- Sistema operativo del servidor: `Docker Desktop`, `OSType: linux`.
- `docker info`: servidor responde correctamente.
- `docker ps`: codigo de salida 0; contenedores locales Supabase visibles.

### 2. Estado del historial remoto antes de probar

- Comando: `npx --yes supabase@2.109.1 migration list --linked`.
- Resultado: 30 migraciones locales y 30 migraciones remotas.
- Migraciones pendientes: 0.
- Migraciones solo remotas: 0.
- Migraciones desalineadas: 0.
- `db push`: no ejecutado.
- `db push --dry-run`: no ejecutado en este reintento.

### 3. Comando ejecutado

- Comando ejecutado una sola vez: `npx --yes supabase@2.109.1 test db --linked`.
- Supabase CLI: `2.109.1`.

### 4. Resultado por archivo

- `202607160001_auth_profiles_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `function plan(integer) does not exist` en `select plan(20);`.
- `202607160002_pronosticos_ligas_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `function plan(integer) does not exist` en `select plan(22);`.
- `202607160003_payments_subscriptions_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `function plan(integer) does not exist` en `select plan(32);`.
- Mensaje comun: `No subtests run` y `Parse errors: No plan found in TAP output`.

### 5. Total de pruebas

- Total de archivos: 3.
- Total de pruebas ejecutadas por `pg_prove`: 0.
- Total esperado: 74.
- Aprobadas: 0.
- Fallidas funcionales reportadas por TAP: 0.
- Archivos con error SQL previo al plan TAP: 3.

### 6. Resultado final

- Salida final: `Files=3, Tests=0` y `Result: FAIL`.
- Codigo de salida observado: no cero; la CLI reporto `error running container: exit 1`.
- Clasificacion: `BLOQUEADO — PRUEBAS REMOTAS NO APROBADAS`.
- Este reintento no corresponde a Docker no disponible: Docker respondio antes de ejecutar la prueba y `pg_prove` inicio.

### 7. Confirmacion de rollback

- Evidencia usada: archivos pgTAP versionados.
- `202607160001_auth_profiles_rls.test.sql`: contiene `begin;`, `select * from finish();` y `rollback;`.
- `202607160002_pronosticos_ligas_rls.test.sql`: contiene `begin;`, `select * from finish();` y `rollback;`.
- `202607160003_payments_subscriptions_rls.test.sql`: contiene `begin;`, `select * from finish();` y `rollback;`.
- Los datos ficticios estan disenados para revertirse al finalizar cada prueba.
- No se ejecutaron consultas manuales de limpieza.

### 8. Riesgos

- El historial remoto permanece alineado, pero las pruebas remotas no validaron las 74 aserciones esperadas.
- El error `function plan(integer) does not exist` indica que `pgtap` fue detectado como extension existente, pero sus funciones no quedaron disponibles para las llamadas no calificadas de los tests remotos.
- No se modificaron tests, migraciones ni esquema remoto para forzar el resultado.

### 9. Bloqueantes

- Bloqueante actual: los tres archivos pgTAP fallan antes de ejecutar subtests por `function plan(integer) does not exist`.
- No hay bloqueo de Docker en este reintento.
- No hay bloqueo de historial de migraciones.

### 10. Recomendacion actualizada

`BLOQUEADO — PRUEBAS REMOTAS NO APROBADAS`

### 11. Operaciones ejecutadas

- `git branch --show-current`.
- `git status`.
- `git diff --check`.
- `git diff --cached --name-status`.
- Comparacion interna entre `SUPABASE_SANDBOX_PROJECT_REF` y `supabase/.temp/project-ref`.
- `docker version`.
- `docker info`.
- `docker ps`.
- `npx --yes supabase@2.109.1 migration list --linked`.
- `npx --yes supabase@2.109.1 test db --linked`.

### 12. Operaciones no ejecutadas

- `supabase db push --linked`.
- `supabase db reset --linked`.
- `supabase migration repair`.
- `supabase db pull`.
- `supabase migration up --linked`.
- SQL manual remoto.
- `supabase secrets set`.
- `supabase secrets unset`.
- `supabase functions deploy`.
- `supabase functions delete`.
- Configuracion del webhook Wompi.
- Llamadas Wompi.
- Checkout.
- Pagos.
- Cambios mediante Dashboard.
- `git add`.
- Commit.
- Push.

## Correccion portable del search_path pgTAP

### 1. Error original

- Error observado en 10C.3B: `function plan(integer) does not exist`.
- Los tres archivos pgTAP conectaron al Sandbox y `pg_prove` inicio, pero no ejecutaron aserciones.
- Resultado observado antes de la correccion: `Files=3`, `Tests=0`, `Result: FAIL`.
- Clasificacion del error: bootstrap/resolucion de pgTAP, no fallo funcional de las 74 aserciones.

### 2. Esquema real de pgTAP encontrado

- Auditoria ejecutada: `git grep -n -i "create extension.*pgtap" -- supabase`.
- Auditoria ejecutada: `git grep -n -i "pgtap" -- supabase/migrations supabase/tests`.
- Archivo `supabase/tests/202607160001_auth_profiles_rls.test.sql`, linea 3 antes de la correccion: `create extension if not exists pgtap with schema extensions;`.
- Archivo `supabase/tests/202607160002_pronosticos_ligas_rls.test.sql`, linea 3 antes de la correccion: `create extension if not exists pgtap with schema extensions;`.
- Archivo `supabase/tests/202607160003_payments_subscriptions_rls.test.sql`, linea 3 antes de la correccion: `create extension if not exists pgtap with schema extensions;`.
- Clasificacion: `PGTAP_EN_EXTENSIONS`.
- No se encontro una migracion local que instale `pgtap`; la instalacion se declara en los tests.

### 3. Causa tecnica

- Los tests llamaban `plan(...)`, `ok(...)`, `is(...)`, `results_eq(...)` y `finish()` sin calificacion de esquema.
- Los tests no tenian una instruccion explicita para agregar `extensions` al `search_path` transaccional.
- En el entorno remoto, `plan(integer)` no fue resoluble por nombre no calificado aunque la extension existia.

### 4. Correccion agregada

Se agrego inmediatamente despues de `begin;` en cada archivo:

```sql
set local search_path = pg_catalog, public, extensions;
```

- Archivos modificados:
- `supabase/tests/202607160001_auth_profiles_rls.test.sql`.
- `supabase/tests/202607160002_pronosticos_ligas_rls.test.sql`.
- `supabase/tests/202607160003_payments_subscriptions_rls.test.sql`.
- La correccion queda limitada a la transaccion de cada test por usar `set local`.
- No se agregaron `alter database`, `alter role` ni cambios persistentes de `search_path`.

### 5. Diff resumido

- Solo se agrego una linea `set local search_path = pg_catalog, public, extensions;` en cada archivo.
- No se modificaron `plan(20)`, `plan(22)` ni `plan(32)`.
- No se modifico el numero, intencion ni logica funcional de las 74 aserciones.
- No se eliminaron ni reordenaron pruebas.
- `git diff --check`: sin errores de whitespace; solo advertencias de conversion LF/CRLF en Windows.

### 6. Resultado local

- Comando: `npx --yes supabase@2.109.1 db reset --local --no-seed`.
- Resultado: finalizo correctamente con `Finished supabase db reset on branch main.`.
- Comando: `npx --yes supabase@2.109.1 test db`.
- `202607160001_auth_profiles_rls.test.sql`: `ok`.
- `202607160002_pronosticos_ligas_rls.test.sql`: `ok`.
- `202607160003_payments_subscriptions_rls.test.sql`: `ok`.
- Total local: `Files=3`, `Tests=74`, `Result: PASS`.
- Aprobadas localmente: 74.
- Fallidas localmente: 0.
- Codigo de salida local: 0.

### 7. Historial remoto antes de probar

- Comando: `npx --yes supabase@2.109.1 migration list --linked`.
- Resultado: 30 migraciones locales y 30 migraciones remotas.
- Migraciones pendientes: 0.
- Migraciones solo remotas: 0.
- Migraciones desalineadas: 0.
- `db push`: no ejecutado.

### 8. Resultado remoto

- Comando ejecutado una sola vez: `npx --yes supabase@2.109.1 test db --linked`.
- `202607160001_auth_profiles_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `function plan(integer) does not exist` en `select plan(20);`.
- `202607160002_pronosticos_ligas_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `function plan(integer) does not exist` en `select plan(22);`.
- `202607160003_payments_subscriptions_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `function plan(integer) does not exist` en `select plan(32);`.
- Total remoto: `Files=3`, `Tests=0`, `Result: FAIL`.
- Aprobadas remotamente: 0.
- Fallidas funcionales reportadas por TAP: 0.
- Codigo de salida remoto: no cero; la CLI reporto `error running container: exit 1`.
- La funcion no encontrada pertenece a pgTAP y el `search_path` aplicado contiene `extensions`, segun el cambio local confirmado en los tres archivos.

### 9. Confirmacion de rollback

- Los tres archivos mantienen `begin;` al inicio.
- Los tres archivos mantienen `select * from finish();` antes del cierre.
- Los tres archivos mantienen `rollback;` al final.
- `set local search_path` queda dentro de la transaccion y desaparece con `rollback`.
- Los usuarios y datos ficticios no estan disenados para persistir.
- No se ejecutaron limpiezas manuales.
- No se hicieron cambios permanentes al `search_path` remoto.

### 10. Confirmacion de esquema remoto

- No se modifico el esquema remoto.
- No se creo migracion nueva.
- No se movio ni reinstalo la extension `pgtap`.
- No se modificaron politicas RLS, grants, tablas, funciones de negocio ni RPC.

### 11. Riesgos

- La correccion portable valida localmente las 74 aserciones, pero el Sandbox sigue sin resolver `plan(integer)` durante el bootstrap remoto.
- Puede existir una diferencia remota no resuelta entre la ubicacion efectiva de las funciones de pgTAP, privilegios de resolucion o el `search_path` aplicado por el runner remoto.
- Las 74 aserciones funcionales remotas aun no fueron ejecutadas.

### 12. Bloqueantes

- Bloqueante actual: bootstrap pgTAP remoto aun incompleto.
- El Sandbox no cambio en historial de migraciones.
- Las pruebas locales no bloquean: `Files=3`, `Tests=74`, `Result: PASS`.

### 13. Recomendacion actualizada

`BLOQUEADO — BOOTSTRAP PGTAP REMOTO AÚN INCOMPLETO`

## Habilitacion persistente e invocacion explicita de pgTAP

### 1. Resultado remoto anterior

- Resultado remoto anterior: `Files=3`, `Tests=0`, `Result: FAIL`.
- Error anterior: `function plan(integer) does not exist`.
- Los tres archivos fallaban antes de ejecutar aserciones.

### 2. Confirmacion de search_path insuficiente

- Los tres tests ya contenian `set local search_path = pg_catalog, public, extensions;`.
- La configuracion transaccional de `search_path` fue suficiente localmente, pero no resolvio `plan(integer)` en Sandbox.
- Se mantuvo `set local search_path` para resolver objetos de `public` y limitar el cambio a la transaccion del test.

### 3. Habilitacion manual de pgTAP en Sandbox

- Confirmacion del operador: `pgtap` fue habilitado manualmente en el proyecto PrediGol Sandbox.
- Esquema seleccionado por el operador: `extensions`.
- No se habilito en produccion.
- No se hicieron cambios manuales adicionales desde OpenCode.

### 4. Inventario de funciones pgTAP

- Busqueda ejecutada: `git grep -n -E "(plan|ok|is|isnt|results_eq|throws_ok|lives_ok|has_table|has_column|has_function|finish)\\s*\\(" -- supabase/tests`.
- Funciones pgTAP reales encontradas: `plan`, `ok`, `is`, `results_eq`, `finish`.
- Funciones pgTAP no encontradas en estos tests: `isnt`, `throws_ok`, `lives_ok`, `has_table`, `has_column`, `has_function`.
- Funciones PrediGol observadas y no modificadas: llamadas bajo `public.*`, por ejemplo `public.predigol_es_admin()`, `public.obtener_mis_ligas()`, `public.obtener_detalle_liga(...)`, `public.obtener_plan_usuario()`, `public.predigol_usuario_tiene_premium(...)`, `public.obtener_prediccion_visible(...)`, `public.reclamar_primer_admin()`.
- Funcion auxiliar temporal no modificada: `pg_temp.try_sql(...)`.

### 5. Modificacion de llamadas

- Se calificaron explicitamente 80 llamadas pgTAP con el esquema `extensions`.
- Ejemplos de cambio: `select plan(...)` a `select extensions.plan(...)`.
- Ejemplos de cambio: `select ok(...)` a `select extensions.ok(...)`.
- Ejemplos de cambio: `select is(...)` a `select extensions.is(...)`.
- Ejemplos de cambio: `select results_eq(...)` a `select extensions.results_eq(...)`.
- Ejemplos de cambio: `select * from finish();` a `select * from extensions.finish();`.
- Archivos modificados:
- `supabase/tests/202607160001_auth_profiles_rls.test.sql`.
- `supabase/tests/202607160002_pronosticos_ligas_rls.test.sql`.
- `supabase/tests/202607160003_payments_subscriptions_rls.test.sql`.

### 6. Confirmacion de las 74 aserciones

- Los planes se mantienen como `extensions.plan(20)`, `extensions.plan(22)` y `extensions.plan(32)`.
- Total esperado: 74 aserciones.
- No se eliminaron aserciones.
- No se cambio el contenido funcional de las aserciones.
- No se cambiaron usuarios, UUID, roles, datos ni expectativas.
- No se modificaron RLS, grants ni RPC.

### 7. Resultado local

- Comando: `npx --yes supabase@2.109.1 db reset --local --no-seed`.
- Resultado: `Finished supabase db reset on branch main.`
- Comando: `npx --yes supabase@2.109.1 test db`.
- `202607160001_auth_profiles_rls.test.sql`: `ok`.
- `202607160002_pronosticos_ligas_rls.test.sql`: `ok`.
- `202607160003_payments_subscriptions_rls.test.sql`: `ok`.
- Total local: `Files=3`, `Tests=74`, `Result: PASS`.
- Aprobadas localmente: 74.
- Fallidas localmente: 0.
- Codigo de salida local: 0.

### 8. Historial remoto antes de probar

- Comando: `npx --yes supabase@2.109.1 migration list --linked`.
- Resultado: 30 migraciones locales y 30 migraciones remotas.
- Migraciones pendientes: 0.
- Migraciones solo remotas: 0.
- Migraciones desalineadas: 0.
- Habilitar `pgtap` desde Extensions no modifico el historial de migraciones.
- `db push`: no ejecutado.

### 9. Resultado remoto

- Comando ejecutado una sola vez: `npx --yes supabase@2.109.1 test db --linked --debug`.
- La salida de depuracion no se documenta con credenciales ni project-ref completo.
- `202607160001_auth_profiles_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `permission denied for schema extensions` en `select extensions.plan(20);`.
- `202607160002_pronosticos_ligas_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `permission denied for schema extensions` en `select extensions.plan(22);`.
- `202607160003_payments_subscriptions_rls.test.sql`: fallo antes de subtests; `Tests: 0`, `Failed: 0`, exit status 3. Error SQL: `permission denied for schema extensions` en `select extensions.plan(32);`.
- Total remoto: `Files=3`, `Tests=0`, `Result: FAIL`.
- Aprobadas remotamente: 0.
- Fallidas funcionales reportadas por TAP: 0.
- Codigo de salida remoto: no cero; la CLI reporto `error running container: exit 1`.
- Clasificacion: `BLOQUEADO — RUNNER REMOTO SIN USAGE SOBRE EXTENSIONS`.

### 10. Confirmacion de rollback

- Los tres archivos mantienen `begin;` al inicio.
- Los tres archivos mantienen `select * from extensions.finish();` antes del cierre.
- Los tres archivos mantienen `rollback;` al final.
- `set local search_path` permanece dentro de la transaccion.
- Los datos ficticios se revierten por diseno.
- No se hizo limpieza manual.
- No se persistieron cambios derivados de los tests.

### 11. Migraciones y esquema funcional

- No se aplicaron migraciones nuevas.
- No se creo migracion para pgTAP.
- No se ejecuto SQL remoto de escritura desde OpenCode.
- No se modifico el esquema funcional de PrediGol.
- No se modificaron RLS, grants, tablas, funciones de negocio ni RPC.
- No se configuraron secretos Wompi.
- No se desplegaron Edge Functions.

### 12. Riesgos

- La calificacion explicita valida localmente, pero el runner remoto no tiene permisos suficientes sobre el esquema `extensions` para ejecutar funciones pgTAP.
- Las 74 aserciones funcionales remotas aun no se ejecutaron.
- La correccion de permisos no fue aplicada porque la fase prohibe cambiar grants automaticamente.

### 13. Bloqueantes

- Bloqueante actual: `permission denied for schema extensions` al invocar `extensions.plan(...)` desde el runner remoto.
- No hay bloqueo local: `Files=3`, `Tests=74`, `Result: PASS`.
- No hay bloqueo de historial remoto: 30 migraciones locales y 30 remotas alineadas.

### 14. Recomendacion

`BLOQUEADO — RUNNER REMOTO SIN USAGE SOBRE EXTENSIONS`

## Validacion pgTAP mediante conexion directa

### 1. Error anterior mediante linked

- Resultado anterior mediante `--linked`: `Files=3`, `Tests=0`, `Result: FAIL`.
- Error anterior: `permission denied for schema extensions` al invocar `extensions.plan(...)`.
- Interpretacion: el bloqueo podia corresponder al rol temporal usado por el flujo de autenticacion de `--linked`.

### 2. Validacion de URI Sandbox

- Variable requerida: `SUPABASE_SANDBOX_DB_URL`.
- Resultado en el proceso visible para OpenCode: variable no configurada.
- La URI no fue impresa ni documentada.
- No fue posible validar internamente project-ref, base `postgres`, SSL, host no-local ni ausencia de placeholder `[YOUR-PASSWORD]`.
- Clasificacion: `BLOQUEADO — CONEXIÓN DIRECTA AL SANDBOX FALLÓ`.

### 3. Comando previsto

No ejecutado por ausencia de `SUPABASE_SANDBOX_DB_URL`:

```text
npx --yes supabase@2.109.1 test db --db-url <SANDBOX_DB_URL_OCULTA>
```

### 4. Resultado por archivo

- `202607160001_auth_profiles_rls.test.sql`: no ejecutado mediante conexion directa.
- `202607160002_pronosticos_ligas_rls.test.sql`: no ejecutado mediante conexion directa.
- `202607160003_payments_subscriptions_rls.test.sql`: no ejecutado mediante conexion directa.

### 5. Total ejecutado

- Archivos ejecutados mediante conexion directa: 0.
- Pruebas ejecutadas mediante conexion directa: 0.
- Aprobadas mediante conexion directa: 0.
- Fallidas mediante conexion directa: 0.
- Codigo de salida de prueba directa: no aplica, porque el comando no se ejecuto.

### 6. Confirmacion de rollback

- Se mantiene la evidencia de los archivos versionados: `begin;`, `set local search_path = pg_catalog, public, extensions;`, `select * from extensions.finish();` y `rollback;`.
- No se ejecuto limpieza manual.
- No se persistieron usuarios ni datos de prueba mediante conexion directa, porque las pruebas no se ejecutaron.

### 7. Grants y migraciones

- No se agregaron grants.
- No se ejecutaron `GRANT` ni `REVOKE` remotos.
- No se aplicaron migraciones nuevas.
- No se ejecuto `db push`.
- No se modifico el esquema remoto.

### 8. Riesgos

- La hipotesis de que `--db-url` evita el rol temporal de `--linked` queda sin validar en esta ejecucion.
- El bloqueo remoto por `permission denied for schema extensions` sigue abierto hasta ejecutar una conexion directa valida.

### 9. Bloqueantes

- Bloqueante actual: `SUPABASE_SANDBOX_DB_URL` no esta disponible en el proceso visible para OpenCode.
- Sin una URI validada no se puede ejecutar `test db --db-url` de forma segura.

### 10. Recomendacion actualizada

`BLOQUEADO — CONEXIÓN DIRECTA AL SANDBOX FALLÓ`
