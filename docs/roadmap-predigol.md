# Roadmap PrediGol

Este roadmap prioriza el cierre del MVP freemium como producto. V1 queda como modelo principal de produccion; V2 queda experimental. No se deben cambiar defaults de V2 ni agregar reglas nuevas de modelo para cerrar estas tareas.

## Prioridad alta

| Tarea | Estado recomendado | Archivos/modulos relacionados | Criterios de aceptacion |
| --- | --- | --- | --- |
| Definir matriz gratis vs premium. | Hecho MVP | `docs/freemium-y-premium-predigol.md`, `docs/entrega-mvp-predigol.md` | Visitante, gratis, premium manual y admin tienen alcance documentado. |
| Proteger contenido premium server-side. | Hecho MVP | `202607100001_freemium_premium_access.sql`, RPCs, `footballApi.js`, `adminApi.js` | Predicciones premium usan RLS/RPC; pagos reales quedan pendientes. |
| Mantener V1 como modelo de produccion. | Decidido | `prediction-service/predigol_model/poisson_elo.py`, `run.py` | Predicciones operativas usan V1 por defecto y registran version. |
| Congelar V2 como experimental. | Decidido | `v2.py`, `comparative_backtest.py`, docs validacion | V2 no se promociona ni cambia defaults. |
| Cerrar flujo base de pronosticos V1. | Hecho parcial | `scripts/generar_pronosticos.py`, `predigol-web/src/pages/PronosticosPage.jsx`, `model_predictions` | Dataset/API puede alimentar predicciones V1 y la UI muestra pronosticos del modelo; premium real queda pendiente. |
| Cerrar experiencia gratuita frontend. | Hecho parcial | `LandingPage.jsx`, `PronosticosPage.jsx`, `PartidoDetailPage.jsx`, `footballApi.js` | Usuario entiende propuesta, ve pronosticos, filtra, abre detalle y ve aviso responsable; pagos siguen pendientes. |
| Preparar base freemium segura. | Hecho parcial | `user_subscriptions`, `subscription_plans`, `model_predictions.access_tier` | Gratis/premium diferenciado por Supabase; premium manual/admin hasta integrar pasarela. |
| Ampliar datasets multi-liga. | En progreso | `scripts/importar_ligas_temporadas.py`, `reports/`, `docs/importing-seasons.md` | Datasets para varias ligas/temporadas disponibles y validados. |
| Ejecutar backtest multi-liga. | Pendiente operativo | `scripts/backtest_v1_v2.py`, `comparative_backtest.py` | Reporte con agregado, liga, temporada, dataset y metricas Brier/log-loss/accuracy/ECE. |
| Cerrar disclaimer legal/informativo. | Pendiente | Landing, pronosticos, detalle partido | Mensaje visible: pronosticos informativos, no garantizan resultados. |
| Auditar rutas admin y permisos. | Hecho parcial | `AdminDashboardPage.jsx`, `AdminPartidosPage.jsx`, `ModelAdminPage.jsx`, `predigol_es_admin`, RLS | `/admin` centraliza operacion; usuario no admin ve acceso denegado y datos sensibles dependen de RLS/RPC. |
| Consolidar runbook operativo. | Hecho parcial | `docs/admin-predigol.md`, `docs/importing-seasons.md`, `docs/validacion-modelos-reales.md` | Pasos claros para importar, predecir, backtestear y revisar premium; automatizacion backend queda pendiente. |
| Revisar QA de rutas principales. | Documentado para entrega | `predigol-web/src/App.jsx`, `docs/entrega-mvp-predigol.md` | Checklist manual cubre visitante, usuario gratis, admin y seguridad. |
| Endurecer headers HTTP en Render. | Implementacion 8G completada, pendiente redespliegue | `render.yaml`, `docs/auditoria-fase8g-predigol.md` | CSP conservadora, framing bloqueado, Referrer/Permissions Policy configuradas; validacion publica requiere redeploy. |

## Prioridad media

