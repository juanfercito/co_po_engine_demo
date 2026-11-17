# Cómo funciona esto, paso a paso

Este documento explica el flujo completo en lenguaje simple: qué pasa
desde que escribes un número hasta que ves la figura moverse, y por
qué se mueve de esa forma. No necesitas saber programar para leerlo.

## 1. La idea de fondo, en una frase

**Una función es "continua" en un punto si se puede dibujar sin
levantar el lápiz al pasar por ahí.** Si al acercarte por la
izquierda y por la derecha llegas al mismo valor que tiene la función
justo en ese punto, es continua. Si no, hay un salto, un hueco, o se
dispara al infinito — eso es una discontinuidad.

Este proyecto hace esa pregunta con matemática real (no a ojo) y
después usa la respuesta para mover algo en pantalla.

## 2. El recorrido completo

```
  tus números / tus funciones
            │
            ▼
  ┌─────────────────────┐
  │ continuity_engine.py │   ← responde: ¿es continua? ¿cuánto vale
  └─────────┬────────────┘     a cada lado del punto?
            │
            ▼
  ┌─────────────────────┐
  │ polynomial_engine.py │   ← responde: con cuántos valores entraste
  └─────────┬────────────┘     (n) y qué tan grandes son en promedio (L)
            │
            ▼
  ┌─────────────────────┐
  │   visual_engine.py    │   ← NO vuelve a calcular nada pesado. Solo
  └─────────┬────────────┘     "traduce" lo anterior a unos pocos
            │                   números baratos (estable sí/no, qué
            ▼                   tan grande es el salto)
     figura en el navegador
     (dos vistas: abstracta y simpática)
```

La parte importante: **el cálculo difícil (límites, derivadas) se
hace una sola vez**, en el servidor, con matemática exacta (`sympy`).
Lo que llega al navegador ya viene resuelto — por eso la figura se
mueve fluida y no se traba, aunque esté corriendo en una laptop
modesta durante una videollamada. Es, literalmente, optimizar dónde
gastas el cómputo: una vez en el lugar correcto, en vez de muchas
veces en el lugar equivocado.

## 3. Qué hace cada motor

### `continuity_engine.py` — ¿es continua?

Recibe tres expresiones (lo que pasa a la izquierda del punto, justo
en el punto, y a la derecha) y un punto `x`. Tiene dos formas de
responder, que se complementan en vez de competir:

- **Modo simbólico**: usa matemática exacta. Sabe, por ejemplo, que el
  límite de `x²` cuando `x` se acerca a 2 es exactamente 4 — no una
  aproximación, el valor real. También calcula la derivada
  automáticamente, así que te ahorras derivar a mano.
- **Modo numérico**: en vez de resolver la fórmula, prueba con un
  número muy cercano al punto (por ejemplo, 1.99999 y 2.00001) y
  compara. Es una **estimación**, pero funciona incluso cuando la
  fórmula exacta es complicada o no existe en forma simple.

Ninguno reemplaza al otro: el simbólico es más preciso, el numérico es
más flexible. Por eso la interfaz te deja elegir.

### `polynomial_engine.py` — el orden dinámico

Aquí la regla es simple: **el número de valores que metes define el
orden de la operación**. Si metes 2 valores, trabaja con una potencia
al cuadrado (orden 2). Si metes 5, con una potencia a la quinta (orden
5). Con ese orden `n` y el promedio de tus valores (`L`), calcula:

- `L^n` — cómo crece la operación.
- la raíz n-ésima de `L` — la operación inversa.
- una serie de puntos que simulan una "caída" o atenuación,
  `distancia = L · tiempo^n`, que es la misma forma matemática que
  describe, por ejemplo, cómo se debilita una señal con la distancia.

### `visual_engine.py` — de números a figura

Este motor es el más corto a propósito. No hace cálculo simbólico, no
llama a `sympy`, no repite nada. Solo toma lo que los dos motores
anteriores ya calcularon y lo reduce a lo mínimo que el dibujo
necesita:

- `stable` (verdadero/falso) — viene directo del resultado de
  continuidad. Si no hay resultado de continuidad todavía, usa como
  respaldo qué tan dispersos están tus valores (si varían mucho entre
  sí, se asume "inestable" como aproximación rápida).
- `instability` — qué tan grande es el salto entre el límite izquierdo
  y el derecho. Cero si es continua; un número más grande cuanto más
  brusco es el salto.
- `vertices` — las esquinas de un polígono simple, usadas para dibujar
  tanto la malla abstracta como el contorno de la criatura.

## 4. Por qué la figura se comporta así

- **Continua → figura verde, nítida, sonriente.** El salto entre los
  límites es cero, así que no hay nada que "ensuciar" el dibujo: es la
  analogía de una señal limpia, sin interferencia.
- **Discontinua → figura naranja, borrosa, con mueca.** Cuanto más
  grande el salto entre los límites izquierdo y derecho, más fuerte el
  desenfoque — el mismo tipo de "ruido visual" que cualquiera asocia a
  una señal de televisión o una videollamada con mala conexión. No es
  decoración: es el tamaño real del salto, convertido en píxeles de
  desenfoque. La boca usa ese mismo número para pasar de sonrisa a
  mueca — un solo dato, dos lecturas visuales a la vez (temblor,
  desenfoque y gesto), nunca gestos añadidos por separado.
- **El tamaño sigue a `L`.** Valores de entrada más grandes (en
  promedio) producen una figura más grande.
