# Auditoria Fase 10A - Pagos Premium PrediGol

Estado: `MODELO PREMIUM APROBADO — SANDBOX WOMPI PENDIENTE`.

Fecha: 2026-07-15.

Alcance: auditoria documental y tecnica del modelo premium actual para preparar pagos reales. No se implementaron pagos, no se agregaron SDKs, no se tocaron variables de entorno, no se modifico Supabase, no se crearon migraciones, no se ejecutaron SQL ni Edge Functions, no se ejecuto API-Football y no se cambiaron V1/V2 ni recuperacion de contrasena.

## Hallazgos

El modelo freemium actual esta definido principalmente en `supabase/migrations/202607100001_freemium_premium_access.sql`.

Tablas actuales:

| Tabla | Estado actual | Brecha para pagos reales |
| --- | --- | --- |
| `subscription_plans` | Planes `free` y `premium`, nombre, descripcion y activo. | No tiene precio, moneda, intervalo, duracion, impuestos, proveedor ni producto externo. |
| `user_subscriptions` | Suscripciones por usuario con `plan_code`, `status`, `started_at`, `expires_at` y `metadata`. | No modela orden, pago, intento, webhook, ambiente, monto, moneda, id de transaccion ni auditoria idempotente. |
| `model_predictions` | `access_tier`, `premium_reason` y `premium_preview` diferencian contenido gratis/premium. | Correcto para entitlement, no para pagos. |

Estados actuales de suscripcion:

| Estado | Uso actual |
| --- | --- |
| `free` | Estado por defecto. |
| `premium_active` | Premium activo. |
| `premium_expired` | Premium vencido. |
| `canceled` | Cancelado. |
| `trial` | Prueba o acceso temporal. |

Protecciones actuales:

| Control | Evidencia |
| --- | --- |
| RLS en planes y suscripciones | `subscription_plans` y `user_subscriptions` tienen RLS habilitado. |
| Lectura de suscripcion | Usuarios leen sus propias suscripciones; admins pueden leer todas. |
| Escritura de suscripcion | Solo administradores via `predigol_es_admin()` pueden escribir por RLS. |
| Premium server-side | `predigol_usuario_tiene_premium()` valida admin o suscripcion activa no vencida. |
| Plan visible | `obtener_plan_usuario()` devuelve `free` o premium activo desde Supabase. |
| Predicciones premium | `model_predictions_read_by_entitlement` y RPCs devuelven datos completos solo si hay entitlement. |
| Frontend | `obtenerPlanUsuario()` consume RPC; `footballApi.js` y pantallas solo reflejan `is_locked` y `access_tier`. |

Admin y premium estan separados. `profiles.es_admin`, `profiles.rol`, `predigol_es_admin()` y `reclamar_primer_admin()` controlan administracion. Una cuenta admin puede ver premium por funcion, pero eso no equivale a compra premium comercial.

## Riesgos Si Se Implementa Pago Solo En Frontend

No se debe activar premium desde React, localStorage, query params, metadata enviada por el cliente o callbacks no verificados. El cliente no puede decidir precio, moneda, duracion, aprobacion, comprador, vencimiento ni plan final.

Riesgos principales:

| Riesgo | Impacto |
| --- | --- |
| Manipulacion de parametros | Usuario podria cambiar monto, moneda, plan o duracion. |
| Activacion falsa | Un redirect exitoso no prueba pago aprobado. |
| Doble procesamiento | Webhooks repetidos podrian duplicar o extender suscripciones sin idempotencia. |
| Cuenta equivocada | Pago podria asignarse a otro usuario si no se valida ownership server-side. |
| Contracargos/reembolsos | Premium quedaria activo sin reconciliacion. |
| Falta de auditoria | No habria trazabilidad ante soporte, fraude o disputa. |

## Brechas Para Cierre De Pagos Reales

Antes de implementar pagos reales se requiere diseno y migracion formal para:

| Necesidad | Motivo |
| --- | --- |
| Catalogo comercial server-side | Precio, moneda, duracion e identificadores externos no deben venir del frontend. |
| Orden o checkout interno | Vincular usuario autenticado, plan, proveedor, estado y ambiente. |
| Evento webhook idempotente | Registrar `provider_event_id` unico y payload verificado. |
| Identificador de pago externo | Permite conciliacion, soporte y reintentos. |
| Estados de pago separados | No mezclar `paid`, `pending`, `failed`, `refunded` con entitlement final. |
| Activacion server-side | Solo webhook verificado crea o actualiza `user_subscriptions`. |
| Reconciliacion | Consultar proveedor ante eventos perdidos, pendientes o disputas. |
| Operacion sandbox/produccion | Separar llaves, ambientes, URLs y registros. |

## Decision Actual De Proveedor Y Producto

Decision actual: `WOMPI COLOMBIA ACEPTADA PARA EL MVP Y SANDBOX`.

Estado del producto Premium: `MODELO PREMIUM APROBADO — SANDBOX WOMPI PENDIENTE`.

Clasificacion actual:

| Proveedor | Clasificacion |
| --- | --- |
| Wompi Colombia | `ACEPTADA PARA EL MVP Y SANDBOX` |
| Mercado Pago Colombia | `ALTERNATIVA FUERTE` |
| ZonaPagos Colombia | `ALTERNATIVA FUTURA SUJETA A VALIDACIÓN COMERCIAL Y TÉCNICA` |
| Stripe | `CONDICIONADO A ELEGIBILIDAD COMERCIAL Y PAÍS DE LA ENTIDAD` |

Modelo comercial aprobado: pago unico en COP, precio comercial COP $20.000, precio tecnico Wompi 2000000 centavos, nombre en Wompi `PrediGol Premium`, duracion 30 dias, renovacion manual y checkout alojado por Wompi. El frontend puede mostrar COP $20.000, pero el servidor debe utilizar el entero 2000000 como `amount-in-cents`. PrediGol nunca captura ni almacena datos de tarjeta.

La integracion todavia no esta implementada. No existen migraciones de pagos, Edge Functions de Wompi, checkout funcional, webhook desplegado, credenciales sandbox configuradas, cobros reales ni activacion premium mediante pagos.

## Conclusion

La base premium actual es adecuada para bloquear y desbloquear contenido desde Supabase. No es suficiente para pagos reales. La siguiente fase debe preparar sandbox con Wompi mediante backend server-side, firma de integridad, evento verificado, idempotencia y auditoria, sin activar Premium por URL de retorno y sin exponer secretos al navegador.
