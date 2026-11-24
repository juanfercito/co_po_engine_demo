# Cómo funciona esto, paso a paso

Este documento explica el flujo completo en lenguaje simple: qué pasa
desde que escribes un número hasta que ves la figura moverse, y por
qué se mueve de esa forma. No necesitas saber programar para leerlo.

> ## ⚠️ REGLA DE ORO DE ESTE PROYECTO
>
> **NUNCA TOCAR EL MOTOR (`engines/continuity_engine.py`). SIEMPRE
> TRABAJAR EN CAPAS — NUEVOS MÓDULOS ALREDEDOR, EL MOTOR INTACTO.**
>
> Todo lo nuevo que este proyecto necesite (un parámetro desconocido,
> una gráfica cartesiana, un caso de uso distinto a telecomunicaciones,
> lo que sea) se resuelve agregando un módulo *alrededor* de
> `continuity_engine.py` — nunca editando su lógica de clasificación de
> continuidad. Una corrección real de un bug dentro del motor (como la
> de la sección 6) es la única excepción, y debe quedar documentada
> aquí mismo, en detalle, el mismo día que se hace.
>
> ¿Por qué esta regla y no otra? Porque `continuity_engine.py` es la
> única pieza que los demás módulos (`parametric_engine.py`,
> `visual_engine.py`, lo que venga después) dan por **ya verificada**.
> Si su lógica se oscurece con parches de un caso de uso específico
> (telecomunicaciones, finanzas, lo que sea), se vuelve cada vez más
> difícil saber si un resultado raro es un bug nuevo o un efecto
> colateral de un parche viejo — y entonces depurarlo, o simplemente
> confiar en él, se vuelve imposible. Ver sección 8 para la prueba de
> que esta disciplina realmente funciona: el motor resolvió seis
> ejercicios de un dominio que nunca tuvo en mente, sin que nadie
> tocara una sola línea de su lógica de continuidad.

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

### 6.1 Segunda lección, misma familia de bug: punto "exacto" vs. punto flotante

Al probar los ejercicios de la guía (sección 7) apareció una variante
del mismo problema, más sutil todavía porque **no truena — solo da un
resultado ligeramente incorrecto**.

El Ejercicio 5 pide verificar que `S(x) = 8/(x+1)` (para `x<2`) y
`S(x) = c·x - 4/3` (para `x≥2`) es continua en `x=2` una vez resuelto
`c=2`. A mano, ambas ramas dan exactamente `8/3`. Pero al evaluarlo con
el motor, salía `is_continuous: false`, con estos dos valores:

```
f_x_left  = 2.6666666666666665
f_x_right = 2.666666666666667
```

Son el mismo número matemático, `8/3`, pero representados por dos
patrones de bits de punto flotante distintos — difieren solo en el
último dígito. La causa: cuando el punto de entrada llega como
`2.0` (float de Python, porque `main.py` siempre hace
`float(data["point"])`), `sympy` sustituye ese float directamente en
la expresión y calcula el límite **en aritmética de punto flotante**
en vez de aritmética racional exacta. Dos ramas algebraicamente
idénticas pueden entonces "redondear" a bits distintos — y la prueba
de continuidad en modo simbólico, que exige igualdad exacta
(`left_val == center_val == right_val`), las marca como diferentes
por un error invisible.

**La solución — `_exact_point()` en `continuity_engine.py`:** antes de
usar el punto en cualquier `Limit(...)` o `.subs(X, point)`, se
convierte a un número exacto de `sympy` (entero o racional) con
`nsimplify(point, rational=True)` si llega como float, o
`sympify(point, rational=True)` si llega como string. Así, `2.0` se
convierte internamente en el entero exacto `2`, y toda la aritmética
que sigue es racional, no flotante. Para que el usuario siga viendo
"2.0" o "2.4" en los mensajes (y no una fracción rara como `12/5`), se
guarda por separado un `display_point` — el valor original, sin
tocar — que se usa solo en los textos de salida (`"x": display_point`,
los f-strings de `detail`), nunca en los cálculos.

**Por qué es la misma lección, otra vez:** tanto el bug de `zoo` como
este viven en la misma categoría — "sympy puede darte un resultado
técnicamente correcto en una representación que la capa siguiente no
sabe interpretar o comparar bien". La diferencia es que `zoo` rompía
el programa (fallo ruidoso, fácil de notar) y este rompía solo la
*comparación de igualdad* (fallo silencioso, el peor tipo: el servidor
respondía 200 OK con un resultado matemáticamente incorrecto). La
regla que ya teníamos — declarar explícitamente, en código y en este
documento, cada vez que la aritmética flotante puede traicionarte —
sigue aplicando.

