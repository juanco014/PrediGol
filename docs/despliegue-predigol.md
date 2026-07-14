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

| Variable | Placeholder |
| --- | --- |
| `SUPABASE_URL` | `<SUPABASE_URL>` |
| `SUPABASE_SERVICE_ROLE_KEY` | `<SUPABASE_SERVICE_ROLE_KEY_SOLO_BACKEND>` |
| `FOOTBALL_API_PROVIDER` | `api_football` |
| `FOOTBALL_API_KEY` | `<FOOTBALL_API_KEY>` |
| `FOOTBALL_API_DRY_RUN` | `true` |

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

Validacion tecnica con service role para inventario de objetos:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_supabase_mvp.py
```

Validacion autenticada con sesiones reales de Supabase Auth:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_roles_supabase.py
```

Variables necesarias para el verificador autenticado:

| Variable | Placeholder |
| --- | --- |
| `SUPABASE_URL` | `<SUPABASE_URL>` |
| `SUPABASE_ANON_KEY` | `<SUPABASE_ANON_KEY_PUBLICA>` |
| `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY` o `VITE_SUPABASE_PUBLISHABLE_KEY` | Alternativas aceptadas por el script. |
| `PREDIGOL_TEST_FREE_EMAIL` | `<EMAIL_USUARIO_GRATIS>` |
| `PREDIGOL_TEST_FREE_PASSWORD` | `<PASSWORD_USUARIO_GRATIS>` |
| `PREDIGOL_TEST_PREMIUM_EMAIL` | `<EMAIL_USUARIO_PREMIUM>` |
| `PREDIGOL_TEST_PREMIUM_PASSWORD` | `<PASSWORD_USUARIO_PREMIUM>` |
| `PREDIGOL_TEST_ADMIN_EMAIL` | `<EMAIL_USUARIO_ADMIN>` |
| `PREDIGOL_TEST_ADMIN_PASSWORD` | `<PASSWORD_USUARIO_ADMIN>` |

Con usuario gratis autenticado, no con service role:

```sql
select * from public.obtener_predicciones_visibles(10);
```

La respuesta de predicciones premium bloqueadas debe tener campos sensibles en `null` y `is_locked = true`.

Con admin o usuario premium activo debe devolver contenido completo si existen filas premium.

No marcar la validacion de roles como aprobada si faltan usuarios de prueba o si no hay sesion real de Supabase Auth.

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

## 15. Fase 7D - Verificacion Post-Migraciones Manuales

Despues de aplicar migraciones manualmente en Supabase SQL Editor, la verificacion sigue mostrando objetos faltantes/no expuestos por REST:

- Faltan/no se exponen `model_runs`, `model_datasets`, `team_aliases`, `subscription_plans`, `user_subscriptions`.
- Faltan/no se exponen RPC freemium `obtener_plan_usuario`, `obtener_predicciones_visibles`, `obtener_prediccion_visible`, `predigol_usuario_tiene_premium`.
- `predigol_es_admin` responde `permission denied for function predigol_es_admin`.

Se creo una migracion correctiva no destructiva:

```text
supabase/migrations/202607100002_refresh_mvp_grants.sql
```

Uso recomendado:

