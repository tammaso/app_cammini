// Sul telefono (390 × 844, progetto «telefono»): la pagina sta nello schermo senza scorrere di lato, il racconto
// funziona, la scheda va a tutto schermo con la galleria sopra il testo.
import { cerchioTocca, expect, siToccano, test } from './portale.ts';

test('sul telefono il racconto funziona e la pagina non scorre di lato', async ({ portale, page }) => {
  await portale.apri();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await portale.vediCammino();
  await expect(page.locator('#text')).toHaveText(portale.dati.cammino.panoramica.testo);
  await portale.successiva();
  await expect(page.locator('#title')).toHaveText(portale.dati.cammino.tappe[0].nome);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('sul telefono gli strumenti di «Disegna» stanno in una riga sola, dentro lo schermo', async ({ portale, page }) => {
  await portale.apri();
  await page.getByRole('button', { name: 'Disegna' }).click();
  const pulsanti = await page.getByRole('toolbar', { name: 'Strumenti di disegno' }).getByRole('button').all();
  expect(pulsanti.length).toBe(9); // 3 strumenti, 4 colori, Annulla, Cancella tutto
  const riquadri = await Promise.all(pulsanti.map((b) => b.boundingBox()));
  const larghezza = page.viewportSize()!.width;
  for (const r of riquadri) {
    expect(r!.x).toBeGreaterThanOrEqual(0);
    expect(r!.x + r!.width).toBeLessThanOrEqual(larghezza);
    expect(Math.abs(r!.y - riquadri[0]!.y)).toBeLessThan(4);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('sul telefono la scheda va a tutto schermo, con le immagini sopra il testo', async ({ portale, page }) => {
  await portale.apri();
  const { tappe } = portale.dati.cammino;
  const i = tappe.findIndex((t) => t.immagini.length);
  test.skip(i < 0, 'nessuna tappa ha immagini');
  await portale.tappaDallElenco(i);
  // il clic arriva al segnaposto anche se qualcosa lo copre: che si veda lo controlla la prova qui sotto
  await portale.segnaposto(i).dispatchEvent('click');
  await expect(portale.scheda).toBeVisible();
  const scheda = (await portale.scheda.boundingBox())!;
  const schermo = page.viewportSize()!;
  expect(scheda.width).toBeGreaterThanOrEqual(schermo.width - 1);
  expect(scheda.height).toBeGreaterThanOrEqual(schermo.height - 1);
  const galleria = (await page.locator('#scheda-palco').boundingBox())!;
  const testo = (await page.locator('#scheda-testo').boundingBox())!;
  expect(galleria.y + galleria.height).toBeLessThanOrEqual(testo.y + 1);
});

// Fino al 2026-11-14, su 390 × 844, Sichem e Negheb finivano in fondo alla carta sotto il riquadro delle attribuzioni
// e Mamre usciva dal bordo destro. Nella panoramica e in ogni tappa, i segnaposto sulla carta devono potersi toccare.
test('sul telefono il segnaposto di ogni tappa si vede e si può toccare', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const { tappe } = portale.dati.cammino;
  const coperte: string[] = [];
  // il numero della tappa i è dentro la carta e non sta sotto le attribuzioni o il pannello
  const controlla = async (i: number, dove: string) => {
    const pn = (await portale.segnaposto(i).locator('.pn').boundingBox())!;
    const carta = (await page.locator('#map').boundingBox())!;
    const attribuzioni = (await page.locator('.maplibregl-ctrl-attrib').boundingBox())!;
    const pannello = (await portale.pannello.boundingBox())!;
    const dentro = pn.y >= carta.y && pn.y + pn.height <= carta.y + carta.height && pn.x >= carta.x && pn.x + pn.width <= carta.x + carta.width;
    const sotto = [attribuzioni, pannello].some((r) => siToccano(r, pn));
    if (!dentro || sotto) coperte.push(`${dove}: ${i + 1} ${tappe[i].nome} (${Math.round(pn.x)}, ${Math.round(pn.y)})`);
  };
  for (const i of tappe.keys()) await controlla(i, 'panoramica');
  for (const i of tappe.keys()) {
    await portale.successiva();
    await controlla(i, `tappa ${i + 1}`);
    // il fumetto della tappa non copre il suo segnaposto
    await expect(portale.fumetto).toBeVisible();
    const pn = (await portale.segnaposto(i).locator('.pn').boundingBox())!;
    if (cerchioTocca((await portale.fumetto.boundingBox())!, pn)) coperte.push(`tappa ${i + 1}: ${tappe[i].nome} sotto il suo fumetto`);
  }
  expect(coperte, 'segnaposto fuori dalla carta o coperti').toEqual([]);
});
