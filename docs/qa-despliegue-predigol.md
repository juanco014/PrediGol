# QA despliegue PrediGol

## Preparacion

- [ ] Usar build de produccion o preview local.
- [ ] Confirmar que apunta al Supabase definitivo.
- [ ] Confirmar que migraciones estan aplicadas.
- [ ] Crear al menos un usuario gratis y un usuario admin.
- [ ] Tener predicciones V1 guardadas en `model_predictions` o documentar que el feed estara vacio.

## Visitante

- [ ] Entra a `/`.
- [ ] Ve propuesta de valor clara.
- [ ] Ve aviso responsable de pronosticos informativos.
- [ ] Puede ir a `/auth`.
- [ ] Al intentar rutas privadas sin sesion, redirige a `/auth`.

## Usuario Gratuito

- [ ] Inicia sesion correctamente.
- [ ] Entra a `/inicio`.
- [ ] Entra a `/pronosticos`.
- [ ] Ve pronosticos gratis si existen datos.
- [ ] Si no hay datos, ve estado vacio claro.
- [ ] Usa filtros de liga, equipo, tipo y fecha.
- [ ] Abre `/partidos/:partidoId` desde una card.
- [ ] Ve perfil en `/perfil`.
- [ ] No puede entrar a `/admin`.
- [ ] No puede entrar a `/admin/modelo`.
- [ ] No puede entrar a `/admin/partidos`.
- [ ] Si hay contenido premium, ve preview/bloqueo y no recibe probabilidades, xG, marcador probable ni metadata completa.

## Admin

- [ ] Inicia sesion con usuario admin.
- [ ] Entra a `/admin`.
- [ ] Ve dashboard operativo.
- [ ] Ve conteos de predicciones, datasets, runs y usuarios.
- [ ] Ve V1 como produccion.
- [ ] Ve V2 como experimental.
- [ ] No puede cambiar modelo desde UI.
- [ ] Entra a `/admin/modelo` y ve trazabilidad, datasets/runs y alias si existen.
- [ ] Entra a `/admin/partidos` y ve estado de partidos/API.
- [ ] Puede copiar comandos operativos.
- [ ] Puede activar premium manual solo si RLS/RPC lo permite y queda registro en `user_subscriptions`.

## Premium

- [ ] Usuario gratis recibe predicciones premium bloqueadas via RPC segura.
- [ ] Usuario premium activo o trial recibe contenido premium si existe.
- [ ] Admin recibe datos completos por `predigol_es_admin()`.
- [ ] La UI no es la fuente de seguridad; validar respuesta real de Supabase.

## Rutas Definitivas

- [ ] `/`
- [ ] `/auth`
- [ ] `/inicio`
- [ ] `/pronosticos`
- [ ] `/partidos/:partidoId`
- [ ] `/ligas`
- [ ] `/ligas/:ligaId`
- [ ] `/ranking`
- [ ] `/estadisticas`
- [ ] `/notificaciones`
- [ ] `/perfil`
- [ ] `/admin`
- [ ] `/admin/modelo`
- [ ] `/admin/partidos`

## Consola Y Red

- [ ] No hay errores de consola bloqueantes.
- [ ] No se descargan claves privadas.
- [ ] No aparece service role en responses, bundle ni variables publicas.
- [ ] RPCs premium devuelven null en campos bloqueados para usuario gratis.
- [ ] 404 de rutas internas no ocurre al recargar en hosting.

## Resultado

Registrar fecha, URL probada, usuario gratis, usuario admin, navegador, resultado y pendientes antes de liberar el MVP.

## Ejecucion Fase 7 - 2026-07-10

### Alcance Ejecutado

