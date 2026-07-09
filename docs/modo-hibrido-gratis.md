# Modo hibrido gratis

Este modo permite seguir construyendo PrediGol sin pagar API-Football:

```text
Historicos gratis API-Football 2022-2024
        -> Entrena modelo Poisson/Elo
        -> Partidos actuales cargados manualmente
        -> Usuarios hacen pronosticos
        -> Resultados se actualizan manualmente
        -> Ranking y puntos funcionan
```

## 1. Cargar historicos gratis

Tu plan Free de API-Football permite temporadas antiguas. Ejecuta:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "https://aadkcyoyjxglrbiwfdgw.supabase.co/functions/v1/sync-live-fixtures?mode=results&season=2024"
```

Si API-Football bloquea parametros como `last`, usa una ventana de fechas:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "https://aadkcyoyjxglrbiwfdgw.supabase.co/functions/v1/sync-live-fixtures?mode=range&season=2024&from=2024-05-01&to=2024-05-31"
```

Tambien puedes probar `season=2023` y `season=2022`.

Tambien puedes hacerlo desde `Perfil > Panel de partidos > API-FOOTBALL`, usando modo `Rango de fechas`. Esta es la forma recomendada para probar historicos sin escribir comandos.

Para avanzar mas rapido en Fase 2, el panel tiene un importador rapido por mes:

1. Elige `Ano` entre 2022 y 2024.
2. Elige el mes.
3. Pulsa `Usar mes` para llenar el rango.
4. Pulsa `Sincronizar mes` para ejecutar API-Football.

Despues de cada sincronizacion revisa el bloque `Salud de datos MVP`. El objetivo minimo para probar el modelo es:

- 30 partidos finalizados con marcador;
- al menos 1 partido proximo marcado como relevante.

Si API-Football responde que el plan Free no permite una temporada, usa otro mes entre 2022 y 2024 o espera al plan pago para 2025-2026.

## 2. Cargar partidos actuales

Opcion recomendada para varios partidos: importa desde Google Sheets.

1. Crea una hoja con las columnas de `manual-data/google-sheets-partidos.template.csv`.
   Para pruebas puedes partir de `manual-data/google-sheets-demo-mvp.csv`.
2. En Google Sheets usa `Archivo > Compartir > Publicar en la web`.
3. Publica la hoja como CSV o copia el enlace normal de la hoja.
4. En PrediGol abre `Perfil > Panel de partidos`.
5. Pega la URL en `Importar desde Google Sheets`.
6. Pulsa `Previsualizar`.
7. Revisa nuevos, actualizaciones, omitidos y errores.
8. Pulsa `Importar hoja`.
9. Si quieres probar sin esperar el cron, pulsa `Sincronizar ahora`.

Columnas principales:

- `id`: identificador estable para evitar duplicados.
- `torneo`, `fecha`, `hora`, `local`, `visitante`.
- `estado`: `proximo`, `en_vivo`, `finalizado` o `cancelado`.
- `goles_local` y `goles_visitante`: obligatorios si el estado es `finalizado`.
- `relevante`: `si` para mostrar en Inicio, `no` para dejar oculto.
- `prioridad`: numero menor aparece primero.

Opcion manual uno por uno: usa el formulario del panel interno.

1. Entra a PrediGol con tu usuario.
2. Ve a Perfil.
3. Pulsa `Activar primer admin` si aun no existe administrador.
4. Abre `Panel de partidos`.
5. Crea partidos actuales y cierra resultados desde la app.

Los partidos cargados manualmente nacen marcados como relevantes. Los partidos importados desde Google Sheets respetan la columna `relevante`. Los partidos importados desde API-Football quedan guardados en la base de datos, pero no aparecen en Inicio hasta que un administrador pulse `Mostrar` en el panel.

Como se extraen los datos:

- la hoja se publica como CSV;
- la Edge Function `import-google-sheet-fixtures` descarga ese CSV;
- cada fila se convierte a un partido;
- la RPC `importar_partido_externo` crea o actualiza usando `id` como clave externa;
- si vuelves a importar la misma hoja, no duplica partidos.

Que parte sigue siendo manual:

- escribir o pegar los partidos en Google Sheets;
- revisar la previsualizacion antes de importar.

