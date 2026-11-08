#!/usr/bin/env python3
"""
Rigenera prototipo/dati/mondo.js (i nomi di tutto il mondo: Stati, capitali, città, oceani e mari,
continenti, rilievi, deserti, vette) e strumenti/capitali_da_validare.csv (l'elenco delle capitali
da far controllare alla redazione).

Per ogni nome si scrive lo zoom da cui compare: Natural Earth lo indica (MIN_LABEL, MIN_ZOOM) per
riquadri da 256 pixel, MapLibre usa riquadri da 512, quindi si toglie 1. La pagina mostra prima i
nomi più importanti ed evita le sovrapposizioni.

Stati
- Sorgente: ne_10m_admin_0_countries_ita (punto di vista ufficiale italiano), nome italiano NAME_IT.
- Posizione dell'etichetta: LABEL_X/LABEL_Y di Natural Earth, oppure quella già sistemata a mano
  in prototipo/dati/base.js per gli Stati della regione del cammino.
- Si escludono basi militari, scogli e territori minuscoli che su un atlante scolastico non compaiono.

Capitali
- Sorgente: ne_10m_populated_places, FEATURECLA "Admin-0 capital", solo degli Stati tenuti sopra.
- Natural Earth segna più capitali per alcuni Stati e ha qualche nome superato: le scelte e le
  correzioni sono qui sotto, ognuna con la sua nota, e finiscono nel file CSV per la redazione.
- Gerusalemme non è indicata come capitale di Israele: l'Italia non la riconosce come tale.

Città
- Sorgente: ne_10m_populated_places, solo le grandi città (MIN_ZOOM sotto LIMITE_CITTA).
- Le capitali non scelte qui sopra restano come città (Gerusalemme, Tel Aviv, Città del Capo).

Geografia fisica
- Oceani, mari, golfi e stretti principali: ne_10m_geography_marine_polys, nome nel punto più interno del poligono.
- Continenti, grandi catene montuose, deserti, altopiani e regioni: ne_10m_geography_regions_polys.
- Le vette più note, con la quota: ne_10m_geography_regions_elevation_points.

Uso:  py strumenti\\prepara_etichette_mondo.py
"""
import csv
import json
import math
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import polylabel

from prepara_confini_fiumi import scarica

RADICE = Path(__file__).resolve().parent.parent
USCITA = RADICE / "prototipo" / "dati" / "mondo.js"
CSV = RADICE / "strumenti" / "capitali_da_validare.csv"

# Territori che non si etichettano: basi, scogli, isole disabitate o minuscole.
STATI_ESCLUSI = {"USG", "PGA", "SCR", "ESB", "WSB", "BRT", "UMI", "BRI", "ATC", "CSI", "CLP", "IOA", "HMD"}

# Nomi più brevi, come negli atlanti: in maiuscolo spaziato quelli lunghi coprono mezzo continente.
NOMI_STATI = {
    "USA": "Stati Uniti",
    "COD": "Rep. Dem. del Congo",
    "COG": "Congo",
    "CAF": "Rep. Centrafricana",
    "MCO": "Monaco",
    "JEY": "Jersey",
    "ATF": "Terre australi francesi",
    "SGS": "Georgia del Sud",
    "FSM": "Micronesia",
    "IOT": "Territorio britannico dell'oceano Indiano",
}

# Tipi di Natural Earth che possono avere una capitale propria (le dipendenze no). Tra i "Country"
# ci sono anche le parti di uno Stato (Groenlandia, Hong Kong, Aruba): quelle senza capitale si saltano.
TIPI_CON_CAPITALE = {"Sovereign country", "Country", "Sovereignty", "Disputed", "Indeterminate"}

# Stati con più capitali in Natural Earth: quella da segnare con il simbolo.
CAPITALE_SCELTA = {
    "ZAF": ("Pretoria", "Capitale amministrativa; Città del Capo (legislativa) e Bloemfontein (giudiziaria) non hanno il simbolo. Natural Earth segna come capitale anche Johannesburg, che non lo è."),
    "BOL": ("Sucre", "Capitale costituzionale; il governo ha sede a La Paz."),
    "CIV": ("Yamoussoukro", "Capitale ufficiale; Abidjan è la città più grande e sede di molti uffici."),
    "TZA": ("Dodoma", "Capitale ufficiale (Natural Earth la segna come secondaria); Dar es Salaam è la città più grande."),
    "MMR": ("Naypyidaw", "Capitale dal 2005; Yangon è la città più grande."),
    "BEN": ("Porto-Novo", "Capitale ufficiale; il governo ha sede a Cotonou."),
    "NLD": ("Amsterdam", "Capitale costituzionale; governo e parlamento hanno sede all'Aia."),
    "MYS": ("Kuala Lumpur", "Capitale; il governo ha sede a Putrajaya."),
}

