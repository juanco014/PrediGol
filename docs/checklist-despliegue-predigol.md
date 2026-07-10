# Checklist despliegue PrediGol

## Frontend

- [ ] `VITE_SUPABASE_URL` apunta al proyecto correcto.
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` es public/publishable, no service role.
- [ ] `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` es publica o queda vacia si push no se usa.
- [ ] No hay `SUPABASE_SERVICE_ROLE_KEY`, claves privadas ni API-Football key en `VITE_*`.
- [ ] `npm test` pasa.
- [ ] `npm run lint` pasa.
- [ ] `npm run build` pasa.
- [ ] Dominio, redirects y `vercel.json` revisados.

## Supabase

- [ ] Migraciones aplicadas en orden.
- [ ] RLS activo en tablas sensibles.
- [ ] `predigol_es_admin()` disponible y probado.
- [ ] `model_predictions_read_by_entitlement` protege premium.
- [ ] `user_subscriptions_admin_write` limita escrituras premium a admin.
- [ ] RPCs `obtener_predicciones_visibles`, `obtener_prediccion_visible` y `obtener_plan_usuario` disponibles.
- [ ] Edge Functions tienen secretos en Supabase Secrets, no en frontend.
- [ ] Usuario admin inicial creado o reclamado de forma controlada.

## API Keys Y Secretos

- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en backend/scripts/Edge Functions.
- [ ] `FOOTBALL_API_KEY` solo en `prediction-service/.env` local o secretos backend.
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

## Pendiente Para Pagos Reales

- [ ] Elegir proveedor.
- [ ] Crear checkout server-side.
- [ ] Guardar secretos fuera del frontend.
- [ ] Implementar webhooks idempotentes.
- [ ] Actualizar `user_subscriptions` desde backend/service role.
- [ ] Auditar cambios de plan.
