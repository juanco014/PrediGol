# Smoke Test Manual Fase 8F - PrediGol

## Estado De Fase

**PARCIALMENTE COMPLETADA — VALIDACIÓN AUTENTICADA PENDIENTE**

URL validada: `https://predigol.onrender.com`

Commit desplegado en Render informado para esta fase:

| Commit | Estado |
| --- | --- |
| `761f342` | NO VERIFICADO EN RENDER; coincide con `HEAD` local |

Restricciones aplicadas durante esta preparación:

- No se recibieron ni almacenaron credenciales.
- No se solicitaron credenciales.
- No se crearon usuarios.
- No se ejecutó login automatizado.
- No se usó service role.
- No se escribió en Supabase.
- No se cambiaron roles, planes ni suscripciones.
- No se pulsaron ni automatizaron acciones de sincronización, importación, publicación o activación premium.
- No se inventaron resultados del smoke test autenticado.
- No se hizo commit ni push.

## Validación Ejecutada Sin Credenciales

Fecha de ejecución: 2026-07-15.

| Control | Resultado | Evidencia no sensible |
| --- | --- | --- |
| URL pública | OK | `GET https://predigol.onrender.com` devuelve `200 OK` |
| HTTPS | OK | `http://predigol.onrender.com` redirige con `301` a HTTPS |
| HTML principal | OK | `index.html` carga título, metadatos, manifest, JS y CSS |
| Assets JS/CSS | OK | `/assets/index-D7Ql_IWE.js` y `/assets/index-wf8JKCK1.css` devuelven `200 OK` |
| Favicon | OK | `/favicon.svg` devuelve `200 OK` |
| Manifest | OK con observación | `/manifest.webmanifest` devuelve `200 OK`, `Content-Type: binary/octet-stream` |
| Rutas SPA directas | OK técnico | `/auth`, `/perfil`, `/admin` y `/admin/partidos` devuelven el HTML de la SPA con `200 OK` |
| HSTS | OK | `Strict-Transport-Security: max-age=315360000; includeSubdomains; preload` presente |
| `X-Content-Type-Options` | OK | `nosniff` presente |
| `Content-Security-Policy` | PENDIENTE ENDURECIMIENTO | No observado en headers públicos |
| `Referrer-Policy` | PENDIENTE ENDURECIMIENTO | No observado en headers públicos |
| `X-Frame-Options` / `frame-ancestors` | PENDIENTE ENDURECIMIENTO | No observado en headers públicos |
| `Permissions-Policy` | PENDIENTE ENDURECIMIENTO | No observado en headers públicos |
| Mixed content público | OK parcial | HTML público no referencia assets `http://`; validación completa de Network queda manual |
| Network sin localhost | PENDIENTE VALIDACIÓN MANUAL | El bundle contiene strings de librerías como `localhost`/`127.0.0.1`; no se validó Network real en navegador |
| Network sin API-Football | PENDIENTE VALIDACIÓN MANUAL | Revisión estática indica que API-Football solo se dispara desde acciones admin; no se validó Network real |

## Revisión Estática

### Rutas Y Sesión

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Carga de sesión | OK estático | `predigol-web/src/App.jsx` usa `supabase.auth.getSession()` |
| Persistencia/reactividad auth | OK estático | `predigol-web/src/App.jsx` usa `supabase.auth.onAuthStateChange()` |
| Rutas protegidas | OK estático | `ProtectedRoute` redirige a `/auth` cuando no hay sesión |
| `/auth` con sesión activa | OK estático | Redirige a `/inicio` si existe sesión |
| Ruta pública `/` | OK estático | Visitante ve `LandingPage`; usuario con sesión redirige a `/inicio` |
| Ruta comodín | OK estático | Redirige a `/inicio` con sesión o `/` sin sesión |

Rutas protegidas por sesión en el frontend:

- `/inicio`
- `/explorar`
- `/equipos/:entityName`
- `/torneos/:entityName`
- `/ranking`
- `/pronosticos`
- `/ligas`
- `/ligas/:ligaId`
- `/partidos/:partidoId`
- `/notificaciones`
- `/estadisticas`
- `/perfil`
- `/admin`
- `/admin/partidos`
- `/admin/modelo`

