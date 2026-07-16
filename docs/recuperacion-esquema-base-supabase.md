# Recuperacion del esquema base Supabase PrediGol

## 1. Resumen ejecutivo

Esta auditoria estatica confirma que el repositorio contiene migraciones incrementales, pero no contiene la migracion inicial que crea el contrato base de PrediGol. Las migraciones versionadas desde `202606240001_api_football_predictions.sql` presuponen que ya existen, como minimo, `public.profiles`, `public.partidos`, `public.pronosticos`, `public.ligas` y `public.liga_miembros`.

El frontend, los scripts Python, las Edge Functions, los tests y la documentacion consumen esas tablas como parte del producto actual. Sin una migracion base previa, el historial no es ejecutable desde una base vacia y no puede reconstruirse automaticamente con `db reset` local.

Estado de certeza:

- CONFIRMADO: faltan definiciones base para `profiles`, `partidos`, `pronosticos`, `ligas` y `liga_miembros`.
- CONFIRMADO: multiples migraciones posteriores fallan desde una base vacia porque referencian esas tablas.
- CONFIRMADO: los archivos `_down.sql` con timestamps `202607060001` y `202607060002` son rollbacks y no deben vivir en `supabase/migrations` con timestamps duplicados.
- INFERIDO: la migracion futura debe llamarse `supabase/migrations/202606230001_predigol_base_schema.sql` y ejecutarse antes de las migraciones actuales.
- DESCONOCIDO: tipos exactos originales de algunas columnas base, especialmente `partidos.id` y `ligas.id`, porque el repositorio solo muestra consumidores y migraciones incrementales.

## 2. Causa de la imposibilidad de reconstruccion actual

La causa tecnica es que el primer objeto versionado del historial, `supabase/migrations/202606240001_api_football_predictions.sql`, ya ejecuta `alter table if exists public.partidos` y despues crea un indice sobre `public.partidos(api_football_fixture_id)`. Si `public.partidos` no existe, el `alter table if exists` no agrega columnas, pero el `create unique index ... on public.partidos` falla.

La causa funcional es que el contrato de producto se construyo sobre tablas base no versionadas:

- `profiles`: identidad publica de usuarios, rol admin y datos de perfil.
- `partidos`: calendario, equipos, resultados y campos de integracion API-Football/manual/Google Sheets.
- `pronosticos`: predicciones guardadas por usuario para partidos.
- `ligas`: ligas privadas creadas por usuarios.
- `liga_miembros`: membresia de usuarios en ligas.

Sin esas definiciones no se pueden compilar funciones PL/pgSQL que usan `%rowtype`, joins y triggers sobre dichas tablas.

## 3. Inventario completo de tablas utilizadas

Tablas base faltantes:

- `profiles` CONFIRMADO.
- `partidos` CONFIRMADO.
- `pronosticos` CONFIRMADO.
- `ligas` CONFIRMADO.
- `liga_miembros` CONFIRMADO.

Tablas creadas o modificadas por migraciones posteriores:

- `football_competitions` CONFIRMADO.
- `football_teams` CONFIRMADO.
- `football_fixtures` CONFIRMADO.
- `football_live_snapshots` CONFIRMADO.
- `model_predictions` CONFIRMADO.
- `predigol_google_sheet_sync_config` CONFIRMADO.
- `predigol_api_football_sync_config` CONFIRMADO.
- `api_football_sync_runs` CONFIRMADO.
- `model_evaluations` CONFIRMADO.
- `app_error_logs` CONFIRMADO.
- `user_favorite_teams` CONFIRMADO.
- `user_favorite_competitions` CONFIRMADO.
- `user_notification_preferences` CONFIRMADO.
- `web_push_subscriptions` CONFIRMADO.
- `web_push_deliveries` CONFIRMADO.
- `web_push_dispatch_config` CONFIRMADO.
- `model_prediction_settings` CONFIRMADO.
- `model_datasets` CONFIRMADO.
- `model_runs` CONFIRMADO.
- `team_aliases` CONFIRMADO.
- `subscription_plans` CONFIRMADO.
- `user_subscriptions` CONFIRMADO.
- `payment_products` CONFIRMADO.
- `payment_orders` CONFIRMADO.
- `payment_transactions` CONFIRMADO.
- `payment_webhook_events` CONFIRMADO.
- `subscription_events` CONFIRMADO.

Tablas externas de Supabase Auth:

- `auth.users` CONFIRMADO.

## 4. Contrato detallado por tabla

### `profiles`

Estado: CONFIRMADO como tabla requerida; definicion original DESCONOCIDA.

Columnas leidas:

- `id` CONFIRMADO. Debe coincidir con `auth.users.id` segun `docs/preparacion-cuentas-prueba-fase8i.md`.
- `nombre` CONFIRMADO.
- `username` CONFIRMADO.
- `avatar_url` CONFIRMADO.
- `es_admin` CONFIRMADO, agregado por `202606240005_admin_manual_match_panel.sql` si la tabla existe.
- `rol` CONFIRMADO, agregado por `202606240006_roles_and_relevant_matches.sql` si la tabla existe.

Columnas insertadas/actualizadas:

- `es_admin` CONFIRMADO, actualizado por `reclamar_primer_admin()`.
- `rol` CONFIRMADO, actualizado por `reclamar_primer_admin()` y migracion `202606240006_roles_and_relevant_matches.sql`.
- `nombre`, `username`, `avatar_url` DESCONOCIDO en escritura; el frontend solo lee.

Filtros utilizados:

- `id = usuarioId` CONFIRMADO.
- `id = auth.uid()` CONFIRMADO.
- `es_admin = true` CONFIRMADO.
- `rol = 'admin' or es_admin = true` CONFIRMADO.

