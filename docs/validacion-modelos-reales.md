# Validacion con datos reales

Antes de afirmar que V2 supera a V1 se necesitan historicos reales suficientes, aliases revisados y comparacion sobre el mismo conjunto de partidos.

Flujo recomendado:

```powershell
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2021 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2022 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2023 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2024 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --dry-run
python scripts/listar_datasets.py
python scripts/backtest_v1_v2.py --dataset-glob "reports/api_api_football_liga-39_temporada-*_dataset.json" --season 2025 --min-training 30
```

Revisa los reportes en `reports/` antes de confirmar importaciones. Si hay pocos partidos, aliases pendientes, temporadas no disponibles por plan, o duplicados/conflictos, el backtest solo sirve como diagnostico preliminar.

V1 y V2 deben evaluar exactamente las mismas fechas, torneos y partidos finalizados. No uses partidos futuros al preparar historicos de backtest.

No hay evidencia valida para afirmar que V2 es mejor que V1 hasta completar este flujo con datos reales y metricas comparables.
## Ingesta API Externa

Para validar con datos reales importados desde proveedor externo:

```bash
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --dry-run
python scripts/importar_temporada_api.py --provider api_football --league-id 39 --season 2025 --save-local
python scripts/backtest_v1_v2.py --dataset reports/api_api_football_liga-39_temporada-2025_dataset.json
```

Usar `--save` solo cuando se quiera guardar en Supabase y existan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Para validacion local reproducible, preferir `--save-local`.

Para validacion seria, combinar historico previo y evaluar 2025-2026:

```bash
python scripts/backtest_v1_v2.py --datasets reports/api_api_football_liga-39_temporada-2021_dataset.json reports/api_api_football_liga-39_temporada-2022_dataset.json reports/api_api_football_liga-39_temporada-2023_dataset.json reports/api_api_football_liga-39_temporada-2024_dataset.json reports/api_api_football_liga-39_temporada-2025_dataset.json --season 2025 --min-training 30
```

No mezclar partidos futuros dentro del entrenamiento. El backtest compara V1 y V2 cronologicamente, ignora partidos pendientes y no declara superioridad de V2 si las metricas no lo prueban. El reporte incluye accuracy 1X2, Brier score, log-loss, MAE de goles, calibracion por bins, fechas de evaluacion y advertencias anti-leakage.

## Resultado Premier League 2024

Backtest base analizado: `reports/backtest_v1_v2_20260709T162534Z.json`.

Datos usados: Premier League 2022, 2023 y 2024 desde datasets locales API-Football, con 1140 partidos finalizados. Evaluacion: temporada 2024, 380 partidos, desde `2024-08-16T19:00:00+00:00` hasta `2025-05-25T15:00:00+00:00`.

Metricas base:

| Modelo | Brier | Log-loss | Accuracy 1X2 | Exact score | Goals MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| V1 | 0.612233 | 1.019543 | 0.510526 | 0.110526 | 0.949025 |
| V2 rho=-0.08 | 0.615427 | 1.026795 | 0.471053 | 0.123684 | 1.040328 |

Diagnostico base: V2 solo mejora exact score. Empeora Brier, log-loss, accuracy 1X2 y MAE de goles frente a V1. V2 predice demasiados locales como clase final (`294` locales y `86` visitantes, sin empates), mientras los resultados reales fueron `155` locales, `93` empates y `132` visitantes. La probabilidad media de empate de V2 fue `0.2226`, por debajo de la frecuencia real de empates (`0.2447`). El total medio de goles esperados de V2 fue `3.764`, por encima del total real `2.934`, por lo que el MAE de goles queda peor que V1.

Cambio aplicado en V2: ajuste pequeno y configurable de Dixon-Coles, cambiando `dixon_coles_rho` por defecto de `-0.08` a `-0.20`. Este cambio afecta solo la redistribucion de probabilidades en marcadores bajos; no cambia V1, rutas publicas, Supabase/RLS, backend ni importacion CSV.

Backtest posterior: `reports/backtest_v1_v2_20260709T202955Z.json`.

Metricas posteriores:

| Modelo | Brier | Log-loss | Accuracy 1X2 | Exact score | Goals MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| V1 | 0.612233 | 1.019543 | 0.510526 | 0.110526 | 0.949025 |
| V2 rho=-0.20 | 0.614925 | 1.025598 | 0.471053 | 0.136842 | 1.040328 |

Conclusion: el ajuste mejora levemente V2 contra su base en Brier, log-loss y exact score, pero no mejora accuracy 1X2 ni MAE de goles, y V2 sigue sin superar a V1. La conclusion debe permanecer neutral: no existe evidencia suficiente para concluir que V2 sea superior. La muestra de 380 partidos es util como holdout real inicial, pero sigue limitada a una liga y una temporada de evaluacion.

## Experimento 2 V2: shrink de goles esperados

