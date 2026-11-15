#!/usr/bin/env python3
"""
Server locale per il progetto app_cammini.

Serve l'intera cartella del progetto e supporta le richieste "Range", necessarie
per leggere bmng/bmng.pmtiles. Il server standard "python -m http.server" non le
supporta e la mappa resterebbe senza satellite.

Il backoffice (un'altra porta dello stesso PC) può leggere i file del progetto. Il server non riceve
niente (niente POST): l'allineamento delle cartine si fa nel backoffice.

Uso, dalla cartella app_cammini:
    py strumenti\\server.py          -> http://localhost:8000/prototipo/cammino.html
    py strumenti\\server.py 8080     -> porta diversa
"""
import http.server
import os
import re
import sys
from functools import partial
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent  # cartella app_cammini


class GestoreConRange(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".geojson": "application/geo+json", ".pmtiles": "application/octet-stream",
                      ".js": "text/javascript"}

    def send_head(self):
        intervallo = self.headers.get("Range")
        percorso = self.translate_path(self.path)
        if not intervallo or not os.path.isfile(percorso):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", intervallo)
        if not m:
            return super().send_head()
        dimensione = os.path.getsize(percorso)
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

    def end_headers(self):
        # Pagina e dati cambiano spesso mentre si lavora: il browser deve ricontrollarli a ogni
        # caricamento (se non sono cambiati risponde 304, senza riscaricarli). Il satellite no.
        if not self.path.split("?")[0].endswith(".pmtiles"):
            self.send_header("Cache-Control", "no-cache")
        # il backoffice (un'altra porta dello stesso PC) può leggere i file del progetto
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, *args):
        pass  # niente righe di log per ogni tile


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    radice = RADICE
    gestore = partial(GestoreConRange, directory=str(radice))
    print(f"Prototipo:            http://localhost:{porta}/prototipo/cammino.html")
    print(f"Anteprima satellite:  http://localhost:{porta}/bmng/anteprima.html")
    print("Ctrl+C per fermare il server")
    http.server.ThreadingHTTPServer(("", porta), gestore).serve_forever()
