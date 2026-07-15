# Auditoria Fase 8G PrediGol

## Estado De La Fase

**IMPLEMENTACIÓN COMPLETADA — VALIDACIÓN PÚBLICA PENDIENTE DE REDESPLIEGUE**

URL objetivo: `https://predigol.onrender.com`.

La validacion autenticada de usuario gratuito, usuario premium y administrador permanece pendiente de ejecucion manual por el propietario desde navegador real.

## Configuracion Encontrada

| Elemento | Resultado |
| --- | --- |
| `render.yaml` | No existia antes de 8G. |
| `_headers` / `public/_headers` | No existia configuracion versionada aplicable. |
| `static.json` | No existe. |
| `predigol-web/vite.config.js` | Configuracion Vite minima, sin headers. |
| `vercel.json` | Existe en raiz y `predigol-web/`, pero no se aplica al despliegue Render actual. |
| Render Dashboard | Documentado como Static Site con `Root Directory` `predigol-web`, build `npm ci && npm run build`, publish `dist` y rewrite SPA manual. |

Render documenta headers versionables en Blueprint mediante `render.yaml` para servicios `runtime: static`, con campos `headers` y `routes`. Por eso la Fase 8G agrego `render.yaml` en la raiz del repo como fuente versionada para Render.

## Archivos Modificados

| Archivo | Cambio |
| --- | --- |
| `render.yaml` | Agregado con Static Site, headers de seguridad y rewrite SPA. |
| `docs/auditoria-fase8g-predigol.md` | Agregado este reporte. |
| `docs/qa-despliegue-predigol.md` | Agregado checklist 8G. |
| `docs/checklist-despliegue-predigol.md` | Agregado checklist de despliegue 8G. |
| `docs/roadmap-predigol.md` | Agregado estado de Fase 8G. |

No se modifico `docs/operacion-render-predigol.md`; tenia cambios previos ajenos y se preservo intacto.

## Headers Anteriores En Produccion

Observado por `curl` en `https://predigol.onrender.com` antes de redespliegue 8G:

| Header | Estado |
| --- | --- |
| `Strict-Transport-Security` | Presente. |
| `X-Content-Type-Options` | Presente con `nosniff`. |
| `Content-Security-Policy` | No observado. |
| `Referrer-Policy` | No observado. |
| `X-Frame-Options` | No observado. |
| `Permissions-Policy` | No observado. |

## Headers Configurados En `render.yaml`

| Header | Valor |
| --- | --- |
| `Content-Security-Policy` | Ver seccion CSP final. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=315360000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |

Tambien queda versionado el rewrite SPA:

| Tipo | Source | Destination |
| --- | --- | --- |
| `rewrite` | `/*` | `/index.html` |

## CSP Final

```text
default-src 'self'; base-uri 'self'; connect-src 'self' https://aadkcyoyjxglrbiwfdgw.supabase.co wss://aadkcyoyjxglrbiwfdgw.supabase.co; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https://aadkcyoyjxglrbiwfdgw.supabase.co https://media.api-sports.io; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'
```

## Justificacion De Origenes Permitidos

| Directiva | Origen | Justificacion |
| --- | --- | --- |
| `default-src` | `'self'` | Base cerrada para recursos no declarados. |
| `base-uri` | `'self'` | Evita inyeccion de base URL externa. |
| `connect-src` | `'self'` | Permite assets propios y service worker contra el mismo origen. |
| `connect-src` | `https://aadkcyoyjxglrbiwfdgw.supabase.co` | Supabase Auth, REST, RPC y Edge Functions publicas usadas por el frontend. |
| `connect-src` | `wss://aadkcyoyjxglrbiwfdgw.supabase.co` | Realtime usado por canales `predigol-partidos-live` y `predigol-notificaciones-live`. |
| `font-src` | `'self'` | No hay fuentes externas ni `@font-face` remoto. |
| `form-action` | `'self'` | Formularios de la app no postean a dominios externos; Auth usa fetch JS. |
| `frame-ancestors` | `'none'` | Bloquea embedding/clickjacking. |
| `img-src` | `'self'` | Iconos, manifest, social preview y assets locales. |
| `img-src` | `data:` | Fallback seguro para imagenes embebidas si algun componente/libreria usa data URI. |
| `img-src` | `https://aadkcyoyjxglrbiwfdgw.supabase.co` | Imagenes o storage publico del proyecto Supabase si se usan en perfiles/equipos. |
| `img-src` | `https://media.api-sports.io` | Escudos de equipos de API-Sports/API-Football almacenados como `logo_url`. |
| `manifest-src` | `'self'` | `manifest.webmanifest` local. |
| `object-src` | `'none'` | La app no usa plugins/objects. |
| `script-src` | `'self'` | Bundle Vite local. No se habilita `unsafe-eval`. |
| `style-src` | `'self'` | CSS generado por Vite. No se habilita `unsafe-inline`. |
| `worker-src` | `'self'` | Service worker local `/sw.js`. |

