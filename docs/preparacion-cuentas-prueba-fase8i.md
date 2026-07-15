# Preparacion Cuentas Prueba Fase 8I

## Objetivo

Desbloquear la Fase 8I preparando manualmente tres cuentas independientes para smoke test autenticado en `https://predigol.onrender.com`:

- Usuario gratuito.
- Usuario premium.
- Administrador.

Esta guia no crea usuarios, no ejecuta SQL, no modifica Supabase y no almacena credenciales. Las acciones que dependan de Supabase deben realizarse manualmente desde Supabase Dashboard por el propietario del proyecto.

## Prerrequisitos

- Acceso de propietario al proyecto Supabase real usado por `https://predigol.onrender.com`.
- Acceso a Supabase Dashboard > Authentication > Users.
- Acceso a Supabase Dashboard > Table Editor para revisar `public.profiles`, `public.subscription_plans` y `public.user_subscriptions`.
- Si se decide usar SQL Editor, usar solo placeholders y revisar cada sentencia antes de ejecutarla manualmente.
- Tres correos de prueba independientes, no personales y no reutilizados por usuarios reales.
- Contraseñas creadas y guardadas fuera del repositorio, fuera de logs y fuera de esta documentacion.
- Confirmar que las migraciones freemium/admin estan aplicadas en Supabase real.

## Flujo Detectado De Registro E Inicio De Sesion

El frontend usa Supabase Auth desde `predigol-web/src/services/userAccountApi.js`:

| Accion | Implementacion detectada |
| --- | --- |
| Registro | `supabase.auth.signUp({ email, password, options: { emailRedirectTo, data: { nombre } } })`. |
| Login | `supabase.auth.signInWithPassword({ email, password })`. |
| Logout | `supabase.auth.signOut()`. |
| Perfil | Lee `public.profiles` con columnas `id, nombre, username, avatar_url, es_admin, rol`. |
| Plan | Ejecuta RPC `obtener_plan_usuario()`. |
| Admin visual | `isAdminUser(profile)` devuelve true si `profile.rol === "admin"` o `profile.es_admin === true`. |

No se encontro en el repositorio una migracion que cree `public.profiles` ni un trigger explicito `auth.users -> public.profiles`. Por eso, despues de registrar cada cuenta, debe confirmarse manualmente que existe una fila en `public.profiles` para el usuario.

## Campos Exactos Encontrados

### `public.profiles`

Campos usados o modificados por el proyecto:

| Campo | Uso detectado |
| --- | --- |
| `id` | Identificador del usuario; debe coincidir con `auth.users.id`. |
| `nombre` | Nombre visible del perfil. |
| `username` | Nombre de usuario opcional mostrado en perfil/admin. |
| `avatar_url` | Avatar opcional. |
| `es_admin` | Booleano agregado por `202606240005_admin_manual_match_panel.sql`, default `false`. |
| `rol` | Texto agregado por `202606240006_roles_and_relevant_matches.sql`, default `usuario`. |

Restriccion detectada:

- `profiles_rol_check`: `rol in ('usuario', 'admin')`.

### `public.subscription_plans`

Definida en `202607100001_freemium_premium_access.sql`:

| Campo | Restriccion/Uso |
| --- | --- |
| `code` | Primary key. Valores insertados: `free`, `premium`. |
| `name` | Obligatorio. |
| `description` | Opcional. |
| `active` | Obligatorio, default `true`. |
| `created_at` | Obligatorio, default `now()`. |
| `updated_at` | Obligatorio, default `now()`. |

### `public.user_subscriptions`

Definida en `202607100001_freemium_premium_access.sql`:

| Campo | Restriccion/Uso |
| --- | --- |
| `id` | UUID primary key, default `gen_random_uuid()`. |
| `user_id` | Obligatorio, referencia `auth.users(id)`, `on delete cascade`. |
| `plan_code` | Obligatorio, referencia `subscription_plans(code)`. |
| `status` | Obligatorio, default `free`. |
| `started_at` | Obligatorio, default `now()`. |
| `expires_at` | Opcional. Si es nulo no vence; si existe debe ser futuro para premium vigente. |
| `metadata` | Obligatorio, default `{}`. |
| `created_at` | Obligatorio, default `now()`. |
| `updated_at` | Obligatorio, default `now()`. |