Relaciones esperadas:

- `profiles.id` referencia `auth.users(id)` INFERIDO por docs y patron Supabase.
- `pronosticos.usuario_id`, `liga_miembros.usuario_id`, `ligas.creador_id`, `user_subscriptions.user_id` apuntan al mismo UUID INFERIDO/CONFIRMADO por consumidores.

Restricciones e indices esperados:

- Primary key en `id` INFERIDO.
- Constraint `profiles_rol_check` con `rol in ('usuario', 'admin')` CONFIRMADO por migracion `202606240006_roles_and_relevant_matches.sql`.
- Indice por `rol/es_admin` no aparece; podria ser innecesario por consultas puntuales a `auth.uid()` INFERIDO.

Fechas/defaults:

- `es_admin default false` CONFIRMADO por migracion incremental.
- `rol default 'usuario'` CONFIRMADO por migracion incremental.
- `created_at`, `updated_at` DESCONOCIDO.

RLS y roles:

- Usuarios autenticados deben poder leer su propio perfil CONFIRMADO por frontend.
- Admin debe poder leer perfiles para panel premium CONFIRMADO por `adminApi.js`.
- Escritura directa desde frontend no aparece; cambios admin se realizan por RPC INFERIDO.
- `service_role` debe poder leer/escribir para operaciones administrativas INFERIDO.

### `partidos`

Estado: CONFIRMADO como tabla central; definicion original DESCONOCIDA; tipo de `id` CONFLICTIVO.

Columnas leidas:

- `id`, `torneo`, `fecha_texto`, `fecha_orden`, `local_nombre`, `visitante_nombre`, `local_corto`, `visitante_corto`, `estado`, `goles_local_final`, `goles_visitante_final` CONFIRMADO.
- `api_football_fixture_id`, `api_football_league_id`, `temporada`, `ronda`, `minuto`, `origen_datos`, `fuente_detalle`, `es_relevante`, `prioridad_visual` CONFIRMADO.
- `external_source`, `external_id` CONFIRMADO por scripts/modelo.
- `payload_api`, `actualizado_api_en`, `creado_manual_en`, `importado_externo_en`, `raw_import_payload` CONFIRMADO por migraciones.

Columnas insertadas:

- En RPC `crear_partido_manual`: `id`, `torneo`, `fecha_texto`, `fecha_orden`, `local_nombre`, `visitante_nombre`, `local_corto`, `visitante_corto`, `estado`, `goles_local_final`, `goles_visitante_final`, `api_football_fixture_id`, `api_football_league_id`, `temporada`, `ronda`, `minuto`, `payload_api`, `actualizado_api_en`, `origen_datos`, `fuente_detalle`, `creado_manual_en`, `es_relevante`, `prioridad_visual` CONFIRMADO.
- En importadores Python: las mismas columnas mas `raw_payload` indirecto en fixtures; para `partidos` se usa `payload_api` CONFIRMADO.

Columnas actualizadas:

- `estado`, `fecha_texto`, `goles_local_final`, `goles_visitante_final`, `minuto`, `actualizado_api_en` CONFIRMADO.
- `torneo`, `fecha_orden`, `local_nombre`, `visitante_nombre`, `local_corto`, `visitante_corto`, `temporada`, `ronda`, `es_relevante`, `prioridad_visual`, `external_source`, `external_id`, `importado_externo_en`, `raw_import_payload`, `payload_api` CONFIRMADO.

Filtros y ordenamientos:

- `id = partidoId`, `id in (...)`, `id::text = p_partido_id` CONFIRMADO.
- `api_football_fixture_id in (...)`, `api_football_fixture_id not null`, `api_football_fixture_id = ...` CONFIRMADO.
- `estado = 'finalizado'`, `estado = 'proximo'`, `estado in ('proximo','en_vivo')` CONFIRMADO.
- `goles_local_final not null`, `goles_visitante_final not null` CONFIRMADO.
- `local_nombre in (...)`, `visitante_nombre in (...)`, `local_nombre = nombre`, `visitante_nombre = nombre` CONFIRMADO.
- `torneo = nombre` CONFIRMADO.
- `es_relevante = true` CONFIRMADO.
- `external_source = ... and external_id = ...` CONFIRMADO.
- Orden por `fecha_orden asc/desc`, `prioridad_visual asc` CONFIRMADO.

Relaciones esperadas:

- `partidos.api_football_fixture_id` se alinea con `football_fixtures.api_football_fixture_id` INFERIDO; no hay FK confirmada sobre `partidos`.
- `pronosticos.partido_id` referencia `partidos.id` INFERIDO; las funciones comparan con cast a text.
- `model_predictions.partido_id` almacena relacion con `partidos.id` INFERIDO, sin FK confirmada.

Restricciones e indices esperados:

- Unico `api_football_fixture_id` CONFIRMADO por migraciones `202606240001`, `202606240002`, `202606240003`.
- Indice parcial unico `(external_source, external_id)` cuando ambos no son null CONFIRMADO.
- Indice `(es_relevante, prioridad_visual, fecha_orden)` CONFIRMADO.
- Indice de identidad fallback `(lower(torneo), fecha_orden, lower(local_nombre), lower(visitante_nombre))` INFERIDO por nombre `partidos_import_fallback_identity_key`; contenido exacto requiere leer la migracion completa antes de implementar.
- Indices recomendados por filtros: `fecha_orden`, `estado, fecha_orden`, `local_nombre, fecha_orden`, `visitante_nombre, fecha_orden`, `torneo, fecha_orden` INFERIDO.

