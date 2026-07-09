# Pruebas del modelo V2

Ejecutar suite Python:

```bash
cd prediction-service
python -m unittest discover -s tests
```

Cobertura agregada:

- Normalizacion de equipos con tildes, particulas, aliases aprobados, pendientes y ambiguos.
- Importacion con fechas invalidas, duplicados, resultados incompletos y equipos iguales.
- V2 con probabilidades validas, calibracion condicionada a datos, configuracion invalida, fallback por torneo y Dixon-Coles desactivable.
- Backtest comparativo con separacion temporal estricta y metricas reproducibles.

Las pruebas usan fixtures pequenos y no dependen de Supabase real.