Motivo: luego del Experimento 1, V2 seguia sobreestimando goles. El total medio de goles esperados de V2 era `3.763979` frente a `2.934` goles reales medios, con peor MAE de goles que V1 y sin empates predichos como clase final.

Cambio probado: se agrego `expected_goals_shrink` a `V2Config` y se evaluo `expected_goals_shrink=0.90`. El parametro se valida en el rango `0 < expected_goals_shrink <= 1` y se aplica solo en V2, despues del calculo base de `expected_home` y `expected_away` y antes de construir la matriz Poisson/Dixon-Coles. No cambia V1, backend, contratos publicos, Supabase/RLS ni importacion CSV.

Baseline usado: el reporte esperado `reports/backtest_v1_v2_20260709T202955Z.json` no estaba disponible en este monorepo. Se uso el reporte mas reciente anterior al cambio: `reports/backtest_v1_v2_20260709T203757Z.json`.

Backtest posterior: `reports/backtest_v1_v2_20260709T205457Z.json`.

Metricas antes/despues para V2:

| Metrica V2 | Antes | Despues | Cambio |
| --- | ---: | ---: | ---: |
| Brier | 0.614925 | 0.615534 | Empeora |
| Log-loss | 1.025598 | 1.026143 | Empeora |
| Accuracy 1X2 | 0.471053 | 0.471053 | Igual |
| Exact score | 0.136842 | 0.123684 | Empeora |
| Goals MAE | 1.040328 | 0.985319 | Mejora |
| xG total medio | 3.763979 | 3.387571 | Mejora |
| Empates predichos | 0 | 0 | Igual |

Distribucion de predicciones V2:

| Clase | Antes | Despues | Real |
| --- | ---: | ---: | ---: |
| Local | 294 | 294 | 155 |
| Empate | 0 | 0 | 93 |
| Visitante | 86 | 86 | 132 |

Comparacion contra V1 en el reporte posterior:

| Modelo | Brier | Log-loss | Accuracy 1X2 | Exact score | Goals MAE | xG total medio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 | 0.612233 | 1.019543 | 0.510526 | 0.110526 | 0.949025 | 3.106345 |
| V2 shrink=0.90 | 0.615534 | 1.026143 | 0.471053 | 0.123684 | 0.985319 | 3.387571 |

Conclusion neutral: el Experimento 2 mejora el problema especifico de inflacion de goles esperados y reduce el MAE de goles de V2 contra su version anterior. Sin embargo, V2 empeora Brier, log-loss y exact score frente al Experimento 1, mantiene la misma accuracy 1X2, sigue prediciendo 0 empates y no supera a V1 en Brier, log-loss, accuracy 1X2 ni goals MAE. Solo mantiene ventaja frente a V1 en exact score.

Decision posterior: `expected_goals_shrink=0.90` no se adopta como default estable porque empeora Brier, log-loss y exact score aunque mejore goals MAE y xG total medio. El parametro se conserva como experimento configurable, pero el default vuelve a `expected_goals_shrink=1.0`, que significa comportamiento neutral y preserva el comportamiento posterior al Experimento 1.

Backtest con default neutral: `reports/backtest_v1_v2_20260709T210107Z.json`. Este reporte confirma que `expected_goals_shrink=1.0` devuelve V2 al comportamiento posterior al Experimento 1: Brier `0.614925`, log-loss `1.025598`, accuracy 1X2 `0.471053`, exact score `0.136842`, goals MAE `1.040328`, xG total medio `3.763979` y distribucion de predicciones `294` locales, `0` empates, `86` visitantes.

Recomendacion: conservar el parametro solo como experimento configurable y reversible, no como evidencia de superioridad de V2. Para promocionarlo haria falta ajustar el sesgo de clase final y la probabilidad de empate sin volver a inflar goles. Si el criterio principal es Brier/log-loss, no usar `0.90` como default.

Limitaciones: la evaluacion usa una sola liga y una temporada holdout 2024 con 380 partidos evaluados. El valor `0.90` no debe tratarse como verdad futura; es un ajuste conservador motivado por diagnostico de inflacion de xG que queda disponible para pruebas futuras. No se tocaron datos persistidos ni reglas Supabase/RLS.

## Experimento 3 V2: decision configurable de empate

Motivo: V2 seguia prediciendo `0` empates como clase final en el holdout Premier League 2024, aunque los resultados reales tuvieron `93` empates. La distribucion previa de V2 era `294` locales, `0` empates y `86` visitantes.

Cambio aplicado: se agregaron `enable_draw_decision_adjustment: bool = True` y `draw_decision_margin: float = 0.03` a `V2Config`. La regla no cambia probabilidades 1X2, xG, matriz de marcador ni V1. Solo expone una decision final interna de V2: si la probabilidad de empate queda dentro de `draw_decision_margin` del maximo entre local/empate/visitante, la clase final puede ser `draw`. El margen se valida en `0 <= draw_decision_margin <= 0.25` y el ajuste se puede apagar.

