-- Ritocchi a mano della cartina (2026-11-13). Un nome importato che il redattore sposta o modifica nella
-- pagina «Ritocca» diventa «modificato», e una nuova generazione non lo ricrea: per riconoscerlo, ogni nome
-- importato ricorda la scritta del disegno da cui viene (la chiave del suo gruppo di testo, come nella
-- classificazione: «REGNODI@597,351»).
ALTER TABLE nomi ADD COLUMN chiave TEXT;
