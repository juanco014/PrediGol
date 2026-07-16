# Fase 10C.2 - Diagnostico remoto Supabase Sandbox

## 1. Fecha y alcance

- Fecha: 2026-07-16.
- Alcance: enlace seguro y diagnostico remoto de Supabase Sandbox para PrediGol.
- Proyecto Sandbox confirmado por variable de entorno heredada por OpenCode.
- Project-ref documentado solo en forma enmascarada: `slup...cpda`.

Esta fase no aplico migraciones remotas, no configuro secretos, no desplego Edge Functions y no llamo a Wompi.

## 2. Primera verificacion obligatoria

PowerShell no estuvo disponible desde la sesion de herramientas (`powershell.exe` y `pwsh` no encontrados). Se ejecuto una comprobacion equivalente sobre el entorno heredado del proceso, sin imprimir el valor completo.

Resultado:

```text
Project-ref Sandbox confirmado: slup...cpda
```

Clasificacion:

- `SUPABASE_SANDBOX_PROJECT_REF` fue heredada por OpenCode.
- Longitud plausible: confirmada.
- Valor completo: no impreso ni documentado.

## 3. Estado Git inicial

Comandos verificados:

```powershell
git branch --show-current
git status
git log -7 --oneline
git diff --check
git diff --cached --name-status
```

Resultado:

- Rama: `main`.
- Estado remoto: `Your branch is up to date with 'origin/main'`.
- Worktree inicial: limpio.
- Staged inicial: sin cambios.
- `git diff --check`: sin salida.
- `git diff --cached --name-status`: sin salida.
- Diagnostico anterior versionado: confirmado en commit `76be5c0 docs(supabase): document blocked sandbox diagnosis`.

Commits recientes:

| Commit | Mensaje |
| --- | --- |
| `76be5c0` | `docs(supabase): document blocked sandbox diagnosis` |
| `b756513` | `docs(wompi): add sandbox deployment preflight` |
| `2b29016` | `chore(supabase): remove rollback scripts from migrations` |
| `9bdc346` | `feat(payments): add local Wompi sandbox integration` |
| `9294b5c` | `fix(supabase): restore base schema and runtime grants` |
| `58e397b` | `fix(profiles): allow safe personal profile updates` |
| `572a26f` | `docs(payments): approve Wompi premium MVP model` |

## 4. Version Supabase CLI

Comando ejecutado:

```powershell
npx --yes supabase@2.109.1 --version
```

Resultado:

```text
2.109.1
```

## 5. Estado del enlace previo

Comprobacion local de `supabase/.temp` antes de `link`:

```text
supabase/.temp contiene: cli-latest, pgdelta/
```

Resultado:

- No existia `supabase/.temp/project-ref` antes del enlace.
- No habia enlace local previo detectable.

## 6. Resultado de autenticacion

No fue necesario ejecutar `npx --yes supabase@2.109.1 login`.

Evidencia:

- `supabase link` finalizo correctamente.
- Los comandos remotos posteriores pudieron consultar el proyecto Sandbox.

No se imprimio access token.

## 7. Resultado del enlace

Comando ejecutado:

```powershell
npx --yes supabase@2.109.1 link `
  --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF
```

Salida:

```text
Finished supabase link.
```

Clasificacion:

- Enlace completado contra el project-ref Sandbox heredado.
- Project-ref completo no impreso.
- No se paso password por argumento visible.

## 8. Resultado de `migration list --linked`

Comando ejecutado:

```powershell
npx --yes supabase@2.109.1 migration list --linked
```

Resultado final:

```text
Initialising login role...
Connecting to remote database...