# Stati per cui non si mostra nessuna capitale.
SENZA_CAPITALE = {
    "ISR": "Natural Earth indica Gerusalemme, ma l'Italia non la riconosce come capitale di Israele (l'ambasciata è a Tel Aviv). Nessun simbolo finché la redazione non decide.",
    "PSX": "Natural Earth non indica una capitale (segna Ramallah come sede amministrativa). Da decidere con la redazione.",
    "NRU": "Nauru non ha una capitale ufficiale: il governo ha sede a Yaren.",
    "SAH": "Territorio conteso: Natural Earth indica come capitale secondaria Bir Lehlu, sede della Repubblica Saharawi, che l'Italia non riconosce.",
}

# Nomi italiani corretti rispetto a Natural Earth: (nome di Natural Earth, nome da mostrare, nota).
NOMI_CAPITALI = {
    "Nur-Sultan": ("Astana", "Rinominata Astana nel 2022."),
    "Principato di Monaco": ("Monaco", "La città ha lo stesso nome dello Stato."),
    "Città di San Marino": ("San Marino", "Forma usata negli atlanti."),
    "Bogotà": ("Bogotá", "Grafia con l'accento acuto, come in spagnolo."),
    "Male": ("Malé", "Grafia corrente."),
}

# Casi da far guardare comunque alla redazione.
DA_VERIFICARE = {
    "TWN": "Taiwan compare come Stato nel punto di vista italiano di Natural Earth, ma l'Italia non ha relazioni diplomatiche ufficiali con Taipei.",
    "KOS": "Stato riconosciuto dall'Italia, non da tutti i Paesi.",
    "KWT": "Natural Earth scrive «Al Kuwait»: verificare la forma italiana (Kuwait City, Kuwait).",
    "UKR": "Natural Earth scrive «Kiev»; nell'uso recente si trova anche «Kyiv».",
}


# Ogni Stato ha il suo nome appena compaiono i nomi (ZOOM_NOMI nella pagina): uno studente che vede un
# confine vuole sapere di che Stato si tratta. Fanno eccezione i microstati (Vaticano, Monaco,
# Lussemburgo), di cui da lontano non si vede neanche il confine: compaiono avvicinandosi.
ZOOM_STATI = 1.8
AREA_MICROSTATO = 3000  # km²
# Le capitali compaiono tutte insieme, non alla spicciolata: un po' più da vicino degli Stati.
ZOOM_CAPITALI = 2.6

# Ordine di importanza a parità di zoom, con il tipo scritto in mondo.js.
TIPI = ["stato", "capitale", "oceano", "continente", "mare", "rilievo", "regione", "citta", "vetta"]

# Poche voci, come in un atlante scolastico: solo le grandi città e la geografia fisica principale.
CLASSI_MARINE = {"ocean": "oceano", "sea": "mare", "gulf": "mare", "bay": "mare", "strait": "mare", "channel": "mare"}
LIMITE_MARINE = 7  # min_label di Natural Earth: oltre ci sono baie e canali minori
CLASSI_REGIONI = {"Continent": "continente", "Range/mtn": "rilievo", "Plateau": "rilievo", "Desert": "regione", "Geoarea": "regione"}
LIMITE_REGIONI = 4  # MIN_LABEL: solo le grandi catene, i grandi deserti e le grandi regioni (Anatolia, Siberia)
LIMITE_VETTE = 5  # min_zoom: solo le vette più note (Elbrus, Kilimangiaro, Everest)
CLASSI_CITTA = {"Populated place", "Populated Place", "Admin-1 capital", "Admin-1 region capital",
                "Admin-0 region capital", "Admin-0 capital", "Admin-0 capital alt"}
LIMITE_CITTA = 5  # MIN_ZOOM: circa 250 grandi città nel mondo (Gerusalemme, Aleppo, Alessandria)

# Nomi italiani di Natural Earth da sistemare.
NOMI_FISICI = {
    "America meridionale": "America del Sud",
    "governatorato di Musandam": "Penisola di Musandam",
}


def maiuscola(nome):
    """Natural Earth scrive spesso «mar Nero», «deserto siriano»: sulla carta l'iniziale è maiuscola."""
    return nome[:1].upper() + nome[1:]


def punto_interno(geometria):
    """Il punto più lontano dai bordi della parte più grande: lì il nome sta dentro la forma."""
    g = shape(geometria)
    parte = max(getattr(g, "geoms", [g]), key=lambda p: p.area)
    p = polylabel(parte, tolerance=0.05)
    return round(p.x, 3), round(p.y, 3)