| Tarea | Estado recomendado | Archivos/modulos relacionados | Criterios de aceptacion |
| --- | --- | --- | --- |
| Mejorar cola de alias de equipos. | Parcial | `team_aliases`, `team_normalization.py`, `ModelAdminPage.jsx` | Admin puede revisar, aprobar y desactivar aliases con trazabilidad. |
| Estandarizar model runs/datasets en admin. | Hecho parcial | `model_runs`, `model_datasets`, `traceability.py`, `/admin`, `/admin/modelo` | Admin ve fecha, fuente, estado, metricas y warnings; detalle profundo puede ampliarse. |
| Revisar notificaciones push. | Parcial | `web_push_*`, hooks push, Edge Functions | Suscripcion/desuscripcion y dispatch funcionan con secretos seguros. |
| Revisar rankings. | Parcial | `ranking*.js`, RPCs ranking | Ranking global/liga/segmentado usa datos reales y maneja estados vacios. |
| Definir historico para usuarios. | Pendiente | `PartidoDetailPage.jsx`, `EstadisticasPage.jsx`, Supabase | Usuario ve historico acorde a plan, con resultados y aciertos. |
| Reducir dependencia de reportes locales para decisiones. | Parcial | `reports/`, `model_runs`, docs | Reportes locales no se commitean; resultados canonicos se registran o documentan. |
| Completar pruebas frontend relevantes. | Parcial | `predigol-web/src/**/*.test.js` | Servicios, mappers y utilidades criticas cubiertos; build/lint limpios. |
| Monitorear errores de cliente. | Parcial | `app_error_logs`, `errorMonitoring.js` | Admin revisa errores y hay criterio de severidad. |

## Prioridad futura

| Tarea | Estado recomendado | Archivos/modulos relacionados | Criterios de aceptacion |
| --- | --- | --- | --- |
| Integrar pasarela de pagos. | Futuro | Migraciones futuras, Edge Functions, proveedor pago | Webhooks seguros actualizan suscripciones; no hay validacion solo frontend. |
| Automatizar cron de API-Football pago. | Futuro condicionado | `sync-live-fixtures`, config API sync | Activar solo con plan API confirmado y monitoreo de cuota. |
| Promocionar una variante V2 si la evidencia mejora. | Futuro condicionado | `comparative_backtest.py`, docs validacion | V2 supera consistentemente a V1 en Brier/log-loss multi-liga y sin degradar calibracion. |
| Personalizacion avanzada. | Futuro | Favoritos, preferencias, notificaciones | Recomendaciones por usuario sin afectar seguridad premium. |
| Analitica premium avanzada. | Futuro | Estadisticas, tendencias, historico | Valor premium claro y datos confiables. |
| App/PWA avanzada. | Futuro | `public/manifest`, `sw.js`, push | Experiencia offline/push validada en dispositivos reales. |

## Secuencia recomendada

1. Cerrar definicion de producto freemium y disclaimer.
2. Mantener el flujo base de pronosticos V1 documentado en `docs/flujo-pronosticos-predigol.md`.
3. Mantener la experiencia gratuita documentada en `docs/experiencia-usuario-predigol.md`.
4. Mantener la base freemium segura documentada en `docs/freemium-y-premium-predigol.md`.
5. Mantener el panel admin operativo documentado en `docs/admin-predigol.md`.
6. Ampliar datasets multi-liga y ejecutar backtests reproducibles.
7. Congelar V1 como produccion y V2 como experimental.
8. Hacer QA completo de rutas principales.
9. Automatizar runbook de operacion con backend seguro cuando sea necesario.
10. Solo despues, implementar pagos con webhooks y RLS.

## Fase 5: estabilizacion final

La Fase 5 deja el MVP en estado entregable: documentacion de entrega, checklist de despliegue, revision de rutas principales, seguridad basica, scripts operativos y pruebas obligatorias. No incluye pagos reales, tuning de modelos, cambios en V1/V2 ni migraciones nuevas.

## Fase 6: preparacion de despliegue

Estado: completada a nivel de repositorio y documentacion; pendiente QA manual contra Supabase definitivo si las credenciales reales no estan configuradas localmente.

Entregables:

| Entregable | Estado |
| --- | --- |
| Variables reales documentadas | Hecho en `docs/configuracion-entorno-predigol.md`. |
| Checklist Supabase real | Hecho en `docs/checklist-despliegue-predigol.md`. |
| Runbook despliegue | Hecho en `docs/despliegue-predigol.md`. |
| QA manual navegador | Hecho en `docs/qa-despliegue-predigol.md`. |
| Admin inicial seguro | Documentado con SQL controlado; auto-elevacion no se expone en UI. |
| V1 produccion / V2 experimental | Mantenido. |