Local          | Remote | Time (UTC)
---------------|--------|-----------
202606230001   |        | 202606230001
202606240001   |        | 202606240001
202606240002   |        | 202606240002
202606240003   |        | 202606240003
202606240004   |        | 202606240004
202606240005   |        | 202606240005
202606240006   |        | 202606240006
202606250001   |        | 202606250001
202606250002   |        | 202606250002
202606250003   |        | 202606250003
202606250004   |        | 202606250004
202606250005   |        | 202606250005
202607010001   |        | 202607010001
202607010002   |        | 202607010002
202607010003   |        | 202607010003
202607030001   |        | 202607030001
202607030002   |        | 202607030002
202607030003   |        | 202607030003
202607030004   |        | 202607030004
202607060001   |        | 202607060001
202607060002   |        | 202607060002
202607060003   |        | 202607060003
202607060004   |        | 202607060004
202607060005   |        | 202607060005
202607070001   |        | 202607070001
202607100001   |        | 202607100001
202607100002   |        | 202607100002
202607150001   |        | 202607150001
202607160001   |        | 202607160001
202607160002   |        | 202607160002
```

Nota operativa:

- Un primer intento de `migration list --linked` fallo transitoriamente con `SUPABASE_DB_PASSWORD` requerido.
- El reintento permitido del mismo comando conecto correctamente y produjo la tabla anterior.

## 9. Clasificacion de migraciones

Todas las migraciones locales aparecen ausentes en remoto. No hay migraciones remotas extra en la salida.

| Migracion | Clasificacion |
| --- | --- |
| `202606230001_predigol_base_schema.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606240001_api_football_predictions.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606240002_fix_partidos_api_upsert_constraint.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606240003_hybrid_free_manual_flow.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606240004_fix_manual_partido_ids.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606240005_admin_manual_match_panel.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606240006_roles_and_relevant_matches.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606250001_google_sheet_imports.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606250002_google_sheet_auto_sync.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606250003_admin_match_editing.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606250004_predictions_scoring_ranking.sql` | `PENDIENTE_EN_SANDBOX` |
| `202606250005_api_football_paid_cron.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607010001_api_football_sync_monitoring.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607010002_model_evaluations.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607010003_app_error_monitoring.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607030001_favorites_notification_preferences.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607030002_segmented_rankings.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607030003_web_push_subscriptions.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607030004_web_push_dispatch.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607060001_model_v2_metadata.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607060002_model_runs_datasets_team_aliases.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607060003_model_dataset_checksum_unique.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607060004_lock_model_admin_writes.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607060005_partidos_import_fallback_identity.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607070001_api_import_model_runs.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607100001_freemium_premium_access.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607100002_refresh_mvp_grants.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607150001_wompi_premium_payments.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607160001_harden_runtime_grants.sql` | `PENDIENTE_EN_SANDBOX` |
| `202607160002_profiles_personal_update.sql` | `PENDIENTE_EN_SANDBOX` |

## 10. Resultado de `db push --linked --dry-run`

Comando ejecutado:

```powershell
npx --yes supabase@2.109.1 db push --linked --dry-run
```

Resultado:

```text
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Would push these migrations:
 • 202606230001_predigol_base_schema.sql
 • 202606240001_api_football_predictions.sql
 • 202606240002_fix_partidos_api_upsert_constraint.sql
 • 202606240003_hybrid_free_manual_flow.sql
 • 202606240004_fix_manual_partido_ids.sql
 • 202606240005_admin_manual_match_panel.sql
 • 202606240006_roles_and_relevant_matches.sql
 • 202606250001_google_sheet_imports.sql
 • 202606250002_google_sheet_auto_sync.sql
 • 202606250003_admin_match_editing.sql
 • 202606250004_predictions_scoring_ranking.sql
 • 202606250005_api_football_paid_cron.sql
 • 202607010001_api_football_sync_monitoring.sql
 • 202607010002_model_evaluations.sql
 • 202607010003_app_error_monitoring.sql
 • 202607030001_favorites_notification_preferences.sql
 • 202607030002_segmented_rankings.sql
 • 202607030003_web_push_subscriptions.sql
 • 202607030004_web_push_dispatch.sql
 • 202607060001_model_v2_metadata.sql
 • 202607060002_model_runs_datasets_team_aliases.sql
 • 202607060003_model_dataset_checksum_unique.sql
 • 202607060004_lock_model_admin_writes.sql
 • 202607060005_partidos_import_fallback_identity.sql
 • 202607070001_api_import_model_runs.sql
 • 202607100001_freemium_premium_access.sql
 • 202607100002_refresh_mvp_grants.sql
 • 202607150001_wompi_premium_payments.sql
 • 202607160001_harden_runtime_grants.sql
 • 202607160002_profiles_personal_update.sql
Finished supabase db push.
```

Clasificacion:

- Dry-run exitoso.
- No aplico migraciones.
- Orden propuesto coincide con los timestamps locales.
- No reporto divergencias de historial.

## 11. Necesidad de `--include-all`

No se necesita `--include-all` para aplicar las migraciones SQL listadas.

Justificacion:

- `db push --linked --dry-run` incluyo las 30 migraciones locales esperadas sin `--include-all`.
- No se solicitaron roles ni seed como parte de esta fase.
- No se debe usar `--include-all` automaticamente.

## 12. Secretos remotos por nombre

Comando ejecutado:

```powershell
npx --yes supabase@2.109.1 secrets list `
  --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF
```

