-- Nome breve della tappa nell'epoca «Oggi» (2026-11-14): accanto al pin, quando la carta mostra il mondo di oggi,
-- il nome moderno del luogo («Harran», «Nablus», «Hebron»). Vuoto: anche in «Oggi» il nome breve di sempre.
ALTER TABLE tappe ADD COLUMN breve_oggi TEXT;