### Auth

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Login | PENDIENTE VALIDACIÓN MANUAL | `AuthPage.jsx` llama `iniciarSesion`; no se ejecutó login |
| Registro | NO EJECUTADO | No se crearon usuarios |
| Logout | PENDIENTE VALIDACIÓN MANUAL | `ProfilePage.jsx` llama `cerrarSesionCuenta()` / `supabase.auth.signOut()` |
| Persistencia de sesión | PENDIENTE VALIDACIÓN MANUAL | Requiere navegador con cuenta real |
| Cambio entre cuentas | PENDIENTE VALIDACIÓN MANUAL | Requiere navegador con cuentas reales |
| Recuperación de contraseña | PENDIENTE PRODUCTO | La UI actual de `/auth` no expone flujo visible de recuperación |

### Roles Admin

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Detección admin | OK estático | `isAdminUser(profile)` acepta `rol === "admin"` o `es_admin` |
| `/admin` no admin | PENDIENTE VALIDACIÓN MANUAL | `AdminDashboardPage.jsx` muestra acceso denegado si no es admin |
| `/admin/partidos` no admin | PENDIENTE VALIDACIÓN MANUAL | Debe validarse desde navegador real |
| `/admin/modelo` no admin | PENDIENTE VALIDACIÓN MANUAL | `ModelAdminPage.jsx` muestra acceso restringido si no es admin |
| Acciones sensibles admin | NO EJECUTADAS | No se pulsaron botones ni se llamó a endpoints mutables |

### Premium Y Contenido Bloqueado

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Plan usuario | PENDIENTE VALIDACIÓN MANUAL | `ProfilePage.jsx` usa RPC `obtener_plan_usuario` |
| Predicciones visibles | PENDIENTE VALIDACIÓN MANUAL | `PronosticosPage.jsx` usa `obtenerPronosticosModelo()` |
| Premium bloqueado | PENDIENTE VALIDACIÓN MANUAL | UI contempla `isLocked` y etiqueta `Premium bloqueado` |
| Detalle premium bloqueado | PENDIENTE VALIDACIÓN MANUAL | `PartidoDetailPage.jsx` oculta probabilidades/xG/confianza si `is_locked` |

### Secretos Y API-Football

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Service role en frontend | OK estático | No se encontraron `service_role`, `SERVICE_ROLE`, `SUPABASE_SERVICE`, `sb_secret`, `SUPABASE_SERVICE_ROLE_KEY` en `predigol-web/src`, `public`, `index.html` ni `.env.example` |
| Clave API-Football en frontend | OK estático | No se encontraron `API_FOOTBALL_KEY`, `FOOTBALL_API_KEY`, `x-rapidapi-key` ni `X-RapidAPI-Key` en frontend revisado |
| Llamada directa a API-Football desde frontend | OK estático con cautela | No se observó llamada directa a RapidAPI/API-Football; la acción admin usa Edge Function `sync-live-fixtures` |
| Llamadas automáticas a API-Football | OK estático con cautela | La sincronización aparece asociada a submit/click admin; no se ejecutó |
| Service role en backend/scripts | NO APLICABLE A FRONTEND | Existen scripts y migraciones con service role para operación backend; no se usaron en esta fase |

## Checklist Manual Del Propietario

Registrar solo `OK`, `ERROR` o `PENDIENTE VALIDACIÓN MANUAL`. No pegar correos, contraseñas, JWT, refresh tokens, cookies, capturas con datos personales, headers `Authorization` ni valores de local/session storage.

### Visitante Sin Sesión

