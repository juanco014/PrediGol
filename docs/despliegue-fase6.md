# Despliegue y operacion - Fase 6

Objetivo: dejar PrediGol preparado para publicarse y para pasar de modo hibrido gratis a API-Football pago cuando el producto este listo.

## 1. Verificacion local

Desde la raiz del proyecto:

```powershell
cd C:\Users\manja\OneDrive\Escritorio\PrediGol
.\verify_fase6.ps1
```

Este script revisa archivos criticos y ejecuta:

- `npm.cmd run lint`
- `npm.cmd run build`

## 2. Despliegue web

La carpeta web es:

```text
predigol-web
```

Variables necesarias en el hosting:

```env
VITE_SUPABASE_URL=https://aadkcyoyjxglrbiwfdgw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

No subas estas llaves al navegador:

- `SUPABASE_SERVICE_ROLE_KEY`
- `API_FOOTBALL_KEY`

Para Vercel, `predigol-web/vercel.json` ya deja fallback a `index.html`, asi rutas como `/inicio`, `/ranking` y `/admin/partidos` funcionan al recargar.

## 3. Supabase

Aplicar migraciones:

```powershell
npx.cmd supabase db push
```

Desplegar Edge Functions:

```powershell
npx.cmd supabase functions deploy sync-live-fixtures --no-verify-jwt
npx.cmd supabase functions deploy import-google-sheet-fixtures --no-verify-jwt
```

Secretos necesarios:

```powershell
npx.cmd supabase secrets set API_FOOTBALL_KEY=tu_api_key_real
```

`SUPABASE_URL` y las llaves secretas internas las inyecta Supabase en Edge Functions.

## 4. Antes de pagar API-Football

Mantener modo hibrido:

- historicos 2022-2024 con API-Football Free;
- partidos actuales desde Google Sheets;
- resultados cerrados desde panel admin;
- rankings y puntos desde Supabase.

No actives cron API-Football pago todavia. La migracion `202606250005_api_football_paid_cron.sql` deja la configuracion creada pero `enabled = false`.

## 5. Despues de pagar API-Football

1. Confirma que el plan permite temporadas 2025-2026.
2. Actualiza el secreto:

```powershell
npx.cmd supabase secrets set API_FOOTBALL_KEY=tu_api_key_real
```

3. Despliega `sync-live-fixtures`.
4. Prueba manualmente:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "https://aadkcyoyjxglrbiwfdgw.supabase.co/functions/v1/sync-live-fixtures?mode=upcoming&season=2026&limit=10"
```

5. Si responde con partidos, activa el cron desde SQL:

```sql
select public.guardar_api_football_sync_config(
  p_enabled => true,
  p_season => 2026,
  p_upcoming_limit => 15,
  p_sync_upcoming => true,
  p_sync_live => true,
  p_sync_results => true
);
```

## 6. Checklist final

- Web compila.
- Rutas internas recargan sin 404.
- Admin puede importar CSV o Google Sheets.
- Inicio muestra maximo 10 partidos relevantes.
- Pronosticos se bloquean al iniciar el partido.
- Ranking global usa `obtener_ranking_global`.
- Liga privada usa `obtener_ranking_liga`.
- API-Football cron sigue desactivado hasta pagar plan.

## Plan B

Si API-Football falla durante una demo, desactiva cron pago:

```sql
select public.guardar_api_football_sync_config(false);
```

Luego usa Google Sheets y `manual-data/google-sheets-demo-mvp.csv`.
