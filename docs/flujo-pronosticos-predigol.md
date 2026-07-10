# Flujo de pronosticos PrediGol

Este documento describe la Fase 1 del MVP: pasar de datos reales a pronosticos visibles usando V1 como modelo principal. No cambia V1, no cambia defaults de V2 y no implementa pagos reales.

## Modelo de produccion

| Modelo | Estado | Uso |
| --- | --- | --- |
| V1 `poisson-elo-v1` | Produccion | Modelo principal para pronosticos visibles. |
| V2 `poisson-elo-form-v2` | Experimental | Solo comparacion interna/backtests; no promocionar como superior. |

V2 no debe pasar a produccion hasta tener evidencia multi-liga real, priorizando Brier, log-loss, accuracy y ECE.

## Importar datos

Importacion multi-liga local:

```powershell
python scripts/importar_ligas_temporadas.py --seasons 2022,2023,2024
```

Importacion de una temporada:

```powershell
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2024 --save-local
```

Los datasets locales quedan en:

```text
reports/api_api_football_liga-{id}_temporada-{season}_dataset.json
```

## Generar pronosticos desde dataset local

El script operativo local es:

```powershell
python scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v1
```

Por defecto usa V1. V2 solo se usa si se solicita explicitamente:

```powershell
python scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v2
```

La salida local queda en `reports/pronosticos_<dataset>_<model>.json` y contiene:

| Campo | Descripcion |
| --- | --- |
| `model.version` | Version del modelo usado. |
| `model.status` | `production` para V1, `experimental` para V2. |
| `dataset` | Metadatos del dataset fuente. |
| `summary` | Partidos procesados, predicciones generadas, errores, gratis y premium candidatos. |
| `traceability.prediction_checksum` | Checksum estable de predicciones generadas. |
| `predictions[]` | Probabilidades 1X2, marcador probable, xG, confianza, equipos, liga y temporada. |

El script no sobrescribe salidas existentes salvo `--force`:

```powershell
python scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v1 --force
```

## Guardado en Supabase para la app

Para partidos proximos operativos, el runner existente del prediction-service genera y guarda en `model_predictions`:

```powershell
python -m predigol_model.run
```

Tambien puede diagnosticarse sin escribir:

```powershell
python -m predigol_model.run --diagnose
python -m predigol_model.run --dry-run
```

`model_predictions` ya existe y almacena:

| Campo | Uso |
| --- | --- |
| `api_football_fixture_id` | Identificador del partido/API. |
| `partido_id` | Relacion logica con `partidos`. |
| `home_win_probability`, `draw_probability`, `away_win_probability` | Probabilidades 1X2. |
| `expected_home_goals`, `expected_away_goals` | Goles esperados. |
| `predicted_home_goals`, `predicted_away_goals` | Marcador probable. |
| `confidence` | Confianza del resultado mas probable. |
| `model_version` | Version del modelo. |
| `metadata` | Metadata tecnica. |
| `generated_at` | Fecha de generacion. |

La tabla tiene RLS con lectura para usuarios autenticados. Las escrituras operativas deben hacerse desde entorno servidor/scripts con service role, no desde el navegador.

## Visualizacion en frontend

El frontend consulta `model_predictions` en:

| Vista | Archivo | Uso |
| --- | --- | --- |
| Inicio | `predigol-web/src/services/footballApi.js` | Enriquecer partidos con predicciones del modelo. |
| Detalle partido | `predigol-web/src/services/footballApi.js` y `PartidoDetailPage.jsx` | Mostrar prediccion del modelo para el partido. |
| Pronosticos | `PronosticosPage.jsx` | Mostrar feed basico de pronosticos PrediGol V1. |

La vista basica muestra liga, fecha, local, visitante, probabilidades local/empate/visitante, pronostico principal, marcador probable, confianza y etiqueta `Gratis` o `Premium` cuando la RPC permite verlos. Los estados internos como `premium_candidate` son operativos y no deben presentarse como comparativa tecnica al usuario final.

## Freemium en esta fase

Esta fase no implementa pagos. Premium real queda pendiente y el bloqueo depende de Supabase/RLS/RPC, no de React.

Pendiente para premium real:

| Pendiente | Requisito |
| --- | --- |
| Planes | Definir gratis/premium. |
| Suscripciones | Crear tabla/estado de suscripcion. |
| Validacion | Proteger acceso premium desde Supabase/backend, no solo frontend. |
| Pasarela | Integracion futura con proveedor de pagos y webhooks. |

## Backtests y validacion

El comparativo V1/V2 sigue disponible:

```powershell
python scripts/backtest_v1_v2.py --dataset-glob "reports/api_api_football_liga-*_temporada-*_dataset.json" --min-training 30
```

No se debe elegir por accuracy solamente. La decision de modelo debe priorizar Brier/log-loss y revisar estabilidad por liga, temporada y calibracion.

## Resumen de cierre Fase 1

| Punto | Estado |
| --- | --- |
| Importar datasets reales | Disponible por scripts. |
| Generar pronosticos locales con V1 | Disponible con `scripts/generar_pronosticos.py`. |
| Guardar predicciones operativas | Disponible con `python -m predigol_model.run` sobre Supabase. |
| Mostrar pronosticos del modelo | Disponible en `/pronosticos`, inicio y detalle. |
| Experiencia gratuita frontend | Mejorada en Fase 2: landing, filtros, cards, estados vacios/error y aviso responsable. |
| Base freemium segura | Disponible en Fase 3 con `user_subscriptions`, `access_tier` y RPCs visibles. |
| Panel admin operativo | Disponible en Fase 4 con `/admin`, `/admin/modelo` y `/admin/partidos`. |
| Premium real con pagos | Pendiente. |
| V2 produccion | No habilitado; experimental. |

## Experiencia gratuita Fase 2

La landing publica explica que PrediGol ofrece pronosticos deportivos informativos, con contenido gratis y premium futuro. La pagina `/pronosticos` permite filtrar predicciones del modelo por liga, equipo, fecha y tipo (`Gratis` o `Premium candidato`). El detalle de partido muestra probabilidades 1X2, marcador probable, xG, confianza y una explicacion simple sin exponer comparativas V1/V2.

Las etiquetas premium visuales ahora deben apoyarse en la respuesta segura de Supabase. Las RPCs `obtener_predicciones_visibles` y `obtener_prediccion_visible` devuelven datos completos solo si el usuario tiene acceso, y preview bloqueado si no lo tiene. La pasarela de pago sigue pendiente.

## Operacion admin Fase 4

El panel `/admin` permite revisar conteos de predicciones, datasets, model runs, usuarios gratis/premium y partidos proximos. Tambien muestra comandos sugeridos para importar datos, generar pronosticos V1, ejecutar backtests y verificar Python. El navegador no ejecuta scripts locales; la automatizacion real requiere backend/worker seguro. En Fase 5 la UI no cambia el modelo activo: V1 queda como produccion y V2 como experimental.
