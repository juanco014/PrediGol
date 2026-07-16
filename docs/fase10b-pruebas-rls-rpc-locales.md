# Fase 10B - Pruebas RLS/RPC locales

## 1. Objetivo

Validar localmente con pgTAP el contrato funcional de Auth, perfiles, RLS, RPC, ligas, pronosticos, pagos, suscripciones y grants endurecidos despues de reconstruir el esquema base de Supabase de PrediGol.

## 2. Entorno local utilizado

- Rama: `main`.
- Supabase CLI ejecutado mediante `npx --yes supabase@2.109.1`.
- Proyecto local desvinculado del remoto.
- Comprobacion previa equivalente a `Test-Path supabase.temp\project-ref`: `False`.
- Comandos ejecutados: `npx --yes supabase@2.109.1 db reset --local --no-seed` y `npx --yes supabase@2.109.1 test db`.
- No se uso `--linked`, `db push`, `db pull`, `migration repair` ni despliegue de funciones.

## 3. Archivos de test creados

- `supabase/tests/202607160001_auth_profiles_rls.test.sql`.
- `supabase/tests/202607160002_pronosticos_ligas_rls.test.sql`.
- `supabase/tests/202607160003_payments_subscriptions_rls.test.sql`.

## 4. Usuarios y datos ficticios empleados

Se usaron UUID fijos de prueba, sin credenciales reales ni secretos:

- Usuarios Auth/perfiles: `10000000-*`.
- Usuarios pronosticos/ligas: `20000000-*`.
- Usuarios pagos/suscripciones/admin: `30000000-*`.
- Partidos, ligas, productos, ordenes, transacciones, eventos y predicciones se insertaron con IDs locales de prueba.

Cada archivo usa `begin;` y termina con `rollback;`, por lo que los datos no persisten.

## 5. Pruebas ejecutadas por area

Auth y profiles:

- Creacion automatica de `profiles` al insertar en `auth.users`.
- Uso de `raw_user_meta_data.nombre`.
- Bloqueo de autoasignacion de `rol = admin` y `es_admin = true` desde metadata.
- Lectura propia de perfil.
- Lectura autenticada de perfiles ajenos, que es el contrato RLS actual.
- Actualizacion de campos personales por usuario normal.
- Bloqueo de cambios cliente sobre `rol`, `es_admin`, `id` y perfiles ajenos.
- Verificacion de ausencia de `TRUNCATE`, `REFERENCES`, `TRIGGER` en `profiles`.
- Prueba especial de usuario administrador autenticado editando campos personales.

Pronosticos y ligas:

- Insercion de pronostico propio.
- Bloqueo de pronostico para otro usuario.
- Aislamiento de lectura y escritura de pronosticos.
- Unicidad `(partido_id, usuario_id)`.
- Checks de goles `0..99`.
- FKs a `auth.users` y `partidos`.
- Creacion de liga propia.
- Bloqueo de creador ajeno.
- Unicidad de codigo de liga.
- Insercion de miembro fundador.
- Bloqueo de membresia arbitraria para otro usuario.
- Aislamiento de lectura y borrado de membresias.
- `obtener_mis_ligas()` y `obtener_detalle_liga(uuid)` con autorizacion por membresia.
- `predigol_es_admin()` para usuarios normales.

Pagos, suscripciones, RPC y grants:

- Lectura de ordenes, transacciones y eventos propios.
- Aislamiento de datos de pago entre usuarios.
- Bloqueo de `payment_webhook_events` para usuario normal.
- Acceso admin a webhooks, ordenes, transacciones y eventos.
- Bloqueo de escrituras directas sobre tablas de pago para usuarios normales.
- Bloqueo de modificacion directa de `user_subscriptions`.
- Verificacion de diferencia entre politica RLS admin y falta de grant SQL de escritura en `user_subscriptions`.
- `obtener_plan_usuario()`.
- `predigol_usuario_tiene_premium(uuid)` para usuarios sin y con suscripcion activa.
- Visibilidad de productos/planes activos para authenticated y de inactivos solo para admin.
- Ausencia de `TRUNCATE`, `REFERENCES`, `TRIGGER` para `anon` y `authenticated`.
- Ausencia de `CREATE` en schema `public` para `PUBLIC`, `anon` y `authenticated`.
- Existencia y `SECURITY DEFINER` de `predigol_es_admin()`.
- `search_path` explicito en funciones `SECURITY DEFINER` del esquema public.
- `reclamar_primer_admin()` no otorga admin cuando ya existe administrador.
- Predicciones premium bloqueadas para usuario gratuito.

## 6. Resultado total

Resultado anterior de `npx --yes supabase@2.109.1 test db`, antes de la correccion de `profiles`:

- Archivos: 3.
- Pruebas totales: 74.
- Aprobadas: 73.
- Fallidas: 1.
- Resultado global del comando: `FAIL`, por el fallo funcional confirmado en `profiles`.

Resultado nuevo validado despues de aplicar `202607160002_profiles_personal_update.sql`:

- Archivos: 3.
- Pruebas totales: 74.
- Aprobadas: 74.
- Fallidas: 0.
- Resultado global del comando: `PASS`.

Detalle por archivo:

