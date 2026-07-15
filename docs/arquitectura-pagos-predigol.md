# Arquitectura Pagos Premium PrediGol

Estado: `DISENO PROPUESTO - NO IMPLEMENTADO`.

Fecha: 2026-07-15.

Este documento define la arquitectura minima segura para integrar pagos premium. No representa cambios aplicados en Supabase ni en el codigo.

## Principios

| Principio | Regla |
| --- | --- |
| Backend como autoridad | El servidor decide plan, precio, moneda, duracion, usuario y estado final. |
| Frontend sin confianza | React solo solicita iniciar checkout y muestra estados devueltos por Supabase. |
| Webhook obligatorio | Premium se activa solo despues de webhook verificado o reconciliacion server-side. |
| Idempotencia | Cada evento externo se procesa una sola vez. |
| Auditoria | Ordenes, pagos y eventos deben quedar trazables. |
| Separacion de ambientes | Sandbox y produccion no comparten llaves, eventos ni registros. |
| RLS conservadora | Usuarios no escriben pagos ni suscripciones directamente. |

## Flujo Recomendado

1. Usuario autenticado elige un plan permitido en frontend.
2. Frontend envia unicamente un `plan_id` autorizado a una Supabase Edge Function propuesta, por ejemplo `create-payment-checkout`.
3. Backend valida sesion, consulta plan, precio, moneda y duracion desde catalogo server-side y crea una orden interna pendiente.
4. Backend crea la operacion de pago en Wompi con referencia interna unica y firma de integridad generada server-side.
5. Frontend redirige al checkout alojado por Wompi.
6. La URL de retorno del navegador no confirma el pago y no activa premium.
7. Wompi envia un evento server-side verificable al backend, por ejemplo `wompi-webhook`.
8. Backend verifica autenticidad e integridad del evento de Wompi server-side.
9. Backend compara monto, moneda, referencia, ambiente y cuenta receptora contra la orden interna.
10. Backend registra evento con idempotencia y proteccion contra replay cuando el proveedor lo permita/documente.
11. Backend consulta o valida estado final del pago mediante `wompi-payment-status` cuando sea necesario.
12. Backend activa, extiende, cancela o mantiene pendiente `user_subscriptions` segun reglas internas.
13. Backend permite conciliacion operativa mediante `payment-reconciliation` si existen eventos perdidos o estados pendientes.
14. Frontend consulta `obtener_plan_usuario()` para reflejar el entitlement actualizado.

Los nombres provisionales para Fase 10B son `wompi-create-checkout`, `wompi-webhook` y `wompi-payment-status`. Los nombres finales pueden ajustarse al implementar.

## Modelo Comercial Aprobado

| Campo | Valor |
| --- | --- |
| Proveedor | Wompi Colombia. |
| Tipo de pago | Pago unico. |
| Moneda | COP. |
| Precio Premium | COP $20.000. |
| Precio tecnico Wompi | 2000000 centavos. |
| Nombre en Wompi | PrediGol Premium. |
| Duracion | 30 dias. |
| Renovacion | Manual. |
| Renovacion automatica | No incluida en el MVP. |
| Checkout | Alojado por Wompi. |

El frontend puede mostrar `COP $20.000`, pero el servidor debe utilizar el entero `2000000` como `amount-in-cents`. El frontend nunca envia el precio confiable ni la duracion confiable.

## Modelo De Datos Futuro

Tablas sugeridas para una migracion futura, no creada en esta fase:

| Tabla | Proposito |
| --- | --- |
| `payment_products` | Catalogo interno: plan, precio, moneda, duracion, activo, proveedor, producto externo. |
| `payment_orders` | Orden interna por usuario, producto, proveedor, ambiente y estado. |
| `payment_transactions` | Resultado de transacciones externas con monto, moneda, estado, referencia y fechas. |
| `payment_webhook_events` | Eventos crudos verificados, `provider_event_id` unico, hash/firma y resultado de procesamiento. |
| `subscription_events` | Historial de activaciones, extensiones, vencimientos, cancelaciones y reembolsos. |

Campos minimos recomendados:

