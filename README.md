# PrediGol Web

PrediGol es una app web de pronósticos de fútbol hecha con React, Vite y Supabase. Permite registrarse, guardar marcadores, sumar puntos, ver ranking global y competir en ligas privadas.

## Requisitos

- Node.js 20 o superior
- npm
- Un proyecto de Supabase con autenticación por correo habilitada

## Configuración local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea un archivo `.env.local` tomando como base `.env.example`:

   ```bash
   cp .env.example .env.local
   ```

3. Completa las variables de Supabase:

   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
   ```

4. Ejecuta la app:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`: inicia Vite en modo desarrollo.
- `npm run build`: genera la versión de producción.
- `npm run lint`: revisa errores estáticos con ESLint.
- `npm run preview`: sirve el build generado.

En Windows, si PowerShell bloquea `npm.ps1`, usa `npm.cmd run dev`, `npm.cmd run build` o `npm.cmd run lint`.

## Supabase esperado

La app consulta estas tablas y funciones:

- `profiles`: `id`, `nombre`, `username`, `avatar_url`.
- `partidos`: datos del encuentro, estado y resultado final.
- `pronosticos`: marcador guardado por usuario y partido.
- `ligas`: ligas privadas con código de invitación.
- `liga_miembros`: usuarios inscritos en cada liga.
- RPC `obtener_mis_ligas`.
- RPC `obtener_detalle_liga`.
- RPC `obtener_ranking_global`.
- RPC `obtener_ranking_liga`.

Las políticas RLS deben permitir que cada usuario lea y escriba solo sus propios pronósticos, cree ligas, se una a ligas por código y consulte las ligas en las que participa.

## Flujo automático del MVP

La API de fútbol debe alimentar y cerrar el ciclo de juego:

1. Guardar partidos próximos de Liga Colombiana, Libertadores y Champions.
2. Permitir pronósticos solo antes de `fecha_orden`.
3. Bloquear pronósticos cuando el partido inicia.
4. Consultar el resultado real cuando termina.
5. Calcular puntos y actualizar rankings globales, semanales, por torneo y por liga.

Reglas de puntos:

| Acción | Puntos |
| --- | ---: |
| Acierta ganador o empate | 3 |
| Acierta diferencia de goles | +1 |
| Acierta marcador exacto | 5 total |

Las rachas desbloquean insignias, no premios en dinero.

## Primera fase API-Football + modelo

La integracion inicial queda separada del navegador:

- `../supabase/migrations/202606240001_api_football_predictions.sql`: tablas para ligas, equipos, fixtures en vivo, snapshots y predicciones del modelo.
- `../supabase/functions/sync-live-fixtures`: Edge Function que consume API-Football con `API_FOOTBALL_KEY` y escribe en Supabase.
- `../prediction-service`: servicio Python Poisson/Elo que lee resultados historicos y guarda probabilidades en `model_predictions`.
- `src/pages/HomePage.jsx`: muestra la prediccion del modelo si ya existe para el partido.

La API key de API-Football debe vivir solo en Supabase Secrets. Las llaves administrativas de Supabase las inyecta Supabase en Edge Functions y tambien se usan en el servicio Python. No se deben poner en variables `VITE_`.

Guia completa: `../docs/api-football-predictions.md`.

Sin plan pago de API-Football, usa `../docs/modo-hibrido-gratis.md`: historicos 2022-2024 desde API-Football, partidos actuales cargados manualmente y resultados cerrados manualmente.

El panel interno `/admin/partidos` permite gestionar ese flujo sin SQL. El primer usuario puede activarse como administrador desde Perfil con `Activar primer admin`, siempre que aun no exista otro administrador.

Inicio solo muestra partidos marcados como relevantes. Los partidos manuales se crean visibles; los importados desde Google Sheets respetan la columna `relevante`; los importados desde API-Football quedan ocultos hasta que un administrador pulse `Mostrar` y ajuste su prioridad visual.

La primera API propia para datos actuales es `../supabase/functions/import-google-sheet-fixtures`. Lee una hoja publicada como CSV, previsualiza filas, llama la RPC `importar_partido_externo` y evita duplicados usando `external_source + external_id`. La plantilla de columnas esta en `../manual-data/google-sheets-partidos.template.csv`.

Para sincronizacion automatica, `../supabase/migrations/202606250002_google_sheet_auto_sync.sql` crea una configuracion privada, un secreto interno y un job horario con `pg_cron` + `pg_net`. Desde el panel admin se puede activar o desactivar la URL fija sin tocar SQL.

El panel admin tambien permite sincronizar inmediatamente la hoja, revisar errores por fila, editar partidos rapido y guardar cambios mediante la RPC `editar_partido_admin`.

El mismo panel incluye un bloque `API-FOOTBALL` para poblar historicos por rango de fechas sin usar PowerShell. En plan Free se recomienda `mode=range` con temporadas 2022-2024.

Para Fase 2, el panel muestra `Salud de datos MVP` y un importador rapido por mes de API-Football. La meta antes de correr el modelo es tener al menos 30 partidos finalizados con marcador y 1 partido proximo marcado como relevante.

Para Fase 3, el servicio `../prediction-service` incluye `--diagnose`, `--dry-run` y escritura final en `model_predictions`. El panel admin tambien muestra cuantas predicciones existen, cuantos proximos ya tienen modelo y la ultima fecha de generacion.

Para Fase 4, `../supabase/migrations/202606250004_predictions_scoring_ranking.sql` agrega calculo de puntos en base de datos, bloqueo de pronosticos despues del inicio y rankings reales para global y ligas privadas.

