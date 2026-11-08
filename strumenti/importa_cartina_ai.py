#!/usr/bin/env python3
"""
SUPERATO (2026-11-08): le cartine si importano ora nel backoffice, dal file SVG del cartografo
(Cammini → la cartina → Importa e classifica, Allinea), con la stessa deformazione e le stesse regole.
Questo script resta come riferimento: ha prodotto la prima cartina del 1700 a.C. dal file .ai, e il
suo risultato (strumenti/importazioni/) non lo legge più nessuno.

Importa la cartina vettoriale del volume (Mezzal-e-perc-Abramo_mod.ai): tutto ciò che la cartina
disegna sopra la geografia, cioè regni del 1700 a.C. con i loro colori, arco della Mezzaluna fertile,
antica linea di costa, percorso di Abramo con le sue frecce e tutti i nomi (con sottotitoli e
inclinazione), georeferenziati. Scrive strumenti/importazioni/abramo_1700ac.json: la cartina nel
formato di condiviso/cammino.ts (stili, elementi, nomi, alone), il tracciato di ogni tappa, le frecce e
gli spilli. Poi «npm run importa-cartina -- abramo 1700ac --pubblica» la porta nel database del
backoffice (sostituendo solo ciò che era stato importato) e aggiorna il portale; il pulsante
«Aggiorna la cartina del portale» di prototipo/allinea.html fa tutte e due le cose.
Fondo, mari, fiumi, laghi e isole della cartina non si importano: nella pagina ci sono già il satellite
e i fiumi di Natural Earth, che sono al posto giusto (il disegno se ne scosta di ~35 km).

Come funziona
1. Il file .ai di Illustrator è anche un PDF: PyMuPDF ne legge i tracciati (aree, linee, pallini).
   Non serve estrarre le aree dai colori, come si faceva con Mezzal.psd.
2. Georeferenziazione: con gli spilli fissati dal redattore in prototipo/allinea.html, salvati in
   prototipo/cartine/mezzaluna_1700ac.punti.json (punto del foglio -> punto del globo, con la
   certezza). La trasformazione è la stessa che si vede in allinea.html: "thin plate spline" in
   longitudine e latitudine di Mercatore; uno spillo certo fissa il disegno lì, uno probabile o
   ipotetico cede in parte (CEDE). Lo scarto della cartina rispetto al vero (in media ~24 km, dovuto
   al disegno) si distribuisce così tra gli spilli. Le città si scrivono nella loro posizione: quella
   dello spillo, se c'è, altrimenti quella dell'anagrafe (prototipo/dati/luoghi.js).
3. Nella cartina i mari sono disegnati sopra i regni, che quindi "debordano" in mare: i poligoni si
   ritagliano sulle terre emerse di Natural Earth, e le coste sono quelle vere.

Cosa c'è nella cartina (verificato aprendo il file)
- I colori più chiari che si vedono dentro la Mezzaluna sono gli stessi tracciati ritagliati
  sull'arco: si importano una volta sola.
- L'Assiria non è un'area a sé: è la parte settentrionale dell'Impero babilonese, con il suo nome.
- Egitto e Canaan sono un unico tracciato.
- Il regno di Mari è un'area a sé, dentro l'impero, in giallo pieno: la legenda della cartina dice
  "Regno di Mari conquistato da Hammurabi nel 1700 a.C. circa".
- L'arco della Mezzaluna è un velo bianco (~37%) con il contorno blu: dentro l'arco tutti i colori,
  mare compreso, sono più chiari. Nella cartina non ha un nome.

Uso:  py strumenti\\importa_cartina_ai.py
Richiede: pip install pymupdf shapely scipy numpy
"""
import json
import re
import sys
from pathlib import Path

import fitz
import numpy as np
from scipy.interpolate import RBFInterpolator
from shapely.geometry import LineString, MultiLineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

from prepara_confini_fiumi import scarica

