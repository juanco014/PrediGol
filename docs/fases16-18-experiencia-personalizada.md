# Fases 16-18: partido, favoritos y notificaciones

## Fase 16 - Centro de partido

La ruta `/partidos/:partidoId` funciona como centro del encuentro y separa la informacion en:

- `Resumen`: estado, flujo del pronostico, modelo y cronologia.
- `Pronostico`: marcador del usuario y reglas de puntos.
- `Estadisticas`: probabilidades 1X2, goles esperados, Elo, muestras y forma reciente.
- `Historial`: enfrentamientos directos y resultados recientes de ambos equipos.

La cronologia lee `football_live_snapshots`. Mientras no haya datos en vivo muestra un estado vacio explicito; no genera eventos ficticios.

## Fase 17 - Favoritos y personalizacion

La migracion `202607030001_favorites_notification_preferences.sql` crea:

- `user_favorite_teams`
- `user_favorite_competitions`

Cada tabla usa RLS y solo permite que el usuario autenticado gestione sus filas. Desde el detalle se puede seguir a ambos equipos o al torneo. Inicio prioriza esos partidos y ofrece el filtro `Mis favoritos`; Perfil permite revisar y eliminar favoritos.

Los nombres se normalizan para evitar duplicados por mayusculas o tildes. Cuando API-Football entregue identificadores estables, los campos `api_football_team_id` y `api_football_league_id` ya estan preparados.

## Fase 18 - Notificaciones mejoradas

`user_notification_preferences` guarda por usuario:

- recordatorio 24 horas antes;
- recordatorio 1 hora antes;
- aviso al iniciar el partido;
- resultados y puntos;
- novedades de favoritos.

La ruta `/notificaciones` calcula avisos en la app con partidos, pronosticos, resultados y favoritos. Realtime actualiza la vista cuando cambian partidos o pronosticos.

Estas son notificaciones internas. Para recibir push con el navegador cerrado se necesita una fase posterior con suscripciones Web Push, un service worker con eventos `push` y una funcion programada que envie los mensajes.

## Puesta en marcha

Desde la raiz del proyecto:

```powershell
.\supabase-local.cmd db push
cd predigol-web
npm.cmd run release:check
```

Prueba minima:

1. Abre un partido y marca un equipo y el torneo como favoritos.
2. Regresa a Inicio y activa `Mis favoritos`.
3. Revisa los favoritos en Perfil.
4. En Notificaciones cambia una preferencia y recarga la pagina.
5. Confirma que la preferencia permanece guardada.
