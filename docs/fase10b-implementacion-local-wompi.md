# Fase 10B - Implementacion Local Wompi

Estado: `IMPLEMENTACIÓN LOCAL COMPLETADA — APLICACIÓN EN SANDBOX PENDIENTE`.

Fecha: 2026-07-15.

Alcance: implementacion local de migracion, Edge Functions y pruebas para Wompi sandbox. No se aplicaron migraciones, no se desplegaron funciones, no se configuraron secretos reales, no se hicieron llamadas a Wompi, no se realizaron pagos y no se modifico Supabase remoto.

## Prerrequisitos Confirmados

- Dashboard de Wompi disponible.
- Sandbox activado.
- Llave publica sandbox disponible, valor no compartido.
- Llave privada sandbox disponible, valor no compartido.
- Secreto de eventos sandbox disponible, valor no compartido.
- Secreto de integridad sandbox disponible, valor no compartido.
- URL de eventos todavia vacia.
- Produccion no debe utilizarse.
- Pagos reales no deben ejecutarse.

## Modelo Actual Auditado

PrediGol ya contaba con `subscription_plans`, `user_subscriptions`, RLS y RPCs de entitlement premium en `202607100001_freemium_premium_access.sql`. Ese modelo protege acceso a contenido premium, pero no registraba productos de pago, ordenes, transacciones, webhooks, idempotencia, monto, moneda, ambiente ni auditoria de pagos.

## Migracion Local Creada

Archivo: `supabase/migrations/202607150001_wompi_premium_payments.sql`.

Tablas propuestas:

| Tabla | Proposito |
| --- | --- |
| `payment_products` | Catalogo server-side del producto Wompi Premium. |
| `payment_orders` | Ordenes internas pendientes/aprobadas/rechazadas. |
| `payment_transactions` | Transacciones reportadas por Wompi. |
| `payment_webhook_events` | Eventos recibidos, firma, payload, hash e idempotencia. |
| `subscription_events` | Auditoria de activaciones/extensiones/suspensiones futuras. |

Producto seed local:

| Campo | Valor |
| --- | --- |
| `code` | `predigol-premium-30d` |
| `provider` | `wompi` |
| `environment` | `sandbox` |
| `plan_code` | `premium` |
| `name` | `PrediGol Premium` |
| `amount_in_cents` | `2000000` |
| `currency` | `COP` |
| `duration_days` | `30` |

## RLS Propuesta

- Usuarios autenticados leen productos activos.
- Usuarios autenticados leen solo sus ordenes, transacciones y eventos de suscripcion.
- Admins leen informacion operativa segun `predigol_es_admin()`.
- Usuarios normales no insertan, actualizan ni eliminan productos, ordenes, transacciones, webhooks ni eventos.
- `service_role` conserva escritura para Edge Functions server-side.

## Activacion Premium Atomica E Idempotente

Funcion SQL local propuesta: `public.predigol_apply_paid_premium_order(p_order_id uuid)`.

Reglas:

- Solo ejecutable por `service_role`.
- Bloquea la orden con `for update`.
- Rechaza ordenes no aprobadas.
- Rechaza ambiente distinto de `sandbox` durante la primera integracion local.
- Compara orden y producto: proveedor, ambiente, monto y moneda.
- Si ya existe evento de activacion/extension para la orden, retorna resultado idempotente sin extender dos veces.
- Si el usuario tiene Premium vigente, extiende desde el vencimiento actual.
- Si no tiene Premium vigente, inicia 30 dias desde la aprobacion server-side.
- Registra `subscription_events` para auditoria.

## Edge Functions Locales

### `wompi-create-checkout`

Archivo: `supabase/functions/wompi-create-checkout/index.ts`.

Resultado esperado local: valida usuario desde JWT, acepta solo `plan_id`, consulta producto server-side, crea orden interna pendiente, genera referencia unica, calcula firma de integridad server-side y devuelve URL de checkout alojado por Wompi. No llama a Wompi.

### `wompi-webhook`

Archivo: `supabase/functions/wompi-webhook/index.ts`.

Resultado esperado local: recibe evento, verifica firma con secreto de eventos, registra evento con hash/idempotencia, busca orden por referencia, compara monto/moneda/referencia/ambiente, registra transaccion, actualiza orden y activa Premium solo si el estado verificado es aprobado.

### `wompi-payment-status`

Archivo: `supabase/functions/wompi-payment-status/index.ts`.

Resultado esperado local: devuelve estado interno de una orden propia por `order_id` o `reference`. No consulta Wompi en esta primera ejecucion local.

## Firma De Integridad

Modulo: `supabase/functions/_shared/wompi.ts`.

La firma de integridad se calcula server-side con `reference + amountInCents + currency + integritySecret`. Para el MVP aprobado, el servidor debe usar `2000000` como `amount-in-cents`; el frontend solo puede mostrar `COP $20.000`.

## Verificacion De Eventos

La verificacion local usa la estructura de firma de eventos de Wompi: lista de propiedades, timestamp y secreto de eventos sandbox. El procesamiento falla si la firma no es valida.

## Separacion Sandbox/Produccion

- Producto seed en `sandbox`.
- Ordenes y eventos incluyen `environment`.
- La activacion local rechaza ambientes distintos de `sandbox`.
- No se usan credenciales de produccion.

## Tests Locales

Archivo: `supabase/functions/_shared/wompi_test.ts`.

Cubre firma de integridad, verificacion de evento, mapeo de estados, rechazo de monto incorrecto, URL de checkout con `amount-in-cents` y referencia sandbox.

## Pendientes Para Aplicar En Sandbox

- Revisar migracion SQL antes de aplicarla.
- Aplicar migracion en Supabase sandbox cuando el propietario autorice.
- Configurar secretos sandbox sin imprimirlos ni commitearlos.
- Desplegar Edge Functions.
- Configurar URL de eventos sandbox en Wompi.
- Ejecutar smoke sandbox controlado sin pagos reales de produccion.
- Validar evento aprobado, pendiente, rechazado, duplicado, reembolso y contracargo.