Restricciones detectadas:

- `user_subscriptions_status_check`: `status in ('free', 'premium_active', 'premium_expired', 'canceled', 'trial')`.
- `user_subscriptions_one_active_plan_idx`: un unico registro activo por `user_id` cuando `status in ('premium_active', 'trial')`.

## RPCs Y Politicas Implicadas

| Elemento | Funcion detectada |
| --- | --- |
| `predigol_es_admin()` | Devuelve true para `service_role` o usuarios cuyo perfil tenga `rol = 'admin'` o `es_admin = true`. |
| `reclamar_primer_admin()` | Eleva al usuario autenticado solo si no existe ningun admin. Requiere perfil existente. |
| `predigol_usuario_tiene_premium(p_user_id uuid default auth.uid())` | Devuelve true si el usuario es admin o tiene suscripcion `premium_active`/`trial` vigente. |
| `obtener_plan_usuario()` | Devuelve `premium` si hay suscripcion activa/trial vigente; si no, devuelve `free` con `source = 'default_free'`. |
| `obtener_predicciones_visibles(p_limit integer default 24)` | Devuelve predicciones visibles segun entitlement. |
| `obtener_prediccion_visible(p_api_football_fixture_id bigint)` | Devuelve detalle visible de una prediccion. |
| Policy `user_subscriptions_admin_write` | Permite escribir `user_subscriptions` solo si `predigol_es_admin()` es true. |
| Policy `model_predictions_read_by_entitlement` | Permite leer premium a admin o usuario premium vigente. |

## Procedimiento Para Usuario Gratuito

Pasos manuales en Supabase Dashboard:

1. Crear la cuenta desde Authentication > Users o registrarla desde `https://predigol.onrender.com/auth` usando el flujo normal.
2. Confirmar el correo si el proyecto Supabase exige confirmacion de email.
3. Abrir Table Editor > `public.profiles`.
4. Confirmar que existe una fila cuyo `id` coincide con el usuario de Auth.
5. Confirmar que `rol` sea `usuario` o este en su default esperado.
6. Confirmar que `es_admin` sea `false`.
7. No crear ningun registro activo en `user_subscriptions` para esta cuenta.
8. Iniciar sesion en `/auth` y revisar `/perfil`: debe mostrar plan `Gratis` porque `obtener_plan_usuario()` cae en `source = 'default_free'`.

Mecanismo gratuito detectado:

- Una cuenta es gratuita sin cambios adicionales si no tiene suscripcion vigente en `user_subscriptions` con `status in ('premium_active', 'trial')`.
- `obtener_plan_usuario()` devuelve `plan_code = 'free'`, `status = 'free'`, `is_premium = false`, `expires_at = null`, `source = 'default_free'`.

## Procedimiento Para Usuario Premium

Opcion preferida si ya existe administrador funcional:

1. Crear o registrar la cuenta de prueba premium igual que una cuenta normal.
2. Confirmar que existe la fila correspondiente en `public.profiles`.
3. Iniciar sesion con una cuenta administradora real.
4. Abrir `https://predigol.onrender.com/admin`.
5. En la seccion Premium, seleccionar el usuario de prueba premium.
6. Definir dias de vigencia, por ejemplo `30`.
7. Usar una nota generica, sin datos personales ni correos reales.
8. Confirmar la activacion manual cuando la UI lo pida.
9. Cerrar sesion admin antes de probar la cuenta premium.
10. Iniciar sesion con la cuenta premium y revisar `/perfil`.

Lo que hace la UI admin segun `adminApi.js`:

- Inserta en `public.user_subscriptions`:
- `user_id`: usuario seleccionado.
- `plan_code`: `premium`.
- `status`: `premium_active`.
- `expires_at`: fecha futura calculada por dias.
- `metadata`: `{ source: "manual_admin", note: <nota> }`.

Opcion manual desde Supabase Dashboard si no se usa la UI:

1. Abrir Table Editor > `public.subscription_plans`.
2. Confirmar que exista `code = 'premium'` y `active = true`.
3. Abrir Table Editor > `public.user_subscriptions`.
4. Crear manualmente un registro para el usuario premium de prueba.
5. Usar `plan_code = 'premium'`.
6. Usar `status = 'premium_active'` o `trial`.
7. Usar `started_at` actual.
8. Usar `expires_at` futuro, o nulo solo si se acepta que no venza automaticamente.
9. Usar `metadata` sin datos personales, por ejemplo una marca generica de QA.

