// Il racconto: globo → panoramica → tappe una alla volta, con «Precedente», «Successiva», l'elenco e la tastiera.
// L'epoca non cambia mai da sola passando da un passo all'altro: solo il globo torna su «Oggi».
import { expect, test } from './portale.ts';

test('«Visualizza il cammino» porta alla panoramica: solo testo, tutte le tappe bianche', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const { cammino } = portale.dati;
  await expect(page.locator('#text')).toHaveText(cammino.panoramica.testo);
  await expect(page.locator('#kicker')).toHaveText('');
  await expect(page.locator('#title')).toHaveText('');
  await expect(page.locator('#count')).toHaveText('');
  await expect(page.locator('#map')).not.toHaveClass(/hide-pins/);
  await expect(page.locator('.pin.current')).toHaveCount(0);
  await expect(page.locator('.pin.future')).toHaveCount(cammino.tappe.length);
  // il tracciato si vede tutto, tratteggiato, con le frecce; niente ancora di percorso
  expect(await portale.visibilita('route-preview')).toBe('visible');
  expect(await portale.visibilita('frecce')).toBe('visible');
  expect(await portale.filtro('route-done')).toEqual(['<', ['get', 'i'], 0]);
  await expect(portale.fumetto).toHaveCount(0);
  await expect(page.locator('#prev')).toBeEnabled();
});

test('«Successiva» segue le tappe una alla volta fino all\'ultima', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const { tappe } = portale.dati.cammino;
  for (const [i, tappa] of tappe.entries()) {
    await portale.successiva();
    await test.step(`tappa ${i + 1}: ${tappa.nome}`, async () => {
      await expect(page.locator('#kicker')).toHaveText(`Tappa ${i + 1} di ${tappe.length}`);
      await expect(page.locator('#title')).toHaveText(tappa.nome);
      await expect(page.locator('#text')).toHaveText(tappa.testo);
      await expect(page.locator('#count')).toHaveText(`${i + 1} / ${tappe.length}`);
      // la tappa corrente è rossa, quelle già fatte sono «percorse», le altre bianche
      await expect(portale.segnaposto(i)).toHaveClass(/\bcurrent\b/);
      await expect(page.locator('.pin.visited')).toHaveCount(i);
      await expect(page.locator('.pin.future')).toHaveCount(tappe.length - i - 1);
      await expect(page.locator('#stops button').nth(i)).toHaveAttribute('aria-current', 'step');
      // la linea continua arriva fino a questa tappa, e il segnaposto diventa blu
      expect(await portale.filtro('route-done')).toEqual(['<=', ['get', 'i'], i]);
      await expect(portale.segnaposto(i)).toHaveClass(/\barrivata\b/);
      // il fumetto: il nome della tappa e sotto «Oggi» con il luogo attuale
      await expect(portale.fumetto.locator('h3')).toHaveText(tappa.nome);
      if (tappa.luogoAttuale) await expect(portale.fumetto.locator('p')).toHaveText(`Oggi ${tappa.luogoAttuale}`);
      else await expect(portale.fumetto.locator('p')).toHaveCount(0);
    });
  }
  await expect(page.locator('#next')).toBeDisabled();
});

test('«Precedente», l\'elenco delle tappe e le frecce della tastiera', async ({ portale, page }) => {
  await portale.apri();
  const { tappe } = portale.dati.cammino;
  const titolo = page.locator('#title');
  await portale.tappaDallElenco(2);
  await expect(titolo).toHaveText(tappe[2].nome);
  await portale.precedente();
  await expect(titolo).toHaveText(tappe[1].nome);
  await page.keyboard.press('ArrowRight');
  await portale.attendi();
  await expect(titolo).toHaveText(tappe[2].nome);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await portale.attendi();
  await expect(titolo).toHaveText(tappe[0].nome);
  // prima della prima tappa c'è la panoramica, poi il globo
  await page.keyboard.press('ArrowLeft');
  await portale.attendi();
  await expect(page.locator('#text')).toHaveText(portale.dati.cammino.panoramica.testo);
});

test('da una tappa, «Visualizza il cammino» torna alla panoramica senza tappe percorse', async ({ portale, page }) => {
  await portale.apri();
  await portale.tappaDallElenco(3);
  await portale.vediCammino();
  await expect(page.locator('#text')).toHaveText(portale.dati.cammino.panoramica.testo);
  await expect(page.locator('.pin.future')).toHaveCount(portale.dati.cammino.tappe.length);
  await expect(page.locator('.pin.arrivata')).toHaveCount(0);
  expect(await portale.filtro('route-done')).toEqual(['<', ['get', 'i'], 0]);
});

test('l\'epoca la sceglie chi guarda: resta passando di tappa in tappa, solo il globo torna su «Oggi»', async ({ portale }) => {
  await portale.apri();
  const storica = portale.dati.pulsanti[0];
  test.skip(storica === 'Oggi', 'il cammino non ha epoche storiche');
  await portale.vediCammino();
  await portale.epoca(storica);
  for (let i = 0; i < 3; i++) await portale.successiva();
  await portale.precedente();
  await expect(portale.pulsanteEpoca(storica)).toHaveAttribute('aria-pressed', 'true');
  await portale.vediCammino();
  await expect(portale.pulsanteEpoca(storica)).toHaveAttribute('aria-pressed', 'true');
  await portale.tornaAlGlobo();
  await expect(portale.pulsanteEpoca('Oggi')).toHaveAttribute('aria-pressed', 'true');
  await expect(portale.page.locator('#text')).toHaveText(portale.dati.cammino.globo.testo);
});