Que parte puede quedar automatica:

- desde el panel pulsa `Activar auto` despues de pegar la URL de la hoja;
- Supabase guarda esa URL en `predigol_google_sheet_sync_config`;
- la base genera un secreto privado para que solo el cron pueda invocar la importacion automatica;
- `pg_cron` ejecuta `import-google-sheet-fixtures` cada hora usando `pg_net`;
- cuando cambies resultados en la hoja, el siguiente ciclo actualiza Supabase.

No necesitas copiar el secreto ni guardarlo en `.env.local`. El panel solo muestra el estado y el ultimo resultado de la sincronizacion.

Desde el panel tambien puedes editar un partido rapido: torneo, fecha, equipos, estado, marcador, visibilidad y prioridad. Finalizar o cancelar pide confirmacion porque bloquea nuevos pronosticos.

Opcion SQL de respaldo: abre Supabase SQL Editor y usa:

```text
manual-data/partidos_actuales.template.sql
```

La funcion `crear_partido_manual` crea:

- el registro en `partidos`;
- un fixture sintetico con id negativo;
- equipos sinteticos;
- compatibilidad con `model_predictions`.

Eso permite que el modelo pueda guardar predicciones para partidos manuales igual que con API-Football.

## 3. Entrenar y guardar predicciones

Cuando ya existan historicos y partidos proximos manuales:

```powershell
cd C:\Users\manja\OneDrive\Escritorio\PrediGol\prediction-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m predigol_model.run --diagnose
python -m predigol_model.run --dry-run
python -m predigol_model.run
```

El servicio exige un minimo de historico finalizado (`PREDIGOL_MIN_HISTORY_MATCHES`, por defecto 30). Las predicciones se generan para partidos proximos y relevantes, incluidos los importados desde Google Sheets.

Antes de ejecutar el servicio, revisa en el panel admin que `Salud de datos MVP` diga que el modelo esta listo para `dry-run`.

Que debe pasar en Fase 3:

- `--diagnose` devuelve `ready_for_predictions: true`.
- `--dry-run` muestra una lista de predicciones sin escribir en Supabase.
- el comando sin flags guarda o actualiza `model_predictions`.
- el panel admin muestra `Predicciones`, `Proximos con modelo` y `Ultima prediccion`.
- Inicio muestra la tarjeta `Modelo PrediGol` en los partidos relevantes que tengan prediccion guardada.

## 4. Cerrar resultados manualmente

Desde el panel admin puedes ingresar el marcador y cerrar el partido.

Como respaldo, cuando termine un partido, copia su `id` desde Supabase Table Editor > `partidos` y ejecuta:

```text
manual-data/resultados.template.sql
```

La app detecta `estado = finalizado`, bloquea nuevos pronosticos y calcula puntos.

Fase 4 deja el flujo competitivo protegido desde Supabase:

- la funcion `predigol_calcular_puntos` replica la regla oficial: 3 por ganador/empate, +1 por diferencia y 5 total por marcador exacto;
- el trigger `predigol_validar_pronostico_tg` impide guardar pronosticos si el partido ya inicio, esta en vivo, finalizado o cancelado;
- `obtener_ranking_global` calcula la tabla general desde pronosticos reales;
- `obtener_ranking_liga` calcula la tabla de cada liga privada con la misma regla;
- Perfil, Ranking y Ligas privadas deben actualizar puntos despues de cerrar resultados.

Para aplicar esta fase en Supabase:

```powershell
cd C:\Users\manja\OneDrive\Escritorio\PrediGol
npx.cmd supabase db push
```

## 5. App

El usuario sigue usando PrediGol igual:

- ve en Inicio solo los partidos marcados como relevantes;
- guarda pronosticos antes de la hora del partido;
- ve prediccion del modelo si existe;
- al cerrar resultados, ranking y perfil se actualizan.

## 6. Demo MVP publico

La Fase 5 queda en:

```text
docs/mvp-publico-fase5.md
```

Resumen:

- usa `manual-data/google-sheets-demo-mvp.csv` como hoja inicial;
- Inicio muestra maximo 10 partidos relevantes;
- prueba con dos usuarios reales para validar ranking global y liga privada;
- cierra `demo-cierre-rapido-01` desde el panel admin para demostrar puntos.
