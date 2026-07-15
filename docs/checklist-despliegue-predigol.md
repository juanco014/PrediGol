# Checklist despliegue PrediGol

## Fase 9D - Endurecimiento Recuperacion Y Cierre Etapa 9

- [x] Rama `main` y HEAD inicial `948db72` confirmados.
- [x] Worktree inicial limpio.
- [x] `PASSWORD_RECOVERY` auditado en listener global unico.
- [x] Rutas privadas bloquean sesion de recuperacion activa.
- [x] Salida manual desde recuperacion cierra sesion antes de volver al login.
- [x] Acceso directo sin recuperacion muestra estado seguro.
- [x] Sesion normal sin recuperacion no habilita formulario funcional.
- [x] Enlace reutilizado validado manualmente como seguro.
- [x] URL se reemplaza a `/actualizar-contrasena` despues de procesar recuperacion.
- [x] Mensaje generico conserva proteccion contra enumeracion.
- [x] Doble submit bloqueado durante cargas.
- [x] Rate limits revisados manualmente en Supabase.
- [x] SMTP personalizado confirmado manualmente.
- [x] Politica minima de 8 caracteres conservada.
- [x] Accesibilidad basica revisada.
- [x] `npm ci` OK, 0 vulnerabilidades.
- [x] `npm test` OK, 105 tests.
- [x] `npm run lint` OK.
- [x] `npm run build` OK.
- [x] `python -m pytest prediction-service/tests` OK, 172 tests.
- [x] Validacion publica rutas/assets/headers OK.
- [x] Revision de secretos OK para el flujo nuevo.
- [x] No se modifico Supabase automaticamente.
- [x] No se ejecuto API-Football.

Estado 9D: `COMPLETADA — RECUPERACIÓN ENDURECIDA Y ETAPA 9 CERRADA`.

## Fase 9C - Smoke Real Recuperacion De Contraseña

- [x] Matriz manual recibida sin credenciales, tokens, cookies, IDs ni enlaces completos.
- [x] Cuenta de prueba disponible.
- [x] Login previo comprobado.
- [x] Rol/plan previo comprobado.
- [x] Solicitud real en `/recuperar-contrasena` ejecutada.
- [x] Correo de recuperacion recibido.
- [x] Enlace abierto desde el correo.
- [x] Redireccion segura a `/actualizar-contrasena` comprobada.
- [x] Contexto `PASSWORD_RECOVERY` reconocido.
- [x] Contraseña actualizada.
- [x] Contraseña anterior rechazada.
- [x] Contraseña nueva aceptada.
- [x] Perfil y permisos conservados.
- [x] Persistencia, logout y rutas privadas post-logout comprobadas.
- [x] Console, Network y Storage revisados durante el flujo real.
- [x] Reutilizacion o expiracion del enlace verificada en Fase 9D.
- [x] Sin tokens copiados.
- [x] Sin enlace sensible registrado.
- [x] Sin credenciales almacenadas.
- [x] Sin cambios Supabase.
- [x] Sin API-Football.

Estado 9C: `COMPLETADA — RECUPERACIÓN REAL DE CONTRASEÑA VALIDADA`.

## Fase 9B - Integracion Y Despliegue Recuperacion

- [x] Diff 9A auditado.
- [x] `PASSWORD_RECOVERY` revisado sin listeners duplicados.
- [x] Login, registro, logout, perfiles y roles conservan proteccion existente.
- [x] `npm ci` pasa con 0 vulnerabilidades reportadas.
- [x] `npm test` pasa: 103 tests.
- [x] `npm run lint` pasa.
- [x] `npm run build` pasa.
- [x] Commit funcional creado: `5d605b0 feat(auth): add secure password recovery flow`.
- [x] Push a `origin/main` realizado sin force push.
- [x] Site URL Supabase confirmada: `https://predigol.onrender.com`.
- [x] Redirect produccion Supabase confirmada: `https://predigol.onrender.com/actualizar-contrasena`.
- [x] Redirect local Supabase confirmada: `http://localhost:5173/actualizar-contrasena`.
- [x] Plantilla Reset Password revisada manualmente.
- [x] `/`, `/auth`, `/recuperar-contrasena`, `/actualizar-contrasena` responden 200 en produccion.
- [x] Assets nuevos responden 200.
- [x] Headers de seguridad siguen presentes.
- [x] No se modifico Supabase automaticamente.
- [x] No se ejecuto API-Football.
- [x] Smoke real de correo y cambio de contraseña completado en Fase 9C.

