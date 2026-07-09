# Fase 15: cierre del MVP publico

## Controles incluidos

- Error Boundary para evitar una pantalla en blanco ante fallos React.
- Registro autenticado y limitado de errores en `app_error_logs`.
- Resumen de errores de las ultimas 24 horas en el panel admin.
- Metadatos SEO en espanol y vista social de PrediGol.
- Manifest, favicon y service worker para el shell de la aplicacion.
- Headers CSP, anti-frame, permisos y referrer en Vercel.
- Verificador reproducible `npm.cmd run release:check`.

El service worker solo cachea archivos del mismo origen. Las consultas y
respuestas de Supabase no se guardan en Cache Storage.

## Verificacion antes de publicar

```powershell
cd C:\Users\manja\OneDrive\Escritorio\PrediGol\predigol-web
npm.cmd run release:check
```

El resultado esperado termina con:

```text
PrediGol listo para entrega: lint, build, entorno, PWA y seguridad OK.
```

## Lista operativa

1. Confirmar variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. Confirmar que ninguna llave `service_role` use el prefijo `VITE_`.
3. Ejecutar `release:check`.
4. Publicar `predigol-web` en Vercel.
5. Probar login, Inicio, guardar pronostico, detalle, ranking y admin.
6. Revisar que el cron API-Football siga inactivo mientras no exista plan pago.
7. Revisar `Errores web 24 h` despues de la prueba publica.

## Limitaciones conscientes

- El modelo necesita recrear su `.venv` y configurar `prediction-service/.env`
  antes de generar el primer backtest real.
- Los partidos actuales siguen en modo hibrido hasta contratar API-Football.
- El dominio definitivo y la imagen social raster se pueden incorporar cuando
  se defina la URL publica final.
