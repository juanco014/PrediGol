# Modelo de prediccion PrediGol

## Arquitectura actual V1

El servicio de prediccion vive en `prediction-service/` y se ejecuta como paquete Python con `python -m predigol_model.run` o mediante scripts en `scripts/`.

V1 esta implementado en `prediction-service/predigol_model/poisson_elo.py` como `PoissonEloModel`. Combina Poisson, fuerza ataque/defensa por equipo, Elo simple y ventaja de localia. Genera probabilidades 1X2, goles esperados, marcador probable, confianza y `metadata`.

El flujo principal esta en `prediction-service/predigol_model/run.py`:

- Lee historicos finalizados desde `partidos`.
- Lee partidos proximos relevantes desde `partidos`.
- Genera payloads compatibles con `model_predictions`.
- Permite `--diagnose`, `--dry-run`, `--backtest` y seleccion `--model V1|V2`.

## Archivos principales

- `prediction-service/predigol_model/poisson_elo.py`: modelo V1.
- `prediction-service/predigol_model/v2.py`: modelo V2 separado.
- `prediction-service/predigol_model/evaluation.py`: backtest temporal rolling-origin.
- `prediction-service/predigol_model/diagnostics.py`: diagnostico de datos y calidad.
- `prediction-service/predigol_model/supabase_client.py`: cliente REST de Supabase via `httpx`.
- `scripts/diagnostico_modelo_v1.py`: diagnostico ejecutable de V1.
- `scripts/diagnostico_modelo_v2.py`: diagnostico ejecutable de V2.
- `scripts/backtest_modelo_v1.py`: backtest ejecutable para V1 y V2 con `--model`.
- `scripts/verificar_python.py`: verificacion local de Python, dependencias y Supabase.

## Tablas Supabase utilizadas

- `partidos`: fuente principal de partidos, historicos, estado, equipos, torneo, marcador final y fixture externo.
- `model_predictions`: predicciones guardadas para consumo de Home y detalle de partido.
- `model_evaluations`: resultados de backtests.
- `model_prediction_settings`: configuracion de modelo activo, por defecto `V1`.
- `football_fixtures`, `football_teams`, `football_competitions`, `football_live_snapshots`: datos API-Football y vivo.
- `pronosticos`: pronosticos de usuarios y ranking, no se modifica por backtests.

## Datos historicos encontrados

El repositorio no contiene una copia local completa de historicos. Los historicos reales se consultan en Supabase desde `partidos` con `estado = finalizado` y goles finales no nulos. La carpeta `manual-data/` contiene plantillas y CSVs de carga, pero no reemplaza a Supabase como fuente de entrenamiento.

## Que falta para que V2 funcione correctamente

- Cargar suficientes partidos finalizados por torneo y por equipo.
- Ejecutar backtests V1 y V2 con la misma ventana temporal.
- Comparar Brier Score, Log Loss y MAE antes de cambiar el modelo activo.
- Aplicar la migracion `202607060001_model_v2_metadata.sql` antes de guardar predicciones V2 con metadatos extendidos.
- Conectar una fuente de datos 2025-2026 cuando exista una API o proveedor definido.

V2 no reemplaza automaticamente a V1. El modelo predeterminado sigue siendo V1.

## Analisis personal de valor esperado

PrediGol puede evaluar cuotas decimales opcionales durante el backtest comparativo. Esta capa no ejecuta apuestas ni garantiza ganancias; solo responde si la probabilidad del modelo supera la probabilidad implicita de una cuota.

Campos de cuotas aceptados en cada partido:

- Local: `odds_home`, `home_odds`, `cuota_local`, `local_odds`.
- Empate: `odds_draw`, `draw_odds`, `cuota_empate`, `empate_odds`.
- Visitante: `odds_away`, `away_odds`, `cuota_visitante`, `visitante_odds`.

Tambien se acepta un objeto `odds` con esas mismas claves.

El calculo usa:

- Probabilidad implicita: `1 / cuota_decimal`.
- Valor esperado: `(probabilidad_modelo * cuota_decimal) - 1`.
- Edge: `probabilidad_modelo - probabilidad_implicita`.
- Fraccion Kelly limitada: recomendacion teorica acotada a un maximo conservador.

En `compare_v1_v2`, cada fila incluye `betting_analysis` y cada resumen de modelo incluye `summaries[modelo].betting` con:

- `matches_with_odds`: partidos evaluados con cuotas.
- `value_signals`: partidos donde alguna seleccion supera el edge minimo.
- `flat_stake_profit`: simulacion historica con una unidad por senal.
- `flat_stake_roi`: retorno historico por unidad apostada en esas senales.

La regla por defecto exige `min_edge = 0.03`. Si no hay cuotas historicas confiables, estas metricas quedan en cero o `null`; el modelo sigue evaluandose con Brier Score, Log Loss, MAE y calibracion.

Para uso personal, la prioridad no es buscar muchos partidos, sino pocos escenarios con buena calidad de datos, cuotas registradas antes del partido y backtest por liga/temporada.
