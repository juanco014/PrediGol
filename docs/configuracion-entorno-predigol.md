# Configuracion de entorno PrediGol

## Objetivo

Definir las variables necesarias para ejecutar PrediGol en local, staging o produccion sin exponer secretos. El frontend solo usa variables publicas. El `prediction-service` y las Edge Functions pueden usar claves privadas en entornos controlados.

## Frontend

Archivo local recomendado: `predigol-web/.env.local`.

Configuracion en despliegue: variables del proveedor de hosting, por ejemplo Vercel Project Settings.

| Variable | Tipo | Requerida | Uso |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Publica | Si | URL del proyecto Supabase. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publica | Si, recomendada | Publishable key publica de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Publica | Alternativa legacy | Anon key publica si el proyecto no usa publishable key. |
| `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` | Publica | Solo si push esta activo | Clave publica VAPID para notificaciones web. |

Ejemplo sin secretos reales:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
# VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=tu_vapid_public_key
```

Nunca poner en frontend:

```env
SUPABASE_SERVICE_ROLE_KEY=
FOOTBALL_API_KEY=
API_FOOTBALL_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
SUPABASE_SECRET_KEYS=
```

## Prediction Service

Archivo local recomendado: `prediction-service/.env`.

Configuracion en despliegue: secreto del runner, servidor, worker o CI que ejecute Python. No se configura en Vercel frontend.

| Variable | Tipo | Requerida | Uso |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Privada operativa | Si para datos reales | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Privada critica | Si para escritura operativa | Escritura/lectura server-side con RLS bypass controlado. |
| `FOOTBALL_API_PROVIDER` | Configuracion | Si | Proveedor de futbol, default `api_football`. |
| `FOOTBALL_API_KEY` | Privada | Si para importacion real | API key de API-Football. |
| `API_FOOTBALL_KEY` | Privada legacy | Opcional | Alias legacy si algun script lo requiere. |
| `FOOTBALL_API_DRY_RUN` | Configuracion | Recomendado en local | `true` evita llamadas reales por defecto. |
| `PREDIGOL_HISTORY_LIMIT` | Configuracion | Opcional | Limite de historico para modelo. |
| `PREDIGOL_UPCOMING_LIMIT` | Configuracion | Opcional | Limite de proximos partidos. |
| `PREDIGOL_MIN_HISTORY_MATCHES` | Configuracion | Opcional | Minimo historico para V1. |

Ejemplo sin secretos reales:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_solo_backend
FOOTBALL_API_PROVIDER=api_football
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
FOOTBALL_API_KEY=tu_api_football_key
FOOTBALL_API_DRY_RUN=true
PREDIGOL_HISTORY_LIMIT=2000
PREDIGOL_UPCOMING_LIMIT=250
PREDIGOL_MIN_HISTORY_MATCHES=30
```

## Supabase Edge Functions

Configurar con Supabase Secrets, no en frontend:

```bash
npx supabase secrets set API_FOOTBALL_KEY=tu_api_key_real
npx supabase secrets set WEB_PUSH_VAPID_PRIVATE_KEY=tu_vapid_private_key
```

`SUPABASE_URL` y claves internas reservadas son inyectadas por Supabase cuando corresponda. No intentes publicar service role en variables `VITE_*`.

## Validaciones

Ejecutar antes de despliegue:

```bash
cd predigol-web
npm test
npm run lint
npm run build
```

```bash
./prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
./prediction-service/.venv/Scripts/python.exe -m pytest prediction-service/tests
```

Confirmaciones manuales:

- [ ] `.env` reales no aparecen en `git status --short`.
- [ ] `.env.example` solo contiene placeholders.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no existe en `predigol-web/`.
- [ ] API-Football key no existe en `predigol-web/`.
- [ ] El hosting solo tiene variables `VITE_*` publicas.
- [ ] El runner Python tiene `SUPABASE_SERVICE_ROLE_KEY` y `FOOTBALL_API_KEY` si se ejecutaran importaciones reales.