SQL orientativo NO EJECUTADO, solo si se decide usar SQL Editor manualmente:

```sql
insert into public.user_subscriptions (
  user_id,
  plan_code,
  status,
  started_at,
  expires_at,
  metadata
)
values (
  '<USER_ID_PREMIUM>',
  'premium',
  'premium_active',
  now(),
  now() + interval '30 days',
  jsonb_build_object('source', 'qa_manual_fase_8i')
);
```

Advertencia: si el usuario ya tiene un registro activo/trial, el indice unico parcial puede rechazar otra suscripcion activa. En ese caso, no borrar datos sin revisar; cancelar o expirar primero solo registros de la cuenta de prueba.

## Procedimiento Para Administrador

Opcion bootstrap solo si no existe ningun administrador:

1. Crear o registrar la cuenta administradora de prueba.
2. Confirmar que existe la fila en `public.profiles`.
3. Iniciar sesion con esa cuenta.
4. Si la UI actual expone la accion de primer administrador en perfil, usarla solo si se confirma que no existe ningun admin real.
5. La RPC implicada es `reclamar_primer_admin()` y falla si ya existe un perfil con `rol = 'admin'` o `es_admin = true`.

Opcion manual desde Supabase Dashboard si ya existe admin o si el bootstrap no esta disponible:

1. Crear o registrar la cuenta administradora de prueba.
2. Confirmar que existe la fila en `public.profiles`.
3. Abrir Table Editor > `public.profiles`.
4. Editar solo la fila de la cuenta de prueba admin.
5. Establecer `rol = 'admin'`.
6. Establecer `es_admin = true` para compatibilidad con la logica existente.
7. Guardar.
8. Iniciar sesion con esa cuenta y abrir `/admin`, `/admin/modelo` y `/admin/partidos`.

SQL orientativo NO EJECUTADO, solo si se decide usar SQL Editor manualmente:

```sql
update public.profiles
set rol = 'admin',
    es_admin = true
where id = '<USER_ID_ADMIN>';
```

No usar service role en frontend. La validacion admin del frontend y Supabase depende de `profiles.rol`, `profiles.es_admin` y `predigol_es_admin()`.

## Comprobaciones Previas A La Prueba 8I

Comprobaciones manuales en Supabase Dashboard:

1. Las tres cuentas existen en Authentication > Users.
2. Las tres cuentas tienen correo confirmado si la configuracion de Auth lo exige.
3. Las tres cuentas tienen filas distintas en `public.profiles`.
4. La cuenta gratuita tiene `rol = 'usuario'` y `es_admin = false`.
5. La cuenta gratuita no tiene `premium_active` ni `trial` vigente.
6. La cuenta premium tiene `rol = 'usuario'` y `es_admin = false`.
7. La cuenta premium tiene exactamente una suscripcion vigente `premium_active` o `trial`.
8. La suscripcion premium usa `plan_code = 'premium'`.
9. La suscripcion premium tiene `expires_at` futuro o nulo por decision explicita.
10. La cuenta admin tiene `rol = 'admin'` y `es_admin = true`.
11. No se reutilizan correos, IDs ni sesiones entre roles.
12. No se prueban usuarios reales.

SQL orientativo NO EJECUTADO para verificacion con placeholders:

```sql
select p.id,
       p.rol,
       p.es_admin,
       us.plan_code,
       us.status,
       us.started_at,
       us.expires_at,
       (us.status in ('premium_active', 'trial') and (us.expires_at is null or us.expires_at > now())) as premium_vigente
from public.profiles p
left join public.user_subscriptions us on us.user_id = p.id
where p.id in ('<USER_ID_GRATUITO>', '<USER_ID_PREMIUM>', '<USER_ID_ADMIN>')
order by p.id, us.started_at desc nulls last;
```

## Procedimiento De Reversion

Reversion recomendada despues del smoke test:

