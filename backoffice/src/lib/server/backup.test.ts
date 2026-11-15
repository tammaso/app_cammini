// Prove del backup e del ripristino, su un database e cartelle temporanee (nessun file del progetto viene toccato).
// Uso: npm test
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { apriDatabase } from '../../../db/connessione.ts';
import { applicaMigrazioni } from '../../../db/migra.ts';
import {
  CARTELLA_PREDEFINITA, backupDovuto, eseguiBackup, impostaBackupAutomatico, leggiImpostazioniBackup, ripristinaCopia, salvaCartellaBackup,
} from './backup.ts';
import { creaCammino } from './cammini.ts';
import { creaCartina } from './importazione-svg.ts';
import { creaLuogo } from './luoghi.ts';

const IMMAGINE = `originali/${'a'.repeat(64)}.jpg`, SVG = `${'b'.repeat(64)}.svg`;

// un database su file (servono per VACUUM INTO e ATTACH) con un cammino, un'immagine e una cartina con il suo SVG
function ambiente() {
  const base = mkdtempSync(join(tmpdir(), 'cammini-ripristino-'));
  const cartelle = {
    cartella: join(base, 'backup'), cartellaImmagini: join(base, 'immagini'), cartellaCartine: join(base, 'cartine'),
    cartellaTemporanea: join(base, 'temporanea'),
  };
  for (const c of Object.values(cartelle)) mkdirSync(c, { recursive: true });
  mkdirSync(join(cartelle.cartellaImmagini, 'originali'));
  const db = apriDatabase(join(base, 'cammini.db'));
  applicaMigrazioni(db);
  const cammino = creaCammino(db, {
    slug: 'prova', titolo: 'Il cammino di prova', nome: 'Cammino di prova', sottotitolo: null, globoLuogo: null,
    globoTesto: 'Globo', panoramicaTesto: 'Panoramica', etichette: [], ordine: 0, stato: 'bozza',
  });
  assert.ok(cammino.ok);
  db.prepare('INSERT INTO immagini (file, sha256, larghezza, altezza, alt) VALUES (?, ?, 800, 600, ?)').run(IMMAGINE, 'a'.repeat(64), 'Prova');
  writeFileSync(join(cartelle.cartellaImmagini, IMMAGINE), 'immagine');
  const cartina = creaCartina(db, cammino.id, { epoca: '1800ac', pulsante: '1800 a.C.', anno: -1800 });
  db.prepare('UPDATE cartine SET svg = ? WHERE id = ?').run(SVG, cartina);
  writeFileSync(join(cartelle.cartellaCartine, SVG), '<svg/>');
  salvaCartellaBackup(db, cartelle.cartella);
  impostaBackupAutomatico(db, true);
  const chiudi = () => { db.close(); rmSync(base, { recursive: true, force: true }); };
  return { db, cartelle, camminoId: cammino.id, chiudi };
}
const titolo = (db: DatabaseSync) => String(db.prepare('SELECT titolo FROM cammini').get()!.titolo);
const luogo = (db: DatabaseSync, nome: string) => {
  const esito = creaLuogo(db, { nome, nomeAntico: null, nomeAttuale: null, altriNomi: [], lat: 31, lng: 35, tipo: 'citta', certezza: 'certa', nota: null });
  assert.ok(esito.ok);
};
const ALLE_10 = new Date(2026, 0, 1, 10, 0, 0), ALLE_11 = new Date(2026, 0, 1, 11, 0, 0);