`analyze_continuity_numeric` (el modo "ε", que ya compara con una
tolerancia `abs(a - b) < 1e-3` en vez de igualdad exacta) nunca tuvo
este problema — por diseño, no exige bit a bit lo mismo. Solo el modo
simbólico necesitaba el arreglo.

### 6.2 Tercera aparición del mismo bug — esta vez en `parametric_engine.py`

Al resolver el Ejercicio 5 de la guía (sección 7) con el Ejercicio 5
usando c, el panel de parámetro marcaba **continua** pero la caja de
Continuidad, con esa misma función ya "resuelta", marcaba
**discontinua** — dos cajas del mismo motor contradiciéndose entre
sí. Es la prueba práctica de por qué existe la regla de oro al inicio
de este documento: un bug que vive en un módulo nuevo puede verse
exactamente igual de confuso que un bug en el motor, si nadie lo
aísla rápido.

La causa fue la misma familia de la sección 6.1, pero un paso más
atrás en el flujo: `main.py` recibe el punto crítico como
`float(data["point"])` y se lo pasa tal cual a
`parametric_engine.solve_jump_parameter` / `solve_removable_parameter`,
que lo usaba directamente en `Limit(...)` y `.subs(X, point)` **sin**
convertirlo a su forma exacta primero. El arreglo de la sección 6.1
solo limpia el punto que recibe `continuity_engine` — no puede limpiar
una expresión que `parametric_engine` ya le entrega contaminada, con
coeficientes de punto flotante metidos dentro de la fórmula misma
(por ejemplo, `"2.0*x - 1.33333333333333"` en vez de `"2*x - 4/3"`).
Por eso la caja de parámetro, que solo mostraba el valor final
redondeado (`c = 2`), se veía bien, mientras que la caja de
Continuidad, al re-evaluar esa fórmula contaminada, sí mostraba la
discrepancia.

**La solución** reutiliza — importa, no copia — la misma función
`_exact_point()` de `continuity_engine.py` dentro de
`parametric_engine.py` (`from engines.continuity_engine import
_exact_point`), aplicada en el mismo punto del flujo, antes de
cualquier `Limit`/`.subs`, en los dos modos (`jump` y `removable`).
Esto respeta la regla de oro de dos maneras a la vez: el motor
original sigue sin una sola línea tocada, y la lógica de "cómo
convertir un punto a su forma exacta" no queda duplicada en dos
archivos — vive en un solo lugar y el módulo nuevo simplemente la usa.

Los Ejercicios 1, 2 y 3 (que resuelven k, m y a) nunca mostraron el
síntoma porque sus parámetros resueltos daban números "redondos"
(-0.5, 6, 3) donde el error de redondeo, aunque presente, no alcanzaba
a cambiar el último dígito visible. El Ejercicio 5 (c=2, con 8/3 de
por medio) sí lo hizo evidente — otra razón para probar siempre con
fracciones no triviales, no solo con enteros, al validar un motor
simbólico.

## 7. Los ejercicios de la guía — qué se añadió y por qué

Después de la presentación en clase, varios compañeros pidieron ayuda
con su tarea de límites y continuidad (los 6 ejercicios del documento
de la asignatura). Para resolverlos con este mismo motor y señalarles lo que se espera de cada procedimiento, sin tocar lo
que ya funcionaba, se añadieron tres piezas — un módulo nuevo, una
función nueva en un motor existente, y dos endpoints nuevos — además
del arreglo de precisión de la sección 6.1.

### 7.1 `parametric_engine.py` — módulo nuevo, no una modificación

Varios ejercicios no preguntan "¿es continua?" directamente — piden
**hallar el valor de un parámetro desconocido** (`k`, `m`, `a`, `c`)
que hace que la función sea continua. Eso es un problema distinto:
`continuity_engine.py` solo entiende la variable `x`; si se le pasa
una expresión con `k` dentro, no tiene con qué resolver `k` — no es un
error del motor, es una pregunta distinta a la que fue diseñado para
responder.