Para Fase 5, `../docs/mvp-publico-fase5.md` deja el guion de demo/MVP publico. Inicio limita la vista a 10 partidos relevantes y la hoja `../manual-data/google-sheets-demo-mvp.csv` sirve como dataset inicial no oficial.

Para Fase 6, `../docs/despliegue-fase6.md` deja el checklist de despliegue, Vercel, Supabase y activacion futura de API-Football pago. La web incluye `vercel.json` para que las rutas internas de React no fallen al recargar.

Para Fase 7, la ruta `/partidos/:partidoId` muestra el detalle del partido: estado, equipos, tu pronostico, modelo PrediGol, resultado e historial reciente. Inicio enlaza cada tarjeta con `Ver detalle`.

Para Fase 8, la ruta `/pronosticos` separa el historial completo de marcadores guardados: incluye resumen de puntos, busqueda, filtros por estado/acierto y enlace directo al detalle del partido. Perfil queda como resumen rapido con acceso al historial completo.

Para Fase 9, Inicio muestra un resumen rapido de puntos, posicion, pronosticos guardados y partidos abiertos, junto con accesos directos y estados visuales por partido. El detalle agrega una accion recomendada, seguimiento del flujo y una guia compacta de puntuacion para preparar la experiencia de demo publica.

Para Fase 10, los partidos proximos muestran una cuenta regresiva que se actualiza cada 30 segundos. La campana de Inicio abre `/notificaciones`, donde se agrupan partidos cercanos sin pronostico, marcadores ya guardados, juegos en vivo y resultados con los puntos obtenidos. Estos avisos se calculan con datos existentes de Supabase y no requieren una tabla adicional ni servicios de pago.

Para Fase 11, la interfaz comparte skeletons de carga, mensajes de exito/error descartables, foco visible y soporte para movimiento reducido. Inicio incorpora accesos con iconos y perfil navegable; la navegacion principal usa barra inferior en movil y lateral en escritorio sin cambiar las rutas ni los contratos de Supabase.

Para Fase 12, las pantallas protegidas usan `React.lazy` y `Suspense`, por lo que cada ruta se descarga solo cuando se visita. El bundle inicial de produccion bajo de 539.42 kB a 444.90 kB y la advertencia de chunks mayores a 500 kB desaparecio; Inicio, detalle, ranking, ligas, perfil, notificaciones y admin se generan como archivos independientes.

Para Fase 13, `../supabase/migrations/202607010001_api_football_sync_monitoring.sql` agrega historial y cuotas de API-Football. La Edge Function registra ejecuciones correctas, parciales o fallidas, y el panel admin permite revisar consumo, errores y configurar el cron pago, que permanece desactivado por defecto. Guia operativa: `../docs/api-football-fase13-operacion.md`.

Para Fase 14, `../prediction-service` incorpora un backtest temporal contra una linea base y guarda resultados en `model_evaluations`. El panel admin muestra acierto 1X2, marcador exacto, Brier y MAE con el tamano de prueba; el detalle del partido explica la prediccion sin presentarla como certeza. Guia: `../docs/modelo-fase14-backtest.md`.

Para Fase 15, la web incluye Error Boundary, monitoreo privado de errores, SEO en espanol, identidad PWA, service worker limitado a recursos locales y headers de seguridad para Vercel. `npm.cmd run release:check` valida lint, build, entorno y archivos de entrega. Checklist: `../docs/lanzamiento-fase15.md`.

Para Fase 16, el detalle se convierte en centro del partido con pestañas de resumen, pronostico, estadisticas e historial. Incluye forma reciente, enfrentamientos directos, comparacion Poisson/Elo y cronologia basada en snapshots reales.

Para Fase 17, los usuarios pueden seguir equipos y torneos. Inicio prioriza y filtra esos partidos, mientras Perfil permite administrar los favoritos protegidos por RLS.

Para Fase 18, Notificaciones incorpora recordatorios de 24 horas y 1 hora, avisos de inicio, resultados, puntos y favoritos con preferencias persistentes por usuario. Guia conjunta: `../docs/fases16-18-experiencia-personalizada.md`.

Para Fase 19, `/explorar` ofrece busqueda y filtros por estado, torneo y favoritos sobre todos los partidos disponibles, con enlaces directos al encuentro.

Para Fase 20, `/equipos/:nombre` y `/torneos/:nombre` muestran estadisticas, calendario, resultados y favoritos sin depender de una API adicional.

Para Fase 21, `obtener_ranking_segmentado` calcula clasificaciones globales, semanales y por torneo con la regla oficial de puntos. Ranking añade logros por participacion, aciertos, marcadores exactos y podio. Guia conjunta: `../docs/fases19-21-exploracion-competencia.md`.

Para Fase 22, `/estadisticas` presenta analitica personal por calidad de acierto, puntos posibles, torneo y resultados recientes.

Para Fase 23, el progreso y las invitaciones de ligas se pueden compartir mediante Web Share o portapapeles. Los enlaces `/ligas?codigo=...` abren el flujo de union con el codigo precargado.

Para Fase 24, `web_push_subscriptions`, el service worker y `send-test-push` permiten registrar dispositivos y comprobar notificaciones con la app cerrada. `dispatch-push-notifications` ejecuta cada 15 minutos recordatorios deduplicados de 24 horas, 1 hora, inicio y resultado. Guia conjunta: `../docs/fases22-24-analitica-social-push.md`.
