# Producto Premium PrediGol

Estado: `MODELO PREMIUM APROBADO — SANDBOX WOMPI PENDIENTE`.

Fecha: 2026-07-15.

Este documento cierra la definicion comercial y funcional del MVP Premium antes de implementar sandbox con Wompi. No implementa checkout, migraciones, Edge Functions, SDKs, variables de entorno, cobros ni activacion premium mediante pagos.

## Objetivo Del Producto Premium

PrediGol Premium ofrece una experiencia ampliada de analisis estadistico de partidos, con acceso completo a pronosticos, probabilidades, marcadores probables, filtros avanzados, selecciones destacadas e historial verificable del rendimiento del modelo.

El producto no garantiza resultados deportivos ni ganancias. Su objetivo es apoyar la evaluacion informada del usuario mediante modelos estadisticos.

## Usuario Objetivo

Usuario que ya entiende la propuesta gratuita de PrediGol y quiere consultar informacion mas completa para analizar partidos disponibles antes de tomar decisiones propias.

## Diferencias Gratuito/Premium

| Area | Usuario gratuito | Usuario Premium |
| --- | --- | --- |
| Partidos disponibles | Acceso a partidos disponibles. | Acceso a partidos disponibles. |
| Pronosticos | Algunos pronosticos gratuitos seleccionados. | Todos los pronosticos disponibles. |
| Resultado principal | Visible en contenido gratuito. | Visible para todos los pronosticos disponibles. |
| Probabilidades 1X2 | Limitadas o bloqueadas segun contenido. | Local, empate y visitante completas. |
| Marcador probable | Limitado o bloqueado. | Marcador mas probable. |
| Goles esperados | Limitado o bloqueado. | Goles esperados local y visitante. |
| Historial | Acceso limitado. | Historial verificable ampliado. |
| Filtros | Basicos. | Avanzados por liga, fecha, confianza, resultado previsto, goles, ambos equipos marcan y selecciones destacadas. |
| Contenido bloqueado | Ve bloqueo y beneficios. | Accede al contenido premium. |

La version gratuita no debe bloquear absolutamente todo. Debe permitir evaluar el funcionamiento de PrediGol antes de comprar.

## Beneficios Aprobados

El usuario Premium tendra:

1. Acceso a todos los pronosticos disponibles.
2. Probabilidades completas 1X2: local, empate y visitante.
3. Marcador mas probable.
4. Goles esperados del local y visitante.
5. Otros marcadores probables, cuando existan datos suficientes.
6. Probabilidad de mas/menos de 2.5 goles.
7. Probabilidad de ambos equipos marcan.
8. Nivel de confianza del modelo.
9. Selecciones destacadas del dia.
10. Explicacion sencilla de los factores principales del pronostico.
11. Historial verificable del rendimiento del modelo.
12. Filtros avanzados por liga, fecha, confianza, resultado previsto, goles, ambos equipos marcan y selecciones destacadas.

## Funciones Excluidas Del MVP

No se ofrecen todavia:

- Pronosticos en vivo.
- Corners.
- Tarjetas.
- Goleadores.
- Montos recomendados para apostar.
- Gestion de banca.
- Rentabilidad o value bets sin cuotas reales.
- Chat de apuestas.
- Renovacion automatica.
- Varios niveles Premium.
- Plan anual.
- Prueba gratuita automatica.
- Cuotas en tiempo real.
- Comparacion entre casas de apuestas.

## Modelo De Pago Aprobado

| Decision | Valor aprobado |
| --- | --- |
| Proveedor | Wompi Colombia. |
| Estado ADR | `ACEPTADA PARA EL MVP Y SANDBOX`. |
| Tipo de pago | Pago unico. |
| Moneda | COP. |
| Precio Premium | COP $20.000. |
| Precio tecnico Wompi | 2000000 centavos. |
| Nombre en Wompi | PrediGol Premium. |
| Checkout | Alojado por Wompi. |
| Datos de tarjeta | Nunca capturados ni almacenados por PrediGol. |
| Activacion | Solo despues de procesar y verificar server-side el evento de Wompi. |
| URL de retorno | Solo informativa; nunca activa Premium. |
| Entornos | Sandbox y produccion completamente separados. |

## Duracion

Cada pago aprobado otorga 30 dias de Premium.

## Renovacion

La renovacion del MVP es manual. La renovacion automatica no esta incluida.

## Comportamiento Con Premium Vigente

Si el usuario tiene Premium vigente, una nueva compra aprobada extiende 30 dias desde el vencimiento actual.

