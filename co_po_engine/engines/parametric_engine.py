# engines/parametric_engine.py
"""
Capa adicional de PREPARACIÓN del cálculo — este módulo NO modifica
continuity_engine.py ni cambia su forma de responder. Su único trabajo
es resolver el valor de un parámetro desconocido (k, m, a, c, ...) que
hace continua una función a trozos, y devolver las piezas ya
sustituidas (con el parámetro convertido en un número concreto) para
que el motor de continuidad original las verifique exactamente como
siempre lo ha hecho.

Es el ajuste que pediste para poder trabajar con ejercicios como
"encuentre k para que f sea continua en x=2": el motor de continuidad
original solo entiende la variable 'x' a propósito (así evita ambigüedad
sobre qué es la función y qué es una constante) — este módulo es el que
entiende que 'k' es una incógnita, la despeja, y le entrega a
continuity_engine una función ya resuelta en términos de 'x' puro.

Dos escenarios, que cubren los ejercicios de la guía:

  * modo "salto" (jump): f(x) = left(x)              si x <  c
                          f(x) = right(x, param)      si x >= c
    El parámetro aparece en una de las dos ramas. Se resuelve igualando
    el límite por la izquierda con la rama derecha evaluada en c.
    (Ejercicios 1, 3 y 5 de la guía: hallar k, a, c.)

  * modo "removable": f(x) = expr(x)   para x != c  ;  f(c) = param
    El parámetro es el valor que se le asigna a la función justo en el
    punto de discontinuidad removible. Se resuelve como el límite de
    expr(x) cuando x -> c.
    (Ejercicio 2 de la guía: hallar m.)
"""

from sympy import Limit, Symbol, solve, sympify
from sympy.core.sympify import SympifyError

from engines.continuity_engine import _exact_point

X = Symbol("x")

# Por qué se reutiliza _exact_point de continuity_engine, en vez de
# escribir una copia aquí: el síntoma es exactamente el mismo que ya se
# documentó en WORKFLOW.md (sección 6.1) — un punto que llega como float
# de Python (`point = float(data["point"])` en main.py) hace que sympy
# calcule en punto flotante en vez de aritmética exacta. Pero aquí el
# daño es más sutil todavía: la expresión ya resuelta (`right_expr` /
# `left_expr`, con el parámetro sustituido) queda con COEFICIENTES
# flotantes metidos dentro de la fórmula (p. ej. "2.0*x - 1.33333333333")
# en vez de "2*x - 4/3". El arreglo de continuity_engine solo limpia el
# PUNTO que llega después; no puede "limpiar" una expresión que ya nació
# contaminada. Por eso este módulo necesita la misma conversión, en el
# mismo lugar del flujo (antes de cualquier Limit/.subs), para que la
# fórmula que le entrega a continuity_engine sea exacta desde el origen.
# Se importa la función en vez de copiarla para no duplicar la misma
# lógica en dos archivos — y sigue sin tocarse ni una línea de
# continuity_engine.py.


def _param_symbol(name):
    if not name or not str(name).isidentifier() or name == "x":
        raise ValueError(
            "El nombre del parámetro debe ser una letra distinta de 'x' (por ejemplo: k, m, a, c)."
        )
    return Symbol(name)


