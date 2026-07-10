# QA despliegue PrediGol

## Preparacion

- [ ] Usar build de produccion o preview local.
- [ ] Confirmar que apunta al Supabase definitivo.
- [ ] Confirmar que migraciones estan aplicadas.
- [ ] Crear al menos un usuario gratis y un usuario admin.
- [ ] Tener predicciones V1 guardadas en `model_predictions` o documentar que el feed estara vacio.

## Visitante

- [ ] Entra a `/`.
- [ ] Ve propuesta de valor clara.
- [ ] Ve aviso responsable de pronosticos informativos.
- [ ] Puede ir a `/auth`.
- [ ] Al intentar rutas privadas sin sesion, redirige a `/auth`.

## Usuario Gratuito

- [ ] Inicia sesion correctamente.
- [ ] Entra a `/inicio`.
- [ ] Entra a `/pronosticos`.
- [ ] Ve pronosticos gratis si existen datos.
- [ ] Si no hay datos, ve estado vacio claro.
- [ ] Usa filtros de liga, equipo, tipo y fecha.
- [ ] Abre `/partidos/:partidoId` desde una card.
- [ ] Ve perfil en `/perfil`.
- [ ] No puede entrar a `/admin`.
- [ ] No puede entrar a `/admin/modelo`.
- [ ] No puede entrar a `/admin/partidos`.
- [ ] Si hay contenido premium, ve preview/bloqueo y no recibe probabilidades, xG, marcador probable ni metadata completa.

## Admin

- [ ] Inicia sesion con usuario admin.
- [ ] Entra a `/admin`.
- [ ] Ve dashboard operativo.
- [ ] Ve conteos de predicciones, datasets, runs y usuarios.
- [ ] Ve V1 como produccion.
- [ ] Ve V2 como experimental.
- [ ] No puede cambiar modelo desde UI.
- [ ] Entra a `/admin/modelo` y ve trazabilidad, datasets/runs y alias si existen.
- [ ] Entra a `/admin/partidos` y ve estado de partidos/API.
- [ ] Puede copiar comandos operativos.
- [ ] Puede activar premium manual solo si RLS/RPC lo permite y queda registro en `user_subscriptions`.

## Premium

- [ ] Usuario gratis recibe predicciones premium bloqueadas via RPC segura.
- [ ] Usuario premium activo o trial recibe contenido premium si existe.
- [ ] Admin recibe datos completos por `predigol_es_admin()`.
- [ ] La UI no es la fuente de seguridad; validar respuesta real de Supabase.

## Rutas Definitivas

- [ ] `/`
- [ ] `/auth`
- [ ] `/inicio`
- [ ] `/pronosticos`
- [ ] `/partidos/:partidoId`
- [ ] `/ligas`
- [ ] `/ligas/:ligaId`
- [ ] `/ranking`
- [ ] `/estadisticas`
- [ ] `/notificaciones`
- [ ] `/perfil`
- [ ] `/admin`
- [ ] `/admin/modelo`
- [ ] `/admin/partidos`

## Consola Y Red

- [ ] No hay errores de consola bloqueantes.
- [ ] No se descargan claves privadas.
- [ ] No aparece service role en responses, bundle ni variables publicas.
- [ ] RPCs premium devuelven null en campos bloqueados para usuario gratis.
- [ ] 404 de rutas internas no ocurre al recargar en hosting.

## Resultado

Registrar fecha, URL probada, usuario gratis, usuario admin, navegador, resultado y pendientes antes de liberar el MVP.