Si el usuario no tiene Premium vigente, los 30 dias empiezan desde la aprobacion server-side del pago.

Un pago pendiente, rechazado, anulado o con error no activa Premium.

## Avisos De Responsabilidad

Aviso recomendado:

“Los pronósticos se generan mediante modelos estadísticos y no garantizan resultados ni ganancias. Utiliza esta información como apoyo y juega responsablemente.”

## Reglas De Lenguaje Comercial

No utilizar:

- Apuesta segura.
- Ganancia garantizada.
- Resultado garantizado.
- Dinero asegurado.
- 100 % efectivo.
- Nunca falla.

Utilizar:

- Pronostico.
- Probabilidad estimada.
- Nivel de confianza.
- Escenario mas probable.
- Seleccion destacada.
- Analisis estadistico.

## Selecciones Destacadas

La seccion se llamara `Selecciones destacadas`. No se debe usar todavia el nombre `apuestas de valor`.

Una seleccion destacada debe basarse en criterios reales, por ejemplo:

- Datos suficientes.
- Confianza minima.
- Diferencia suficiente entre probabilidades.
- Liga con historico valido.
- Modelo ejecutado correctamente.
- Ausencia de advertencias graves de calidad de datos.

No se deben inventar selecciones manualmente. No se debe marcar un partido como destacado solo para llenar la seccion.

## Nivel De Confianza

En esta fase no se define una formula definitiva. Primero debe auditarse que datos actuales permiten calcularla de forma honesta.

Propuesta conceptual basada en elementos existentes o esperados:

- Diferencia entre la probabilidad principal y la segunda.
- Calidad de datos.
- Cantidad de partidos historicos.
- Incertidumbre del modelo.
- Estabilidad de los resultados.
- Liga o competicion.

Clasificaciones posibles:

- Muy alta.
- Alta.
- Media.
- Baja.

Confianza alta no significa certeza.

## Historial Verificable

Comportamiento esperado:

- Mostrar pronosticos generados antes de cada partido.
- Registrar fecha y modelo utilizado.
- No permitir alterar la prediccion despues del inicio del partido.
- Mostrar aciertos y errores.
- Mostrar cantidad de pronosticos evaluados.
- Mostrar rendimiento por liga.
- Mostrar rendimiento por periodo.
- No ocultar resultados negativos.
- Distinguir metricas por mercado.
- No afirmar rentabilidad si no existen cuotas historicas.

No se implementan nuevas tablas en esta fase.

## Pendientes De Datos Y Modelos

- Auditar datos disponibles para nivel de confianza.
- Definir formula final de confianza con evidencia.
- Confirmar disponibilidad de datos para mas/menos de 2.5 goles y ambos equipos marcan.
- Confirmar disponibilidad y calidad de otros marcadores probables.
- Definir criterios cuantitativos finales de selecciones destacadas.
- Validar historial por liga, periodo y mercado con datos reales.

## Precio Aprobado

Precio confirmado por el propietario para el MVP: COP $20.000.

Importe tecnico para Wompi: 2000000 centavos.

El frontend puede mostrar `COP $20.000`, pero el servidor debe utilizar el entero `2000000` como `amount-in-cents`. El precio debe registrarse en el catalogo server-side mediante migracion revisable, sin usar valores enviados por frontend como fuente confiable.

## Reembolsos Y Contracargos

Propuesta inicial para reembolso:

- No eliminar registros de pago.
- Marcar la orden como reembolsada.
- Conservar auditoria.
- Evaluar la suspension o ajuste de la vigencia Premium.
- Evitar dejar fechas o estados contradictorios.

Propuesta inicial para contracargo:

- Marcar la orden como contracargo.
- Suspender el beneficio asociado cuando corresponda.
- Conservar evidencia operativa.
- Permitir revision administrativa.
- No convertir al usuario en administrador ni modificar otros permisos.

La politica comercial y legal definitiva permanece: `REQUIERE DECISIÓN DEL PROPIETARIO Y VALIDACIÓN PROFESIONAL`.

## Recomendacion Para Fase 10B

No iniciar implementacion sandbox hasta preparar una migracion revisable de catalogo/ordenes/eventos, confirmar credenciales sandbox de Wompi fuera del repositorio y mantener la separacion estricta entre sandbox y produccion.

Fase 10B debe implementar primero el flujo sandbox con `wompi-create-checkout`, `wompi-webhook` y `wompi-payment-status` como nombres provisionales, sin cobros reales y sin exponer secretos al navegador.
