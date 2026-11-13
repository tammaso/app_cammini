// Prove del database e della pubblicazione, su un database in memoria.
// Uso: npm test
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { apriDatabase } from './connessione.ts';
import { applicaMigrazioni } from './migra.ts';
import { aggiornaTappa, creaCammino, creaTappa, eliminaTappa, elencaTappe, leggiTappa, spostaTappa } from '../src/lib/server/cammini.ts';

const CARTELLA_MIGRAZIONI = fileURLToPath(new URL('migrazioni', import.meta.url));
import { importaCartina } from '../src/lib/server/cartine.ts';
import { creaLuogo, eliminaLuogo } from '../src/lib/server/luoghi.ts';
import { componiCammino } from '../src/lib/server/pubblicazione.ts';
import { generaCartina } from '../src/lib/server/importazione-svg.ts';
import { eliminaNome, leggiNomi, modificaNome, ripristinaNome, spostaNome } from '../src/lib/server/ritocchi.ts';
import { gruppiDiTesto, type Disegno, type Testo } from '../src/lib/disegno.ts';

function databaseDiProva() {
  const db = apriDatabase(':memory:');
  applicaMigrazioni(db);
  const luogo = (nome: string, lng: number, lat: number) => {
    const esito = creaLuogo(db, { nome, nomeAntico: null, nomeAttuale: null, altriNomi: [], lat, lng, tipo: 'citta', certezza: 'certa', nota: null });
    assert.ok(esito.ok);
    return esito.id;
  };
  const a = luogo('Alfa', 10, 40), b = luogo('Beta', 11, 41), c = luogo('Gamma', 12, 42);
  const cammino = creaCammino(db, {
    slug: 'prova', titolo: 'Il cammino di prova', nome: 'Cammino di prova', sottotitolo: null, globoLuogo: null,
    globoTesto: 'Globo', panoramicaTesto: 'Panoramica', etichette: [], ordine: 0, stato: 'bozza',
  });
  assert.ok(cammino.ok);
  const tappa = (nome: string, luogoId: number) => creaTappa(db, cammino.id, {
    nome, breve: nome, breveOggi: null, luogoId, luogoAttuale: null, riferimento: null, testo: `Testo di ${nome}`, approfondimento: null, immagini: [], secondaria: false,
  });
  const tappe = [tappa('Alfa', a), tappa('Beta', b), tappa('Gamma', c)];
  // tracciati che partono dalla tappa precedente e arrivano alla successiva
  db.prepare('UPDATE tappe SET tracciato = ? WHERE id = ?').run(JSON.stringify([[10, 40], [10.5, 40.6], [11, 41]]), tappe[1]);
  db.prepare('UPDATE tappe SET tracciato = ? WHERE id = ?').run(JSON.stringify([[11, 41], [11.5, 41.4], [12, 42]]), tappe[2]);
  return { db, camminoId: cammino.id, tappe, luoghi: { a, b, c } };
}

test('il cammino si compone nel formato del portale, con i tracciati', () => {
  const { db, camminoId } = databaseDiProva();
  const { cammino, avvisi } = componiCammino(db, camminoId, '2026-01-01T00:00:00Z');
  assert.deepEqual(avvisi, []);
  assert.equal(cammino.id, 'prova');
  assert.deepEqual(cammino.tappe.map((t) => t.coordinate), [[10, 40], [11, 41], [12, 42]]);
  assert.equal(cammino.tappe[0].tracciato, null);
  assert.equal(cammino.tappe[2].tracciato?.length, 3);
});