Tipos/conflictos:

- `id`: CONFLICTIVO. RPCs insertan `v_fixture_id bigint`, frontend y SQL aceptan `text`, joins usan `p.id::text = pr.partido_id::text`, docs/manual-data tratan el id como copiable. No se confirma si la tabla original usaba `text`, `bigint` o `uuid`.
- `estado`: CONFIRMADO por uso con valores `proximo`, `en_vivo`, `finalizado`, `cancelado`; tambien existe uso frontend de `en vivo` en una comparacion, CONFLICTIVO con `en_vivo`.

RLS y roles:

- Authenticated debe poder leer partidos CONFIRMADO por frontend.
- Authenticated debe poder recibir realtime sobre `partidos` CONFIRMADO.
- Escritura directa de partidos debe estar restringida a admin/RPC o `service_role` INFERIDO.
- RPCs admin validan `predigol_es_admin()` CONFIRMADO.

### `pronosticos`

Estado: CONFIRMADO como tabla requerida; definicion original DESCONOCIDA.

Columnas leidas:

- `id`, `usuario_id`, `partido_id`, `goles_local`, `goles_visitante`, `actualizado_en` CONFIRMADO.

Columnas insertadas/actualizadas:

- `partido_id`, `usuario_id`, `goles_local`, `goles_visitante`, `actualizado_en` CONFIRMADO.

Filtros:

- `usuario_id = usuarioId` CONFIRMADO.
- `partido_id = partido.id` CONFIRMADO.
- `partido_id in (...)` mediante join logico en frontend CONFIRMADO.

Relaciones esperadas:

- `usuario_id` referencia `auth.users(id)` o `profiles.id` INFERIDO.
- `partido_id` referencia `partidos.id` INFERIDO; tipo exacto DESCONOCIDO por casts a text.

Restricciones e indices esperados:

- Unico `(partido_id, usuario_id)` CONFIRMADO por `upsert(... onConflict: "partido_id,usuario_id")`.
- Trigger `predigol_validar_pronostico_tg` CONFIRMADO si la tabla existe.
- Indices recomendados: `(usuario_id)`, `(partido_id)`, `(partido_id, usuario_id)` INFERIDO.

Fechas/defaults:

- `actualizado_en` actualizado por trigger a `now()` CONFIRMADO.
- `creado_en` DESCONOCIDO.

RLS y roles:

- Authenticated debe leer y escribir solo sus propios pronosticos CONFIRMADO/INFERIDO.
- `service_role` puede saltar validacion de autor y cierre de partido CONFIRMADO por trigger.
- Realtime sobre `pronosticos` requerido CONFIRMADO.

### `ligas`

Estado: CONFIRMADO como tabla requerida; definicion original DESCONOCIDA.

Columnas leidas:

- `id`, `nombre`, `codigo`, `creador_id`, `participantes` CONFIRMADO por frontend/RPC mocks.

Columnas insertadas:

- `nombre`, `codigo`, `creador_id` CONFIRMADO.

Filtros:

- `codigo = codigoNormalizado` CONFIRMADO.

Relaciones esperadas:

- `creador_id` referencia usuario UUID INFERIDO.
- `liga_miembros.liga_id` referencia `ligas.id` INFERIDO.

Restricciones e indices esperados:

- `codigo` unico CONFIRMADO por manejo de error `23505` y generacion de invitacion.
- Primary key `id` CONFIRMADO, tipo CONFLICTIVO: RPC `obtener_ranking_liga(p_liga_id uuid)` espera UUID; tests usan numeros como mocks.
- Indice por `codigo` INFERIDO.

RLS y roles:

- Authenticated puede crear ligas y leer ligas propias INFERIDO.
- Lectura de detalle/ranking protegida por membresia CONFIRMADO en RPC `obtener_ranking_liga`.

### `liga_miembros`

Estado: CONFIRMADO como tabla requerida; definicion original DESCONOCIDA.

Columnas leidas:

- `liga_id`, `usuario_id` CONFIRMADO.

Columnas insertadas/upsert:

- `liga_id`, `usuario_id` CONFIRMADO.

Filtros:

- `liga_id = p_liga_id` CONFIRMADO.
- `usuario_id = auth.uid()` CONFIRMADO.

Relaciones esperadas:

- `liga_id` referencia `ligas.id` INFERIDO.
- `usuario_id` referencia `auth.users(id)` INFERIDO.

Restricciones e indices esperados:

- Unico `(liga_id, usuario_id)` CONFIRMADO por `upsert(... onConflict: "liga_id,usuario_id")` y manejo de duplicado 23505.
- Indices `(usuario_id)`, `(liga_id)` INFERIDO.

RLS y roles:

- Authenticated puede insertar su propia membresia INFERIDO.
- Authenticated solo puede leer membresias de ligas a las que pertenece INFERIDO.

### Tablas posteriores resumidas

`football_competitions`: CONFIRMADO por `202606240001`. PK `api_football_league_id`; columnas `name`, `country`, `category`, `season_start_year`, `priority`, `enabled`, `created_at`, `updated_at`; lectura authenticated; escritura service_role/admin via Edge Functions/scripts.

`football_teams`: CONFIRMADO. PK `api_football_team_id`; columnas `name`, `code`, `country`, `logo_url`, `founded`, `national`, `raw_payload`, `updated_at`; filtros por `name` y `api_football_team_id`; upsert por `api_football_team_id`.

`football_fixtures`: CONFIRMADO. PK `api_football_fixture_id`; FK a `football_competitions` y `football_teams`; columnas de kickoff, estado, venue, goles y raw payload; filtros por `api_football_fixture_id`, `status_short`; orden por `kickoff_at`.

