# Decision Proveedor Pagos PrediGol

Decision: `Wompi Colombia como proveedor seleccionado para el MVP Premium y sandbox`.

Estado ADR: `ACEPTADA PARA EL MVP Y SANDBOX`.

Estado Fase 10A: `MODELO PREMIUM APROBADO — SANDBOX WOMPI PENDIENTE`.

Fecha: 2026-07-15.

Objetivo: registrar la decision del propietario de usar Wompi Colombia para la primera integracion sandbox del MVP Premium. Esta decision no implementa pagos, no crea migraciones, no crea Edge Functions, no modifica Supabase, no solicita credenciales, no almacena secretos y no activa Premium por pagos.

## Decision Aprobada

| Campo | Decision |
| --- | --- |
| Proveedor | Wompi Colombia. |
| Estado ADR | `ACEPTADA PARA EL MVP Y SANDBOX`. |
| Modelo de cobro | Pago unico. |
| Moneda | COP. |
| Precio Premium | COP $20.000. |
| Precio tecnico Wompi | 2000000 centavos. |
| Nombre en Wompi | PrediGol Premium. |
| Duracion | 30 dias. |
| Renovacion | Manual. |
| Renovacion automatica | No incluida en el MVP. |
| Checkout | Alojado por Wompi. |
| Datos de tarjeta | PrediGol nunca los captura ni almacena. |

## Clasificacion Actual

| Proveedor | Clasificacion |
| --- | --- |
| Wompi Colombia | `ACEPTADA PARA EL MVP Y SANDBOX` |
| Mercado Pago Colombia | `ALTERNATIVA FUERTE` |
| ZonaPagos Colombia | `ALTERNATIVA FUTURA SUJETA A VALIDACIÓN COMERCIAL Y TÉCNICA` |
| Stripe | `CONDICIONADO A ELEGIBILIDAD COMERCIAL Y PAÍS DE LA ENTIDAD` |

## Matriz Comparativa Conservada

| Criterio | Wompi Colombia | Mercado Pago Colombia | ZonaPagos Colombia | Stripe |
| --- | --- | --- | --- | --- |
| Enfoque Colombia | Alto. Proveedor local/regional con documentacion Colombia revisada previamente. | Alto. Fuerte presencia regional y checkout local. | Alto como recaudo multicanal en Colombia, sujeto a validacion comercial y tecnica. | Medio/bajo para Colombia directa; depende de disponibilidad de cuenta/entidad soportada. |
| Checkout alojado | Seleccionado para MVP con checkout alojado por Wompi. | Checkout Pro/preferencias como alternativa. | Links/formularios o Gateway sujetos a confirmacion tecnica. | Stripe Checkout donde Stripe este disponible. |
| Webhooks/eventos | Base de la arquitectura MVP; debe verificarse server-side. | Alternativa con notificaciones/webhooks. | No confirmado para PrediGol. | Webhooks maduros donde Stripe este disponible. |
| Firma/integridad | Firma de integridad generada server-side y evento verificado server-side. | Requiere implementar verificacion segun documentacion. | No confirmado para PrediGol. | Verificacion de firma madura donde Stripe este disponible. |
| Sandbox | Pendiente configurar credenciales sandbox. | Alternativa si se decide cambiar proveedor. | No confirmado para PrediGol. | Modo test donde Stripe este disponible. |
| Mejor encaje actual | Seleccionado por decision del propietario para MVP y sandbox. | Alternativa fuerte. | Alternativa futura. | Condicionado por elegibilidad comercial. |

## Arquitectura Wompi Confirmada

Principios obligatorios para Fase 10B:

1. El frontend envia unicamente `plan_id`.
2. El frontend nunca envia el precio confiable.
3. El frontend nunca envia la duracion confiable.
4. El frontend nunca decide la activacion Premium.
5. La Edge Function obtiene el usuario desde el JWT.
6. La Edge Function consulta el plan en la base de datos.
7. El monto se maneja como entero en centavos.
8. La referencia de pago es unica.
9. La firma de integridad se genera server-side.
10. La orden se crea inicialmente como pendiente.
11. La URL de retorno no confirma el pago.
12. El evento de Wompi se verifica server-side.
13. Se comparan monto, moneda, referencia y ambiente.
14. Solo un estado aprobado verificado activa Premium.
15. El procesamiento es idempotente.
16. Un evento duplicado no extiende dos veces la suscripcion.
17. Sandbox nunca activa suscripciones de produccion.
18. Ningun secreto se expone al navegador.

El frontend puede mostrar `COP $20.000`, pero el servidor debe utilizar el entero `2000000` como `amount-in-cents`. El frontend nunca es fuente confiable del precio.

## Edge Functions Planificadas

Nombres provisionales para Fase 10B:

- `wompi-create-checkout`.
- `wompi-webhook`.
- `wompi-payment-status`.

Los nombres finales pueden ajustarse al implementar, pero la separacion de responsabilidades debe mantenerse.

## Reglas De Activacion Premium

| Caso | Regla |
| --- | --- |
| Usuario con Premium vigente | Una compra aprobada extiende 30 dias desde el vencimiento actual. |
| Usuario sin Premium vigente | Los 30 dias empiezan desde la aprobacion server-side del pago. |
| Pago pendiente | No activa Premium. |
| Pago rechazado | No activa Premium. |
| Pago anulado | No activa Premium. |
| Pago con error | No activa Premium. |
| URL de retorno | Solo informativa; nunca activa Premium. |
| Evento duplicado | No extiende dos veces la suscripcion. |

## Reembolsos Y Contracargos

Propuesta inicial para reembolso:

- No eliminar registros de pago.
- Marcar la orden como reembolsada.
- Conservar auditoria.
- Evaluar la suspension o ajuste de la vigencia Premium.
- Evitar dejar fechas o estados contradictorios.

Propuesta inicial para contracargo:

- Marcar la orden como contracargo.
- Suspender el beneficio asociado cuando corresponda.
- Conservar evidencia operativa.
- Permitir revision administrativa.
- No convertir al usuario en administrador ni modificar otros permisos.

La politica comercial y legal definitiva permanece: `REQUIERE DECISIÓN DEL PROPIETARIO Y VALIDACIÓN PROFESIONAL`.

## Pendientes Antes De Implementar Sandbox

- Confirmar y configurar credenciales sandbox fuera del repositorio.
- Crear migracion revisable para catalogo, ordenes, transacciones y eventos.
- Crear Edge Functions en Fase 10B.
- Definir pruebas sandbox para aprobado, pendiente, rechazado, error, duplicado, reembolso y contracargo.
- Validar separacion sandbox/produccion.
- No hacer cobros reales.
- No activar Premium por URL de retorno.

## Funciones Excluidas Del MVP

No se incluyen renovacion automatica, plan anual, varios niveles Premium, prueba gratuita automatica, cuotas en tiempo real, comparacion entre casas de apuestas, montos recomendados, gestion de banca ni rentabilidad/value bets sin cuotas reales.
