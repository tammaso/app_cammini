#!/usr/bin/env python3
"""
Rigenera prototipo/dati/confini.geojson e prototipo/dati/fiumi.geojson da Natural Earth.

Confini
- Sorgente: ne_10m_admin_0_countries_ita (Stati secondo il punto di vista ufficiale italiano).
- Si tengono solo i confini terrestri condivisi tra due Stati, a piena risoluzione (scala 1:10 milioni).
- I tratti che Natural Earth classifica come contesi, indefiniti, linee di controllo o non riconosciuti
  (con la classificazione italiana FCLASS_IT, se presente) ricevono c=1 e nella mappa sono puntinati.

Fiumi
- Sorgente: ne_10m_rivers_lake_centerlines, solo featurecla = "River" (le linee dentro i laghi sono escluse,
  perché i laghi si vedono già sul satellite).
- Proprietà: s = importanza (scalerank), da = zoom da cui mostrarlo (min_zoom di Natural Earth anticipato di 2,5).

Uso:  py strumenti\\prepara_confini_fiumi.py
Richiede: pip install shapely
"""
import json
import urllib.request
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

RADICE = Path(__file__).resolve().parent.parent
CACHE = RADICE / "strumenti" / "natural_earth"
USCITA = RADICE / "prototipo" / "dati"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
CLASSI_CONTESE = {"Disputed", "Indefinite", "Line of control", "Unrecognized"}


def scarica(nome):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{nome}.geojson"
    if not f.exists():
        print("scarico", nome)
        urllib.request.urlretrieve(BASE + f.name, f)
    return json.loads(f.read_text(encoding="utf-8"))["features"]


def arrotonda(geom, nd=4):
    m = mapping(geom)

    def r(x):
        if isinstance(x, (list, tuple)) and x and isinstance(x[0], (int, float)):
            return [round(x[0], nd), round(x[1], nd)]
        return [r(y) for y in x]

    m["coordinates"] = r(m["coordinates"])
    return m


def confini():
    stati = [shape(f["geometry"]).buffer(0) for f in scarica("ne_10m_admin_0_countries_ita")]
    albero = STRtree(stati)
    tratti = []
    for i, g in enumerate(stati):
        for j in albero.query(g):
            if j <= i or not g.intersects(stati[j]):
                continue
            inter = g.boundary.intersection(stati[j].boundary)
            tratti += [p for p in getattr(inter, "geoms", [inter]) if p.geom_type in ("LineString", "MultiLineString")]
    tutti = unary_union(tratti)

    def classe(p):
        return (p.get("FCLASS_IT") or p["FEATURECLA"]).split(" (")[0]

    contese = [shape(f["geometry"]) for f in scarica("ne_10m_admin_0_boundary_lines_land")
               if classe(f["properties"]) in CLASSI_CONTESE]
    zona = unary_union(contese).buffer(0.02)
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"c": 0}, "geometry": arrotonda(tutti.difference(zona))},
        {"type": "Feature", "properties": {"c": 1}, "geometry": arrotonda(tutti.intersection(zona))},
    ]}
    (USCITA / "confini.geojson").write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    print("confini.geojson scritto")


def fiumi():
    out = []
    for f in scarica("ne_10m_rivers_lake_centerlines"):
        p = f["properties"]
        if p.get("featurecla") != "River":
            continue
        da = max(0.0, round(float(p.get("min_zoom") or 6) - 2.5, 1))
        out.append({"type": "Feature", "properties": {"s": p.get("scalerank"), "da": da},
                    "geometry": arrotonda(shape(f["geometry"]))})
    fc = {"type": "FeatureCollection", "features": out}
    (USCITA / "fiumi.geojson").write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    print(f"fiumi.geojson scritto ({len(out)} tratti)")


if __name__ == "__main__":
    USCITA.mkdir(parents=True, exist_ok=True)
    confini()
    fiumi()
