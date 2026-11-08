// Prepara la demo del portale da caricare su un server (per esempio con FileZilla): aggiorna il portale di
// prova e copia in pubblicazione/ la pagina (index.html), i dati, i cammini e il satellite.
// Come il pulsante «Prepara la demo» della pagina «Pubblicazione». Uso: npm run prepara-demo
import { apriDatabase } from './connessione.ts';
import { applicaMigrazioni } from './migra.ts';
import { preparaDemo } from '../src/lib/server/pubblicazione.ts';

const db = apriDatabase();
applicaMigrazioni(db);
const esito = await preparaDemo(db);
db.close();
console.log(`Demo pronta in ${esito.cartella}: ${esito.file} file, ${(esito.byte / 1024 / 1024).toFixed(0)} MB`
  + (esito.satelliteCopiato ? ' (satellite copiato)' : ''));
esito.avvisi.forEach((a) => console.log(`  ${a}`));
console.log('Carica tutto il contenuto della cartella sul server: istruzioni in LEGGIMI.txt');
