// Cammini e tappe: lettura, controllo dei moduli, salvataggio, ordine delle tappe.
import type { DatabaseSync } from 'node:sqlite';
import type { Coordinate, Etichetta } from '../../../../condiviso/cammino.ts';
import { inTransazione } from '../../../db/connessione.ts';
import type { Cammino, CamminoInElenco, Errori, Stato, Tappa, TappaInElenco } from '../cammini.ts';
import { adesso, facoltativo, intero, testo, valoriDi } from './moduli.ts';
import { registraModifica } from './registro.ts';

const json = <T>(valore: unknown, riserva: T): T => (valore == null ? riserva : (JSON.parse(String(valore)) as T));
const opz = (valore: unknown) => (valore == null ? null : String(valore));

// --- Cammini --------------------------------------------------------------------------------------

export function elencaCammini(db: DatabaseSync): CamminoInElenco[] {
  return db.prepare(`SELECT c.*, (SELECT count(*) FROM tappe t WHERE t.cammino_id = c.id) AS tappe,
      (SELECT count(*) FROM cartine k WHERE k.cammino_id = c.id) AS cartine
    FROM cammini c ORDER BY c.ordine, c.titolo COLLATE NOCASE`).all().map((r) => ({
    id: Number(r.id), slug: String(r.slug), titolo: String(r.titolo), stato: String(r.stato) as Stato,
    ordine: Number(r.ordine), tappe: Number(r.tappe), cartine: Number(r.cartine), modificatoIl: String(r.modificato_il),
  }));
}

export function leggiCammino(db: DatabaseSync, id: number): Cammino | undefined {
  const r = db.prepare('SELECT * FROM cammini WHERE id = ?').get(id);
  if (!r) return undefined;
  return {
    id: Number(r.id), slug: String(r.slug), titolo: String(r.titolo), nome: String(r.nome), sottotitolo: opz(r.sottotitolo),
    globoLuogo: opz(r.globo_luogo), globoTesto: String(r.globo_testo), panoramicaTesto: String(r.panoramica_testo),
    etichette: json(r.etichette, []), frecce: json(r.frecce, []), ordine: Number(r.ordine),
    ritornoTappaId: r.ritorno_tappa_id == null ? null : Number(r.ritorno_tappa_id),
    stato: String(r.stato) as Stato, modificatoIl: String(r.modificato_il),
  };
}

// Le etichette scritte a mano si scrivono una per riga: «mare; Mar Mediterraneo; 31.6, 33.7»
// (tipo, testo, longitudine e latitudine).
export const etichetteInTesto = (etichette: Etichetta[]) =>
  etichette.map((e) => `${e.tipo}; ${e.testo}; ${e.coordinate[0]}, ${e.coordinate[1]}`).join('\n');

export function etichetteDaTesto(righe: string): { etichette: Etichetta[]; errore: string | null } {
  const etichette: Etichetta[] = [];
  for (const [n, riga] of righe.split(/\r?\n/).entries()) {
    if (!riga.trim()) continue;
    const [tipo, nome, coordinate] = riga.split(';').map((s) => s.trim());
    const [lng, lat] = (coordinate ?? '').split(',').map((s) => Number(s.trim()));
    if (!['mare', 'fiume', 'regione'].includes(tipo) || !nome || !Number.isFinite(lng) || !Number.isFinite(lat)
      || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      return { etichette, errore: `Riga ${n + 1}: scrivi «tipo; testo; longitudine, latitudine», con tipo mare, fiume o regione.` };
    }
    etichette.push({ tipo: tipo as Etichetta['tipo'], testo: nome, coordinate: [lng, lat] });
  }
  return { etichette, errore: null };
}

const CAMPI_CAMMINO = ['slug', 'titolo', 'nome', 'sottotitolo', 'globoLuogo', 'globoTesto', 'panoramicaTesto', 'etichette', 'ordine', 'stato'] as const;
export type CampoCammino = (typeof CAMPI_CAMMINO)[number];
export type DatiCammino = Omit<Cammino, 'id' | 'frecce' | 'ritornoTappaId' | 'modificatoIl'>;

export type EsitoModulo<D, K extends string> =
  | { ok: true; dati: D }
  | { ok: false; errori: Errori<K>; valori: Record<K, string> };

