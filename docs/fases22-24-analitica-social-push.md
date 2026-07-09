# Fases 22-24: analitica, social y Web Push

## Fase 22 - Analitica personal

La ruta `/estadisticas` muestra:

- puntos, efectividad, marcadores exactos y racha;
- distribucion de la calidad de los aciertos;
- rendimiento de puntos posibles;
- puntos y aciertos por torneo;
- ultimos pronosticos resueltos.

Los calculos reutilizan `obtenerEstadisticasSupabase` y `calcularDetallePuntaje`, por lo que mantienen la regla oficial de PrediGol.

## Fase 23 - Compartir progreso y retos

La utilidad `shareContent.js` usa Web Share API en dispositivos compatibles y copia al portapapeles como respaldo.

- Analitica permite compartir el resumen personal.
- Cada liga privada tiene un boton para compartir.
- La invitacion usa `/ligas?codigo=CODIGO`.
- Al abrir el enlace, PrediGol muestra el formulario de union con el codigo precargado.

## Fase 24 - Web Push

La migracion `202607030003_web_push_subscriptions.sql` crea suscripciones protegidas con RLS. Cada usuario solo puede consultar y modificar sus propios dispositivos.

La pantalla `/notificaciones` permite activar o desactivar el dispositivo. Al activar:

1. solicita permiso del navegador;
2. registra el service worker;
3. crea la suscripcion PushManager;
4. guarda endpoint y claves en Supabase;
5. llama `send-test-push` con la sesion del usuario;
6. muestra una notificacion incluso si PrediGol no esta en primer plano.

La Edge Function valida el JWT, usa la service role internamente y desactiva endpoints que fallen. Las llaves privadas VAPID viven exclusivamente en Supabase Secrets.

Variables necesarias en frontend y Vercel:

```env
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=llave_publica_vapid
```

Secretos de la Edge Function:

```text
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_VAPID_SUBJECT
```

En este proyecto las llaves y la funcion de prueba ya fueron configuradas. Al desplegar la web en Vercel se debe copiar la llave publica como variable de entorno.

## Envio automatico

`dispatch-push-notifications` se ejecuta cada 15 minutos mediante `pg_cron` y `pg_net`. Calcula recordatorios de 24 horas, 1 hora, inicio y resultado usando solamente partidos reales de Supabase.

`web_push_deliveries` registra una clave unica por dispositivo y evento. Esto evita repetir el mismo recordatorio aunque el cron o la funcion se ejecuten varias veces. Los endpoints que fallen se desactivan automaticamente.

El dispatcher no acepta contenido ni destinatarios externos: siempre construye los mensajes desde partidos, pronosticos, favoritos y preferencias guardadas.

## Verificacion

```powershell
cd predigol-web
npm.cmd run release:check
```

Luego abre `/notificaciones` desde HTTPS o localhost, pulsa `Activar Web Push` y acepta el permiso del navegador.