Estado 9B: `COMPLETADA — FLUJO DESPLEGADO Y CONFIGURADO, SMOKE REAL PENDIENTE`.

## Fase 9A - Recuperacion De Contraseña

- [x] Servicio centralizado extendido sin service role.
- [x] Ruta publica `/recuperar-contrasena` agregada.
- [x] Ruta publica `/actualizar-contrasena` agregada.
- [x] `PASSWORD_RECOVERY` integrado en el listener global existente.
- [x] Mensaje generico evita enumeracion de cuentas.
- [x] Politica de contraseña consistente con registro: minimo 8 caracteres.
- [x] Campos de contraseña se limpian despues de actualizacion o error.
- [x] `npm ci` pasa.
- [x] `npm test` pasa: 103 tests.
- [x] `npm run lint` pasa.
- [x] `npm run build` pasa.
- [ ] Configurar Redirect URL produccion en Supabase: `https://predigol.onrender.com/actualizar-contrasena`.
- [ ] Configurar Redirect URL local en Supabase: `http://localhost:5173/actualizar-contrasena`.
- [ ] Revisar plantilla de correo de recuperacion en Supabase Dashboard.
- [ ] Desplegar frontend.
- [ ] Ejecutar smoke real con correo de prueba sin almacenar credenciales.

Estado 9A: `IMPLEMENTACIÓN COMPLETADA — CONFIGURACIÓN Y SMOKE REAL PENDIENTES`.

## Fase 8J - Cierre Tecnico Etapa 8

- [x] `git fetch origin` ejecutado.
- [x] `main` sincronizada con `origin/main` al iniciar 8J.
- [x] `docs/operacion-render-predigol.md` revisado sin descartar cambios.
- [x] `docs/auditoria-fase8f-predigol.md` revisado sin agregar a Git.
- [x] Validacion publica sin autenticacion ejecutada para `/`, `/auth`, `/pronosticos`, `/admin`, JS y CSS.
- [x] Headers publicos confirmados en rutas y assets.
- [x] Suite Python segura ejecutada: 172 tests OK.
- [x] Busqueda conservadora de secretos ejecutada sin imprimir valores.
- [x] `npm ci` frontend pasa en clon limpio fuera de OneDrive.
- [x] `npm test` frontend pasa en clon limpio: 90 tests OK.
- [x] `npm run lint` frontend pasa en clon limpio.
- [x] `npm run build` frontend pasa en clon limpio.
- [x] Decisiones tomadas sobre pendientes locales.

Estado 8J: `COMPLETADA — DESPLIEGUE, SEGURIDAD Y ROLES VALIDADOS`.

El bloqueo `EPERM` del worktree original fue aislado mediante clon limpio en `C:\PrediGol-validacion-8J`; las validaciones tecnicas completas pasaron sobre `9d3272f`.

## Fase 8I - Smoke Autenticado Por Roles

- [x] Usuario gratuito: login correcto.
- [x] Usuario gratuito: perfil visible y sesion persistente al recargar.
- [x] Usuario gratuito: contenido gratuito accesible.
- [x] Usuario gratuito: contenido premium bloqueado.
- [x] Usuario gratuito: `/admin`, `/admin/modelo` y `/admin/partidos` bloqueadas.
- [x] Usuario gratuito: logout y rutas privadas bloqueadas despues del logout.
- [x] Usuario premium: login correcto.
- [x] Usuario premium: plan premium reconocido.
- [x] Usuario premium: contenido premium desbloqueado.
- [x] Usuario premium: rutas administrativas bloqueadas.
- [x] Usuario premium: logout y rutas privadas bloqueadas despues del logout.
- [x] Administrador: login correcto.
- [x] Administrador: acceso a `/admin`, `/admin/modelo` y `/admin/partidos`.
- [x] Administrador: no ejecutar importacion, sincronizacion, generacion ni API-Football.
- [x] Administrador: logout y rutas administrativas bloqueadas despues del logout.
- [x] Cambio entre cuentas: sin herencia de datos o permisos.
- [x] Console y Network sin errores CSP ni errores `401/403` inesperados.
- [x] Storage sin datos sensibles reutilizables despues del logout, sin copiar valores.

