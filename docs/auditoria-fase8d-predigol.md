# Auditoria Fase 8D PrediGol

## Alcance

Fecha: 2026-07-14.

Base auditada:

- Rama: `main`.
- Commit: `26cc730 chore(release): prepare PrediGol v0.8.0-rc.1`.
- Sin divergencia con `origin/main`: `0 0`.
- Produccion actual: `https://predigol.onrender.com`.

Cambios preexistentes preservados de Fase 8C:

- `docs/checklist-despliegue-predigol.md`.
- `docs/despliegue-predigol.md`.
- `docs/qa-despliegue-predigol.md`.
- `docs/release-predigol.md`.
- `docs/operacion-render-predigol.md`.

## Inventario Del Monorepo

| Area | Clasificacion | Decision |
| --- | --- | --- |
| `predigol-web` | Produccion activa frontend, PWA, rutas SPA, tests y tooling. | Conservar. |
| `prediction-service` | Servicio Python de modelos, backtests, validaciones y tests. | Conservar; V1/V2 intocables. |
| `scripts` | Soporte operativo, verificadores, importadores, publicador V1, preflight. | Conservar; varios estan bloqueados temporalmente, no muertos. |
| `supabase/migrations` | Historial de schema/RLS/RPC. | Conservar; no borrar migraciones historicas. |
| `supabase/functions` | Edge Functions para push, import Google Sheets y sync API-Football. | Conservar; futuras/operativas aunque no activadas. |
| `docs` | Documentacion vigente e historica. | Conservar y separar historia de estado vigente. |
| `manual-data` | Plantillas CSV/SQL para operacion manual controlada. | Conservar. |
| `reports` | Datasets, backtests y evidencias historicas. | Conservar para trazabilidad. |
| `.github` | CI sin secretos. | Conservar. |
| Config raiz | `.env.example`, `.gitignore`, README, `vercel.json`. | Conservar. |

## Linea Base Del Build

Comandos:

```bash
cd predigol-web
npm ci
npm run build
```

Resultado:

- Vite 8.1.0.
- 170 modulos transformados.
- 48 archivos en `dist`.
- Tamano total de `dist`: 794414 bytes.
- Source maps: no se generaron archivos `.map`.
- Warnings de chunks: ninguno.

Principales artefactos:

| Artefacto | Tamano |
| --- | ---: |
| `dist/assets/index-D7Ql_IWE.js` | 455281 bytes |
| `dist/assets/index-wf8JKCK1.css` | 107337 bytes |
| `dist/assets/AdminPartidosPage-Cm0l9f71.js` | 49863 bytes |
| `dist/assets/AdminDashboardPage-wtwX8eOQ.js` | 19432 bytes |
| `dist/assets/PartidoDetailPage-DJPhgbgP.js` | 16041 bytes |
| `dist/assets/ModelAdminPage-DrIdOQZU.js` | 15475 bytes |
| `dist/assets/HomePage-BvBfQTjq.js` | 14071 bytes |
| `dist/assets/NotificacionesPage-BQh4X4X6.js` | 13004 bytes |

## Matriz De Rutas

| Path | Componente | Acceso | Import | Enlaces/consumidores | Estado |
| --- | --- | --- | --- | --- | --- |
| `/` | `LandingPage` | Publica | Estatico | Landing, fallback publico. | Activa. |
| `/auth` | `AuthPage` | Publica sin sesion | Estatico | Landing, `ProtectedRoute`. | Activa. |
| `/inicio` | `HomePage` | Protegida | `React.lazy` | Auth, bottom nav, perfil, detalle. | Activa. |
| `/explorar` | `ExplorarPage` | Protegida | `React.lazy` | Bottom nav, README/docs. | Activa. |
| `/equipos/:entityName` | `FootballEntityPage` | Protegida | `React.lazy` | Explorar, entidad relacionada, docs. | Activa dinamica. |
| `/torneos/:entityName` | `FootballEntityPage` | Protegida | `React.lazy` | Explorar, docs. | Activa dinamica. |
| `/ranking` | `RankingPage` | Protegida | `React.lazy` | Bottom nav, home, estadisticas, docs. | Activa. |
| `/pronosticos` | `PronosticosPage` | Protegida | `React.lazy` | Bottom nav, home, perfil, detalle. | Activa. |
| `/ligas` | `LigasPage` | Protegida | `React.lazy` | Bottom nav, home, links compartidos. | Activa. |
| `/ligas/:ligaId` | `LigaDetailPage` | Protegida | `React.lazy` | Ligas, docs. | Activa dinamica. |
| `/partidos/:partidoId` | `PartidoDetailPage` | Protegida | `React.lazy` | Home, explorar, pronosticos, estadisticas. | Activa dinamica. |
| `/notificaciones` | `NotificacionesPage` | Protegida | `React.lazy` | Home, README/docs. | Activa. |
| `/estadisticas` | `EstadisticasPage` | Protegida | `React.lazy` | Perfil, docs. | Activa. |
| `/perfil` | `ProfilePage` | Protegida | `React.lazy` | Bottom nav, home, admin back links. | Activa. |
| `/admin` | `AdminDashboardPage` | Protegida; validacion admin en pagina/RPC/RLS | `React.lazy` | Perfil, docs. | Activa admin. |
| `/admin/partidos` | `AdminPartidosPage` | Protegida; validacion admin en pagina/RPC/RLS | `React.lazy` | Admin dashboard, docs. | Activa admin. |
| `/admin/modelo` | `ModelAdminPage` | Protegida; validacion admin en pagina/RPC/RLS | `React.lazy` | Admin dashboard, AdminPartidos, docs. | Activa admin. |
| `*` | `Navigate` | Fallback | N/A | Router. | Activa. |

