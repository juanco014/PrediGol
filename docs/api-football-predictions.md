# API-Football y modelo estadistico

Arquitectura primera fase:

```text
React PrediGol
  -> Supabase Auth
  -> Supabase Database + Realtime
  <- Edge Function sync-live-fixtures
  <- API-Football / API-Sports

Servicio Python separado
  -> lee historicos y proximos partidos
  -> entrena Poisson/Elo
  -> guarda predicciones en Supabase
```

## Ligas iniciales

La migracion `202606240001_api_football_predictions.sql` deja cargadas estas competiciones:

- Premier League
- LaLiga
- Serie A
- Bundesliga
- Ligue 1
- Champions League
- Liga BetPlay
- Copa Libertadores
- Copa Sudamericana
- Eliminatorias CONMEBOL
- FIFA World Cup
- Copa America
- UEFA Euro
- UEFA Nations League

Los IDs quedan en `football_competitions`. Si API-Football cambia un ID o una temporada, se ajusta ahi sin tocar React.

## Variables y secretos

Frontend Vite:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
```

Supabase Edge Function:

```bash
supabase secrets set API_FOOTBALL_KEY=tu_api_key
```

`SUPABASE_URL` y `SUPABASE_SECRET_KEYS` los inyecta Supabase automaticamente en Edge Functions. No se crean manualmente con `supabase secrets set`.

Servicio Python:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

## Orden recomendado

1. Ejecutar la migracion SQL en Supabase.
2. Desplegar `sync-live-fixtures`.
3. Ejecutar `mode=upcoming` para poblar proximos partidos.
4. Ejecutar `mode=results` para poblar historicos recientes.
5. Ejecutar el servicio Python con `--diagnose`.
6. Ejecutar el servicio Python con `--dry-run`.
7. Ejecutar el servicio Python sin flags para guardar predicciones.
8. Dejar `mode=live` programado cada 1 a 3 minutos durante partidos en vivo.
9. Dejar `mode=upcoming` y `mode=results` programados cada varias horas.

Si API-Football responde que el plan Free solo permite 2022 a 2024, la integracion esta funcionando pero el proveedor bloqueo la temporada actual. Para probar historicos:

```text
https://<project-ref>.supabase.co/functions/v1/sync-live-fixtures?mode=results&season=2024
```

Si el plan Free bloquea el parametro `last`, usa rango de fechas:

```text
https://<project-ref>.supabase.co/functions/v1/sync-live-fixtures?mode=range&season=2024&from=2024-05-01&to=2024-05-31
```

Para partidos actuales/proximos de 2025/2026 necesitas un plan de API-Football con acceso a esas temporadas o cambiar de proveedor de datos.

La alternativa sin pago queda documentada en `docs/modo-hibrido-gratis.md`: historicos gratis + partidos actuales manuales + resultados manuales.

Cuando se pague el plan, sigue `docs/despliegue-fase6.md`. La migracion `202606250005_api_football_paid_cron.sql` deja preparada la sincronizacion programada, pero queda desactivada hasta que un admin la habilite.

## Panel admin

El panel `/admin/partidos` incluye una seccion `API-FOOTBALL` para ejecutar `sync-live-fixtures` sin PowerShell:

- `Rango de fechas`: recomendado para plan Free, usando temporadas 2022 a 2024.
- `Resultados`: intenta traer resultados recientes, pero el plan Free puede bloquear `last`.
- `Proximos` y `En vivo`: utiles si el plan contratado permite la temporada actual.

En Fase 2, el mismo bloque tiene un importador rapido por mes. Sirve para preparar rangos completos como `2024-08-01` a `2024-08-31` sin escribir fechas a mano, y para acumular historicos hasta que el modelo tenga datos suficientes.

Los partidos importados desde API-Football quedan guardados, pero no se muestran en Inicio hasta que un admin los marque como relevantes.

El bloque `Salud de datos MVP` del panel resume cuantas filas hay por fuente, cuantos partidos finalizados tienen marcador y si ya existe al menos un partido proximo relevante para generar predicciones visibles.

En Fase 3, ese bloque tambien muestra:

- predicciones guardadas en `model_predictions`;
- proximos relevantes que ya tienen prediccion;
- fecha de la ultima prediccion generada;
- confianza promedio de las predicciones guardadas.

## Servicio de prediccion

Comandos recomendados:

```powershell
cd C:\Users\manja\OneDrive\Escritorio\PrediGol\prediction-service
copy .env.example .env
python -m predigol_model.run --diagnose
python -m predigol_model.run --dry-run
python -m predigol_model.run
```

`--diagnose` no entrena ni escribe datos. Solo responde si faltan historicos, partidos proximos relevantes o predicciones por guardar.

## Nota de seguridad

La API key de API-Football y la service role key de Supabase no deben entrar en `predigol-web/.env.local`. El navegador solo usa la publishable key.
