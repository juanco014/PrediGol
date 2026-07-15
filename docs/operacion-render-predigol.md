# Operacion Render PrediGol

## Estado Fase 8C

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-14 |
| Proveedor | Render |
| Tipo esperado | Static Site |
| URL produccion | `https://predigol.onrender.com` |
| Rama desplegada | `main` |
| Release candidate | `v0.8.0-rc.1` |
| Commit desplegado | `26cc7305220a5efacc4a9cdacf61cd27cb5b7bd0` |
| Estado general | Publica por HTTPS con rewrite SPA corregido. Validaciones autenticadas quedan manuales. |

## Diagnostico Publico

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Resolucion dominio | OK | `curl` resolvio `predigol.onrender.com` y conecto por HTTPS. `nslookup` no esta instalado en el entorno local. |
| HTTPS | OK | `https://predigol.onrender.com` responde `200 OK`. |
| `index.html` | OK | Content-Type `text/html; charset=utf-8`; titulo `PrediGol | Pronósticos de fútbol`. |
| Asset JS | OK | `/assets/index-D7Ql_IWE.js` responde `200 OK`, Content-Type `application/javascript`. |
| Asset CSS | OK | `/assets/index-wf8JKCK1.css` responde `200 OK`, Content-Type `text/css; charset=utf-8`. |
| Contenido mixto | OK parcial | No se detectaron redirecciones a `http://` ni a `localhost` en el HTML remoto. El bundle debe revisarse tras cada build. |
| Rutas SPA directas | OK | `/auth`, `/inicio`, `/pronosticos`, `/perfil`, `/admin`, `/explorar`, `/ranking`, `/ligas`, `/partidos/demo`, `/ligas/demo`, `/equipos/demo`, `/torneos/demo`, `/admin/partidos` y `/admin/modelo` responden `200 OK` y entregan `index.html`. |

## Configuracion Esperada En Render

Confirmar manualmente en Render Dashboard. No cambiar automaticamente desde scripts.

| Opcion | Valor esperado |
| --- | --- |
| Service Type | Static Site |
| Branch | `main` |
| Root Directory | `predigol-web` |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| Node | Version compatible con Vite 8 y React 19; preferir Node LTS actual soportado por Render. |
| Auto-Deploy | Activado desde `main` si el equipo lo aprueba. |
| SPA Rewrite | Configurado: source `/*`, destination `/index.html`, action `Rewrite`. |

Checklist manual en Render Dashboard:

- [ ] Confirmar Root Directory `predigol-web`.
- [ ] Confirmar Build Command `npm ci && npm run build`.
- [ ] Confirmar Publish Directory `dist`.
- [ ] Confirmar rama `main`.
- [ ] Confirmar version Node compatible.
- [ ] Confirmar variables publicas configuradas sin secretos backend.
- [x] Agregar o corregir rewrite SPA `/* -> /index.html`.
- [ ] Confirmar auto-deploy segun politica del equipo.
- [ ] Confirmar ultimo deployment exitoso corresponde al commit `26cc7305220a5efacc4a9cdacf61cd27cb5b7bd0`.

## Variables Publicas

Variables esperadas en Render para el frontend:

- `VITE_SUPABASE_URL`.
- `VITE_SUPABASE_PUBLISHABLE_KEY` o `VITE_SUPABASE_ANON_KEY`.
- `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` solo si se habilitan notificaciones web.

Variables prohibidas en Render frontend:

- `SUPABASE_SERVICE_ROLE_KEY`.
- `FOOTBALL_API_KEY`.
- `API_FOOTBALL_KEY`.
- JWT privados o secretos de Supabase.
- Contrasenas de usuarios de prueba.
- Variables de importadores, sincronizadores o publicadores.

Notas de validacion:

- Las claves publicas de Supabase pueden estar en el bundle y no son equivalentes a service role.
- No imprimir valores completos de variables en logs, issues o capturas.
- El build versionado no depende de un `.env` committeado; los `.env` reales deben seguir ignorados.

## Supabase Auth Manual

Configuracion confirmada manualmente por el propietario en Supabase Dashboard:

| Configuracion | Valor esperado |
| --- | --- |
| Site URL | `https://predigol.onrender.com` |
| Redirect URL produccion | `https://predigol.onrender.com/**` |
| Desarrollo local | `http://localhost:5173/**` |

Validaciones manuales:

- [ ] Login correcto.
- [ ] Logout correcto.
- [ ] Recuperacion de contrasena.
- [ ] Confirmacion de correo segun politica elegida.
- [ ] Redireccion despues del login.
- [ ] Redireccion despues de recuperacion.
- [ ] Acceso a `/perfil` con sesion valida.
- [ ] Bloqueo de `/admin` para usuarios no administradores.

Estado: configuracion manual confirmada. Las pruebas de login, logout, recuperacion, usuario gratis, premium y administrador quedan como validacion manual del propietario porque no deben automatizarse con credenciales reales.

## Smoke Test Produccion

Ejecutar manualmente en `https://predigol.onrender.com`. El rewrite SPA ya fue corregido y las recargas directas responden `index.html`.

### Publico

- [ ] Pagina principal carga.
- [ ] Logo y estilos cargan.
- [ ] No hay pantalla en blanco.
- [ ] Recarga directa de rutas funciona.
- [ ] Estado sin partidos se muestra correctamente.
- [ ] Estado sin predicciones se muestra correctamente.