## Dependencias Frontend

| Dependencia directa | Clasificacion | Evidencia |
| --- | --- | --- |
| `@supabase/supabase-js` | Produccion | `src/lib/supabase.js`. |
| `lucide-react` | Produccion | Iconos importados en componentes/paginas. |
| `react` | Produccion | Runtime React. |
| `react-dom` | Produccion | `src/main.jsx`. |
| `react-router-dom` | Produccion | `BrowserRouter`, rutas y navegacion. |
| `@eslint/js` | Desarrollo/lint | `eslint.config.js`. |
| `@types/react` | Desarrollo/tooling | Tipos del ecosistema React. |
| `@types/react-dom` | Desarrollo/tooling | Tipos del ecosistema React DOM. |
| `@vitejs/plugin-react` | Build | `vite.config.js`. |
| `eslint` | Lint | Script `npm run lint`. |
| `eslint-plugin-react-hooks` | Lint | `eslint.config.js`. |
| `eslint-plugin-react-refresh` | Lint | `eslint.config.js`. |
| `globals` | Lint | `eslint.config.js`. |
| `supabase` | Desarrollo/CLI | Dev dependency para CLI Supabase local. |
| `vite` | Build/dev | Scripts `dev`, `build`, `preview`. |

Decision: no se elimino ninguna dependencia directa. No hay candidata con evidencia suficiente.

## Candidatos Revisados

| Candidato | Evidencias | Riesgo | Decision |
| --- | --- | --- | --- |
| `useEstadisticasPrediGol` | No aparece como import en paginas actuales; vive junto a `estadisticasSupabase`. | Puede ser hook preparado para analitica/pantallas futuras y no hay reemplazo formal documentado. | Conservar. No determinado. |
| `obtenerAvisosPartidosEnVivo` y `obtenerNotificacionesUsuario` | No tienen consumidores directos actuales fuera de `notificationsApi.js`. | Exports de servicio; eliminarlos cambia API interna disponible y no aporta mejora medible. | Conservar. |
| Mocks `jugadoresRanking.js` y `partidos.js` | Son usados por `utils/ranking.js` y `utils/estadisticas.js`. | Fallback funcional. | Conservar. |
| `public/*.svg`, manifest y `sw.js` | Referencias desde `index.html`, manifest, service worker, release-check y docs. | PWA/favicons/social preview. | Conservar. |
| Scripts API-Football/importadores/publicador | Bloqueados por plan o por falta de fuente actual, pero documentados y con tests. | Eliminarlos rompe operacion futura y trazabilidad. | Conservar. |
| Edge Functions API-Football/push/Google Sheets | Documentadas y ligadas a operacion futura o existente. | Contratos remotos y secretos gestionados fuera del repo. | Conservar. |
| Reportes `reports/backtest_*` y datasets | Evidencia historica de backtests/datasets. | Trazabilidad de modelo/release. | Conservar. |
| `vercel.json` raiz y `predigol-web/vercel.json` | Aun usados por `release-check` y documentan headers/rewrites para Vercel. | Aunque produccion actual es Render, quitarlos reduce portabilidad y rompe release-check. | Conservar. |

## Hallazgos Sin Cambio

- Los `console.error` y `console.warn` en frontend son diagnostico operativo de errores, fallbacks, service worker, push y Supabase. No se detecto `console.log` de depuracion en frontend.
- Timers y canales revisados tienen cleanup en efectos (`clearInterval`, `removeChannel`, cleanup de realtime). Los listeners globales de `main.jsx` y `errorMonitoring.js` se registran una vez al bootstrap.
- Las consultas Supabase usan selects explicitos en la mayoria de servicios. No se cambio ningun RPC, tabla, columna ni contrato.
- No se agrego memoizacion. No hay evidencia medible de render costoso que justifique `useMemo`, `useCallback` o `React.memo` nuevos.
- La documentacion contiene referencias historicas a Vercel y API-Football; se conservan porque son contexto historico o soporte de configuracion alternativa. El estado vigente de Render queda documentado en Fase 8C.

## Cambios Realizados En Fase 8D

- Se agrego este documento de auditoria.
- No se elimino codigo.
- No se eliminaron dependencias.
- No se eliminaron assets.
- No se eliminaron scripts.
- No se consolidaron duplicaciones porque no hubo caso pequeno con evidencia suficiente y bajo riesgo.
- No se hicieron optimizaciones React ni consultas Supabase.

## Build Despues

No se modifico codigo funcional ni assets del frontend durante Fase 8D. Por lo tanto, las metricas esperadas despues son iguales a la linea base hasta que se realice una nueva optimizacion funcional.

## Produccion Sin Despliegue

Validacion de lectura requerida para esta fase:

- URL principal debe seguir respondiendo `200 OK`.
- Rutas SPA deben seguir entregando `index.html`.
- Assets JS/CSS deben seguir respondiendo `200 OK`.
- HTTPS debe permanecer activo.
- Cero predicciones/fixtures sigue siendo estado valido.

No se espera ver este documento en produccion hasta que exista commit, push y despliegue futuro.

## Restricciones Confirmadas

- No modificar V1.
- No modificar V2.
- No consultar API-Football.
- No escribir en Supabase.
- No modificar RLS, migraciones aplicadas, RPC ni roles.
- No desplegar.
- No hacer commit ni push.