def solve_jump_parameter(left_expr, right_expr, point, param_name):
    """left_expr: fórmula de la rama x < point, en términos de x.
    right_expr: fórmula de la rama x >= point, en términos de x y de
    `param_name`.

    Devuelve el valor resuelto del parámetro y la rama derecha ya
    sustituida (un número, no una incógnita), lista para pasarla tal
    cual a continuity_engine.analyze_continuity.
    """
    param = _param_symbol(param_name)
    try:
        f_left = sympify(left_expr)
        f_right = sympify(right_expr, locals={param_name: param})
    except SympifyError as err:
        raise ValueError(f"No se pudo interpretar la expresión: {err}") from err

    if param not in f_right.free_symbols and param not in f_left.free_symbols:
        raise ValueError(
            f"Ninguna de las dos ramas contiene el parámetro '{param_name}'. "
            "Revisa que lo hayas escrito igual en la fórmula."
        )

    display_point = point            # para los mensajes
    point = _exact_point(point)      # para TODO el cálculo (ver nota arriba del archivo)

    # el parámetro puede estar en cualquiera de las dos ramas; se arma
    # la ecuación "límite izquierdo = rama derecha en el punto" y se
    # despeja, sea cual sea el lado donde aparezca la incógnita.
    lim_left = Limit(f_left, X, point, dir="-").doit()
    if not lim_left.is_number:
        raise ValueError(
            f"No se pudo calcular un límite numérico por la izquierda en x={display_point} "
            f"(resultado simbólico: {lim_left}). Revisa la expresión o el punto."
        )

    right_at_point = f_right.subs(X, point)
    equation = right_at_point - lim_left
    if param not in equation.free_symbols:
        raise ValueError(
            f"El parámetro '{param_name}' se cancela al sustituir x={display_point}; "
            "no hay un único valor que lo determine con esta información."
        )

    solutions = solve(equation, param)
    if not solutions:
        raise ValueError("No se encontró un valor del parámetro que haga continua la función.")

    param_value = solutions[0]
    try:
        param_value_f = float(param_value)
    except (TypeError, ValueError):
        raise ValueError(f"El valor resuelto no es un número real ({param_value}).")

    left_substituted = f_left.subs(param, param_value)
    right_substituted = f_right.subs(param, param_value)

    return {
        "mode": "jump",
        "param_name": param_name,
        "param_value": param_value_f,
        "left_limit": float(lim_left),
        "left_expr": str(left_substituted),
        "right_expr": str(right_substituted),
        "point": display_point,
        "detail": [
            f"Límite por la izquierda en x→{display_point}⁻: {lim_left}",
            f"Rama derecha evaluada en x={display_point}, en términos de {param_name}: {right_at_point}",
            f"Ecuación: {right_at_point} = {lim_left}  →  {param_name} = {param_value}",
        ],
    }


def solve_removable_parameter(expr, point, param_name):
    """expr: fórmula válida para x != point (p. ej. (x**2-9)/(x-3)).
    El parámetro es el valor que, asignado en `point`, hace la función
    continua — es decir, el límite de expr(x) cuando x -> point."""
    param_symbol = _param_symbol(param_name)  # valida el nombre aunque no se use como símbolo
    try:
        f = sympify(expr)
    except SympifyError as err:
        raise ValueError(f"No se pudo interpretar la expresión: {err}") from err

    if X not in f.free_symbols:
        raise ValueError("La expresión debe estar escrita en términos de 'x'.")

    display_point = point            # para los mensajes
    point = _exact_point(point)      # para el cálculo (ver nota arriba del archivo)

    limit_value = Limit(f, X, point).doit()
    try:
        limit_value_f = float(limit_value)
    except (TypeError, ValueError):
        raise ValueError(
            f"El límite en x={display_point} no es un número real finito ({limit_value}); "
            "no existe un valor de continuidad que se le pueda asignar."
        )

    return {
        "mode": "removable",
        "param_name": param_name,
        "param_value": limit_value_f,
        "expr": str(f),
        "point": display_point,
        "detail": [
            f"Límite de la expresión cuando x→{display_point}: {limit_value}",
            f"{param_name} = {limit_value} hace que la función sea continua en x={display_point}.",
        ],
    }


def solve_parameter(mode, point, param_name, left_expr=None, right_expr=None, expr=None):
    """Punto de entrada único para main.py."""
    if mode == "removable":
        if expr is None:
            raise ValueError("Falta la expresión válida para x ≠ punto.")
        return solve_removable_parameter(expr, point, param_name)
    if left_expr is None or right_expr is None:
        raise ValueError("Faltan las dos ramas (izquierda y derecha) para el modo 'salto'.")
    return solve_jump_parameter(left_expr, right_expr, point, param_name)