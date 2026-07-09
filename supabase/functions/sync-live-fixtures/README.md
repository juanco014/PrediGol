# sync-live-fixtures

Supabase Edge Function que sincroniza API-Football con PrediGol.

## Secrets requeridos

```bash
supabase secrets set API_FOOTBALL_KEY=tu_api_key
```

`SUPABASE_URL` y `SUPABASE_SECRET_KEYS` los inyecta Supabase en Edge Functions. No intentes crearlos con `supabase secrets set` porque el prefijo `SUPABASE_` esta reservado.

## Modos

```bash
supabase functions invoke sync-live-fixtures --no-verify-jwt --env-file ./supabase/.env --method POST
supabase functions invoke sync-live-fixtures --no-verify-jwt --method POST --query-params mode=upcoming
supabase functions invoke sync-live-fixtures --no-verify-jwt --method POST --query-params mode=results
supabase functions invoke sync-live-fixtures --no-verify-jwt --method POST --query-params mode=all
```

En produccion, una llamada manual debe enviar `Authorization: Bearer <JWT>` de
un usuario administrador. El cron usa el header privado `x-sync-secret`. Aunque
la funcion se despliega con `--no-verify-jwt`, las peticiones anonimas reciben
`401` para evitar consumo externo de la cuota.

- `live`: trae `fixtures?live=all` y filtra por ligas habilitadas.
- `upcoming`: trae los siguientes partidos por liga/temporada.
- `results`: trae resultados por liga/temporada. Si recibe `season`, usa rango anual con `from`/`to` para evitar el parametro `last`.
- `range`: trae fixtures de una ventana de fechas especifica.
- `all`: ejecuta los tres pasos.

Si tu plan de API-Football solo permite temporadas antiguas, puedes forzar una temporada o una ventana de fechas para pruebas:

```text
https://<project-ref>.supabase.co/functions/v1/sync-live-fixtures?mode=results&season=2024
https://<project-ref>.supabase.co/functions/v1/sync-live-fixtures?mode=range&season=2024&from=2024-05-01&to=2024-05-31
```

Para cuidar la cuota de API-Football, deja `live` para ejecuciones frecuentes y `upcoming/results` para ejecuciones menos frecuentes.

## Monitoreo

La migracion `202607010001_api_football_sync_monitoring.sql` registra cada
ejecucion, incluso si queda parcial o falla. Tambien guarda los headers de cuota
diaria y por minuto devueltos por API-Sports. El panel `/admin/partidos` consulta
esta informacion mediante `obtener_api_football_monitor()`.

Aplica la migracion antes de volver a desplegar esta funcion. El cron pago sigue
desactivado por defecto.