RADICE = Path(__file__).resolve().parent.parent
CARTINA = RADICE / "Mezzal-e-perc-Abramo_mod.ai"
# Il risultato va al backoffice (npm run importa-cartina), che lo mette nel database e pubblica il portale
CAMMINO, EPOCA, PULSANTE, ANNO = "abramo", "1700ac", "1700 a.C.", -1700
USCITA = RADICE / "strumenti" / "importazioni" / f"{CAMMINO}_{EPOCA}.json"
# Le voci della legenda della cartina, parola per parola
LEGENDA = {"mari": "Regno di Mari conquistato da Hammurabi nel 1700 a.C. circa", "capitale": "Capitali"}
# Gli spilli di prototipo/allinea.html (le coordinate sul foglio sono quelle dell'SVG ricavato da questo
# stesso file con cartina_in_svg.py, uguali a quelle che PyMuPDF dà ai tracciati) e l'anagrafe dei luoghi
PUNTI = RADICE / "prototipo" / "cartine" / "mezzaluna_1700ac.punti.json"
ANAGRAFE = RADICE / "prototipo" / "dati" / "luoghi.js"
# Quanto cede uno spillo incerto verso dove lo vorrebbe il disegno: uguale ad allinea.html
CEDE = {"certa": 0, "probabile": 0.35, "ipotetica": 0.7}

# Tracciati della cartina (numero d'ordine "seqno" di PyMuPDF) e loro significato.
# I colori dei regni si leggono dalla cartina stessa.
REGNI = {  # seqno -> (id, nome)
    3: ("babilonia", "Impero babilonese antico"),
    5: ("mari", "Regno di Mari"),
    7: ("ittiti", "Antico regno ittita"),
    9: ("egitto", "Regno d'Egitto"),
}
MEZZALUNA = 38  # arco della Mezzaluna fertile (riempimento; il contorno blu, 64, ha la stessa forma)
COSTA_ANTICA = 135  # linea a puntini vicino a Ur: la costa del Golfo Persico allora
PERCORSO = 72  # itinerario di Abramo (linea marrone)
FRECCE = [66, 68, 70]  # punte di freccia marroni sul percorso (verso del viaggio)
# Distanze in gradi dai dati della cartina dei veli che scuriscono il resto del mondo nel 1700 a.C.
ALONE = [round(0.6 + 0.35 * i, 2) for i in range(16)]  # da 0,6 a 5,85 gradi

# Tutti i nomi scritti sulla cartina, tranne i mari che la pagina scrive già in ogni epoca
# (Mar Mediterraneo, Mar Caspio, Golfo Persico) e le città, più sotto.
# (tipo, nome nella pagina, testo nella cartina, sottotitolo nella pagina, testo del sottotitolo nella
# cartina). Il testo si cerca tra quelli della cartina, anche quando è scritto lettera per lettera
# (CANAAN, PADDAN-ARAM); posizione e inclinazione vengono da lì. "\n" va a capo come nella cartina.
NOMI_DALLA_CARTINA = [
    ("regno", "Antico regno ittita", "ANTICO REGNO ITTITA", None, None),
    ("regno", "Impero babilonese antico", "IMPERO BABILONESE ANTICO", "Sotto Hammurabi 1700 a.C.", "Sotto Hammurabi 1700 a. C."),
    ("regno", "Regno\nd'Egitto", "REGNO D’EGITTO", "12ª dinastia\n2000-1778 a.C.", "12ª dinastia 2000-1778 a.C."),
    ("regno", "Assiria", "ASSIRIA", None, None),
    ("regno", "Urriti", "URRITI", None, None),
    ("regione-antica", "Paddan-Aram", "PADDAN-ARAM", None, None),
    ("regione-antica", "Canaan", "CANAAN", None, None),
    ("regione-antica", "Siria", "SIRIA", None, None),
    ("regione-antica", "Babilonia", "BABILONIA", None, None),
    ("regione-antica", "Sumer", "SUMER", None, None),
    ("regione-antica", "Elam", "ELAM", None, None),
    # geografia fisica (in tondo, in ogni epoca)
    ("regione", "Penisola\ndel Sinai", "PENISOLA DEL SINAI", None, None),
    ("mare", "Mar Morto", "Mar Morto", None, None),
    # solo nel 1700 a.C.: in "Oggi" la pagina scrive già i fiumi (altrove) e il nome dello Stato di Cipro
    ("fiume", "Eufrate", "Eufrate", None, None),
    ("fiume", "Tigri", "Tigri", None, None),
    ("fiume", "Nilo", "Nilo", None, None),
    ("isola", "Cipro", "Cipro", None, None),
]
# Città antiche della cartina, nella loro posizione reale (nomi dell'anagrafe). Le capitali hanno il
# pallino rosso. Le città che sono tappe del cammino (Carran, Sichem, Betel, Mamre, Bersabea, Ur) hanno
# già il pin.
CAPITALI_ANTICHE = ["Menfi", "Mari", "Babilonia"]
CITTA_ANTICHE = ["Zoan", "Assur", "Ninive", "Susa", "Palmira", "Damasco", "Biblos", "Sidone", "Gerusalemme"]
# Vette (triangolo giallo): luogo dell'anagrafe -> nome come nella cartina
NOMI_VETTE = {"Monte Ararat": "M.te Ararat", "Monte Sinai": "M.te Sinai"}
# Zoom da cui compaiono, come per i nomi di oggi: quasi tutti già nella panoramica del cammino
ZOOM = {"regno": 2.5, "regione-antica": 3.4, "capitale-antica": 3.2, "citta-antica": 3.8,
        "regione": 3.8, "mare": 4.4, "fiume": 3.4, "isola": 3.2, "vetta": 3.8}


