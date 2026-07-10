# Levantamiento de requisitos PrediGol

## A. Objetivo del proyecto

PrediGol es una plataforma web freemium de pronosticos deportivos. Su objetivo de producto es ofrecer pronosticos informativos gratuitos y de pago, con una experiencia publica usable, una capa premium protegida, un panel administrativo y trazabilidad del origen de datos/modelos.

Los modelos estadisticos alimentan los pronosticos, pero el cierre del proyecto debe tratar PrediGol como producto completo: datos reales, predicciones, frontend, autenticacion, administracion, seguridad, pagos, documentacion, pruebas y operacion.

Los pronosticos son informativos y no garantizan resultados deportivos ni deben presentarse como promesa de acierto.

## B. Alcance del MVP

La primera version estable debe incluir:

| Area | Alcance MVP |
| --- | --- |
| Pronosticos | Mostrar partidos y pronosticos generados con V1 como modelo principal. |
| Acceso gratuito | Permitir una experiencia gratuita con partidos limitados, probabilidad 1X2 basica y ligas seleccionadas. |
| Autenticacion | Login/registro con Supabase Auth y rutas protegidas para la app. |
| Perfil | Perfil basico, preferencias y favoritos. |
| Datos | Importacion desde API-Football, normalizacion de equipos, datasets locales/Supabase y control de calidad. |
| Admin | Panel operativo para partidos, importacion/sincronizacion, datasets, model runs, alias y errores. |
| Modelos | V1 produccion; V2 experimental solo para comparacion interna. |
| Validacion | Backtests reproducibles con Brier, log-loss, accuracy y ECE cuando aplique. |
| Seguridad | RLS en Supabase, service role solo en servidor/scripts, contenido premium no protegido solo en frontend. |
| Documentacion | Guías de operacion, validacion, importacion, seguridad y roadmap. |

## C. Fuera de alcance inicial

| Item | Motivo |
| --- | --- |
| Tuning adicional de V2 | No hay evidencia suficiente y no se debe seguir optimizando solo Premier League 2022-2024. |
| Declarar V2 superior | V1 mantiene mejor referencia en Brier/log-loss en validaciones actuales. |
| Pasarela de pago completa | Debe diseñarse y protegerse antes de implementarse; no bloquear validacion tecnica del MVP gratuito. |
| Apuestas transaccionales | PrediGol entrega informacion; no debe operar apuestas. |
| Predicciones en vivo avanzadas | Requiere plan API, control de cuota y monitoreo adicional. |
| Recomendaciones personalizadas complejas | Puede quedar para fases posteriores despues de cerrar producto base. |

## D. Roles del sistema

| Rol | Descripcion | Capacidades esperadas |
| --- | --- | --- |
| Visitante | Usuario no autenticado. | Ver landing, propuesta de valor, aviso legal y CTA de registro/login. |
| Usuario gratuito | Usuario autenticado sin pago. | Ver pronosticos gratuitos limitados, ranking, perfil, favoritos basicos y ligas permitidas. |
| Usuario premium | Usuario autenticado con suscripcion activa. | Ver mas ligas/partidos, marcador probable, confianza, explicaciones, historico, tendencias, alertas y estadisticas ampliadas. |
| Administrador | Usuario con rol admin validado en Supabase. | Gestionar partidos, importaciones, datasets, model runs, alias, errores y configuraciones operativas. |

## E. Modulos actuales

