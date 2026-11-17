# main.py — punto de entrada único: `python main.py`
"""
Servidor local para CO-PO Engine / Señal Viva. Usa solo la librería
estándar de Python (http.server) más sympy — nada de Flask, nada de
three.js ni CDNs. Así todo corre 100% local y offline: ideal para
mostrarlo por Zoom sin depender de que el wifi del salón aguante.

Endpoints:
  GET  /                   -> static/index.html
  GET  /static/<archivo>   -> CSS / JS
  POST /api/continuity     -> {left, center, right, point, mode}      -> dict
  POST /api/order          -> {values}                                 -> dict
  POST /api/polynomial     -> {values, point, mode}                    -> dict
  POST /api/visual         -> {values, left, center, right, point, mode}
                               -> combina los tres motores y devuelve
                                  el estado visual listo para dibujar
"""

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from engines import continuity_engine, polynomial_engine, visual_engine

HOST = "127.0.0.1"
PORT = 8000
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


class Handler(BaseHTTPRequestHandler):
    # --- helpers -----------------------------------------------------
    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path):
        if not os.path.isfile(path):
            self._send_json({"error": "not found"}, status=404)
            return
        ctype, _ = mimetypes.guess_type(path)
        with open(path, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def log_message(self, fmt, *args):
        print("  %s - %s" % (self.address_string(), fmt % args))

    # --- routing -------------------------------------------------------
    def do_GET(self):
        if self.path in ("/", ""):
            self._send_file(os.path.join(STATIC_DIR, "index.html"))
        elif self.path.startswith("/static/"):
            rel = self.path[len("/static/"):]
            self._send_file(os.path.join(STATIC_DIR, rel))
        else:
            self._send_json({"error": "not found"}, status=404)

    def do_POST(self):
        try:
            data = self._read_json_body()
        except Exception as err:
            self._send_json({"error": f"JSON inválido: {err}"}, status=400)
            return

        try:
            if self.path == "/api/continuity":
                result = continuity_engine.analyze_continuity(
                    data["left"], data["center"], data["right"],
                    float(data["point"]), mode=data.get("mode", "symbolic"),
                )
                self._send_json(result)

            elif self.path == "/api/order":
                values = [float(v) for v in data["values"]]
                result = polynomial_engine.free_fall_series(values)
                self._send_json(result)

            elif self.path == "/api/polynomial":
                values = [float(v) for v in data["values"]]
                point = float(data.get("point", 0))
                result = polynomial_engine.analyze_polynomial(
                    values, point, mode=data.get("mode", "symbolic")
                )
                self._send_json(result)

            elif self.path == "/api/visual":
                values = [float(v) for v in data["values"]]
                order_result = polynomial_engine.dynamic_order(values)

                continuity_result = None
                if data.get("left") and data.get("center") and data.get("right") and data.get("point") not in (None, ""):
                    try:
                        continuity_result = continuity_engine.analyze_continuity(
                            data["left"], data["center"], data["right"],
                            float(data["point"]), mode=data.get("mode", "symbolic"),
                        )
                    except ValueError:
                        continuity_result = None  # entrada inválida -> usa el respaldo de varianza

                state = visual_engine.derive_visual_state(
                    order_result, continuity_result=continuity_result, raw_values=values
                )
                self._send_json(state)

            else:
                self._send_json({"error": "ruta no encontrada"}, status=404)

        except (KeyError, ValueError) as err:
            self._send_json({"error": str(err)}, status=400)
        except Exception as err:
            self._send_json({"error": f"error interno: {err}"}, status=500)


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"CO-PO Engine / Señal Viva corriendo en http://{HOST}:{PORT}  (Ctrl+C para detener)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()


if __name__ == "__main__":
    main()
