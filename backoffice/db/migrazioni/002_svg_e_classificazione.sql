-- Importazione delle cartine SVG nel backoffice (2026-11-08).
-- La cartina conserva il file consegnato dal cartografo, il disegno estratto dal file (forme e testi
-- con le coordinate sul foglio) e la classificazione scelta dal redattore: quale colore è quale stile
-- (o il percorso del cammino, o niente) e quale testo è quale nome.

ALTER TABLE cartine ADD COLUMN svg TEXT;              -- file nell'archivio: cartine/<sha256>.svg
ALTER TABLE cartine ADD COLUMN disegno TEXT CHECK (disegno IS NULL OR json_valid(disegno));
ALTER TABLE cartine ADD COLUMN classificazione TEXT NOT NULL DEFAULT '{"colori":{},"testi":{}}'
  CHECK (json_valid(classificazione));
ALTER TABLE cartine ADD COLUMN generata_il TEXT;      -- ultima generazione dal disegno, nel backoffice

-- Un'area si può ritagliare sulle terre emerse: nelle cartine i mari sono spesso disegnati sopra i regni,
-- che quindi «debordano» in mare. Le aree già importate erano ritagliate così, tranne l'arco della
-- Mezzaluna, che passa anche sul mare.
ALTER TABLE stili ADD COLUMN ritaglio INTEGER NOT NULL DEFAULT 0 CHECK (ritaglio IN (0, 1));
UPDATE stili SET ritaglio = 1 WHERE tipo = 'area' AND chiave <> 'mezzaluna';