## Fase 7: QA real post-despliegue

Estado: parcial. La validacion automatizada local paso, pero la validacion contra Supabase definitivo queda pendiente porque este workspace no tiene variables locales completas para frontend ni service role del servicio Python.

| Validacion | Estado |
| --- | --- |
| Tests frontend/lint/build | Hecho. |
| Preview produccion local | Hecho. |
| Tests Python | Hecho. |
| Dataset real local liga 39 temporada 2024 | Disponible. |
| Pronosticos V1 locales | Ya generados, no sobrescritos. |
| Supabase real/RLS/RPC | Pendiente por credenciales locales. |
| Usuario gratis/admin/premium en navegador | Pendiente por variables frontend. |

### Fase 7B

Estado: bloqueada por configuracion local incompleta. Se confirmo que los `.env` reales estan ignorados, pero `predigol-web/.env.local` no existe y `prediction-service/.env` no declara `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`. Tambien se reemplazaron valores reales encontrados en `.env.example` por placeholders.

Pendiente antes de repetir 7B:

- Crear `predigol-web/.env.local` con variables publicas reales.
- Completar `prediction-service/.env` con Supabase URL y service role reales.
- Rotar claves si las detectadas en `.env.example` fueron expuestas previamente.
- Repetir QA contra Supabase real con usuario gratis, admin y premium manual.

Reejecucion con credenciales: parcial. Supabase conecta desde Python y existen `profiles`/`model_predictions`, pero faltan o no estan expuestas tablas/RPC de admin/freemium. Siguiente paso: aplicar/verificar migraciones del MVP en Supabase definitivo antes de validar usuarios, premium y admin.

### Fase 7C

Estado: pendiente de aplicar migraciones en Supabase real. Se creo `scripts/verificar_supabase_mvp.py` y se confirmo que el repo contiene las migraciones necesarias, pero la instancia real solo expone `profiles` y `model_predictions`. No se aplicaron migraciones automaticamente porque Supabase CLI no esta instalado en este entorno.

Siguiente paso recomendado: aplicar migraciones pendientes con backup previo, sin `db reset`, y reejecutar `scripts/verificar_supabase_mvp.py` hasta que tablas/RPC admin-freemium esten OK.

### Fase 7D

Estado: pendiente. Se verifico Supabase despues de migraciones manuales, pero las tablas/RPC admin-freemium siguen faltando o sin exponerse por REST. Se creo `202607100002_refresh_mvp_grants.sql` para corregir grants y recargar schema cache si los objetos ya existen. No se aplico automaticamente.

Pendiente: confirmar existencia de objetos en `public`, aplicar migraciones/grants faltantes y validar usuarios reales.

### Fase 7E

Estado: completada para autenticacion, roles, suscripciones y RLS. Se agrego validacion autenticada con sesiones reales de Supabase Auth para usuario gratis, premium y admin en `scripts/verificar_roles_supabase.py`, mas pruebas unitarias con mocks. La documentacion de QA incluye preparacion manual segura de usuarios, SQL idempotente y matriz de navegador.

Resultado validado:

- Usuario gratis: login real, plan free, premium false, sin admin, escrituras administrativas bloqueadas.
- Usuario premium: login real, plan premium, suscripcion vigente, premium true, sin admin, escrituras administrativas bloqueadas.
- Usuario admin: login real, perfil admin, `predigol_es_admin()=true`, lectura administrativa permitida, escrituras directas del modelo bloqueadas.
- Pendiente no bloqueante: contenido premium bloqueado/desbloqueado queda `PENDIENTE DATOS` porque no hay predicciones premium reales.

### Fase 7F

Estado: preparada, pendiente de fixtures reales. Se agrego `scripts/publicar_predicciones_v1_mvp.py` para publicar una muestra controlada de predicciones reales exclusivamente V1 cuando existan partidos proximos reales en Supabase.

Resultado del diagnostico:

- Supabase tiene 226 historicos reales finalizados con marcador, suficientes para entrenar V1.
- Supabase tiene 0 partidos proximos con `api_football_fixture_id` y 0 `football_fixtures` futuros.
- Reportes locales contienen datasets reales finalizados de 2022, 2023 y 2024, sin fixtures futuros.
- API-Football fue consultado una vez para liga 239 temporada 2026 y el plan actual no permite esa temporada.
- No se ejecuto `--apply`; no se publicaron predicciones.