En vez de enseñarle `x` *y* un parámetro a `continuity_engine.py` (lo
que mezclaría dos responsabilidades distintas en una sola función y
arriesgaría romper los casos que ya funcionan perfecto), se creó
`parametric_engine.py` como una **capa de preparación** que vive
antes del motor de continuidad, no dentro de él:

```
   f_izq, f_der (con parámetro) + punto
              │
              ▼
   ┌───────────────────────┐
   │ parametric_engine.py  │  ← resuelve el parámetro (k, m, a, c...)
   └───────────┬───────────┘    usando la MISMA idea matemática que
              │                  continuity_engine (límites con sympy)
              ▼
   f_izq, f_der YA resueltas (sin parámetro, solo con 'x')
              │
              ▼
   ┌───────────────────────┐
   │ continuity_engine.py  │  ← verifica la continuidad, como siempre,
   └───────────────────────┘    sin saber que hubo un parámetro
```

Tiene dos modos, según el tipo de discontinuidad del ejercicio:

- **`solve_jump_parameter`** (Ejercicios 1, 3, 5 — dos ramas, salto):
  el parámetro aparece en la rama derecha. Se calcula el límite por la
  izquierda (ese no depende del parámetro) y se resuelve la ecuación
  "rama derecha en el punto = límite izquierdo" para el parámetro —
  exactamente la condición matemática de continuidad en un punto de
  empalme.
- **`solve_removable_parameter`** (Ejercicio 2 — una sola rama con un
  "hueco"): el parámetro es, directamente, el valor del límite de la
  expresión en el punto — la definición misma de "discontinuidad
  removible": el límite existe, solo falta asignárselo a la función en
  ese punto.

Una vez resuelto el parámetro, `main.py` sustituye las funciones ya
resueltas en las cajas de siempre y le pasa el resultado a
`continuity_engine.analyze_continuity` sin cambios — el motor
original nunca se entera de que hubo un parámetro de por medio. Así se
cumple lo pedido: "si no contamina el motor, mejor un módulo aparte".

### 7.2 `cartesian_series` en `visual_engine.py` — la gráfica real

La vista Panel ya tenía gráficas, pero son **demostrativas**: curvas
genéricas que ilustran la idea de orden/atenuación, no la función que
el usuario escribió. Para los ejercicios se necesitaba lo contrario —
una gráfica cartesiana real, generada a partir de las funciones y el
punto que el usuario ingresó, al estilo de la Figura 16 de la guía
(costo de red con salto en t=50): ejes, la curva de cada rama, y el
salto o el hueco marcado con el mismo lenguaje visual del libro (punto
relleno = valor que sí se alcanza, punto hueco = valor que no).

`cartesian_series` hace *solo* el muestreo: evalúa cada rama en ~160
puntos de `x` y descarta los puntos donde el resultado no es un número
real finito (así una asíntota se ve como un corte limpio en la curva,
no como una línea disparada fuera del gráfico). A propósito **no
decide qué tipo de discontinuidad hay** — eso ya lo sabe hacer
`continuity_engine` correctamente (incluyendo los casos de `zoo` e
infinito de la sección 6). Repetir esa clasificación aquí, evaluando
la fórmula punto por punto, habría reintroducido el mismo tipo de bug
silencioso que ya corregimos dos veces. Por eso el endpoint
`/api/chart` en `main.py` combina ambas piezas — la curva de
`visual_engine` y la clasificación de `continuity_engine` — en vez de
que una sola función intente hacer las dos cosas.

El frontend (`drawCartesian` en `app.js`) dibuja la curva y decide,
con esos mismos datos ya resueltos, si pintar una asíntota (línea
punteada vertical), un salto (dos puntos, uno hueco uno relleno, con
el `Δ` marcado) o una discontinuidad removible (el límite como punto
hueco, el valor almacenado como punto relleno aparte) — la misma
convención visual de la Figura 16.

### 7.3 El panel de "Resultados" — respuesta automática a los ejercicios

Cada ejercicio de la guía pide responder varias preguntas numeradas o
con viñetas (p. ej. el Ejercicio 2 tiene 5 literales). Con el objetivo de simplificar la escritura de las respuestas a mano a partir de los
números sueltos, `updateResultsText()` en `app.js` arma un texto guía 
"Resultados: 1. ..., 2. ..., 3. ..." directamente a partir de los
mismos datos ya calculados por `continuity_engine` (y, si aplica, por
`parametric_engine`) — nunca se recalcula nada por separado, solo se
redacta en frases legibles lo que el motor ya verificó.

