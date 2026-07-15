# Monitoreo PrediGol

## Alcance

Monitoreo gratuito y de solo lectura para `https://predigol.onrender.com`. No consulta API-Football, no escribe en Supabase, no despliega y no usa secretos.

## Verificador Local

Comandos seguros:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_salud_produccion_predigol.py
prediction-service/.venv/Scripts/python.exe scripts/verificar_salud_produccion_predigol.py --skip-supabase
prediction-service/.venv/Scripts/python.exe scripts/verificar_salud_produccion_predigol.py --base-url https://predigol.onrender.com
```

El verificador comprueba:

- URL principal por HTTPS.
- `index.html` y marcador de PrediGol.
- Assets JS y CSS principales.
- Rutas SPA `/auth`, `/inicio`, `/pronosticos`, `/perfil`, `/admin`, `/explorar`, `/ranking` y `/ligas`.
- Headers de seguridad como comprobacion informativa.
- Supabase publico solo si se configuran variables publicas de monitoreo.

Variables opcionales para Supabase publico:

- `PREDIGOL_MONITOR_SUPABASE_URL`.
- `PREDIGOL_MONITOR_SUPABASE_PUBLISHABLE_KEY` o `PREDIGOL_MONITOR_SUPABASE_ANON_KEY`.

Nunca usar en monitoreo:

- `SUPABASE_SERVICE_ROLE_KEY`.
- claves secretas administrativas de Supabase.
- JWT privados.
- `FOOTBALL_API_KEY`.
- `API_FOOTBALL_KEY`.

## GitHub Actions

Workflow: `.github/workflows/production-health.yml`.

- Frecuencia: una vez al dia, `17 11 * * *` UTC.
- Ejecucion manual: `workflow_dispatch`.
- Permisos: `contents: read`.
- Supabase: omitido con `--skip-supabase` porque no usa secrets.
- API-Football: no se consulta.
- Despliegue: no ejecuta despliegues.

## Cold Starts De Render

Render puede tardar si el servicio esta frio. El verificador usa reintentos limitados:

- Maximo recomendado: 2 o 3 intentos.
- Pausa breve: 2 a 3 segundos.
- Timeout definido: 12 a 15 segundos.

Un cold start recuperado se registra como evento informativo o advertencia, no como incidente critico.

## Advertencias De Bundle

Si el verificador informa referencias `http://` o `localhost` dentro del JavaScript compilado, revisar su origen antes de clasificarlo como incidente. En la auditoria Fase 8E se confirmo que las coincidencias observadas provienen de constantes inertes de dependencias (`@supabase/auth-js` define un default local de GoTrue) y de namespaces estandar SVG/XML/MathML. La app versionada crea el cliente Supabase con `VITE_SUPABASE_URL`, por lo que ese default local no es la configuracion usada en runtime.

## Estados Esperados

No son incidentes:

- 0 fixtures futuros.
- 0 predicciones.
- Respuesta `[]` desde Supabase o RPC correcta.
- Usuario gratuito sin contenido premium.
- Cold start recuperado.

Son incidentes frontend:

- HTTP 5xx.
- `index.html` ausente.
- Assets 404.
- Rutas SPA 404.
- Pantalla en blanco.
- Build roto.

Son incidentes Supabase:

- DNS o red no disponible.
- CORS bloqueado.
- 401/403 generalizado con clave publica correcta.
- RPC ausente.
- Auth no redirige correctamente.

Son incidentes de seguridad:

- Service role o secreto backend en bundle.
- JWT en logs.
- Permisos admin incorrectos.
- RLS desactivada.

## Rutina Operativa

Diaria o despues de cambios:

1. Revisar ultimo deployment en Render.
2. Revisar workflow `Production Health`.
3. Abrir `/`, `/auth`, `/inicio`, `/pronosticos`, `/perfil` y `/admin` si hay alerta.
4. Revisar consola y Network en navegador sin copiar secretos.
5. Confirmar que cero fixtures/predicciones se muestra como estado vacio.
6. Revisar Supabase Auth logs si hay fallos de login.
7. Revisar Supabase API logs si hay 401/403, CORS o RPC ausente.
8. Registrar incidente en `docs/incidentes-predigol.md` si hay impacto real.

## Procedimientos

### 404 SPA

1. Confirmar que `/` carga.
2. Revisar rewrite Render: source `/*`, destination `/index.html`, action `Rewrite`.
3. No redirigir; debe ser rewrite.
4. Validar rutas directas despues del ajuste.

### Variables Publicas Incorrectas

1. Confirmar variables frontend en Render sin imprimir valores.
2. Verificar `VITE_SUPABASE_URL`.
3. Verificar publishable/anon key publica.
4. Confirmar que no hay service role ni API-Football key en frontend.

### Supabase Caido O Con Permisos

1. Revisar Auth logs.
2. Revisar API logs.
3. Diferenciar `[]` correcto de 401/403 o RPC ausente.
4. No usar service role en monitoreo.
5. No modificar RLS sin investigacion y backup.

### Build Fallido

1. Revisar CI.
2. Ejecutar localmente tests/lint/build.
3. No desplegar manualmente hasta tener causa.
4. Si produccion esta afectada, usar rollback manual documentado.

### Rollback

1. Identificar ultimo deployment funcional en Render.
2. Usar redeploy/rollback desde Render Dashboard si corresponde.
3. No revertir migraciones Supabase automaticamente.
4. No activar API-Football, importadores, sincronizadores ni publicadores.

## Escalamiento

- Informativo/Bajo: registrar y revisar en la siguiente ventana.
- Medio: propietario revisa Render/Supabase el mismo dia.
- Alto: detener cambios, validar rollback y comunicar impacto.
- Critico: rotar secretos si aplica, bloquear despliegues y revisar permisos/RLS.