merc = lambda lat: np.degrees(np.log(np.tan(np.pi / 4 + np.radians(lat) / 2)))  # latitudine di Mercatore
da_merc = lambda y: np.degrees(2 * np.arctan(np.exp(np.radians(y))) - np.pi / 2)
km = lambda a, b: 12742 * np.arcsin(np.sqrt(np.sin(np.radians(b[1] - a[1]) / 2) ** 2 + np.cos(np.radians(a[1]))
                                            * np.cos(np.radians(b[1])) * np.sin(np.radians(b[0] - a[0]) / 2) ** 2))
tps_esatta = lambda foglio, mete: RBFInterpolator(foglio, mete, kernel="thin_plate_spline")


def leggi_luoghi():
    """L'anagrafe dei luoghi di prova: nome -> luogo (dopo «const LUOGHI =» il file è JSON)."""
    m = re.search(r"const LUOGHI = (\[.*\]);", ANAGRAFE.read_text(encoding="utf-8"), re.S)
    return {l["nome"]: l for l in json.loads(m.group(1))}


def deformazione(punti):
    """Dal foglio (punti PDF) alla carta (longitudine, latitudine): la stessa di allinea.html.

    Thin plate spline in longitudine e latitudine di Mercatore. Il punto del disegno di uno spillo certo
    va esattamente sul suo luogo; quello di uno spillo probabile o ipotetico va solo in parte verso il
    luogo e per il resto (CEDE) dove lo metterebbero gli altri spilli."""
    foglio = np.array([[p["sx"], p["sy"]] for p in punti], float)
    vero = np.array([[p["lng"], merc(p["lat"])] for p in punti], float)
    mete = vero.copy()
    if len(punti) >= 4:
        for i, p in enumerate(punti):
            cede = CEDE.get(p.get("certezza"), 0)
            if cede:
                altri = np.arange(len(punti)) != i
                previsto = tps_esatta(foglio[altri], vero[altri])(foglio[i:i + 1])[0]
                mete[i] = vero[i] + (previsto - vero[i]) * cede
    f = tps_esatta(foglio, mete)

    def tps(xy):
        r = f(np.asarray(xy, float))
        return np.column_stack([r[:, 0], da_merc(r[:, 1])])
    return tps