### 7.4 Mapeo de los 6 ejercicios a los modos del motor

| Ejercicio | Tipo de discontinuidad | Módulo usado |
|---|---|---|
| 1 | Salto, parámetro `k` por resolver | `parametric_engine` (jump) → `continuity_engine` |
| 2 | Removible, parámetro `m` por resolver | `parametric_engine` (removable) → `continuity_engine` |
| 3 | Salto, parámetro `a` por resolver | `parametric_engine` (jump) → `continuity_engine` |
| 4 | Removible (sin parámetro — solo verificar) | `continuity_engine` directo |
| 5 | Salto, parámetro `c` por resolver | `parametric_engine` (jump) → `continuity_engine` |
| 6 | Infinita / asíntota (sin parámetro) | `continuity_engine` directo |

Todos verificados de punta a punta (valores calculados a mano como
referencia, contra la salida real del motor) antes de entregar esta
versión: k=-0.5, m=6, a=3, c=2, y las clasificaciones de discontinuidad
removible/asintótica de los Ejercicios 4 y 6, todos coinciden.

## 8. El motor es agnóstico de dominio — telecomunicaciones fue la primera prueba, no la única posible

Vale la pena dejar escrito, aparte, lo que demostró resolver estos 6
ejercicios: no fue solo "la tarea quedó resuelta", sino que
`continuity_engine.py` nunca necesitó enterarse de que las funciones
que estaba evaluando representaban latencia de red, temperatura de un
sensor IoT, retardo de paquetes o interferencia de radiofrecuencia.
Para el motor, `x**2-4`, `(x**2-9)/(x-3)` o `1/Abs(x-2.4)` son
simplemente expresiones simbólicas — nunca supo, ni necesitó saber,
que eran modelos de telecomunicaciones.

Esa es la señal de un motor bien aislado: funciona como una **llave
maestra**, no como una herramienta hecha a medida para un solo
candado. El dominio (telecomunicaciones, en este caso) vive entero
*fuera* del motor — en los nombres de las variables, en las narrativas
de `app.js` (`GUIDED_EXAMPLES`, `DISCONTINUITY_INFO.telecom`), en este
mismo documento — nunca dentro de `continuity_engine.py`. Si mañana
se quisiera resolver un caso de finanzas, biología o logística, la
receta sería exactamente la misma que en la sección 7: módulos nuevos
alrededor, cero líneas tocadas en el motor.

El caso de telecomunicaciones completo — los 6 ejercicios con su
procedimiento paso a paso, pensado como material didáctico y no solo
como registro de depuración — se documenta aparte, en
`network_uses.md`, como el primer ejemplo concreto de esta idea.
Futuros casos de uso (de otros dominios) deberían documentarse de la
misma forma, en su propio archivo `<dominio>_uses.md`, dejando este
`WORKFLOW.md` enfocado en el **cómo** (arquitectura, capas, lecciones
del motor) y a los archivos `*_uses.md` el **para qué** (casos reales,
un dominio por archivo).

La documentación de los usos del motor citados en este proyecto se 
acumularán en la carpeta `approaches_and_uses/`, para registrar y evaluar
su aplicación en las diversas áreas profesionales antes mencionadas.

## 9. Próximos pasos: escalamiento y datos en vivo

Cerrada esta primera etapa (la tarea de Límites y Continuidad, resuelta
de punta a punta sin tocar el motor), el siguiente nivel de dificultad
ya no es "¿responde bien a un ejercicio?" sino "¿aguanta volumen, y
aguanta datos reales?". Esa pregunta es lo bastante distinta —
rendimiento bajo carga, datos ruidosos de una fuente externa en vez de
un ejercicio controlado — como para no mezclarla con este documento.

Queda documentada aparte, en **`workflow_lv2.md`**, siguiendo la misma
convención que ya usamos con los archivos `*_uses.md`: este archivo se
queda enfocado en el **cómo** de lo ya construido y verificado;
`workflow_lv2.md` es la introducción y la bitácora de la **siguiente
capa**, todavía por construirse, con su propio plan de experimentos
(`Banco de Carga` y `Eco Vivo`) y sus propios pasos a seguir. La regla
de oro de este documento (sección cero) sigue aplicando sin excepción
en esa siguiente etapa: lo que sea que se aprenda ahí sobre rendimiento
o sobre datos en vivo se resuelve en capas nuevas, nunca editando
`continuity_engine.py` ni `polynomial_engine.py`.