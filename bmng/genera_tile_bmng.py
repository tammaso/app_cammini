#!/usr/bin/env python3
"""
Genera una piramide di tile Web Mercator (XYZ) dai riquadri NASA
Blue Marble Next Generation (21600 x 21600 px, 90 x 90 gradi ciascuno).

Accetta i riquadri in JPEG o GeoTIFF, anche solo alcuni degli 8.
Usa solo Pillow e numpy: non serve installare GDAL.

Esempi:
    python genera_tile_bmng.py --input riquadri --output tile
    python genera_tile_bmng.py --input riquadri --output tile --maxzoom 7 --pmtiles bmng.pmtiles
    python genera_tile_bmng.py --input riquadri --output tile_prova --maxzoom 5 --bbox 20 14 60 46
"""
import argparse
import io
import math
import re
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # i riquadri NASA superano il limite di sicurezza di Pillow

GRIGLIA = re.compile(r"([A-D])([12])(_geo)?\.(jpe?g|tiff?)$", re.IGNORECASE)
COLORE_VUOTO = (8, 18, 38)  # blu notte per le zone senza dati


# ---------------------------------------------------------------- utilità

def trova_riquadri(cartella: Path):
    """Restituisce {'C1': percorso, ...}. Se ci sono sia JPEG sia GeoTIFF preferisce il GeoTIFF."""
    trovati = {}
    for p in sorted(cartella.iterdir()):
        m = GRIGLIA.search(p.name)
        if not m:
            continue
        chiave = (m.group(1) + m.group(2)).upper()
        e_tif = m.group(4).lower().startswith("tif")
        if chiave not in trovati or e_tif:
            trovati[chiave] = p
    return trovati


def estensione_riquadro(chiave: str):
    """(ovest, nord, est, sud) in gradi. A-D da ovest a est, 1 = nord, 2 = sud."""
    col = "ABCD".index(chiave[0])
    ovest = -180 + 90 * col
    nord = 90 if chiave[1] == "1" else 0
    return ovest, nord, ovest + 90, nord - 90


def lon_x(lon, n):
    return (lon + 180) / 360 * n


def lat_y(lat, n):
    lat = max(min(lat, 85.0511287798), -85.0511287798)
    return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


def tile_lonlat(z, x, y, T):
    n = 2 ** z
    px = (np.arange(T) + 0.5) / T
    lon = (x + px) / n * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * (y + px) / n))))
    return np.meshgrid(lon, lat)


def campiona(src, lon, lat, ovest, nord, ppd):
    """Interpolazione bilineare; legge solo i pixel necessari, senza convertire tutto il riquadro."""
    H, W, _ = src.shape
    u = np.clip((lon - ovest) * ppd - 0.5, 0, W - 1.001)
    v = np.clip((nord - lat) * ppd - 0.5, 0, H - 1.001)
    u0 = np.floor(u).astype(np.int32)
    v0 = np.floor(v).astype(np.int32)
    fu = (u - u0)[..., None].astype(np.float32)
    fv = (v - v0)[..., None].astype(np.float32)
    a = src[v0, u0].astype(np.float32)
    b = src[v0, u0 + 1].astype(np.float32)
    c = src[v0 + 1, u0].astype(np.float32)
    d = src[v0 + 1, u0 + 1].astype(np.float32)
    out = a * (1 - fu) * (1 - fv) + b * fu * (1 - fv) + c * (1 - fu) * fv + d * fu * fv
    return np.clip(out + 0.5, 0, 255).astype(np.uint8)


def leggi(percorso: Path) -> Image.Image:
    """Apre un riquadro JPEG o GeoTIFF evitando copie inutili in memoria (ogni copia pesa circa 1,4 GB)."""
    try:
        im = Image.open(percorso)
        im.load()
        return im if im.mode == "RGB" else im.convert("RGB")
    except Exception as errore:
        try:
            import tifffile
        except ImportError:
            sys.exit(f"Pillow non riesce ad aprire {percorso.name} ({errore}). Installa tifffile:  pip install tifffile")
        return Image.fromarray(np.ascontiguousarray(tifffile.imread(percorso)[..., :3]))


