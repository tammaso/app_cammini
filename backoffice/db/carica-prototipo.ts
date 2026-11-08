// Primo caricamento del database dai dati del prototipo: l'anagrafe di prova (prototipo/dati/luoghi.js),
// i cammini già pubblicati (prototipo/cammini/), gli spilli delle cartine (prototipo/cartine/*.punti.json)
// e le immagini delle schede. Si usa una volta sola, con il database ancora vuoto: da lì in poi i dati
// si modificano nel backoffice e il portale si aggiorna con la pubblicazione.
// Uso: npm run carica-prototipo
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Cammino, Cartina, Indice } from '../../condiviso/cammino.ts';
import { apriDatabase, inTransazione } from './connessione.ts';
import { applicaMigrazioni } from './migra.ts';
import { importaCartina, type PuntoImportato } from '../src/lib/server/cartine.ts';
import { aggiornaMetadati, caricaImmagine, CARTELLA_IMMAGINI } from '../src/lib/server/immagini.ts';

const PROTOTIPO = fileURLToPath(new URL('../../prototipo/', import.meta.url));
// Gli spilli di allinea.html di ogni cartina: <cammino>/<epoca> -> file
const SPILLI: Record<string, string> = { 'abramo/1700ac': 'cartine/mezzaluna_1700ac.punti.json' };

const leggiJSON = async <T>(percorso: string): Promise<T> => JSON.parse(await readFile(percorso, 'utf8')) as T;

const db = apriDatabase();
applicaMigrazioni(db);
if (Number(db.prepare('SELECT count(*) AS n FROM cammini').get()!.n) > 0) {
  console.error('Il database ha già dei cammini: il caricamento dal prototipo si fa una volta sola, con il database vuoto.');
  process.exit(1);
}

// 1. Anagrafe dei luoghi (dopo «const LUOGHI =» il file è JSON)
const testoLuoghi = await readFile(join(PROTOTIPO, 'dati', 'luoghi.js'), 'utf8');
const luoghi = JSON.parse(testoLuoghi.match(/const LUOGHI = (\[[\s\S]*\]);/)![1]) as
  { nome: string; altri: string[]; lat: number; lng: number; tipo: string; certezza: string; nota?: string }[];
const nuovoLuogo = db.prepare(`INSERT INTO luoghi (nome, altri_nomi, lat, lng, tipo, certezza, nota) VALUES (?, ?, ?, ?, ?, ?, ?)`);
inTransazione(db, () => {
  for (const l of luoghi) nuovoLuogo.run(l.nome, JSON.stringify(l.altri), l.lat, l.lng, l.tipo, l.certezza, l.nota ?? null);
});
console.log(`${luoghi.length} luoghi nell'anagrafe`);

// Il luogo di una tappa: quello dell'anagrafe che sta lì (entro un chilometro), o uno nuovo
function luogoDellaTappa(nome: string, [lng, lat]: [number, number]): number {
  const vicino = db.prepare(`SELECT id FROM luoghi WHERE abs(lat - ?) < 0.01 AND abs(lng - ?) < 0.01 ORDER BY abs(lat - ?) + abs(lng - ?) LIMIT 1`)
    .get(lat, lng, lat, lng);
  if (vicino) return Number(vicino.id);
  console.log(`  luogo nuovo nell'anagrafe per la tappa «${nome}»`);
  return Number(nuovoLuogo.run(nome, '[]', lat, lng, 'citta', 'certa', 'Aggiunto dal caricamento del prototipo: da controllare').lastInsertRowid);
}

// 2. Cammini, tappe, immagini e cartine
const indice = await leggiJSON<Indice>(join(PROTOTIPO, 'cammini', 'indice.json'));
for (const [ordine, voce] of indice.cammini.entries()) {
  const cartella = join(PROTOTIPO, 'cammini', voce.id);
  const c = await leggiJSON<Cammino>(join(cartella, 'cammino.json'));
  const camminoId = Number(db.prepare(`INSERT INTO cammini (slug, titolo, nome, sottotitolo, globo_luogo, globo_testo, panoramica_testo,
      etichette, frecce, ordine, stato) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bozza')`)
    .run(c.id, c.titolo, c.nome, c.sottotitolo, c.globo.luogo, c.globo.testo, c.panoramica.testo, JSON.stringify(c.etichette),
      JSON.stringify(c.frecce), ordine).lastInsertRowid);
  for (const [posizione, t] of c.tappe.entries()) {
    let immagineId: number | null = null;
    if (t.immagine) {
      const file = join(cartella, t.immagine.src);
      const esito = await caricaImmagine(db, CARTELLA_IMMAGINI, await readFile(file), basename(file));
      if (!esito.ok) throw new Error(`${file}: ${esito.messaggio}`);
      immagineId = esito.id;
      aggiornaMetadati(db, immagineId, { alt: t.immagine.alt, didascalia: null, crediti: t.immagine.crediti || null, licenza: null });
    }
    db.prepare(`INSERT INTO tappe (cammino_id, posizione, nome, breve, luogo_id, luogo_attuale, riferimento, testo, approfondimento,
        immagine_id, tracciato, secondaria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(camminoId, posizione, t.nome, t.breve, luogoDellaTappa(t.breve, t.coordinate), t.luogoAttuale, t.riferimento, t.testo,
        t.approfondimento, immagineId, t.tracciato ? JSON.stringify(t.tracciato) : null, t.secondaria ? 1 : 0);
  }
  console.log(`«${c.titolo}»: ${c.tappe.length} tappe`);
  for (const e of c.epoche) {
    const cartina = await leggiJSON<Cartina>(join(cartella, e.cartina));
    const spilli = SPILLI[`${c.id}/${e.id}`];
    const punti = spilli ? (await leggiJSON<{ punti: PuntoImportato[] }>(join(PROTOTIPO, spilli))).punti : undefined;
    const esito = importaCartina(db, { camminoId, epoca: e.id, pulsante: e.pulsante, anno: e.anno, fonte: cartina.fonte, cartina, punti });
    console.log(`  cartina ${e.pulsante}: ${esito.elementi} elementi, ${esito.nomi} nomi, ${punti?.length ?? 0} punti di controllo`);
    esito.avvisi.forEach((a) => console.log(`    attenzione: ${a}`));
  }
}
db.close();
console.log('Fatto. Ora: npm run backoffice');