| Modulo | Ruta/archivo | Estado | Observaciones |
| --- | --- | --- | --- |
| Landing | `predigol-web/src/pages/LandingPage.jsx`, `/` | Hecho | Puerta publica antes de login. |
| Auth | `AuthPage.jsx`, `/auth` | Hecho | Usa Supabase Auth desde frontend. |
| Home | `HomePage.jsx`, `/inicio` | Parcial | Ruta protegida; requiere confirmar contenido final gratis/premium. |
| Pronosticos | `PronosticosPage.jsx`, `/pronosticos` | Parcial | Existe UI; falta cerrar reglas comerciales de visibilidad premium. |
| Detalle de partido | `PartidoDetailPage.jsx`, `/partidos/:partidoId` | Parcial | Incluye explicaciones/estadisticas visuales; validar datos reales y gating premium. |
| Perfil | `ProfilePage.jsx`, `/perfil`, `useProfile.js`, `userAccountApi.js` | Parcial | Perfil y preferencias existen; falta suscripcion comercial. |
| Favoritos | `useFavorites.js`, `favorites.js`, tablas `user_favorite_*` | Parcial | Favoritos de equipos/competiciones con RLS. |
| Ranking | `RankingPage.jsx`, `ranking*.js`, RPCs de ranking | Hecho parcial | Ranking global/liga/segmentado preparado. |
| Ligas | `LigasPage.jsx`, `LigaDetailPage.jsx`, `privateLeaguesApi.js` | Parcial | Ligas y detalle existen; falta definir ligas gratis vs premium. |
| Estadisticas | `EstadisticasPage.jsx`, `useEstadisticasPrediGol.js` | Parcial | Analitica visible; validar fuente y alcance premium. |
| Notificaciones | `NotificacionesPage.jsx`, hooks push, tablas push | Parcial | Web push preparado; requiere operacion real y secretos VAPID. |
| Explorar | `ExplorarPage.jsx`, `FootballEntityPage.jsx` | Parcial | Exploracion por equipos/torneos. |
| Admin partidos | `AdminPartidosPage.jsx`, `/admin/partidos` | Parcial | Gestion manual/API, sync y monitoreo; debe auditar permisos admin en produccion. |
| Admin modelos | `ModelAdminPage.jsx`, `/admin/modelo` | Parcial | Datasets, model runs, alias y configuracion de modelo. |
| Prediction service V1 | `prediction-service/predigol_model/poisson_elo.py` | Hecho | Modelo principal recomendado. No modificar en cierre MVP. |
| Prediction service V2 | `prediction-service/predigol_model/v2.py` | Experimental | Defaults actuales no deben cambiar. |
| Backtest V1/V2 | `comparative_backtest.py`, `scripts/backtest_v1_v2.py` | Hecho parcial | Incluye diagnosticos Exp. 4-11; requiere mas datasets multi-liga. |
| Importacion API | `api_football_importer.py`, `importar_temporada_api.py`, `importar_ligas_temporadas.py` | Hecho parcial | Importacion local/API; confirmar cuotas y operacion Supabase. |
| Normalizacion equipos | `team_normalization.py`, `team_aliases` | Hecho parcial | Falta proceso operativo de revision de aliases. |
| Data quality | `data_quality.py` | Hecho | Reporta muestras pequenas, duplicados, temporadas mezcladas y warnings. |
| Trazabilidad | `traceability.py`, `model_datasets`, `model_runs` | Hecho parcial | Base tecnica existe; falta disciplina operativa. |
| Supabase funciones | `supabase/migrations/*.sql`, `supabase/functions/*` | Parcial | RLS/funciones presentes; faltan pagos/suscripciones comerciales. |
| Reportes | `reports/` | Operativo | Reportes generados no deben commitearse si estan ignorados. |
| Datos manuales | `manual-data/` | Soporte | Plantillas/demo para importaciones y pruebas. |

## F. Requisitos funcionales