def georeferenziazione(luoghi):
    """Gli spilli di allinea.html: la deformazione, la posizione di ogni luogo e un resoconto."""
    if not PUNTI.exists():
        sys.exit(f"Manca {PUNTI.relative_to(RADICE)}: apri prototipo/allinea.html (con strumenti\\server.py) "
                 "e premi «Aggiorna la cartina del portale».")
    punti = json.loads(PUNTI.read_text(encoding="utf-8"))["punti"]
    if len(punti) < 3:
        sys.exit("Servono almeno 3 spilli.")
    tps = deformazione(punti)
    # la posizione di un luogo è quella del suo spillo, se c'è; altrimenti quella dell'anagrafe
    posizioni = {n: (l["lng"], l["lat"]) for n, l in luoghi.items()}
    resoconto = []
    for p in punti:
        if p.get("luogo"):
            if p["luogo"] not in luoghi:
                resoconto.append(f"  attenzione: «{p['luogo']}» non è nell'anagrafe")
            elif (d := km(posizioni[p["luogo"]], (p["lng"], p["lat"]))) > 1:
                resoconto.append(f"  attenzione: lo spillo di {p['luogo']} è a {d:.0f} km dal luogo dell'anagrafe "
                                 "(si usa lo spillo; se è giusto, va corretta l'anagrafe)")
            posizioni[p["luogo"]] = (p["lng"], p["lat"])
    # scarto di ogni spillo come in allinea.html: dove andrebbe il suo punto senza di lui
    if len(punti) >= 4:
        foglio = np.array([[p["sx"], p["sy"]] for p in punti], float)
        scarti = [km(deformazione(punti[:i] + punti[i + 1:])(foglio[i:i + 1])[0], (p["lng"], p["lat"]))
                  for i, p in enumerate(punti)]
        resoconto.insert(0, f"  il disegno si discosta dal vero in media di {np.mean(scarti):.0f} km "
                            f"(al massimo {max(scarti):.0f} km, {punti[int(np.argmax(scarti))]['nome']})")
    incerti = [f"{p['nome']} ({p['certezza']}, {km(tps([(p['sx'], p['sy'])])[0], (p['lng'], p['lat'])):.1f} km)"
               for p in punti if CEDE.get(p.get("certezza"), 0)]
    if incerti:
        resoconto.append("  spilli che cedono, con la distanza tra luogo e punto del disegno: " + ", ".join(incerti))
    da_confermare = sum(p.get("stato") == "proposto" for p in punti)
    resoconto.insert(0, f"{len(punti)} spilli da {PUNTI.relative_to(RADICE).as_posix()}"
                        + (f", {da_confermare} ancora da confermare" if da_confermare else ""))
    return tps, posizioni, resoconto


def testi_della_cartina(pagina):
    """I pezzi di testo della cartina, nell'ordine del file: (testo, riquadro, direzione della riga)."""
    pezzi = []
    for b in pagina.get_text("dict")["blocks"]:
        for riga in b.get("lines", []):
            for sp in riga["spans"]:
                pezzi.append((sp["text"].replace("ﬁ", "fi"), fitz.Rect(sp["bbox"]), riga["dir"]))
    return pezzi


def trova_testo(pezzi, cercato):
    """Centro e inclinazione (gradi, in senso orario sulla pagina) di un testo della cartina.

    Il testo può essere spezzato in più pezzi consecutivi: righe diverse (REGNO / D'EGITTO) o lettere
    scritte una per una lungo una curva (CANAAN). Spazi e maiuscole non contano nel confronto."""
    pulito = lambda s: "".join(s.split()).upper()
    obiettivo = pulito(cercato)
    for i in range(len(pezzi)):
        unito = ""
        for j in range(i, len(pezzi)):
            unito += pulito(pezzi[j][0])
            if not obiettivo.startswith(unito):
                break
            if unito == obiettivo:
                run = pezzi[i:j + 1]
                riquadro = fitz.Rect(run[0][1])
                for _, r, _ in run[1:]:
                    riquadro |= r
                centro = (riquadro.tl + riquadro.br) / 2
                inclinati = [d for _, _, d in run if abs(d[1]) > 0.05]
                if not inclinati:
                    angolo = 0.0
                elif len(run) == 1:
                    angolo = float(np.degrees(np.arctan2(run[0][2][1], run[0][2][0])))
                else:  # lettere lungo una curva: la corda dalla prima all'ultima
                    a, b = (run[0][1].tl + run[0][1].br) / 2, (run[-1][1].tl + run[-1][1].br) / 2
                    angolo = float(np.degrees(np.arctan2(b.y - a.y, b.x - a.x)))
                return riquadro, (centro.x, centro.y), angolo
    raise ValueError(f"testo non trovato nella cartina: {cercato}")


def angolo_sulla_carta(tps, xy, angolo):
    """Porta l'inclinazione di un testo dalla cartina alla carta (gradi in senso orario, con il nord in
    alto): si trasformano due punti lungo la riga e si misura la direzione in proiezione di Mercatore."""
    r = np.radians(angolo)
    a, b = tps(np.array([xy, (xy[0] + 10 * np.cos(r), xy[1] + 10 * np.sin(r))]))
    dx = (b[0] - a[0]) * np.cos(np.radians((a[1] + b[1]) / 2))
    return round(float(np.degrees(np.arctan2(-(b[1] - a[1]), dx))), 1)