export function validaCammino(modulo: FormData, nuovo: boolean): EsitoModulo<DatiCammino, CampoCammino> {
  const valori = valoriDi(modulo, CAMPI_CAMMINO);
  const errori: Errori<CampoCammino> = {};
  if (nuovo && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(valori.slug)) {
    errori.slug = 'Solo lettere minuscole senza accenti, numeri e trattini: per esempio «mose» o «paolo-di-tarso».';
  }
  if (!valori.titolo) errori.titolo = 'Il titolo è obbligatorio.';
  if (!valori.nome) errori.nome = 'Il nome è obbligatorio: compare nella legenda.';
  const ordine = valori.ordine ? intero(modulo, 'ordine') : 0;
  if (ordine === null) errori.ordine = 'Un numero intero.';
  const stato = valori.stato === 'pubblicato' ? 'pubblicato' : 'bozza';
  const { etichette, errore } = etichetteDaTesto(valori.etichette);
  if (errore) errori.etichette = errore;
  if (Object.keys(errori).length) return { ok: false, errori, valori };
  return {
    ok: true,
    dati: {
      slug: valori.slug, titolo: valori.titolo, nome: valori.nome, sottotitolo: facoltativo(modulo, 'sottotitolo'),
      globoLuogo: facoltativo(modulo, 'globoLuogo'), globoTesto: valori.globoTesto, panoramicaTesto: valori.panoramicaTesto,
      etichette, ordine: ordine ?? 0, stato,
    },
  };
}

export function creaCammino(db: DatabaseSync, d: DatiCammino): { ok: true; id: number } | { ok: false; errori: Errori<CampoCammino> } {
  if (db.prepare('SELECT 1 FROM cammini WHERE slug = ?').get(d.slug)) {
    return { ok: false, errori: { slug: 'Questo indirizzo è già di un altro cammino.' } };
  }
  const { lastInsertRowid } = db.prepare(`INSERT INTO cammini (slug, titolo, nome, sottotitolo, globo_luogo, globo_testo,
      panoramica_testo, etichette, ordine, stato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(d.slug, d.titolo, d.nome, d.sottotitolo, d.globoLuogo, d.globoTesto, d.panoramicaTesto, JSON.stringify(d.etichette), d.ordine, d.stato);
  const id = Number(lastInsertRowid);
  registraModifica(db, { azione: 'creazione', oggetto: 'cammino', oggettoId: id, camminoId: id, titolo: d.titolo, descrizione: 'Cammino creato' });
  return { ok: true, id };
}

export function aggiornaCammino(db: DatabaseSync, id: number, d: DatiCammino): void {
  db.prepare(`UPDATE cammini SET titolo = ?, nome = ?, sottotitolo = ?, globo_luogo = ?, globo_testo = ?, panoramica_testo = ?,
      etichette = ?, ordine = ?, stato = ?, modificato_il = ? WHERE id = ?`)
    .run(d.titolo, d.nome, d.sottotitolo, d.globoLuogo, d.globoTesto, d.panoramicaTesto, JSON.stringify(d.etichette), d.ordine,
      d.stato, adesso(), id);
  registraModifica(db, { azione: 'modifica', oggetto: 'cammino', oggettoId: id, camminoId: id, titolo: d.titolo, descrizione: 'Testi o impostazioni del cammino modificati' });
}

// Si elimina il cammino con tutte le sue tappe e cartine; nel registro restano i dati, per sapere che cosa c'era.
export function eliminaCammino(db: DatabaseSync, id: number): void {
  const cammino = leggiCammino(db, id);
  if (!cammino) return;
  inTransazione(db, () => {
    const tappe = elencaTappe(db, id).map((t) => leggiTappa(db, t.id));
    db.prepare('DELETE FROM cammini WHERE id = ?').run(id);
    registraModifica(db, {
      azione: 'eliminazione', oggetto: 'cammino', oggettoId: id, camminoId: id, titolo: cammino.titolo,
      descrizione: 'Cammino eliminato, con tappe e cartine', datiPrecedenti: { cammino, tappe },
    });
  });
}

// Dopo l'ultima tappa il cammino può tornare a una tappa precedente (null: finisce all'ultima). Il tracciato
// del ritorno si rifà alla prossima generazione della cartina.
export function impostaRitorno(db: DatabaseSync, camminoId: number, tappaId: number | null): void {
  const tappe = elencaTappe(db, camminoId);
  const valida = tappaId != null && tappe.slice(0, -1).some((t) => t.id === tappaId);
  const verso = valida ? tappe.find((t) => t.id === tappaId)! : null;
  const c = leggiCammino(db, camminoId)!;
  if ((c.ritornoTappaId ?? null) === (verso?.id ?? null)) return;
  db.prepare('UPDATE cammini SET ritorno_tappa_id = ?, ritorno_tracciato = NULL, modificato_il = ? WHERE id = ?').run(verso?.id ?? null, adesso(), camminoId);
  registraModifica(db, {
    azione: 'modifica', oggetto: 'cammino', oggettoId: camminoId, camminoId, titolo: c.titolo,
    descrizione: verso ? `Dopo l'ultima tappa il cammino torna a «${verso.nome}»` : "Il cammino finisce all'ultima tappa, senza ritorno",
  });
}

