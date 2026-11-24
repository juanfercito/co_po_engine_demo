# engines/visual_engine.py
"""
Motor visual — NO vuelve a calcular nada simbólico. Toma los resultados
que continuity_engine y polynomial_engine YA produjeron y los reduce a
un puñado de números baratos de interpretar en el navegador:

    engine (sympy, exacto/numérico)  →  visual_engine (derivación barata)  →  canvas (frontend)

Esa es la idea de "optimización de costo de cómputo" que motiva todo el
proyecto: el trabajo pesado (límites, derivadas) se hace una sola vez en
el backend; el frontend solo dibuja números ya resueltos, cuadro a
cuadro, sin volver a tocar sympy ni repetir el cálculo.

Si no hay resultado de continuidad disponible (por ejemplo, la vista
todavía no evaluó ninguna función), se usa como respaldo la varianza de
los valores de entrada — igual de barata, pero menos exacta — como
proxy de "qué tan irregular se ve la entrada".

Añadido para los ejercicios de la guía didáctica: `cartesian_series`
muestrea las dos ramas de una función a trozos (izquierda/derecha, el
mismo left/center/right que ya usa continuity_engine) para dibujar una
gráfica cartesiana real — ejes, ticks, y el salto o la discontinuidad
removible marcados — al estilo de la Figura 16 de la guía. Sigue sin
tocar continuity_engine.py: solo evalúa la MISMA expresión ya validada
en muchos puntos de x, con sympy, para trazar la curva.
"""

import math

from sympy import Symbol, lambdify, sympify
from sympy.core.sympify import SympifyError

_X = Symbol("x")


def _variance(values):
    n = len(values)
    mean = sum(values) / n
    return sum((v - mean) ** 2 for v in values) / n


def regular_polygon_vertices(n, radius=1.0):
    """Vértices de un polígono regular de n lados, normalizados a un
    círculo unitario. Es la geometría base que el frontend extruye en
    una malla de alambre (caja 'abstracta') o en el contorno de la
    criatura (caja 'simpática')."""
    sides = max(3, min(14, n))
    return [
        [radius * math.cos(-math.pi / 2 + (i / sides) * 2 * math.pi),
         radius * math.sin(-math.pi / 2 + (i / sides) * 2 * math.pi)]
        for i in range(sides)
    ]


def derive_visual_state(order_result, continuity_result=None, raw_values=None):
    """
    order_result: salida de polynomial_engine.dynamic_order / free_fall_series
    continuity_result: salida de continuity_engine.analyze_continuity (opcional)
    raw_values: valores crudos de entrada, usados solo como respaldo si no
                hay resultado de continuidad todavía.

    Devuelve un estado visual listo para consumir tal cual en el
    frontend: nada de sympy, nada de trigonometría pesada, solo floats
    y una lista corta de vértices.
    """
    n = order_result["n"]
    L = order_result["L"]

    if continuity_result is not None:
        is_stable = bool(continuity_result.get("is_continuous", False))
        try:
            left = float(continuity_result["f_x_left"])
            center = float(continuity_result["f_x"])
            right = float(continuity_result["f_x_right"])
            # el salto puede venir de izquierda vs. derecha (discontinuidad de
            # salto) O de los límites vs. el centro (discontinuidad removible,
            # donde los dos límites coinciden pero f(x0) no coincide con
            # ellos) — se toma el mayor de los tres para que la figura
            # reaccione sea cual sea el tipo de discontinuidad.
            gap = max(abs(left - right), abs(left - center), abs(right - center))
        except (TypeError, ValueError):
            # infinito ('∞'/'-∞') u otro valor no numérico -> máxima inestabilidad
            gap = 10.0
        source = "continuity_engine"
    elif raw_values:
        gap = _variance(raw_values)
        is_stable = gap < 1.2
        source = "variance_fallback"
    else:
        gap = 0.0
        is_stable = True
        source = "default"

    return {
        "n": n,
        "L": L,
        "stable": is_stable,
        "instability": round(min(gap, 10.0), 4),
        "vertices": regular_polygon_vertices(n + 2),
        "source": source,
    }


def _safe_lambdify(expr_str):
    try:
        expr = sympify(expr_str)
    except SympifyError as err:
        raise ValueError(f"No se pudo interpretar la expresión '{expr_str}': {err}") from err
    return expr, lambdify(_X, expr, modules=["math"])


def _sample_branch(fn, lo, hi, steps, include_hi):
    """Muestrea fn(x) en [lo, hi]. Salta puntos donde la función no da
    un real finito (división por cero, raíz negativa, etc.) — eso es lo
    que hace que una asíntota se vea como un corte en la curva, en vez
    de una línea disparada fuera del gráfico."""
    points = []
    n_steps = max(2, steps)
    for i in range(n_steps + 1):
        if not include_hi and i == n_steps:
            continue
        x = lo + (hi - lo) * i / n_steps
        try:
            y = fn(x)
            if isinstance(y, complex) or not math.isfinite(y):
                continue
        except (ZeroDivisionError, ValueError, OverflowError, TypeError):
            continue
        points.append({"x": round(x, 6), "y": y})
    return points


def cartesian_series(left_expr, right_expr, point, x_min=None, x_max=None, steps=160):
    """Genera los puntos de ambas ramas de una función a trozos, listos
    para dibujar una curva cartesiana real (no decorativa) en el
    navegador.

    A propósito, esta función SOLO muestrea la curva — no decide si hay
    salto, discontinuidad removible o asíntota. Esa clasificación ya la
    hace continuity_engine (con Limit().doit(), que maneja división por
    cero e infinito correctamente); repetirla aquí evaluando la fórmula
    punto por punto reintroduciría el mismo tipo de bug que ya
    corregimos antes (ver WORKFLOW.md, sección 6) — un valor zoo o
    complejo que esta capa barata no sabe interpretar. Por eso
    main.py combina esta curva con el resultado de continuity_engine
    en vez de que este módulo intente evaluar el punto crítico por su
    cuenta.

    Convención, igual que en la guía (Figura 16): la rama izquierda se
    muestrea en [x_min, point) — abierta, sin tocar el punto — y la
    derecha en [point, x_max] — cerrada. Es la misma convención "x < c"
    / "x >= c" de los ejercicios 1, 3 y 5.
    """
    if point is None:
        raise ValueError("Se necesita un punto crítico para graficar.")

    if x_min is None:
        x_min = point - 5
    if x_max is None:
        x_max = point + 5

    _, left_fn = _safe_lambdify(left_expr)
    _, right_fn = _safe_lambdify(right_expr)

    left_points = _sample_branch(left_fn, x_min, point, steps, include_hi=False)
    right_points = _sample_branch(right_fn, point, x_max, steps, include_hi=True)

    return {
        "point": point,
        "x_min": x_min,
        "x_max": x_max,
        "left_points": left_points,
        "right_points": right_points,
    }