Estado 8I: `COMPLETADA — ROLES AUTENTICADOS VALIDADOS`.

Resultado manual recibido: usuario gratuito, premium y administrador validados en navegador real por el propietario del proyecto. No se almacenaron credenciales, tokens, cookies, IDs reales ni valores de storage.

## Fase 8H - Headers Publicos Render

- [x] Headers aplicados manualmente en el Static Site existente desde Render Dashboard.
- [x] `render.yaml` conservado como configuracion versionada pendiente de adopcion Blueprint confirmada.
- [x] Servicio duplicado no creado.
- [x] URL publica original conservada: `https://predigol.onrender.com`.
- [x] `/`, `/auth`, `/pronosticos` y `/admin` responden `200 OK`.
- [x] JS principal responde `200 OK`.
- [x] CSS principal responde `200 OK`.
- [x] `Content-Security-Policy` recibido y coincide con lo previsto.
- [x] `Referrer-Policy: strict-origin-when-cross-origin` recibido.
- [x] `X-Frame-Options: DENY` recibido.
- [x] `Permissions-Policy: camera=(), microphone=(), geolocation=()` recibido.
- [x] `Strict-Transport-Security` recibido.
- [x] `X-Content-Type-Options: nosniff` recibido.
- [x] Usuario gratuito validado manualmente.
- [x] Usuario premium validado manualmente.
- [x] Administrador validado manualmente.
- [ ] Recuperacion de contraseña implementada.

Estado 8H: `COMPLETADA — HEADERS Y DESPLIEGUE PÚBLICO VALIDADOS`.

## Fase 8G - Endurecimiento HTTP Render

Estado: `IMPLEMENTACIÓN COMPLETADA — VALIDACIÓN PÚBLICA PENDIENTE DE REDESPLIEGUE`.

Configuracion versionada:

- [x] `render.yaml` agregado para Static Site `predigol`.
- [x] `runtime: static` configurado.
- [x] `rootDir: predigol-web` configurado.
- [x] `buildCommand: npm ci && npm run build` configurado.
- [x] `staticPublishPath: dist` configurado.
- [x] Rewrite SPA `/* -> /index.html` configurado.
- [x] `Content-Security-Policy` configurado sin `unsafe-eval` ni `*`.
- [x] `Referrer-Policy` configurado.
- [x] `X-Frame-Options` configurado.
- [x] `Permissions-Policy` configurado.
- [x] `Strict-Transport-Security` preservado.
- [x] `X-Content-Type-Options: nosniff` preservado.
- [ ] Sincronizar/aplicar Blueprint en Render.
- [ ] Confirmar en Render Dashboard que el servicio existente se llama `predigol`.
- [ ] Redesp desplegar desde `main` cuando el propietario autorice.
- [ ] Confirmar headers publicos con `curl -D - https://predigol.onrender.com`.
- [ ] Confirmar que rutas SPA siguen respondiendo `200 OK` tras deploy.

Validacion local 8G:

- [x] `npm test` pasa.
- [x] `npm run lint` pasa.
- [x] `npm run build` pasa.
- [x] Preview local arranca.
- [x] Rutas SPA principales devuelven `200 OK` en preview.
- [x] No se encontraron `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_API_KEY`, `API_FOOTBALL_KEY`, `sb_secret` ni RapidAPI keys en frontend/dist.
- [x] Validacion autenticada de usuario gratuito resuelta en 8I.
- [x] Validacion autenticada de usuario premium resuelta en 8I.
- [x] Validacion autenticada de administrador resuelta en 8I.

## Frontend

