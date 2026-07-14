# Checklist despliegue PrediGol

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
- [ ] Configurar `PREDIGOL_TEST_FREE_EMAIL` y `PREDIGOL_TEST_FREE_PASSWORD`.
- [ ] Configurar `PREDIGOL_TEST_PREMIUM_EMAIL` y `PREDIGOL_TEST_PREMIUM_PASSWORD`.
- [ ] Configurar `PREDIGOL_TEST_ADMIN_EMAIL` y `PREDIGOL_TEST_ADMIN_PASSWORD`.
- [ ] Ejecutar `prediction-service/.venv/Scripts/python.exe scripts/verificar_roles_supabase.py`.
- [ ] Usuario gratis real validado: login, plan free, premium false, premium bloqueado, sin admin, sin escrituras admin.
- [ ] Usuario premium real validado: login, plan premium, suscripcion vigente, premium permitido, sin admin automatico, sin escrituras admin.
- [ ] Usuario admin real validado: login, rol admin, `predigol_es_admin()=true`, panel admin reconocido.
- [ ] Matriz manual de navegador ejecutada cerrando sesion completamente entre usuarios.
- [ ] Confirmar que no se reutiliza JWT anterior al cambiar de usuario.

Fase 7E no queda completa hasta probar realmente los tres usuarios en Supabase real y registrar resultados.

## Pendiente Para Pagos Reales

- [ ] Elegir proveedor.
- [ ] Crear checkout server-side.
- [ ] Guardar secretos fuera del frontend.
- [ ] Implementar webhooks idempotentes.
- [ ] Actualizar `user_subscriptions` desde backend/service role.
- [ ] Auditar cambios de plan.