Baseline usado: `reports/backtest_v1_v2_20260709T210107Z.json`.

Backtest posterior: `reports/backtest_v1_v2_20260709T215852Z.json`.

Metricas antes/despues para V2:

| Metrica V2 | Antes | Despues | Cambio |
| --- | ---: | ---: | ---: |
| Brier | 0.614925 | 0.614925 | Igual |
| Log-loss | 1.025598 | 1.025598 | Igual |
| Accuracy 1X2 | 0.471053 | 0.471053 | Igual |
| Exact score | 0.136842 | 0.136842 | Igual |
| Goals MAE | 1.040328 | 1.040328 | Igual |
| xG total medio | 3.763979 | 3.763979 | Igual |
| Empates reales acertados | 0 | 0 | Igual |
| Falsos empates introducidos | 0 | 0 | Igual |

Distribucion de predicciones V2:

| Clase | Antes | Despues | Real |
| --- | ---: | ---: | ---: |
| Local | 294 | 294 | 155 |
| Empate | 0 | 0 | 93 |
| Visitante | 86 | 86 | 132 |

Comparacion contra V1 en el reporte posterior:

| Modelo | Brier | Log-loss | Accuracy 1X2 | Exact score | Goals MAE | xG total medio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 | 0.612233 | 1.019543 | 0.510526 | 0.110526 | 0.949025 | 3.106345 |
| V2 Exp. 3 | 0.614925 | 1.025598 | 0.471053 | 0.136842 | 1.040328 | 3.763979 |

Conclusion neutral: con margen `0.03`, el Experimento 3 no logra que V2 prediga empates en este holdout. Brier, log-loss, exact score, goals MAE y xG total medio no cambian porque el ajuste no altera probabilidades ni xG. Accuracy 1X2 tampoco mejora. V2 sigue sin superar a V1 en Brier, log-loss, accuracy 1X2 ni goals MAE, aunque mantiene mejor exact score.

Analisis de margen: en este holdout, `0.03` queda por debajo de las brechas observadas entre la probabilidad maxima y la probabilidad de empate. Margenes mayores empiezan a introducir empates, pero en una simulacion sobre el reporte empeoran accuracy 1X2 al introducir mas falsos empates que empates reales acertados. Por ejemplo, `0.12` produciria `5` empates predichos con `1` empate real acertado y `4` falsos empates; `0.15` produciria `50` empates predichos con `9` aciertos y `41` falsos empates.

Recomendacion: conservar el parametro como mecanismo experimental y reversible, pero no considerar resuelto el problema de empates con `draw_decision_margin=0.03`. Antes de adoptarlo como default estable conviene probar una regla mas informada o ajustar el margen con validacion fuera de esta unica temporada. Si el objetivo inmediato es mejorar accuracy 1X2, no hay evidencia para promocionar este ajuste.

Limitaciones: la evaluacion sigue limitada a Premier League 2024 como holdout, con 380 partidos evaluados. El analisis de margenes usa el mismo reporte y no debe tratarse como optimizacion futura. No se tocaron datos persistidos, backend, contratos publicos ni Supabase/RLS.

## Experimento 4 V2: diagnostico de sesgo y sensibilidad

Objetivo: agregar diagnostico al backtest sin cambiar defaults ni comportamiento del modelo. V1, backend, contratos publicos, Supabase/RLS e importacion CSV quedan intactos.

Cambio aplicado: el JSON de backtest ahora incluye `diagnostics.v2` con distribucion de probabilidades, distribucion de argmax, distribucion de decision ajustada, sensibilidad de `draw_decision_margin`, diagnostico de sesgo de localia y diagnostico de xG. Este bloque se calcula desde las filas ya evaluadas; no reentrena modelos ni modifica probabilidades.

Reporte analizado: `reports/backtest_v1_v2_20260709T220537Z.json`.

Probabilidades medias V2:

| Probabilidad media | Valor |
| --- | ---: |
| Local | 0.447617 |
| Empate | 0.233768 |
| Visitante | 0.318614 |

Probabilidades medias por clase real:

| Clase real | p_local | p_empate | p_visitante |
| --- | ---: | ---: | ---: |
| Local | 0.487154 | 0.227580 | 0.285266 |
| Empate | 0.442297 | 0.235647 | 0.322056 |
| Visitante | 0.404940 | 0.239710 | 0.355349 |

Distribucion V2:

| Distribucion | Local | Empate | Visitante |
| --- | ---: | ---: | ---: |
| Argmax | 294 | 0 | 86 |
| Decision ajustada | 294 | 0 | 86 |
| Real | 155 | 93 | 132 |

Margenes frente al empate:

| Metrica | Valor |
| --- | ---: |
| Promedio p_local - p_empate | 0.213849 |
| Promedio p_visitante - p_empate | 0.084846 |

