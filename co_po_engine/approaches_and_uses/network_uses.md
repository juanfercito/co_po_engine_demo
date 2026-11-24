# Caso de uso: telecomunicaciones — Carrera de Redes y Analítica de Datos

Este documento es material **didáctico**, no un registro de depuración.
Muestra el primer caso de uso real del motor Señal Viva / CO-PO Engine:
los 6 ejercicios de la Actividad Práctico Experimental de Cálculo
Diferencial (Unidad 2: Límites y Continuidad), resueltos con el motor
tal como está, sin que `continuity_engine.py` necesitara saber que las
funciones representaban latencia, temperatura, retardo o interferencia
de radiofrecuencia.

Ver `WORKFLOW.md`, sección 8, para la idea completa de por qué esto
importa (el motor como "llave maestra", agnóstico de dominio). Aquí
solo se documenta el **qué** y el **cómo se resolvió**, ejercicio por
ejercicio, con el procedimiento, una tabla de verificación numérica y
la respuesta directa — pensado para que cualquier compañero de la
carrera pueda seguirlo sin necesidad de leer el código.

Todos los ejercicios se resuelven con la misma interfaz: la caja
**Continuidad** (cuando no hay parámetro desconocido) o la caja
**¿Función con parámetro desconocido?** (cuando sí lo hay), y se leen
en la vista **Figura** — gráfica cartesiana + explicación + resultados
automáticos.

---

## Ejercicio 1 — Latencia de una red

f(x) = x²−4, si x<2 ; f(x) = kx+1, si x≥2

**Caja:** parámetro desconocido, modo salto. f izq = `x**2-4`, f der =
`k*x+1`, parámetro `k`, punto `2`.

**Procedimiento:**
1. lim(x→2⁻) (x²−4) = 0
2. Condición de continuidad: k(2)+1 = 0 → k = **−0.5**

**Verificación numérica:**

| x (izq.) | f(x)=x²−4 | x (der.) | f(x)=−0.5x+1 |
|---|---|---|---|
| 1.9 | −0.390 | 2.1 | −0.050 |
| 1.99 | −0.0399 | 2.01 | −0.005 |
| 1.999 | −0.003999 | 2.001 | −0.0005 |

**Respuesta:** k = −0.5. Ambos límites laterales → 0. La función **es
continua** en x=2.

---

## Ejercicio 2 — Sensor IoT (discontinuidad removible)

g(x) = (x²−9)/(x−3), si x≠3 ; g(x) = m, si x=3

**Caja:** parámetro desconocido, modo removible. f(x) =
`(x**2-9)/(x-3)`, parámetro `m`, punto `3`.

**Procedimiento:**
1. Simplificación: x²−9 = (x−3)(x+3) → g(x) = x+3, válido para x≠3.
2. lim(x→3) g(x) = 3+3 = **6** → m = **6**

**Verificación numérica:**

| x (izq.) | g(x) | x (der.) | g(x) |
|---|---|---|---|
| 2.9 | 5.900 | 3.1 | 6.100 |
| 2.99 | 5.990 | 3.01 | 6.010 |
| 2.999 | 5.999 | 3.001 | 6.001 |

**Respuesta:** m = 6. La función **es continua** en x=3 una vez
definido g(3)=6. El motor también reporta la advertencia de dominio
("división por cero en x=3") — evidencia de que el hueco original era
real antes de fijar m.

---

## Ejercicio 3 — Retardo de una red

R(x) = 2x+1, si x<5 ; R(x) = a·x−4, si x≥5

**Caja:** parámetro desconocido, modo salto. f izq = `2*x+1`, f der =
`a*x-4`, parámetro `a`, punto `5`.

**Procedimiento:**
1. lim(x→5⁻) (2x+1) = 11
2. a(5)−4 = 11 → a = **3**

**Verificación numérica:**

| x (izq.) | R(x)=2x+1 | x (der.) | R(x)=3x−4 |
|---|---|---|---|
| 4.9 | 10.800 | 5.1 | 11.300 |
| 4.99 | 10.980 | 5.01 | 11.030 |
| 4.999 | 10.998 | 5.001 | 11.003 |

**Respuesta:** a = 3. Retardo en el punto de transición = 11. La
función **es continua** en x=5.

---

## Ejercicio 4 — Indicador de una plataforma de datos (removible, sin parámetro)

D(x) = (x²−16)/(x−4), si x≠4 ; D(4) = 10