`football_live_snapshots`: CONFIRMADO. FK a `football_fixtures`; lectura por `api_football_fixture_id`, orden `captured_at desc`.

`model_predictions`: CONFIRMADO. PK/FK `api_football_fixture_id`; columnas de probabilidades, goles esperados, version, metadata, `generated_at`; luego agrega `model_family`, `model_parameters`, `feature_snapshot`, `access_tier`, `premium_reason`, `premium_preview`; filtros por `api_football_fixture_id`, `access_tier`, orden `generated_at`.

`predigol_google_sheet_sync_config`: CONFIRMADO. Config unica `id = 'default'`, `csv_url`, `enabled`, `import_secret`, resultados y `updated_by` FK a `auth.users`.

`predigol_api_football_sync_config`: CONFIRMADO. Config unica `id = 'default'`, flags de cron/API-Football; depende de admin RPC.

`api_football_sync_runs`: CONFIRMADO. Logs de sync con `started_at`, `finished_at`, `status`, `trigger_source`, contadores y `metadata`.

`model_evaluations`, `app_error_logs`, `user_favorite_teams`, `user_favorite_competitions`, `user_notification_preferences`, `web_push_subscriptions`, `web_push_deliveries`, `web_push_dispatch_config`, `model_prediction_settings`, `model_datasets`, `model_runs`, `team_aliases`, `subscription_plans`, `user_subscriptions`, `payment_products`, `payment_orders`, `payment_transactions`, `payment_webhook_events`, `subscription_events`: CONFIRMADO por migraciones y consumidores. Sus contratos completos estan en sus migraciones posteriores y no pertenecen a la migracion base salvo sus dependencias contra `profiles`, `partidos`, `pronosticos` o `auth.users`.

## 5. Contrato detallado por RPC

RPCs confirmadas y consumidores:

- `predigol_codigo_equipo(p_nombre text)`: devuelve codigo corto text. Usa solo input. Consumida por RPCs admin.
- `predigol_es_admin()`: devuelve boolean. Consulta `profiles.id`, `profiles.es_admin`, `profiles.rol`; considera `service_role`. Consumida por politicas y RPCs admin.
- `reclamar_primer_admin()`: sin parametros. Actualiza `profiles.es_admin`, `profiles.rol`; retorna jsonb de perfil. Consumida por `userAccountApi.js`.
- `crear_partido_manual(p_torneo, p_fecha_orden, p_local_nombre, p_visitante_nombre, p_local_corto, p_visitante_corto, p_temporada, p_ronda, p_fuente_detalle)`: crea `football_teams`, `football_fixtures`, `partidos`; requiere admin; retorna jsonb.
- `cerrar_partido_manual(p_partido_id text, p_goles_local integer, p_goles_visitante integer)`: actualiza `partidos` y `football_fixtures`; requiere admin; retorna jsonb.
- `cancelar_partido_manual(p_partido_id text)`: actualiza `partidos` y `football_fixtures`; requiere admin; retorna jsonb.
- `marcar_partido_relevante(p_partido_id text, p_es_relevante boolean, p_prioridad_visual integer)`: actualiza `partidos.es_relevante`, `partidos.prioridad_visual`; requiere admin; retorna jsonb.
- `importar_partido_externo(...)`: crea/actualiza partidos desde Google Sheets; usa `crear_partido_manual`, `partidos`, `football_fixtures`; requiere admin; retorna jsonb con `partido` y `action`.
- `obtener_google_sheet_sync_config()`: retorna jsonb de configuracion; requiere admin; consumidor `AdminPartidosPage.jsx` y Edge Function.
- `guardar_google_sheet_sync_config(p_csv_url text, p_enabled boolean)`: upsert de config; requiere admin; retorna jsonb.
- `registrar_google_sheet_sync_result(p_result jsonb, p_error text)`: actualiza config; service_role; consumidor `import-google-sheet-fixtures`.
- `editar_partido_admin(...)`: actualiza `partidos` y probablemente `football_fixtures`; requiere admin; consumidor `AdminPartidosPage.jsx`.
- `predigol_calcular_puntos(p_goles_local, p_goles_visitante, p_final_local, p_final_visitante)`: devuelve integer; usado por rankings.
- `predigol_validar_pronostico()`: trigger; valida `pronosticos` contra `partidos`; no se invoca por REST.
- `obtener_ranking_global()`: retorna tabla `usuario_id`, `nombre`, `username`, `avatar_url`, `puntos`, `aciertos`, `pronosticos`, `exactos`, `posicion`; consulta `profiles`, `pronosticos`, `partidos`; requiere sesion o service_role.
- `obtener_ranking_liga(p_liga_id uuid)`: retorna ranking por liga; consulta `liga_miembros`, `profiles`, `pronosticos`, `partidos`; valida membresia.
- `obtener_api_football_sync_config()`: retorna config; requiere admin.
- `guardar_api_football_sync_config(p_enabled, p_season, p_upcoming_limit, p_sync_upcoming, p_sync_live, p_sync_results)`: actualiza config; requiere admin.
- `obtener_api_football_monitor()`: retorna jsonb con `runs`, `summary`, `config`; consulta `api_football_sync_runs`, `predigol_api_football_sync_config`, `football_fixtures`, `partidos`.
- `registrar_error_cliente(p_source, p_message, p_route, p_metadata)`: inserta `app_error_logs`; requiere usuario autenticado.
- `obtener_ranking_segmentado(p_periodo text, p_torneo text)`: retorna ranking como global; consulta `partidos`, `pronosticos`, `profiles`.
- `obtener_model_prediction_settings()`: retorna jsonb de modelo activo; requiere admin.
- `guardar_model_prediction_settings(p_active_model text)`: actualiza config; requiere admin.
- `obtener_model_admin_summary()`: retorna jsonb de resumen; requiere admin; consulta `model_datasets`, `model_runs`, `team_aliases`, `model_predictions`, `partidos`, `model_prediction_settings`.
- `guardar_team_alias(...)`: inserta/actualiza `team_aliases`; requiere admin.
- `actualizar_estado_team_alias(...)`: actualiza `team_aliases`; requiere admin.
- `predigol_usuario_tiene_premium(p_user_id uuid default auth.uid())`: devuelve boolean; consulta `user_subscriptions`, `profiles` via `predigol_es_admin`.
- `obtener_plan_usuario()`: retorna jsonb `plan_code`, `status`, `is_premium`, `expires_at`, `source`; consulta `user_subscriptions`.
- `predigol_prediction_visible_row(p_prediction model_predictions)`: devuelve jsonb ocultando campos premium segun permisos.
- `obtener_predicciones_visibles(p_limit integer)`: retorna setof jsonb; consulta `model_predictions`; requiere sesion.
- `obtener_prediccion_visible(p_api_football_fixture_id bigint)`: retorna jsonb o null; consulta `model_predictions`; requiere sesion.
- `predigol_apply_paid_premium_order(p_order_id uuid)`: aplica pago a `user_subscriptions` y `subscription_events`; service_role; migracion Wompi, no modificada.