Partidos donde el empate estuvo cerca del maximo:

| Margen al maximo | Partidos |
| --- | ---: |
| <= 0.01 | 0 |
| <= 0.03 | 0 |
| <= 0.05 | 0 |
| <= 0.08 | 0 |
| <= 0.10 | 0 |
| <= 0.15 | 50 |

Sweep simulado de `draw_decision_margin`:

| Margen | Accuracy 1X2 | Delta | Empates predichos | Empates acertados | Falsos empates | Locales | Visitantes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.00 | 0.471053 | 0.000000 | 0 | 0 | 0 | 294 | 86 |
| 0.03 | 0.471053 | 0.000000 | 0 | 0 | 0 | 294 | 86 |
| 0.05 | 0.471053 | 0.000000 | 0 | 0 | 0 | 294 | 86 |
| 0.08 | 0.471053 | 0.000000 | 0 | 0 | 0 | 294 | 86 |
| 0.10 | 0.471053 | 0.000000 | 0 | 0 | 0 | 294 | 86 |
| 0.12 | 0.468421 | -0.002632 | 5 | 1 | 4 | 291 | 84 |
| 0.15 | 0.455263 | -0.015789 | 50 | 9 | 41 | 260 | 70 |

Diagnostico de sesgo de localia:

| Metrica | Valor |
| --- | ---: |
| Victorias locales reales | 155 |
| Predicciones local | 294 |
| Precision al predecir local | 0.455782 |
| Recall de victorias locales | 0.864516 |
| Falsos locales | 160 |
| p_local domina por > 0.05 | 261 |
| p_local domina por > 0.10 | 225 |
| p_local domina por > 0.15 | 192 |
| p_local domina por > 0.20 | 146 |

Diagnostico de xG:

| Metrica | Valor |
| --- | ---: |
| xG local medio | 2.071161 |
| xG visitante medio | 1.692818 |
| xG total medio | 3.763979 |
| Goles reales local medio | 1.513158 |
| Goles reales visitante medio | 1.421053 |
| Goles reales total medio | 2.934211 |
| Error medio xG local | 0.558003 |
| Error medio xG visitante | 0.271766 |
| Error medio xG total | 0.829768 |

Conclusion neutral: el problema de empates no parece resolverse con un margen pequeno de decision, porque la probabilidad de empate queda sistematicamente lejos del maximo. El sesgo de localia es fuerte: V2 recupera muchas victorias locales reales, pero produce demasiados falsos locales. Ademas, V2 sigue sobreestimando goles, especialmente del local.

Recomendacion para Experimento 5: no ajustar solo `draw_decision_margin`. Probar primero una reduccion configurable del sesgo de localia o del factor de ventaja local/form/elo en V2, y medir si baja p_local y xG local sin degradar Brier/log-loss. Otra opcion es una calibracion especifica de probabilidades 1X2 basada en bins, pero debe validarse fuera de esta unica temporada antes de adoptarse.

Limitaciones: este diagnostico usa Premier League 2024 como holdout con 380 partidos. El sweep es simulacion sobre predicciones ya generadas, no entrenamiento ni busqueda validada de hiperparametros. No declara superioridad de V2.

## Experimento 5 V2: diagnostico de ajuste local/xG

Hipotesis: el sesgo de V2 hacia local y la inflacion de xG local pueden reducirse con multiplicadores configurables sobre el componente local, sin cambiar el comportamiento por defecto del modelo.

Cambio aplicado: se agregaron parametros experimentales a `V2Config`: `enable_home_bias_adjustment: bool = False`, `home_bias_multiplier: float = 1.0`, `home_xg_multiplier: float = 1.0` y `away_xg_multiplier: float = 1.0`. Los rangos permitidos para los multiplicadores son `0.70` a `1.30`. Con `enable_home_bias_adjustment=False`, los multiplicadores no se aplican y el comportamiento por defecto queda igual que antes. El JSON de backtest incorpora `diagnostics.v2.experiment_5` con un sweep diagnostico; no cambia las filas base ni las metricas default.

Reporte analizado: `reports/backtest_v1_v2_20260709T221259Z.json`.

Baseline V2 default contra Experimento 4: Brier `0.614925`, log-loss `1.025598`, accuracy 1X2 `0.471053`, xG local medio `2.071161`, xG total medio `3.763979`, predicciones `294` locales, `0` empates y `86` visitantes.

Sweep Experimento 5:

| Configuracion | Accuracy | Delta acc. | Brier | Delta Brier | Log-loss | Delta log-loss | Local | Empate | Visitante | Precision local | Recall local | Falsos locales | xG local | xG total | Error xG total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home_xg_multiplier=1.00 | 0.471053 | 0.000000 | 0.614925 | 0.000000 | 1.025598 | 0.000000 | 294 | 0 | 86 | 0.455782 | 0.864516 | 160 | 2.071161 | 3.763979 | 0.829768 |
| home_xg_multiplier=0.95 | 0.494737 | 0.023684 | 0.613285 | -0.001640 | 1.023432 | -0.002166 | 266 | 0 | 114 | 0.477444 | 0.819355 | 139 | 1.967629 | 3.660447 | 0.726237 |
| home_xg_multiplier=0.90 | 0.500000 | 0.028947 | 0.613012 | -0.001913 | 1.023032 | -0.002566 | 247 | 0 | 133 | 0.497976 | 0.793548 | 124 | 1.864068 | 3.556887 | 0.622676 |
| home_xg_multiplier=0.85 | 0.526316 | 0.055263 | 0.614225 | -0.000700 | 1.024570 | -0.001028 | 222 | 0 | 158 | 0.531532 | 0.761290 | 104 | 1.760482 | 3.453300 | 0.519089 |
| home_bias_multiplier=1.00 | 0.471053 | 0.000000 | 0.614925 | 0.000000 | 1.025598 | 0.000000 | 294 | 0 | 86 | 0.455782 | 0.864516 | 160 | 2.071161 | 3.763979 | 0.829768 |
| home_bias_multiplier=0.95 | 0.494737 | 0.023684 | 0.613285 | -0.001640 | 1.023432 | -0.002166 | 266 | 0 | 114 | 0.477444 | 0.819355 | 139 | 1.967629 | 3.660447 | 0.726237 |
| home_bias_multiplier=0.90 | 0.500000 | 0.028947 | 0.613012 | -0.001913 | 1.023032 | -0.002566 | 247 | 0 | 133 | 0.497976 | 0.793548 | 124 | 1.864068 | 3.556887 | 0.622676 |
| home_bias_multiplier=0.85 | 0.526316 | 0.055263 | 0.614225 | -0.000700 | 1.024570 | -0.001028 | 222 | 0 | 158 | 0.531532 | 0.761290 | 104 | 1.760482 | 3.453300 | 0.519089 |

Interpretacion: en la estructura actual de V2, `home_bias_multiplier` y `home_xg_multiplier` producen el mismo efecto en este sweep porque ambos reducen directamente el componente que alimenta `expected_home`. Reducirlo baja falsos locales y xG local, y mejora accuracy 1X2 frente al baseline V2. Sin embargo, aunque `0.85` supera la accuracy de V1 en este holdout, V2 sigue sin superar a V1 en Brier ni log-loss (`V1`: Brier `0.612233`, log-loss `1.019543`). Tampoco resuelve los empates: todas las configuraciones siguen prediciendo `0` empates.

Que NO se concluye: no hay evidencia suficiente para declarar V2 superior. No debe elegirse una configuracion solo por accuracy si Brier/log-loss no acompanan o si la mejora no se valida fuera de esta temporada.

Recomendacion neutral: para Experimento 6, probar de forma controlada `enable_home_bias_adjustment=True` con `home_xg_multiplier=0.90` o `0.85` como candidatos, priorizando Brier/log-loss y calibracion ademas de accuracy. Si se busca menor riesgo, empezar con `0.90` porque mejora Brier/log-loss mas que `0.85`; si se prioriza accuracy, `0.85` es mejor en este holdout pero menos convincente en Brier/log-loss. Mantener defaults neutrales hasta validar en mas temporadas o ligas.

Limitaciones: el sweep usa una unica liga y temporada holdout. Las configuraciones evaluadas son diagnosticas y no cambian el modelo por defecto. No se tocaron V1, backend, contratos publicos, Supabase/RLS ni importacion CSV.

## Experimento 6 V2: calibracion opcional de empate en matriz

Primera revision obligatoria: `home_xg_multiplier` y `home_bias_multiplier` dieron resultados iguales en el Experimento 5 porque, en el rango probado, ambos escalan el mismo componente efectivo de `expected_home`. `home_bias_multiplier` multiplica `home_elo_factor` antes de calcular xG local y `home_xg_multiplier` multiplica el xG local despues; como no se activaron clamps relevantes en esas configuraciones, ambos caminos terminaron multiplicando `expected_home` por el mismo factor. Es una equivalencia por diseno actual en ese rango, no evidencia de que ambos parametros sean siempre identicos si se llega a limites de clamp.

Hipotesis: luego de corregir parcialmente el sesgo local con `home_xg_multiplier=0.90`, un aumento controlado de la diagonal de la matriz de marcador podria elevar la probabilidad de empate sin forzar decisiones por margen.

Cambio aplicado: se agregaron `enable_draw_probability_adjustment: bool = False` y `draw_probability_multiplier: float = 1.0` a `V2Config`. El rango permitido del multiplicador es `0.70` a `1.50`. Se eligio la opcion A: si el flag esta activo, se multiplican las probabilidades de marcadores empatados en la matriz Poisson/Dixon-Coles y luego se renormaliza la matriz. Con defaults, el comportamiento no cambia.