**Caja:** Continuidad directa. f izq = f der = `(x**2-16)/(x-4)`,
f centro = `10`, punto `4`.

**Procedimiento:**
1. Simplificación: x²−16 = (x−4)(x+4) → D(x) = x+4, válido para x≠4.
2. lim(x→4) D(x) = 4+4 = **8**
3. Comparación: límite (8) ≠ valor almacenado (10)

**Verificación numérica:**

| x (izq.) | D(x) | x (der.) | D(x) |
|---|---|---|---|
| 3.9 | 7.900 | 4.1 | 8.100 |
| 3.99 | 7.990 | 4.01 | 8.010 |
| 3.999 | 7.999 | 4.001 | 8.001 |

**Respuesta:** la función **es discontinua** en x=4 — discontinuidad
**removible** (el límite existe, 8, pero D(4)=10 fue mal registrado).
A diferencia del Ejercicio 2, aquí el ejercicio solo pide clasificar,
no corregir.

---

## Ejercicio 5 — Rendimiento de un servicio de datos

S(x) = 8/(x+1), si x<2 ; S(x) = c·x−4/3, si x≥2

**Caja:** parámetro desconocido, modo salto. f izq = `8/(x+1)`, f der
= `c*x-4/3`, parámetro `c`, punto `2`.

**Procedimiento:**
1. lim(x→2⁻) 8/(x+1) = 8/3
2. c(2)−4/3 = 8/3 → 2c = 4 → c = **2**

**Verificación numérica:**

| x (izq.) | S(x)=8/(x+1) | x (der.) | S(x)=2x−4/3 |
|---|---|---|---|
| 1.9 | 2.7586 | 2.1 | 2.8667 |
| 1.99 | 2.6756 | 2.01 | 2.6867 |
| 1.999 | 2.6676 | 2.001 | 2.6687 |

**Respuesta:** c = 2. Ambos límites laterales → 8/3 ≈ 2.667. La
función **es continua** en x=2. (Este fue el ejercicio donde se
detectó y corrigió el bug de precisión descrito en WORKFLOW.md,
sección 6.2 — queda como buen ejemplo de por qué conviene probar con
fracciones no triviales, no solo con números enteros.)

---

## Ejercicio 6 — Interferencia en una banda de radiofrecuencia

I(f) = 1/|f−2.4|, para f≠2.4 (en GHz)

**Caja:** Continuidad directa. f izq = f centro = f der =
`1/Abs(x-2.4)`, punto `2.4`.

**Procedimiento:**
1. El denominador |f−2.4| se anula exactamente en f=2.4 → división
   por cero en el punto crítico.
2. lim(f→2.4⁻) I(f) = +∞ ; lim(f→2.4⁺) I(f) = +∞ (ambos lados, por el
   valor absoluto)

**Verificación numérica:**

| f (izq.) | I(f) | f (der.) | I(f) |
|---|---|---|---|
| 2.3 | 10 | 2.5 | 10 |
| 2.39 | 100 | 2.41 | 100 |
| 2.399 | 1000 | 2.401 | 1000 |

**Respuesta:** ambos límites divergen a +∞. La función **no es
continua** en f=2.4 GHz — discontinuidad **infinita (asíntota
vertical)**, simétrica por el valor absoluto. A diferencia de los
Ejercicios 2 y 4, aquí ningún valor finito podría "reparar" la
función.

---

## Lo que queda demostrado

| Ejercicio | Contexto de telecom | Tipo de discontinuidad | ¿Se resolvió un parámetro? |
|---|---|---|---|
| 1 | Latencia de red | — (quedó continua) | Sí: k = −0.5 |
| 2 | Sensor IoT | Removible | Sí: m = 6 |
| 3 | Retardo de red | — (quedó continua) | Sí: a = 3 |
| 4 | Indicador de datos | Removible | No |
| 5 | Rendimiento de servicio | — (quedó continua) | Sí: c = 2 |
| 6 | Interferencia RF | Infinita (asíntota) | No |

El motor cubrió los tres tipos de discontinuidad de la guía (salto,
removible, infinita) y los dos modos de parámetro (`jump`,
`removable`) sin que `continuity_engine.py` cambiara una sola línea
para lograrlo — toda la adaptación vivió en `parametric_engine.py`,
`visual_engine.py` y el frontend. Esa separación es, en sí misma, la
prueba de que el motor es reutilizable fuera de telecomunicaciones.