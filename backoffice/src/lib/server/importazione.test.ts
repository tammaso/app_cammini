// Prove dell'importazione delle cartine: testi ricomposti e percorso diviso tra le tappe.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gruppiDiTesto, type Disegno, type Testo } from '../disegno.ts';
import { tracciaPercorso } from './percorso.ts';

// un pezzo di testo orizzontale largo 1,2 per carattere, con corpo 6
const pezzo = (testo: string, x: number, y: number, angolo = 0): Testo => ({
  testo, box: [x, y - 3, x + testo.length * 1.2, y + 3], inizio: [x, y], fine: [x + testo.length * 1.2, y], angolo, colore: '#231f20', dimensione: 6,
});

test('i pezzi di testo si ricompongono in parole, con gli spazi dove servono e le righe separate', () => {
  const d: Disegno = {
    cornice: [0, 0, 100, 100], forme: [],
    testi: [
      pezzo('C', 10, 10), pezzo('A', 11.2, 10), pezzo('N', 12.4, 10), // lettere attaccate
      pezzo('Sotto', 10, 20), pezzo('Ha', 17.6, 20), pezzo('mmurabi', 20, 20), // uno spazio tra «Sotto» e «Ha»
      pezzo('REGNO', 10, 40), pezzo("D'EGITTO", 10, 48), // due righe
    ],
  };
  assert.deepEqual(gruppiDiTesto(d).map((g) => g.testo), ['CAN', 'Sotto Hammurabi', 'REGNO', "D'EGITTO"]);
});

test('il percorso segue il verso delle frecce: andata su una linea, ritorno sull\'altra', () => {
  const linea = (y: number, da: number, a: number) => Array.from({ length: 21 }, (_, i): [number, number] => [da + ((a - da) * i) / 20, y]);
  const nord = linea(0.1, 0, 1), sud = linea(-0.1, 1, 0); // la linea sud è disegnata da est a ovest
  const frecce = [{ coordinate: [0.5, 0.1] as [number, number], rotazione: 90 }, { coordinate: [0.5, -0.1] as [number, number], rotazione: -90 }];
  const { tracciati, avvisi } = tracciaPercorso([nord, sud], [[0, 0], [1, 0], [0, 0]], frecce);
  assert.deepEqual(avvisi, []);
  const latitudineMedia = (t: [number, number][] | null) => t!.slice(5, -5).reduce((s, p) => s + p[1], 0) / (t!.length - 10);
  assert.ok(latitudineMedia(tracciati[0]) > 0.05, "l'andata va verso est sulla linea nord");
  assert.ok(latitudineMedia(tracciati[1]) < -0.05, 'il ritorno va verso ovest sulla linea sud');
  assert.deepEqual(tracciati[0]![0], [0, 0]); // ogni tracciato parte e arriva esattamente sulle tappe
  assert.deepEqual(tracciati[0]!.at(-1), [1, 0]);
});
