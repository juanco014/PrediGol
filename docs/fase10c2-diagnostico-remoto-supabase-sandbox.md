# Fase 10C.2 - Diagnostico remoto Supabase Sandbox

## 1. Fecha y alcance

- Fecha: 2026-07-16.
- Alcance: intentar iniciar el diagnostico remoto seguro de Supabase Sandbox para PrediGol.
- Resultado: bloqueado antes de `supabase link` porque no existe evidencia explicita del project-ref Sandbox.

Esta fase no aplico migraciones remotas, no configuro secretos, no desplego Edge Functions y no llamo a Wompi.

## 2. Estado Git inicial

- Rama: `main`.
- Estado remoto: `Your branch is up to date with 'origin/main'`.
- Worktree inicial: limpio.
- Staged inicial: sin cambios.
- `git diff --check`: sin errores.
- Preflight versionado: confirmado en commit `b756513 docs(wompi): add sandbox deployment preflight`.

Commits recientes:

| Commit | Mensaje |
| --- | --- |
| `b756513` | `docs(wompi): add sandbox deployment preflight` |
| `2b29016` | `chore(supabase): remove rollback scripts from migrations` |
| `9bdc346` | `feat(payments): add local Wompi sandbox integration` |
| `9294b5c` | `fix(supabase): restore base schema and runtime grants` |
| `58e397b` | `fix(profiles): allow safe personal profile updates` |
| `572a26f` | `docs(payments): approve Wompi premium MVP model` |

## 3. Version Supabase CLI

Comando ejecutado:

```powershell
npx --yes supabase@2.109.1 --version
```

Resultado:

```text
2.109.1
```

## 4. Ayuda CLI revisada

Comandos de ayuda consultados:

- `npx --yes supabase@2.109.1 link --help`.
- `npx --yes supabase@2.109.1 migration list --help`.
- `npx --yes supabase@2.109.1 db push --help`.
- `npx --yes supabase@2.109.1 secrets list --help`.
- `npx --yes supabase@2.109.1 functions list --help`.

Opciones relevantes confirmadas:

- `link`: `--project-ref`, `--password`, `--skip-pooler`.
- `db push`: `--linked`, `--dry-run`, `--include-all`, `--include-roles`, `--include-seed`, `--password`.
- `secrets list`: `--project-ref`.
- `functions list`: `--project-ref`.

Observacion de entorno:

- `migration list --help` fallo por `EPERM` al intentar renombrar `C:\Users\manja\.supabase\telemetry.json.tmp...` a `telemetry.json`.
- El fallo ocurrio antes de cualquier operacion remota y no modifico el repositorio.
- Clasificacion: riesgo operativo local de telemetry/archivo bloqueado, no evidencia de problema remoto.

## 5. Confirmacion del proyecto Sandbox

Resultado de validacion de variable de entorno:

```text
SUPABASE_SANDBOX_PROJECT_REF: no existe
```

No hay project-ref enmascarado porque no se recibio ni se encontro un valor seguro para validar.

No se pudo confirmar:

- Que exista un proyecto separado para Sandbox.
- Que el project-ref pertenezca a Sandbox, Testing, Staging o equivalente.
- Que no coincida con produccion.
- Que el nombre visible en Dashboard corresponda a Sandbox.

Estado:

```text
BLOQUEADO — PROYECTO SANDBOX NO CONFIRMADO
```

## 6. Estado del enlace previo

Comprobacion local:

```powershell
Test-Path "supabase\.temp\project-ref"
```

Resultado equivalente en Bash:

```text
False
```

No existe enlace previo local en `supabase/.temp/project-ref`.

## 7. Resultado de autenticacion

No se intento autenticacion Supabase CLI porque la fase se detuvo antes de cualquier operacion remota al no estar confirmado el proyecto Sandbox.

Accion manual requerida si se reintenta:

```powershell
npx --yes supabase@2.109.1 login
```

Restricciones para el reintento:

- No mostrar access token.
- No guardar token en el repositorio.
- No copiar token al runbook.
- No usar tokens compartidos en texto.

## 8. Resultado del enlace

No ejecutado.

Comando futuro permitido solo despues de confirmar Sandbox:

```powershell
npx --yes supabase@2.109.1 link `
  --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF
```

No se paso password por argumento visible.

## 9. Inventario local de migraciones

No fue necesario repetir el inventario completo para comparar remoto porque no se alcanzo el enlace.

Inventario local confirmado en Fase 10C.1 y Git actual:

- Migracion base: `202606230001_predigol_base_schema.sql`.
- Migracion Wompi: `202607150001_wompi_premium_payments.sql`.
- Hardening posterior: `202607160001_harden_runtime_grants.sql`.
- Correccion profiles posterior: `202607160002_profiles_personal_update.sql`.
- Sin `_down.sql` en `supabase/migrations`.
- Rollbacks destructivos ubicados en `supabase/rollbacks`.
- Sin timestamps duplicados detectados en la fase anterior.

## 10. Comparacion local/remota

No ejecutada.

Motivo:

- No se ejecuto `supabase link`.
- No existe project-ref Sandbox confirmado.

Comando no ejecutado:

```powershell
npx --yes supabase@2.109.1 migration list --linked
```

Tabla de clasificacion:

| Timestamp | Migracion local | Estado local | Estado remoto | Clasificacion |
| --- | --- | --- | --- | --- |
| No determinado | No determinado | No determinado | No determinado | `NO DETERMINADO` |

## 11. Resultado del dry-run

No ejecutado.

Motivo:

- La regla critica impide `db push --linked --dry-run` sin confirmar primero que el enlace apunta a Sandbox.

Comando no ejecutado:

```powershell
npx --yes supabase@2.109.1 db push --linked --dry-run
```

No se puede establecer aun:

- Migraciones propuestas.
- Orden exacto.
- Si solicita password.
- Si detecta divergencias.
- Si incluiria seed o roles.
- Si la base aparece pendiente.
- Si Wompi aparece pendiente.
- Si hardening/profiles aparecen pendientes.

## 12. Migraciones propuestas

No determinado.

No se ejecuto dry-run remoto.

## 13. Secretos requeridos y estado

No se ejecuto `secrets list` porque no hay project-ref Sandbox confirmado.

Comando no ejecutado:

```powershell
npx --yes supabase@2.109.1 secrets list `
  --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF
```

