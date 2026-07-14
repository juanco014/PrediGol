# Release PrediGol

## Fase 8B - Preparacion Sin Despliegue

Estado: candidato preparado para validacion previa. No publicado, no tagueado y no desplegado.

| Campo | Valor |
| --- | --- |
| Version propuesta | `v0.8.0-rc.1` |
| Motivo | Release candidate pre-1.0 para frontend desplegable sin fixtures actuales. |
| Commit de referencia | `1cc7eb8 feat: preparar despliegue seguro de PrediGol sin fixtures actuales` |
| Rama | `main` |
| Fecha | 2026-07-14 |
| Estado | Preparado para validacion tecnica; pendiente de despliegue manual futuro. |

No usar `v1.0.0` todavia: las predicciones proximas reales, la sincronizacion de fixtures actuales y la publicacion recurrente siguen bloqueadas hasta contar con fuente valida.

## Componentes Incluidos

- Frontend Vite/React en `predigol-web`.
- Rutas SPA protegidas por sesion cuando corresponde.
- Cliente Supabase publico con `VITE_SUPABASE_URL` y publishable/anon key.
- Estados vacios para partidos y predicciones sin tratar ausencia de datos como fallo critico.
- Panel administrativo en las funciones ya disponibles y protegidas por permisos/RPC.
- Configuracion Vercel versionada en `vercel.json` y `predigol-web/vercel.json`.
- CI sin secretos en `.github/workflows/ci.yml`.
- Preflight local `scripts/verificar_despliegue_predigol.py`.
- Documentacion de despliegue, QA y rollback.

## Componentes No Incluidos

- Despliegue real en Vercel, Netlify u otro proveedor.
- Tags Git o release remoto.
- Cambios en Supabase Auth, RLS o datos.
- Importacion real de fixtures.
- Sincronizacion automatica de fixtures actuales.
- Publicacion real de predicciones con `--apply`.
- Consulta real a API-Football.
- Cron de publicacion o sincronizacion.
- Fixtures demo o datos ficticios.

## Estado Funcional

### Disponible En Este Release

- Cargar la aplicacion publica.
- Autenticarse si Supabase Auth esta configurado.
- Cerrar sesion.
- Consultar perfil y plan del usuario.
- Acceder a rutas permitidas segun sesion y permisos.
- Mostrar estados vacios cuando no hay partidos o predicciones.
- Usar ranking, ligas, perfil, notificaciones y vistas de exploracion segun datos existentes.
- Usar el panel administrativo dentro de las funciones ya habilitadas.

### Bloqueado En Este Release

- Predicciones proximas reales.
- Promesa de cobertura de partidos en vivo.
- Consulta de temporadas actuales en API-Football.
- Sincronizacion automatica de fixtures actuales.
- Cron de publicacion real.
- Importacion o publicacion con `--apply`.
- Escrituras administrativas desde validaciones automatizadas.

## Configuracion De Build

| Item | Valor esperado |
| --- | --- |
| Root Directory recomendado | `predigol-web` |
| Instalacion | `npm ci` |
| Tests | `npm test` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Directorio de salida | `dist` |
| Preview local seguro | `npm run preview`, solo local y sin tuneles |
| Runtime | SPA estatica servida por HTTPS |

Si el proveedor despliega desde la raiz del monorepo, debe apuntar el build al subproyecto `predigol-web` y conservar el directorio de salida `predigol-web/dist` o usar la configuracion equivalente del proveedor.

## Rutas SPA Y Assets

El frontend usa `BrowserRouter` y rutas declaradas en `predigol-web/src/App.jsx`. La configuracion Vercel reescribe `/(.*)` a `/index.html`, por lo que las rutas directas deben cargar la SPA y luego resolver permisos en cliente.

Rutas minimas a validar:

- `/`
- `/auth`
- `/inicio`
- `/pronosticos`
- `/perfil`
- `/admin`
- `/admin/partidos`
- `/admin/modelo`
- `/partidos/<partidoId>`
- `/ligas/<ligaId>`
- `/equipos/<entityName>`
- `/torneos/<entityName>`

Assets publicos versionados:

- `predigol-web/public/favicon.svg`
- `predigol-web/public/icons.svg`
- `predigol-web/public/manifest.webmanifest`
- `predigol-web/public/robots.txt`
- `predigol-web/public/social-preview.svg`
- `predigol-web/public/sw.js`

## Headers Esperados

Los archivos `vercel.json` y `predigol-web/vercel.json` definen headers para todas las rutas:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` sin camara, microfono ni geolocalizacion.
- `Content-Security-Policy` limitada a self, Supabase y recursos seguros necesarios.

## Variables Publicas Requeridas

Configurar solo nombres y valores reales en el proveedor, nunca en Git.

| Variable | Proposito | Obligatoria |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | URL publica del proyecto Supabase usada por el cliente web. | Si |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publica publishable para Supabase JS. | Si, salvo alternativa legacy |
| `VITE_SUPABASE_ANON_KEY` | Alternativa publica legacy si no se usa publishable key. | Opcional alternativa |
| `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` | Clave publica para Web Push si se habilita push. | Opcional |

## Variables Prohibidas En Frontend

No configurar estas variables en Vercel/Netlify como variables frontend ni exponerlas con prefijo `VITE_`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_API_KEY`
- `API_FOOTBALL_KEY`
- `SUPABASE_JWT_SECRET`
- Passwords de usuarios de prueba.
- JWT privados.
- Variables de importadores, sincronizadores o publicadores.
- Credenciales de proveedores de pago o correo si no son publicas.

