# Señal Viva — CO-PO Engine

Demo para la clase de cálculo diferencial. Toma unos cuantos números,
revisa si una función es continua en un punto (con cálculo simbólico
real, usando `sympy`), y muestra el resultado de dos formas: un panel
con gráficas, y una figura que "reacciona" a los datos — todo en el
navegador, corriendo desde tu propia computadora, sin internet.

## Por qué existe

Nace de un motor de continuidad que ya tenía hecho (`engine.py`,
incluido como referencia histórica en este repaso). La idea de esta
versión es mostrar tres cosas en una sola demo:

1. Que el mismo cálculo se puede verificar de dos formas que se
   complementan (simbólica exacta vs. numérica aproximada).
2. Que ese cálculo "cuesta" algo, y una vez hecho, se puede reutilizar
   para alimentar una visualización sin tener que recalcular nada
   pesado otra vez.
3. Que estas ideas de cálculo diferencial no son solo para pizarrón —
   aplican a telecomunicaciones, redes, y varios otros campos. Ver
   `WORKFLOW.md` para el detalle completo, con lenguaje simple.

## Cómo correrlo

```bash
cd co_po_engine
python3 -m venv .venv
source .venv/bin/activate      # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Abre **http://127.0.0.1:8000** en el navegador. `Ctrl+C` en la
terminal para detener el servidor. No necesitas internet para nada de
esto: ni las fuentes, ni las gráficas, ni la figura dependen de un
CDN — por eso es seguro mostrarlo compartiendo pantalla en Zoom aunque
el wifi del salón falle.

## Qué vas a ver

- **Panel**: entra tus valores, revisa el orden dinámico (n, L, L^n,
  su raíz n-ésima) y dos gráficas (crecimiento de la operación,
  atenuación tipo caída libre).
- **Continuidad**: escribe tres funciones (izquierda, centro, derecha)
  y un punto, elige modo simbólico o numérico, y evalúa.
- **Figura**: la misma evaluación de continuidad, dibujada como dos
  figuras reactivas — una abstracta (malla de alambre en pseudo-3D) y
  otra "simpática" (una criatura con ojos y boca). Verde y nítida si es
  continua; naranja, borrosa (como interferencia de señal) y con mueca
  si no lo es. El desenfoque y la sonrisa vienen del mismo número
  (`instability`), no son gestos sueltos.

## Estructura

```
co_po_engine/
├── main.py                        # servidor HTTP (solo stdlib) + rutas /api/*
├── requirements.txt                 # solo sympy
├── engines/
│   ├── continuity_engine.py        # continuidad: modo simbólico (sympy) y numérico (ε)
│   ├── polynomial_engine.py        # orden dinámico (L^n, raíz n-ésima, atenuación)
│   └── visual_engine.py            # NO vuelve a calcular nada — reduce los resultados
│                                     # de los dos motores anteriores a un estado visual barato
└── static/
    ├── index.html
    ├── style.css                    # tipografía del sistema, sin fuentes externas
    └── app.js                       # fetch() a los endpoints /api/*, dibuja todo en canvas
```

## Endpoints

| Método | Ruta              | Body                                                   |
|--------|-------------------|----------------------------------------------------------|
| POST   | `/api/continuity` | `{left, center, right, point, mode}`                        |
| POST   | `/api/order`      | `{values}`                                                   |
| POST   | `/api/polynomial` | `{values, point, mode}`                                      |
| POST   | `/api/visual`     | `{values, left, center, right, point, mode}` (combina todo) |

`mode` es `"symbolic"` o `"numeric"`. Para el detalle de qué hace cada
motor y por qué el resultado se ve como se ve, lee **WORKFLOW.md**.