def salva(img: Image.Image, percorso: Path, formato: str, qualita: int):
    percorso.parent.mkdir(parents=True, exist_ok=True)
    if formato == "webp":
        img.save(percorso, "WEBP", quality=qualita, method=4)
    else:
        img.save(percorso, "JPEG", quality=qualita, optimize=True, progressive=True)


def intervallo_tile(z, ovest, nord, est, sud, bbox):
    """Tile del livello z che ricadono nell'area (eventualmente ristretta da bbox)."""
    if bbox:
        ovest, sud = max(ovest, bbox[0]), max(sud, bbox[1])
        est, nord = min(est, bbox[2]), min(nord, bbox[3])
        if ovest >= est or sud >= nord:
            return []
    n = 2 ** z
    eps = 1e-9
    x0, x1 = int(lon_x(ovest + eps, n)), int(lon_x(est - eps, n))
    y0, y1 = int(lat_y(nord - eps, n)), int(lat_y(sud + eps, n))
    y0, y1 = max(y0, 0), min(y1, n - 1)
    return [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]


# ---------------------------------------------------------------- fasi

def livello_massimo(riquadri, args, uscita: Path):
    z, T = args.maxzoom, args.tile
    n = 2 ** z
    fatte = 0
    for chiave, percorso in riquadri.items():
        ovest, nord, est, sud = estensione_riquadro(chiave)
        elenco = intervallo_tile(z, ovest, nord, est, sud, args.bbox)
        if not elenco:
            continue
        print(f"  {chiave}: apro {percorso.name} ({len(elenco)} tile al livello {z})")
        t0 = time.time()
        im = leggi(percorso)
        ppd = im.width / 90
        # Riduzione preliminare se il livello richiesto è molto meno dettagliato della sorgente
        ppd_serve = T * n / 360 * 1.3
        if ppd_serve * 2 < ppd:
            fattore = (ppd_serve * 2) / ppd
            im = im.resize((round(im.width * fattore), round(im.height * fattore)), Image.LANCZOS)
            ppd = im.width / 90
        # Copia a strisce in un array numpy: evita il picco di memoria di np.asarray sull'intera immagine
        src = np.empty((im.height, im.width, 3), dtype=np.uint8)
        for r0 in range(0, im.height, 2048):
            r1 = min(r0 + 2048, im.height)
            src[r0:r1] = np.asarray(im.crop((0, r0, im.width, r1)))
        del im
        print(f"     letto in {time.time() - t0:.0f} s")
        for i, (x, y) in enumerate(elenco, 1):
            dest = uscita / str(z) / str(x) / f"{y}.{args.formato}"
            if dest.exists() and not args.sovrascrivi:
                continue
            lon, lat = tile_lonlat(z, x, y, T)
            salva(Image.fromarray(campiona(src, lon, lat, ovest, nord, ppd)), dest, args.formato, args.qualita)
            fatte += 1
            if i % 200 == 0:
                print(f"     {i}/{len(elenco)}")
        del src
    return fatte