| Codigo | Requisito | Estado actual | Criterio MVP |
| --- | --- | --- | --- |
| RF-01 | Importar partidos desde API. | Parcial | Importar ligas/temporadas, validar calidad, omitir duplicados y registrar trazabilidad. |
| RF-02 | Generar pronosticos con modelo principal. | Hecho parcial | V1 debe generar predicciones operativas y versionadas. |
| RF-03 | Mostrar pronosticos gratuitos. | Parcial | Definir limite de partidos/ligas y mostrar probabilidad 1X2 basica. |
| RF-04 | Restringir pronosticos premium. | Pendiente/parcial | La restriccion debe validarse en Supabase/backend, no solo UI. |
| RF-05 | Permitir login/registro. | Hecho | Supabase Auth operativo en frontend. |
| RF-06 | Permitir favoritos. | Parcial | Favoritos propios con RLS y UX estable. |
| RF-07 | Mostrar historico. | Parcial | Historico de partidos/resultados y aciertos disponible para usuarios segun plan. |
| RF-08 | Administrar datasets. | Parcial | Ver datasets, checksums, calidad y origen en admin. |
| RF-09 | Ejecutar backtests. | Hecho parcial | Scripts reproducibles; admin puede ver resultados sin editar modelos. |
| RF-10 | Comparar V1/V2 internamente. | Hecho | Comparacion interna sin promocionar V2. |
| RF-11 | Registrar version del modelo. | Hecho parcial | Guardar version/config en predicciones/model_runs/model_evaluations. |
| RF-12 | Mostrar estadisticas. | Parcial | Estadisticas claras, con fuente y alcance gratis/premium definido. |
| RF-13 | Manejar planes de pago. | Pendiente | Definir plan gratuito/premium y entidad de suscripcion. |
| RF-14 | Gestionar suscripcion del usuario. | Pendiente | Tabla, estado, expiracion, proveedor de pago y auditoria. |
| RF-15 | Proteger contenido premium. | Pendiente critico | Validacion server-side/RLS/RPC antes de mostrar datos premium. |
| RF-16 | Gestionar alias de equipos. | Parcial | Admin revisa pendientes antes de metricas definitivas. |
| RF-17 | Monitorear errores del frontend. | Parcial | `app_error_logs` y RPC existen; falta proceso de revision. |
| RF-18 | Enviar notificaciones. | Parcial | Web push preparado; confirmar secretos, permisos y dispatch. |

## G. Requisitos no funcionales

| Categoria | Requisito | Estado/observacion |
| --- | --- | --- |
| Seguridad | No exponer `SUPABASE_SERVICE_ROLE_KEY` ni API keys en Vite/navegador. | Documentado y verificado por tests estaticos. |
| RLS | Todas las tablas sensibles deben tener RLS y policies revisadas. | Varias tablas tienen RLS; pagos futuros deben incorporarlo desde el inicio. |
| Proteccion premium | El acceso premium no debe depender solo del frontend. | Pendiente critico. |
| Trazabilidad | Cada dataset/run/prediccion debe tener fuente, version y checksum cuando aplique. | Base tecnica existe. |
| Reproducibilidad | Backtests deben correr con datasets versionados y parametros visibles. | Parcial, con reportes y scripts. |
| Rendimiento | Frontend debe cargar rutas bajo lazy loading y evitar consultas excesivas. | Lazy loading presente; falta auditoria de consultas. |
| Disponibilidad | Edge functions/crons deben ser monitoreables. | Hay tablas de monitoreo API sync; falta runbook final. |
| Responsive design | La experiencia debe funcionar en mobile y desktop. | CSS/mobile existe; requiere QA final. |
| Manejo de errores | UI y scripts deben mostrar errores accionables sin secretos. | Parcial. |
| Documentacion | Operacion, seguridad, importacion, validacion y producto deben quedar documentados. | Se amplía con este documento y roadmap. |
| Pruebas automatizadas | Mantener tests Python y tests frontend existentes. | Python cubierto; frontend tiene node tests por servicios/utils. |

## H. Modelo de negocio freemium

Gratis:

| Capacidad | Definicion MVP propuesta |
| --- | --- |
| Partidos limitados | Mostrar una cuota diaria/semanal o partidos destacados. |
| Probabilidad 1X2 basica | Mostrar local/empate/visitante sin detalle avanzado. |
| Pronosticos destacados | Seleccion editorial/algoritmica limitada. |
| Ligas limitadas | Ligas principales o subconjunto definido. |
| Ranking basico | Acceso a ranking global basico. |

Premium:

| Capacidad | Definicion propuesta |
| --- | --- |
| Mas ligas | Acceso a ligas adicionales cuando existan datos confiables. |
| Mas partidos | Sin limite o limite superior. |
| Marcador probable | Mostrar score probable del modelo principal. |
| Confianza | Mostrar confianza/certeza con lenguaje prudente. |
| Explicacion | Explicar factores sin prometer acierto. |
| Historico | Ver historico de pronosticos/resultados. |
| Tendencias | Analitica de equipos/ligas y tendencias recientes. |
| Favoritos avanzados | Seguimiento de equipos/ligas favoritos. |
| Alertas | Notificaciones de partidos y pronosticos. |
| Estadisticas ampliadas | Panel de rendimiento y comparativas. |

Advertencia obligatoria: los pronosticos son informativos, probabilisticos y no garantizan resultados. PrediGol no debe incentivar decisiones financieras como si los aciertos estuvieran garantizados.

## I. Decision de modelos

| Decision | Estado |
| --- | --- |
| V1 como modelo principal | Recomendado para produccion. |
| V2 como experimental | Mantener solo para diagnostico/backtest interno. |
| No promocionar V2 | No hay evidencia suficiente para declararlo superior. |
| Defaults V2 | No cambiar hasta validacion multi-liga real. |
| Politica selectiva de empate | Debe seguir apagada por default. |
| Metricas principales | Priorizar Brier y log-loss; observar accuracy y ECE sin elegir solo por accuracy. |
| Siguiente paso | Ampliar datasets multi-liga/multi-temporada antes de cualquier decision de modelo. |

## J. Flujo principal del sistema

1. API de futbol entrega fixtures/resultados.
2. Scripts o Edge Functions importan partidos.
3. Se normalizan equipos y se detectan aliases pendientes.
4. Se guardan datasets locales o en Supabase con checksum/trazabilidad.
5. El modelo principal V1 genera predicciones.
6. Se guardan predicciones con version/configuracion del modelo.
7. El frontend muestra pronosticos segun plan de usuario.
8. Se actualizan resultados reales.
9. Se evaluan aciertos, Brier/log-loss y metricas de ranking.
10. Admin revisa errores, datasets, model runs, aliases y backtests.

## K. Panel admin requerido

| Funcion | Estado actual | Requisito de cierre |
| --- | --- | --- |
| Importar ligas/temporadas | Parcial | Conectar flujo operativo o documentar uso por scripts. |
| Ejecutar predicciones | Parcial | Boton/accion segura o runbook servidor. |
| Ejecutar backtests | Parcial | Ver reportes/model_runs sin exponer service role. |
| Ver model runs | Parcial | Listado claro con metricas y warnings. |
| Ver datasets | Parcial | Estado, checksum, fuente, liga/temporada. |
| Ver equipos no normalizados | Parcial | Cola de aliases pendientes con aprobacion admin. |
| Ver errores | Parcial | Revisar `app_error_logs` y sync errors. |
| Comparar modelos | Parcial | Solo interno, sin promocionar V2. |
| Administrar contenido premium | Pendiente | Definir reglas y validacion server-side. |
| Gestionar pagos/suscripciones | Pendiente | No implementar hasta tener arquitectura segura. |

## L. Pagos y suscripciones

Estado: pendiente/parcial de producto. No se debe implementar pago en esta tarea.

Requisitos recomendados:

| Requisito | Recomendacion |
| --- | --- |
| Plan gratuito | Definir limites de partidos, ligas y detalle. |
| Plan premium | Definir beneficios concretos y precio. |
| Tabla de suscripciones | Crear entidad futura con `user_id`, `plan`, `status`, `provider`, `provider_customer_id`, `current_period_end`, auditoria. |
| Validacion de acceso | Implementar en Supabase/RPC/backend; nunca solo en React. |
| Pasarela de pago | Integracion futura con Stripe/MercadoPago u otra pasarela. |
| Webhooks | Requeridos para activar/cancelar premium de forma confiable. |
| Seguridad | RLS, funciones server-side y logs de cambios. |