| Campo | Donde aplica |
| --- | --- |
| `provider` | Wompi para MVP; otros proveedores quedan como alternativas futuras. |
| `environment` | `sandbox` o `production`. |
| `provider_checkout_id` | Sesion/preferencia/transaccion externa. |
| `provider_payment_id` | Pago externo final. |
| `provider_event_id` | Id unico para idempotencia de webhook. |
| `internal_reference` | Referencia propia no adivinable asociada a orden. |
| `amount_minor` | Monto en unidades menores. Para PrediGol Premium MVP debe ser 2000000 centavos. |
| `currency` | Moneda ISO, por ejemplo `COP` o `USD`. |
| `duration_days` | Duracion comercial que otorga el pago. |
| `status` | Estado interno de orden/transaccion. |
| `processed_at` | Momento de procesamiento server-side. |

## Reglas De Entitlement

La tabla `user_subscriptions` puede seguir siendo la fuente de acceso premium, pero no debe ser la fuente de verdad del pago. La activacion debe ocurrir desde backend despues de validar pago.

Reglas sugeridas:

| Caso | Accion |
| --- | --- |
| Pago aprobado nuevo | Crear o extender `premium_active` con `expires_at`. |
| Pago pendiente | Mantener usuario en `free`; mostrar estado pendiente si existe UI. |
| Pago rechazado o fallido | No activar premium. |
| Reembolso/contracargo | Cancelar o acortar premium segun politica definida. |
| Evento duplicado | Registrar como duplicado y no modificar entitlement. |
| Usuario admin | No tratar acceso admin como compra premium. |

Si el usuario tiene Premium vigente, una nueva compra aprobada extiende 30 dias desde el vencimiento actual. Si no tiene Premium vigente, los 30 dias empiezan desde la aprobacion server-side del pago.

## Superficie Backend

Implementacion futura recomendada:

| Endpoint/funcion | Responsabilidad |
| --- | --- |
| `wompi-create-checkout` | Valida usuario desde JWT, consulta catalogo server-side, crea orden pendiente, genera referencia unica/firma de integridad y devuelve checkout alojado por Wompi. |
| `wompi-webhook` | Recibe y verifica evento server-side de Wompi; compara monto, moneda, referencia y ambiente; procesa idempotentemente. |
| `wompi-payment-status` | Consulta server-to-server del estado de pago cuando sea necesario para conciliacion o soporte. |

Estas funciones requieren secretos server-side. No deben exponerse como variables `VITE_*` ni incluirse en frontend.

React nunca activa premium, nunca decide precio y nunca guarda llaves secretas. No se almacenan datos completos de tarjetas. No se utiliza service role en el frontend.

## Reembolsos Y Contracargos

Propuesta inicial para reembolso: no eliminar registros de pago, marcar la orden como reembolsada, conservar auditoria, evaluar suspension o ajuste de vigencia Premium y evitar fechas o estados contradictorios.

Propuesta inicial para contracargo: marcar la orden como contracargo, suspender el beneficio asociado cuando corresponda, conservar evidencia operativa, permitir revision administrativa y no convertir al usuario en administrador ni modificar otros permisos.

La politica comercial y legal definitiva permanece: `REQUIERE DECISIÓN DEL PROPIETARIO Y VALIDACIÓN PROFESIONAL`.

## Checklist Antes De Implementar

- Confirmar credenciales sandbox de Wompi fuera del repositorio.
- Disenar migracion SQL revisable para tablas de pagos.
- Implementar Edge Function o backend equivalente con secretos server-side.
- Crear pruebas de idempotencia, firma invalida, pago pendiente, pago aprobado, pago rechazado y reembolso.
- Ejecutar smoke sandbox sin usuarios reales ni cobros reales.

## No Hacer

- No activar premium por redirect de exito.
- No confiar en monto, moneda, plan o duracion enviados desde React.
- No guardar llaves secretas en `.env` frontend ni variables `VITE_*`.
- No actualizar `user_subscriptions` desde el cliente normal.
- No mezclar ambiente sandbox con produccion.
- No procesar webhooks sin firma o verificacion equivalente.