def frecce(per_numero, tps):
    """Le punte di freccia del percorso: posizione e direzione (gradi dal nord, in senso orario).
    In ogni triangolo la punta è il vertice opposto al lato più corto."""
    uscita = []
    for numero in FRECCE:
        v = [np.array([it[1].x, it[1].y]) for it in per_numero[numero]["items"]]
        lati = [np.linalg.norm(v[(k + 1) % 3] - v[k]) for k in range(3)]
        k = int(np.argmin(lati))  # lato tra v[k] e v[k+1]
        base, punta = (v[k] + v[(k + 1) % 3]) / 2, v[(k + 2) % 3]
        centro = sum(v) / 3
        c, b, p = tps(np.array([centro, base, punta]))
        dlng = (p[0] - b[0]) * np.cos(np.radians(c[1]))
        rotazione = round(float(np.degrees(np.arctan2(dlng, p[1] - b[1]))), 1)
        uscita.append({"coordinate": [round(float(c[0]), 4), round(float(c[1]), 4)], "rotazione": rotazione})
    return uscita


def anelli(disegno, passo=1.5):
    """I segmenti del tracciato come liste di punti; curve e rette campionate ogni ~passo punti PDF."""
    tratti, attuale, ultimo = [], [], None
    for it in disegno["items"]:
        if it[0] == "l":
            a, b = it[1], it[2]
            n = max(1, int(abs(b - a) / passo))
            punti = [a + (b - a) * (k / n) for k in range(n + 1)]
        elif it[0] == "c":
            a, c1, c2, b = it[1:5]
            n = max(4, int((abs(c1 - a) + abs(c2 - c1) + abs(b - c2)) / passo))
            punti = []
            for k in range(n + 1):
                t = k / n
                punti.append(a * (1 - t) ** 3 + c1 * 3 * (1 - t) ** 2 * t + c2 * 3 * (1 - t) * t ** 2 + b * t ** 3)
        else:
            continue
        if ultimo is not None and abs(punti[0] - ultimo) > 0.01:
            tratti.append(attuale)
            attuale = []
        attuale += [(p.x, p.y) for p in punti]
        ultimo = punti[-1]
    tratti.append(attuale)
    return tratti


def raccorda(tratto, da, a, raggio=0.3):
    """Il tratto parte esattamente da `da` e arriva esattamente in `a`. Il punto della linea più vicino a
    una tappa non è proprio la tappa (di poco, o di qualche km se lo spillo è incerto e cede): lo
    scostamento si riassorbe dolcemente entro ~30 km (`raggio`, in gradi) dalle due estremità."""
    t = np.array(tratto, float)
    if len(t) < 2:
        return [list(da), list(a)]
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(t, axis=0).T))])
    r = min(raggio, s[-1] / 2) or 1
    dolce = lambda x: 1 - (lambda c: 3 * c ** 2 - 2 * c ** 3)(np.clip(x, 0, 1))  # 1 all'estremità, poi 0
    t += dolce(s / r)[:, None] * (np.array(da) - t[0]) + dolce((s[-1] - s) / r)[:, None] * (np.array(a) - t[-1])
    return [[round(float(x), 4), round(float(y), 4)] for x, y in t]


def tratti_del_cammino(pezzi, c):
    """Il percorso del volume, tagliato tappa per tappa nell'ordine del racconto (c: posizione dei luoghi).

    Nella cartina la linea è in quattro pezzi (tra un pezzo e l'altro ci sono le frecce):
    0. dal ritorno dall'Egitto a Bersabea, su per Canaan, Damasco, Palmira fino a Carran
    1. il giro intorno a Zoan, da ovest a est (il ritorno)
    2. da Bersabea verso Zoan (l'andata)
    3. da Carran giù lungo l'Eufrate fino a Ur
    Le tappe della pagina sono: Ur, Carran, Sichem, Betel, Egitto (Zoan), Ebron (Mamre), Bersabea.
    """
    def verso(punti, da, a):
        """Il tratto di una linea tra i punti più vicini alle due città, nel verso del viaggio."""
        vicino = lambda c: min(range(len(punti)), key=lambda i: (punti[i][0] - c[0]) ** 2 + (punti[i][1] - c[1]) ** 2)
        i, j = vicino(da), vicino(a)
        return punti[i:j + 1] if i <= j else punti[j:i + 1][::-1]

    canaan, zoan_ritorno, zoan_andata, eufrate = pezzi
    # dal nord al sud, nel verso del viaggio: Carran -> Palmira -> Damasco -> Canaan -> Bersabea
    nord_sud = canaan[::-1]
    andata_egitto = zoan_andata + zoan_ritorno  # da Bersabea fino a Zoan e ritorno, in un'unica linea
    tratti = [
        eufrate[::-1] + verso(nord_sud, nord_sud[0], c["Carran"]),  # Ur -> Carran
        verso(nord_sud, c["Carran"], c["Sichem"]),
        verso(nord_sud, c["Sichem"], c["Betel"]),
        verso(nord_sud, c["Betel"], c["Bersabea"]) + verso(andata_egitto, c["Bersabea"], c["Zoan"]),  # -> Egitto
        verso(andata_egitto, c["Zoan"], andata_egitto[-1]) + verso(canaan, canaan[0], c["Mamre"]),  # -> Ebron
        verso(nord_sud, c["Mamre"], c["Bersabea"]),
    ]
    arrivi = [c["Carran"], c["Sichem"], c["Betel"], c["Zoan"], c["Mamre"], c["Bersabea"]]
    partenze = [c["Ur"]] + arrivi[:-1]
    # ogni tratto parte e arriva esattamente sulle tappe
    return [raccorda(t, p, a) for t, p, a in zip(tratti, partenze, arrivi)]


