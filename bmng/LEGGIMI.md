# Tile NASA Blue Marble per il portale degli itinerari

Questi file trasformano gli 8 riquadri NASA Blue Marble Next Generation
(21600 × 21600 px, 500 m per pixel) in una piramide di tile Web Mercator
pronta per MapLibre: una cartella `{z}/{x}/{y}.webp` e, se vuoi, un unico
file `bmng.pmtiles` da mettere sul server.

| File | A cosa serve |
|---|---|
| `genera_tile_bmng.py` | Genera le tile dai riquadri (JPEG o GeoTIFF) |
| `anteprima.html` | Globo MapLibre per controllare il risultato |
| `server_anteprima.py` | Server locale per aprire l'anteprima |

## 1. Preparazione (una volta sola)

Da PowerShell:

```powershell
py -m pip install pillow numpy pmtiles
```

Se i GeoTIFF non si aprono con Pillow, lo script lo dice e chiede di installare
anche `tifffile` (`py -m pip install tifffile`).

## 2. Generare le tile

Le tile singole vanno **fuori da OneDrive** (`C:\bmng-tile`): sono migliaia di piccoli
file e OneDrive proverebbe a sincronizzarli tutti. Il file finale `bmng.pmtiles`
invece è uno solo e può stare nella cartella `bmng`.

```powershell
cd "C:\Users\Dringoli\OneDrive - LA SCUOLA SpA\Desktop\app cammini\bmng"
py genera_tile_bmng.py --input "..\quadranti mondo NASA Blue Marble Next Generation" --output C:\bmng-tile --pmtiles bmng.pmtiles
```

- Se nella cartella ci sono sia i JPEG sia i GeoTIFF dello stesso riquadro, usa i GeoTIFF.
- Se manca qualche riquadro, lo segnala e lavora con quelli che trova.
- Se lo interrompi, rilanciandolo riparte dalle tile mancanti
  (`--sovrascrivi` per rifarle tutte).

**Prova veloce prima del giro completo** (solo la regione del cammino di Abramo, circa un minuto):

```powershell
py genera_tile_bmng.py --input "...cartella dei riquadri..." --output C:\bmng\prova --bbox 20 14 60 46
```

### Cosa aspettarsi

Misurato qui sul riquadro C1 in JPEG:

- **Tempo**: circa 2 minuti a riquadro, quindi indicativamente 15-30 minuti per tutti e 8,
  a seconda del PC. I GeoTIFF si leggono più lentamente perché sono più pesanti.
- **Memoria**: circa 3,5 GB di RAM libera mentre lavora su un riquadro.
- **Spazio**: il C1 ha prodotto 24 MB di tile. Per il mondo intero conta qualche centinaio di MB,
  per la cartella e altrettanto per il file `.pmtiles`.

### Opzioni utili

| Opzione | Effetto |
|---|---|
| `--maxzoom 7` | Livello più dettagliato (predefinito). Con tile da 512 px corrisponde ai 500 m per pixel della NASA |
| `--formato jpg` | JPEG invece di WebP (file più grandi, compatibilità totale) |
| `--qualita 75` | Qualità di compressione (predefinito 75) |
| `--bbox O S E N` | Limita il lavoro a un'area, in gradi |

## 3. Controllare il risultato

`anteprima.html` e `server_anteprima.py` sono già nella cartella `bmng`, accanto a `bmng.pmtiles`:

```powershell
cd "C:\Users\Dringoli\OneDrive - LA SCUOLA SpA\Desktop\app cammini\bmng"
py server_anteprima.py
```

Apri `http://localhost:8000/anteprima.html`.

Il server standard `py -m http.server` non va bene per il file `.pmtiles`, perché non supporta
le richieste parziali ("Range"): la mappa resterebbe vuota.

Cose da guardare: le giunture tra i riquadri (meridiani 90° O, 0°, 90° E e l'equatore),
i colori uniformi, la nitidezza allo zoom massimo.

## 4. Nel portale

In produzione basta caricare `bmng.pmtiles` sul server (o su uno storage come S3) e,
in MapLibre, registrare il protocollo PMTiles e usare una sorgente raster:

```js
maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile);
// nello stile:
bmng: { type: "raster", url: "pmtiles://https://<server>/bmng.pmtiles", tileSize: 512 }
```

Crediti da riportare sulla mappa: *NASA Earth Observatory, Blue Marble Next Generation*.

## Note

- Nella fascia artica il mare cambia leggermente tessitura: è così nell'immagine NASA originale,
  non è un errore delle tile.
- Le tile coprono le latitudini tra 85° Nord e 85° Sud, come tutte le mappe Web Mercator.