No se usaron comodines `*`. No se habilito `unsafe-eval`. No se habilito `unsafe-inline` porque el HTML final carga CSS desde archivo y no hay estilos inline necesarios para arrancar la app.

## Pruebas Ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm test` en `predigol-web` | OK: 90 tests pasaron. |
| `npm run lint` en `predigol-web` | OK. |
| `npm run build` en `predigol-web` | OK, build Vite completado. |
| `npm run preview -- --host 127.0.0.1` | OK, preview local arranco. |
| `curl` preview local `/` | `200 OK`. |
| `curl` preview local `/auth` | `200 OK`. |
| `curl` preview local `/inicio` | `200 OK`. |
| `curl` preview local `/pronosticos` | `200 OK`. |
| `curl` preview local `/perfil` | `200 OK`. |
| `curl` preview local `/admin` | `200 OK`. |
| `curl` preview local `/admin/partidos` | `200 OK`. |
| `curl` preview local `/admin/modelo` | `200 OK`. |
| `curl` preview local JS principal | `200 OK`. |
| `curl` preview local CSS principal | `200 OK`. |

No se ejecuto `npm ci` porque `node_modules` ya estaba instalado y no era necesario reinstalar dependencias para esta fase.

## Revision De Build Y Dist

| Control | Resultado |
| --- | --- |
| `dist/index.html` | Generado con JS y CSS esperados. |
| `dist/assets/index-D7Ql_IWE.js` | Generado. |
| `dist/assets/index-wf8JKCK1.css` | Generado. |
| `dist/sw.js` | Generado desde `public/sw.js`. |
| `dist/manifest.webmanifest` | Generado. |
| Source maps | No observados. |

## Revision Estatica De Secretos

Busqueda ejecutada en frontend y `dist` para patrones sensibles:

| Patron | Resultado seguro |
| --- | --- |
| `service_role` | No encontrado en frontend/dist. |
| `SUPABASE_SERVICE_ROLE_KEY` | No encontrado en frontend/dist. |
| `FOOTBALL_API_KEY` | No encontrado en frontend/dist. |
| `API_FOOTBALL_KEY` | No encontrado en frontend/dist. |
| `sb_secret` | No encontrado en frontend/dist. |
| `x-rapidapi-key` / `X-RapidAPI-Key` | No encontrado en frontend/dist. |
| `VITE_*SECRET` / `VITE_*SERVICE` | No encontrado en frontend/dist. |

El bundle contiene una publishable key publica de Supabase, esperada para el cliente frontend. No es service role.

## URLs Externas Observadas En Frontend/Dist

| Origen o patron | Clasificacion |
| --- | --- |
| `https://aadkcyoyjxglrbiwfdgw.supabase.co` | Permitido en CSP para Supabase publico. |
| `wss://...supabase.co` construido por Supabase | Permitido en CSP para Realtime. |
| `https://media.api-sports.io` | Permitido solo en `img-src` para logos de equipos. |
| `https://docs.google.com/spreadsheets/...` | Placeholder visible en admin; no agregado a `connect-src` porque no debe consumirse durante smoke 8G. |
| `localhost` / `127.0.0.1` | Strings internos de librerias y desarrollo; no autorizados por CSP en produccion. |
| `http://www.w3.org/...` | Namespaces SVG/XML internos, no llamadas de red. |

## Riesgos O Incompatibilidades

