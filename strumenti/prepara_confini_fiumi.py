#!/usr/bin/env python3
"""
Rigenera prototipo/dati/confini.geojson e prototipo/dati/fiumi.geojson da Natural Earth.

Confini
- Sorgente: ne_10m_admin_0_countries_ita (Stati secondo il punto di vista ufficiale italiano).
- Si tengono solo i confini terrestri condivisi tra due Stati, a piena risoluzione (scala 1:10 milioni).
- I tratti che Natural Earth classifica come contesi, indefiniti, linee di controllo o non riconosciuti
  (con la classificazione italiana FCLASS_IT, se presente) ricevono c=1 e nella mappa sono puntinati.
- Terre che il punto di vista italiano non assegna a nessuno Stato (Golan, Abyei, triangolo di Ilemi…;
  dal file delle aree contese): se ne disegna il contorno verso gli Stati vicini, che altrimenti mancherebbe.
  Golan: la vecchia linea verso Israele e la linea del cessate il fuoco del 1974 (puntinata) verso la Siria.
- Gerusalemme: Natural Earth (in tutti i punti di vista europei) segue il confine municipale israeliano e
  mette Gerusalemme Est in Israele; per la posizione italiana il riferimento è la linea del 1949, che Natural
  Earth ha solo nel file del punto di vista palestinese: lì, e solo lì, si usa quella, puntinata.

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

from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

RADICE = Path(__file__).resolve().parent.parent
CACHE = RADICE / "strumenti" / "natural_earth"
USCITA = RADICE / "prototipo" / "dati"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
CLASSI_CONTESE = {"Disputed", "Indefinite", "Line of control", "Unrecognized"}
# dove la linea Israele-Palestina di Natural Earth segue il confine municipale israeliano di Gerusalemme
GERUSALEMME = box(35.125, 31.69, 35.30, 31.89)


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


def linee(g):
    return [p for p in getattr(g, "geoms", [g]) if p.geom_type in ("LineString", "MultiLineString")]


def confini():
    stati = [shape(f["geometry"]).buffer(0) for f in scarica("ne_10m_admin_0_countries_ita")]
    albero = STRtree(stati)
    tratti = []
    for i, g in enumerate(stati):
        for j in albero.query(g):
            if j <= i or not g.intersects(stati[j]):
                continue
            tratti += linee(g.boundary.intersection(stati[j].boundary))
    # terre di nessuno Stato (nel punto di vista italiano): il loro contorno verso gli Stati vicini
    for f in scarica("ne_10m_admin_0_disputed_areas"):
        area = shape(f["geometry"]).buffer(0)
        vicini = [stati[j] for j in albero.query(area)]
        if not vicini or sum(area.intersection(s).area for s in vicini) > 0.05 * area.area:
            continue  # è già (anche solo in parte, come certe isole) di uno Stato: niente contorni lungo le coste
        for s in vicini:
            tratti += linee(area.boundary.intersection(s.boundary))
    tutti = unary_union(tratti)

    # Gerusalemme: la linea del 1949 (dal punto di vista palestinese di Natural Earth) al posto di quella municipale
    pse = {f["properties"]["NAME"]: shape(f["geometry"]).buffer(0) for f in scarica("ne_10m_admin_0_countries_pse")
           if f["properties"]["NAME"] in ("Israel", "Palestine")}
    linea_1949 = pse["Israel"].boundary.intersection(pse["Palestine"].boundary).intersection(GERUSALEMME)
    tutti = tutti.difference(GERUSALEMME)

    def classe(p):
        return (p.get("FCLASS_IT") or p["FEATURECLA"]).split(" (")[0]

    contese = [shape(f["geometry"]) for f in scarica("ne_10m_admin_0_boundary_lines_land")
               if classe(f["properties"]) in CLASSI_CONTESE]
    zona = unary_union(contese).buffer(0.02)
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"c": 0}, "geometry": arrotonda(tutti.difference(zona))},
        {"type": "Feature", "properties": {"c": 1}, "geometry": arrotonda(unary_union([tutti.intersection(zona), linea_1949]))},
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
