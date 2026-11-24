# Nivel 2 — de resolver ejercicios a aguantar datos reales

Este documento es la continuación de `WORKFLOW.md`, no un reemplazo.
`WORKFLOW.md` explica **cómo funciona** lo que ya está construido y
verificado (continuidad, parámetro desconocido, la gráfica, las
lecciones de los bugs de precisión). Aquí se introduce la **siguiente
etapa**, todavía sin construir: llevar el mismo motor de un ejercicio
de seis preguntas a un volumen de datos que un ejercicio de clase
nunca tuvo que soportar — y, después, a datos que nadie preparó para
que salieran bonitos.

> La regla de oro sigue intacta: **nada de lo que sigue toca
> `continuity_engine.py` ni `polynomial_engine.py`.** Todo lo nuevo de
> este nivel —medir tiempos, traer datos de una API, leer paquetes de
> red— vive en módulos alrededor, exactamente como `parametric_engine.py`
> vivió alrededor del motor en el nivel 1. Si este documento en algún
> punto sugiere "ajustar" el motor para que aguante más rápido, esa
> propuesta se detiene aquí y se vuelve a pensar como una capa nueva.

## Por qué dos experimentos, y en ese orden

La idea de conectar el motor a paquetes ICMP reales de la red local es
la meta interesante — es la que de verdad prueba si esto sirve para
algo más que una tarea. Pero meterse directo ahí mezcla dos preguntas
distintas en un solo experimento difícil de depurar:

1. ¿El motor (`continuity_engine` + `polynomial_engine`, trabajando
   juntos) **aguanta volumen** — cientos o miles de evaluaciones
   seguidas — sin que el cálculo exacto de `sympy` se vuelva el cuello
   de botella?
2. ¿El motor sabe qué hacer con **datos reales y ruidosos** — jitter,
   paquetes perdidos, timing asíncrono — que ningún ejercicio de clase
   generó a propósito para que calzara bien?

Si se prueban las dos preguntas a la vez con paquetes ICMP en vivo y
algo sale mal, no hay forma rápida de saber si el problema es de
rendimiento o es ruido de red real. Por eso el plan separa las dos
preguntas en dos experimentos, en orden: primero volumen controlado
(pregunta 1 sola), después datos reales (las dos preguntas juntas, ya
con la primera descartada como sospechosa).

## Experimento A — "Banco de Carga" (laboratorio de potencia y rendimiento)

**Qué prueba:** solo la pregunta 1. Datos sintéticos o traídos de una
API simple — grandes en cantidad, pero generados o elegidos por
nosotros, así que si algo falla se sabe que es el motor, no el dato.

**Módulo nuevo (capa, no modificación):** `api_data_extraction.py` —
trae o genera los lotes de datos (de una API pública simple, o
sintéticos si no hace falta una fuente externa todavía) y se los
entrega a `continuity_engine` / `polynomial_engine` exactamente en el
mismo formato que ya reciben de `main.py` hoy. No sabe nada de
continuidad; solo empaqueta datos.

**Pasos a seguir:**

1. Definir el lote de prueba: cuántos puntos (arrancar con decenas,
   subir a cientos, luego miles) y de qué forma (funciones con
   parámetro desconocido como los ejercicios del nivel 1, para
   reutilizar el mismo tipo de llamada a `parametric_engine`).
2. Medir tiempo de respuesta por lote, no por punto individual —
   cronometrar `continuity_engine.analyze_continuity` y
   `polynomial_engine` en conjunto, antes de que la capa visual entre
   en juego (el dibujo nunca debe ser parte de esta medición).
3. Encontrar el punto donde el tiempo deja de ser lineal con la
   cantidad de datos — ahí está el cuello de botella real, si existe.
4. Documentar el resultado aquí mismo (una tabla simple: n de puntos →
   tiempo), con la misma honestidad que la sección 6 de `WORKFLOW.md`:
   si aparece un bug o un límite de rendimiento, se registra con su
   causa, no solo con el arreglo.

**Qué se espera aprender:** si el cálculo exacto con `sympy` necesita
algún tipo de muestreo, cacheo o cambio de modo (simbólico → numérico,
ya soportado por `continuity_engine`) a partir de cierto volumen, antes
de que ese volumen llegue con el ruido añadido del experimento B.

## Experimento B — "Eco Vivo" (la prueba de fuego de red real)

**Qué prueba:** las dos preguntas juntas, pero ya con el rendimiento
puro descartado como sospechoso gracias al Banco de Carga.

**Por qué ese nombre:** ICMP, el protocolo detrás de `ping`, se llama
formalmente *echo request / echo reply* — literalmente "eco". Y el
proyecto ya se llama Señal Viva. "Eco Vivo" es la primera vez que el
motor escucha una señal que nadie preparó para él — una prueba de
fuego en el sentido literal: la red responde cuando quiere, como
quiere, y el motor tiene que decidir qué es continuidad y qué es ruido
sin que nadie se lo sirva en bandeja.

**Pasos a seguir (una vez cerrado el Experimento A):**

1. Capturar una serie de tiempo real y simple primero: latencia de
   `ping` (RTT) a un mismo destino, cada cierto intervalo, durante un
   tiempo razonable — no hace falta empezar con un socket crudo
   leyendo paquetes ICMP byte a byte; el tiempo de ida y vuelta ya es
   una señal real con ruido real.
2. Pasar esa serie por el mismo camino del Experimento A
   (`api_data_extraction.py` o un módulo hermano, p. ej.
   `icmp_capture.py`, ambos ajenos al motor) para que el motor reciba
   los datos en el formato que ya entiende.
3. Decidir, con el motor, dónde hay "continuidad" (la red se comporta
   de forma estable) y dónde hay una discontinuidad real (una caída de
   paquete, un pico de latencia, un corte) — y comparar esa lectura
   contra lo que de verdad pasó en la red en ese momento, no solo
   contra lo que el motor dice de sí mismo.
4. Documentar los hallazgos en un `red_local_uses.md` aparte (siguiendo
   la convención de `network_uses.md`), separando de nuevo el **cómo**
   (este documento y `WORKFLOW.md`) del **qué se encontró con datos
   reales** (ese archivo nuevo).

**Qué se espera aprender:** si "continuo" y "discontinuo", tal como el
motor los define con matemática exacta, siguen siendo una buena
descripción cuando el dato ya no viene de una fórmula limpia sino de
una red real — y qué hay que ajustar (siempre en una capa nueva, nunca
en el motor) para que la lectura siga siendo útil.

## Estado actual

Ninguno de los dos experimentos está construido todavía. Este
documento es el plan, escrito antes de empezar, a propósito — para que
el primer paso real, cuando llegue, tenga un rumbo claro en vez de
empezar por explorar a ciegas.