### Usuario Sin Sesion

- [ ] `/perfil` redirige o bloquea.
- [ ] `/admin` redirige o bloquea.
- [ ] No se muestran datos privados.

### Usuario Gratuito

- [ ] Login correcto.
- [ ] Perfil correcto.
- [ ] Plan reconocido.
- [ ] Contenido premium bloqueado.
- [ ] Cero predicciones no se muestra como error.

### Usuario Premium

- [ ] Login correcto.
- [ ] Plan premium reconocido.
- [ ] Acceso premium permitido.
- [ ] Estado vacio premium correcto.

### Administrador

- [ ] Login correcto.
- [ ] Panel accesible.
- [ ] Usuario normal no puede acceder.
- [ ] Cero predicciones se distingue de error.
- [ ] Sincronizacion real permanece bloqueada.
- [ ] No se consume API-Football.

### Seguridad

- [ ] HTTPS activo.
- [ ] Consola sin secretos.
- [ ] Consola sin JWT impresos.
- [ ] Sin service role.
- [ ] Sin contrasenas.
- [ ] Sin redirecciones a localhost.
- [ ] Sin errores CORS.
- [ ] Sin errores internos sensibles.

## Estados Vacios Esperados

La ausencia actual de fixtures y predicciones es una limitacion conocida del release candidate.

Comportamiento esperado:

- Cero fixtures futuros muestra mensaje util.
- Cero predicciones publicas muestra estado vacio, no error de cuenta.
- Cero predicciones premium muestra estado vacio o bloqueo correcto segun plan.
- Cero registros administrativos se muestra como conteo cero.
- RPCs que devuelven `[]` no producen spinner infinito ni pantalla en blanco.
- No se inventan datos ni predicciones ficticias.

Validacion de lectura 2026-07-14: la consulta publica segura a `model_predictions?select=*&limit=1` respondio `200` con arreglo vacio. Esto confirma que cero predicciones se distingue de un error en la lectura publica basica.

## Encabezados Y Seguridad Web

Observado en Render para `/` y assets:

- `Strict-Transport-Security`: presente.
- `X-Content-Type-Options: nosniff`: presente.
- `Cache-Control`: presente con `public, max-age=0, s-maxage=300`.
- `Referrer-Policy`: no observado en respuesta Render.
- `X-Frame-Options`: no observado en respuesta Render.
- `Content-Security-Policy`: no observado en respuesta Render.
- `Permissions-Policy`: no observado en respuesta Render.

Riesgo: Render no esta aplicando automaticamente los headers definidos para Vercel en `predigol-web/vercel.json`. Antes de agregar CSP estricta en Render, comprobar compatibilidad con Supabase, assets, imagenes, fuentes, fetch y realtime/WebSocket.

## Source Maps Y Artefactos

Estado observado:

- `predigol-web/vite.config.js` no activa `build.sourcemap`.
- `predigol-web/dist/assets` no contiene archivos `.map`.
- No se observaron archivos `.env` en `predigol-web/dist`.
- El escaneo de nombres prohibidos no encontro service role, API-Football key, `sb_secret` ni variables de usuarios de prueba en `dist`.

Mantener source maps desactivados para produccion salvo que se incorpore monitoreo que los requiera y se carguen de forma privada.

## Observabilidad Minima

Rutina recomendada sin servicios externos de pago:

1. Revisar el deployment mas reciente en Render y confirmar commit.
2. Revisar consola del navegador en `/`, `/auth` y rutas protegidas.
3. Revisar Network para assets, CORS, Supabase REST/Auth y redirecciones.
4. Revisar Supabase logs de Auth, REST y Edge Functions si se usan.
5. Comprobar Auth con usuario gratuito, premium y administrador sin registrar credenciales.
6. Comprobar estados vacios de fixtures y predicciones.
7. Registrar incidentes con fecha, ruta, usuario anonimo/rol y commit.
8. Ejecutar rollback solo si hay fallo bloqueante de produccion.

Verificador de salud Fase 8E:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_salud_produccion_predigol.py --base-url https://predigol.onrender.com --skip-supabase
```

El workflow `Production Health` ejecuta el verificador una vez al dia sin secrets, sin Supabase real y sin API-Football. La guia completa de monitoreo esta en `docs/monitoreo-predigol.md` y la plantilla de incidentes en `docs/incidentes-predigol.md`.

## Rollback Manual En Render

No ejecutar rollback durante Fase 8C salvo decision operativa explicita.

Procedimiento:

1. Identificar el ultimo deployment funcional.
2. Abrir Events o Deploys en Render.
3. Seleccionar el deployment estable.
4. Usar la opcion disponible de redeploy o rollback.
5. Validar `/`, `/auth`, rutas protegidas y Auth.
6. No revertir migraciones Supabase automaticamente.
7. No alterar RLS ni Supabase Auth durante rollback frontend.
8. Mantener predicciones, sincronizaciones e importadores reales bloqueados.

## Limitaciones Actuales

- No existen fixtures futuros compatibles.
- No existen predicciones proximas reales.
- API-Football sigue bloqueada por el plan actual.
- No hay cron de predicciones en vivo.
- No se deben ejecutar importadores, sincronizadores ni publicadores con `--apply`.
- V1 y V2 no se modifican durante esta fase.
