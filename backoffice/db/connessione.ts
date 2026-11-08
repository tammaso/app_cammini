import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Percorsi calcolati dall'URL del modulo: funzionano sia con node sia dentro Vite.
export const PERCORSO_DB = process.env.CAMMINI_DB ?? fileURLToPath(new URL('../dati/cammini.db', import.meta.url));

export function apriDatabase(percorso: string = PERCORSO_DB): DatabaseSync {
  if (percorso !== ':memory:') mkdirSync(dirname(percorso), { recursive: true });
  const db = new DatabaseSync(percorso);
  // SQLite non controlla le chiavi esterne se non lo si chiede a ogni connessione.
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  return db;
}

// Dentro una transazione già aperta si usa un savepoint: un'operazione composta (per esempio il
// caricamento dei dati del prototipo) può chiamare funzioni che hanno già la loro transazione.
let livello = 0;
export function inTransazione<T>(db: DatabaseSync, operazione: () => T): T {
  const annidata = db.isTransaction;
  const punto = `annidata_${++livello}`;
  db.exec(annidata ? `SAVEPOINT ${punto}` : 'BEGIN');
  try {
    const risultato = operazione();
    db.exec(annidata ? `RELEASE ${punto}` : 'COMMIT');
    return risultato;
  } catch (errore) {
    db.exec(annidata ? `ROLLBACK TO ${punto}; RELEASE ${punto}` : 'ROLLBACK');
    throw errore;
  } finally {
    livello--;
  }
}
