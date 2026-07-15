# Incidentes PrediGol

Usar esta plantilla para registrar incidentes sin exponer datos personales, JWT, cookies, claves, correos reales ni capturas con informacion sensible.

## Niveles

| Nivel | Descripcion |
| --- | --- |
| Informativo | Evento esperado o recuperado, sin impacto operativo. |
| Bajo | Degradacion menor o advertencia sin bloqueo. |
| Medio | Funcionalidad importante afectada para parte de usuarios. |
| Alto | Sitio, Auth o rutas principales degradadas para la mayoria. |
| Critico | Exposicion de secretos, permisos incorrectos o caida total sostenida. |

## Plantilla

| Campo | Valor |
| --- | --- |
| Fecha y hora UTC/local |  |
| Entorno | Produccion / preview / local |
| Nivel | Informativo / Bajo / Medio / Alto / Critico |
| URL afectada |  |
| Sintoma |  |
| Estado HTTP |  |
| Alcance | Publico / usuarios autenticados / admin / Supabase / Render |
| Evidencia no sensible |  |
| Causa conocida |  |
| Mitigacion aplicada |  |
| Rollback requerido | Si / No |
| Responsable |  |
| Estado final | Abierto / Mitigado / Cerrado |
| Acciones preventivas |  |

## No Incidente

- Cero fixtures futuros si la consulta responde correctamente.
- Cero predicciones si la consulta responde `[]`.
- RPC que devuelve `[]` con HTTP correcto.
- Usuario gratuito sin contenido premium completo.
- Cold start de Render recuperado en un reintento limitado.

## Incidente Frontend

- HTTP 5xx en la URL principal.
- `index.html` ausente o sin marcador de PrediGol.
- Assets JS/CSS con 404 o Content-Type incorrecto.
- Rutas SPA con 404 de Render.
- Pantalla en blanco reproducible.
- Build roto en CI.

## Incidente Supabase

- DNS o red no disponible.
- CORS bloqueado en navegador.
- Error generalizado 401/403 con clave publica correcta.
- RPC esperada ausente o no ejecutable.
- Auth no redirige correctamente tras login o recuperacion.

## Incidente De Seguridad

- Secreto backend en bundle o logs.
- Service role expuesta en frontend.
- JWT, cookies o contrasenas en logs.
- Permisos administrativos incorrectos.
- RLS desactivada o bypass no autorizado.