| Riesgo | Estado |
| --- | --- |
| Render puede conservar configuracion dashboard si no se sincroniza Blueprint. | Pendiente confirmar en redespliegue. |
| Nombre de servicio en `render.yaml` debe coincidir con el servicio Render existente. | Se uso `predigol`, consistente con `predigol.onrender.com`; confirmar en dashboard. |
| `style-src 'self'` podria bloquear estilos inline futuros. | No bloquea el build actual; validar en navegador tras deploy. |
| `img-src` restringe imagenes externas a Supabase y `media.api-sports.io`. | Si existen logos alojados en otro CDN, fallaran y debe agregarse origen especifico, no `*`. |
| Vite preview no aplica headers Render. | Validacion publica queda pendiente de redespliegue. |

## Pendiente De Redespliegue

- Sincronizar/aplicar `render.yaml` en Render.
- Confirmar que el servicio existente es `predigol` y usa `runtime: static`.
- Confirmar que `rootDir`, `buildCommand`, `staticPublishPath`, `headers` y `routes` quedaron aplicados.
- Redesp desplegar desde `main` cuando el propietario lo apruebe.
- Ejecutar `curl -D - https://predigol.onrender.com` y confirmar headers nuevos en `/`, `/auth`, assets y rutas SPA.

## Pendiente De Validacion Manual

- Login usuario gratuito.
- Logout usuario gratuito.
- Perfil y plan gratuito.
- Contenido gratuito.
- Predicciones premium bloqueadas.
- Rutas admin bloqueadas para gratuito.
- Login usuario premium.
- Plan premium y contenido premium autorizado.
- Ausencia de acceso admin para premium no admin.
- Login administrador.
- Acceso a `/admin`, `/admin/modelo` y `/admin/partidos`.
- No pulsar acciones que consuman API-Football.
- Console, Network y Storage sin secretos ni errores sensibles.
- Recuperacion de contraseña sigue `PENDIENTE PRODUCTO`.

## Checklist Autenticado Preparado

### Usuario Gratuito

| Control | Estado |
| --- | --- |
| Registro o login | BLOQUEADO POR FALTA DE CREDENCIALES |
| Acceso a perfil | BLOQUEADO POR FALTA DE CREDENCIALES |
| Cierre de sesión | BLOQUEADO POR FALTA DE CREDENCIALES |
| Visualización de contenido gratuito | BLOQUEADO POR FALTA DE CREDENCIALES |
| Predicciones premium bloqueadas | BLOQUEADO POR FALTA DE CREDENCIALES |
| Rutas administrativas bloqueadas | BLOQUEADO POR FALTA DE CREDENCIALES |

### Usuario Premium

| Control | Estado |
| --- | --- |
| Login | BLOQUEADO POR FALTA DE CREDENCIALES |
| Reconocimiento correcto de la suscripción | BLOQUEADO POR FALTA DE CREDENCIALES |
| Acceso al contenido premium autorizado | BLOQUEADO POR FALTA DE CREDENCIALES |
| Ausencia de acceso a administración | BLOQUEADO POR FALTA DE CREDENCIALES |
| Cierre de sesión | BLOQUEADO POR FALTA DE CREDENCIALES |

### Administrador

| Control | Estado |
| --- | --- |
| Login | BLOQUEADO POR FALTA DE CREDENCIALES |
| Acceso a `/admin` | BLOQUEADO POR FALTA DE CREDENCIALES |
| Acceso a `/admin/modelo` | BLOQUEADO POR FALTA DE CREDENCIALES |
| Acceso a `/admin/partidos` | BLOQUEADO POR FALTA DE CREDENCIALES |
| Bloqueo de acciones que consuman API-Football durante smoke test | NO VERIFICADO |
| Cierre de sesión | BLOQUEADO POR FALTA DE CREDENCIALES |

## Confirmaciones De Seguridad

- No se recibieron credenciales.
- No se almacenaron credenciales.
- No se ejecuto login automatizado.
- No se uso service role.
- No se modificaron `.env` reales.
- No se ejecuto API-Football.
- No se tocaron backend, modelos, RLS, RPCs ni migraciones.
- No se hizo commit ni push.
- Se preservaron cambios previos ajenos, incluido `docs/operacion-render-predigol.md`.
