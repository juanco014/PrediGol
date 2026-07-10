# Entrega MVP PrediGol

## Resumen

PrediGol es una plataforma freemium de pronosticos deportivos. El MVP permite consultar pronosticos informativos, guardar jugadas de usuario, competir en rankings/ligas privadas y operar datos/modelos desde paneles admin protegidos.

## Objetivo del MVP

Entregar una version funcional, estable y revisable con flujo de datos real, pronosticos visibles, experiencia gratuita, base premium preparada sin pagos reales y administracion operativa.

## Fases implementadas

| Fase | Estado | Alcance |
| --- | --- | --- |
| Fase 1 | Implementada | Flujo base de pronosticos con V1 como modelo principal. |
| Fase 2 | Implementada | Landing, experiencia gratuita, filtros, detalle y estados de UI. |
| Fase 3 | Implementada | Base freemium con RLS/RPC, planes, suscripciones y bloqueo premium server-side. |
| Fase 4 | Implementada | Panel admin operativo para resumen, partidos, datasets, runs, predicciones y premium manual. |
| Fase 5 | En cierre | QA, limpieza, documentacion, seguridad basica y preparacion para despliegue. |

## Estado actual

V1 (`poisson-elo-v1`) es el modelo principal de produccion. V2 (`poisson-elo-form-v2`) queda experimental para backtests y trazabilidad admin. No se cambiaron defaults, probabilidades, xG ni matriz en esta fase.

## Flujo de datos

1. Los scripts importan partidos desde API-Football o datasets locales.
2. Los datos se validan y pueden registrarse como datasets/runs.
3. El servicio Python genera predicciones con V1.
4. Supabase almacena partidos, predicciones, rankings, perfiles, suscripciones y trazabilidad.
5. El frontend consume datos con Supabase publishable key y RPCs seguras.

## Flujo de pronosticos

1. Importar o sincronizar partidos.
2. Verificar historico suficiente y calidad de datos.
3. Generar predicciones V1.
4. Guardar en `model_predictions` con `access_tier`.
5. Mostrar predicciones gratis completas y premium bloqueadas segun RPC/RLS.

## Experiencia gratuita

El visitante ve la landing, entiende la propuesta y accede a auth. El usuario gratis ve inicio, pronosticos, detalle de partido, ligas, ranking, estadisticas, notificaciones y perfil. El contenido premium queda bloqueado sin entregar campos completos cuando no corresponde.

## Base freemium

Tablas principales: `subscription_plans`, `user_subscriptions` y `model_predictions.access_tier`. La seguridad depende de RLS/RPC, no de ocultar componentes React. Premium manual existe solo para admin como puente temporal.

## Panel admin

Rutas: `/admin`, `/admin/modelo`, `/admin/partidos`. El admin revisa salud operativa, predicciones, runs, datasets, usuarios free/premium, importacion y comandos. En Fase 5 la UI no permite cambiar V1/V2.

## Listo

| Area | Estado |
| --- | --- |
| V1 produccion | Listo. |
| V2 experimental | Listo, sin promocion a usuario final. |
| Pronosticos visibles | Listo si existen predicciones guardadas. |
| Experiencia gratuita | Presentable. |
| Freemium seguro | Base lista con RLS/RPC. |
| Admin operativo | Listo para revision y operacion manual. |
| Documentacion de entrega | Lista. |

## Pendiente

| Pendiente | Motivo |
| --- | --- |
| Pagos reales | Requiere checkout server-side y webhooks. |
| Automatizacion backend/worker | El navegador no debe ejecutar scripts locales. |
| Monitoreo productivo | Requiere configurar logs, alertas y cuotas. |
| QA manual en navegador real | Debe ejecutarse contra entorno Supabase definitivo. |
| Backtests multi-liga actualizados | Operativo, pero no bloquea el MVP si V1 queda congelado. |

## Riesgos conocidos

| Riesgo | Mitigacion |
| --- | --- |
| Falta de datos recientes | Ejecutar importacion/sync antes de demo. |
| Claves mal configuradas | Usar checklist de despliegue y no exponer service role en frontend. |
| Premium incompleto | Comunicar como preparado/manual, sin checkout. |
| Reportes locales accidentales | Mantener `reports/` fuera del commit salvo `.gitkeep`. |

## Comandos principales

```bash
cd predigol-web
npm test
npm run lint
npm run build
```

```bash
./prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
./prediction-service/.venv/Scripts/python.exe -m pytest prediction-service/tests
./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --dry-run
./prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v1
./prediction-service/.venv/Scripts/python.exe scripts/backtest_v1_v2.py --dataset-glob "reports/*_dataset.json" --min-training 30
```

## Validacion del proyecto

1. Revisar `git status --short` y eliminar solo archivos accidentales.
2. Confirmar variables de entorno con placeholders correctos.
3. Ejecutar tests frontend, lint y build.
4. Ejecutar tests Python y `scripts/verificar_python.py`.
5. Revisar rutas principales con usuario visitante, gratis y admin.
6. Confirmar que usuario no admin no accede a `/admin`.
7. Confirmar que premium bloqueado no entrega probabilidades/xG/marcador completos.

## QA manual

| Rol | Prueba |
| --- | --- |
| Visitante | Entra a `/`, entiende PrediGol, ve aviso responsable y puede ir a `/auth`. |
| Usuario gratis | Inicia sesion, ve `/inicio`, abre `/pronosticos`, filtra, entra a detalle, ve premium bloqueado y revisa `/perfil`. |
| Admin | Entra a `/admin`, ve resumen, predicciones, datasets/runs, V1 produccion y V2 experimental; no cambia V1/V2 desde UI. |
| Seguridad | Usuario no admin ve acceso denegado; frontend no expone service role ni claves privadas. |