1. Confirmar en SQL Editor que las tablas/RPC base existen en `public`.
2. Si existen pero no aparecen por REST, aplicar la migracion correctiva o ejecutar `notify pgrst, 'reload schema';`.
3. Si no existen, reaplicar antes las migraciones base faltantes en el orden documentado en Fase 7C.
4. Reejecutar:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_supabase_mvp.py
prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
```

No se aplico automaticamente porque Supabase CLI no esta instalado en este entorno y no se deben ejecutar cambios manuales contra produccion sin confirmacion/backup.

## 16. Fase 7E - Roles Reales Gratis/Premium/Admin

Se agrego `scripts/verificar_roles_supabase.py` para validar sesiones reales de Supabase Auth. El script comprueba login, `obtener_plan_usuario`, `predigol_usuario_tiene_premium`, `obtener_predicciones_visibles`, `obtener_prediccion_visible`, RLS de tablas administrativas y `predigol_es_admin`.

Resultado esperado si faltan usuarios o datos:

- `PENDIENTE CREDENCIALES`: falta una variable `PREDIGOL_TEST_*`; no imprime secretos.
- `PENDIENTE DATOS`: no hay prediccion premium real para validar bloqueo o acceso.
- `FALLO`: credenciales incorrectas, RPC con error, premium/admin inesperado o escritura admin aceptada.

Preparacion manual de usuarios, SQL seguro y matriz de navegador estan en `docs/qa-despliegue-predigol.md`.

Estado final: Fase 7E completada para autenticacion, roles, suscripciones y RLS. El verificador autenticado termino con `Resumen: validacion autenticada sin fallos criticos.`

Resultado validado:

- Usuario gratis: login real, perfil, plan free, premium false, sin admin y escrituras administrativas bloqueadas.
- Usuario premium: login real, perfil, plan premium, premium true, suscripcion vigente, sin admin y escrituras administrativas bloqueadas.
- Usuario administrador: login real, perfil admin, `predigol_es_admin()=true`, lectura administrativa permitida y escrituras directas del modelo bloqueadas segun politicas actuales.
- Administrador con plan free: comportamiento aceptado; `predigol_usuario_tiene_premium()` devuelve true porque la RPC concede acceso premium al administrador.

Pendiente no bloqueante: no habia predicciones premium reales. `obtener_predicciones_visibles()` devolvio 0 filas, por lo que el bloqueo/desbloqueo de contenido premium queda como `PENDIENTE DATOS`. No crear datos ficticios ni modificar V1/V2 solo para cerrar esa prueba.

## 17. Fase 7F - Publicacion Controlada V1

Se agrego un publicador seguro para preparar la muestra MVP de predicciones V1 reales:

```bash
prediction-service/.venv/Scripts/python.exe scripts/publicar_predicciones_v1_mvp.py --dry-run
```

Caracteristicas:

- Usa exclusivamente `poisson-elo-v1`.
- Rechaza payloads que no tengan `model_version = poisson-elo-v1`.
- Lee historicos reales finalizados desde Supabase.
- Lee solo partidos `proximo` con `api_football_fixture_id` desde Supabase.
- Clasifica con el contrato real `model_predictions.access_tier` (`free` o `premium`).
- No sobrescribe por defecto; requiere `--allow-update` para actualizar.
- `--apply` queda bloqueado si no hay predicciones validas.

Estado actual: Fase 7F preparada, pendiente de fixtures reales.

Resultado del dry-run:

```json
{
  "ok": true,
  "status": "PENDIENTE FUENTE REAL",
  "history_matches": 226,
  "upcoming_matches": 0,
  "api_football_quota_used": 0
}
```

Fuente de fixtures revisada:

- Supabase `partidos`: 0 proximos con fixture API-Football.
- Supabase `football_fixtures`: 0 futuros.
- Reportes locales: solo historicos finalizados 2022-2024.
- API-Football: 1 solicitud minima para liga 239 temporada 2026; el plan actual no tiene acceso a esa temporada.

No se ejecuto `--apply`, no se publicaron predicciones y no se modificaron V1/V2.

## 18. Fase 7I - Decision De Fuente De Fixtures Actuales

La publicacion V1 real sigue bloqueada porque el contrato de `model_predictions` requiere `api_football_fixture_id` real y no hay `football_fixtures` futuros compatibles en Supabase. La Fase 7H confirmo que `partido_id` no identifica por si solo una prediccion del modelo en el esquema actual.

### Alternativa A: Mantener API-Football

Dependencias actuales ya adaptadas:

- Endpoint Python `/fixtures` mediante `ApiFootballClient.fixtures()` para temporada, rango y ventana de sincronizacion.
- Edge Function `sync-live-fixtures` con modos `live`, `upcoming`, `results`, `range` y `all`.
- Tablas `football_competitions`, `football_teams`, `football_fixtures`, `football_live_snapshots`, `partidos` y `model_predictions` alineadas a IDs API-Football.
- Cron configurado, desactivado por defecto, para live cada 5 minutos, proximos cada hora y resultados cada hora.
- Monitor `api_football_sync_runs` con conteo de requests, fixtures, equipos, partidos, errores y headers de cuota cuando el proveedor los devuelve.
- Publicador V1 lee historicos reales y proximos con `api_football_fixture_id`; frontend y RPC consumen predicciones por ese identificador.

Consultas estimadas por ejecucion segun el codigo actual:

| Operacion | Patron actual | Impacto de cuota |
| --- | --- | --- |
| Proximos | `upcoming`: 1 request por liga habilitada con `next=limit`. Hay 14 ligas habilitadas. | Medio si se ejecuta para todas las ligas; ajustar `enabled`, `limit` y frecuencia. |
| En vivo | `live`: 1 request global `live=all`, luego filtro por ligas habilitadas. | Bajo por llamada, alto si el cron queda muy frecuente. |
| Resultados | `results`: 1 request por liga habilitada, con `last=limit` o rango por temporada. | Medio; puede alcanzar rate limit por minuto si se ejecutan muchas ligas seguidas. |
| Generacion V1 | No consulta API-Football; lee Supabase y escribe `model_predictions`. | No consume cuota del proveedor. |

No hay informacion local verificable de precios ni limites comerciales actuales. Antes de activar temporada vigente, el propietario debe revisar plan, precio, cuota diaria, rate limit por minuto y acceso a ligas/temporadas directamente en la cuenta de API-Football/API-Sports.

Al habilitar temporada actual se desbloquearian: carga de fixtures futuros reales, generacion V1 con IDs compatibles, detalle por `obtener_prediccion_visible`, feed premium/free y validacion de usuario gratis/premium/admin sin cambiar contrato.

### Alternativa B: Otro Proveedor

Requisitos minimos: fixtures futuros, IDs estables, liga, temporada, equipos, fecha con zona horaria, estados, resultados, uso permitido para el producto, documentacion estable y trazabilidad de fuente.

Impacto tecnico: el esquema actual codifica nombres API-Football (`api_football_fixture_id`, `api_football_league_id`, `football_*`). Usar otro proveedor sin rediseñar generaria ambiguedad y riesgo de colision. Un diseno correcto deberia introducir `provider`, `external_fixture_id`, restricciones unicas por proveedor, posible tabla de correspondencias, migracion de datos, adaptacion RPC/frontend/scripts y compatibilidad con datos historicos API-Football.

No integrar proveedores nuevos ni hacer llamadas externas hasta aprobar un diseno multi-proveedor.

### Alternativa C: Predicciones Manuales Por `partido_id`

Diseno preliminar seguro, no aplicado:

1. Cambiar la identidad logica de `model_predictions` para admitir `api_football_fixture_id` o `partido_id`, sin filas huerfanas.
2. Mantener `api_football_fixture_id` nullable pero unico cuando exista, con FK a `football_fixtures`.
3. Hacer `partido_id` nullable pero unico cuando exista, con FK a `partidos(id)`.
4. Agregar check: al menos uno de `api_football_fixture_id` o `partido_id` debe existir.
5. Mantener RPC actual `obtener_prediccion_visible(bigint)` para fixtures API.
6. Agregar RPC nueva por identificador interno, por ejemplo `obtener_prediccion_visible_por_partido(p_partido_id text)`.
7. Ajustar `obtener_predicciones_visibles()` para devolver ambos identificadores y permitir join por fixture o partido.
8. Adaptar frontend: listados, detalle `/partidos/:partidoId`, admin y mappers deben buscar por `partido_id` cuando no exista fixture API.
9. Adaptar `scripts/publicar_predicciones_v1_mvp.py` con `--partido-id` explicito, validacion de fecha futura, equipos, historico suficiente, duplicado por partido y no sobrescritura por defecto.
10. Incluir rollback con migracion inversa solo si no existen filas manuales o migrandolas a fixture externo real.
11. Mantener RLS/RPC de premium como fuente de seguridad; no exponer service role al frontend.
12. Agregar pruebas unitarias y de RPC para free, premium, admin, duplicados, V1, payload invalido y secretos no impresos.

No usar `partido_id` sin FK ni restriccion unica.

### Comparacion Cualitativa

| Criterio | API-Football actual | Otro proveedor | `partido_id` manual |
| --- | --- | --- | --- |
| Coste tecnico | Bajo | Alto | Medio/alto |
| Riesgo | Bajo/medio | Alto | Medio/alto |
| Tiempo relativo | Bajo si el plan da acceso | Alto | Medio |
| Mantenimiento | Bajo/medio | Alto | Medio |
| Dependencia externa | Alta | Alta | Baja/media |
| Compatibilidad actual | Alta | Baja/media | Media |
| Operar sin pago | Baja para temporada actual | Desconocida | Media |
| Trazabilidad | Alta | Depende del proveedor | Media si se exige fuente verificable |
| Seguridad | Alta con contrato actual | Depende de rediseño | Alta si se migra con FK/RLS/RPC |
| Impacto frontend | Bajo | Alto | Medio/alto |
| Impacto Supabase | Bajo | Alto | Alto |
| Impacto scripts V1 | Bajo | Alto | Medio |

Recomendacion principal: mantener API-Football y habilitar acceso a temporada actual para el MVP. Alternativa secundaria: disenar e implementar soporte manual por `partido_id` como respaldo controlado, solo con migracion explicita y pruebas. Otro proveedor queda como evaluacion futura si API-Football no es viable comercial u operativamente.

### Partidos Vencidos Con Estado Proximo

Consulta segura para detectar inconsistencias sin modificar datos:

```sql
select id, torneo, fecha_orden, local_nombre, visitante_nombre, estado, api_football_fixture_id, origen_datos, fuente_detalle
from public.partidos
where estado = 'proximo'
  and fecha_orden < now()
  and api_football_fixture_id is null
  and goles_local_final is null
  and goles_visitante_final is null