def main():
    documento = fitz.open(CARTINA)
    pagina = documento[0]
    disegni = pagina.get_drawings()
    per_numero = {x["seqno"]: x for x in disegni}
    tps, posizioni, resoconto = georeferenziazione(leggi_luoghi())
    sposta = lambda punti: [tuple(round(float(v), 4) for v in q) for q in tps(np.array(punti))]

    def poligono(numero):
        parti = [Polygon(sposta(t)) for t in anelli(per_numero[numero]) if len(t) >= 3]
        return make_valid(unary_union([make_valid(p) for p in parti]))

    def linea(numero):
        return MultiLineString([LineString(sposta(t)) for t in anelli(per_numero[numero]) if len(t) >= 2])

    # Terre emerse di Natural Earth, solo nella zona della cartina
    zona = box(25, 24, 55, 43)
    terre = unary_union([shape(f["geometry"]).intersection(zona) for f in scarica("ne_10m_land")
                         if shape(f["geometry"]).intersects(zona)])
    a_terra = lambda g: g.intersection(terre).simplify(0.005, preserve_topology=True)

    regni = {numero: a_terra(poligono(numero)) for numero in REGNI}
    colore = lambda numero: "#%02x%02x%02x" % tuple(round(v * 255) for v in per_numero[numero]["fill"])
    # Stili (la simbologia della cartina) ed elementi disegnati, ognuno con il suo stile.
    # Ogni regno ha il suo stile, con il colore della cartina; i valori a coppie sono [zoom 3, zoom 7].
    stili, elementi = [], []
    elemento = lambda stile, nome, geometria: elementi.append(
        {"type": "Feature", "properties": {"stile": stile, "nome": nome, "origine": "importato"}, "geometry": mapping(geometria)})
    for numero, (rid, nome) in REGNI.items():
        stili.append({"id": rid, "tipo": "area", "nome": nome, **({"legenda": LEGENDA[rid]} if rid in LEGENDA else {}),
                      "riempimento": colore(numero), "opacita": [0.82, 0.66], "contorno": "#5e6062", "spessore": [1.1, 1.8]})
        # Mari sta dentro l'impero: all'impero si toglie Mari, perché i colori trasparenti non si mescolino
        elemento(rid, nome, regni[3].difference(regni[5]) if rid == "babilonia" else regni[numero])

    # Nomi: [tipo, nome, lng, lat, zoom, {inclinazione, sottotitolo}]
    pezzi = testi_della_cartina(pagina)
    nomi = []
    for tipo, nome, testo, sotto, testo_sotto in NOMI_DALLA_CARTINA:
        riquadro, xy, angolo = trova_testo(pezzi, testo)
        extra = {}
        if sotto:  # il nome e il sottotitolo sono un blocco solo: il centro è quello del blocco
            riquadro_sotto, _, _ = trova_testo(pezzi, testo_sotto)
            r = riquadro | riquadro_sotto
            xy = ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
            extra["sotto"] = sotto
        if abs(angolo) > 3:
            extra["angolo"] = angolo_sulla_carta(tps, xy, angolo)
        lng, lat = tps(np.array([xy]))[0]
        nomi.append([tipo, nome, round(float(lng), 3), round(float(lat), 3), ZOOM[tipo], *([extra] if extra else [])])
    luogo = lambda n: [round(float(v), 3) for v in posizioni[n]]
    nomi += [["capitale-antica", n, *luogo(n), ZOOM["capitale-antica"]] for n in CAPITALI_ANTICHE]
    nomi += [["citta-antica", n, *luogo(n), ZOOM["citta-antica"]] for n in CITTA_ANTICHE]
    nomi += [["vetta", testo, *luogo(n), ZOOM["vetta"]] for n, testo in NOMI_VETTE.items()]

    tratti = tratti_del_cammino([[list(q) for q in l.coords] for l in linea(PERCORSO).geoms], posizioni)
    # l'arco della Mezzaluna è quello intero della cartina, che passa anche sul mare: dentro l'arco tutto
    # è più chiaro (un velo bianco) e il bordo è una linea blu
    arco = poligono(MEZZALUNA).simplify(0.005, preserve_topology=True)
    stili.append({"id": "mezzaluna", "tipo": "area", "nome": "Mezzaluna fertile", "riempimento": "#ffffff",
                  "opacita": 0.14, "contorno": "#0092b6", "spessore": [1.6, 2.6]})
    elemento("mezzaluna", "Mezzaluna fertile", arco)
    # la costa del Golfo Persico allora, più a nord di oggi: a puntini verde acqua, come nella cartina
    stili.append({"id": "costa-antica", "tipo": "linea", "nome": "Costa del Golfo Persico allora", "colore": "#00b6b5",
                  "spessore": [1.6, 2.6], "tratteggio": [0.1, 2]})
    elemento("costa-antica", "Costa del Golfo Persico allora", linea(COSTA_ANTICA))
    # le capitali hanno il pallino rosso (lo disegnano i nomi): lo stile serve alla legenda
    stili.append({"id": "capitale", "tipo": "punto", "nome": "Capitale", "legenda": LEGENDA["capitale"], "colore": "#ed1c24"})

    # Alone intorno ai dati della cartina (regni, arco, cammino, nomi): nel 1700 a.C. il mondo si
    # scurisce poco a poco allontanandosi da lì, dove la cartina non dice nulla. Ogni velo è il mondo
    # intero con un buco sempre più largo; sovrapposti, danno una sfumatura morbida senza angoli.
    dati_cartina = unary_union([*regni.values(), arco, *[LineString(t) for t in tratti],
                                *[Point(n[2], n[3]).buffer(0.3) for n in nomi]])
    mondo = [[-180, -89.9], [180, -89.9], [180, 89.9], [-180, 89.9], [-180, -89.9]]
    veli = []
    for distanza in ALONE:
        buco = dati_cartina.buffer(distanza, quad_segs=16).simplify(0.05)
        buco = max(getattr(buco, "geoms", [buco]), key=lambda p: p.area)  # un solo buco, senza isolette
        veli.append({"type": "Feature", "properties": {},
                     "geometry": {"type": "Polygon", "coordinates": [mondo, [[round(x, 3), round(y, 3)] for x, y in buco.exterior.coords]]}})

    # Per il backoffice (Importazione in backoffice/src/lib/server/cartine.ts): la cartina nel formato di
    # condiviso/cammino.ts, il tracciato di ogni tappa dopo la prima (dalla tappa precedente a questa),
    # le frecce e gli spilli con cui è stata georeferenziata
    importazione = {
        "epoca": EPOCA, "pulsante": PULSANTE, "anno": ANNO, "fonte": CARTINA.name,
        "cartina": {
            "versione": 1, "id": EPOCA, "fonte": CARTINA.name,
            "stili": stili,
            "elementi": {"type": "FeatureCollection", "features": elementi},
            "nomi": nomi,
            "alone": {"type": "FeatureCollection", "features": veli},
        },
        "tracciati": tratti,
        "frecce": frecce(per_numero, tps),
        "punti": json.loads(PUNTI.read_text(encoding="utf-8"))["punti"],
    }
    USCITA.parent.mkdir(parents=True, exist_ok=True)
    USCITA.write_text(json.dumps(importazione, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{USCITA.relative_to(RADICE).as_posix()} scritto ({USCITA.stat().st_size // 1024} KB): "
          f"{len(elementi)} elementi in {len(stili)} stili, {len(nomi)} nomi, {len(tratti)} tracciati, "
          f"{len(importazione['frecce'])} frecce")
    print("\n".join(resoconto))
    print(f"Per portarla nel backoffice e nel portale: npm run importa-cartina -- {CAMMINO} {EPOCA} --pubblica")


if __name__ == "__main__":
    main()
