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
