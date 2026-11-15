// Con le animazioni (le altre prove le spengono): il globo gira da solo all'apertura e si ferma toccandolo; passando
// alla tappa successiva il tratto si disegna e il segnaposto diventa blu solo quando la linea lo raggiunge.
import type { Page } from '@playwright/test';
import { agganciaLaCarta, datiCammino, expect, test } from './portale.ts';

test.use({ contextOptions: { reducedMotion: 'no-preference' } });

// il globo che gira non è mai fermo: qui non si aspetta che la carta si fermi, solo che ci sia
async function apri(page: Page) {
  await page.addInitScript(agganciaLaCarta);
  await page.goto('cammino.html');
  await page.waitForFunction(() => (window as any).__mappa?.isStyleLoaded(), null, { timeout: 60_000 });
}
const longitudine = (page: Page) => page.evaluate(() => (window as any).__mappa.getCenter().lng as number);

test('il globo gira da solo e si ferma quando lo si tocca', async ({ portale, page }) => {
  await apri(page);
  const partenza = await longitudine(page);
  await expect.poll(() => longitudine(page), { timeout: 15_000 }).toBeGreaterThan(partenza + 0.5);
  const carta = (await page.locator('#map canvas').boundingBox())!;
  await page.mouse.click(carta.x + carta.width / 2, carta.y + carta.height / 2);
  const ferma = await longitudine(page);
  await page.waitForTimeout(1500);
  expect(await longitudine(page)).toBeCloseTo(ferma, 3);
  expect(portale.errori).toEqual([]);
});

test('il tratto si disegna e il segnaposto diventa blu quando la linea lo raggiunge', async ({ page }) => {
  const { tappe } = datiCammino().cammino;
  await apri(page);
  await page.locator('#vedi').click();
  await page.locator('#next').click(); // tappa 1: niente tratto
  await expect(page.locator('.pin').nth(0)).toHaveClass(/\barrivata\b/);
  await page.locator('#next').click(); // tappa 2: il tratto dalla tappa 1 si disegna in 2,4 secondi
  const seconda = page.locator('.pin').nth(1);
  await expect(seconda).toHaveClass(/\bcurrent\b/);
  // mentre la linea si disegna, la sorgente dell'animazione ha il pezzo di tratto e il segnaposto è ancora bianco
  // (il primo pezzo compare al primo fotogramma dell'animazione: si aspetta un attimo)
  await expect.poll(() => page.evaluate(async () => (await (window as any).__mappa.getSource('anim').getData()).features.length),
    { intervals: [50] }).toBe(1);
  await expect(seconda).not.toHaveClass(/\barrivata\b/);
  await expect(seconda).toHaveClass(/\barrivata\b/, { timeout: 10_000 });
  // finita la linea, il tratto passa tra quelli percorsi e compare il fumetto
  expect(await page.evaluate(() => (window as any).__mappa.getFilter('route-done'))).toEqual(['<=', ['get', 'i'], 1]);
  await expect(page.locator('.stop-pop h3')).toHaveText(tappe[1].nome, { timeout: 10_000 });
});