- **El número de picos/caras sigue a `n`.** Más valores de entrada,
  más compleja la geometría — así se ve, literalmente, la
  dimensionalidad de lo que metiste.

> Un caso curioso para mostrar en clase: con `sqrt(x)` en `x = -4`, los
> tres lados (izquierda, centro, derecha) dan el mismo número complejo
> (`2i`), así que `is_continuous` sale `true` — pero la advertencia de
> dominio (sección 6) avisa que ese resultado no es un número real.
> Es un buen ejemplo de por qué "los tres lados coinciden" no basta:
> hay que preguntar también si lo que coincide tiene sentido en los
> números reales, que es el dominio en el que normalmente trabajamos
> en cálculo diferencial.

## 5. ¿Y esto para qué sirve en la vida real?

La continuidad y los límites no son solo un tema de examen — describen
cualquier situación donde algo puede cambiar bruscamente o romperse.
Algunos ejemplos, explicados simple:

- **Redes y telecomunicaciones** (la aplicación que motivó este
  proyecto): la potencia de una señal se debilita con la distancia
  siguiendo leyes de potencia parecidas a `L^n`. Una caída repentina
  de señal, un paquete perdido, un corte de conexión — todo eso es,
  matemáticamente, una discontinuidad.
- **Medicina y farmacología**: la concentración de un medicamento en
  la sangre sube y baja de forma continua con el tiempo (se llama
  farmacocinética). Si un paciente deja de tomar una dosis o recibe
  una sobredosis, la curva real se "rompe" respecto a la curva
  esperada — ahí la discontinuidad importa para detectar un problema.
- **Química**: en una reacción, la temperatura o la concentración de
  un reactivo suele cambiar de forma continua, excepto en un punto
  crítico (por ejemplo, cuando una sustancia cambia de estado). Ese
  punto crítico es, otra vez, una discontinuidad o un cambio brusco en
  la derivada.
- **Ingeniería (estructuras y materiales)**: la curva de
  esfuerzo-deformación de un material es continua mientras el material
  se comporta "normal" — pero en el punto de fractura, dejó de serlo.
  Detectar ese punto con precisión es, literalmente, resolver el mismo
  problema que resuelve `continuity_engine.py`.

La idea general: **cualquier sistema que mides en el tiempo o en el
espacio tiene puntos donde se porta bien (continuo) y puntos donde
algo se rompe (discontinuo)**. Este proyecto es una forma pequeña y
visual de practicar cómo encontrar esos puntos con matemática real, no
solo intuición.

## 6. Lecciones del motor original — por qué validar el dominio explícitamente

Esta sección queda para el registro, a propósito: el primer
`engine.py` de este proyecto (el que arrancó todo) calculaba límites y
derivadas correctamente, pero **no revisaba de antemano si el punto
donde preguntabas tenía sentido matemático**. En cálculo diferencial
hay tres restricciones de dominio que se repiten todo el tiempo y que
son fáciles de pasar por alto si uno va directo a "calcular el
límite" sin preguntarse primero "¿esta operación está permitida
aquí?":

1. **División por cero.** `1 / (x - 2)` no existe en `x = 2`. No es
   que el límite "dé infinito" — es que la operación, en ese punto
   exacto, no está definida.
2. **Raíz de índice par de un número negativo.** `√x` no tiene
   resultado real cuando `x` es negativo (sí tiene uno complejo, pero
   eso ya es otro tema que normalmente no se cubre en cálculo
   diferencial básico). Si no se revisa esto, el motor puede devolver
   un número que "parece válido" pero que en realidad vive fuera del
   conjunto de los números reales.
3. **Manejo de infinito.** Cuando una expresión se dispara a
   infinito, hay que decidir explícitamente qué tipo de infinito es
   (positivo, negativo, o infinito complejo/`zoo` en el lenguaje de
   `sympy`) y qué hacer con ese valor antes de mostrarlo — no se puede
   simplemente "convertir a número" y esperar que funcione.

**El bug concreto que encontramos al construir esta versión:** cuando
el centro de la evaluación caía exactamente en una división por cero
(por ejemplo, `1/x` en `x = 0`), sympy devolvía `zoo` (infinito
complejo). La función que convertía resultados a JSON solo sabía
manejar infinito positivo y negativo (`oo`, `-oo`), pero no `zoo` — así
que el servidor se caía con un error de serialización en vez de
avisar con claridad "aquí hay una división por cero". El dato nunca
llegó a verse mal: **el programa se rompía antes de poder mostrar
nada**, que es la forma más silenciosa posible de fallar.

**La regla que nos llevamos de esto:** las restricciones de dominio no
se pueden dejar implícitas (confiando en que si algo está mal, "ya se
va a notar" cuando truene el programa). Hay que declararlas dos
veces:

- **En el código**, como una revisión explícita antes de calcular
  cualquier límite (`_domain_warnings` en `continuity_engine.py`),
  para que el problema se reporte como un mensaje claro en vez de
  como un error de bajo nivel o, peor, un resultado incorrecto que
  parece correcto.
- **En la documentación** (aquí mismo), para que quien lea el código
  después — incluida la versión futura de quien lo escribió — sepa
  que esas tres restricciones existen a propósito y no por accidente,
  y no las borre "para simplificar" sin darse cuenta de qué estaba
  evitando.

Esa combinación — código que valida y documento que explica por qué —
es la diferencia entre un error que se nota en el momento y una deuda
técnica silenciosa que aparece meses después, en el peor momento
posible (por ejemplo, durante una demo en vivo).
