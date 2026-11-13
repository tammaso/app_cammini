-- Nomi della cartina con il loro colore, il corpo e la visibilità (2026-11-13, richiesta della redazione).
-- colore: quello della scritta nel disegno (#rrggbb); corpo: grandezza in pixel, se diversa da quella della
-- categoria (MEZZALUNA FERTILE più grande); sempre: il nome compare sempre, anche dove si sovrappone ad altro
-- (Canaan, schiacciata tra la costa e le tappe).
ALTER TABLE nomi ADD COLUMN colore TEXT CHECK (colore IS NULL OR colore GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]');
ALTER TABLE nomi ADD COLUMN corpo REAL CHECK (corpo IS NULL OR corpo BETWEEN 6 AND 60);
ALTER TABLE nomi ADD COLUMN sempre INTEGER NOT NULL DEFAULT 0 CHECK (sempre IN (0, 1));
