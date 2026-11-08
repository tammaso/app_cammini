#!/usr/bin/env python3
"""
Solo per le prove: converte la cartina vettoriale del volume (Mezzal-e-perc-Abramo_mod.ai) in SVG,
al posto dell'SVG che consegnerà il cartografo. Scrive prototipo/cartine/mezzaluna_1700ac.svg, che la
pagina prototipo/allinea.html usa per provare la georeferenziazione assistita.

L'SVG esportato da Illustrator sarà diverso nei dettagli (colori in classi CSS, livelli con nome),
ma simile nella sostanza: tracciati con trasformazioni, ritagli, testi spezzati in pezzi.

Uso:  py strumenti\\cartina_in_svg.py
Richiede: pip install pymupdf
"""
from pathlib import Path

import fitz

RADICE = Path(__file__).resolve().parent.parent
CARTINA = RADICE / "Mezzal-e-perc-Abramo_mod.ai"
USCITA = RADICE / "prototipo" / "cartine" / "mezzaluna_1700ac.svg"


def main():
    pagina = fitz.open(CARTINA)[0]
    # i testi restano testi, come chiederemo al cartografo
    svg = pagina.get_svg_image(text_as_path=False)
    USCITA.parent.mkdir(parents=True, exist_ok=True)
    USCITA.write_text(svg, encoding="utf-8")
    print(f"{USCITA.relative_to(RADICE)} scritto ({USCITA.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
