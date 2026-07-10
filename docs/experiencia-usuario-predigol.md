# Experiencia de usuario PrediGol

Este documento resume la Fase 2 del MVP: experiencia gratuita presentable para usuarios finales, usando V1 como modelo principal de produccion y dejando V2 como experimental.

## Rutas principales

| Ruta | Acceso | Estado | Uso |
| --- | --- | --- | --- |
| `/` | Publica | Mejorada | Landing con propuesta de valor, gratis/premium futuro y aviso responsable. |
| `/auth` | Publica | Existente | Login/registro con Supabase Auth. |
| `/inicio` | Requiere sesion | Existente | Resumen personalizado, partidos, favoritos y predicciones del modelo. |
| `/pronosticos` | Requiere sesion | Mejorada | Feed de pronosticos PrediGol, filtros y historial de jugadas del usuario. |
| `/partidos/:partidoId` | Requiere sesion | Mejorada | Detalle de partido, probabilidades, marcador probable, xG y aviso responsable. |
| `/ligas` y `/ligas/:ligaId` | Requiere sesion | Existente/parcial | Ligas y ligas privadas. |
| `/ranking` | Requiere sesion | Existente | Ranking global/ligas. |
| `/perfil` | Requiere sesion | Mejorado/parcial | Perfil, cuenta, preferencias y plan actual. |
| `/notificaciones` | Requiere sesion | Existente/parcial | Preferencias y push notifications. |
| `/estadisticas` | Requiere sesion | Existente/parcial | Estadisticas de usuario/app. |
| `/admin` | Requiere sesion/admin | Operativo | Dashboard admin, predicciones, datasets, runs y premium manual. |
| `/admin/partidos` | Requiere sesion/admin | Operativo | Operacion de partidos/API sin cambio V1/V2 desde UI. |
| `/admin/modelo` | Requiere sesion/admin | Operativo | Model runs, datasets y trazabilidad. |

## Flujo del usuario gratuito

1. Entra a la landing y entiende que PrediGol ofrece pronosticos deportivos informativos.
2. Se registra o inicia sesion.
3. Entra a `/pronosticos` para ver pronosticos gratuitos del modelo principal V1.
4. Filtra por liga, equipo, fecha y tipo de acceso.
5. Abre el detalle del partido para ver probabilidades, marcador probable, xG, confianza y explicacion simple.
6. Puede guardar sus propios marcadores para competir en ranking.

## Que ve gratis

| Elemento | Estado |
| --- | --- |
| Pronosticos destacados del modelo | Visible en `/pronosticos`. |
| Probabilidades local/empate/visitante | Visible. |
| Pronostico principal | Visible. |
| Marcador probable | Visible si existe en `model_predictions`. |
| Confianza | Visible si existe en `model_predictions`. |
| Detalle de partido | Visible para usuarios autenticados. |
| Historial de jugadas propias | Visible. |
| Ranking/favoritos basicos | Visible segun modulos existentes. |

## Premium pendiente

Las etiquetas premium son comunicacion de producto y deben apoyarse en la respuesta segura de Supabase. No hay checkout ni pagos reales todavia.

Desde Fase 3, las predicciones marcadas como `access_tier = premium` deben consultarse mediante RPCs seguras. El frontend puede mostrar una card bloqueada, pero los campos sensibles no deben llegar al navegador si el usuario no tiene acceso.

Pendiente para pagos reales:

| Pendiente | Requisito |
| --- | --- |
| Plan premium | Definir beneficios, precio y limites. |
| Suscripciones | Crear entidad server-side con estado de plan. |
| Proteccion premium | Validar acceso desde Supabase/backend, no solo React. |
| Pasarela | Integrar proveedor de pagos y webhooks. |
| Contenido premium | Definir que datos quedan restringidos y como auditarlos. |

## Aviso responsable

Texto usado en landing, pronosticos y detalle:

> Los pronosticos de PrediGol son estimaciones estadisticas con fines informativos y no garantizan resultados deportivos.

Este aviso debe mantenerse visible y profesional. PrediGol no debe prometer aciertos ni tratar probabilidades como garantias.

## Estado visual y responsive

La Fase 2 agrega o refuerza:

| Estado | Implementacion |
| --- | --- |
| Cargando | `LoadingState` en `/pronosticos`. |
| Sin pronosticos | Mensaje amigable cuando no hay `model_predictions`. |
| Error/conexion | Mensaje no tecnico para reintentar. |
| Sin resultados por filtros | Mensaje para limpiar filtros o cambiar liga/equipo. |
| Responsive | Filtros y cards pasan a una columna en pantallas pequenas. |

## Modelo mostrado al usuario

El usuario final ve `Modelo PrediGol V1` como modelo principal. No se muestra comparacion V1/V2 ni experimentos. V2 queda reservado para admin/backtests.