- [ ] `VITE_SUPABASE_URL` apunta al proyecto correcto.
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` es public/publishable, no service role.
- [ ] Si se usa `VITE_SUPABASE_ANON_KEY`, es anon/public y no service role.
- [ ] `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` es publica o queda vacia si push no se usa.
- [ ] No hay `SUPABASE_SERVICE_ROLE_KEY`, claves privadas ni API-Football key en `VITE_*`.
- [ ] `npm test` pasa.
- [ ] `npm run lint` pasa.
- [ ] `npm run build` pasa.
- [ ] Dominio, redirects y `vercel.json` revisados.

## Supabase

- [ ] Proyecto Supabase definitivo creado y seleccionado.
- [ ] Migraciones aplicadas en orden.
- [ ] RLS activo en tablas sensibles.
- [ ] `predigol_es_admin()` disponible y probado.
- [ ] `model_predictions_read_by_entitlement` protege premium.
- [ ] `user_subscriptions_admin_write` limita escrituras premium a admin.
- [ ] RPCs `predigol_usuario_tiene_premium`, `obtener_predicciones_visibles`, `obtener_prediccion_visible` y `obtener_plan_usuario` disponibles.
- [ ] Tabla `model_predictions` accesible por RPC segura.
- [ ] Usuario gratis no recibe premium completo.
- [ ] Admin puede consultar datos completos segun RLS/RPC.
- [ ] Edge Functions tienen secretos en Supabase Secrets, no en frontend.
- [ ] Usuario admin inicial creado desde SQL controlado o RPC bootstrap no expuesto en UI.
- [ ] Perfil admin tiene `rol = 'admin'` y/o `es_admin = true`.

## Admin Inicial

- [ ] Crear usuario desde Auth o registro normal.
- [ ] Confirmar que existe fila en `public.profiles`.
- [ ] Asignar admin desde SQL Editor:

```sql
update public.profiles
set rol = 'admin', es_admin = true
where id = 'UUID_DEL_USUARIO_ADMIN';
```

- [ ] Validar que `/admin` carga solo con ese usuario.
- [ ] No exponer botones de auto-elevacion admin en frontend de produccion.

## API Keys Y Secretos

- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en backend/scripts/Edge Functions.
- [ ] `FOOTBALL_API_KEY` solo en `prediction-service/.env` local o secretos backend.
- [ ] `API_FOOTBALL_KEY` legacy, si se usa, solo en backend/scripts/Edge Functions.
- [ ] `WEB_PUSH_VAPID_PRIVATE_KEY` solo en Edge Functions.
- [ ] `.env` reales estan ignorados por Git.
- [ ] `.env.example` no contiene claves reales.

## Datos Y Modelo

- [ ] V1 queda como modelo principal de produccion.
- [ ] V2 queda experimental.
- [ ] No se cambiaron defaults de V2.
- [ ] Hay partidos proximos relevantes.
- [ ] Hay historico suficiente para generar predicciones.
- [ ] Predicciones guardadas tienen `model_version` y `access_tier`.
- [ ] Premium bloqueado no entrega campos completos a usuarios gratis.

## Comandos Post-Despliegue

```bash
./prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --dry-run
./prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --help
./prediction-service/.venv/Scripts/python.exe scripts/backtest_v1_v2.py --help
```

## Validacion Manual

- [ ] `/` carga para visitante.
- [ ] `/auth` permite iniciar sesion.
- [ ] `/inicio` carga para usuario autenticado.
- [ ] `/pronosticos` muestra estados de carga, vacio, error y filtros.
- [ ] `/partidos/:partidoId` abre detalle o mensaje claro si no existe.
- [ ] `/ligas` y `/ligas/:ligaId` manejan vacio/permisos.
- [ ] `/ranking`, `/estadisticas`, `/notificaciones`, `/perfil` cargan sin errores bloqueantes.
- [ ] `/admin`, `/admin/modelo`, `/admin/partidos` rechazan usuario no admin.
- [ ] Admin ve V1 produccion y V2 experimental sin poder cambiar modelo desde UI.

## Monitoreo Inicial

- [ ] Revisar errores web en admin.
- [ ] Revisar Edge Function logs despues de sync/import.
- [ ] Revisar cuota API-Football antes de importaciones masivas.
- [ ] Revisar conteo de `model_predictions` despues de generar pronosticos.
- [ ] Revisar usuarios premium manuales y expiraciones.

## QA Real Fase 7

- [x] `git status --short` limpio antes de QA local.
- [x] `.env` reales no estan rastreados por Git.
- [x] Frontend tests/lint/build pasan.
- [x] Preview de produccion arranca localmente.
- [x] Python tests pasan.
- [x] `scripts/verificar_python.py` ejecutado.
- [x] Dataset local liga 39 temporada 2024 detectado.
- [ ] Supabase real validado desde scripts locales.
- [ ] Usuario gratis validado en navegador real.
- [ ] Usuario admin validado en navegador real.
- [ ] Usuario premium manual validado en navegador real.
- [ ] Premium bloqueado/permitido validado con RPC real.

Bloqueante actual para completar QA real: faltan variables locales `predigol-web/.env.local`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `prediction-service/.env`.

## QA Real Fase 7B

- [x] `.env` reales confirmados como ignorados por Git.
- [x] Tests frontend/lint/build pasaron.
- [x] Tests Python pasaron.
- [x] Preview local arranco.
- [x] Valores reales removidos de `.env.example` rastreados.
- [ ] `predigol-web/.env.local` existe con variables publicas reales.
- [ ] `prediction-service/.env` contiene `SUPABASE_URL`.
- [ ] `prediction-service/.env` contiene `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Supabase real validado por script.
- [ ] Login real probado en navegador.
- [ ] Admin real probado en navegador.
- [ ] Premium manual validado por RPC/RLS.

