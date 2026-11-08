-- Schema iniziale del backoffice dei cammini (schema logico discusso il 2026-11-08 a partire da
-- er-cammino.docx). Quello che si pubblica segue il contratto di condiviso/cammino.ts.
-- Date in ISO 8601 (UTC). Coordinate in gradi: longitudine e latitudine.

-- Anagrafe dei luoghi -----------------------------------------------------------------------------
-- Tappe, città scritte sulle cartine, vette e punti di controllo. Cresce con ogni cartina importata;
-- in futuro sarà comune con l'Atlante.
CREATE TABLE luoghi (
  id            INTEGER PRIMARY KEY,
  nome          TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- nome italiano: «Carran»
  nome_antico   TEXT,                                   -- «Harran»
  nome_attuale  TEXT,                                   -- «Harran, Turchia sud-orientale»
  altri_nomi    TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(altri_nomi) AND json_type(altri_nomi) = 'array'),
                                                        -- come può comparire su una cartina: ["Haran", "Charran"]
  lat           REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng           REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  tipo          TEXT NOT NULL CHECK (tipo IN ('citta', 'vetta', 'regione', 'acque', 'altro')),
  certezza      TEXT NOT NULL CHECK (certezza IN ('certa', 'probabile', 'ipotetica')),  -- dell'identificazione
  nota          TEXT
) STRICT;

-- Archivio immagini (come nell'Atlante) -------------------------------------------------------------
CREATE TABLE immagini (
  id              INTEGER PRIMARY KEY,
  file            TEXT NOT NULL UNIQUE,      -- percorso dell'originale nell'archivio del backoffice
  sha256          TEXT NOT NULL UNIQUE,      -- evita doppioni e dà il nome dei file pubblicati
  larghezza       INTEGER NOT NULL CHECK (larghezza > 0),
  altezza         INTEGER NOT NULL CHECK (altezza > 0),
  alt             TEXT NOT NULL,
  didascalia      TEXT,
  crediti         TEXT,
  licenza         TEXT,
  nome_originale  TEXT,
  dimensione      INTEGER CHECK (dimensione IS NULL OR dimensione > 0),
  caricata_il     TEXT
) STRICT;

-- Cammini e tappe ---------------------------------------------------------------------------------
CREATE TABLE cammini (
  id                INTEGER PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE CHECK (slug <> '' AND slug NOT GLOB '*[^a-z0-9-]*'),  -- cartella e indirizzo
  titolo            TEXT NOT NULL,             -- «Il cammino di Abramo»
  nome              TEXT NOT NULL,             -- «Cammino di Abramo»: in legenda
  sottotitolo       TEXT,
  globo_luogo       TEXT,                      -- il primo passo, sul globo
  globo_testo       TEXT NOT NULL DEFAULT '',
  panoramica_testo  TEXT NOT NULL DEFAULT '',  -- la panoramica del cammino, prima delle tappe
  -- nomi scritti a mano sulla carta: [{ tipo: mare|fiume|regione, testo, coordinate }]
  etichette         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(etichette) AND json_type(etichette) = 'array'),
  -- punte di freccia sul cammino: [{ coordinate, rotazione }]
  frecce            TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(frecce) AND json_type(frecce) = 'array'),
  ordine            INTEGER NOT NULL DEFAULT 0,
  stato             TEXT NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza', 'pubblicato')),
  creato_il         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  modificato_il     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- Le tappe appartengono a un solo cammino. La posizione dà l'ordine del viaggio (da 0).
CREATE TABLE tappe (
  id               INTEGER PRIMARY KEY,
  cammino_id       INTEGER NOT NULL REFERENCES cammini(id) ON DELETE CASCADE,
  posizione        INTEGER NOT NULL CHECK (posizione >= 0),
  nome             TEXT NOT NULL,            -- «Ebron e le Querce di Mamre»
  breve            TEXT NOT NULL,            -- accanto al pin: «Ebron»
  luogo_id         INTEGER NOT NULL REFERENCES luoghi(id),  -- le coordinate vengono dall'anagrafe
  luogo_attuale    TEXT,                     -- «Hebron, Cisgiordania»
  riferimento      TEXT,                     -- «Gen 13,18; 23»
  testo            TEXT NOT NULL,            -- nel pannello
  approfondimento  TEXT,                     -- nella scheda; vuoto: il testo del pannello
  immagine_id      INTEGER REFERENCES immagini(id),
  -- dalla tappa precedente: [[lng, lat], ...]; vuoto: linea dritta
  tracciato        TEXT CHECK (tracciato IS NULL OR (json_valid(tracciato) AND json_type(tracciato) = 'array')),
  secondaria       INTEGER NOT NULL DEFAULT 0 CHECK (secondaria IN (0, 1)),  -- nome accanto al pin solo da vicino
  UNIQUE (cammino_id, posizione)
) STRICT;
CREATE INDEX tappe_luogo ON tappe(luogo_id);
CREATE INDEX tappe_immagine ON tappe(immagine_id);