Cierre de 7F requiere cargar u obtener fixtures reales proximos, ejecutar dry-run valido, publicar al menos una prediccion V1 `free` y una `premium`, y validar gratis/premium/admin.

### Fases 7G, 7H y 7I

Estado: bloqueadas para publicacion real hasta resolver la fuente de fixtures actuales. En 7G se preparo `scripts/importar_fixtures_proximos_mvp.py` para importar fixtures proximos reales desde una fuente explicita y verificable, pero no se ejecuto `--apply` porque no habia fixtures compatibles. API-Football Free rechazo temporada 2026 con el mensaje de plan que indica acceso solo a 2022-2024.

En 7H se verifico que el contrato actual de predicciones requiere `model_predictions.api_football_fixture_id`: es `bigint`, primary key y foreign key a `football_fixtures`. `partido_id` es nullable y auxiliar; `obtener_prediccion_visible()` recibe exclusivamente `api_football_fixture_id`; el frontend tambien identifica predicciones por fixture API. Por eso no se habilito publicacion V1 solo por `partido_id`.

Alternativas evaluadas para 7I:

| Alternativa | Estado | Riesgo | Nota |
| --- | --- | --- | --- |
| Mantener API-Football y habilitar temporada actual | Recomendada para MVP | Bajo/medio | El proyecto ya tiene tablas, Edge Function, cron, monitor, importadores, publicador V1, RPC y frontend alineados al identificador API-Football. Requiere revisar manualmente plan, precios y limites en la cuenta del proveedor. |
| Incorporar otro proveedor de fixtures | Secundaria futura | Alto | Requiere modelo multi-proveedor: `provider`, `external_fixture_id`, compatibilidad, migracion o tabla de correspondencias, y ajustes en Supabase/frontend/scripts. No integrar sin diseno formal. |
| Redisenar contrato para `partido_id` manual | Respaldo arquitectonico | Medio/alto | Puede servir como contingencia operativa, pero necesita migracion explicita con FK a `partidos`, restricciones unicas por fixture externo y partido interno, RPC por partido y adaptacion frontend. No usar `partido_id` sin FK ni unique. |

Recomendacion de 7I: para cerrar el MVP, mantener API-Football y habilitar acceso a temporada actual. Como alternativa secundaria, disenar soporte manual por `partido_id` con migracion formal solo si el propietario decide operar fixtures manuales reales como respaldo. No marcar ninguna alternativa como implementada hasta tomar esa decision.

Limpieza pendiente: existe un partido manual con estado `proximo`, sin fixture externo y fecha pasada. No se debe borrar ni modificar automaticamente; debe corregirse desde el panel admin o mediante accion administrativa controlada, marcandolo `finalizado` con resultado real, `cancelado`, o actualizando fecha solo si hay fuente verificable.

### Fase 7J

Estado: bloqueada por acceso del plan API-Football. Se agrego `scripts/verificar_acceso_api_football.py` para hacer preflight conservador sin escritura y sin imprimir secretos. La configuracion local tiene `FOOTBALL_API_KEY` presente, proveedor `api_football` y host `https://v3.football.api-sports.io`; la clave esta en `prediction-service/.env`, ignorado por Git, y no se expone en frontend.

Liga evaluada: La Liga (`league=140`, `season=2025`, `next=3`), seleccionada porque es la liga con mas historico real en Supabase para V1 dentro del dataset actual (`34` partidos finalizados en 2024) y ya existe en `football_competitions`.

Resultado del acceso: API-Football devolvio `season_not_in_plan` / `temporada no incluida en el plan actual`. En 7J se consumieron 2 solicitudes reales de preflight: una explicita con `--league 140 --season 2025 --next 3` y otra mediante el comando de validacion default `--dry-run`. No se obtuvieron fixtures, no se importo nada y no se ejecuto publicacion V1.

Siguiente accion: el propietario debe habilitar en API-Football un plan con acceso a temporada actual o indicar otra temporada/liga vigente permitida. No intentar eludir restricciones del proveedor ni usar temporadas historicas como si fueran actuales.

## Fases posteriores

### Fase 8J

Estado: `COMPLETADA — DESPLIEGUE, SEGURIDAD Y ROLES VALIDADOS`.

