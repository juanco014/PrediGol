# Recuperacion de contraseña PrediGol

Estado: recuperacion real de contraseña validada, endurecida y cerrada en Etapa 9.

## Fase 9D

- Fecha: 2026-07-15.
- Resultado: `COMPLETADA — RECUPERACIÓN ENDURECIDA Y ETAPA 9 CERRADA`.
- Se corrigio el guard de rutas privadas para que una sesion de recuperacion activa no habilite navegacion autenticada normal.
- Se corrigio la salida manual desde `/actualizar-contrasena` para cerrar la sesion de recuperacion antes de volver al login.
- Enlace reutilizado: OK seguro por prueba manual del propietario, sin registrar enlace ni parametros.
- URL: navegacion con `replace` a `/actualizar-contrasena` despues de `PASSWORD_RECOVERY`; no se agrego limpieza redundante.
- Rate limits, correo, URLs y logs de Supabase revisados manualmente sin cambios automaticos.
- SMTP: `SMTP PERSONALIZADO CONFIGURADO` por confirmacion manual.
- Validaciones: `npm ci`, `npm test`, `npm run lint`, `npm run build`, `python -m pytest prediction-service/tests`, rutas publicas y revision de secretos OK.
- Cierre: `docs/cierre-etapa9-predigol.md`.

## Fase 9C

- Fecha: 2026-07-15.
- URL publica objetivo: `https://predigol.onrender.com`.
- Resultado: `COMPLETADA — RECUPERACIÓN REAL DE CONTRASEÑA VALIDADA`.
- La evidencia fue proporcionada mediante una prueba manual del propietario con una cuenta de prueba, sin compartir datos sensibles.
- Se valido solicitud real, recepcion del correo, apertura del enlace, redireccion a `/actualizar-contrasena`, contexto `PASSWORD_RECOVERY`, cambio de contraseña, rechazo de la contraseña anterior, login con la contraseña nueva, conservacion de perfil/permisos, persistencia y logout.
- Reutilizacion o expiracion del enlace: `NO VERIFICADO`, no bloqueante.
- No se almacenaron credenciales, tokens, cookies, sesiones, IDs ni enlaces completos.
- No se modifico Supabase.
- No se ejecuto API-Football.
- Auditoria: `docs/auditoria-fase9c-predigol.md`.

## Fase 9B

- Commit funcional desplegado: `5d605b0 feat(auth): add secure password recovery flow`.
- Supabase Dashboard confirmado manualmente con Site URL y Redirect URLs requeridas.
- Produccion verificada: `https://predigol.onrender.com` conserva rutas SPA y headers de seguridad.
- Rutas publicas verificadas por HTTP: `/`, `/auth`, `/recuperar-contrasena`, `/actualizar-contrasena`.
- Assets nuevos verificados: chunks de solicitud y actualizacion de contraseña responden 200.
- Smoke real de correo y cambio de contraseña validado posteriormente en Fase 9C.

## Flujo del usuario

1. El usuario entra a `/auth`.
2. En modo ingreso usa `¿Olvidaste tu contraseña?`.
3. La app abre `/recuperar-contrasena`.
4. El usuario ingresa su correo.
5. La app llama a Supabase Auth con `resetPasswordForEmail` y `redirectTo` seguro.
6. La UI siempre muestra un mensaje generico: `Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer tu contraseña.`
7. El usuario abre el enlace recibido por correo.
8. Supabase establece una sesion de recuperacion y emite `PASSWORD_RECOVERY`.
9. La app abre `/actualizar-contrasena`.
10. El usuario define y confirma una nueva contraseña.
11. La app llama a `updateUser({ password })`.
12. Tras exito, se limpian campos y se cierra la sesion de recuperacion.
13. El usuario vuelve al login.

## URLs de la aplicacion

- Solicitud: `/recuperar-contrasena`.
- Actualizacion: `/actualizar-contrasena`.

Ambas rutas son publicas en React Router y compatibles con el rewrite SPA `/* -> /index.html`.

## Configuracion manual en Supabase Dashboard

No modificar automaticamente desde scripts. Entrar a:

`Authentication -> URL Configuration`

Revisar:

- `Site URL` debe apuntar al origen publico esperado del entorno.
- `Redirect URLs` debe incluir solo las URLs necesarias.

URLs a agregar segun entorno:

- Produccion: `https://predigol.onrender.com/actualizar-contrasena`.
- Desarrollo local: `http://localhost:5173/actualizar-contrasena`.

Evitar:

- Comodines amplios en produccion.
- Redirects hacia dominios no controlados.
- URLs temporales no justificadas.
- Pasar un `redirectTo` recibido desde input del usuario.

## Plantilla de correo

Revisar en Supabase Dashboard la plantilla de recuperacion de contraseña antes del smoke real.

Confirmar:

- Que el enlace de recuperacion use el mecanismo oficial de Supabase Auth.
- Que el texto no prometa acceso si el enlace expiro.
- Que no incluya secretos ni datos privados.
- Que el dominio visible sea el esperado para el entorno.

No modificar la plantilla automaticamente durante Fase 9A.

## Prueba manual recomendada

1. Configurar Redirect URLs en Supabase.
2. Abrir `https://predigol.onrender.com/auth` tras desplegar la version.
3. Entrar a `¿Olvidaste tu contraseña?`.
4. Solicitar recuperacion con una cuenta de prueba controlada.
5. Verificar que la UI muestra el mensaje generico sin confirmar existencia de cuenta.
6. Abrir el correo recibido y usar el enlace.
7. Confirmar que la app abre `/actualizar-contrasena`.
8. Probar contraseña corta y confirmacion diferente.
9. Establecer una contraseña valida.
10. Confirmar que la app informa exito y vuelve al login.
11. Iniciar sesion con la nueva contraseña.
12. Cerrar sesion.

Si el enlace expira:

- Volver a `/recuperar-contrasena`.
- Solicitar un nuevo enlace.
- Usar solo el enlace mas reciente.

## Seguridad

- No se revela si el correo existe.
- No se guardan contraseñas en almacenamiento persistente.
- No se imprimen tokens, sesiones ni URLs sensibles.
- No se usa service role.
- No se modifica backend, RLS, migraciones, roles ni suscripciones.
- No se requieren nuevos origenes en CSP.

## Pendientes operativos

- Monitorear entregabilidad SMTP y rate limits durante uso publico.
- Revalidar smoke real post-deploy de 9D si Render no despliega automaticamente desde `main`.
