# Fase 10C.4 - Secretos y Edge Functions Wompi Sandbox

Fecha: 2026-07-17

## Alcance

Configuracion minima de seguridad y despliegue controlado en Supabase Sandbox de las Edge Functions Wompi:

- `wompi-payment-status`
- `wompi-create-checkout`
- `wompi-webhook`

No se ejecutaron checkouts, pagos, invocaciones funcionales ni configuracion de webhook en Wompi.

## Estado Git inicial

- Rama: `main`
- Tracking: sincronizada con `origin/main`
- Worktree: limpio
- Staged: ninguno
- Commit de cierre 10C.3 presente: `db41a5d`
- `git diff --check`: sin errores

## Confirmacion de credenciales

El operador confirmo manualmente que la contrasena de base de datos previamente expuesta fue rotada.

El operador confirmo manualmente que los secretos configurados corresponden solo a PrediGol Sandbox y que no se usaron credenciales de produccion.

## Sandbox

- Project-ref enmascarado: `slup...cpda`
- Enlace local: confirmado mediante `supabase/.temp/project-ref`
- `supabase/.temp/pooler-url`: existe y esta ignorado por Git
- Nota operativa: `SUPABASE_SANDBOX_PROJECT_REF` no estuvo disponible dentro del shell de herramientas; para comandos CLI se uso el project-ref local vinculado desde `.temp` sin imprimir su valor completo.

## Historial de migraciones

Comando ejecutado: `npx --yes supabase@2.109.1 migration list --linked`

- Migraciones locales: 30
- Migraciones remotas: 30
- Pendientes: 0
- Solo remotas: 0
- Desalineadas: 0
- Resultado: historial alineado

No se ejecuto `supabase db push`.

## Variables utilizadas por el codigo

Nombres encontrados en `Deno.env.get(...)` dentro de las funciones Wompi auditadas:

- `SUPABASE_SECRET_KEYS`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `WOMPI_CHECKOUT_BASE_URL_SANDBOX`
- `WOMPI_EVENTS_SECRET_SANDBOX`
- `WOMPI_INTEGRITY_SECRET_SANDBOX`
- `WOMPI_PUBLIC_KEY_SANDBOX`
- `WOMPI_REDIRECT_URL_SANDBOX`

## Variables automaticas de Supabase

- `SUPABASE_URL`: automatica de Supabase, utilizada por las tres funciones.
- `SUPABASE_SECRET_KEYS`: automatica de Supabase, utilizada como fuente preferida de service role.
- `SUPABASE_SERVICE_ROLE_KEY`: automatica de Supabase, utilizada como fallback si no existe `SUPABASE_SECRET_KEYS`.

No se exigio que estas variables aparezcan en `secrets list` como secretos personalizados.

## Secretos personalizados

Obligatorios esperados y verificados por nombre:

- `WOMPI_PUBLIC_KEY_SANDBOX`: CONFIGURADO
- `WOMPI_INTEGRITY_SECRET_SANDBOX`: CONFIGURADO
- `WOMPI_EVENTS_SECRET_SANDBOX`: CONFIGURADO
- `WOMPI_CHECKOUT_BASE_URL_SANDBOX`: CONFIGURADO

Opcional:

- `WOMPI_REDIRECT_URL_SANDBOX`: OPCIONAL - NO CONFIGURADO

La ausencia de `WOMPI_REDIRECT_URL_SANDBOX` no impide el arranque de `wompi-create-checkout`: el codigo usa `Deno.env.get("WOMPI_REDIRECT_URL_SANDBOX") || undefined` y solo agrega `redirect-url` si existe.

## Prefijos Sandbox confirmados por el operador

- `WOMPI_PUBLIC_KEY_SANDBOX`: `pub_test_`
- `WOMPI_INTEGRITY_SECRET_SANDBOX`: `test_integrity_`
- `WOMPI_EVENTS_SECRET_SANDBOX`: `test_events_`

No se leyeron ni documentaron valores de secretos.

