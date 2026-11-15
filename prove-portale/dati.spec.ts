// I file pubblicati dal backoffice (prototipo/cammini/) rispettano il contratto condiviso/cammino.ts e sono coerenti:
// ogni cammino dell'indice ha la sua cartella, le cartine e le immagini esistono, i tracciati partono dalla tappa
// precedente e arrivano alla tappa. Senza browser: si leggono i file.
// Quello che è contenuto della redazione (testi alternativi, crediti delle immagini) non blocca le prove: se manca,
// compare come avviso nel rapporto.
import { existsSync } from 'node:fs';
import { test as base } from '@playwright/test';
import { CARTELLA_CAMMINI, datiCammino, expect, indice } from './portale.ts';

const test = base;
const valida = ([lng, lat]: [number, number]) => Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
const vicini = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 1e-4;
const avviso = (testo: string) => test.info().annotations.push({ type: 'avviso', description: testo });

test('l\'indice elenca almeno un cammino, ognuno con la sua cartella', () => {
  expect(indice.versione).toBe(1);
  expect(indice.cammini.length).toBeGreaterThan(0);
  for (const c of indice.cammini) {
    expect(c.id).toMatch(/^[a-z0-9_-]+$/);
    expect(existsSync(`${CARTELLA_CAMMINI}${c.id}/cammino.json`), `${c.id}/cammino.json`).toBe(true);
  }
});

for (const voce of indice.cammini) {
  test.describe(voce.titolo, () => {
    const { cammino, cartine } = datiCammino(voce.id);

    test('testi e tappe', () => {
      expect(cammino.id).toBe(voce.id);
      expect(cammino.titolo).toBe(voce.titolo);
      for (const campo of [cammino.titolo, cammino.nome, cammino.globo.testo, cammino.panoramica.testo]) expect(campo.trim()).not.toBe('');
      expect(cammino.tappe.length).toBeGreaterThan(0);
      for (const [i, t] of cammino.tappe.entries()) {
        const dove = `tappa ${i + 1} (${t.nome})`;
        for (const campo of [t.nome, t.breve, t.testo]) expect(campo?.trim(), dove).toBeTruthy();
        expect(valida(t.coordinate), `${dove}: coordinate`).toBe(true);
        if (!t.luogoAttuale) avviso(`${dove}: manca il luogo attuale (il fumetto mostra solo il nome)`);
      }
    });

    test('ogni tracciato parte dalla tappa precedente e arriva alla tappa', () => {
      for (const [i, t] of cammino.tappe.entries()) {
        if (i === 0 || !t.tracciato?.length) continue; // senza tracciato: linea dritta
        const dove = `tappa ${i + 1} (${t.nome})`;
        expect(t.tracciato.every(valida), `${dove}: coordinate del tracciato`).toBe(true);
        expect(vicini(t.tracciato[0], cammino.tappe[i - 1].coordinate), `${dove}: il tracciato non parte dalla tappa precedente`).toBe(true);
        expect(vicini(t.tracciato.at(-1)!, t.coordinate), `${dove}: il tracciato non arriva alla tappa`).toBe(true);
      }
      if (cammino.ritorno) {
        expect(cammino.tappe[cammino.ritorno.verso], 'tappa del ritorno').toBeTruthy();
      }
    });

    test('le immagini delle schede esistono', () => {
      for (const [i, t] of cammino.tappe.entries()) {
        for (const [n, im] of t.immagini.entries()) {
          const dove = `tappa ${i + 1} (${t.nome}), immagine ${n + 1}`;
          expect(existsSync(`${CARTELLA_CAMMINI}${cammino.id}/${im.src}`), `${dove}: ${im.src}`).toBe(true);
          expect(existsSync(`${CARTELLA_CAMMINI}${cammino.id}/${im.miniatura}`), `${dove}: ${im.miniatura}`).toBe(true);
          if (!im.alt?.trim()) avviso(`${dove}: manca il testo alternativo (chi usa un lettore di schermo non sa che cosa mostra)`);
          if (!im.crediti?.trim()) avviso(`${dove}: mancano i crediti`);
        }
      }
    });

    test('le epoche e le loro cartine', () => {
      const anni = cammino.epoche.map((e) => e.anno);
      expect(anni, 'epoche in ordine di anno').toEqual([...anni].sort((a, b) => a - b));
      for (const e of cammino.epoche) {
        const cartina = cartine[e.id];
        expect(cartina.versione).toBe(1);
        const stili = new Set(cartina.stili.map((s) => s.id));
        expect(stili.size, `${e.id}: stili con lo stesso nome`).toBe(cartina.stili.length);
        for (const f of cartina.elementi.features) expect(stili.has(f.properties.stile), `${e.id}: stile «${f.properties.stile}» inesistente`).toBe(true);
        for (const [tipo, nome, lng, lat, zoom] of cartina.nomi) {
          expect(nome.trim(), `${e.id}: nome vuoto (${tipo})`).not.toBe('');
          expect(valida([lng, lat]) && zoom >= 0, `${e.id}: «${nome}»`).toBe(true);
        }
        expect(cartina.alone.features.length, `${e.id}: alone`).toBeGreaterThan(0);
      }
    });

    test('frecce e nomi scritti a mano', () => {
      for (const f of cammino.frecce) expect(valida(f.coordinate) && f.rotazione >= -360 && f.rotazione <= 360).toBe(true);
      for (const e of cammino.etichette) {
        expect(['mare', 'fiume', 'regione']).toContain(e.tipo);
        expect(valida(e.coordinate), e.testo).toBe(true);
      }
    });
  });
}
