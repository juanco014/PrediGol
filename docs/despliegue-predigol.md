# Despliegue PrediGol

## Alcance

Este runbook prepara el MVP para desplegar frontend y operar predicciones contra Supabase real. No incluye pagos reales, Stripe, PayPal, MercadoPago ni cambios de modelo. V1 queda como produccion y V2 como experimental.

## 1. Preparar Supabase

1. Crear o seleccionar proyecto Supabase definitivo.
2. Confirmar URL del proyecto y publishable/anon key publica.
3. Aplicar migraciones desde la raiz del repo:

```bash
npx supabase db push
```

4. Validar que existan tablas clave:

```sql
select to_regclass('public.model_predictions');
select to_regclass('public.model_runs');
select to_regclass('public.model_datasets');
select to_regclass('public.team_aliases');
select to_regclass('public.subscription_plans');
select to_regclass('public.user_subscriptions');
```

5. Validar RPCs clave:

```sql
select proname from pg_proc where proname in (
  'predigol_es_admin',
  'obtener_plan_usuario',
  'obtener_predicciones_visibles',
  'obtener_prediccion_visible',
  'predigol_usuario_tiene_premium'
);
```

## 2. Configurar Variables Frontend

En `predigol-web/.env.local` para local o en hosting:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
# VITE_SUPABASE_ANON_KEY=tu_anon_key_publica
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=tu_vapid_public_key
```

No configurar service role, API-Football key ni claves privadas en frontend.

## 3. Configurar Prediction Service

En `prediction-service/.env` local o en el runner privado:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_solo_backend
FOOTBALL_API_PROVIDER=api_football
FOOTBALL_API_KEY=tu_api_football_key
FOOTBALL_API_DRY_RUN=true
```

Cambiar `FOOTBALL_API_DRY_RUN=false` solo cuando se vaya a consumir API real con cuota disponible.

## 4. Crear Admin Inicial

Metodo recomendado en Supabase SQL Editor, despues de que el usuario exista y tenga perfil:

```sql
update public.profiles
set rol = 'admin', es_admin = true
where id = 'UUID_DEL_USUARIO_ADMIN';
```

Validacion:

```sql
select id, email, rol, es_admin
from public.profiles
where rol = 'admin' or es_admin = true;
```

Existe RPC `reclamar_primer_admin()` para bootstrap controlado si no existe ningun admin, pero no se expone desde la UI de despliegue. No habilitar flujos donde cualquier usuario pueda elevarse desde frontend.

## 5. Generar Pronosticos Iniciales

Verificar Python:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/verificar_python.py
```

Planificar importacion sin consumir cuota:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --league 140 --seasons 2024 --dry-run
```

Importacion real solo con `FOOTBALL_API_KEY` configurada y cuota confirmada:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/importar_ligas_temporadas.py --league 140 --seasons 2024 --force
```

Generar pronosticos V1 desde dataset local:

```bash
./prediction-service/.venv/Scripts/python.exe scripts/generar_pronosticos.py --dataset reports/api_api_football_liga-140_temporada-2024_dataset.json --model v1
```

Si se usa el runner del servicio contra Supabase, mantener V1 como default operativo y registrar predicciones en `model_predictions` desde backend/script, nunca desde frontend con service role.

## 6. Build Frontend

```bash
cd predigol-web
npm test
npm run lint
npm run build
npm run preview
```

Preview local esperado: Vite mostrara una URL local, normalmente `http://localhost:4173/`.

## 7. Validar Rutas

Probar en navegador real las rutas documentadas en `docs/qa-despliegue-predigol.md`. Confirmar recarga directa de rutas privadas en hosting para evitar 404.

## 8. Verificar Premium/RLS

Con usuario gratis:

```sql
select * from public.obtener_predicciones_visibles(10);
```

La respuesta de predicciones premium bloqueadas debe tener campos sensibles en `null` y `is_locked = true`.

Con admin o usuario premium activo debe devolver contenido completo si existen filas premium.

## 9. Rollback Basico

Frontend:

1. Revertir al despliegue anterior desde el proveedor de hosting.
2. Confirmar variables de entorno previas.
3. Invalidar cache si aplica.

Supabase:

1. No editar migraciones ya aplicadas.
2. Crear migracion correctiva si hay bug de schema.
3. Desactivar temporalmente cron/API si consume cuota o falla.
4. Mantener backups antes de cambios sensibles.

## 10. Pendiente Para Pagos Reales

- Checkout server-side.
- Webhooks idempotentes.
- Secretos del proveedor fuera del frontend.
- Auditoria de cambios de suscripcion.
- Reconciliacion de pagos y expiraciones.

## 11. Estado QA Post-Despliegue Fase 7

Ejecucion local 2026-07-10:

- Frontend: tests, lint, build y preview pasan.
- Python: tests y verificacion de dependencias pasan.
- Dataset local disponible: `reports/api_api_football_liga-39_temporada-2024_dataset.json`.
- Pronosticos V1 locales ya generados: `reports/pronosticos_api_api_football_liga-39_temporada-2024_dataset_v1.json`.
- Supabase real no se valido desde este workspace porque faltan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `prediction-service/.env` y no existe `predigol-web/.env.local`.

Antes de declarar el despliegue validado contra backend real, completar:

1. Configurar variables publicas frontend.
2. Configurar variables privadas del servicio Python.
3. Validar migraciones/RPC/RLS en Supabase definitivo.
4. Probar usuario gratis, admin y premium manual en navegador real.