## Auditoria de autenticacion

### `wompi-create-checkout`

- Requiere Authorization/JWT mediante configuracion `verify_jwt = true` y validacion de usuario con `auth.getUser()`.
- Resuelve el usuario desde el token recibido en `Authorization`.
- No acepta `user_id` del cliente.
- Obtiene monto y moneda desde `payment_products`.
- No expone secretos en respuestas.
- Crea orden pendiente solo para el usuario autenticado.

### `wompi-payment-status`

- Requiere Authorization/JWT mediante configuracion `verify_jwt = true` y validacion de usuario con `auth.getUser()`.
- Consulta ordenes filtrando por `user_id = userData.user.id`.
- No permite consultar datos ajenos por `order_id` o `reference`.

### `wompi-webhook`

- Configurado con `verify_jwt = false` porque Wompi no envia JWT de Supabase.
- Verifica `WOMPI_EVENTS_SECRET_SANDBOX` mediante firma del evento.
- Rechaza firma invalida con estado `400` y registra el evento como fallido.
- Verifica referencia, monto, moneda y ambiente contra la orden local.
- Usa idempotencia con `payment_webhook_events` y `payment_transactions`.
- No activa Premium basandose en frontend; la activacion ocurre solo tras evento aprobado validado y RPC interna.

## Configuracion JWT por funcion

Archivo modificado: `supabase/config.toml`

```toml
[functions.wompi-create-checkout]
verify_jwt = true

[functions.wompi-payment-status]
verify_jwt = true

[functions.wompi-webhook]
verify_jwt = false
```

Razon:

- Checkout y status son endpoints de usuario autenticado.
- Wompi no puede enviar un JWT de Supabase al webhook.
- El webhook autentica el evento mediante la firma Wompi dentro del codigo.

No se uso `verify_jwt = false` global.

## Diff de `config.toml`

Solo se agregaron las tres secciones `[functions.*]` indicadas. No se modificaron puertos, project ID, base local, Auth, Storage ni otras funciones.

No hay secretos en `supabase/config.toml`.

## Validaciones Deno

### Formato

Comando: `deno fmt --check` sobre los 5 archivos Wompi.

Resultado: PASS, `Checked 5 files`.

### Lint

Comando: `deno lint` sobre los 5 archivos Wompi.

Resultado: PASS, `Checked 5 files`.

### Check

Comandos individuales ejecutados:

- `deno check supabase/functions/_shared/wompi.ts`: PASS
- `deno check supabase/functions/wompi-create-checkout/index.ts`: PASS
- `deno check supabase/functions/wompi-payment-status/index.ts`: PASS
- `deno check supabase/functions/wompi-webhook/index.ts`: PASS

### Tests

Comando: `deno test supabase/functions/_shared/wompi_test.ts`

Resultado: PASS, `6 passed | 0 failed`.

## Estado previo de funciones

Comando: `npx --yes supabase@2.109.1 functions list --project-ref <sandbox>`

Resultado previo:

- `wompi-create-checkout`: NO DESPLEGADA
- `wompi-payment-status`: NO DESPLEGADA
- `wompi-webhook`: NO DESPLEGADA

## Despliegues

Todos los despliegues fueron individuales y sin `--no-verify-jwt`.

### `wompi-payment-status`

- Comando: `npx --yes supabase@2.109.1 functions deploy wompi-payment-status --project-ref <sandbox>`
- Codigo de salida: 0
- Mensaje final: funcion desplegada
- Advertencias: `WARNING: Docker is not running`
- Estado: DESPLEGADA
- Configuracion JWT: reconocida desde `supabase/config.toml` con `verify_jwt = true`

### `wompi-create-checkout`

- Comando: `npx --yes supabase@2.109.1 functions deploy wompi-create-checkout --project-ref <sandbox>`
- Codigo de salida: 0
- Mensaje final: funcion desplegada
- Advertencias: `WARNING: Docker is not running`
- Estado: DESPLEGADA
- Configuracion JWT: reconocida desde `supabase/config.toml` con `verify_jwt = true`

