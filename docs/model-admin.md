# Administracion del modelo

La pantalla dedicada esta en `/admin/modelo`.

## Secciones

- Resumen: modelo activo, ultima ejecucion, ultimo backtest, ultima importacion, historicos validos, rango, torneos, aliases y estado de Supabase/Python.
- Acciones: muestra comandos locales para diagnostico, dry-run, backtests, comparativo e importacion.
- Ejecuciones: lista `model_runs` con filtros por modelo, tipo, estado y busqueda.
- Datasets: lista `model_datasets`.
- Normalizacion: crea aliases y revisa pendientes.

El frontend no ejecuta Python directamente. Para lanzar procesos desde la UI haria falta un worker, servidor o Edge Function que dispare los scripts de forma segura.