El cierre tecnico de Etapa 8 audito Git, documentos pendientes, consistencia 8F-8I, rutas publicas, headers, assets, secretos y pruebas seguras. La validacion frontend se ejecuto desde clon limpio fuera de OneDrive sobre `9d3272f`: `npm ci`, `npm test`, `npm run lint` y `npm run build` pasaron; Python paso con 172 tests. El incidente `EPERM` del worktree original queda clasificado como bloqueo de entorno local, no regresion del producto. No se modifico Supabase y no se ejecuto API-Football.

### Fase 8I

Estado: `COMPLETADA — ROLES AUTENTICADOS VALIDADOS`.

La fase de smoke test autenticado por roles fue ejecutada manualmente por el propietario del proyecto. Usuario gratuito, usuario premium y administrador validaron login, persistencia, logout, aislamiento entre cuentas, rutas por rol, Console y Network. La cuenta gratuita no accede a contenido premium ni administracion; la cuenta premium accede a premium sin administracion; la cuenta administradora accede a `/admin`, `/admin/modelo` y `/admin/partidos`. No se guardaron credenciales, no se modifico Supabase y no se ejecuto API-Football. Recuperacion de contrasena sigue pendiente de producto.

### Fase 8H

Estado: `COMPLETADA — HEADERS Y DESPLIEGUE PÚBLICO VALIDADOS`.

Los headers se aplicaron manualmente en el Static Site existente desde Render Dashboard. La URL publica original `https://predigol.onrender.com` se conserva, no se creo un servicio duplicado y las rutas publicas principales responden con CSP, Referrer Policy, X-Frame-Options, Permissions Policy, HSTS y `nosniff`. `render.yaml` permanece como configuracion versionada, pero no se confirmo todavia administracion mediante Blueprint. La validacion autenticada de usuario gratuito, premium y administrador fue resuelta posteriormente en Fase 8I.

### Fase 8G

Estado: `IMPLEMENTACIÓN COMPLETADA — VALIDACIÓN PÚBLICA PENDIENTE DE REDESPLIEGUE`.

Se agrego `render.yaml` como mecanismo versionado para Render Static Site con headers de seguridad y rewrite SPA. La CSP permite solo origen propio, Supabase publico real, Realtime por WebSocket y logos de `media.api-sports.io`. No se habilito `unsafe-eval`, no se habilito `unsafe-inline` y no se agregaron comodines amplios.

Pruebas locales 8G: `npm test`, `npm run lint`, `npm run build` y preview local pasaron. La validacion publica de headers fue resuelta en 8H mediante aplicacion manual en Render Dashboard, sin confirmar adopcion Blueprint. La validacion autenticada de usuario gratuito, premium y administrador fue resuelta posteriormente en 8I y no debe automatizarse con credenciales reales.

### Fase 8A

Estado: preparada para despliegue seguro sin fixtures actuales. Se agrego preflight de despliegue, CI sin secretos y documentacion operativa para mantener API-Football, importaciones y publicacion V1 bloqueadas hasta contar con fuente valida. La falta de predicciones proximas queda como limitacion conocida de datos, no como fallo del frontend.

No se modifica V1 ni V2. No se marca prediccion en vivo como lista.

| Fase | Objetivo | Estado |
| --- | --- | --- |
| Fase 8 | Pagos reales, checkout server-side y webhooks. | Pendiente. |
| Fase 9 | Automatizacion backend/worker para importaciones y generacion programada. | Pendiente. |
| Fase 10 | Validacion multi-liga real ampliada, monitoreo y observabilidad. | Pendiente. |

## Criterios de cierre del MVP estable

| Criterio | Resultado esperado |
| --- | --- |
| Producto | Visitante, gratis, premium y admin tienen alcance definido. |
| Datos | Importacion/API y normalizacion documentadas y probadas. |
| Modelo | V1 produce pronosticos; V2 no afecta produccion. |
| Seguridad | Service role y API keys fuera del frontend; RLS revisado. |
| Premium | Si se habilita, acceso validado server-side. |
| Admin | Operacion basica sin tocar base manualmente para tareas comunes. |
| Validacion | Backtests multi-liga disponibles antes de decisiones de modelo. |
| UX | Rutas principales responsive y sin errores bloqueantes. |
| Legal | Advertencia de pronosticos informativos visible. |
| Tests | Suite Python y checks frontend criticos pasan. |