### `wompi-webhook`

- Comando: `npx --yes supabase@2.109.1 functions deploy wompi-webhook --project-ref <sandbox>`
- Codigo de salida: 0
- Mensaje final: funcion desplegada
- Advertencias: `WARNING: Docker is not running`
- Estado: DESPLEGADA
- Configuracion JWT: reconocida desde `supabase/config.toml` con `verify_jwt = false`

## Estado remoto posterior

Comando: `npx --yes supabase@2.109.1 functions list --project-ref <sandbox>`

- `wompi-payment-status`: ACTIVE, version 1, actualizado 2026-07-17 13:23:41 UTC
- `wompi-create-checkout`: ACTIVE, version 1, actualizado 2026-07-17 13:23:55 UTC
- `wompi-webhook`: ACTIVE, version 1, actualizado 2026-07-17 13:24:06 UTC

URLs publicas enmascaradas:

- `https://slup...cpda.functions.supabase.co/wompi-payment-status`
- `https://slup...cpda.functions.supabase.co/wompi-create-checkout`
- `https://slup...cpda.functions.supabase.co/wompi-webhook`

## Verificacion de seguridad sin invocacion

- `wompi-create-checkout` mantiene JWT obligatorio.
- `wompi-payment-status` mantiene JWT obligatorio.
- `wompi-webhook` tiene JWT de Supabase deshabilitado.
- El webhook realiza validacion criptografica propia mediante firma Wompi.
- Ningun secreto esta en Git.
- Ningun secreto esta en frontend.
- No se imprimieron valores de secretos.
- No se creo una orden.
- No se proceso un pago.
- No se activo Premium.
- No se configuro el webhook en Wompi.
- No se invocaron funciones.
- No se realizaron llamadas a la API de Wompi.

## Riesgos

- El comando `supabase secrets list` muestra digest de secretos en la CLI; no son valores secretos, pero se evito documentarlos.
- La CLI imprime automaticamente el project-ref completo en algunos comandos de despliegue; la documentacion mantiene solo la version enmascarada.
- Docker no estaba corriendo durante despliegue; la CLI desplego igualmente. Mantener esta advertencia bajo observacion si futuras funciones requieren bundling local distinto.
- La configuracion real de webhook en Wompi y smoke Sandbox todavia no han sido ejecutados.

## Bloqueantes

Ninguno al cierre de la fase.

## Operaciones remotas ejecutadas

- `supabase migration list --linked`
- `supabase secrets list --project-ref <sandbox>`
- `supabase functions list --project-ref <sandbox>` previo
- `supabase functions deploy wompi-payment-status --project-ref <sandbox>`
- `supabase functions deploy wompi-create-checkout --project-ref <sandbox>`
- `supabase functions deploy wompi-webhook --project-ref <sandbox>`
- `supabase functions list --project-ref <sandbox>` posterior

## Operaciones no ejecutadas

- `supabase db push`
- `supabase db reset --linked`
- `supabase migration repair`
- `supabase migration up`
- `supabase db pull`
- Nuevas migraciones
- SQL remoto
- Cambios de RLS, grants o RPC
- `supabase secrets set`
- `supabase secrets unset`
- Lectura o impresion de valores de secretos
- Llamadas a la API de Wompi
- Apertura de checkout
- Transacciones o pagos Sandbox
- Pagos de produccion
- Configuracion de URL de eventos en Wompi
- Invocacion funcional de `wompi-create-checkout`
- Insercion manual de ordenes
- Activacion manual de Premium
- `git add`
- Commit
- Push

## Estado Git final

Esperado al cierre:

- `supabase/config.toml`: modificado solo con secciones JWT por funcion.
- `docs/fase10c4-secretos-y-edge-functions-sandbox.md`: nuevo.
- Staged: ninguno.

## Recomendacion

LISTO PARA CONFIGURAR WEBHOOK WOMPI Y EJECUTAR SMOKE SANDBOX
