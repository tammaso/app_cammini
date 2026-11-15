-- Il registro delle modifiche annota anche i ripristini del database da una copia di backup (2026-11-14): oggetto
-- «database». SQLite non cambia il controllo di una colonna, quindi la tabella si ricostruisce (nessun'altra la richiama).

CREATE TABLE registro_modifiche_nuova (
  id               INTEGER PRIMARY KEY,
  quando           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  autore           TEXT,                     -- per ora sempre NULL: servirà con il login dei redattori
  azione           TEXT NOT NULL CHECK (azione IN ('creazione', 'modifica', 'eliminazione', 'ripristino')),
  oggetto          TEXT NOT NULL CHECK (oggetto IN ('cammino', 'tappa', 'luogo', 'cartina', 'stile', 'immagine', 'pubblicazione', 'database')),
  oggetto_id       TEXT,
  cammino_id       INTEGER,                  -- per la cronologia di un cammino; senza vincolo: può non esistere più
  titolo           TEXT NOT NULL,            -- nome dell'oggetto al momento della modifica
  descrizione      TEXT NOT NULL,            -- la modifica in una frase
  dati_precedenti  TEXT                      -- JSON di ciò che è stato eliminato
) STRICT;
INSERT INTO registro_modifiche_nuova SELECT * FROM registro_modifiche;
DROP TABLE registro_modifiche;
ALTER TABLE registro_modifiche_nuova RENAME TO registro_modifiche;
CREATE INDEX registro_modifiche_quando ON registro_modifiche(quando);
CREATE INDEX registro_modifiche_cammino ON registro_modifiche(cammino_id);