RPCs consumidas pero sin definicion encontrada en migraciones:

- `obtener_mis_ligas`: DESCONOCIDO. Consumida por `privateLeaguesApi.js`; debe devolver filas con `id`, `nombre`, `codigo`, `participantes`, `creador_id` al menos.
- `obtener_detalle_liga`: DESCONOCIDO. Consumida por `privateLeaguesApi.js`; debe devolver detalle de liga y miembros compatible con `privateLeaguesMappers.js`.

## 6. Mapa de relaciones

Relaciones confirmadas por SQL:

- `football_fixtures.competition_api_id -> football_competitions.api_football_league_id`.
- `football_fixtures.home_team_api_id -> football_teams.api_football_team_id`.
- `football_fixtures.away_team_api_id -> football_teams.api_football_team_id`.
- `football_live_snapshots.api_football_fixture_id -> football_fixtures.api_football_fixture_id`.
- `model_predictions.api_football_fixture_id -> football_fixtures.api_football_fixture_id`.
- `user_subscriptions.user_id -> auth.users.id`.
- `user_subscriptions.plan_code -> subscription_plans.code`.
- `user_favorite_teams.user_id -> auth.users.id`.
- `user_favorite_competitions.user_id -> auth.users.id`.
- `user_notification_preferences.user_id -> auth.users.id`.
- `web_push_subscriptions.user_id -> auth.users.id`.
- Tablas de pago a `auth.users`, `subscription_plans`, `user_subscriptions`, `payment_products`, `payment_orders`, `payment_transactions`.

Relaciones inferidas para base:

- `profiles.id -> auth.users.id` INFERIDO.
- `pronosticos.usuario_id -> auth.users.id` INFERIDO.
- `pronosticos.partido_id -> partidos.id` INFERIDO.
- `ligas.creador_id -> auth.users.id` INFERIDO.
- `liga_miembros.usuario_id -> auth.users.id` INFERIDO.
- `liga_miembros.liga_id -> ligas.id` INFERIDO.
- `partidos.api_football_fixture_id -> football_fixtures.api_football_fixture_id` INFERIDO, pero la FK no esta confirmada en migraciones.
- `model_predictions.partido_id -> partidos.id` INFERIDO, sin FK confirmada.

## 7. Mapa de dependencias entre migraciones