order by fecha_orden asc;
```

Correccion recomendada: revisar la fuente real desde `/admin/partidos` o SQL administrativo controlado. Si el partido se jugo, registrar resultado real y cerrarlo; si fue cancelado, marcar `cancelado`; si la fecha era incorrecta, actualizarla solo con fuente verificable. No borrar registros ni inventar resultados.

Decision pendiente del propietario: confirmar si se habilita plan/API-Football para temporada actual o si se prioriza una migracion formal para soporte manual por `partido_id`.

## 19. Fase 7J - Preflight API-Football Temporada Actual

Se agrego el comando conservador:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_acceso_api_football.py --dry-run
```

Propiedades:

- No escribe en Supabase.
- Ejecuta como maximo 1 request por corrida.
- No imprime `FOOTBALL_API_KEY` ni secretos.
- Clasifica acceso permitido, temporada fuera del plan, clave invalida, cuota/rate limit, cero fixtures validos, errores de red y respuesta malformada.
- No clasifica una respuesta valida sin fixtures como falta de acceso.

Configuracion inspeccionada sin exponer valores:

| Variable | Estado |
| --- | --- |
| `FOOTBALL_API_PROVIDER` | `api_football` |
| `FOOTBALL_API_KEY` | Presente en `prediction-service/.env` |
| `FOOTBALL_API_BASE_URL` | `https://v3.football.api-sports.io` |
| Frontend `VITE_*` | No contiene clave privada de API-Football |
| Git ignore | `.env`, `prediction-service/.env`, `predigol-web/.env` y `.env.local` ignorados |

