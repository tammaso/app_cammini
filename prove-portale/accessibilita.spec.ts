// «Accessibilità» e «Aiuto» nella fascia in fondo: grandezza dei caratteri, tutto maiuscolo, carattere ad alta
// leggibilità (valgono subito, anche sulla carta, e restano nel browser); la guida «Come si segue il cammino».
import { expect, test } from './portale.ts';

const scala = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scala').trim());

test('le preferenze di lettura valgono subito, anche sulla carta, e restano ricaricando la pagina', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const testo = page.locator('#text');
  // il pannello si ingrandisce con «zoom»: conta l'altezza di una riga sullo schermo, non il corpo del carattere
  const grandezza = async () => (await page.locator('.tappe .section-title').boundingBox())!.height;
  const prima = await grandezza();
  const nomePrima = await page.locator('.pin .pl').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await page.getByRole('button', { name: 'Accessibilità' }).click();
  const finestra = page.locator('#preferenze');
  await expect(finestra).toBeVisible();
  // i quattro livelli, ognuno scritto nella sua grandezza
  await expect(finestra.locator('#acc-scala label')).toHaveText(['Normale', 'Grande', 'Più grande', 'Molto grande']);
  await finestra.getByRole('radio', { name: 'Molto grande' }).check();
  expect(await scala(page)).toBe('1.5');
  expect((await grandezza()) / prima).toBeCloseTo(1.5, 1);
  // anche i nomi accanto ai segnaposto crescono
  expect(await page.locator('.pin .pl').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(nomePrima);
  await finestra.getByRole('switch', { name: /Tutto maiuscolo/ }).check();
  await expect(page.locator('body')).toHaveClass(/maiuscolo/);
  expect(await testo.evaluate((el) => getComputedStyle(el).textTransform)).toBe('uppercase');
  await finestra.getByRole('switch', { name: /alta leggibilità/ }).check();
  await expect(page.locator('body')).toHaveClass(/leggibile/);
  await finestra.getByRole('button', { name: 'Fatto' }).click();
  await expect(finestra).toBeHidden();

  // le scelte restano nel browser di chi guarda
  await page.reload();
  await page.waitForFunction(() => (window as any).__mappa?.loaded());
  expect(await scala(page)).toBe('1.5');
  await expect(page.locator('body')).toHaveClass(/maiuscolo/);
  await expect(page.locator('body')).toHaveClass(/leggibile/);

  // «Ripristina» torna alle scelte di partenza
  await page.getByRole('button', { name: 'Accessibilità' }).click();
  await finestra.getByRole('button', { name: 'Ripristina' }).click();
  expect(await scala(page)).toBe('1');
  await expect(page.locator('body')).not.toHaveClass(/maiuscolo|leggibile/);
  await expect(finestra.getByRole('switch', { name: /Tutto maiuscolo/ })).not.toBeChecked();
});

test('«Aiuto» apre la guida «Come si segue il cammino» e «Ho capito» la chiude', async ({ portale, page }) => {
  await portale.apri();
  await page.getByRole('button', { name: 'Aiuto' }).click();
  const guida = page.locator('#aiuto');
  await expect(guida).toBeVisible();
  await expect(guida.getByRole('heading', { level: 2 })).toHaveText('Come si segue il cammino');
  await expect(guida.getByRole('heading', { level: 3 })).toHaveText(['Segui il racconto', 'Apri la scheda di una tappa', 'Allora e oggi', 'Muoviti sulla carta', 'Disegna sulla carta', 'Leggi meglio']);
  await guida.getByRole('button', { name: 'Ho capito' }).click();
  await expect(guida).toBeHidden();
});
