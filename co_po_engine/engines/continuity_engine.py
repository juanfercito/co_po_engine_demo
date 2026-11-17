# engines/continuity_engine.py
"""
Motor de continuidad — dos enfoques que se complementan:

  * analyze_continuity_symbolic: usa sympy para calcular límites de forma
    exacta (simbólica). Preciso, no aproxima, pero exige que la expresión
    tenga una forma cerrada evaluable en el punto.
  * analyze_continuity_numeric: evalúa f(x0 - eps) y f(x0 + eps) con
    aritmética flotante. Funciona siempre, incluso sin forma simbólica
    cómoda, pero es una ESTIMACIÓN, no un resultado exacto.

Es la versión documentada y extendida del engine.py original del
proyecto CO-API.
"""

import re

from sympy import Limit, Pow, Symbol, fraction, oo, sympify, together, zoo
from sympy.core.sympify import SympifyError

X = Symbol("x")

# ---------------------------------------------------------------------
# Las 3 leyes de dominio que el engine.py original NO validaba (ver
# WORKFLOW.md, sección "Lecciones del motor original"). Se comprueban
# ANTES de pedirle un límite a sympy, para que el problema se reporte
# como una advertencia de dominio clara en vez de como un valor
# simbólico sin convertir (zoo, nan, un número complejo) que rompa la
# salida más adelante.
# ---------------------------------------------------------------------


def _domain_warnings(expr, point):
    """Detecta, para una expresión y un punto dados, las tres
    restricciones de dominio que más fácil se pasan por alto:
      1) división por cero
      2) raíz de índice par de un número negativo (no real)
      3) el punto evalúa directamente a infinito (oo/-oo/zoo)
    Devuelve una lista de strings legibles; vacía si no hay problema.
    """
    warnings = []

    # 1) división por cero: separa numerador/denominador y evalúa el denominador en el punto
    try:
        _, denom = fraction(together(expr))
        if denom != 1:
            dval = denom.subs(X, point)
            if dval == 0:
                warnings.append(
                    f"División por cero: el denominador se anula en x={point}. "
                    "La expresión no está definida ahí (dominio restringido)."
                )
    except Exception:
        pass

    # 2) raíz de índice par de un número negativo (p. ej. sqrt(x) con x<0)
    try:
        for power_expr in expr.atoms(Pow):
            base, exp = power_expr.as_base_exp()
            if getattr(exp, "is_Rational", False) and exp.q % 2 == 0:
                bval = base.subs(X, point)
                if getattr(bval, "is_real", True) and bval.is_real and bval < 0:
                    warnings.append(
                        f"Raíz de índice par de un número negativo en x={point} "
                        f"(base = {bval}): el resultado no es real en ese punto."
                    )
    except Exception:
        pass

    # 3) el punto mismo evalúa a infinito (más allá de que el límite diverja)
    try:
        val = expr.subs(X, point)
        if val in (oo, -oo, zoo):
            warnings.append(
                f"La expresión evalúa a infinito en x={point} (valor: {val}). "
                "Revisar si hay una asíntota o una división por cero oculta."
            )
    except Exception:
        pass

    return warnings


def _to_output_value(val):
    if val is oo:
        return "∞"
    if val is -oo:
        return "-∞"
    if val is zoo:
        return "∞ (complejo)"
    try:
        return float(val)
    except Exception:
        return str(val)


def _check_implicit_syntax(originals):
    implicit_errors = []
    for name, expr in originals.items():
        if re.search(r"(?<!\*)\b\d+\s*x\b|\bx\s*\d+\b(?!\*)", expr):
            implicit_errors.append(name)
    if implicit_errors:
        msgs = [
            f"Unrecognized symbols in function '{name}' ({originals[name]})"
            for name in implicit_errors
        ]
        raise ValueError("; ".join(msgs))


def _parse_three(function_left, function_center, function_right):
    originals = {"left": function_left, "center": function_center, "right": function_right}
    _check_implicit_syntax(originals)
    try:
        f_left = sympify(function_left)
        f_center = sympify(function_center)
        f_right = sympify(function_right)
    except SympifyError as err:
        raise ValueError(f"It was not possible to interpret the function: {err}") from err

    for name, f in (("left", f_left), ("center", f_center), ("right", f_right)):
        extras = f.free_symbols - {X}
        if extras:
            entry = originals[name]
            symbol_err = next(iter(extras))
            example = entry.replace(str(symbol_err), "x**2")
            raise ValueError(
                f"Unrecognized symbols in function '{name}' ({entry}): {symbol_err}. "
                f"Use only the variable 'x' and valid operations, e.g. '{example}'."
            )
    return f_left, f_center, f_right