Liga seleccionada para preflight: La Liga (`league=140`, `season=2025`, `next=3`). Motivo: es la liga con mas historico real disponible para V1 en Supabase dentro del dataset actual y esta incluida en `football_competitions`.

Resultado 7J:

```json
{
  "status": "season_not_in_plan",
  "reason": "temporada no incluida en el plan actual",
  "request": {"league": 140, "season": 2025, "next": 3},
  "requests_count_por_corrida": 1,
  "requests_reales_fase_7j": 2,
  "raw_count": 0,
  "future_fixtures": 0
}
```

No se ejecuto importacion con `--apply`, no se modifico Supabase, no se generaron predicciones y no se publicaron filas en `model_predictions`.

Siguiente accion: revisar en la cuenta de API-Football/API-Sports el plan necesario para acceder a temporada actual de las ligas MVP. Una vez habilitado, repetir `verificar_acceso_api_football.py --dry-run`, luego importar entre 2 y 5 fixtures con dry-run previo y validar `publicar_predicciones_v1_mvp.py --dry-run` antes de cualquier publicacion.

## 20. Fase 8A - Despliegue Seguro Sin Fixtures Actuales

PrediGol puede desplegar el frontend y operar autenticacion/RLS aunque no existan fixtures actuales ni predicciones proximas. Esta situacion debe comunicarse como limitacion temporal de datos, no como error del usuario.

