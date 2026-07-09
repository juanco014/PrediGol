# Fase 13: operacion de API-Football

Esta fase prepara PrediGol para activar datos 2025-2026 cuando exista un plan de
API-Football compatible, sin desactivar el modo hibrido gratuito.

## Que agrega

- Historial de cada sincronizacion en `api_football_sync_runs`.
- Estado `running`, `success`, `partial` o `error`.
- Requests, fixtures, equipos, partidos, snapshots y duracion por ejecucion.
- Cuota diaria y por minuto tomada de los headers oficiales de API-Sports.
- RPC privada `obtener_api_football_monitor()` para el panel admin.
- Configuracion del cron pago desde `/admin/partidos`.

## Orden de despliegue

```powershell
cd C:\Users\manja\OneDrive\Escritorio\PrediGol
.\supabase-local.cmd db push
.\supabase-local.cmd functions deploy sync-live-fixtures --no-verify-jwt
```

El proyecto fija Supabase CLI `2.108.0` como dependencia de desarrollo. En este
equipo, `2.109.0` intenta lanzar `supabase-go.exe` y Windows Application Control
lo bloquea con `uv_spawn`. Usa `supabase-local.cmd` en lugar de `npx supabase`
hasta que una version posterior corrija esa compatibilidad.

La migracion debe aplicarse antes de desplegar la funcion para que las nuevas
ejecuciones puedan registrarse desde la primera llamada.

## Prueba segura con plan Free

Mantener `Activar cron pago` desmarcado y ejecutar un rango historico permitido
desde el panel admin. Las llamadas manuales requieren el JWT de un administrador;
las llamadas del cron requieren `x-sync-secret`, que nunca se expone al navegador.

La ejecucion debe aparecer en el monitor. Si algunas ligas no estan disponibles,
el estado sera `partial` y el detalle quedara guardado en `result.skipped`.

## Activacion futura del plan pago

1. Confirmar `API_FOOTBALL_KEY` en Supabase Secrets.
2. Actualizar `season_start_year` por competicion.
3. Dejar `Temporada global` vacia para respetar cada calendario.
4. Probar manualmente `upcoming`, `live` y `results`.
5. Verificar cuota restante y ausencia de errores en el monitor.
6. Activar el cron desde el panel admin.

El cron ejecuta en vivo cada 5 minutos, proximos cada hora y resultados cada
hora. Si la cuota es insuficiente, desactivar primero `En vivo cada 5 min`.