Accion requerida: completar variables locales y rotar claves si algun valor real de `.env.example` ya fue expuesto fuera del equipo.

## QA Real Fase 7B Reejecutada

- [x] `predigol-web/.env.local` existe y esta ignorado.
- [x] `prediction-service/.env` existe y esta ignorado.
- [x] Variables frontend publicas detectadas por nombre.
- [x] Variables privadas del servicio detectadas por nombre.
- [x] Supabase conecta desde `scripts/verificar_python.py`.
- [x] `profiles` accesible.
- [x] `model_predictions` accesible.
- [ ] `model_runs` accesible.
- [ ] `model_datasets` accesible.
- [ ] `team_aliases` accesible.
- [ ] `subscription_plans` accesible.
- [ ] `user_subscriptions` accesible.
- [ ] RPCs freemium/admin disponibles.
- [ ] Usuario admin validado en navegador.
- [ ] Usuario gratis validado en navegador.
- [ ] Premium manual validado por RLS/RPC.

Bloqueante actual: migraciones admin/freemium parecen no estar aplicadas o no estar expuestas en Supabase real.

## Fase 7C - Sincronizar Migraciones Supabase

- [x] Supabase CLI revisado.
- [x] No se ejecuto `db reset` ni SQL destructivo.
- [x] Migraciones faltantes identificadas en el repo.
- [x] Script `scripts/verificar_supabase_mvp.py` creado.
- [x] `profiles` OK en Supabase real.
- [x] `model_predictions` OK en Supabase real.
- [ ] `model_runs` OK en Supabase real.
- [ ] `model_datasets` OK en Supabase real.
- [ ] `team_aliases` OK en Supabase real.
- [ ] `subscription_plans` OK en Supabase real.
- [ ] `user_subscriptions` OK en Supabase real.
- [ ] RPC admin/freemium OK en Supabase real.
- [ ] RLS/policies validadas con usuarios reales.

