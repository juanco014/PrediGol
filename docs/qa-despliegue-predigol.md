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

## Ejecucion Fase 7B - 2026-07-10

### Resultado General

Fase 7B no pudo completar validacion real contra Supabase definitivo desde este workspace. Las credenciales locales siguen incompletas:

- `predigol-web/.env.local` no existe.
- `prediction-service/.env` existe y esta ignorado, pero solo declara `FOOTBALL_API_KEY` por nombre.
- Faltan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `prediction-service/.env`.

### Seguridad Y Git

| Revision | Resultado |
| --- | --- |
| `git status --short` inicial | Mostraba cambios en `.env.example`; no habia `.env` reales rastreados. |
| `git check-ignore predigol-web/.env.local` | Ignorado por Git. |
| `git check-ignore prediction-service/.env` | Ignorado por Git. |
| Secretos en archivos rastreados | Se detectaron valores reales en `.env.example` y fueron reemplazados por placeholders. |
| Reportes/build | Presentes solo como ignorados por Git. |

Nota de seguridad: se reemplazaron valores reales en `prediction-service/.env.example` y `predigol-web/.env.example`. Si esos valores ya fueron compartidos o commiteados previamente, deben rotarse en Supabase/API-Football.

### Variables Verificadas Sin Exponer Valores

Frontend local:

- `predigol-web/.env.local`: no existe.
- No se detectaron `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` ni `VITE_SUPABASE_ANON_KEY` en archivo local.

Prediction service:

- `prediction-service/.env`: existe e ignorado por Git.
- Detectada por nombre: `FOOTBALL_API_KEY`.
- Faltan por nombre: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### Pruebas Automatizadas

| Comando | Resultado |
| --- | --- |
| `npm test` | 90 tests pasaron. |
| `npm run lint` | Paso. |
| `npm run build` | Paso. |
| `npm run preview -- --host 127.0.0.1` | Arranco en `http://127.0.0.1:4173/`. |
| `prediction-service/.venv/Scripts/python.exe -m pytest prediction-service/tests` | 79 tests pasaron. |
| `prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py` | Entorno OK; advierte que falta Supabase. |

### Supabase Real

No validado. Bloqueante: faltan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el servicio Python y faltan variables publicas frontend locales.

Pendiente validar en Supabase real:

- [ ] `profiles`.
- [ ] `model_predictions`.
- [ ] `model_runs`.
- [ ] `model_datasets`.
- [ ] `team_aliases`.
- [ ] `subscription_plans`.
- [ ] `user_subscriptions`.
- [ ] `predigol_es_admin`.
- [ ] `obtener_plan_usuario`.
- [ ] `obtener_predicciones_visibles`.
- [ ] `obtener_prediccion_visible`.
- [ ] `predigol_usuario_tiene_premium`.

### Usuarios Y Rutas Reales

No validados en navegador real por falta de `predigol-web/.env.local`.

Pendiente:

- [ ] Login real.
- [ ] Sesion persistente.
- [ ] Usuario gratis en `/inicio`, `/pronosticos`, `/partidos/:partidoId`, `/perfil`.
- [ ] `/admin` bloqueado para no admin.
- [ ] Admin en `/admin`, `/admin/modelo`, `/admin/partidos`.
- [ ] Premium manual permitido/bloqueado por RPC/RLS.

### Datos Y Pronosticos

| Comando | Resultado |
| --- | --- |
| `scripts/importar_ligas_temporadas.py --league 39 --seasons 2024 --dry-run` | `skipped_existing`; dataset local disponible. |
| `scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v1` | Omitido porque la salida V1 ya existe; no se uso `--force`. |

No se ejecuto importacion real para no consumir cuota y porque no esta completo el entorno Supabase.

### Pendientes Para Completar 7B

1. Crear `predigol-web/.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` o `VITE_SUPABASE_ANON_KEY`.
2. Completar `prediction-service/.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` reales.
3. Rotar cualquier clave que haya estado expuesta en `.env.example` si ya fue compartida o commiteada.
4. Reejecutar `scripts/verificar_python.py` hasta que Supabase aparezca OK.
5. Validar tablas/RPC/RLS con consultas reales.
6. Probar usuarios gratis, admin y premium manual en navegador.

## Reejecucion Fase 7B - Credenciales Configuradas - 2026-07-10