Resultado:

```text
NAME | DIGEST
-----|-------
```

Estado:

| Variable | Estado Sandbox |
| --- | --- |
| `SUPABASE_URL` | `AUSENTE_EN_SECRETS_LIST` |
| `SUPABASE_SECRET_KEYS` | `AUSENTE_EN_SECRETS_LIST` |
| `SUPABASE_SERVICE_ROLE_KEY` | `AUSENTE_EN_SECRETS_LIST` |
| `WOMPI_PUBLIC_KEY_SANDBOX` | `AUSENTE_EN_SECRETS_LIST` |
| `WOMPI_INTEGRITY_SECRET_SANDBOX` | `AUSENTE_EN_SECRETS_LIST` |
| `WOMPI_CHECKOUT_BASE_URL_SANDBOX` | `AUSENTE_EN_SECRETS_LIST` |
| `WOMPI_REDIRECT_URL_SANDBOX` | `AUSENTE_EN_SECRETS_LIST` |
| `WOMPI_EVENTS_SECRET_SANDBOX` | `AUSENTE_EN_SECRETS_LIST` |

No se ejecuto `secrets set` ni `secrets unset`.

## 13. Edge Functions remotas

Comando ejecutado:

```powershell
npx --yes supabase@2.109.1 functions list `
  --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF
```

Resultado:

```text
ID | NAME | SLUG | STATUS | VERSION | UPDATED_AT (UTC)
---|------|------|--------|---------|-----------------
```

Estado de las tres Edge Functions Wompi:

| Edge Function | Estado Sandbox |
| --- | --- |
| `wompi-create-checkout` | `NO_DESPLEGADA` |
| `wompi-payment-status` | `NO_DESPLEGADA` |
| `wompi-webhook` | `NO_DESPLEGADA` |

No se ejecuto `functions deploy` ni `functions delete`.

## 14. Riesgos encontrados

- Sandbox parece vacio: no tiene migraciones aplicadas, secretos remotos ni Edge Functions desplegadas.
- La aplicacion de migraciones en Sandbox crearia el esquema desde cero con las 30 migraciones locales.
- Las funciones Wompi no pueden operar en Sandbox hasta que se configuren secretos y se desplieguen las tres funciones.
- Un intento inicial de `migration list --linked` pidio `SUPABASE_DB_PASSWORD`, aunque el reintento fue exitoso; puede reaparecer como friccion operativa.
- PowerShell no estuvo disponible dentro de la sesion de herramientas, por lo que la primera verificacion se hizo con una comprobacion equivalente del entorno heredado.

## 15. Bloqueantes

No hay bloqueante de historial remoto para aplicar migraciones en Sandbox.

Bloqueantes para pruebas funcionales Wompi posteriores:

- Secretos Wompi Sandbox ausentes.
- Edge Functions Wompi no desplegadas.
- Webhook Wompi no configurado.

## 16. Operaciones remotas ejecutadas

Ejecutadas:

- `npx --yes supabase@2.109.1 link --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF`.
- `npx --yes supabase@2.109.1 migration list --linked`.
- `npx --yes supabase@2.109.1 db push --linked --dry-run`.
- `npx --yes supabase@2.109.1 secrets list --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF`.
- `npx --yes supabase@2.109.1 functions list --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF`.

No fue necesario ejecutar:

- `npx --yes supabase@2.109.1 login`.

## 17. Operaciones remotas expresamente no ejecutadas

No ejecutado:

- `supabase db push` sin `--dry-run`.
- `supabase migration up --linked`.
- `supabase migration repair`.
- `supabase db pull`.
- `supabase db reset --linked`.
- `supabase secrets set`.
- `supabase secrets unset`.
- `supabase functions deploy`.
- `supabase functions delete`.
- comandos SQL remotos de escritura.
- configuracion de webhook Wompi.
- checkout o pagos Wompi.
- `git add`.
- commit.
- push.

## 18. Estado Git final esperado

Cambios locales esperados tras esta fase:

- `docs/fase10c2-diagnostico-remoto-supabase-sandbox.md` modificado.
- Archivos de enlace local bajo `supabase/.temp` ignorados por Git.
- Sin staged.
- Sin commit.
- Sin push.

## 19. Recomendacion

Recomendacion exacta:

```text
LISTO PARA APLICAR MIGRACIONES EN SANDBOX
```
