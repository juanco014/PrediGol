# Normalizacion de equipos

La normalizacion vive en `prediction-service/predigol_model/team_normalization.py`.

## Reglas base

- Convierte a minusculas.
- Elimina tildes.
- Normaliza espacios.
- Remueve puntos, guiones y caracteres especiales.
- Expande abreviaturas comunes.
- Ignora particulas frecuentes como `FC`, `CF`, `S.A.` cuando aplica.

## Alias

La tabla `team_aliases` permite mapear alias a nombres canonicos con torneo o pais opcional. Los alias pueden estar `approved`, `pending_review` o `rejected`.

Los casos ambiguos no se unifican silenciosamente. El normalizador devuelve estado `ambiguous` o `pending_review` para que administracion lo revise.

## Pantalla admin

En `/admin/modelo` se pueden ver alias pendientes, aprobarlos, rechazarlos o crear alias manuales.