### Resultado General

Se reejecuto Fase 7B con credenciales locales parcialmente completas. La conexion de Python a Supabase real funciona, pero el proyecto Supabase definitivo no tiene aplicadas o expuestas todas las migraciones/RPC esperadas para admin/freemium.

### Variables Verificadas Sin Exponer Valores

| Archivo | Estado |
| --- | --- |
| `predigol-web/.env.local` | Existe e ignorado por Git. |
| `prediction-service/.env` | Existe e ignorado por Git. |

Variables frontend detectadas por nombre:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Variables prediction-service detectadas por nombre:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_API_KEY`
- `FOOTBALL_API_DRY_RUN`

### Pruebas Base

| Comando | Resultado |
| --- | --- |
| `npm test` | 90 tests pasaron. |
| `npm run lint` | Paso. |
| `npm run build` | Paso. |
| `npm run preview -- --host 127.0.0.1` | Arranco en `http://127.0.0.1:4173/`. |
| `prediction-service/.venv/Scripts/python.exe -m pytest prediction-service/tests` | 79 tests pasaron. |
| `prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py` | Supabase conectado; tablas admin/freemium faltantes o no accesibles. |

### Supabase Real Verificado Por REST

Tablas:

| Tabla | Resultado |
| --- | --- |
| `profiles` | OK. |
| `model_predictions` | OK. |
| `model_runs` | No accesible/no existe en REST. |
| `model_datasets` | No accesible/no existe en REST. |
| `team_aliases` | No accesible/no existe en REST. |
| `subscription_plans` | No accesible/no existe en REST. |
| `user_subscriptions` | No accesible/no existe en REST. |

RPC:

| RPC | Resultado |
| --- | --- |
| `predigol_es_admin` | No disponible para la llamada REST realizada. |
| `obtener_plan_usuario` | No disponible. |
| `obtener_predicciones_visibles` | No disponible. |
| `obtener_prediccion_visible` | No disponible. |
| `predigol_usuario_tiene_premium` | No disponible. |

`scripts/verificar_python.py` tambien reporto:

- `model_runs`: advertencia, no accesible o no existe.
- `model_datasets`: advertencia, no accesible o no existe.
- `team_aliases`: advertencia, no accesible o no existe.
- Partidos historicos disponibles: 0.
- Predicciones/registros de modelo: 0.

Conclusion: antes de validar usuarios reales, premium y admin, aplicar/verificar migraciones del MVP en Supabase definitivo.

### Usuarios Y Rutas

No se validaron credenciales de usuarios desde esta sesion porque no se proporcionaron usuario/clave de prueba ni acceso interactivo al navegador. Preview local queda listo para probar manualmente:

- `/`
- `/auth`
- `/inicio`
- `/pronosticos`
- `/partidos/:partidoId`
- `/perfil`
- `/admin`
- `/admin/modelo`
- `/admin/partidos`

### Datos Y Pronosticos

| Accion | Resultado |
| --- | --- |
| Dry-run API-Football liga 39 temporada 2024 | `skipped_existing`; dataset local ya existe. |
| Generacion V1 local | Omitida porque `reports/pronosticos_api_api_football_liga-39_temporada-2024_dataset_v1.json` ya existe. |
| Actualizacion de `model_predictions` | No realizada por este script local; no se sobrescribieron reportes. |

No se ejecuto importacion real de API-Football ni `--force` para evitar consumo de cuota y cambios innecesarios.

### Pendientes Reales

1. Aplicar/verificar migraciones que crean `model_runs`, `model_datasets`, `team_aliases`, `subscription_plans`, `user_subscriptions` y RPC freemium/admin.
2. Confirmar RLS despues de aplicar migraciones.
3. Crear/validar admin inicial por SQL controlado.
4. Probar usuario gratis, admin y premium manual en navegador.
5. Generar/guardar predicciones reales en `model_predictions` cuando existan historicos suficientes.

## Fase 7C - Sincronizacion Supabase Definitivo - 2026-07-10

### Estado

No se aplicaron migraciones automaticamente. Supabase CLI no esta instalado en este entorno. Se agrego un verificador seguro y se documento el inventario para aplicar migraciones pendientes sin operaciones destructivas.

### Script Agregado

```bash
prediction-service/.venv/Scripts/python.exe scripts/verificar_supabase_mvp.py
```