const toccaCammino = (db: DatabaseSync, id: number) => db.prepare('UPDATE cammini SET modificato_il = ? WHERE id = ?').run(adesso(), id);

// --- Tappe ----------------------------------------------------------------------------------------

export function elencaTappe(db: DatabaseSync, camminoId: number): TappaInElenco[] {
  return db.prepare(`SELECT t.id, t.posizione, t.nome, t.breve, t.riferimento, l.nome AS luogo,
      coalesce(json_array_length(t.tracciato), 0) AS punti, t.immagine_id IS NOT NULL AS immagine
    FROM tappe t JOIN luoghi l ON l.id = t.luogo_id WHERE t.cammino_id = ? ORDER BY t.posizione`).all(camminoId).map((r) => ({
    id: Number(r.id), posizione: Number(r.posizione), nome: String(r.nome), breve: String(r.breve), luogo: String(r.luogo),
    riferimento: opz(r.riferimento), puntiTracciato: Number(r.punti), immagine: Boolean(r.immagine),
  }));
}

export function leggiTappa(db: DatabaseSync, id: number): Tappa | undefined {
  const r = db.prepare('SELECT * FROM tappe WHERE id = ?').get(id);
  if (!r) return undefined;
  return {
    id: Number(r.id), camminoId: Number(r.cammino_id), posizione: Number(r.posizione), nome: String(r.nome), breve: String(r.breve),
    luogoId: Number(r.luogo_id), luogoAttuale: opz(r.luogo_attuale), riferimento: opz(r.riferimento), testo: String(r.testo),
    approfondimento: opz(r.approfondimento), immagineId: r.immagine_id == null ? null : Number(r.immagine_id),
    tracciato: json<Coordinate[] | null>(r.tracciato, null), secondaria: Boolean(r.secondaria),
  };
}

const CAMPI_TAPPA = ['nome', 'breve', 'luogoId', 'luogoAttuale', 'riferimento', 'testo', 'approfondimento', 'immagineId', 'secondaria'] as const;
export type CampoTappa = (typeof CAMPI_TAPPA)[number];
export type DatiTappa = Omit<Tappa, 'id' | 'camminoId' | 'posizione' | 'tracciato'>;

export function validaTappa(db: DatabaseSync, modulo: FormData): EsitoModulo<DatiTappa, CampoTappa> {
  const valori = valoriDi(modulo, CAMPI_TAPPA);
  const errori: Errori<CampoTappa> = {};
  if (!valori.nome) errori.nome = 'Il nome è obbligatorio.';
  if (!valori.breve) errori.breve = 'Il nome breve è obbligatorio: compare accanto al pin.';
  else if (valori.breve.length > 24) errori.breve = 'Al massimo 24 caratteri: sta accanto al pin.';
  const luogoId = intero(modulo, 'luogoId');
  if (luogoId === null || !db.prepare('SELECT 1 FROM luoghi WHERE id = ?').get(luogoId)) {
    errori.luogoId = "Scegli il luogo dall'anagrafe: le coordinate vengono da lì.";
  }
  if (!valori.testo) errori.testo = 'Il testo del pannello è obbligatorio.';
  const immagineId = valori.immagineId ? intero(modulo, 'immagineId') : null;
  if (valori.immagineId && (immagineId === null || !db.prepare('SELECT 1 FROM immagini WHERE id = ?').get(immagineId))) {
    errori.immagineId = "L'immagine scelta non è nell'archivio.";
  }
  if (Object.keys(errori).length) return { ok: false, errori, valori };
  return {
    ok: true,
    dati: {
      nome: valori.nome, breve: valori.breve, luogoId: luogoId!, luogoAttuale: facoltativo(modulo, 'luogoAttuale'),
      riferimento: facoltativo(modulo, 'riferimento'), testo: valori.testo, approfondimento: facoltativo(modulo, 'approfondimento'),
      immagineId, secondaria: modulo.get('secondaria') === 'on',
    },
  };
}

