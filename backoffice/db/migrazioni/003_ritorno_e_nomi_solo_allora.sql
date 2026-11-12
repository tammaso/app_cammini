-- Ritorno dopo l'ultima tappa e nomi antichi dei mari (2026-11-12, nuova cartina di Abramo).

-- Dopo l'ultima tappa il cammino può tornare a una tappa precedente: Abramo da Mòria torna a Bersabea.
-- Il tracciato del ritorno, come quello delle tappe, viene dal percorso della cartina (vuoto: linea dritta).
ALTER TABLE cammini ADD COLUMN ritorno_tappa_id INTEGER REFERENCES tappe(id) ON DELETE SET NULL;
ALTER TABLE cammini ADD COLUMN ritorno_tracciato TEXT
  CHECK (ritorno_tracciato IS NULL OR (json_valid(ritorno_tracciato) AND json_type(ritorno_tracciato) = 'array'));

-- I nomi di geografia fisica della cartina (regioni, mari, vette) compaiono anche in «Oggi». Non quelli
-- che sono nomi antichi (Mare Inferiore, Mare Salato): per loro anche_oggi = 0. NULL: secondo la categoria.
ALTER TABLE nomi ADD COLUMN anche_oggi INTEGER CHECK (anche_oggi IS NULL OR anche_oggi IN (0, 1));