| Variable | Estado |
| --- | --- |
| `SUPABASE_URL` | `NO VERIFICADA` |
| `SUPABASE_SECRET_KEYS` | `NO VERIFICADA` |
| `SUPABASE_SERVICE_ROLE_KEY` | `NO VERIFICADA` |
| `WOMPI_PUBLIC_KEY_SANDBOX` | `NO VERIFICADA` |
| `WOMPI_INTEGRITY_SECRET_SANDBOX` | `NO VERIFICADA` |
| `WOMPI_CHECKOUT_BASE_URL_SANDBOX` | `NO VERIFICADA` |
| `WOMPI_REDIRECT_URL_SANDBOX` | `NO VERIFICADA` |
| `WOMPI_EVENTS_SECRET_SANDBOX` | `NO VERIFICADA` |

No se ejecuto `secrets set`.

## 14. Edge Functions remotas

No se ejecuto `functions list` porque no hay project-ref Sandbox confirmado.

Comando no ejecutado:

```powershell
npx --yes supabase@2.109.1 functions list `
  --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF
```

| Edge Function | Estado |
| --- | --- |
| `wompi-create-checkout` | `ESTADO DESCONOCIDO` |
| `wompi-payment-status` | `ESTADO DESCONOCIDO` |
| `wompi-webhook` | `ESTADO DESCONOCIDO` |

No se desplego ni elimino ninguna funcion.

## 15. Riesgos encontrados

- Falta `SUPABASE_SANDBOX_PROJECT_REF` en el entorno de ejecucion.
- No hay evidencia de Dashboard o nombre visible que confirme que el proyecto destino sea Sandbox.
- La ayuda de `migration list` fallo por `EPERM` en archivo local de telemetry de Supabase CLI; puede repetirse en comandos CLI futuros si el archivo sigue bloqueado.

## 16. Bloqueantes

Bloqueante principal:

```text
BLOQUEADO — PROYECTO SANDBOX NO CONFIRMADO
```

No se puede continuar a enlace, migration list, dry-run, secrets list ni functions list hasta que el operador confirme de forma segura el project-ref Sandbox.

## 17. Operaciones remotas ejecutadas

Ninguna.

No se ejecuto:

- `supabase login`.
- `supabase link`.
- `supabase migration list --linked`.
- `supabase db push --linked --dry-run`.
- `supabase secrets list`.
- `supabase functions list`.

## 18. Operaciones remotas expresamente no ejecutadas

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
- comandos SQL de escritura remota.
- cambios mediante Dashboard.
- configuracion webhook Wompi.
- checkout o pagos.
- llamadas reales a Wompi.
- uso de llaves de produccion.
- commit.
- push.

## 19. Plan exacto propuesto para Fase 10C.3

Precondicion obligatoria:

- El operador debe confirmar un proyecto Supabase separado para Sandbox y exponer temporalmente solo en la sesion local:

```powershell
$env:SUPABASE_SANDBOX_PROJECT_REF = "<PROJECT_REF_SANDBOX>"
```

Reintento recomendado:

1. Confirmar en Dashboard que el nombre visible del proyecto contiene Sandbox, Testing, Staging o equivalente.
2. Ejecutar `git status` y confirmar worktree limpio o solo documentos esperados.
3. Ejecutar `npx --yes supabase@2.109.1 --version`.
4. Validar que `SUPABASE_SANDBOX_PROJECT_REF` existe, no esta vacio, tiene formato plausible y no coincide con produccion.
5. Confirmar `Test-Path "supabase\.temp\project-ref"`.
6. Si no hay enlace previo, ejecutar `npx --yes supabase@2.109.1 login` si la CLI lo requiere.
7. Ejecutar `npx --yes supabase@2.109.1 link --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF`.
8. Ejecutar `npx --yes supabase@2.109.1 migration list --linked`.
9. Si el historial es coherente, ejecutar `npx --yes supabase@2.109.1 db push --linked --dry-run`.
10. Ejecutar `npx --yes supabase@2.109.1 secrets list --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF`.
11. Ejecutar `npx --yes supabase@2.109.1 functions list --project-ref $env:SUPABASE_SANDBOX_PROJECT_REF`.
12. Documentar resultados sin secretos ni project-ref completo.

## 20. Estado Git final

Estado al crear este documento:

- Archivo nuevo esperado: `docs/fase10c2-diagnostico-remoto-supabase-sandbox.md`.
- No usar `git add`.
- No commit.
- No push.
- `supabase/.temp` no existe y, si se crea en fases futuras, debe permanecer ignorado.

## 21. Recomendacion

Recomendacion exacta:

```text
BLOQUEADO — PROYECTO SANDBOX NO CONFIRMADO
```
