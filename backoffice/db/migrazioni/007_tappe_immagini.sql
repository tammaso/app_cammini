-- chiavi esterne: sospese
-- Più immagini per tappa (2026-11-13): la scheda della tappa diventa una galleria, come la «Scopri»
-- dell'Atlante d'arte. Le immagini sono quelle dell'archivio, nell'ordine scelto (la prima è quella che
-- compare all'apertura); didascalia, testo alternativo e crediti restano dell'immagine, nell'archivio.
-- Le tappe che avevano un'immagine la tengono come prima (e unica) della galleria.
-- tappe.immagine_id se ne va: SQLite non toglie una colonna con chiave esterna, quindi la tabella si
-- ricostruisce con le chiavi esterne sospese (vedi migra.ts; cammini.ritorno_tappa_id la richiama).

CREATE TABLE tappe_immagini (
  id           INTEGER PRIMARY KEY,
  tappa_id     INTEGER NOT NULL REFERENCES tappe(id) ON DELETE CASCADE,
  posizione    INTEGER NOT NULL CHECK (posizione >= 0),
  immagine_id  INTEGER NOT NULL REFERENCES immagini(id),
  UNIQUE (tappa_id, posizione),
  UNIQUE (tappa_id, immagine_id)
) STRICT;
CREATE INDEX tappe_immagini_immagine ON tappe_immagini(immagine_id);

INSERT INTO tappe_immagini (tappa_id, posizione, immagine_id)
SELECT id, 0, immagine_id FROM tappe WHERE immagine_id IS NOT NULL;

CREATE TABLE tappe_nuova (
  id               INTEGER PRIMARY KEY,
  cammino_id       INTEGER NOT NULL REFERENCES cammini(id) ON DELETE CASCADE,
  posizione        INTEGER NOT NULL CHECK (posizione >= 0),
  nome             TEXT NOT NULL,            -- «Ebron e le Querce di Mamre»
  breve            TEXT NOT NULL,            -- accanto al pin: «Ebron»
  breve_oggi       TEXT,                     -- accanto al pin in «Oggi»: «Hebron» (vuoto: il nome breve)
  luogo_id         INTEGER NOT NULL REFERENCES luoghi(id),  -- le coordinate vengono dall'anagrafe
  luogo_attuale    TEXT,                     -- «Hebron, Cisgiordania»
  riferimento      TEXT,                     -- «Gen 13,18; 23»
  testo            TEXT NOT NULL,            -- nel pannello
  approfondimento  TEXT,                     -- nella scheda; vuoto: il testo del pannello
  -- dalla tappa precedente: [[lng, lat], ...]; vuoto: linea dritta
  tracciato        TEXT CHECK (tracciato IS NULL OR (json_valid(tracciato) AND json_type(tracciato) = 'array')),
  secondaria       INTEGER NOT NULL DEFAULT 0 CHECK (secondaria IN (0, 1)),  -- nome accanto al pin solo da vicino
  UNIQUE (cammino_id, posizione)
) STRICT;

INSERT INTO tappe_nuova (id, cammino_id, posizione, nome, breve, breve_oggi, luogo_id, luogo_attuale, riferimento,
  testo, approfondimento, tracciato, secondaria)
SELECT id, cammino_id, posizione, nome, breve, breve_oggi, luogo_id, luogo_attuale, riferimento,
  testo, approfondimento, tracciato, secondaria FROM tappe;

DROP TABLE tappe;
ALTER TABLE tappe_nuova RENAME TO tappe;
CREATE INDEX tappe_luogo ON tappe(luogo_id);