-- Cartine storiche --------------------------------------------------------------------------------
-- Un'epoca storica di un cammino: appartiene a quel cammino soltanto, e un cammino può averne più
-- d'una (pulsanti «1700 a.C. · 1200 a.C. · Oggi», in ordine di anno). «Oggi» non sta qui.
CREATE TABLE cartine (
  id          INTEGER PRIMARY KEY,
  cammino_id  INTEGER NOT NULL REFERENCES cammini(id) ON DELETE CASCADE,
  epoca       TEXT NOT NULL CHECK (epoca <> '' AND epoca NOT GLOB '*[^a-z0-9-]*'),  -- «1700ac»: nome del file
  pulsante    TEXT NOT NULL,                 -- «1700 a.C.»
  anno        INTEGER NOT NULL,              -- negativo prima di Cristo
  fonte       TEXT,                          -- il file consegnato dal cartografo (SVG)
  metodo      TEXT NOT NULL DEFAULT 'punti di controllo' CHECK (metodo IN ('punti di controllo', 'fondo modello')),
  -- veli che scuriscono il mondo intorno ai dati della cartina (si calcolano all'importazione)
  alone       TEXT NOT NULL DEFAULT '{"type":"FeatureCollection","features":[]}' CHECK (json_valid(alone)),
  importata_il TEXT,
  UNIQUE (cammino_id, epoca)
) STRICT;

-- La simbologia della cartina. Valori numerici a coppie [a zoom 3, a zoom 7] oppure un numero solo.
CREATE TABLE stili (
  id          INTEGER PRIMARY KEY,
  cartina_id  INTEGER NOT NULL REFERENCES cartine(id) ON DELETE CASCADE,
  chiave      TEXT NOT NULL,                 -- «mari»: lega gli elementi importati al loro stile
  posizione   INTEGER NOT NULL DEFAULT 0,    -- ordine di disegno e di legenda
  tipo        TEXT NOT NULL CHECK (tipo IN ('area', 'linea', 'punto')),
  nome        TEXT NOT NULL,
  legenda     TEXT,                          -- voce della legenda; vuota: lo stile non compare in legenda
  colore      TEXT NOT NULL CHECK (colore GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),  -- riempimento delle aree
  opacita     TEXT CHECK (opacita IS NULL OR json_valid(opacita)),       -- aree
  contorno    TEXT CHECK (contorno IS NULL OR contorno GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'),
  spessore    TEXT CHECK (spessore IS NULL OR json_valid(spessore)),     -- contorno delle aree, linee
  tratteggio  TEXT CHECK (tratteggio IS NULL OR json_valid(tratteggio)), -- linee: [trattino, spazio]
  UNIQUE (cartina_id, chiave)
) STRICT;

-- Aree e linee disegnate, ognuna con il suo stile. L'origine dice se una nuova importazione le può
-- sostituire: si sostituiscono solo quelle «importato».
CREATE TABLE elementi (
  id          INTEGER PRIMARY KEY,
  cartina_id  INTEGER NOT NULL REFERENCES cartine(id) ON DELETE CASCADE,
  stile_id    INTEGER NOT NULL REFERENCES stili(id),
  nome        TEXT,
  geometria   TEXT NOT NULL CHECK (json_valid(geometria)),  -- GeoJSON
  origine     TEXT NOT NULL CHECK (origine IN ('importato', 'disegnato', 'modificato'))
) STRICT;
CREATE INDEX elementi_cartina ON elementi(cartina_id);
CREATE INDEX elementi_stile ON elementi(stile_id);

-- I nomi scritti sulla cartina, con la loro categoria tipografica
CREATE TABLE nomi (
  id          INTEGER PRIMARY KEY,
  cartina_id  INTEGER NOT NULL REFERENCES cartine(id) ON DELETE CASCADE,
  posizione   INTEGER NOT NULL DEFAULT 0,
  categoria   TEXT NOT NULL CHECK (categoria IN ('regno', 'regione-antica', 'capitale-antica', 'citta-antica',
                                                 'regione', 'mare', 'fiume', 'isola', 'vetta')),
  testo       TEXT NOT NULL,                 -- «\n» va a capo
  sotto       TEXT,                          -- sottotitolo: «Sotto Hammurabi 1700 a.C.»
  lng         REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  lat         REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  zoom        REAL NOT NULL,                 -- da quale zoom compare
  angolo      REAL,                          -- inclinazione in gradi, come nella cartina
  luogo_id    INTEGER REFERENCES luoghi(id), -- città e vette: il luogo dell'anagrafe
  origine     TEXT NOT NULL CHECK (origine IN ('importato', 'disegnato', 'modificato'))
) STRICT;
CREATE INDEX nomi_cartina ON nomi(cartina_id);
CREATE INDEX nomi_luogo ON nomi(luogo_id);

-- Gli spilli della georeferenziazione: un punto del foglio (sx, sy, nelle unità dell'SVG) agganciato a
-- un punto del globo. Un luogo probabile o ipotetico cede in parte verso dove lo vorrebbe il disegno.
CREATE TABLE punti_controllo (
  id          INTEGER PRIMARY KEY,
  cartina_id  INTEGER NOT NULL REFERENCES cartine(id) ON DELETE CASCADE,
  posizione   INTEGER NOT NULL DEFAULT 0,
  nome        TEXT NOT NULL,
  luogo_id    INTEGER REFERENCES luoghi(id), -- vuoto per i punti aggiunti a mano (una punta, una foce)
  sx          REAL NOT NULL,
  sy          REAL NOT NULL,
  lng         REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  lat         REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  certezza    TEXT NOT NULL CHECK (certezza IN ('certa', 'probabile', 'ipotetica')),
  stato       TEXT NOT NULL CHECK (stato IN ('proposto', 'confermato', 'manuale'))
) STRICT;
CREATE INDEX punti_controllo_cartina ON punti_controllo(cartina_id);
CREATE INDEX punti_controllo_luogo ON punti_controllo(luogo_id);

-- Impostazioni, registro delle modifiche e degli errori (come nell'Atlante) -----------------------
CREATE TABLE impostazioni (
  chiave  TEXT PRIMARY KEY CHECK (chiave IN ('backup_cartella', 'backup_automatico', 'backup_ultimo', 'backup_errore')),
  valore  TEXT NOT NULL
) STRICT;

CREATE TABLE registro_modifiche (
  id               INTEGER PRIMARY KEY,
  quando           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  autore           TEXT,                     -- per ora sempre NULL: servirà con il login dei redattori
  azione           TEXT NOT NULL CHECK (azione IN ('creazione', 'modifica', 'eliminazione', 'ripristino')),
  oggetto          TEXT NOT NULL CHECK (oggetto IN ('cammino', 'tappa', 'luogo', 'cartina', 'stile', 'immagine', 'pubblicazione')),
  oggetto_id       TEXT,
  cammino_id       INTEGER,                  -- per la cronologia di un cammino; senza vincolo: può non esistere più
  titolo           TEXT NOT NULL,            -- nome dell'oggetto al momento della modifica
  descrizione      TEXT NOT NULL,            -- la modifica in una frase
  dati_precedenti  TEXT                      -- JSON di ciò che è stato eliminato
) STRICT;
CREATE INDEX registro_modifiche_quando ON registro_modifiche(quando);
CREATE INDEX registro_modifiche_cammino ON registro_modifiche(cammino_id);

CREATE TABLE registro_errori (
  id         INTEGER PRIMARY KEY,
  quando     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  origine    TEXT NOT NULL,                  -- 'pagina', 'pubblicazione', 'importazione', 'backup'
  messaggio  TEXT NOT NULL,
  percorso   TEXT,
  dettagli   TEXT
) STRICT;
CREATE INDEX registro_errori_quando ON registro_errori(quando);
