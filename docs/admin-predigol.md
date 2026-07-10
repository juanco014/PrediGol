# Admin PrediGol

Este documento describe la Fase 4 del MVP: panel administrativo operativo para revisar estado del sistema, trazabilidad de modelos, datasets, predicciones, partidos y base premium. No cambia V1, no cambia V2, no agrega reglas de modelo y no implementa pagos reales.

## Rutas admin

| Ruta | Estado | Que muestra | Requiere admin | Pendiente |
| --- | --- | --- | --- | --- |
| `/admin` | Nueva | Dashboard operativo, modelo principal, V2 experimental, conteos, datasets, runs, predicciones, usuarios free/premium y comandos sugeridos. | Si, via perfil `rol = admin` o `es_admin = true`; datos sensibles dependen de RLS/RPC. | Automatizar ejecucion segura de scripts desde backend/worker. |
| `/admin/modelo` | Existente, ajustada | Trazabilidad de modelo, API-Football, `model_runs`, `model_datasets` y alias. | Si. | Mantener solo como revision; V2 no se activa desde UI. |
| `/admin/partidos` | Existente | Estado de partidos, fixtures, importacion/API, edicion/cierre de partidos segun RPC existentes. | Si. | Automatizacion completa de ingesta y conciliacion. |

## Estado de modelos

| Modelo | Estado | Uso admin |
| --- | --- | --- |
| `poisson-elo-v1` | Produccion | Modelo principal del MVP. Se muestra como V1 en dashboards. |
| `poisson-elo-form-v2` | Experimental | Visible para trazabilidad/backtests. No se promociona ni se activa como produccion. |

El panel no modifica probabilidades, xG, matrices ni defaults. Las acciones relacionadas con modelos son comandos sugeridos para operar scripts existentes.

## Dashboard principal

`predigol-web/src/pages/AdminDashboardPage.jsx` usa `predigol-web/src/services/adminApi.js` para cargar:

| Seccion | Fuente |
| --- | --- |
| Resumen MVP | `obtener_model_admin_summary`, `model_datasets`, `model_runs`, `model_predictions`, `partidos`, `profiles`, `user_subscriptions`. |
| Datasets | `model_datasets` con RLS admin. |
| Model runs | `model_runs` con RLS admin. |
| Predicciones | `model_predictions` con RLS admin y cruce con `partidos`. |
| Premium | `profiles` y `user_subscriptions`. |
| Acciones seguras | Comandos sugeridos, no ejecucion desde frontend. |

Advertencias visibles:

| Advertencia | Motivo |
| --- | --- |
| V2 experimental, no usar como produccion todavia. | La evidencia no justifica promover V2. |
| Pagos reales pendientes. | No hay Stripe, PayPal, MercadoPago ni checkout. |
| Premium protegido desde backend/RLS/RPC. | La UI no es la fuente de seguridad. |

## Datasets

El admin ve datasets registrados en `model_datasets`:

| Campo | Descripcion |
| --- | --- |
| Liga/competicion | `competition`. |
| Temporada | `season`. |
| Fuente | `source_type` y `source_name`. |
| Partidos | `total_matches`, `finished_matches`, `valid_matches`, `discarded_matches`. |
| Fechas | `created_at`, `updated_at`. |
| Estado | `status`. |
| ID | `id`. |

Si solo existen archivos locales en `reports/`, el frontend no puede leerlos porque no hay API/backend para exponerlos. Deben registrarse en Supabase o revisarse localmente.

## Model runs

El admin ve ejecuciones de `model_runs`:

| Campo | Descripcion |
| --- | --- |
| Fecha | `created_at`, `started_at`, `finished_at`. |
| Modelo/version | `model_version`. |
| Tipo | `run_type`. |
| Dataset | `dataset_id`. |
| Partidos | `available_matches`, `used_matches`, `discarded_matches`. |
| Metricas | `metrics`, incluyendo Brier si existe. |
| Estado | `status`. |
| Warnings/errores | `warnings`, `error_detail`. |

## Predicciones admin

La seccion de predicciones permite filtrar por liga, fecha, modelo y `access_tier` (`free`/`premium`). El admin puede ver probabilidades completas si RLS lo permite porque `predigol_es_admin()` habilita la lectura de `model_predictions`.

Campos visibles:

| Campo | Descripcion |
| --- | --- |
| Partido | Local vs visitante y liga desde `partidos`. |
| Probabilidades | Local, empate, visitante. |
| Prediccion principal | Resultado con mayor probabilidad. |
| Marcador probable | `predicted_home_goals` y `predicted_away_goals`. |
| Confidence | `confidence`. |
| Premium/free | `access_tier`. |
| Generado | `generated_at`. |
| Modelo | `model_version`. |

## Premium manual

Fase 3 creo `subscription_plans`, `user_subscriptions`, RLS y policies admin. Fase 4 agrega una accion temporal para activar premium manual desde `/admin`:

| Regla | Implementacion |
| --- | --- |
| Requiere admin | Ruta visual con `isAdminUser`; escritura protegida por RLS `user_subscriptions_admin_write`. |
| Sin pasarela | Inserta `plan_code = premium`, `status = premium_active`. |
| Confirmacion | `window.confirm` antes de activar. |
| Metadata minima | `metadata.source = manual_admin` y nota opcional. |
| No borra datos | Solo inserta suscripcion nueva. Si ya existe una activa, Supabase puede rechazar por indice unico. |

Esto es gestion temporal. La integracion futura de pagos debe usar backend/webhooks seguros y no depender del frontend.

## Comandos operativos sugeridos

El panel solo copia o muestra comandos. No ejecuta scripts locales desde el navegador.

| Accion | Comando sugerido |
| --- | --- |
| Importar ligas/temporadas | `./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --liga 140 --temporada 2022` |
| Generar pronosticos V1 | `./prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --model poisson-elo-v1` |
| Backtest comparativo | `./prediction-service/.venv/Scripts/python.exe -m predigol_model.comparative_backtest` |
| Verificar Python | `./prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py` |

## Seguridad

La proteccion tiene dos capas:

| Capa | Funcion |
| --- | --- |
| Frontend | Oculta rutas y muestra acceso denegado si el perfil no es admin. |
| Supabase | RLS/RPC validan `predigol_es_admin()` para datos sensibles y escrituras premium. |

No se exponen claves privadas. El frontend no usa service role. Las claves de API-Football y Supabase service role deben permanecer en backend, `.env` local o Supabase Secrets.

## Pendiente

| Pendiente | Motivo |
| --- | --- |
| Worker/backend para ejecutar scripts desde admin | Evitar ejecucion insegura desde navegador. |
| Auditoria completa de cambios premium | Hoy se guarda metadata minima en `user_subscriptions`. |
| Pagos reales | Requiere checkout server-side y webhooks. |
| Reportes locales en UI | Requiere API/backend para exponer `reports/` de forma segura. |
| Tests de componentes React | La suite actual usa `node --test` para servicios/mappers; no hay harness DOM. |
