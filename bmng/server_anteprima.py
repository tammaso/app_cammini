#!/usr/bin/env python3
"""
Piccolo server locale per aprire anteprima.html.

Serve la cartella in cui si trova (o quella indicata) e supporta le richieste
"Range", necessarie per leggere i file .pmtiles. Il server standard
"python -m http.server" non le supporta, e con lui la mappa resterebbe vuota.

Uso:
    py server_anteprima.py            -> http://localhost:8000/anteprima.html
    py server_anteprima.py 8080       -> porta diversa
"""
import http.server
import os
import re
import sys
from functools import partial
from pathlib import Path


class GestoreConRange(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        intervallo = self.headers.get("Range")
        percorso = self.translate_path(self.path)
        if not intervallo or not os.path.isfile(percorso):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", intervallo)
        dimensione = os.path.getsize(percorso)
        if not m:
            return super().send_head()
        inizio, fine = m.groups()
        if inizio == "":  # ultimi N byte
            inizio, fine = dimensione - int(fine), dimensione - 1
        else:
            inizio, fine = int(inizio), int(fine) if fine else dimensione - 1
        fine = min(fine, dimensione - 1)
        if inizio > fine:
            self.send_error(416, "Intervallo non valido")
            return None
        with open(percorso, "rb") as f:
            f.seek(inizio)
            dati = f.read(fine - inizio + 1)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(percorso))
        self.send_header("Content-Range", f"bytes {inizio}-{fine}/{dimensione}")
        self.send_header("Content-Length", str(len(dati)))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self.wfile.write(dati)
        return None

    def log_message(self, *args):
        pass  # niente righe di log per ogni tile


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    cartella = Path(__file__).resolve().parent
    gestore = partial(GestoreConRange, directory=str(cartella))
    print(f"Prototipo del cammino: http://localhost:{porta}/cammino.html")
    print(f"Anteprima delle tile:  http://localhost:{porta}/anteprima.html")
    print("Ctrl+C per fermare il server")
    http.server.ThreadingHTTPServer(("", porta), gestore).serve_forever()
