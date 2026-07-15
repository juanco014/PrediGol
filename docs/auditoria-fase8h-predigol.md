# Auditoria Fase 8H PrediGol

## Estado De La Fase

**BLOQUEADO — VALIDACIÓN DEL BLUEPRINT REQUIERE ACCESO A RENDER**

No se marca la fase como completada porque no se pudo acceder al Render Dashboard para confirmar si el servicio `predigol` esta administrado por Blueprint, revisar la vista previa de cambios, evitar duplicados y aplicar/sincronizar la configuracion sobre el sitio publico existente.

## Rama Y Commit

| Campo | Resultado |
| --- | --- |
| Rama local | `main` |
| Commit remoto validado al inicio de 8H | `ca6f176` |
| Commit `origin/main` al inicio de 8H | `ca6f17631fb4f482346862771c941f29ede5620d` |
| URL publica | `https://predigol.onrender.com` |

Durante 8H se detecto que `render.yaml` en `ca6f176` no parseaba como YAML por el valor CSP sin comillas/bloque. Se corrigio el archivo localmente usando un bloque YAML `>-` sin cambiar la politica CSP.

## Diagnostico De `render.yaml`

| Control | Resultado |
| --- | --- |
| Servicio unico | OK, exactamente 1 entrada en `services`. |
| Nombre | OK, `predigol`. |
| Tipo | OK, `type: web`. |
| Runtime | OK, `runtime: static`. |
| Root Directory | OK, `rootDir: predigol-web`. |
| Build Command | OK, `npm ci && npm run build`. |
| Publish Path | OK, `staticPublishPath: dist`. |
| Rewrite SPA | OK, `source: /*`, `destination: /index.html`. |
| Headers | OK, 6 headers esperados. |
| Variables de entorno | OK, no define `envVars`. |
| Recursos adicionales | OK, no define bases de datos, workers, cron jobs, discos ni servicios extra. |
| Secretos | OK, no contiene service role, API-Football key ni claves privadas. |

Campo no definido deliberadamente:

| Campo | Motivo |
| --- | --- |
| `branch` | Omitido para que Render conserve la rama configurada del servicio existente. Agregarlo sin confirmar Dashboard podria divergir de la configuracion real. |

## Validacion YAML Local

Validaciones ejecutadas con `PyYAML`, ya disponible localmente:

| Control | Resultado |
| --- | --- |
| Sintaxis YAML | OK despues de corregir CSP con bloque `>-`. |
| Objeto raiz | OK, solo `services`. |
| Cantidad de servicios | OK, 1. |
| Campos requeridos de Static Site | OK. |
| Duplicados de headers | OK, no hay duplicados. |
| Tabulaciones | OK, no hay tabulaciones. |
| `git diff --check` | OK para cambios propios; solo advertencias de CRLF. |

Render CLI no esta instalado, por lo que no se pudo ejecutar `render blueprints validate render.yaml`.

## Headers Configurados En Blueprint

| Header | Valor |
| --- | --- |
| `Content-Security-Policy` | Ver CSP esperada. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=315360000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |

## CSP Esperada

```text
default-src 'self'; base-uri 'self'; connect-src 'self' https://aadkcyoyjxglrbiwfdgw.supabase.co wss://aadkcyoyjxglrbiwfdgw.supabase.co; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https://aadkcyoyjxglrbiwfdgw.supabase.co https://media.api-sports.io; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'
```

## Administracion Del Servicio En Render

No verificado. Requiere Render Dashboard.

### Caso A: Servicio Ya Administrado Por Blueprint

1. Abrir Render Dashboard.
2. Ir a Blueprints.
3. Identificar el Blueprint asociado al sitio `predigol`.
4. Confirmar repositorio y rama.
5. Confirmar ruta del archivo `render.yaml` en la raiz del repo.
6. Ejecutar Sync solo sobre ese Blueprint.
7. Revisar la vista previa antes de aplicar.
8. Confirmar que Render muestra modificacion del recurso existente `predigol`, no creacion de otro servicio.

### Caso B: Servicio No Administrado Por Blueprint

No asumir que crear un Blueprint actualiza automaticamente el sitio existente.

Alternativa recomendada:

