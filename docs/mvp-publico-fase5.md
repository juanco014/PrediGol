# MVP publico - Fase 5

Objetivo: dejar PrediGol listo para una demo usable con pocos partidos visibles, datos actuales controlados y flujo completo de pronostico, cierre, puntos y ranking.

## Estado esperado

- Inicio muestra maximo 10 partidos relevantes.
- El admin puede importar una hoja demo o una hoja real publicada como CSV.
- Los usuarios guardan pronosticos antes de la hora del partido.
- El admin cierra un resultado.
- Perfil, Ranking global y Ligas privadas reflejan los puntos.
- El modelo aparece en Inicio si `model_predictions` ya tiene predicciones guardadas.

## Hoja inicial

Usa como punto de partida:

```text
manual-data/google-sheets-demo-mvp.csv
```

La hoja incluye:

- 8 partidos proximos visibles;
- 2 partidos finalizados ocultos;
- torneos relevantes para demo: Liga BetPlay, Libertadores, Sudamericana, Champions y selecciones;
- fuente marcada como `demo mvp no oficial`.

Importante: estos datos son para demostracion. No representan calendario oficial.

## Flujo de demo recomendado

1. Entra con tu usuario admin.
2. Ve a `Perfil > Panel de partidos`.
3. Opcion rapida: carga `manual-data/google-sheets-demo-mvp.csv` desde el selector de archivo CSV.
4. Opcion operativa: publica la hoja demo en Google Sheets como CSV y pega la URL.
5. Pulsa `Previsualizar`.
6. Revisa que no haya errores.
7. Pulsa `Importar hoja`.
8. Confirma que `Salud de datos MVP` muestre partidos de Google Sheets.
9. Entra a Inicio y verifica que solo aparecen los partidos relevantes.
10. Guarda un pronostico en `demo-cierre-rapido-01`.
11. Desde el admin, cierra ese partido con un marcador.
12. Revisa Perfil, Ranking global y una Liga privada.

## Prueba con usuarios reales

Para demostrar ranking y ligas privadas:

1. Crea dos cuentas normales desde la app.
2. Con el usuario A crea una liga privada.
3. Copia el codigo e ingresa con el usuario B.
4. El usuario B se une a la liga.
5. Ambos guardan pronosticos en el partido de cierre rapido.
6. El admin cierra el resultado.
7. Abre el detalle de la liga y revisa la tabla.

## Criterios de aceptacion

- Importar la misma hoja dos veces no duplica partidos.
- Inicio no muestra mas de 10 partidos relevantes.
- Un partido finalizado bloquea nuevos pronosticos.
- El ranking global viene de `obtener_ranking_global`.
- El ranking privado viene de `obtener_ranking_liga`.
- El panel admin muestra errores de importacion si la hoja tiene columnas o fechas invalidas.

## Plan B durante demo

Si API-Football Free bloquea datos actuales, usa Google Sheets.

Si el modelo aun no tiene historicos suficientes, muestra `Salud de datos MVP` y explica que el servicio necesita al menos 30 partidos finalizados con marcador.

Si una hoja real falla, usa `manual-data/google-sheets-demo-mvp.csv` para completar el flujo.
