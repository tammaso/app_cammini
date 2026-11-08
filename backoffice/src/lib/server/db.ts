import type { DatabaseSync } from 'node:sqlite';
import { apriDatabase } from '../../../db/connessione.ts';
import { applicaMigrazioni } from '../../../db/migra.ts';

// Una sola connessione per processo, anche quando Vite ricarica i moduli in sviluppo.
const globale = globalThis as typeof globalThis & { camminiDb?: DatabaseSync };

function connetti(): DatabaseSync {
  const db = apriDatabase();
  applicaMigrazioni(db);
  return db;
}

export const db: DatabaseSync = (globale.camminiDb ??= connetti());