## Comprobacion De Secretos En Bundle

Despues de cada build o despliegue futuro:

1. Generar `npm run build`.
2. Inspeccionar `predigol-web/dist` de forma estatica.
3. Confirmar ausencia de claves administrativas, JWT privados, variables de API-Football, passwords de prueba, rutas locales y archivos `.env`.
4. En el navegador, revisar consola y Network sin copiar valores sensibles.
5. Confirmar que solo aparecen variables publicas esperadas.

No publicar capturas ni logs con tokens, correos reales o respuestas privadas.

## Supabase Auth Manual

No modificar Supabase por SQL ni API para este release. Configurar manualmente en el dashboard cuando se autorice el despliegue.

| Configuracion | Placeholder |
| --- | --- |
| Site URL produccion | `https://dominio-produccion.example` |
| Redirect URL produccion | `https://dominio-produccion.example/**` |
| URL local desarrollo | `http://localhost:5173/**` |
| Preview URLs autorizadas | `https://preview-autorizado.example/**` |

Checklist Auth:

- Definir `Site URL` con HTTPS de produccion.
- Agregar solo redirect URLs necesarias para produccion, local y previews autorizados.
- Evitar comodines amplios que permitan dominios no controlados.
- Confirmar recuperacion de contrasena si la pantalla ya esta implementada.
- Confirmar politica de confirmacion de correo segun producto.
- Validar logout y limpieza de sesion.
- Eliminar URLs temporales cuando dejen de usarse.

## Checklist Previo Al Despliegue Futuro

- Confirmar commit a desplegar: `1cc7eb8` o un commit posterior aprobado.
- Confirmar version propuesta o reemplazarla por una version aprobada.
- Confirmar CI verde en el commit que se desplegara.
- Ejecutar `npm ci`, `npm test`, `npm run lint` y `npm run build` en `predigol-web`.
- Ejecutar pruebas Python si hubo cambios compartidos.
- Escanear `predigol-web/dist` para secretos y rutas locales.
- Confirmar variables publicas del proveedor.
- Confirmar que no hay service role ni API-Football en frontend.
- Confirmar Auth URLs en Supabase Dashboard.
- Confirmar que API-Football, importadores, sincronizadores y publicadores reales siguen bloqueados.
- Confirmar responsable y ventana de despliegue.

## Smoke Test Posterior Al Despliegue Futuro

### Publico

- `/` carga sin pantalla en blanco.
- Los assets JS, CSS, SVG, manifest y service worker cargan por HTTPS.
- Recargar rutas directas no devuelve 404 del proveedor.
- `/pronosticos` redirige o protege correctamente si no hay sesion.
- El estado sin partidos se muestra como ausencia de datos, no como error fatal.
- El estado sin predicciones se muestra como limitacion temporal, no como fallo de cuenta.

### Autenticacion

- Registro o login funciona segun lo implementado.
- Logout limpia la sesion y redirige de forma esperada.
- Recuperacion de contrasena funciona si esta habilitada en producto.
- Redireccion despues del login apunta a `/inicio` o ruta esperada.
- `/perfil` carga con sesion valida.
- Rutas protegidas sin sesion redirigen a `/auth`.

### Usuario Gratuito

- Puede ver contenido permitido.
- El contenido premium queda bloqueado correctamente.
- No aparecen errores cuando no hay predicciones.
- El plan gratuito se muestra correctamente.

### Usuario Premium

- El plan premium se reconoce mediante RPC/perfil.
- El acceso premium permitido funciona.
- Si no existen predicciones premium, se muestra estado vacio correcto.
- No se exponen detalles premium a usuarios no autorizados.

### Administrador

- `/admin` carga solo para usuario autorizado.
- `/admin/partidos` y `/admin/modelo` estan protegidas.
- Cero predicciones se distingue de error de sistema.
- Controles de sincronizacion real permanecen bloqueados o no ejecutados.
- No hay consumo accidental de API-Football.

### Seguridad

- No hay service role, JWT privados ni claves API-Football en consola, bundle o respuestas.
- Los mensajes de error no exponen detalles sensibles.
- HTTPS esta activo.
- Redirecciones quedan limitadas a dominios autorizados en Supabase.
- CSP y headers de seguridad se entregan en rutas principales.

## Rollback Conservador

1. Identificar el ultimo deployment funcional en el proveedor.
2. Revertir desde el proveedor o redesplegar el commit estable aprobado.
3. No revertir migraciones Supabase automaticamente.
4. No modificar datos, RLS ni Auth como parte del rollback frontend.
5. Validar `/`, `/auth`, `/inicio`, `/pronosticos`, `/perfil` y rutas admin despues del rollback.
6. Mantener predicciones, importadores, sincronizaciones y publicaciones reales bloqueadas.
7. Registrar motivo, hora, commit revertido y commit estable usado.