| Ítem | Estado |
| --- | --- |
| Página principal | OK público; pendiente confirmar render visual en navegador |
| `/auth` | OK técnico público; pendiente confirmar formulario visual en navegador |
| `/perfil` protegido | PENDIENTE VALIDACIÓN MANUAL |
| `/admin` protegido | PENDIENTE VALIDACIÓN MANUAL |
| `/admin/partidos` protegido | PENDIENTE VALIDACIÓN MANUAL |
| `/admin/modelo` protegido | PENDIENTE VALIDACIÓN MANUAL |
| Recarga directa | OK técnico SPA; pendiente navegador real |
| Botón Atrás | PENDIENTE VALIDACIÓN MANUAL |
| Pantallas blancas o loops | PENDIENTE VALIDACIÓN MANUAL |

### Usuario Gratuito

Estado general: **PENDIENTE VALIDACIÓN MANUAL**.

| Ítem | Estado |
| --- | --- |
| Login | PENDIENTE VALIDACIÓN MANUAL |
| Persistencia al recargar | PENDIENTE VALIDACIÓN MANUAL |
| Perfil correcto | PENDIENTE VALIDACIÓN MANUAL |
| Plan gratuito | PENDIENTE VALIDACIÓN MANUAL |
| Contenido gratuito | PENDIENTE VALIDACIÓN MANUAL |
| Contenido premium bloqueado | PENDIENTE VALIDACIÓN MANUAL |
| Estado sin predicciones | PENDIENTE VALIDACIÓN MANUAL |
| Rutas admin bloqueadas | PENDIENTE VALIDACIÓN MANUAL |
| Logout | PENDIENTE VALIDACIÓN MANUAL |
| Protección después del logout | PENDIENTE VALIDACIÓN MANUAL |

### Usuario Premium

Estado general: **PENDIENTE VALIDACIÓN MANUAL**.

| Ítem | Estado |
| --- | --- |
| Login | PENDIENTE VALIDACIÓN MANUAL |
| Perfil correcto | PENDIENTE VALIDACIÓN MANUAL |
| Plan premium | PENDIENTE VALIDACIÓN MANUAL |
| Contenido premium habilitado | PENDIENTE VALIDACIÓN MANUAL |
| Estado vacío premium | PENDIENTE VALIDACIÓN MANUAL |
| Rutas admin bloqueadas | PENDIENTE VALIDACIÓN MANUAL |
| Logout | PENDIENTE VALIDACIÓN MANUAL |
| Sin mezcla con cuenta anterior | PENDIENTE VALIDACIÓN MANUAL |

### Administrador

Estado general: **PENDIENTE VALIDACIÓN MANUAL**.

| Ítem | Estado |
| --- | --- |
| Login | PENDIENTE VALIDACIÓN MANUAL |
| `/admin` | PENDIENTE VALIDACIÓN MANUAL |
| `/admin/partidos` | PENDIENTE VALIDACIÓN MANUAL |
| `/admin/modelo` | PENDIENTE VALIDACIÓN MANUAL |
| Cero partidos | PENDIENTE VALIDACIÓN MANUAL |
| Cero predicciones | PENDIENTE VALIDACIÓN MANUAL |
| Sincronización bloqueada | PENDIENTE VALIDACIÓN MANUAL |
| Logout | PENDIENTE VALIDACIÓN MANUAL |
| Protección después del logout | PENDIENTE VALIDACIÓN MANUAL |
| Botones sensibles no pulsados | PENDIENTE VALIDACIÓN MANUAL |

Botones/acciones sensibles que no deben pulsarse durante la validación manual:

- Activar premium manual.
- Guardar alias o cambiar estado de alias.
- Importar Google Sheets.
- Sincronizar Google Sheets.
- Guardar sincronización automática.
- Activar cron API-Football.
- Sincronizar API-Football.
- Importar temporada.
- Publicar predicciones.
- Cerrar/editar resultados de partidos reales.

### Navegador

Estado general: **PENDIENTE VALIDACIÓN MANUAL**.

| Ítem | Estado |
| --- | --- |
| Console sin errores sensibles | PENDIENTE VALIDACIÓN MANUAL |
| Network sin localhost | PENDIENTE VALIDACIÓN MANUAL |
| Network sin API-Football | PENDIENTE VALIDACIÓN MANUAL |
| Sin mixed content | PENDIENTE VALIDACIÓN MANUAL |
| Storage sin secretos | PENDIENTE VALIDACIÓN MANUAL |
| Sesión eliminada/inutilizada tras logout | PENDIENTE VALIDACIÓN MANUAL |