def posizioni_a_mano():
    """Posizioni delle etichette già sistemate a mano in base.js, per nome italiano."""
    testo = (RADICE / "prototipo" / "dati" / "base.js").read_text(encoding="utf-8")
    geo = json.loads(testo[testo.index("{"):testo.rindex("}") + 1])
    return {c["name"]: c["at"] for c in geo.get("countries", [])}


def stati():
    a_mano = posizioni_a_mano()
    elenco = []
    for f in scarica("ne_10m_admin_0_countries_ita"):
        p = f["properties"]
        if p["ADM0_A3"] in STATI_ESCLUSI:
            continue
        nome = NOMI_STATI.get(p["ADM0_A3"], p["NAME_IT"])
        lng, lat = a_mano.get(nome, [p["LABEL_X"], p["LABEL_Y"]])
        g = shape(f["geometry"])
        area = g.area * 111.32 ** 2 * math.cos(math.radians(g.centroid.y))  # km², approssimata
        z_natural_earth = max(0.5, p["MIN_LABEL"] - 1)
        elenco.append({
            "a3": p["ADM0_A3"], "nome": nome, "tipo": p["TYPE"],
            # le città di Natural Earth non usano sempre lo stesso codice (Sudan del Sud: SDS e SSD)
            "codici": {p[k] for k in ("ADM0_A3", "ISO_A3", "GU_A3", "SU_A3", "BRK_A3") if p[k] and p[k] != "-99"},
            "lng": round(lng, 3), "lat": round(lat, 3),
            "z": round(z_natural_earth if area < AREA_MICROSTATO else min(z_natural_earth, ZOOM_STATI), 2),
            "importanza": p["MIN_LABEL"],  # a parità di zoom e di tipo, prima gli Stati più importanti
            # grandezza del nome: 1 grandi Stati, 2 medi, 3 piccoli
            "classe": 1 if p["LABELRANK"] <= 2 else 2 if p["LABELRANK"] <= 4 else 3,
        })
    return elenco


def capitali(elenco_stati):
    con_capitale = {s["a3"]: s for s in elenco_stati if s["tipo"] in TIPI_CON_CAPITALE}
    stato_di = {codice: s["a3"] for s in con_capitale.values() for codice in s["codici"]}
    per_stato = {}
    for f in scarica("ne_10m_populated_places"):
        p = f["properties"]
        if p["ADM0_A3"] in stato_di and p["FEATURECLA"] in ("Admin-0 capital", "Admin-0 capital alt"):
            per_stato.setdefault(stato_di[p["ADM0_A3"]], []).append(p)

    tenute, righe = [], []
    for a3, stato in sorted(con_capitale.items(), key=lambda v: v[1]["nome"]):
        candidate = per_stato.get(a3, [])
        nota, esito = "", "ok"
        if a3 in SENZA_CAPITALE:
            righe.append([stato["nome"], "", ", ".join(c["NAME_IT"] for c in candidate), "", "", "esclusa", SENZA_CAPITALE[a3]])
            continue
        if not candidate:
            if stato["tipo"] == "Sovereign country":
                raise SystemExit(f"{stato['nome']}: nessuna capitale in Natural Earth")
            continue
        if a3 in CAPITALE_SCELTA:
            nome_scelto, nota = CAPITALE_SCELTA[a3]
            scelta = next(c for c in candidate if c["NAME"] == nome_scelto)
            esito = "scelta tra più capitali"
        else:
            principali = [c for c in candidate if c["FEATURECLA"] == "Admin-0 capital"]
            if len(principali) != 1:
                raise SystemExit(f"{stato['nome']}: {len(principali)} capitali in Natural Earth, aggiungi una scelta in CAPITALE_SCELTA")
            scelta = principali[0]
        nome_ne = scelta["NAME_IT"] or scelta["NAME"]
        nome = nome_ne
        if nome_ne in NOMI_CAPITALI:
            nome, nota_nome = NOMI_CAPITALI[nome_ne]
            nota = " ".join(filter(None, [nota, nota_nome]))
            esito = "nome corretto" if esito == "ok" else esito
        if a3 in DA_VERIFICARE:
            nota = " ".join(filter(None, [nota, DA_VERIFICARE[a3]]))
            esito = "da verificare"
        lng, lat = round(scelta["LONGITUDE"], 3), round(scelta["LATITUDE"], 3)
        # Le capitali compaiono tutte insieme, e mai prima del nome del loro Stato.
        z = round(max(stato["z"], ZOOM_CAPITALI), 2)
        tenute.append({"nome": nome, "lng": lng, "lat": lat, "z": z, "id": scelta["NE_ID"]})
        righe.append([stato["nome"], nome, nome_ne, lat, lng, esito, nota])
    return tenute, righe