| Migracion | Espera encontrar | Crea | Modifica | Desde base vacia |
|---|---|---|---|---|
| `202606240001_api_football_predictions.sql` | `partidos` | `football_*`, `model_predictions` | `partidos`, publication realtime | No ejecutable: indice sobre `partidos` falla si falta. |
| `202606240002_fix_partidos_api_upsert_constraint.sql` | `partidos`, columna `api_football_fixture_id` | constraint unico | constraint/indice | No ejecutable si falta `partidos`. |
| `202606240003_hybrid_free_manual_flow.sql` | `partidos`, `football_*` | secuencias, RPCs | `partidos`, constraint | No ejecutable si falta `partidos`. |
| `202606240004_fix_manual_partido_ids.sql` | `partidos`, `football_*`, secuencias | reemplaza RPC | RPC | No ejecutable si faltan objetos previos. |
| `202606240005_admin_manual_match_panel.sql` | `profiles`, `partidos`, `football_*` | RPCs admin | `profiles.es_admin` | No ejecutable si falta `profiles` o `partidos`. |
| `202606240006_roles_and_relevant_matches.sql` | `profiles`, `partidos` | RPC relevancia | `profiles.rol`, `partidos.es_relevante/prioridad_visual` | No ejecutable si faltan tablas. |
| `202606250001_google_sheet_imports.sql` | `partidos`, RPCs admin | RPC import externo | `partidos` | No ejecutable si falta `partidos`. |
| `202606250002_google_sheet_auto_sync.sql` | `predigol_es_admin`, `auth.users` | config Google Sheet | cron externo | Ejecutable parcialmente, pero RPCs fallan si falta `predigol_es_admin`. |
| `202606250003_admin_match_editing.sql` | `partidos`, `football_fixtures`, `predigol_es_admin` | `editar_partido_admin` | partidos/fixtures via RPC | No ejecutable funcionalmente si falta base. |
| `202606250004_predictions_scoring_ranking.sql` | `profiles`, `partidos`, `pronosticos`, `liga_miembros` | scoring/ranking RPCs, trigger si existe `pronosticos` | trigger sobre `pronosticos` | No ejecutable por funciones que referencian tablas faltantes. |
| `202606250005_api_football_paid_cron.sql` | `predigol_es_admin` | config API-Football | cron/config | Depende de admin base. |
| `202607010001_api_football_sync_monitoring.sql` | API config, `partidos`, `football_fixtures`, `predigol_es_admin` | `api_football_sync_runs`, monitor RPC | config | No ejecutable completa si falta base/config. |
| `202607010002_model_evaluations.sql` | ninguno base directo | `model_evaluations` | RLS/grants | Ejecutable desde vacia salvo dependencia de admin politica si se agregara. |
| `202607010003_app_error_monitoring.sql` | `predigol_es_admin`, `auth.users` | `app_error_logs`, RPC | logs | Depende de admin RPC. |
| `202607030001_favorites_notification_preferences.sql` | `auth.users` | favoritos/preferencias | RLS/grants | Ejecutable con Auth schema. |
| `202607030002_segmented_rankings.sql` | `profiles`, `partidos`, `pronosticos`, scoring | ranking segmentado | RPC | No ejecutable si falta base. |
| `202607030003_web_push_subscriptions.sql` | `auth.users` | push subscriptions | RLS/grants | Ejecutable con Auth schema. |
| `202607030004_web_push_dispatch.sql` | `auth.users` | deliveries/config | RLS/grants/cron | Ejecutable con Auth schema; operativo depende de datos base. |
| `202607060001_model_v2_metadata.sql` | `model_predictions`, `predigol_es_admin` | settings V2 | `model_predictions` | No ejecutable si falta `model_predictions`. |
| `202607060001_model_v2_metadata_down.sql` | objetos V2 | nada | elimina V2 | Rollback, no debe ejecutarse como migracion normal. |
| `202607060002_model_runs_datasets_team_aliases.sql` | `predigol_es_admin`, `model_predictions` | datasets/runs/aliases/RPCs | grants/RLS | Parcial: tablas crean; RPC summary depende de otros objetos. |
| `202607060002_model_runs_datasets_team_aliases_down.sql` | objetos model admin | nada | elimina objetos | Rollback, no debe ejecutarse como migracion normal. |
| `202607060003_model_dataset_checksum_unique.sql` | `model_datasets` | indice unico | indice | No ejecutable si falta `model_datasets`. |
| `202607060004_lock_model_admin_writes.sql` | `model_datasets`, `model_runs`, `team_aliases` | nada | grants/RLS | No ejecutable si faltan tablas. |
| `202607060005_partidos_import_fallback_identity.sql` | `partidos` | indice unico | indice | No ejecutable si falta `partidos`. |
| `202607070001_api_import_model_runs.sql` | `model_runs` | columnas | `model_runs` | No ejecutable si falta `model_runs`. |
| `202607100001_freemium_premium_access.sql` | `auth.users`, `model_predictions`, `predigol_es_admin` | plans/subscriptions/RPCs premium | `model_predictions` | No ejecutable si falta `model_predictions`/admin. |
| `202607100002_refresh_mvp_grants.sql` | objetos opcionales | nada | grants si existen | Idempotente y seguro; no crea faltantes. |
| `202607150001_wompi_premium_payments.sql` | `subscription_plans`, `user_subscriptions`, `predigol_es_admin`, `auth.users` | pagos/Wompi | grants/RPC | No ejecutable si falta freemium. |

Instrucciones no idempotentes o riesgosas:

- `alter publication supabase_realtime add table ...` mitigado por checks, pero depende de publication existente.
- `cron.unschedule` y `cron.schedule` reprograman jobs; no son puramente declarativos.
- Archivos `_down.sql` son destructivos por `drop table`/`drop function`.
- `drop function if exists` antes de crear RPCs puede romper dependencias si se ejecuta fuera de orden.

## 8. Problemas de orden y timestamps duplicados

Archivos con timestamps duplicados confirmados:

- `supabase/migrations/202607060001_model_v2_metadata.sql`.
- `supabase/migrations/202607060001_model_v2_metadata_down.sql`.
- `supabase/migrations/202607060002_model_runs_datasets_team_aliases.sql`.
- `supabase/migrations/202607060002_model_runs_datasets_team_aliases_down.sql`.

Los archivos `_down.sql` son rollbacks CONFIRMADO por su contenido: ejecutan `drop index`, `drop function`, `drop table` y `alter table ... drop column`. No deben vivir como migraciones normales en `supabase/migrations` porque comparten version y son destructivos.

Recomendacion documental, sin mover archivos en esta tarea:

- Moverlos en una tarea posterior a `supabase/rollbacks/202607060001_model_v2_metadata_down.sql` y `supabase/rollbacks/202607060002_model_runs_datasets_team_aliases_down.sql`, o a `docs/sql-rollbacks/` si no se desea que Supabase CLI los detecte.
- Registrar en README de rollbacks que no se ejecutan automaticamente y requieren revision manual.

## 9. Elementos confirmados, inferidos y desconocidos

Confirmados:

- Tablas base faltantes: `profiles`, `partidos`, `pronosticos`, `ligas`, `liga_miembros`.
- `profiles` requiere `id`, `nombre`, `username`, `avatar_url`, `es_admin`, `rol`.
- `partidos` requiere columnas de calendario/equipos/resultados/API-Football/relevancia/import externo.
- `pronosticos` requiere `usuario_id`, `partido_id`, goles y `actualizado_en`.
- `ligas.codigo` debe ser unico.
- `liga_miembros` debe tener unico `(liga_id, usuario_id)`.
- Authenticated usa lectura en frontend; admin usa RPCs y `predigol_es_admin()`.
- Realtime escucha `partidos`, `model_predictions`, `football_fixtures`, `pronosticos`.

Inferidos:

- FKs base hacia `auth.users` y entre `pronosticos`/`partidos`, `liga_miembros`/`ligas`.
- RLS propia para `pronosticos`, `ligas` y `liga_miembros`.
- Indices base por filtros frecuentes.
- Trigger de `profiles` desde `auth.users` usando metadata `nombre`.

Desconocidos:

- Tipos originales exactos de `partidos.id` y `ligas.id`.
- Si `profiles` tenia `created_at`/`updated_at` y politicas RLS originales.
- Si `pronosticos` tenia `creado_en` u otras columnas historicas.
- Definiciones originales de `obtener_mis_ligas` y `obtener_detalle_liga`.
- Politicas RLS originales de tablas base.

Conflictivos:

- `partidos.id`: insertado como bigint en RPCs, tratado como text en funciones/joins/frontend.
- `ligas.id`: RPC ranking usa uuid, tests usan numeros mock.
- Estado `en_vivo` vs texto UI `en vivo`.

## 10. Propuesta de contenido para futura migracion `supabase/migrations/202606230001_predigol_base_schema.sql`

La futura migracion base deberia contener, sin aplicar aun:

- Extensions necesarias: `pgcrypto` si se usan UUIDs generados.
- `public.profiles` con `id uuid primary key references auth.users(id) on delete cascade`, `nombre`, `username`, `avatar_url`, `es_admin boolean default false`, `rol text default 'usuario'`, constraint `profiles_rol_check`.
- Trigger `auth.users -> public.profiles` INFERIDO para crear perfil con `raw_user_meta_data->>'nombre'`, si se decide cerrar el hueco documentado en `docs/preparacion-cuentas-prueba-fase8i.md`.
- `public.partidos` con todas las columnas base y las columnas que las migraciones posteriores esperan alterar o indexar.
- `public.pronosticos` con `id`, `usuario_id`, `partido_id`, `goles_local`, `goles_visitante`, `actualizado_en`, unique `(partido_id, usuario_id)`.
- `public.ligas` con `id`, `nombre`, `codigo`, `creador_id`, fechas, unique `codigo`.
- `public.liga_miembros` con `liga_id`, `usuario_id`, fechas, unique `(liga_id, usuario_id)`.
- Indices minimos: `partidos(fecha_orden)`, `partidos(estado, fecha_orden)`, `pronosticos(usuario_id)`, `pronosticos(partido_id)`, `ligas(codigo)`, `liga_miembros(usuario_id)`, `liga_miembros(liga_id)`.
- RLS: perfiles propios/admin; lectura de partidos para authenticated; pronosticos propios; ligas visibles para miembros; miembros visibles para miembros; service_role completo.
- RPCs faltantes `obtener_mis_ligas` y `obtener_detalle_liga` o una migracion posterior inmediata que las cree antes de usar `privateLeaguesApi.js`.

No se debe inventar el tipo de `partidos.id` en implementacion final sin validar contra el respaldo local. Recomendacion: confirmar contra respaldo antes de escribir SQL.

## 11. Orden seguro para reparar las migraciones

1. Confirmar en el respaldo local los tipos exactos de `profiles`, `partidos`, `pronosticos`, `ligas`, `liga_miembros`.
2. Crear `supabase/migrations/202606230001_predigol_base_schema.sql` con solo esquema base e idempotencia razonable.
3. Mover los dos `_down.sql` fuera de `supabase/migrations` en una tarea separada.
4. Revisar que no queden timestamps duplicados.
5. Ejecutar validacion local con base vacia, no remota.
6. Corregir migraciones no idempotentes solo si fallan en local.
7. Aplicar a una base local de Supabase, nunca a la remota reiniciada, hasta completar QA.
8. Solo despues planificar reparacion remota con backup, aprobacion explicita y comandos seguros.

## 12. Checklist para validar posteriormente con Supabase local

- `supabase start` solo cuando se autorice iniciar Supabase local.
- `supabase db reset` solo local, no linked.
- Confirmar que todas las migraciones aplican desde cero.
- Confirmar que no hay versiones duplicadas en `supabase/migrations`.
- Ejecutar smoke SQL de existencia de tablas base.
- Probar signup y confirmar fila en `profiles`.
- Probar `reclamar_primer_admin`, `predigol_es_admin` y panel admin.
- Probar crear/cerrar/cancelar partido manual.
- Probar upsert de `pronosticos` como usuario autenticado y bloqueo tras inicio/finalizacion.
- Probar `obtener_ranking_global`, `obtener_ranking_liga`, `obtener_ranking_segmentado`.
- Probar crear liga, unirse por codigo, detalle y ranking.
- Probar lectura de predicciones visibles gratis/premium.
- Probar Realtime en `partidos`, `model_predictions`, `football_fixtures`, `pronosticos`.
- Ejecutar suites frontend/Python si se autoriza.

## 13. Riesgos de perdida de compatibilidad