El script usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` desde `prediction-service/.env`, no imprime secretos y clasifica cada elemento como `OK`, `FALTANTE`, `PERMISOS` o `ERROR`.

### Resultado De Verificacion Supabase MVP

| Elemento | Resultado |
| --- | --- |
| `profiles` | OK. |
| `model_predictions` | OK. |
| `model_runs` | Faltante/no expuesto. |
| `model_datasets` | Faltante/no expuesto. |
| `team_aliases` | Faltante/no expuesto. |
| `subscription_plans` | Faltante/no expuesto. |
| `user_subscriptions` | Faltante/no expuesto. |
| `predigol_es_admin` | Permisos/grant/RLS insuficiente o funcion no ejecutable via REST. |
| `obtener_plan_usuario` | Faltante/no expuesto. |
| `obtener_predicciones_visibles` | Faltante/no expuesto. |
| `obtener_prediccion_visible` | Faltante/no expuesto. |
| `predigol_usuario_tiene_premium` | Faltante/no expuesto. |

### Migraciones Identificadas Como Necesarias

| Migracion | Motivo |
| --- | --- |
| `202606240005_admin_manual_match_panel.sql` | Define/grants iniciales admin si faltan. |
| `202606240006_roles_and_relevant_matches.sql` | Refuerza `profiles.rol` y `predigol_es_admin`. |
| `202607060001_model_v2_metadata.sql` | Settings/metadata de modelo sin cambiar V1/V2. |
| `202607060002_model_runs_datasets_team_aliases.sql` | Crea `model_runs`, `model_datasets`, `team_aliases`. |
| `202607060003_model_dataset_checksum_unique.sql` | Indice de checksum datasets. |
| `202607060004_lock_model_admin_writes.sql` | Bloquea escrituras admin directas para usuarios auth. |
| `202607070001_api_import_model_runs.sql` | Ajusta tipos de `model_runs`. |
| `202607100001_freemium_premium_access.sql` | Crea freemium/premium, subscriptions y RPC visibles seguras. |

### Validaciones Ejecutadas

| Comando | Resultado |
| --- | --- |
| `scripts/verificar_python.py` | Supabase conecta; advierte tablas admin faltantes e historicos insuficientes. |
| `scripts/verificar_supabase_mvp.py` | Falla esperado por elementos MVP faltantes. |
| `pytest prediction-service/tests` | 79 tests pasaron. |
| `npm test` | 90 tests pasaron. |
| `npm run lint` | Paso. |
| `npm run build` | Paso. |
| `npm run preview -- --host 127.0.0.1` | Arranco en `http://127.0.0.1:4173/`. |
| `scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v1` | Omitido porque salida V1 local ya existe; no se sobrescribio. |
| `scripts/importar_ligas_temporadas.py --league 39 --seasons 2024 --dry-run` | `skipped_existing`; no consumio cuota. |

### Pendiente Para Completar 7C

1. Aplicar migraciones pendientes en Supabase real con CLI o SQL Editor, sin reset.
2. Reejecutar `scripts/verificar_supabase_mvp.py` hasta que tablas/RPC esten OK.
3. Validar admin y usuarios en navegador real.
4. Validar premium bloqueado/permitido por RLS/RPC.
5. Cargar historicos/predicciones reales cuando schema este alineado.

## Fase 7D - Verificacion Post-Migraciones Manuales - 2026-07-10

### Estado General

Se reejecuto la verificacion despues de aplicar migraciones manualmente desde Supabase SQL Editor. La conexion real a Supabase sigue funcionando, pero la API REST todavia no expone las tablas/RPC admin-freemium esperadas.

### Seguridad Y Git

| Revision | Resultado |
| --- | --- |
| `git status --short` inicial | Limpio. |
| `predigol-web/.env.local` | Ignorado por Git. |
| `prediction-service/.env` | Ignorado por Git. |
| Secretos en archivos rastreados | No se encontraron secretos reales; solo placeholders documentales. |
| Reportes/build | Ignorados por Git. |

### Resultado Supabase MVP