def citta(capitali_tenute):
    escluse = {c["id"] for c in capitali_tenute}
    for f in scarica("ne_10m_populated_places"):
        p = f["properties"]
        if p["NE_ID"] in escluse or p["FEATURECLA"] not in CLASSI_CITTA or p["MIN_ZOOM"] >= LIMITE_CITTA:
            continue
        # le città compaiono più da vicino di quanto indica Natural Earth: prima Stati e capitali
        yield ["citta", p["NAME_IT"] or p["NAME"], round(p["LONGITUDE"], 3), round(p["LATITUDE"], 3), p["MIN_ZOOM"]]


def geografia_fisica(nomi_stati):
    for f in scarica("ne_10m_geography_marine_polys"):
        p = f["properties"]
        if p["featurecla"] in CLASSI_MARINE and p["name_it"] and p["min_label"] <= LIMITE_MARINE:
            yield [CLASSI_MARINE[p["featurecla"]], maiuscola(p["name_it"]), *punto_interno(f["geometry"]), round(max(0.5, p["min_label"] - 1), 2)]
    for f in scarica("ne_10m_geography_regions_polys"):
        p = f["properties"]
        nome = maiuscola(NOMI_FISICI.get(p["NAME_IT"], p["NAME_IT"]))
        # l'Antartide c'è già tra gli Stati; le sue terre interne sono fuori tema
        if (p["FEATURECLA"] in CLASSI_REGIONI and p["MIN_LABEL"] <= LIMITE_REGIONI
                and nome not in nomi_stati and p["REGION"] != "Antarctica"):
            yield [CLASSI_REGIONI[p["FEATURECLA"]], nome, *punto_interno(f["geometry"]), round(max(0.5, p["MIN_LABEL"] - 1), 2)]
    for f in scarica("ne_10m_geography_regions_elevation_points"):
        p = f["properties"]
        if p["featurecla"] == "mountain" and p["name_it"] and p["min_zoom"] <= LIMITE_VETTE:
            # per le vette c'è un sesto campo, la quota; compaiono solo da vicino
            yield ["vetta", maiuscola(p["name_it"]), round(p["long_x"], 3), round(p["lat_y"], 3), p["min_zoom"], int(p["elevation"])]


def main():
    elenco = stati()
    tenute, righe = capitali(elenco)
    # l'ordinamento qui sotto è stabile: a parità di zoom gli Stati restano in ordine di importanza
    voci = [[f"stato{s['classe']}", s["nome"], s["lng"], s["lat"], s["z"]] for s in sorted(elenco, key=lambda s: s["importanza"])]
    voci += [["capitale", c["nome"], c["lng"], c["lat"], c["z"]] for c in tenute]
    voci += list(citta(tenute))
    voci += list(geografia_fisica({s["nome"] for s in elenco}))
    tipo = lambda v: v[0].rstrip("123")
    # prima i nomi che compaiono da più lontano; a parità di zoom, nell'ordine di TIPI
    voci.sort(key=lambda v: (v[4], TIPI.index(tipo(v))))
    USCITA.write_text(
        "// Nomi di tutto il mondo, in italiano, con lo zoom da cui compaiono.\n"
        "// Generato da strumenti/prepara_etichette_mondo.py: non modificarlo a mano.\n"
        "// Le capitali vanno validate dalla redazione (vedi strumenti/capitali_da_validare.csv).\n"
        "// Ogni voce: [tipo, nome, lng, lat, zoom di comparsa] e, per le vette, la quota in metri.\n"
        "// Tipi: stato1/2/3 (grandezza del nome), capitale, citta, oceano, continente, mare, rilievo, regione, vetta.\n"
        f"const MONDO = {json.dumps(voci, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8")
    conta = {}
    for v in voci:
        conta[tipo(v)] = conta.get(tipo(v), 0) + 1
    # Punto e virgola e BOM: il file si apre direttamente con Excel in italiano.
    with CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Stato", "Capitale mostrata", "Nome in Natural Earth", "Latitudine", "Longitudine", "Esito", "Nota"])
        w.writerows(righe)
    print("mondo.js scritto:", ", ".join(f"{t} {n}" for t, n in conta.items()))
    print(f"capitali_da_validare.csv scritto: {sum(r[5] != 'ok' for r in righe)} righe con una scelta o una nota")


if __name__ == "__main__":
    main()
