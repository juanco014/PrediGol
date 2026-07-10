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

## Fases posteriores

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
