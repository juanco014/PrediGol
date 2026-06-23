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