- Elegir mal el tipo de `partidos.id` puede romper rutas, `pronosticos.partido_id`, `model_predictions.partido_id` y RPCs.
- Elegir mal el tipo de `ligas.id` puede romper `obtener_ranking_liga(uuid)` o datos existentes.
- No crear el trigger de `profiles` puede mantener el fallo documentado tras registro.
- RLS demasiado restrictiva puede romper frontend autenticado.
- RLS demasiado permisiva puede exponer perfiles, ligas o pronosticos de otros usuarios.
- Mover/aplicar rollbacks `_down.sql` por error puede borrar objetos de modelo.
- Cron SQL contiene URL de proyecto historica en migracion; debe revisarse antes de uso operativo.
- Estados inconsistentes `en_vivo`/`en vivo` pueden afectar conteos de admin y UI.

## 14. Archivos exactos utilizados como evidencia

Frontend y servicios:

- `predigol-web/src/App.jsx`.
- `predigol-web/src/hooks/useFavorites.js`.
- `predigol-web/src/hooks/useNotificationPreferences.js`.
- `predigol-web/src/hooks/usePushNotifications.js`.
- `predigol-web/src/pages/AdminPartidosPage.jsx`.
- `predigol-web/src/pages/HomePage.jsx`.
- `predigol-web/src/pages/ModelAdminPage.jsx`.
- `predigol-web/src/services/adminApi.js`.
- `predigol-web/src/services/adminFootballApi.js`.
- `predigol-web/src/services/footballApi.js`.
- `predigol-web/src/services/notificationsApi.js`.
- `predigol-web/src/services/predictionStatsApi.js`.
- `predigol-web/src/services/privateLeaguesApi.js`.
- `predigol-web/src/services/userAccountApi.js`.
- `predigol-web/src/utils/errorMonitoring.js`.
- `predigol-web/src/utils/rankingSupabase.js`.

Prediction service y scripts:

- `prediction-service/predigol_model/supabase_client.py`.
- `prediction-service/predigol_model/run.py`.
- `prediction-service/predigol_model/diagnostics.py`.
- `prediction-service/predigol_model/traceability.py`.
- `scripts/importar_fixtures_proximos_mvp.py`.
- `scripts/publicar_predicciones_v1_mvp.py`.
- `scripts/verificar_roles_supabase.py`.
- `scripts/verificar_supabase_mvp.py`.

Edge Functions:

- `supabase/functions/dispatch-push-notifications/index.ts`.
- `supabase/functions/import-google-sheet-fixtures/index.ts`.
- `supabase/functions/send-test-push/index.ts`.
- `supabase/functions/sync-live-fixtures/index.ts`.
- `supabase/functions/sync-live-fixtures/README.md`.

Migraciones:

- Todos los archivos de `supabase/migrations`, especialmente `202606240001_api_football_predictions.sql`, `202606240002_fix_partidos_api_upsert_constraint.sql`, `202606240003_hybrid_free_manual_flow.sql`, `202606240005_admin_manual_match_panel.sql`, `202606240006_roles_and_relevant_matches.sql`, `202606250001_google_sheet_imports.sql`, `202606250004_predictions_scoring_ranking.sql`, `202607030002_segmented_rankings.sql`, `202607060001_model_v2_metadata.sql`, `202607060001_model_v2_metadata_down.sql`, `202607060002_model_runs_datasets_team_aliases.sql`, `202607060002_model_runs_datasets_team_aliases_down.sql`, `202607100001_freemium_premium_access.sql`, `202607150001_wompi_premium_payments.sql`.

Tests, docs y manual-data:

- `predigol-web/src/services/privateLeaguesApi.test.js`.
- `predigol-web/src/services/userAccountApi.test.js`.
- `predigol-web/src/services/adminApi.test.js`.
- `prediction-service/tests/test_verificar_roles_supabase.py`.
- `prediction-service/tests/test_supabase_security_static.py`.
- `docs/preparacion-cuentas-prueba-fase8i.md`.
- `docs/despliegue-predigol.md`.
- `docs/qa-despliegue-predigol.md`.
- `docs/roadmap-predigol.md`.
- `docs/model-runs-and-datasets.md`.
- `docs/supabase-model-security.md`.
- `manual-data/partidos_actuales.template.sql`.
- `manual-data/resultados.template.sql`.
- `manual-data/google-sheets-partidos.template.csv`.
- `manual-data/google-sheets-demo-mvp.csv`.
- `manual-data/temporada-ejemplo.csv`.

## 15. Operaciones Supabase localizadas

Tablas con `.from()` o REST directo confirmadas:

- `api_football_sync_runs`, `app_error_logs`, `football_competitions`, `football_fixtures`, `football_live_snapshots`, `football_teams`, `liga_miembros`, `ligas`, `model_datasets`, `model_evaluations`, `model_predictions`, `model_runs`, `partidos`, `predigol_api_football_sync_config`, `predigol_google_sheet_sync_config`, `profiles`, `pronosticos`, `team_aliases`, `user_favorite_competitions`, `user_favorite_teams`, `user_notification_preferences`, `user_subscriptions`, `web_push_deliveries`, `web_push_subscriptions`.

Edge Functions invocadas desde frontend o docs:

- `import-google-sheet-fixtures` CONFIRMADO.
- `sync-live-fixtures` CONFIRMADO por fetch directo a `/functions/v1/sync-live-fixtures`.
- `send-test-push` CONFIRMADO.

Canales Realtime:

- `predigol-partidos-live`: `partidos`, `model_predictions`.
- `predigol-notificaciones-live`: `partidos`, `football_fixtures`, `pronosticos`.

Referencias `auth.users`:

- FKs en migraciones de `user_subscriptions`, favoritos, preferencias, push y pagos.
- Docs de preparacion de cuentas indican `profiles.id` debe coincidir con `auth.users.id`.
- Edge Functions validan usuario con `supabase.auth.getUser(token)`.