1. Usar la opcion de Render para generar/asociar Blueprint desde recursos existentes, si esta disponible.
2. Comparar la configuracion generada por Render con `render.yaml`.
3. Mantener exactamente el nombre `predigol`.
4. Confirmar `rootDir: predigol-web`.
5. Confirmar `buildCommand: npm ci && npm run build`.
6. Confirmar `staticPublishPath: dist`.
7. Confirmar rama, repositorio y variables publicas existentes sin imprimir valores.
8. Confirmar que Render identifica el recurso existente antes de aplicar.

Alternativa conservadora:

1. Aplicar temporalmente los headers directamente en Static Site > Settings > Custom Headers.
2. Mantener el rewrite SPA actual `/* -> /index.html`.
3. Mantener `render.yaml` como configuracion versionada pendiente de adopcion.
4. Documentar que la infraestructura aplicada y la versionada aun difieren.

## Proteccion Contra Servicio Duplicado

Antes de aplicar cualquier Blueprint, detener el proceso si Render muestra:

- Nuevo recurso.
- Nombre con sufijo.
- Segunda URL `onrender.com`.
- Creacion de otro Static Site.
- Eliminacion o reemplazo del sitio actual.

Estado actual: no se pudo confirmar en Dashboard, por lo que no se aplico Blueprint desde esta sesion.

## Estado De Despliegue Publico

Validacion HTTP publica ejecutada contra la URL original:

| Ruta | Resultado | Headers nuevos |
| --- | --- | --- |
| `/` | `200 OK` | Ausentes. |
| `/auth` | `200 OK` | Ausentes. |
| `/pronosticos` | `200 OK` | Ausentes. |
| `/admin` | `200 OK` | Ausentes. |

Headers publicos recibidos antes de adopcion Blueprint:

| Header | Resultado |
| --- | --- |
| `Strict-Transport-Security` | Presente. |
| `X-Content-Type-Options` | Presente con `nosniff`. |
| `Content-Security-Policy` | No recibido. |
| `Referrer-Policy` | No recibido. |
| `X-Frame-Options` | No recibido. |
| `Permissions-Policy` | No recibido. |

Conclusion: no hay evidencia publica de que `render.yaml` haya sido adoptado/aplicado por Render.

## Rutas Y Assets Verificados

Verificado publicamente sin credenciales:

- `/`: `200 OK`.
- `/auth`: `200 OK`.
- `/pronosticos`: `200 OK`.
- `/admin`: `200 OK`.

No se ejecuto navegador real ni inspeccion Console/Network interactiva porque esta sesion no tiene acceso al Dashboard ni a un navegador real autenticado.

## Supabase Publico Y Recursos Externos

Validacion pendiente despues de aplicar headers en Render:

- Supabase Auth/REST/RPC publico con CSP aplicada.
- Supabase Realtime WebSocket solo si la app inicia canales reales.
- Logos desde `https://media.api-sports.io`.
- Manifest y service worker con CSP aplicada.

No se imprimieron claves publicas completas en esta auditoria.

## Validacion De Framing

Pendiente de headers aplicados publicamente. Actualmente no se recibe `X-Frame-Options` ni CSP publica, por lo que la prueba de iframe no puede considerarse aprobada.

## Pruebas Autenticadas

| Perfil | Estado |
| --- | --- |
| Usuario gratuito | BLOQUEADO POR FALTA DE CREDENCIALES |
| Usuario premium | BLOQUEADO POR FALTA DE CREDENCIALES |
| Administrador | BLOQUEADO POR FALTA DE CREDENCIALES |

No se inventaron resultados autenticados.

## Confirmaciones

- No se creo un segundo servicio desde esta sesion.
- No se elimino ni reemplazo el sitio publico existente.
- No se modificaron dominios, variables de entorno ni secretos.
- No se imprimieron valores sensibles.
- No se cambio el proyecto Supabase.
- No se tocaron backend, RLS, RPCs, migraciones ni modelos.
- No se ejecuto API-Football.
- No se implemento recuperacion de contraseña.
- No se incluyo `docs/operacion-render-predigol.md` en commits propios de esta fase.

## Siguiente Accion Requerida

El propietario debe entrar al Render Dashboard y confirmar el modo de administracion del servicio `predigol`. Solo despues de que la vista previa indique que se modificara el sitio existente, aplicar/sincronizar la configuracion y reejecutar la validacion publica de headers.