| Area | Resultado |
| --- | --- |
| Git inicial | Limpio; no hay archivos rastreados pendientes. |
| `.env` reales | `prediction-service/.env` existe e ignorado por Git; `predigol-web/.env` y `predigol-web/.env.local` no existen localmente. |
| Secretos rastreados | No se encontraron claves privadas reales en archivos rastreados. |
| Frontend tests | `npm test` paso con 90 tests. |
| Frontend lint | `npm run lint` paso. |
| Frontend build | `npm run build` paso. |
| Frontend preview | `npm run preview -- --host 127.0.0.1` arranco en `http://127.0.0.1:4173/`. |
| Python tests | `pytest prediction-service/tests` paso con 79 tests. |
| Python env | Entorno virtual y dependencias OK. |
| Importacion real | No ejecutada para no consumir cuota; falta confirmar credenciales/cuota real. |
| Generacion V1 local | Dataset local `reports/api_api_football_liga-39_temporada-2024_dataset.json` existe; salida V1 ya existia y no se sobrescribio. |

### Variables Locales Verificadas Sin Exponer Valores

| Archivo | Estado |
| --- | --- |
| `predigol-web/.env` | No existe localmente. |
| `predigol-web/.env.local` | No existe localmente. |
| `prediction-service/.env` | Existe, ignorado por Git. |

Variables detectadas por nombre en `prediction-service/.env`:

- `FOOTBALL_API_KEY`

Variables faltantes para QA real contra Supabase desde este workspace:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` o `VITE_SUPABASE_ANON_KEY`

### Supabase Real

No se pudo validar directamente desde scripts locales porque `prediction-service/.env` no tiene `SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`, y el frontend local no tiene `.env`/`.env.local`. La verificacion queda pendiente contra el proyecto definitivo con credenciales configuradas.

Checklist pendiente en Supabase real:

- [ ] Confirmar migraciones aplicadas.
- [ ] Confirmar RLS activo.
- [ ] Confirmar tablas `profiles`, `model_predictions`, `model_runs`, `model_datasets`, `team_aliases`, `subscription_plans`, `user_subscriptions`.
- [ ] Confirmar RPCs `predigol_es_admin`, `obtener_plan_usuario`, `obtener_predicciones_visibles`, `obtener_prediccion_visible`, `predigol_usuario_tiene_premium`.
- [ ] Confirmar usuario admin inicial.
- [ ] Confirmar usuario gratis sin acceso admin.
- [ ] Confirmar bloqueo premium por RPC/RLS.
- [ ] Confirmar premium manual si existe usuario premium.

### Usuarios Y Rutas

No se validaron usuarios reales en navegador porque el frontend local no tiene variables de Supabase configuradas. Queda pendiente probar:

- [ ] Visitante: `/`, `/auth`.
- [ ] Usuario gratis: `/inicio`, `/pronosticos`, `/partidos/:partidoId`, `/perfil` y bloqueo `/admin`.
- [ ] Admin: `/admin`, `/admin/modelo`, `/admin/partidos`.
- [ ] Premium manual: acceso permitido a contenido premium si existe.

### Comandos Ejecutados

```bash
git status --short
npm test
npm run lint
npm run build
npm run preview -- --host 127.0.0.1
prediction-service/.venv/Scripts/python.exe -m pytest prediction-service/tests
prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --help
prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --help
prediction-service/.venv/Scripts/python.exe scripts/backtest_v1_v2.py --help
prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --league 39 --seasons 2024 --dry-run
prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v1
```

### Resultado De Datos

| Comando | Resultado |
| --- | --- |
| Importacion dry-run liga 39 temporada 2024 | `skipped_existing`; dataset local ya disponible. |
| Generacion V1 local | Omitida porque `reports/pronosticos_api_api_football_liga-39_temporada-2024_dataset_v1.json` ya existe; no se uso `--force`. |

### Pendientes Reales

1. Configurar `predigol-web/.env.local` con variables publicas del Supabase definitivo.
2. Configurar `prediction-service/.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` reales.
3. Confirmar cuota de API-Football antes de importacion real.
4. Ejecutar QA manual en navegador con usuario gratis, admin y premium manual.
5. Validar respuestas de RPC premium con usuario gratis y usuario premium/admin.
6. Registrar resultados sin exponer emails, UUIDs completos ni secretos.
