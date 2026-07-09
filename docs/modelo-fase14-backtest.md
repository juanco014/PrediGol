# Fase 14: validacion del modelo PrediGol

## Objetivo

Medir el modelo Poisson/Elo con partidos que no participaron en el entrenamiento
y evitar look-ahead bias. El backtest usa un holdout temporal, no una division
aleatoria.

## Flujo

1. Cargar partidos finalizados y ordenarlos por `fecha_orden`.
2. Entrenar con el bloque historico inicial.
3. Predecir el bloque final sin reentrenar con sus resultados.
4. Comparar contra la frecuencia 1X2 del conjunto de entrenamiento.
5. Guardar metricas y tamanos de muestra en `model_evaluations`.

## Ejecucion

```powershell
cd C:\Users\manja\OneDrive\Escritorio\PrediGol\prediction-service
.venv\Scripts\python.exe -m predigol_model.run --backtest --dry-run
.venv\Scripts\python.exe -m predigol_model.run --backtest
```

La `.venv` debe apuntar a una instalacion activa de Python. Si fue creada con un
Python de Microsoft Store que ya no existe, se debe recrear antes de ejecutar el
servicio.

## Criterio inicial

El panel marca `Supera linea base` cuando el Brier del modelo es menor que el de
la linea base. Esto no significa que el modelo sea infalible. Con menos de 30
partidos de prueba se muestra una advertencia de muestra pequena.

Se deben revisar juntos acierto 1X2, Brier, log-loss, MAE y cobertura por torneo.
No se debe elegir una version usando solamente el porcentaje de aciertos.
