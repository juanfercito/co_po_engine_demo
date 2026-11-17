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
"""

import math


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