Reporte analizado: `reports/backtest_v1_v2_20260709T221905Z.json`.

Comparadores:

| Configuracion | Accuracy | Brier | Log-loss | Local | Empate | Visitante | xG total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 baseline | 0.510526 | 0.612233 | 1.019543 | 255 | 0 | 125 | 3.106345 |
| V2 baseline | 0.471053 | 0.614925 | 1.025598 | 294 | 0 | 86 | 3.763979 |
| Exp. 5 home_xg=0.90 | 0.500000 | 0.613012 | 1.023032 | 247 | 0 | 133 | 3.556887 |

Sweep Experimento 6, usando `enable_home_bias_adjustment=True`, `home_xg_multiplier=0.90`, `home_bias_multiplier=1.0`, `away_xg_multiplier=1.0`:

| Draw multiplier | Accuracy | Brier | Log-loss | Local | Empate | Visitante | Empates acertados | Falsos empates | Precision empate | Recall empate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1.00 | 0.500000 | 0.613012 | 1.023032 | 247 | 0 | 133 | 0 | 0 | n/a | 0.000000 |
| 1.05 | 0.500000 | 0.613342 | 1.023236 | 247 | 0 | 133 | 0 | 0 | n/a | 0.000000 |
| 1.10 | 0.500000 | 0.613865 | 1.023775 | 247 | 0 | 133 | 0 | 0 | n/a | 0.000000 |
| 1.15 | 0.500000 | 0.614568 | 1.024611 | 247 | 0 | 133 | 0 | 0 | n/a | 0.000000 |
| 1.20 | 0.500000 | 0.615437 | 1.025715 | 247 | 0 | 133 | 0 | 0 | n/a | 0.000000 |
| 1.30 | 0.497368 | 0.617631 | 1.028617 | 241 | 8 | 131 | 3 | 5 | 0.375000 | 0.032258 |

Diagnostico xG del sweep: el ajuste de empate no toca xG. Todas las configuraciones del Experimento 6 mantuvieron xG local medio `1.864068`, xG visitante medio `1.692818`, xG total medio `3.556887`, error medio xG local `0.350911`, error medio xG visitante `0.271766` y error medio xG total `0.622676`.

Interpretacion: el boost diagonal suave aumenta probabilidades de empate, pero no alcanza para cambiar la clase final hasta `1.30`. En `1.30` aparecen `8` empates predichos, con `3` aciertos y `5` falsos empates, pero empeoran Brier y log-loss frente a Exp. 5 `home_xg=0.90` y tambien frente al baseline V2. No hay evidencia para adoptar este ajuste como default.

Que NO se concluye: V2 no supera a V1. Tampoco se concluye que la solucion sea forzar empates; el problema sigue pareciendo de calibracion conjunta de probabilidades y xG, no solo de decision final.

Recomendacion neutral: no promocionar `draw_probability_multiplier` por ahora. Si se continua, priorizar Exp. 5 `home_xg_multiplier=0.90` como candidato conservador y explorar calibracion 1X2 mas estructurada, idealmente validada en mas temporadas/ligas. Mantener defaults neutrales.

Limitaciones: el sweep usa solo Premier League 2024. El multiplicador de empate se evaluo como diagnostico, no como optimizacion validada. No se tocaron V1, backend, contratos publicos, Supabase/RLS ni importacion CSV.

## Experimento 7 V2: validacion multi-temporada

Motivacion: evitar seguir ajustando V2 contra un unico holdout 2024. El objetivo fue comparar V1 baseline, V2 baseline y candidatos conservadores de Experimento 5 en las temporadas locales disponibles, sin cambiar defaults.

Cambio aplicado: el reporte comparativo incluye `diagnostics.experiment_7` con resultados agregados, por temporada, por liga y por dataset logico liga-temporada. Los candidatos se calculan desde las filas ya evaluadas de V1/V2 y del sweep de Experimento 5; no cambian el comportamiento normal del modelo.

Datasets evaluados: Premier League 2022, 2023 y 2024, con `1140` partidos finalizados locales. Backtest cronologico sin `--season`, `min_training=30`, con `1110` partidos evaluados. Reporte analizado: `reports/backtest_v1_v2_20260709T222700Z.json`.

Candidatos:

| Candidato | Configuracion |
| --- | --- |
| V1 baseline | Modelo V1 sin cambios |
| V2 baseline | Defaults actuales de V2 |
| V2 home_xg=0.95 | `enable_home_bias_adjustment=True`, `home_xg_multiplier=0.95` |
| V2 home_xg=0.90 | `enable_home_bias_adjustment=True`, `home_xg_multiplier=0.90` |
| V2 home_xg=0.85 | `enable_home_bias_adjustment=True`, `home_xg_multiplier=0.85` |

Resultados agregados:

