// Applica in ordine le migrazioni di db/migrazioni non ancora eseguite.
// Uso: npm run migra
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { apriDatabase, inTransazione, PERCORSO_DB } from './connessione.ts';

const CARTELLA_MIGRAZIONI = fileURLToPath(new URL('migrazioni', import.meta.url));

export function applicaMigrazioni(db: DatabaseSync, cartella: string = CARTELLA_MIGRAZIONI): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS migrazioni (
    nome         TEXT PRIMARY KEY,
    applicata_il TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  ) STRICT`);

  const applicate = new Set(
    db.prepare('SELECT nome FROM migrazioni').all().map((riga) => String(riga.nome)),
  );
  const daApplicare = readdirSync(cartella)
    .filter((nome) => /^\d{3}_.+\.sql$/.test(nome) && !applicate.has(nome))
    .sort();

  for (const nome of daApplicare) {
    const sql = readFileSync(join(cartella, nome), 'utf8');
    // Una migrazione che ricostruisce una tabella richiamata da altre comincia con
    // «-- chiavi esterne: sospese»: gira senza i controlli delle chiavi esterne (che non si possono
    // cambiare dentro una transazione), poi le si ricontrolla tutte prima di confermare.
    const sospese = sql.startsWith('-- chiavi esterne: sospese');
    if (sospese) db.exec('PRAGMA foreign_keys = OFF');
    try {
      inTransazione(db, () => {
        db.exec(sql);
        const violazioni = sospese ? db.prepare('PRAGMA foreign_key_check').all() : [];
        if (violazioni.length) {
          throw new Error(`${nome}: chiavi esterne non valide, per esempio ${JSON.stringify({ ...violazioni[0] })}`);
        }
        db.prepare('INSERT INTO migrazioni (nome) VALUES (?)').run(nome);
      });
    } finally {
      if (sospese) db.exec('PRAGMA foreign_keys = ON');
    }
  }
  return daApplicare;
}

if (import.meta.main) {
  const db = apriDatabase();
  const applicate = applicaMigrazioni(db);
  console.log(applicate.length
    ? `Applicate a ${PERCORSO_DB}:\n  ${applicate.join('\n  ')}`
    : `Nessuna migrazione da applicare (${PERCORSO_DB}).`);
  db.close();
}