- `202607160001_auth_profiles_rls.test.sql`: 20 pruebas, 19 aprobadas, 1 fallida.
- `202607160002_pronosticos_ligas_rls.test.sql`: 22 pruebas, 22 aprobadas, 0 fallidas.
- `202607160003_payments_subscriptions_rls.test.sql`: 32 pruebas, 32 aprobadas, 0 fallidas.

## 7. Fallos reales encontrados

Fallo confirmado:

- Archivo: `supabase/tests/202607160001_auth_profiles_rls.test.sql`.
- Prueba: 18.
- Mensaje: `admin autenticado deberia poder editar campos personales sin perder privilegios`.
- Objeto causante: politica `profiles_owner_update_safe` sobre `public.profiles`.
- Causa: el `with check (id = auth.uid() and rol = 'usuario' and es_admin = false)` permite al propietario editar solo si el resultado de la fila queda como usuario normal no admin. Un usuario con `rol = 'admin'` y `es_admin = true` no puede actualizar exclusivamente `nombre`, `username` o `avatar_url` desde cliente sin violar ese `with check`.

No se encontraron fallos finales en pronosticos, ligas, pagos, funciones premium ni grants peligrosos.

## 8. Diferencia entre grants y RLS

Se confirmo una diferencia intencional/operativa en `user_subscriptions`:

- RLS incluye politica de escritura para admin.
- Los grants SQL revocan `insert`, `update`, `delete` a `authenticated`.
- Resultado efectivo: incluso un admin autenticado no puede modificar `user_subscriptions` directamente por REST/table grants.

Esto mantiene la operacion de suscripciones en RPCs/servicio y evita escrituras directas cliente. Si se desea escritura admin desde UI en el futuro, requiere una migracion explicita y pruebas nuevas.

## 9. Problema de actualizacion del perfil administrador

Confirmado y corregido localmente mediante migracion independiente.

El administrador preparado con `profiles.rol = 'admin'` y `profiles.es_admin = true` es reconocido por `predigol_es_admin()`, pero no puede editar sus campos personales mediante la politica actual de owner update.

Resultado deseado:

- Permitir al admin modificar solo `nombre`, `username`, `avatar_url`.
- Impedir que el cliente modifique `rol`, `es_admin` o `id`.

Correccion aplicada:

- Migracion: `supabase/migrations/202607160002_profiles_personal_update.sql`.
- Se elimino la policy `profiles_owner_update_safe`.
- Se creo la policy `profiles_owner_update_personal` para `UPDATE` a `authenticated` con `using (id = auth.uid())` y `with check (id = auth.uid())`.
- Se revoco `UPDATE` general sobre `public.profiles` a `authenticated`.
- Se concedio `UPDATE` por columna solo sobre `nombre`, `username` y `avatar_url`.
- No se concedio `UPDATE` sobre `id`, `rol`, `es_admin`, `created_at` ni `updated_at`.
- No se modifico la policy de `INSERT`, la funcion ni el trigger de creacion automatica de perfiles.

La proteccion de `rol` y `es_admin` ya no depende de compararlos en `WITH CHECK`; depende de grants por columna. Asi, usuarios normales y administradores pueden editar sus campos personales, pero no pueden escribir columnas privilegiadas desde el cliente.

## 10. Problemas de ligas/RPC

No se confirmaron problemas finales.

`obtener_mis_ligas()` devuelve solo ligas del usuario autenticado. `obtener_detalle_liga(uuid)` permite acceso al miembro autorizado y bloquea al usuario no miembro.

## 11. Riesgos pendientes

- El contrato actual permite lectura autenticada amplia de `profiles` y `ligas`; fue validado como comportamiento existente, no como endurecimiento adicional.
- La correccion de perfil admin requiere una migracion separada y debe evitar abrir escalamiento de privilegios.
- No se ejecutaron pruebas de concurrencia Wompi; quedan para una fase posterior.
- No se hicieron pruebas E2E frontend sobre sesiones reales.

## 12. Correccion de grants por columna

La migracion correctiva usa grants por columna para separar identidad/autorizacion de campos personales:

- `authenticated` conserva lectura e insercion segun el contrato previo.
- `authenticated` ya no tiene `UPDATE` general de tabla sobre `public.profiles`.
- `authenticated` solo tiene `UPDATE` sobre `nombre`, `username` y `avatar_url`.
- `rol` y `es_admin` continuan protegidos para impedir escalamiento o perdida directa de privilegios desde cliente.
- `id` continua protegido para impedir reasignacion de identidad.
- `updated_at` no se concede porque no existe un trigger automatico local que requiera escritura cliente.

Auditoria local de grants:

- `information_schema.column_privileges` muestra `UPDATE` para `authenticated` solo en `avatar_url`, `nombre` y `username`.
- `information_schema.role_table_grants` no muestra `UPDATE` general de tabla para `authenticated` sobre `public.profiles`.

## 13. Confirmacion de rollback de datos

Cada archivo de test ejecuta:

- `begin;`
- `select * from finish();`
- `rollback;`

Los datos ficticios no persisten despues de la ejecucion.

## 14. Confirmacion de que no hubo acceso remoto

No se uso `supabase link`, `db push`, `db pull`, `db reset --linked`, `migration repair`, despliegue de Edge Functions, llamadas a Wompi ni secretos reales.

La ejecucion fue local mediante `npx --yes supabase@2.109.1 test db` contra la base local iniciada.