| Candidato | Accuracy | Brier | Log-loss | Local | Empate | Visitante | Falsos locales | xG total | Error xG total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 baseline | 0.519820 | 0.594105 | 0.995172 | 815 | 0 | 295 | 388 | 3.000214 | -0.024111 |
| V2 baseline | 0.513514 | 0.602736 | 1.008483 | 930 | 0 | 180 | 466 | 3.538014 | 0.513690 |
| V2 home_xg=0.95 | 0.521622 | 0.601952 | 1.007487 | 883 | 0 | 227 | 432 | 3.436594 | 0.412269 |
| V2 home_xg=0.90 | 0.527928 | 0.602531 | 1.008291 | 834 | 0 | 276 | 394 | 3.335135 | 0.310811 |
| V2 home_xg=0.85 | 0.536036 | 0.604603 | 1.011079 | 776 | 1 | 333 | 355 | 3.233675 | 0.209350 |

Resultados por temporada:

| Temporada | Candidato | Accuracy | Brier | Log-loss | Distribucion | xG total |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| 2022 | V1 baseline | 0.520000 | 0.593085 | 0.993672 | 285-0-65 | 2.873297 |
| 2022 | V2 baseline | 0.514286 | 0.603470 | 1.009235 | 318-0-32 | 3.238611 |
| 2022 | V2 home_xg=0.95 | 0.517143 | 0.603068 | 1.008649 | 312-0-38 | 3.141011 |
| 2022 | V2 home_xg=0.90 | 0.525714 | 0.604005 | 1.009878 | 302-0-48 | 3.043374 |
| 2022 | V2 home_xg=0.85 | 0.537143 | 0.606417 | 1.013115 | 289-1-60 | 2.945740 |
| 2023 | V1 baseline | 0.528947 | 0.576916 | 0.972183 | 275-0-105 | 3.010979 |
| 2023 | V2 baseline | 0.555263 | 0.589871 | 0.990675 | 318-0-62 | 3.587816 |
| 2023 | V2 home_xg=0.95 | 0.552632 | 0.589590 | 0.990471 | 305-0-75 | 3.484987 |
| 2023 | V2 home_xg=0.90 | 0.557895 | 0.590693 | 0.992088 | 285-0-95 | 3.382111 |
| 2023 | V2 home_xg=0.85 | 0.544737 | 0.593310 | 0.995714 | 265-0-115 | 3.279253 |
| 2024 | V1 baseline | 0.510526 | 0.612233 | 1.019543 | 255-0-125 | 3.106345 |
| 2024 | V2 baseline | 0.471053 | 0.614925 | 1.025598 | 294-0-86 | 3.763979 |
| 2024 | V2 home_xg=0.95 | 0.494737 | 0.613285 | 1.023432 | 266-0-114 | 3.660447 |
| 2024 | V2 home_xg=0.90 | 0.500000 | 0.613012 | 1.023032 | 247-0-133 | 3.556887 |
| 2024 | V2 home_xg=0.85 | 0.526316 | 0.614225 | 1.024570 | 222-0-158 | 3.453300 |

Interpretacion de estabilidad: `home_xg=0.90` mejora accuracy agregada frente a V2 baseline y reduce sesgo local, falsos locales y xG total. Sin embargo, Brier/log-loss agregados siguen peores que V1 y no hay estabilidad clara por temporada: en 2022 y 2023 Brier/log-loss empeoran frente a V1, y en 2024 mejoran frente a V2 baseline pero siguen sin superar a V1. `home_xg=0.85` logra la mejor accuracy agregada, pero empeora Brier/log-loss frente a `0.90`, por lo que no conviene elegirlo solo por accuracy.

Conclusion neutral: el candidato `home_xg=0.90` se sostiene parcialmente como ajuste conservador para bajar sesgo local y xG, pero no hay evidencia suficiente para cambiar defaults ni declarar superioridad de V2. La mejora depende de la metrica y de la temporada.

Recomendacion: no cambiar defaults todavia. Si se continua, validar `home_xg=0.90` en mas ligas o temporadas y priorizar Brier/log-loss/calibracion sobre accuracy. Tambien conviene investigar por que ambos modelos siguen prediciendo casi ningun empate como clase final.

Limitaciones: los datasets disponibles siguen siendo una sola liga. La validacion es multi-temporada, no multi-liga. El backtest es cronologico y usa partidos anteriores como entrenamiento, pero no reemplaza una validacion externa mas amplia.

## Experimento 8 V2: diagnostico de calibracion probabilistica

Hipotesis: V2 puede mejorar accuracy al cambiar decisiones, pero seguir peor calibrado probabilisticamente. Brier y log-loss penalizan la calidad de las probabilidades completas, no solo si la clase final acierta. Por eso una configuracion con mejor accuracy no debe promocionarse si empeora calibracion o no mejora Brier/log-loss de forma estable.

