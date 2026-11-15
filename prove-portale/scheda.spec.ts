// La scheda della tappa: si apre dal segnaposto, con titolo, luogo, testo e (se ci sono) le immagini; la galleria
// si sfoglia con frecce, miniature e tasti ← →; il clic sull'immagine la apre a tutto schermo con lo zoom.
import type { Tappa } from '../condiviso/cammino.ts';
import { expect, test } from './portale.ts';

test('dal segnaposto si apre la scheda della tappa; si chiude con la ×, con Esc e con un clic fuori', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const { tappe } = portale.dati.cammino;
  // la prima tappa senza immagini (o la prima): finestra stretta con il solo testo
  const i = Math.max(0, tappe.findIndex((t) => !t.immagini.length));
  const tappa = tappe[i];
  await portale.segnaposto(i).click();
  await expect(portale.scheda).toBeVisible();
  await expect(page.locator('#scheda-occhiello')).toHaveText(`Tappa ${i + 1} di ${tappe.length}`);
  await expect(page.locator('#scheda-titolo')).toHaveText(tappa.nome);
  await expect(page.locator('#scheda-luogo')).toHaveText([tappa.luogoAttuale, tappa.riferimento].filter(Boolean).join(' · '));
  await expect(page.locator('#scheda-testo')).toHaveText(tappa.approfondimento ?? tappa.testo);
  // il clic sul segnaposto porta anche alla tappa, nel pannello
  await expect(page.locator('#title')).toHaveText(tappa.nome);
  if (!tappa.immagini.length) {
    await expect(portale.scheda).toHaveClass(/solo-testo/);
    await expect(page.locator('#scheda-palco')).toBeHidden();
  }
  await page.getByRole('button', { name: 'Chiudi la scheda' }).click();
  await expect(portale.scheda).toBeHidden();
  // con la scheda aperta le frecce della tastiera non cambiano tappa; Esc la chiude
  await portale.segnaposto(i).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#title')).toHaveText(tappa.nome);
  await page.keyboard.press('Escape');
  await expect(portale.scheda).toBeHidden();
  // un clic sullo sfondo, fuori dalla finestra
  await portale.segnaposto(i).click();
  await page.mouse.click(5, 5);
  await expect(portale.scheda).toBeHidden();
});

test('le immagini delle schede si caricano tutte, con didascalia e crediti', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const { tappe } = portale.dati.cammino;
  const conImmagini = tappe.map((t, i) => [t, i] as const).filter(([t]) => t.immagini.length);
  test.skip(!conImmagini.length, 'nessuna tappa ha immagini');
  for (const [tappa, i] of conImmagini) {
    await test.step(tappa.nome, async () => {
      // il clic su un segnaposto porta la carta su quella tappa: per il prossimo si riparte dalla panoramica
      await portale.vediCammino();
      await portale.segnaposto(i).click();
      await expect(portale.scheda).not.toHaveClass(/solo-testo/);
      for (const [n, immagine] of tappa.immagini.entries()) {
        if (n) await page.locator('#scheda-dopo').click();
        const img = page.locator('#scheda-img');
        await expect(img).toHaveAttribute('src', new RegExp(`${immagine.src.replace(/[.]/g, '\\.')}$`));
        await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
        await expect(page.locator('#scheda-didascalia')).toHaveText(immagine.didascalia ?? '');
        await expect(page.locator('#scheda-crediti')).toHaveText(immagine.crediti ?? '');
      }
      // una sola immagine: niente frecce, contatore e miniature
      if (tappa.immagini.length === 1) {
        await expect(page.locator('#scheda-dopo')).toBeHidden();
        await expect(page.locator('#scheda-miniature')).toBeHidden();
      }
      await page.keyboard.press('Escape');
    });
  }
});

// I dati di oggi hanno al massimo un'immagine per tappa: la galleria di più immagini si prova dando a una tappa tre
// immagini (le stesse, con altre didascalie) nel cammino.json che arriva alla pagina. Il file non cambia.
const tre = (tappa: Tappa, tutte: Tappa['immagini']) => {
  tappa.immagini = [0, 1, 2].map((k) => ({ ...tutte[k % tutte.length], didascalia: `Immagine di prova ${k + 1}`, alt: `Prova ${k + 1}` }));
};

test('la galleria di più immagini: frecce, miniature, tasti ← → e tutto schermo con lo zoom', async ({ portale, page }) => {
  const i = 0;
  await portale.apri({
    cambiaDati: (c) => {
      const tutte = c.tappe.flatMap((t) => t.immagini);
      if (tutte.length) tre(c.tappe[i], tutte);
    }
  });
  test.skip(!portale.dati.cammino.tappe[i].immagini.length, 'il cammino non ha immagini da usare');
  await portale.vediCammino();
  await portale.segnaposto(i).click();
  const contatore = page.locator('#scheda-contatore'), didascalia = page.locator('#scheda-didascalia');
  await expect(contatore).toHaveText('1 / 3');
  await expect(didascalia).toHaveText('Immagine di prova 1');
  await expect(page.locator('#scheda-miniature button')).toHaveCount(3);
  await page.locator('#scheda-dopo').click();
  await expect(contatore).toHaveText('2 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(contatore).toHaveText('3 / 3');
  await page.locator('#scheda-dopo').click(); // dopo l'ultima si ricomincia
  await expect(contatore).toHaveText('1 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(contatore).toHaveText('3 / 3');
  await page.locator('#scheda-miniature button').nth(1).click();
  await expect(contatore).toHaveText('2 / 3');
  await expect(page.locator('#scheda-miniature button').nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(didascalia).toHaveText('Immagine di prova 2');

  // tutto schermo: si apre con il clic sull'immagine, si ingrandisce, si sfoglia, si chiude con Esc
  await page.locator('#scheda-ingrandisci').click();
  const lente = page.locator('#lente'), livello = page.locator('#lente-livello');
  await expect(lente).toBeVisible();
  await expect(livello).toHaveText('100%');
  await page.locator('#lente-piu').click();
  await expect(livello).not.toHaveText('100%');
  await page.locator('#lente-adatta').click();
  await expect(livello).toHaveText('100%');
  await page.locator('#lente-dopo').click();
  await expect(contatore).toHaveText('3 / 3');
  await page.keyboard.press('Escape');
  await expect(lente).toBeHidden();
  await expect(portale.scheda).toBeVisible(); // la scheda resta aperta sotto
});