test("la galleria della scheda si pubblica nell'ordine scelto, con le miniature e l'avviso per i crediti mancanti", () => {
  const { db, camminoId, tappe, luoghi } = databaseDiProva();
  const immagine = (sha: string, alt: string, crediti: string | null, didascalia: string | null) => Number(db.prepare(
    `INSERT INTO immagini (file, sha256, larghezza, altezza, alt, crediti, didascalia) VALUES (?, ?, 800, 600, ?, ?, ?)`,
  ).run(`originali/${sha}.jpg`, sha, alt, crediti, didascalia).lastInsertRowid);
  const uno = immagine('a'.repeat(64), 'Ziqqurat', 'Foto A', 'La ziqqurat di Ur');
  const due = immagine('b'.repeat(64), 'Scavi', null, null);
  const scheda = { nome: 'Alfa', breve: 'Alfa', breveOggi: null, luogoId: luoghi.a, luogoAttuale: null, riferimento: null, testo: 'Testo di Alfa', approfondimento: null, secondaria: false };
  aggiornaTappa(db, tappe[0], { ...scheda, immagini: [due, uno] });
  aggiornaTappa(db, tappe[1], { ...scheda, nome: 'Beta', breve: 'Beta', luogoId: luoghi.b, immagini: [uno] });
  assert.deepEqual(leggiTappa(db, tappe[0])?.immagini, [due, uno]);
  assert.deepEqual(elencaTappe(db, camminoId).map((t) => t.immagini), [2, 1, 0]);

  const { cammino, immagini, avvisi } = componiCammino(db, camminoId);
  assert.deepEqual(cammino.tappe[0].immagini.map((i) => [i.alt, i.didascalia]), [['Scavi', null], ['Ziqqurat', 'La ziqqurat di Ur']]);
  assert.equal(cammino.tappe[1].immagini[0].src, 'immagini/aaaaaaaaaaaa.webp');
  assert.equal(cammino.tappe[1].immagini[0].miniatura, 'immagini/aaaaaaaaaaaa-mini.webp');
  assert.deepEqual(cammino.tappe[2].immagini, []);
  // ogni immagine si pubblica una volta sola, grande e piccola, anche se due tappe la usano
  assert.equal(immagini.length, 4);
  assert.equal(avvisi.length, 1);
  assert.match(avvisi[0], /Tappa 1 \(Alfa\).*«Scavi».*crediti/);

  // eliminando la tappa se ne va anche la sua galleria, non le immagini dell'archivio
  eliminaTappa(db, tappe[0]);
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM tappe_immagini').get()!.n), 1);
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM immagini').get()!.n), 2);
});

test("la migrazione 007 porta l'immagine di ogni tappa nella sua galleria", () => {
  // database fermo alla migrazione 006, con una tappa che ha l'immagine nella vecchia colonna
  const prima = mkdtempSync(join(tmpdir(), 'migrazioni-'));
  for (const nome of readdirSync(CARTELLA_MIGRAZIONI).filter((n) => n < '007')) copyFileSync(join(CARTELLA_MIGRAZIONI, nome), join(prima, nome));
  const db = apriDatabase(':memory:');
  applicaMigrazioni(db, prima);
  rmSync(prima, { recursive: true });
  db.exec(`INSERT INTO luoghi (id, nome, lat, lng, tipo, certezza) VALUES (1, 'Ur', 30.96, 46.1, 'citta', 'certa');
    INSERT INTO immagini (id, file, sha256, larghezza, altezza, alt) VALUES (5, 'originali/x.jpg', 'x', 10, 10, 'Ur');
    INSERT INTO cammini (id, slug, titolo, nome) VALUES (1, 'abramo', 'Il cammino di Abramo', 'Cammino di Abramo');
    INSERT INTO tappe (id, cammino_id, posizione, nome, breve, breve_oggi, luogo_id, testo, immagine_id)
      VALUES (7, 1, 0, 'Ur dei Caldei', 'Ur', 'Tell el-Muqayyar', 1, 'Testo', 5), (8, 1, 1, 'Carran', 'Carran', NULL, 1, 'Testo', NULL);
    UPDATE cammini SET ritorno_tappa_id = 7 WHERE id = 1;`);
  applicaMigrazioni(db);
  assert.deepEqual(leggiTappa(db, 7)?.immagini, [5]);
  assert.equal(leggiTappa(db, 7)?.breveOggi, 'Tell el-Muqayyar');
  assert.deepEqual(leggiTappa(db, 8)?.immagini, []);
  assert.ok(!db.prepare('PRAGMA table_info(tappe)').all().some((c) => c.name === 'immagine_id'));
  // le chiavi esterne verso le tappe funzionano ancora: il ritorno si azzera, la galleria se ne va
  db.exec('DELETE FROM tappe WHERE id = 7');
  assert.equal(db.prepare('SELECT ritorno_tappa_id FROM cammini WHERE id = 1').get()!.ritorno_tappa_id, null);
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM tappe_immagini').get()!.n), 0);
});

