# Fases 19-21: exploracion y competencia

## Fase 19 - Explorador de partidos

La ruta `/explorar` consulta hasta 200 partidos y permite:

- buscar por equipo o torneo;
- filtrar por proximos, en vivo o finalizados;
- seleccionar un torneo;
- mostrar solo partidos de favoritos;
- abrir el detalle del partido;
- navegar hacia las paginas de equipos y torneos.

Los favoritos aparecen primero en los resultados. Esta pantalla usa la tabla `partidos`, por lo que funciona tanto con carga manual como con API-Football.

## Fase 20 - Paginas de equipos y torneos

Rutas disponibles:

- `/equipos/:nombre`
- `/torneos/:nombre`

La pagina de equipo calcula partidos jugados, victorias, empates, derrotas y goles. La pagina de torneo muestra partidos, equipos participantes y goles. Ambas incluyen proximos encuentros, resultados recientes y control de favorito.

Estas paginas usan el nombre como identificador temporal. Los campos opcionales de API-Football que ya existen en favoritos permiten migrar a IDs estables cuando se active el plan pago.

## Fase 21 - Rankings segmentados y logros

La migracion `202607030002_segmented_rankings.sql` crea la RPC:

```sql
obtener_ranking_segmentado(p_periodo, p_torneo)
```

Periodos soportados:

- `global`: todos los partidos finalizados;
- `semanal`: partidos finalizados desde el inicio de la semana en Colombia;
- `torneo`: partidos finalizados del torneo seleccionado.

La RPC usa `predigol_calcular_puntos`, así que la puntuacion coincide con el ranking global y las ligas privadas. La pantalla de ranking tambien presenta cuatro logros derivados de datos reales: primer pronostico, primer acierto, marcador exacto y top 3.

## Validacion

```powershell
cd predigol-web
npm.cmd run release:check
```

Prueba manual recomendada:

1. Busca un equipo desde `/explorar`.
2. Abre su pagina y marcalo como favorito.
3. Comprueba que sus partidos aparezcan primero al volver.
4. Abre `/ranking` y cambia entre Global, Esta semana y Por torneo.
5. Verifica que los puntos coincidan con los partidos finalizados de cada filtro.