### Componentes Desplegables Ahora

| Componente | Estado | Nota |
| --- | --- | --- |
| Frontend Vite | Listo si variables publicas estan configuradas | Root recomendado `predigol-web`, build `npm run build`, salida `dist`. |
| Supabase Auth/RPC/RLS | Listo segun verificadores | Requiere configurar dominios y redirect URLs en dashboard. |
| Scripts Python de verificacion | Listos local/runner privado | No usar service role en frontend. |
| Publicador V1 | Preparado, bloqueado para `--apply` | Sin fixtures futuros reales no hay publicacion. |
| Sync/API-Football cron | Bloqueado | No activar mientras el plan no permita temporada actual. |
| Edge Functions existentes | Desplegables solo si se decide operarlas | No invocar sync real sin fuente habilitada y monitoreo de cuota. |

### Matriz De Variables

| Variable | Clasificacion | Obligatoria | Componente | Estado/Riesgo |
| --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend publica | Si | Vite/Supabase client | Publica; no es secreto. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend publica | Si, salvo `VITE_SUPABASE_ANON_KEY` | Vite/Supabase client | Publica; nunca usar service role. |
| `VITE_SUPABASE_ANON_KEY` | Frontend publica legacy | Opcional alternativa | Vite/Supabase client | Publica; no usar claves secretas de Supabase. |
| `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` | Frontend publica | Opcional | Push web | Publica. |
| `SUPABASE_URL` | Backend secreta/privada operativa | Si para scripts | Python/verificadores | No exponer en frontend si se combina con service role. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend secreta critica | Si para scripts admin | Python/verificadores/importadores | Nunca `VITE_*`; rotar si se expone. |
| `SUPABASE_ANON_KEY` | Solo pruebas locales/autenticadas | Si para `verificar_roles_supabase.py` | Verificador autenticado | Publica, pero no documentar valores reales. |
| `FOOTBALL_API_KEY` | Backend secreta bloqueada temporalmente | Opcional mientras no se consulta API | Importadores/API-Football | No usar hasta plan habilitado; no exponer en frontend. |
| `API_FOOTBALL_KEY` | Backend secreta legacy bloqueada | Opcional | Edge/scripts legacy | Mantener fuera de frontend. |
| `PREDIGOL_TEST_*_EMAIL` | Solo pruebas locales | Opcional | Verificador roles | No incluir en `.env.example`; no commitear. |
| `PREDIGOL_TEST_*_PASSWORD` | Solo pruebas locales secreta | Opcional | Verificador roles | No incluir en `.env.example`; rotar si se expone. |