Cambio aplicado: el reporte comparativo incluye `diagnostics.experiment_8` con diagnostico de calibracion para V1 baseline, V2 baseline y candidatos V2 `home_xg=0.95`, `home_xg=0.90`, `home_xg=0.85`. No se agrego ningun ajuste nuevo ni se cambiaron defaults.

Metodo: se usan 10 bins de confianza (`0.00-0.10` ... `0.90-1.00`) sobre la probabilidad ganadora para calcular una ECE aproximada. Tambien se calcula calibracion por clase usando bins de `p_home`, `p_draw` y `p_away`, comparando probabilidad media contra frecuencia real de esa clase.

Reporte analizado: `reports/backtest_v1_v2_20260709T223652Z.json`, con Premier League 2022-2024 y `1110` partidos evaluados.

Resumen agregado de calibracion:

| Candidato | Accuracy | Brier | Log-loss | ECE | Confianza media | p_home media | p_draw media | p_away media | ECE home | ECE draw | ECE away |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 baseline | 0.519820 | 0.594105 | 0.995172 | 0.036297 | 0.554752 | 0.487216 | 0.220412 | 0.292372 | 0.044799 | 0.023322 | 0.035493 |
| V2 baseline | 0.513514 | 0.602736 | 1.008483 | 0.022865 | 0.490649 | 0.471919 | 0.240709 | 0.287372 | 0.045016 | 0.013886 | 0.041799 |
| V2 home_xg=0.95 | 0.521622 | 0.601952 | 1.007487 | 0.045364 | 0.476258 | 0.451892 | 0.247394 | 0.300714 | 0.054215 | 0.019466 | 0.057387 |
| V2 home_xg=0.90 | 0.527928 | 0.602531 | 1.008291 | 0.065157 | 0.462771 | 0.431298 | 0.254036 | 0.314666 | 0.060146 | 0.026109 | 0.053630 |
| V2 home_xg=0.85 | 0.536036 | 0.604603 | 1.011079 | 0.085377 | 0.450659 | 0.410157 | 0.260598 | 0.329245 | 0.066555 | 0.032670 | 0.052146 |

Bins principales de confianza:

| Candidato | Bin | Partidos | Confianza media | Accuracy | Error |
| --- | --- | ---: | ---: | ---: | ---: |
| V1 baseline | 0.40-0.50 | 334 | 0.448333 | 0.428144 | 0.020189 |
| V1 baseline | 0.50-0.60 | 300 | 0.547888 | 0.536667 | 0.011221 |
| V1 baseline | 0.60-0.70 | 210 | 0.649356 | 0.566667 | 0.082689 |
| V2 baseline | 0.40-0.50 | 518 | 0.451023 | 0.465251 | 0.014228 |
| V2 baseline | 0.50-0.60 | 346 | 0.545089 | 0.560694 | 0.015605 |
| V2 baseline | 0.60-0.70 | 100 | 0.641864 | 0.730000 | 0.088136 |
| V2 home_xg=0.90 | 0.40-0.50 | 588 | 0.445029 | 0.513605 | 0.068576 |
| V2 home_xg=0.90 | 0.50-0.60 | 257 | 0.537936 | 0.595331 | 0.057395 |
| V2 home_xg=0.90 | 0.60-0.70 | 48 | 0.629013 | 0.833333 | 0.204320 |

Calibracion del empate: V2 baseline tiene `p_draw` media `0.240709`, cercana a la frecuencia real agregada de empates, pero no predice empates como argmax. En `home_xg=0.90`, `p_draw` media sube a `0.254036` y la ECE de empate empeora de `0.013886` a `0.026109`. En bins de `p_draw`, el bin `0.20-0.30` concentra la mayoria de partidos: V2 baseline tiene probabilidad media `0.244333` y frecuencia real `0.236043`; `home_xg=0.90` tiene probabilidad media `0.253123` y frecuencia real `0.231954`. Esto sugiere que el empate no esta claramente subestimado como probabilidad agregada; el problema principal es que rara vez queda como probabilidad maxima.

Interpretacion neutral: `home_xg=0.90` mejora accuracy y reduce sesgo local, pero empeora ECE frente a V2 baseline y sigue peor que V1 en Brier/log-loss. `home_xg=0.85` maximiza accuracy, pero empeora aun mas Brier/log-loss y ECE. V2 baseline tiene mejor ECE global que V1 en este diagnostico, pero sus Brier/log-loss son peores, lo que indica que ECE por si sola no alcanza para elegir modelo.

Conclusion: no hay evidencia para cambiar defaults ni promocionar un candidato. El siguiente paso deberia separar calibracion probabilistica de seleccion de clase final: revisar calibracion 1X2 con validacion externa y no optimizar solo accuracy.

Limitaciones: ECE es aproximada y depende de bins. La validacion sigue limitada a Premier League 2022-2024. No se declara superioridad de V2.