Aplicar migraciones pendientes con backup previo y reejecutar:

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_supabase_mvp.py
prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
```

## Fase 7D - Verificacion Post-Migraciones

- [x] `.env` reales ignorados.
- [x] Conexion Supabase desde Python OK.
- [x] `profiles` OK.
- [x] `model_predictions` OK.
- [ ] `model_runs` OK.
- [ ] `model_datasets` OK.
- [ ] `team_aliases` OK.
- [ ] `subscription_plans` OK.
- [ ] `user_subscriptions` OK.
- [ ] `predigol_es_admin` ejecutable por roles esperados.
- [ ] RPC premium disponibles por REST.
- [x] Migracion correctiva de grants creada: `202607100002_refresh_mvp_grants.sql`.
- [ ] Migracion correctiva aplicada en Supabase real.
- [ ] Usuarios reales validados.
- [ ] Premium manual validado.

Bloqueante: Supabase real sigue sin exponer objetos admin/freemium. Confirmar existencia en SQL Editor y aplicar migraciones/grants pendientes con backup previo.

## Fase 7E - Validacion Autenticada De Roles

- [x] Verificador autenticado creado: `scripts/verificar_roles_supabase.py`.
- [x] Verificador usa Supabase Auth con `SUPABASE_ANON_KEY`; no usa service role para simular usuarios.
- [x] Tests unitarios agregados con mocks, sin depender de Supabase real.
- [x] Esquema real documentado: `profiles.rol`, `profiles.es_admin`, `subscription_plans.code`, `user_subscriptions.status`, `expires_at`.
- [x] Credenciales de usuario gratis, premium y admin configuradas fuera del repo para la validacion.
- [x] `prediction-service/.venv/Scripts/python.exe scripts/verificar_roles_supabase.py` ejecutado sin fallos criticos.
- [x] Usuario gratis real validado: login, plan free, premium false, sin admin, sin escrituras admin.
- [x] Usuario premium real validado: login, plan premium, suscripcion vigente, sin admin automatico, sin escrituras admin.
- [x] Usuario admin real validado: login, rol admin, `predigol_es_admin()=true`, lectura admin permitida.
- [x] RLS/escrituras directas en tablas del modelo bloqueadas segun politicas actuales.
- [ ] PENDIENTE DATOS: probar bloqueo/desbloqueo de prediccion premium cuando exista una prediccion premium real.

Fase 7E queda completada para autenticacion, roles, suscripciones y RLS. El unico pendiente no bloqueante es de datos: no habia predicciones premium reales para validar contenido bloqueado/desbloqueado.

## Fase 7F - Publicacion V1 Controlada

- [x] Flujo existente diagnosticado.
- [x] Esquema `model_predictions` y RPC de visibilidad revisados.
- [x] Frontend consumidor de predicciones revisado.
- [x] Publicador seguro creado: `scripts/publicar_predicciones_v1_mvp.py`.
- [x] Publicador rechaza V2 y solo usa `poisson-elo-v1`.
- [x] Publicador soporta `--dry-run`, `--apply`, limite, fixture explicito y no sobrescritura por defecto.
- [x] Pruebas unitarias del publicador agregadas sin Supabase real.
- [x] Supabase tiene historicos reales suficientes para V1: 226 partidos finalizados con marcador.
- [ ] Fixture real proximo disponible en Supabase.
- [ ] Prediccion V1 real gratuita publicada.
- [ ] Prediccion V1 real premium publicada.
- [ ] Usuario gratis valida contenido premium bloqueado.
- [ ] Usuario premium valida contenido premium completo.
- [ ] Admin valida predicciones publicadas.

Estado: Fase 7F preparada, pendiente de fixtures reales. No se ejecuto `--apply` porque Supabase y reportes locales tienen 0 fixtures proximos; API-Football rechazo temporada 2026 para el plan actual. No crear datos ficticios para cerrar esta fase.

## Fases 7G, 7H y 7I - Decision De Fixtures Reales

- [x] Importador conservador preparado: `scripts/importar_fixtures_proximos_mvp.py`.
- [x] No se ejecuto `--apply` sin fixtures reales validados.
- [x] Contrato confirmado: `model_predictions.api_football_fixture_id` es el identificador obligatorio actual de predicciones.
- [x] `partido_id` confirmado como auxiliar, nullable y sin contrato unico/FK para predicciones manuales.
- [x] `obtener_prediccion_visible()` confirmado solo por `api_football_fixture_id`.
- [x] Frontend confirmado: listados y detalle de prediccion del modelo dependen de `api_football_fixture_id`.
- [x] Alternativas documentadas: mantener API-Football, otro proveedor, redisenar soporte `partido_id`.
- [x] Recomendacion documentada: mantener API-Football y habilitar temporada actual para MVP.
- [ ] Propietario decide si revisa/contrata acceso actual de API-Football o prioriza migracion formal por `partido_id`.
- [ ] Resolver partido manual vencido con estado `proximo` desde panel admin o accion administrativa controlada.

Consulta segura para detectar partidos vencidos inconsistentes:

```sql
select id, torneo, fecha_orden, local_nombre, visitante_nombre, estado, api_football_fixture_id, origen_datos, fuente_detalle
from public.partidos
where estado = 'proximo'
  and fecha_orden < now()
  and api_football_fixture_id is null
  and goles_local_final is null
  and goles_visitante_final is null