### Preflight De Despliegue

Ejecutar desde la raiz:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_despliegue_predigol.py
```

El preflight verifica archivos, Python, Node, variables, ausencia de secretos obvios en `VITE_*`, conectividad Supabase si esta configurada, tablas/RPC principales, estado de fixtures y predicciones. No consulta API-Football, no escribe en Supabase, no aplica migraciones y no imprime secretos.

Estados esperados sin fixtures actuales:

- Frontend listo: puede ser `true` con variables publicas configuradas.
- Operacion autenticada lista: requiere Supabase/RPC accesibles.
- Predicciones en vivo listas: debe permanecer `false` hasta tener fixtures reales actuales.

### Configuracion Frontend En Hosting

- Directorio raiz: `predigol-web` si el proveedor permite monorepo. Si se despliega desde la raiz, usar la configuracion `vercel.json` existente y apuntar el build al subproyecto segun el proveedor.
- Instalacion: `npm ci`.
- Build: `npm run build`.
- Salida: `dist`.
- SPA fallback: `vercel.json` reescribe `/(.*)` a `/index.html`.
- HTTPS obligatorio.
- No configurar `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_API_KEY`, JWT ni contrasenas en variables frontend.

### Supabase Auth Produccion

Configurar manualmente en Supabase Dashboard:

1. `Site URL` con el dominio HTTPS de produccion.
2. `Redirect URLs` para dominio de produccion y dominios de preview/desarrollo autorizados.
3. URL local de desarrollo si se usara QA local (`http://localhost:5173` o la que corresponda).
4. Confirmacion de correo y recuperacion de contrasena segun politica del producto.
5. OAuth solo si ya esta implementado y probado.
6. Probar login, logout, rutas protegidas, redireccion post-login y recuperacion de contrasena.

No cambiar estos valores por SQL ni API desde scripts automatizados.

### Scripts Permitidos Y Bloqueados

Permitidos ahora:

- `scripts/verificar_despliegue_predigol.py`.
- `scripts/verificar_supabase_mvp.py` si se cuenta con credenciales y se acepta lectura/RPC sin escritura.
- `scripts/verificar_python.py`.
- `python -m pytest prediction-service/tests`.
- `npm test`, `npm run lint`, `npm run build`.
- Checks estaticos y dry-runs que no consulten API-Football.

Bloqueados o condicionados:

- `scripts/verificar_acceso_api_football.py` salvo autorizacion expresa, porque consume una request API-Football.
- Importaciones o sincronizaciones reales, especialmente cualquier `--apply`, `--confirm` o Edge Function `sync-live-fixtures`.
- `scripts/publicar_predicciones_v1_mvp.py --apply`.
- Crons externos y sincronizaciones recurrentes.
- `scripts/verificar_roles_supabase.py` en automatizacion no interactiva: intenta escrituras controladas para validar RLS, por lo que debe ejecutarse manualmente solo cuando se acepte esa validacion.

### CI

El workflow `.github/workflows/ci.yml` ejecuta Python 3.11 y Node 22 sin secretos, sin Supabase real y sin API-Football. Solo instala dependencias, corre pruebas, lint y build.

### Rollback Frontend

1. Revertir al despliegue anterior desde el proveedor de hosting.
2. Mantener variables publicas previas.
3. Invalidar cache si aplica.
4. Reejecutar smoke test de `/`, `/auth`, `/inicio`, `/pronosticos`, `/perfil` y rutas admin con usuario autorizado.

### Habilitar Fixtures En El Futuro

Cuando exista fuente valida:

1. Autorizar una consulta controlada de `scripts/verificar_acceso_api_football.py --dry-run`.
2. Ejecutar dry-run de importacion con fuente verificable.
3. Importar solo 2 a 5 fixtures reales.
4. Validar Supabase y `scripts/publicar_predicciones_v1_mvp.py --dry-run`.
5. Publicar V1 en fase separada, nunca desde frontend.