## Criterios De Aprobacion

- CI y validaciones locales pasan.
- Build reproducible con `npm ci` y sin secretos locales.
- `dist` contiene `index.html`, assets y archivos publicos esperados.
- Escaneo de `dist` sin service role, claves API-Football, JWT privados, passwords de prueba, rutas locales ni `.env`.
- Rutas SPA documentadas y cubiertas por fallback.
- Variables manuales identificadas.
- Smoke test post-despliegue definido.
- Rollback documentado.
- Limitaciones por ausencia de fixtures actuales comunicadas.

## Criterios De Rechazo

- Worktree sucio no explicado antes de release.
- Build, lint o tests fallan.
- `dist` contiene secretos, rutas locales o archivos `.env`.
- Falta configuracion de Auth o variables publicas.
- Rutas directas SPA devuelven 404 en proveedor.
- El frontend promete predicciones reales sin fixtures actuales.
- Se detecta consumo no autorizado de API-Football.
- Se requiere modificar Supabase, V1 o V2 para que cargue el frontend.

## Fase 8C - Validacion Post-Despliegue Render

Release candidate desplegado:

| Campo | Valor |
| --- | --- |
| Version | `v0.8.0-rc.1` |
| Commit | `26cc7305220a5efacc4a9cdacf61cd27cb5b7bd0` |
| Proveedor | Render |
| URL | `https://predigol.onrender.com` |
| Fecha validacion | 2026-07-14 |

Resultado:

- OK: HTTPS activo y `/` responde `200 OK`.
- OK: `index.html` y assets JS/CSS cargan.
- OK corregido: rutas directas SPA ya responden `200 OK` y entregan `index.html` despues de configurar rewrite `/* -> /index.html` en Render.
- OK: `dist` local no contiene archivos `.map` ni `.env`.
- OK: no se detectaron nombres de secretos backend en `dist` local.
- ADVERTENCIA: Render no entrega los headers `Referrer-Policy`, `X-Frame-Options`, `Content-Security-Policy` ni `Permissions-Policy` definidos para Vercel en `predigol-web/vercel.json`.
- OK manual confirmado: Supabase Auth tiene Site URL `https://predigol.onrender.com`, Redirect URL `https://predigol.onrender.com/**` y conserva `http://localhost:5173/**` para desarrollo.
- PENDIENTE MANUAL: validar login/logout, usuarios gratis/premium/admin, recuperacion de contrasena y confirmacion de correo en navegador real.
- BLOQUEADO: predicciones en vivo, importadores, sincronizadores, publicadores y API-Football siguen sin activarse.

No se ejecutaron importadores, sincronizadores, publicadores, API-Football, cambios Supabase, cambios V1/V2, despliegues adicionales, commits ni push durante el diagnostico.

## Auditoria De Dependencias Npm - 2026-07-14

Estado final: `APROBADO CON CORRECCION MENOR`.

La auditoria inicial de `predigol-web` reporto 2 vulnerabilidades high:

| Paquete | Tipo | Alcance | Version instalada | Rango vulnerable | Correccion |
| --- | --- | --- | --- | --- | --- |
| `git` | Dependencia directa de produccion | No importada por `src` ni `scripts`; no aparece en `dist`. | `0.1.5` | `<=0.1.5` | Eliminada por no usarse; no hay version corregida publicada. |
| `mime` | Dependencia transitiva de `git` | No importada directamente; no aparece en `dist`. | `1.2.9` | `<1.4.1` | Eliminada al retirar `git`. |

Analisis de alcance:

- `npm audit --omit=dev` confirmo que el hallazgo estaba en dependencias de produccion, no solo herramientas de desarrollo.
- `npm explain git` mostro que `git` era dependencia directa del proyecto.
- `npm explain mime` mostro que `mime` llegaba solo por `git@0.1.5`.
- `npm view git version versions --json` mostro que la ultima version publicada es `0.1.5`.
- No se encontraron imports de `git` ni `mime` en `src` o `scripts`.
- No se encontraron referencias a `git`, `mime` ni rutas de esos paquetes en `predigol-web/dist`.
- El escenario vulnerable no era alcanzable desde el navegador porque el paquete no entraba al bundle.
- La dependencia directa seguia siendo riesgo innecesario en produccion por estar en `dependencies`.

Correccion aplicada:

- Se ejecuto `npm uninstall git`.
- No se uso `npm audit fix` ni `npm audit fix --force`.
- El cambio elimino `git` de `predigol-web/package.json` y retiro `git`/`mime` de `predigol-web/package-lock.json`.
- `npm ls git mime` queda vacio.
- `npm audit` y `npm audit --omit=dev` quedan en 0 vulnerabilidades.

Riesgo residual:

- Bajo para este release candidate: la dependencia vulnerable fue retirada y no hay evidencia de uso funcional.
- Mantener seguimiento de `npm audit` en cada release, especialmente dependencias marcadas como produccion.