def livelli_inferiori(args, uscita: Path):
    T = args.tile
    for z in range(args.maxzoom - 1, args.minzoom - 1, -1):
        figli = set()
        for p in (uscita / str(z + 1)).glob(f"*/*.{args.formato}"):
            figli.add((int(p.parent.name), int(p.stem)))
        genitori = sorted({(x // 2, y // 2) for x, y in figli})
        for x, y in genitori:
            dest = uscita / str(z) / str(x) / f"{y}.{args.formato}"
            if dest.exists() and not args.sovrascrivi:
                continue
            tela = Image.new("RGB", (2 * T, 2 * T), COLORE_VUOTO)
            for dx in (0, 1):
                for dy in (0, 1):
                    f = uscita / str(z + 1) / str(2 * x + dx) / f"{2 * y + dy}.{args.formato}"
                    if f.exists():
                        with Image.open(f) as c:
                            tela.paste(c.convert("RGB"), (dx * T, dy * T))
            salva(tela.resize((T, T), Image.LANCZOS), dest, args.formato, args.qualita)
        print(f"  livello {z}: {len(genitori)} tile")


def crea_pmtiles(args, uscita: Path):
    try:
        from pmtiles.tile import zxy_to_tileid, TileType, Compression
        from pmtiles.writer import Writer
    except ImportError:
        print("Per il file PMTiles serve il pacchetto 'pmtiles':  pip install pmtiles")
        return
    voci = []
    for p in uscita.glob(f"*/*/*.{args.formato}"):
        z, x, y = int(p.parent.parent.name), int(p.parent.name), int(p.stem)
        voci.append((zxy_to_tileid(z, x, y), p))
    voci.sort()
    with open(args.pmtiles, "wb") as f:
        w = Writer(f)
        for tid, p in voci:
            w.write_tile(tid, p.read_bytes())
        b = args.bbox or (-180, -85.05, 180, 85.05)
        w.finalize(
            {
                "tile_type": TileType.WEBP if args.formato == "webp" else TileType.JPEG,
                "tile_compression": Compression.NONE,
                "min_lon_e7": int(b[0] * 1e7), "min_lat_e7": int(b[1] * 1e7),
                "max_lon_e7": int(b[2] * 1e7), "max_lat_e7": int(b[3] * 1e7),
                "center_zoom": 2,
                "center_lon_e7": int((b[0] + b[2]) / 2 * 1e7),
                "center_lat_e7": int((b[1] + b[3]) / 2 * 1e7),
            },
            {
                "name": "NASA Blue Marble Next Generation",
                "attribution": "NASA Earth Observatory, Blue Marble Next Generation",
                "tileSize": args.tile,
            },
        )
    print(f"  {len(voci)} tile in {args.pmtiles} ({Path(args.pmtiles).stat().st_size / 1e6:.1f} MB)")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description="Tile Web Mercator dai riquadri NASA Blue Marble Next Generation")
    ap.add_argument("--input", required=True, help="cartella con i riquadri (JPEG o GeoTIFF)")
    ap.add_argument("--output", required=True, help="cartella delle tile {z}/{x}/{y}")
    ap.add_argument("--minzoom", type=int, default=0)
    ap.add_argument("--maxzoom", type=int, default=7,
                    help="7 con tile da 512 px corrisponde alla risoluzione NASA (circa 500 m per pixel)")
    ap.add_argument("--tile", type=int, default=512, choices=[256, 512], help="lato della tile in pixel")
    ap.add_argument("--formato", default="webp", choices=["webp", "jpg"])
    ap.add_argument("--qualita", type=int, default=75)
    ap.add_argument("--bbox", type=float, nargs=4, metavar=("OVEST", "SUD", "EST", "NORD"),
                    help="limita il livello massimo a un'area (es. 20 14 60 46)")
    ap.add_argument("--pmtiles", help="crea anche un unico file .pmtiles con tutte le tile")
    ap.add_argument("--sovrascrivi", action="store_true", help="rigenera le tile già presenti")
    args = ap.parse_args()

    ingresso, uscita = Path(args.input), Path(args.output)
    riquadri = trova_riquadri(ingresso)
    if not riquadri:
        sys.exit(f"Nessun riquadro trovato in {ingresso}: i nomi devono finire con A1...D2 (.jpg o _geo.tif)")
    mancanti = sorted(set(f"{c}{r}" for c in "ABCD" for r in "12") - set(riquadri))
    print(f"Riquadri trovati: {', '.join(sorted(riquadri))}" + (f"  (mancano: {', '.join(mancanti)})" if mancanti else ""))

    t0 = time.time()
    print(f"Livello {args.maxzoom} dai riquadri originali")
    fatte = livello_massimo(riquadri, args, uscita)
    print(f"  {fatte} tile nuove in {time.time() - t0:.0f} s")
    print("Livelli inferiori")
    livelli_inferiori(args, uscita)
    if args.pmtiles:
        print("Pacchetto PMTiles")
        crea_pmtiles(args, uscita)
    tot = sum(p.stat().st_size for p in uscita.rglob(f"*.{args.formato}"))
    print(f"Fatto in {(time.time() - t0) / 60:.1f} minuti. Cartella {uscita}: {tot / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