1. Cerrar sesion en la web para cada cuenta.
2. En Supabase Dashboard, abrir `public.user_subscriptions`.
3. Para la cuenta premium de prueba, cambiar suscripciones activas/trial a `premium_expired` o `canceled`.
4. Establecer `expires_at` en una fecha pasada si se usa `premium_expired`.
5. Marcar `metadata` con una nota generica de retiro de QA, sin datos personales.
6. En `public.profiles`, devolver la cuenta admin de prueba a `rol = 'usuario'` y `es_admin = false` si no debe conservar privilegios.
7. Si las cuentas no se conservaran para QA futuro, deshabilitarlas o eliminarlas desde Authentication > Users segun politica del proyecto.
8. Verificar que ninguna cuenta de prueba conserva admin o premium activo por error.

SQL orientativo NO EJECUTADO para expirar premium de prueba:

```sql
update public.user_subscriptions
set status = 'premium_expired',
    expires_at = least(coalesce(expires_at, now() - interval '1 second'), now() - interval '1 second'),
    updated_at = now(),
    metadata = metadata || jsonb_build_object('qa_retired', true)
where user_id = '<USER_ID_PREMIUM>'
  and status in ('premium_active', 'trial');
```

SQL orientativo NO EJECUTADO para retirar admin de prueba:

```sql
update public.profiles
set rol = 'usuario',
    es_admin = false
where id = '<USER_ID_ADMIN>';
```

## Riesgos Encontrados

- No se encontro en el repo la migracion original que crea `public.profiles` ni un trigger de creacion automatica desde `auth.users`; si el perfil no aparece tras registro, el frontend no podra reconocer nombre/rol/admin correctamente.
- Cambiar `rol` o `es_admin` en una cuenta equivocada puede conceder acceso administrativo real.
- Activar premium en una cuenta equivocada puede desbloquear contenido premium real.
- Una suscripcion con `expires_at = null` no vence segun la RPC actual.
- `predigol_usuario_tiene_premium()` considera premium a administradores por la llamada a `predigol_es_admin()`.
- `user_subscriptions_one_active_plan_idx` impide mas de una suscripcion activa/trial por usuario; intentar insertar otra puede fallar.
- La UI `/admin` lista usuarios y permite activar premium manual; debe usarse solo con cuenta admin de prueba o admin autorizado.
- `reclamar_primer_admin()` solo es seguro como bootstrap inicial; no debe usarse si ya existe un administrador real.
- Cualquier SQL en SQL Editor opera contra datos reales; usar Table Editor con filtros por UUID de prueba reduce errores, pero no elimina el riesgo.

## Como Evitar Afectar Usuarios Reales

- Usar correos de prueba claramente identificables fuera de esta documentacion.
- Registrar los UUID de prueba solo en una nota temporal segura, no en Git.
- Filtrar siempre por UUID exacto antes de editar `profiles` o `user_subscriptions`.
- No buscar ni editar por nombre visible si puede repetirse.
- No usar cuentas personales ni cuentas de clientes.
- No activar premium ni admin sobre usuarios existentes.
- Tomar captura mental o nota privada de los valores iniciales antes de editar, sin guardar datos sensibles en el repo.
- Revertir inmediatamente despues del smoke test si las cuentas no quedaran como fixtures permanentes de QA.

## Elementos Que No Se Pudieron Confirmar

- No se confirmo desde el repo la definicion completa original de `public.profiles`.
- No se confirmo desde el repo el trigger que crea perfiles automaticamente al registrar usuarios en Supabase Auth.
- No se confirmo si Supabase real exige confirmacion de correo para estas cuentas.
- No se confirmo si la UI de Perfil expone actualmente un boton visible para `reclamar_primer_admin()`; el servicio existe, pero el flujo visual debe verificarse en navegador.
- No se confirmo el estado actual de datos reales en Supabase porque no se consulto ni modifico la base.
- No se confirmo que existan predicciones premium reales para validar desbloqueo visual completo.

## Confirmaciones De Esta Preparacion

- No se modifico Supabase.
- No se ejecuto SQL.
- No se crearon usuarios.
- No se cambiaron RLS, grants, RPCs ni migraciones.
- No se modifico codigo de produccion.
- No se tocaron `docs/operacion-render-predigol.md` ni `docs/auditoria-fase8f-predigol.md`.
- No se almacenaron correos reales, contraseñas, tokens, cookies, claves Supabase ni IDs reales.
- No se ejecuto API-Football.
- No se hizo commit ni push.