def analyze_continuity_symbolic(function_left, function_center, function_right, point):
    """Límite exacto vía sympy (Limit().doit()) + continuidad de la derivada."""
    f_left, f_center, f_right = _parse_three(function_left, function_center, function_right)

    domain_warnings = (
        _domain_warnings(f_left, point)
        + _domain_warnings(f_center, point)
        + _domain_warnings(f_right, point)
    )
    # sin duplicados, conservando el orden
    domain_warnings = list(dict.fromkeys(domain_warnings))

    lim_left = Limit(f_left, X, point, dir="-").doit()
    val_center = f_center.subs(X, point)
    lim_right = Limit(f_right, X, point, dir="+").doit()

    if lim_left in (oo, -oo, zoo) or lim_right in (oo, -oo, zoo):
        return {
            "mode": "symbolic",
            "x": point,
            "f_x_left": _to_output_value(lim_left),
            "f_x": _to_output_value(val_center),
            "f_x_right": _to_output_value(lim_right),
            "is_continuous": False,
            "domain_warnings": domain_warnings,
            "detail": [
                f"Left limit: {lim_left}",
                f"Right limit: {lim_right}",
                "Asymptotic discontinuity: a limit diverges to infinity",
                *domain_warnings,
            ],
        }

    left_val = _to_output_value(lim_left)
    center_val = _to_output_value(val_center)
    right_val = _to_output_value(lim_right)
    is_continuous_fn = left_val == center_val == right_val

    detail = [
        f"Left limit at x→{point}⁻: {lim_left}",
        f"Value at point f({point}) = {val_center}",
        f"Right limit at x→{point}⁺: {lim_right}",
    ]

    try:
        df_left = f_left.diff(X)
        df_right = f_right.diff(X)
        lim_df_left = Limit(df_left, X, point, dir="-").doit()
        lim_df_right = Limit(df_right, X, point, dir="+").doit()
        detail.append(f"f'_left(x) = {df_left}  →  limit at x→{point}⁻: {lim_df_left}")
        detail.append(f"f'_right(x) = {df_right}  →  limit at x→{point}⁺: {lim_df_right}")
        deriv_cont = lim_df_left == lim_df_right
        detail.append("First derivative continuous at the point" if deriv_cont else "First derivative discontinuous at the point")
    except (SympifyError, AttributeError, TypeError) as err:
        detail.append(f"Could not evaluate derivative: {err}")

    detail.extend(domain_warnings)

    return {
        "mode": "symbolic",
        "x": point,
        "f_x_left": left_val,
        "f_x": center_val,
        "f_x_right": right_val,
        "is_continuous": is_continuous_fn,
        "domain_warnings": domain_warnings,
        "detail": detail,
    }


def analyze_continuity_numeric(function_left, function_center, function_right, point, eps=1e-5):
    """Aproximación numérica: evalúa f(x0 ± eps) con punto flotante. Útil
    como complemento cuando el enfoque simbólico no tiene forma cerrada
    cómoda cerca del punto (p. ej. funciones a trozos complicadas)."""
    f_left, f_center, f_right = _parse_three(function_left, function_center, function_right)

    domain_warnings = list(dict.fromkeys(
        _domain_warnings(f_left, point)
        + _domain_warnings(f_center, point)
        + _domain_warnings(f_right, point)
    ))

    try:
        left_val = float(f_left.subs(X, point - eps).evalf())
    except Exception as err:
        left_val = f"error: {err}"
    try:
        center_val = float(f_center.subs(X, point).evalf())
    except Exception as err:
        center_val = f"error: {err}"
    try:
        right_val = float(f_right.subs(X, point + eps).evalf())
    except Exception as err:
        right_val = f"error: {err}"

    def close(a, b):
        if isinstance(a, str) or isinstance(b, str):
            return False
        return abs(a - b) < 1e-3

    is_continuous = close(left_val, center_val) and close(center_val, right_val)

    return {
        "mode": "numeric",
        "x": point,
        "eps": eps,
        "f_x_left": left_val,
        "f_x": center_val,
        "f_x_right": right_val,
        "is_continuous": is_continuous,
        "domain_warnings": domain_warnings,
        "detail": [
            f"f(x0 - eps) ≈ {left_val}",
            f"f(x0) ≈ {center_val}",
            f"f(x0 + eps) ≈ {right_val}",
            "Estimación por epsilon — no es un resultado exacto.",
            *domain_warnings,
        ],
    }


def analyze_continuity(function_left, function_center, function_right, point, mode="symbolic"):
    """Punto de entrada único: elige el enfoque según `mode`."""
    if mode == "numeric":
        return analyze_continuity_numeric(function_left, function_center, function_right, point)
    return analyze_continuity_symbolic(function_left, function_center, function_right, point)
