# Roadmap PrediGol

Este roadmap prioriza el cierre del MVP freemium como producto. V1 queda como modelo principal de produccion; V2 queda experimental. No se deben cambiar defaults de V2 ni agregar reglas nuevas de modelo para cerrar estas tareas.

## Prioridad alta

| Tarea | Estado recomendado | Archivos/modulos relacionados | Criterios de aceptacion |
| --- | --- | --- | --- |
| Definir matriz gratis vs premium. | Pendiente | `predigol-web/src/pages/*`, Supabase policies futuras, docs producto | Documento aprobado con que ve visitante, gratis, premium y admin. |
| Proteger contenido premium server-side. | Pendiente critico | Supabase migrations futuras, RPCs, servicios frontend | Ningun dato premium depende solo de ocultamiento en React. |
| Mantener V1 como modelo de produccion. | Decidido | `prediction-service/predigol_model/poisson_elo.py`, `run.py` | Predicciones operativas usan V1 por defecto y registran version. |
| Congelar V2 como experimental. | Decidido | `v2.py`, `comparative_backtest.py`, docs validacion | V2 no se promociona ni cambia defaults. |
| Cerrar flujo base de pronosticos V1. | Hecho parcial | `scripts/generar_pronosticos.py`, `predigol-web/src/pages/PronosticosPage.jsx`, `model_predictions` | Dataset/API puede alimentar predicciones V1 y la UI muestra pronosticos del modelo; premium real queda pendiente. |
| Ampliar datasets multi-liga. | En progreso | `scripts/importar_ligas_temporadas.py`, `reports/`, `docs/importing-seasons.md` | Datasets para varias ligas/temporadas disponibles y validados. |
| Ejecutar backtest multi-liga. | Pendiente operativo | `scripts/backtest_v1_v2.py`, `comparative_backtest.py` | Reporte con agregado, liga, temporada, dataset y metricas Brier/log-loss/accuracy/ECE. |
| Cerrar disclaimer legal/informativo. | Pendiente | Landing, pronosticos, detalle partido | Mensaje visible: pronosticos informativos, no garantizan resultados. |
| Auditar rutas admin y permisos. | Pendiente | `AdminPartidosPage.jsx`, `ModelAdminPage.jsx`, `predigol_es_admin`, RLS | Usuario no admin no puede ejecutar acciones administrativas. |
| Consolidar runbook operativo. | Pendiente | `docs/importing-seasons.md`, `docs/validacion-modelos-reales.md`, `docs/model-admin.md` | Pasos claros para importar, preflight, predecir, backtestear y revisar errores. |
| Revisar QA de rutas principales. | Pendiente | `predigol-web/src/App.jsx`, pages principales | Home, pronosticos, detalle, ligas, ranking, perfil y admin cargan sin errores en desktop/mobile. |

## Prioridad media

| Tarea | Estado recomendado | Archivos/modulos relacionados | Criterios de aceptacion |
| --- | --- | --- | --- |
| Mejorar cola de alias de equipos. | Parcial | `team_aliases`, `team_normalization.py`, `ModelAdminPage.jsx` | Admin puede revisar, aprobar y desactivar aliases con trazabilidad. |
| Estandarizar model runs/datasets en admin. | Parcial | `model_runs`, `model_datasets`, `traceability.py` | Admin ve fecha, fuente, checksum, estado, metricas y warnings. |
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
3. Validar seguridad admin y acceso premium server-side antes de monetizar.
4. Ampliar datasets multi-liga y ejecutar backtests reproducibles.
5. Congelar V1 como produccion y V2 como experimental.
6. Hacer QA completo de rutas principales.
7. Documentar runbook de operacion.
8. Solo despues, implementar pagos con webhooks y RLS.

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