| Elemento | Resultado |
| --- | --- |
| `profiles` | OK. |
| `model_predictions` | OK. |
| `model_runs` | Faltante/no expuesto por REST. |
| `model_datasets` | Faltante/no expuesto por REST. |
| `team_aliases` | Faltante/no expuesto por REST. |
| `subscription_plans` | Faltante/no expuesto por REST. |
| `user_subscriptions` | Faltante/no expuesto por REST. |
| `predigol_es_admin` | Existe o es visible, pero falla con `permission denied for function predigol_es_admin`. |
| `obtener_plan_usuario` | Faltante/no expuesto por REST. |
| `obtener_predicciones_visibles` | Faltante/no expuesto por REST. |
| `obtener_prediccion_visible` | Faltante/no expuesto por REST. |
| `predigol_usuario_tiene_premium` | Faltante/no expuesto por REST. |

### Migracion Correctiva Creada

Se creo `supabase/migrations/202607100002_refresh_mvp_grants.sql` para refrescar grants de funciones/tablas MVP existentes y pedir recarga del schema cache de PostgREST:

- No borra datos.
- No hace reset.
- No cambia V1/V2.
- No implementa pagos.
- Solo aplica grants condicionales si los objetos existen.

No se aplico automaticamente porque no hay Supabase CLI instalado en este entorno. Aplicarla manualmente despues de confirmar que las migraciones base realmente crearon los objetos faltantes.

### Validaciones Ejecutadas

| Comando | Resultado |
| --- | --- |
| `scripts/verificar_supabase_mvp.py` | Falla esperado por tablas/RPC faltantes y grant de `predigol_es_admin`. |
| `scripts/verificar_python.py` | Conecta a Supabase; advierte tablas admin faltantes e historicos insuficientes. |
| `pytest prediction-service/tests` | 79 tests pasaron. |
| `npm test` | 90 tests pasaron. |
| `npm run lint` | Paso. |
| `npm run build` | Paso. |
| `npm run preview -- --host 127.0.0.1` | Arranco en `http://127.0.0.1:4173/`. |
| `scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-39_temporada-2024_dataset.json --model v1` | Salida V1 local ya existia; no se sobrescribio. |
| `scripts/importar_ligas_temporadas.py --league 39 --seasons 2024 --dry-run` | `skipped_existing`; no consumio cuota. |

### Usuarios Y Premium

No se validaron usuarios reales porque el backend MVP aun no expone las tablas/RPC necesarias para admin/premium. Pendiente despues de corregir Supabase:

- [ ] Usuario admin entra a `/admin`.
- [ ] Usuario gratis no entra a `/admin`.
- [ ] Usuario gratis no recibe premium completo.
- [ ] Usuario premium manual ve contenido permitido.
- [ ] `user_subscriptions` registra premium manual.

### Pendientes Para Completar 7D

1. Confirmar en SQL Editor que los objetos faltantes existen en schema `public`.
2. Si existen, ejecutar `notify pgrst, 'reload schema';` o aplicar `202607100002_refresh_mvp_grants.sql`.
3. Si no existen, reaplicar en orden las migraciones base faltantes de Fase 7C.
4. Reejecutar `scripts/verificar_supabase_mvp.py` hasta que todas las tablas/RPC esten OK.
5. Validar usuarios reales y premium manual en navegador.

## Correccion Verificador Supabase MVP - 2026-07-10

### Alcance

`scripts/verificar_supabase_mvp.py` distingue ahora entre RPC faltante, permisos insuficientes, firma/cache REST incorrecta, RPC ejecutable y RPC existente protegida por sesion.

Las RPC que dependen de `auth.uid()` pueden responder `P0001: Debes iniciar sesion` cuando se prueban desde SQL Editor o sin una sesion de usuario real. Ese resultado confirma que la funcion existe y conserva la proteccion de sesion; no reemplaza la validacion funcional con usuarios reales.

### Validacion Pendiente En Navegador

- [ ] Usuario gratis: `obtener_plan_usuario`, `obtener_predicciones_visibles(24)` y `obtener_prediccion_visible(fixture real)` devuelven solo contenido permitido.
- [ ] Usuario premium manual: las mismas RPC devuelven contenido premium permitido si existe suscripcion activa o trial.
- [ ] Usuario admin: `predigol_es_admin()` permite acceso admin y las RPC devuelven datos completos segun policies.
- [ ] Usuario sin sesion: rutas privadas redirigen a `/auth` y no se usan RPC protegidas como fuente de datos publica.