export function creaTappa(db: DatabaseSync, camminoId: number, d: DatiTappa): number {
  return inTransazione(db, () => {
    const posizione = Number(db.prepare('SELECT coalesce(max(posizione) + 1, 0) AS n FROM tappe WHERE cammino_id = ?').get(camminoId)!.n);
    const { lastInsertRowid } = db.prepare(`INSERT INTO tappe (cammino_id, posizione, nome, breve, luogo_id, luogo_attuale, riferimento,
        testo, approfondimento, immagine_id, secondaria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(camminoId, posizione, d.nome, d.breve, d.luogoId, d.luogoAttuale, d.riferimento, d.testo, d.approfondimento, d.immagineId, d.secondaria ? 1 : 0);
    toccaCammino(db, camminoId);
    const id = Number(lastInsertRowid);
    registraModifica(db, { azione: 'creazione', oggetto: 'tappa', oggettoId: id, camminoId, titolo: d.nome, descrizione: `Tappa aggiunta, in posizione ${posizione + 1}` });
    return id;
  });
}

export function aggiornaTappa(db: DatabaseSync, id: number, d: DatiTappa): void {
  const tappa = leggiTappa(db, id)!;
  db.prepare(`UPDATE tappe SET nome = ?, breve = ?, luogo_id = ?, luogo_attuale = ?, riferimento = ?, testo = ?, approfondimento = ?,
      immagine_id = ?, secondaria = ? WHERE id = ?`)
    .run(d.nome, d.breve, d.luogoId, d.luogoAttuale, d.riferimento, d.testo, d.approfondimento, d.immagineId, d.secondaria ? 1 : 0, id);
  toccaCammino(db, tappa.camminoId);
  registraModifica(db, { azione: 'modifica', oggetto: 'tappa', oggettoId: id, camminoId: tappa.camminoId, titolo: d.nome, descrizione: 'Tappa modificata' });
}

// Il tracciato dalla tappa precedente torna una linea dritta (per esempio dopo aver spostato le tappe).
export function togliTracciato(db: DatabaseSync, id: number): void {
  const tappa = leggiTappa(db, id)!;
  db.prepare('UPDATE tappe SET tracciato = NULL WHERE id = ?').run(id);
  toccaCammino(db, tappa.camminoId);
  registraModifica(db, {
    azione: 'modifica', oggetto: 'tappa', oggettoId: id, camminoId: tappa.camminoId, titolo: tappa.nome,
    descrizione: 'Tracciato tolto: dalla tappa precedente una linea dritta', datiPrecedenti: { tracciato: tappa.tracciato },
  });
}

export function eliminaTappa(db: DatabaseSync, id: number): void {
  const tappa = leggiTappa(db, id);
  if (!tappa) return;
  inTransazione(db, () => {
    db.prepare('DELETE FROM tappe WHERE id = ?').run(id);
    // le tappe successive scalano di un posto (una alla volta: la posizione è unica)
    const successive = db.prepare('SELECT id, posizione FROM tappe WHERE cammino_id = ? AND posizione > ? ORDER BY posizione')
      .all(tappa.camminoId, tappa.posizione);
    for (const r of successive) db.prepare('UPDATE tappe SET posizione = ? WHERE id = ?').run(Number(r.posizione) - 1, Number(r.id));
    toccaCammino(db, tappa.camminoId);
    registraModifica(db, {
      azione: 'eliminazione', oggetto: 'tappa', oggettoId: id, camminoId: tappa.camminoId, titolo: tappa.nome,
      descrizione: 'Tappa eliminata', datiPrecedenti: tappa,
    });
  });
}

// Scambia la tappa con quella prima (-1) o dopo (+1). I tracciati restano: se non partono più dalla
// tappa precedente, la pubblicazione li sostituisce con una linea dritta e lo segnala.
export function spostaTappa(db: DatabaseSync, id: number, verso: -1 | 1): void {
  const tappa = leggiTappa(db, id);
  if (!tappa) return;
  const vicina = db.prepare('SELECT id FROM tappe WHERE cammino_id = ? AND posizione = ?').get(tappa.camminoId, tappa.posizione + verso);
  if (!vicina) return;
  inTransazione(db, () => {
    // la posizione è unica: la tappa passa prima da un posto libero, dopo l'ultima
    db.prepare('UPDATE tappe SET posizione = (SELECT max(posizione) + 1 FROM tappe WHERE cammino_id = ?) WHERE id = ?').run(tappa.camminoId, id);
    db.prepare('UPDATE tappe SET posizione = ? WHERE id = ?').run(tappa.posizione, Number(vicina.id));
    db.prepare('UPDATE tappe SET posizione = ? WHERE id = ?').run(tappa.posizione + verso, id);
    toccaCammino(db, tappa.camminoId);
    registraModifica(db, {
      azione: 'modifica', oggetto: 'tappa', oggettoId: id, camminoId: tappa.camminoId, titolo: tappa.nome,
      descrizione: `Tappa spostata dalla posizione ${tappa.posizione + 1} alla ${tappa.posizione + verso + 1}`,
    });
  });
}
