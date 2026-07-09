# PrediGol prediction service

Servicio Python separado para generar pronosticos estadisticos y guardarlos en Supabase.

El modelo inicial combina:

- Poisson para probabilidades de marcadores.
- Fuerza ataque/defensa por equipo.
- Elo simple con ventaja local.

## Uso local desde la raiz

Ejecuta desde la raiz del repositorio `PrediGol`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e "./prediction-service[test]"
python -m predigol_model.run --diagnose
python -m predigol_model.run --dry-run
python -m predigol_model.run --backtest --dry-run
python -m predigol_model.run --backtest
python -m predigol_model.run --dry-run --model V2
python -m predigol_model.run
python -m pytest prediction-service/tests
```

Orden recomendado:

1. `--diagnose`: revisa si hay historicos suficientes, partidos proximos relevantes y predicciones faltantes.
2. `--dry-run`: entrena el modelo y muestra una muestra de predicciones sin escribir.
3. `--backtest --dry-run`: calcula metricas sin escribir en Supabase.
4. `--backtest`: calcula y guarda una evaluacion en `model_evaluations`.
5. Sin flags: guarda o actualiza filas en `model_predictions`.

V1 sigue siendo el modelo predeterminado. Para probar V2 usa `--model V2` de forma explicita.

El archivo de credenciales sigue viviendo en `prediction-service/.env`.

Wrappers disponibles desde la raiz:

```powershell
python scripts/verificar_python.py
python scripts/diagnostico_modelo_v1.py
python scripts/diagnostico_modelo_v2.py
python scripts/backtest_modelo_v1.py
python scripts/backtest_modelo_v1.py --model V2
```

## Backtest temporal

`--backtest` ordena los partidos por fecha, entrena con el bloque mas antiguo y
evalua el bloque reciente sin mezclar resultados futuros. Por defecto reserva
el 20% final, exige al menos 30 partidos de entrenamiento y 10 de prueba.
Si `PREDIGOL_HISTORY_LIMIT` recorta la consulta, se usan los partidos finalizados
mas recientes.

- `outcome_accuracy`: acierto de local, empate o visitante; mayor es mejor.
- `exact_score_accuracy`: porcentaje de marcadores exactos; mayor es mejor.
- `home_goals_mae` / `away_goals_mae`: error absoluto medio; menor es mejor.
- `brier_score`: calidad de las tres probabilidades; menor es mejor.
- `log_loss`: penaliza probabilidades altas asignadas al resultado equivocado.

La evaluacion se compara con una linea base calculada solo con el bloque de
entrenamiento. `--dry-run` imprime las metricas; sin ese flag las guarda en
`model_evaluations`.

Variables utiles:

- `PREDIGOL_HISTORY_LIMIT`: maximo de partidos finalizados para entrenar.
- `PREDIGOL_UPCOMING_LIMIT`: maximo de partidos proximos relevantes a predecir.
- `PREDIGOL_MIN_HISTORY_MATCHES`: minimo de historicos exigidos antes de entrenar.

La llave `SUPABASE_SERVICE_ROLE_KEY` solo debe vivir en este servicio o en entornos de servidor. Nunca la pongas en Vite ni en el navegador.