test('il ripristino riporta i dati della copia, salva prima lo stato attuale e rimette i file che mancano', async () => {
  const { db, cartelle, chiudi } = ambiente();
  try {
    const { file } = await eseguiBackup(db, { ...cartelle, adesso: ALLE_10 });
    const nome = file.split(/[\\/]/).at(-1)!;

    // dopo il backup: un titolo cambiato, un luogo nuovo, il backup automatico spento su questo PC, i file persi
    db.prepare("UPDATE cammini SET titolo = 'Titolo cambiato dopo'").run();
    luogo(db, 'Luogo nuovo');
    impostaBackupAutomatico(db, false);
    rmSync(join(cartelle.cartellaImmagini, IMMAGINE));
    rmSync(join(cartelle.cartellaCartine, SVG));
    const righePrima = Number(db.prepare('SELECT count(*) AS n FROM registro_modifiche').get()!.n);

    const esito = await ripristinaCopia(db, { ...cartelle, nome, adesso: ALLE_11 });
    assert.equal(titolo(db), 'Il cammino di prova');
    assert.equal(db.prepare("SELECT 1 FROM luoghi WHERE nome = 'Luogo nuovo'").get(), undefined);
    // le impostazioni restano quelle di questo PC
    assert.equal(leggiImpostazioniBackup(db).automatico, false);
    assert.equal(leggiImpostazioniBackup(db).cartella, cartelle.cartella);
    // i file tornano dal backup
    assert.deepEqual([esito.immaginiCopiate, esito.cartineCopiate], [1, 1]);
    assert.deepEqual([esito.immaginiMancanti, esito.cartineMancanti], [[], []]);
    assert.ok(existsSync(join(cartelle.cartellaImmagini, IMMAGINE)) && existsSync(join(cartelle.cartellaCartine, SVG)));
    // il registro tiene tutto (anche la creazione del luogo, che la copia non aveva) e annota il ripristino per ultimo
    const registro = db.prepare('SELECT azione, oggetto, titolo FROM registro_modifiche ORDER BY id').all();
    assert.equal(registro.length, righePrima + 1);
    assert.ok(registro.some((r) => r.oggetto === 'luogo' && r.titolo === 'Luogo nuovo'));
    assert.deepEqual({ ...registro.at(-1) }, { azione: 'ripristino', oggetto: 'database', titolo: nome });
    // le chiavi esterne tornano controllate, la cartella temporanea resta vuota
    assert.equal(Number(Object.values(db.prepare('PRAGMA foreign_keys').get()!)[0]), 1);
    assert.deepEqual(readdirSync(cartelle.cartellaTemporanea), []);

    // la copia di sicurezza c'è, e ripristinandola si annulla il ripristino
    assert.ok(readdirSync(join(cartelle.cartella, 'database')).includes(esito.sicurezza));
    await ripristinaCopia(db, { ...cartelle, nome: esito.sicurezza, adesso: new Date(2026, 0, 1, 12, 0, 0) });
    assert.equal(titolo(db), 'Titolo cambiato dopo');
    assert.ok(db.prepare("SELECT 1 FROM luoghi WHERE nome = 'Luogo nuovo'").get());
  } finally {
    chiudi();
  }
});

test('il ripristino rifiuta nomi non validi, file che non sono copie e copie di una versione più recente', async () => {
  const { db, cartelle, chiudi } = ambiente();
  try {
    const { file } = await eseguiBackup(db, { ...cartelle, adesso: ALLE_10 });
    const nome = file.split(/[\\/]/).at(-1)!;
    db.prepare("UPDATE cammini SET titolo = 'Titolo di adesso'").run();
    const copie = () => readdirSync(join(cartelle.cartella, 'database')).length;

    await assert.rejects(ripristinaCopia(db, { ...cartelle, nome: '..\\..\\cammini.db' }), /Copia non valida/);
    await assert.rejects(ripristinaCopia(db, { ...cartelle, nome: 'cammini-2020-01-01_00-00-00.db' }), /non c'è più/);

    // un database che non è dei cammini
    const estraneo = 'cammini-2026-01-01_09-00-00.db';
    const altro = new DatabaseSync(join(cartelle.cartella, 'database', estraneo));
    altro.exec('CREATE TABLE ricette (nome TEXT)');
    altro.close();
    await assert.rejects(ripristinaCopia(db, { ...cartelle, nome: estraneo }), /non è una copia del database dei cammini/);

    // una copia fatta da un backoffice più recente, con una migrazione che questo non conosce
    const futura = new DatabaseSync(file);
    futura.prepare("INSERT INTO migrazioni (nome) VALUES ('999_futuro.sql')").run();
    futura.close();
    await assert.rejects(ripristinaCopia(db, { ...cartelle, nome }), /versione più recente/);

    // nessun tentativo ha toccato il database né aggiunto copie di sicurezza
    assert.equal(titolo(db), 'Titolo di adesso');
    assert.equal(copie(), 2);
  } finally {
    chiudi();
  }
});

test('il backup automatico è acceso di serie, nella cartella predefinita finché non se ne sceglie una', () => {
  const db = apriDatabase(':memory:');
  applicaMigrazioni(db);
  const prima = leggiImpostazioniBackup(db);
  assert.deepEqual([prima.automatico, prima.predefinita, prima.cartella], [true, true, CARTELLA_PREDEFINITA]);
  assert.equal(backupDovuto(prima), true, 'mai fatto: la prima copia si fa subito');
  assert.equal(backupDovuto({ ...prima, ultimo: new Date(2026, 0, 1, 10).toISOString() }, new Date(2026, 0, 1, 20)), false);
  assert.equal(backupDovuto({ ...prima, ultimo: new Date(2026, 0, 1, 10).toISOString() }, new Date(2026, 0, 2, 11)), true);
  // spento da qualcuno resta spento; una cartella scelta prende il posto di quella di serie
  impostaBackupAutomatico(db, false);
  salvaCartellaBackup(db, 'D:\\Copie');
  const dopo = leggiImpostazioniBackup(db);
  assert.deepEqual([dopo.automatico, dopo.predefinita, dopo.cartella], [false, false, 'D:\\Copie']);
  assert.equal(backupDovuto(dopo), false);
  db.close();
});
