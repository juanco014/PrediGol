# Backtest comparativo V1 vs V2

El comparativo esta en `prediction-service/predigol_model/comparative_backtest.py` y se ejecuta desde la raiz del repositorio con:

```powershell
python scripts/backtest_v1_v2.py
```

Opciones:

```powershell
python scripts/backtest_v1_v2.py --date-from 2024-01-01 --date-to 2024-12-31 --tournament "Liga BetPlay" --min-training 50
python scripts/backtest_v1_v2.py --disable-calibration --disable-dixon-coles
python scripts/backtest_v1_v2.py --register
```

Respeta orden temporal: para cada partido, V1 y V2 entrenan solo con partidos anteriores.

Genera reportes JSON y CSV en `reports/`. Con `--register` guarda resumen en `model_runs` y crea un `model_datasets` asociado.

La interpretacion es responsable: no declara ganador absoluto si la muestra es pequena, si los conjuntos no son comparables o si los datos son insuficientes.
