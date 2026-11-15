// La legenda non copre mai le tappe: né nella panoramica né in nessuna tappa (insieme al fumetto). Si trascina dalla
// maniglia, con il mouse o con la tastiera, e con un doppio clic (o Invio) torna nel suo angolo.
import { cerchioTocca, expect, siToccano, test } from './portale.ts';

test('la legenda non copre i segnaposto nella panoramica né la tappa corrente e il suo fumetto', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const legenda = () => portale.legenda.boundingBox();
  for (const [i, pn] of (await page.locator('.pin .pn').all()).entries()) {
    expect(siToccano((await legenda())!, (await pn.boundingBox())!), `segnaposto ${i + 1} sotto la legenda nella panoramica`).toBe(false);
  }
  for (const [i, tappa] of portale.dati.cammino.tappe.entries()) {
    await portale.successiva();
    await test.step(`tappa ${i + 1}: ${tappa.nome}`, async () => {
      await expect(portale.fumetto).toBeVisible();
      await portale.attendi(); // la legenda cambia angolo dopo che compare il fumetto
      const l = (await legenda())!;
      expect(siToccano(l, (await portale.segnaposto(i).boundingBox())!), 'segnaposto della tappa sotto la legenda').toBe(false);
      expect(siToccano(l, (await portale.fumetto.boundingBox())!), 'fumetto sotto la legenda').toBe(false);
      // e il fumetto non copre il segnaposto della sua tappa (anche quando è in colonna, in Canaan)
      const pn = (await portale.segnaposto(i).locator('.pn').boundingBox())!;
      expect(cerchioTocca((await portale.fumetto.boundingBox())!, pn), 'segnaposto della tappa sotto il suo fumetto').toBe(false);
    });
  }
});

test('la legenda si trascina dalla maniglia e con un doppio clic torna nel suo angolo', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const maniglia = page.locator('#maniglia-legenda');
  const prima = (await portale.legenda.boundingBox())!;
  const m = (await maniglia.boundingBox())!;
  await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
  await page.mouse.down();
  await page.mouse.move(m.x + 250, m.y + 180, { steps: 8 });
  await page.mouse.up();
  const dopo = (await portale.legenda.boundingBox())!;
  expect(dopo.x - prima.x).toBeGreaterThan(150);
  expect(dopo.y - prima.y).toBeGreaterThan(100);
  // spostata a mano, resta dov'è anche passando a una tappa
  await portale.successiva();
  const ferma = (await portale.legenda.boundingBox())!;
  expect(Math.abs(ferma.x - dopo.x) + Math.abs(ferma.y - dopo.y)).toBeLessThan(2);
  await maniglia.dblclick();
  await portale.attendi();
  const tornata = (await portale.legenda.boundingBox())!;
  expect(Math.abs(tornata.x - prima.x) + Math.abs(tornata.y - prima.y)).toBeLessThan(2);
});

test('con la tastiera: frecce sulla maniglia per spostarla, Invio per rimetterla a posto', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const maniglia = page.locator('#maniglia-legenda');
  const prima = (await portale.legenda.boundingBox())!;
  await maniglia.focus();
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('ArrowDown');
  const dopo = (await portale.legenda.boundingBox())!;
  expect(Math.round(dopo.x - prima.x)).toBe(0);
  expect(Math.round(dopo.y - prima.y)).toBe(76);
  await page.keyboard.press('Enter');
  const tornata = (await portale.legenda.boundingBox())!;
  expect(Math.abs(tornata.x - prima.x) + Math.abs(tornata.y - prima.y)).toBeLessThan(2);
});

// Le frecce ← → fanno avanzare il racconto, ma non quando servono ad altro (fino al 2026-11-14 cambiavano tappa anche
// spostando la legenda o la carta con la tastiera)
test('le frecce sulla maniglia della legenda non cambiano tappa', async ({ portale, page }) => {
  await portale.apri();
  await portale.tappaDallElenco(2);
  const titolo = await page.locator('#title').textContent();
  await page.locator('#maniglia-legenda').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await portale.attendi();
  await expect(page.locator('#title')).toHaveText(titolo!, { timeout: 2_000 });
});

test('le frecce sulla carta selezionata la spostano senza cambiare tappa', async ({ portale, page }) => {
  await portale.apri();
  await portale.tappaDallElenco(2);
  const titolo = await page.locator('#title').textContent();
  const centro = () => page.evaluate(() => (window as any).__mappa.getCenter().lng as number);
  const prima = await centro();
  await page.locator('#map canvas').focus();
  await page.keyboard.press('ArrowRight');
  await portale.attendi();
  await expect(page.locator('#title')).toHaveText(titolo!);
  expect(await centro()).toBeGreaterThan(prima); // la carta si è spostata verso est
  // fuori dalla carta, le frecce tornano a cambiare tappa
  await page.locator('#stops button').nth(2).focus();
  await page.keyboard.press('ArrowRight');
  await portale.attendi();
  await expect(page.locator('#title')).toHaveText(portale.dati.cammino.tappe[3].nome);
});
