// Prove del database e della pubblicazione, su un database in memoria.
// Uso: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apriDatabase } from './connessione.ts';
import { applicaMigrazioni } from './migra.ts';
import { creaCammino, creaTappa, eliminaTappa, elencaTappe, spostaTappa } from '../src/lib/server/cammini.ts';
import { importaCartina } from '../src/lib/server/cartine.ts';
import { creaLuogo, eliminaLuogo } from '../src/lib/server/luoghi.ts';
import { componiCammino } from '../src/lib/server/pubblicazione.ts';

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
    nome, breve: nome, luogoId, luogoAttuale: null, riferimento: null, testo: `Testo di ${nome}`, approfondimento: null, immagineId: null, secondaria: false,
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