test('spostando le tappe, i tracciati che non tornano diventano linee dritte, con un avviso', () => {
  const { db, camminoId, tappe } = databaseDiProva();
  spostaTappa(db, tappe[2], -1); // Gamma prima di Beta
  assert.deepEqual(elencaTappe(db, camminoId).map((t) => t.nome), ['Alfa', 'Gamma', 'Beta']);
  const { cammino, avvisi } = componiCammino(db, camminoId);
  assert.equal(avvisi.length, 2);
  assert.equal(cammino.tappe[1].tracciato, null);
  spostaTappa(db, tappe[2], 1); // e di nuovo al suo posto
  assert.deepEqual(componiCammino(db, camminoId).avvisi, []);
});

test("eliminando una tappa le successive scalano, e un luogo usato non si elimina", () => {
  const { db, camminoId, tappe, luoghi } = databaseDiProva();
  assert.equal(eliminaLuogo(db, luoghi.b).ok, false);
  eliminaTappa(db, tappe[1]);
  assert.deepEqual(elencaTappe(db, camminoId).map((t) => [t.posizione, t.nome]), [[0, 'Alfa'], [1, 'Gamma']]);
  assert.equal(eliminaLuogo(db, luoghi.b).ok, true);
});

test("una nuova importazione sostituisce solo ciò che era importato e lascia gli stili del redattore", () => {
  const { db, camminoId } = databaseDiProva();
  const cartina = (colore: string) => ({
    stili: [{ id: 'regno', tipo: 'area' as const, nome: 'Regno', riempimento: colore, opacita: 0.8, contorno: null, spessore: 1 }],
    elementi: { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: { stile: 'regno', nome: 'Regno', origine: 'importato' as const }, geometry: { type: 'Polygon', coordinates: [[[10, 40], [11, 40], [11, 41], [10, 40]]] } }] },
    nomi: [['regno', 'Regno', 10.5, 40.5, 3] as [string, string, number, number, number]],
    alone: { type: 'FeatureCollection' as const, features: [] },
  });
  importaCartina(db, { camminoId, epoca: '1000ac', pulsante: '1000 a.C.', anno: -1000, fonte: 'prova.svg', cartina: cartina('#aa0000') });
  db.prepare("UPDATE stili SET colore = '#00aa00'").run(); // il redattore cambia il colore
  const id = Number(db.prepare('SELECT id FROM cartine').get()!.id);
  db.prepare("INSERT INTO nomi (cartina_id, categoria, testo, lng, lat, zoom, origine) VALUES (?, 'regione-antica', 'Scritto a mano', 10, 40, 3, 'disegnato')").run(id);
  const esito = importaCartina(db, { camminoId, epoca: '1000ac', pulsante: 'ignorato', anno: 0, fonte: 'prova.svg', cartina: cartina('#aa0000') });
  assert.equal(esito.nuova, false);
  assert.equal(String(db.prepare('SELECT colore FROM stili').get()!.colore), '#00aa00');
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM nomi').get()!.n), 2);
  assert.equal(Number(db.prepare('SELECT count(*) AS n FROM elementi').get()!.n), 1);
  const { cammino, cartine } = componiCammino(db, camminoId);
  assert.deepEqual(cammino.epoche, [{ id: '1000ac', pulsante: '1000 a.C.', anno: -1000, cartina: '1000ac.json' }]);
  assert.equal(cartine[0].dati.stili[0].tipo === 'area' && cartine[0].dati.stili[0].riempimento, '#00aa00');
});