## M. Brechas actuales

| Brecha | Impacto | Prioridad | Recomendacion |
| --- | --- | --- | --- |
| No hay proteccion premium server-side consolidada. | Usuarios podrian acceder a contenido premium si solo se oculta en UI. | Alta | Diseñar tabla de suscripciones y RPC/policies antes de vender. |
| Producto freemium no esta cerrado. | No queda claro que ve gratis vs premium. | Alta | Definir matriz de acceso por modulo. |
| V2 no supera a V1 en metricas principales. | Riesgo de promocionar modelo inestable. | Alta | Mantener V1 produccion y V2 experimental. |
| Validacion multi-liga limitada. | Riesgo de sobreajuste a Premier League. | Alta | Importar mas ligas/temporadas y repetir backtests. |
| Admin depende en parte de scripts/manualidad. | Operacion puede ser fragil. | Media | Crear runbook o acciones admin seguras. |
| Alias de equipos requieren revision. | Datos inconsistentes reducen calidad. | Media | Establecer proceso de aprobacion. |
| Reportes en `reports/` pueden confundirse con fuente estable. | Riesgo de commitear o interpretar mal resultados. | Media | Mantener ignorados y documentar reportes canonicos. |
| Pagos no implementados. | No hay monetizacion real. | Alta para premium | Diseñar antes de implementar pasarela. |
| Falta QA responsive/UX final. | Producto puede fallar en mobile. | Media | Pruebas manuales por rutas clave. |
| Falta politica legal visible sobre pronosticos. | Riesgo reputacional/legal. | Alta | Incluir disclaimer claro en landing y pronosticos. |

## N. Roadmap

| Fase | Objetivo | Resultado esperado |
| --- | --- | --- |
| Fase 1 | Cerrar modelo y datos. | V1 produccion, datasets multi-liga, backtests reproducibles, V2 experimental. |
| Fase 2 | Cerrar producto gratuito. | Landing, auth, pronosticos gratis, ligas limitadas, perfil/favoritos basicos y disclaimer. |
| Fase 3 | Cerrar premium. | Modelo de planes, suscripciones, validacion server-side y matriz de acceso. |
| Fase 4 | Cerrar admin. | Operacion documentada para importacion, predicciones, errores, aliases, datasets y runs. |
| Fase 5 | Ampliar validacion multi-liga. | Mas ligas/temporadas y decision futura de modelos basada en Brier/log-loss/ECE. |

## O. Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Sobreajuste del modelo. | No hacer mas tuning sobre Premier League 2022-2024; ampliar datasets. |
| Falta de datos multi-liga. | Usar `scripts/importar_ligas_temporadas.py` y backtests agregados/por liga. |
| Pagos mal protegidos. | Validar premium en backend/Supabase con RLS/RPC. |
| API keys expuestas. | Mantener service role/API keys fuera de Vite y navegador. |
| Contenido premium protegido solo en frontend. | Implementar control server-side antes de vender premium. |
| Falta de trazabilidad. | Usar model_runs, model_datasets, checksums y versionado de modelos. |
| Metricas mal interpretadas. | Priorizar Brier/log-loss y estabilidad, no accuracy aislada. |
| Prometer aciertos deportivos. | Disclaimer visible y comunicacion probabilistica. |
| Cuotas/plan API-Football. | Preflight, manejo de errores y activacion controlada de cron pago. |

## P. Recomendacion final

PrediGol debe cerrarse como MVP freemium antes de seguir optimizando modelos. La recomendacion es mantener V1 como modelo de produccion, dejar V2 como experimental, no seguir tuning por ahora, ampliar datasets reales multi-liga, cerrar el flujo comercial gratis/premium con proteccion server-side y fortalecer el panel admin/runbooks.

La primera version estable debe priorizar confianza operativa: datos trazables, pronosticos informativos, seguridad, RLS, disclaimers, pruebas y una separacion clara entre contenido gratuito y premium.
