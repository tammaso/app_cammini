#!/usr/bin/env python3
"""
Ricava poligoni georeferenziati dalle aree colorate di una cartina del volume (PSD, PNG o JPG).

Come funziona
1. Georeferenziazione: un file JSON di punti di controllo associa posizioni in pixel della cartina
   a coordinate reali (città, foci, capi). Una trasformazione "thin plate spline" porta ogni pixel
   alle sue coordinate. Con la cartina Mezzal.psd lo scarto medio è di circa 25-30 km.
2. Estrazione: le cartine usano colori piatti; per ogni classe di colore si crea una maschera,
   si chiudono i buchi lasciati da testi, fiumi e linee, si ricavano i contorni e li si semplifica.
3. Il risultato è un GeoJSON con una feature per classe, da rifinire in QGIS se serve
   (ritaglio sulla costa, separazione di aree con lo stesso colore ma significato diverso).

Uso:
    py strumenti\\estrai_regni_da_cartina.py Mezzal.psd strumenti\\mezzal_punti_controllo.json regni.geojson

Formato dei punti di controllo (lista): [nome, x_pixel, y_pixel, latitudine, longitudine, ...]
Le classi di colore sono in CLASSI qui sotto (valori RGB letti dalla cartina).

Richiede: pip install psd-tools pillow numpy scipy scikit-image
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.interpolate import RBFInterpolator
from skimage import measure

# Colori della cartina Mezzal.psd (RGB) -> classe. Per un'altra cartina vanno riletti i colori.
CLASSI = {
    "mari": [(254, 235, 179)],
    "babilonia": [(251, 214, 167), (254, 235, 179)],
    "assiria": [(247, 186, 112)],
    "egitto": [(188, 221, 173), (133, 200, 117)],
    "ittiti": [(208, 227, 112)],
}
# Colori di testi, fiumi e linee che attraversano le aree e vanno "riassorbiti"
DISTURBI = [((161, 76, 13), 40), ((0, 141, 180), 40), ((0, 127, 179), 40), ((0, 155, 217), 40), ((114, 189, 226), 30)]
AREA_MINIMA = 1500  # pixel: le macchie più piccole si scartano


def apri(percorso):
    if percorso.lower().endswith(".psd"):
        from psd_tools import PSDImage
        return PSDImage.open(percorso).composite().convert("RGB")
    return Image.open(percorso).convert("RGB")


def main(cartina, punti, uscita):
    im = np.asarray(apri(cartina)).astype(int)
    H, W, _ = im.shape

    def colore(c, tol=12):
        return np.abs(im - np.array(c)).sum(-1) <= tol

    disturbo = im.sum(-1) < 200  # testi neri
    for c, tol in DISTURBI:
        disturbo |= colore(c, tol)

    gcp = json.load(open(punti, encoding="utf-8"))
    px = np.array([[p[1], p[2]] for p in gcp])
    ll = np.array([[p[4], p[3]] for p in gcp])
    a_coordinate = RBFInterpolator(px, ll, kernel="thin_plate_spline", smoothing=0.5)

    features = []
    for nome, colori in CLASSI.items():
        maschera = np.zeros((H, W), bool)
        for c in colori:
            maschera |= colore(c)
        piena = maschera | (disturbo & ndi.binary_dilation(maschera, iterations=8))
        piena = ndi.binary_fill_holes(ndi.binary_closing(piena, structure=np.ones((3, 3)), iterations=5))
        etichette, n = ndi.label(piena)
        dimensioni = ndi.sum(piena, etichette, range(1, n + 1))
        tieni = np.isin(etichette, [i + 1 for i, s in enumerate(dimensioni) if s >= AREA_MINIMA])
        anelli = []
        for c in measure.find_contours(np.pad(tieni, 1).astype(float), 0.5):
            if len(c) < 20:
                continue
            c = measure.approximate_polygon(c, 1.2) - 1
            lonlat = a_coordinate(np.c_[c[:, 1], c[:, 0]])
            anello = [[round(a, 4), round(b, 4)] for a, b in lonlat]
            anello.append(anello[0])
            anelli.append([anello])
        features.append({"type": "Feature", "properties": {"classe": nome},
                         "geometry": {"type": "MultiPolygon", "coordinates": anelli}})
        print(f"{nome}: {len(anelli)} poligoni")
    json.dump({"type": "FeatureCollection", "features": features}, open(uscita, "w", encoding="utf-8"))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
