# Freemium y premium PrediGol

Este documento describe la base freemium segura para usuarios gratis y premium, sin integrar pasarela de pago. En Fase 5 queda como alcance MVP entregable con premium manual/admin y pagos reales pendientes.

## Decision de producto

| Area | Decision |
| --- | --- |
| Modelo productivo | V1 sigue como modelo principal. |
| Modelo experimental | V2 queda para backtests/admin, sin promocionarlo al usuario final. |
| Pagos | No se integra pasarela en esta fase. |
| Premium | Puede asignarse manualmente por admin hasta integrar pagos. |
| Seguridad | El contenido premium se protege desde Supabase/RLS/RPC, no solo en React. |

## Modelo de acceso

Tablas agregadas:

| Tabla | Uso |
| --- | --- |
| `subscription_plans` | Catalogo simple de planes (`free`, `premium`). |
| `user_subscriptions` | Estado de suscripcion por usuario. |

Estados soportados:

| Estado | Significado |
| --- | --- |
| `free` | Usuario gratuito. |
| `premium_active` | Premium activo. |
| `premium_expired` | Premium vencido. |
| `canceled` | Cancelado. |
| `trial` | Prueba premium activa. |

## Contenido premium en predicciones

`model_predictions` conserva sus campos existentes y agrega:

| Campo | Uso |
| --- | --- |
| `access_tier` | `free` o `premium`. Default `free`. |
| `premium_reason` | Mensaje o motivo para bloqueo premium. |
| `premium_preview` | JSON seguro para preview sin revelar datos premium completos. |

Esto no cambia el modelo ni los calculos. Solo clasifica acceso al contenido ya generado.

## Proteccion real

La proteccion se implementa en Supabase:

| Elemento | Funcion |
| --- | --- |
| RLS `model_predictions_read_by_entitlement` | Permite leer filas premium solo a admin o usuarios premium. |
| `predigol_usuario_tiene_premium()` | Evalua si el usuario tiene premium activo/trial vigente. |
| `obtener_plan_usuario()` | Devuelve plan actual del usuario autenticado. |
| `obtener_predicciones_visibles()` | Devuelve predicciones visibles; para premium bloqueado devuelve preview sin probabilidades/xG/marcador. |
| `obtener_prediccion_visible()` | Igual que arriba, pero para un fixture especifico. |

El frontend debe usar las RPCs visibles, no leer datos premium directamente desde `model_predictions` para usuarios finales.

## Usuario gratis

Puede ver:

| Contenido | Acceso |
| --- | --- |
| Predicciones `access_tier = free` | Completo. |
| Predicciones `access_tier = premium` | Preview bloqueado si la RPC lo devuelve. |
| Perfil | Plan `Gratis`. |
| CTA premium | Mensaje `Premium proximamente`, sin checkout. |

## Usuario premium

Puede ver:

| Contenido | Acceso |
| --- | --- |
| Predicciones gratis | Completo. |
| Predicciones premium | Completo si `premium_active` o `trial` vigente. |
| Perfil | Plan premium y estado de suscripcion. |

## Administrador

El admin puede ver todo mediante `predigol_es_admin()`. Desde Fase 4, `/admin` muestra usuarios gratis/premium y permite activar premium manual temporal insertando en `user_subscriptions` con RLS admin y metadata `source = manual_admin`. No hay checkout ni pasarela.

## Pagos pendientes

No implementado en esta fase:

| Pendiente | Requisito futuro |
| --- | --- |
| Pasarela | Stripe, MercadoPago, PayPal u otra. |
| Webhooks | Activar/cancelar suscripciones desde proveedor. |
| Secretos | Guardar claves solo en servidor/Supabase Secrets. |
| Auditoria | Registrar cambios de plan y proveedor. |
| Checkout | UI real solo despues de backend seguro. |

## Cierre Fase 5

La entrega MVP mantiene premium como capacidad preparada, no como producto cobrado. El usuario gratis puede ver previews bloqueadas cuando apliquen, pero no debe recibir probabilidades, xG, marcador probable ni metadata completa de predicciones premium si no tiene acceso. La fuente de verdad sigue siendo Supabase/RLS/RPC.

## Advertencia responsable

Los pronosticos de PrediGol son estimaciones estadisticas con fines informativos y no garantizan resultados deportivos.

## Archivos principales

| Archivo | Uso |
| --- | --- |
| `supabase/migrations/202607100001_freemium_premium_access.sql` | Tablas, RLS y RPCs freemium. |
| `predigol-web/src/services/footballApi.js` | Consulta predicciones visibles seguras. |
| `predigol-web/src/services/userAccountApi.js` | Consulta plan del usuario. |
| `predigol-web/src/pages/PronosticosPage.jsx` | Muestra gratis completo y premium bloqueado. |
| `predigol-web/src/pages/PartidoDetailPage.jsx` | Respeta bloqueo premium en detalle. |
| `predigol-web/src/pages/ProfilePage.jsx` | Muestra plan actual. |
| `predigol-web/src/pages/AdminDashboardPage.jsx` | Revisa usuarios gratis/premium y activacion manual temporal. |
| `predigol-web/src/services/adminApi.js` | Lectura admin y alta manual de premium protegida por RLS. |

## Gestion manual temporal Fase 4

| Punto | Estado |
| --- | --- |
| Activacion premium manual | Disponible en `/admin` para admins. |
| Confirmacion | Requerida antes de insertar suscripcion. |
| Auditoria minima | `metadata.source = manual_admin` y nota opcional. |
| Cancelacion/expiracion manual avanzada | Pendiente. |
| Pagos reales | Pendiente. |

## Integracion futura de pagos

1. Elegir proveedor de pago.
2. Crear checkout server-side.
3. Guardar secretos fuera del frontend.
4. Recibir webhooks del proveedor.
5. Actualizar `user_subscriptions` desde backend/service role.
6. Mantener RPCs/RLS como unica fuente de autorizacion premium.
