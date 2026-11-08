// Aggiorna il portale di prova (prototipo/cammini/) con i cammini del database, come il pulsante della
// pagina «Pubblicazione». Uso: npm run pubblica
import { apriDatabase } from './connessione.ts';
import { applicaMigrazioni } from './migra.ts';
import { pubblicaPortale, CARTELLA_PORTALE } from '../src/lib/server/pubblicazione.ts';

const db = apriDatabase();
applicaMigrazioni(db);
const esito = await pubblicaPortale(db);
db.close();
console.log(`Pubblicato in ${CARTELLA_PORTALE}: ${esito.cammini.map((c) => c.slug).join(', ') || 'nessun cammino'}`);
console.log(`  immagini generate: ${esito.immaginiGenerate}, file vecchi rimossi: ${esito.fileRimossi}`);
esito.cammini.flatMap((c) => c.avvisi.map((a) => `  ${c.titolo}: ${a}`)).forEach((a) => console.log(a));
