# engines/polynomial_engine.py
"""
Motor de orden dinámico ("co-po"): el orden n de la operación se infiere
del número de valores de entrada (2 valores -> n=2, 5 valores -> n=5...).
Calcula L^n y su inversa (raíz n-ésima), y genera los puntos de una
simulación de "caída libre / atenuación" d(t) = L * t^n para graficar.

También construye un polinomio real a partir de los valores de entrada
(como coeficientes) y reutiliza continuity_engine para verificar su
continuidad — así los motores comparten datos en vez de ser piezas
aisladas.
"""

from sympy import Symbol

from . import continuity_engine

X = Symbol("x")


def dynamic_order(values):
    """n = número de valores de entrada. L = magnitud promedio."""
    if not values:
        raise ValueError("Se necesita al menos un valor de entrada.")
    n = len(values)
    L = sum(abs(v) for v in values) / n
    L = L or 1.0
    power = L ** n
    root = L ** (1 / n)
    return {"n": n, "L": L, "power": power, "root": root}


def free_fall_series(values, steps=40, t_max=1.6):
    """Puntos (t, d) de d(t) = L * t^n, para graficar la atenuación."""
    order = dynamic_order(values)
    n, L = order["n"], order["L"]
    series = []
    for i in range(steps + 1):
        t = (i / steps) * t_max
        d = L * (t ** n)
        series.append({"t": round(t, 4), "d": d})
    return {**order, "series": series}


def build_polynomial_from_values(values):
    """Construye sum(v_i * x^i) con los valores de entrada como
    coeficientes (v0 + v1*x + v2*x^2 + ...)."""
    if not values:
        raise ValueError("Se necesita al menos un valor de entrada.")
    return sum(v * X ** i for i, v in enumerate(values))


def analyze_polynomial(values, point, mode="symbolic"):
    """Evalúa el polinomio construido a partir de `values` en `point`,
    calcula su derivada, y pide a continuity_engine que confirme
    continuidad (todo polinomio es continuo; esto demuestra que los
    motores comparten datos en vez de operar aislados)."""
    expr = build_polynomial_from_values(values)
    expr_str = str(expr)
    derivative = str(expr.diff(X))
    value_at_point = float(expr.subs(X, point).evalf())

    continuity = continuity_engine.analyze_continuity(expr_str, expr_str, expr_str, point, mode=mode)
    order = dynamic_order(values)

    return {
        "polynomial": expr_str,
        "derivative": derivative,
        "value_at_point": value_at_point,
        "continuity": continuity,
        "order": order,
    }