Validación recomendada en navegador real:

- Abrir DevTools antes del login.
- Filtrar Network por `localhost`, `127.0.0.1`, `api-football`, `rapidapi` y `http://`.
- Confirmar que no aparecen JWT, refresh tokens, cookies, service role ni claves privadas en Console.
- Confirmar que tras logout las rutas protegidas redirigen o bloquean acceso.
- Confirmar que Storage no conserva secretos reutilizables después del logout.

### Recuperación De Contraseña

Estado: **PENDIENTE PRODUCTO**.

La pantalla `/auth` revisada estáticamente ofrece login y creación de cuenta, pero no expone un flujo visible de recuperación de contraseña.

## Criterios De Clasificación Para El Propietario

### OK

- Visitante sin sesión no accede a datos privados ni paneles admin.
- Login manual funciona con cuenta real existente.
- Recarga mantiene sesión solo cuando corresponde.
- Logout inutiliza la sesión y bloquea rutas protegidas.
- Usuario gratuito ve plan gratuito y contenido premium bloqueado.
- Usuario premium ve plan premium y contenido premium habilitado si existen datos premium.
- Usuario no admin no accede a paneles admin.
- Admin puede leer paneles sin ejecutar acciones sensibles.
- Estados vacíos se muestran como mensajes controlados, no como pantalla blanca.
- Console/Network/Storage no exponen secretos.

### ERROR

- Usuario sin sesión accede a `/perfil`, `/inicio`, `/admin`, `/admin/partidos` o `/admin/modelo` sin bloqueo.
- Usuario gratuito o premium no admin accede a panel admin real.
- Usuario gratuito ve probabilidades/xG/confianza/marcador probable de contenido premium bloqueado.
- Logout deja una sesión reutilizable o permite volver a rutas protegidas.
- Hay pantalla blanca, loop de redirección o error sensible visible.
- Console, Network o Storage exponen JWT, refresh token, cookie, Authorization, service role o clave privada.
- Se dispara una sincronización/importación/API-Football sin acción explícita del admin.

### PENDIENTE VALIDACIÓN MANUAL

- Cualquier flujo que requiera credenciales reales.
- Login, logout, persistencia, cambio entre cuentas y comprobación real de navegador.
- Validaciones de roles gratuito, premium y admin.

### PENDIENTE PRODUCTO

- Recuperación de contraseña desde la UI actual.

## Observaciones No Sensibles

- Visitante sin sesión: validación pública ejecutada para disponibilidad, HTTPS, assets y rutas SPA; redirecciones visuales/protección efectiva quedan pendientes en navegador real.
- Usuario gratuito: PENDIENTE VALIDACIÓN MANUAL.
- Usuario premium: PENDIENTE VALIDACIÓN MANUAL.
- Administrador: PENDIENTE VALIDACIÓN MANUAL.
- Login, logout, persistencia de sesión y cambio entre cuentas: PENDIENTE VALIDACIÓN MANUAL.
- Consola, Network y almacenamiento del navegador: PENDIENTE VALIDACIÓN MANUAL.
- Recuperación de contraseña: PENDIENTE PRODUCTO.
- No se recibieron ni almacenaron credenciales.

## Resolucion Posterior De Pendientes

- La validacion publica de headers fue completada posteriormente en la Fase 8H.
- La validacion autenticada de usuario gratuito, usuario premium y administrador fue completada posteriormente en la Fase 8I.
- La persistencia de sesion, logout y aislamiento entre cuentas fueron validados posteriormente en la Fase 8I.
- El estado historico de 8F no se reescribe porque representa la evidencia disponible en el momento de su ejecucion.
- Recuperacion de contrasena sigue pendiente de producto.

## Clasificacion Final Del Documento

**CONSERVAR, CORREGIR Y VERSIONAR COMO EVIDENCIA HISTORICA**