order by fecha_orden asc;
```

## Fase 7J - Preflight API-Football Temporada Actual

- [x] Script creado: `scripts/verificar_acceso_api_football.py`.
- [x] Script no escribe en Supabase y limita a 1 request por corrida.
- [x] Script no imprime secretos.
- [x] Liga candidata seleccionada por historico: La Liga (`league=140`).
- [x] Temporada consultada: `2025` con `next=3`.
- [x] Solicitudes reales consumidas en 7J: 2.
- [x] Resultado: `season_not_in_plan` / temporada no incluida en el plan actual.
- [x] Fixtures encontrados: 0.
- [x] Fixtures importados: 0.
- [x] Publicacion V1: no ejecutada; solo dry-run, sin candidatos.
- [ ] Propietario revisa plan/API-Football para habilitar temporada actual.

## Fase 8A - Despliegue Seguro Sin Fixtures Actuales

- [x] Frontend puede desplegarse aunque no existan fixtures actuales.
- [x] Estados vacios de partidos/predicciones tratados como ausencia de datos, no como error de cuenta.
- [x] Preflight de despliegue agregado: `scripts/verificar_despliegue_predigol.py`.
- [x] Preflight no consulta API-Football ni escribe en Supabase.
- [x] CI sin secretos agregado en `.github/workflows/ci.yml`.
- [ ] Configurar variables publicas en el proveedor frontend: `VITE_SUPABASE_URL` y publishable/anon key.
- [ ] Configurar `Site URL` y `Redirect URLs` en Supabase Auth.
- [ ] Confirmar HTTPS y dominios permitidos.
- [ ] Ejecutar smoke test post-despliegue.
- [ ] Mantener bloqueadas sincronizaciones/API-Football hasta fuente valida.

Variables criticas:

| Variable | Ubicacion permitida | Estado |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend publica | Requerida para despliegue. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` o `VITE_SUPABASE_ANON_KEY` | Frontend publica | Requerida; nunca clave secreta de Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend/scripts privados | Prohibida en frontend. |
| `FOOTBALL_API_KEY` | Backend/scripts privados | Bloqueada temporalmente para consultas reales. |
| `PREDIGOL_TEST_*` | Local no versionado | No incluir en ejemplos ni CI. |

## Fase 8C - Render Produccion

- [x] URL publica responde por HTTPS: `https://predigol.onrender.com`.
- [x] `/` sirve `index.html` con titulo de PrediGol.
- [x] Asset JS principal responde `200 OK`.
- [x] Asset CSS principal responde `200 OK`.
- [x] Rewrite SPA configurado en Render. Source `/*`, destination `/index.html`, action `Rewrite`.
- [ ] Confirmar en Render Dashboard Root Directory `predigol-web`.
- [ ] Confirmar Build Command `npm ci && npm run build`.
- [ ] Confirmar Publish Directory `dist`.
- [ ] Confirmar rama `main` y ultimo deploy del commit `26cc7305220a5efacc4a9cdacf61cd27cb5b7bd0`.
- [ ] Confirmar Node compatible con Vite 8.
- [ ] Confirmar variables publicas `VITE_SUPABASE_URL` y publishable/anon key.
- [ ] Confirmar que no existen service role, API-Football key ni secretos backend en variables frontend.
- [x] Confirmar Supabase Auth Site URL `https://predigol.onrender.com`.
- [x] Confirmar Redirect URL `https://predigol.onrender.com/**`.
- [ ] Ejecutar smoke test manual publico y autenticado despues de corregir rewrite.
- [ ] Mantener API-Football, importadores, sincronizadores y publicadores bloqueados.

## Pendiente Para Pagos Reales

- [ ] Elegir proveedor.
- [ ] Crear checkout server-side.
- [ ] Guardar secretos fuera del frontend.
- [ ] Implementar webhooks idempotentes.
- [ ] Actualizar `user_subscriptions` desde backend/service role.
- [ ] Auditar cambios de plan.