test('i nomi ritoccati a mano restano come li ha lasciati il redattore anche rigenerando la cartina', async () => {
  const { db, camminoId } = databaseDiProva();
  importaCartina(db, {
    camminoId, epoca: '1000ac', pulsante: '1000 a.C.', anno: -1000, fonte: 'prova.svg',
    cartina: { stili: [], elementi: { type: 'FeatureCollection', features: [] }, nomi: [], alone: { type: 'FeatureCollection', features: [] } },
  });
  const id = Number(db.prepare('SELECT id FROM cartine').get()!.id);
  // un disegno con due scritte, classificate come regioni antiche, e quattro spilli agli angoli
  const scritta = (testo: string, x: number, y: number): Testo => ({
    testo, box: [x, y - 3, x + testo.length * 1.2, y + 3], inizio: [x, y], fine: [x + testo.length * 1.2, y], angolo: 0, colore: '#231f20', dimensione: 6,
  });
  const disegno: Disegno = { cornice: [0, 0, 100, 100], forme: [], testi: [scritta('PROVA', 40, 50), scritta('ALTRA', 70, 20)] };
  const [g1, g2] = gruppiDiTesto(disegno);
  const testi = { [g1.chiave]: { uso: 'nome', categoria: 'regione-antica', testo: 'Prova' }, [g2.chiave]: { uso: 'nome', categoria: 'regione-antica', testo: 'Altra' } };
  db.prepare('UPDATE cartine SET disegno = ?, classificazione = ? WHERE id = ?').run(JSON.stringify(disegno), JSON.stringify({ colori: {}, testi }), id);
  [[0, 0, 10, 42], [100, 0, 12, 42], [0, 100, 10, 40], [100, 100, 12, 40]].forEach(([sx, sy, lng, lat], i) => db.prepare(
    "INSERT INTO punti_controllo (cartina_id, posizione, nome, sx, sy, lng, lat, certezza, stato) VALUES (?, ?, ?, ?, ?, ?, ?, 'certa', 'manuale')",
  ).run(id, i, `Angolo ${i + 1}`, sx, sy, lng, lat));
  const tutti = () => leggiNomi(db, id);
  const nomi = () => tutti().filter((n) => n.testo !== 'Altra');

  await generaCartina(db, id);
  const [prima] = nomi();
  assert.deepEqual(tutti().map((n) => n.testo), ['Prova', 'Altra']);
  assert.equal(prima.origine, 'importato');
  spostaNome(db, id, prima.id, 11.5, 41.5);
  assert.equal(nomi()[0].origine, 'modificato');
  const esito = await generaCartina(db, id);
  assert.ok(esito.avvisi.some((a) => a.includes('ritoccati a mano')));
  assert.deepEqual(nomi().map((n) => [n.testo, n.lng, n.lat, n.origine]), [['Prova', 11.5, 41.5, 'modificato']]);

  // anche cambiando il testo: il nome si riconosce dalla scritta del disegno
  modificaNome(db, id, prima.id, { testo: 'Prova ritoccata', sotto: null, colore: '#0b2ee6', corpo: 18, sempre: true, angolo: 10, zoom: 3 });
  await generaCartina(db, id);
  assert.deepEqual(nomi().map((n) => [n.testo, n.colore, n.corpo, n.sempre, n.angolo]), [['Prova ritoccata', '#0b2ee6', 18, true, 10]]);

  // «Com'è nel disegno»: il ritocco si toglie e la generazione ricrea il nome, al suo posto nell'ordine
  ripristinaNome(db, id, prima.id);
  await generaCartina(db, id);
  assert.deepEqual(nomi().map((n) => [n.testo, n.lng, n.lat, n.origine]), [['Prova', prima.lng, prima.lat, 'importato']]);
  assert.deepEqual(tutti().map((n) => n.testo), ['Prova', 'Altra']);
  assert.throws(() => eliminaNome(db, id, nomi()[0].id), /solo i nomi aggiunti/);
});
