// «Disegna», in fondo al sito: la carta come lavagna per la LIM. Penna, evidenziatore e freccia; segni attaccati ai
// luoghi; mentre si disegna la carta non si trascina e i segnaposto non aprono la scheda; Annulla e Cancella tutto.
import type { Page } from '@playwright/test';
import { expect, test, type Portale } from './portale.ts';

interface Segno { properties: { strumento: string; colore: string }; geometry: { coordinates: [number, number][][] } }
const segni = (page: Page) => page.evaluate(async () => ((await (window as any).__mappa.getSource('disegni').getData()).features) as Segno[]);
const centro = (page: Page) => page.evaluate(() => (window as any).__mappa.getCenter().toArray() as [number, number]);

// un punto della carta lontano da segnaposto, nomi, legenda e comandi, dove un trascinamento non tocca altro
async function puntoLibero(page: Page): Promise<[number, number]> {
  return page.evaluate(() => {
    const carta = document.getElementById('map')!.getBoundingClientRect();
    const ostacoli = [...document.querySelectorAll('.pin, .geo-label, #polbox, .maplibregl-ctrl, .maplibregl-popup')]
      .map((el) => el.getBoundingClientRect()).filter((r) => r.width);
    for (let y = carta.top + 120; y < carta.bottom - 160; y += 20) {
      for (let x = carta.left + 160; x < carta.right - 300; x += 20) {
        if (ostacoli.every((r) => x < r.left - 70 || x > r.right + 70 || y < r.top - 70 || y > r.bottom + 70)) return [x, y];
      }
    }
    throw new Error('nessun punto libero sulla carta');
  });
}
async function trascina(page: Page, [x, y]: [number, number], dx: number, dy: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 3, { steps: 6 });
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
async function apriEDisegna(portale: Portale) {
  await portale.apri();
  await portale.vediCammino();
  await portale.page.getByRole('button', { name: 'Disegna' }).click();
}

test('con la penna si disegna sulla carta, che intanto non si sposta; il segno resta sui luoghi', async ({ portale, page }) => {
  await apriEDisegna(portale);
  const disegna = page.getByRole('button', { name: 'Disegna' });
  await expect(disegna).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('toolbar', { name: 'Strumenti di disegno' })).toBeVisible();
  await expect(page.locator('#map')).toHaveClass(/\bdisegno\b/);
  const prima = await centro(page);
  await trascina(page, await puntoLibero(page), 160, 60);
  await expect.poll(async () => (await segni(page)).length).toBe(1);
  const [segno] = await segni(page);
  expect(segno.properties).toEqual({ strumento: 'penna', colore: '#ff3dbd' });
  expect(segno.geometry.coordinates[0].length).toBeGreaterThan(5);
  expect(await centro(page)).toEqual(prima); // la carta non si è trascinata

  // Esc torna alla carta di sempre: il segno resta, e la carta si trascina di nuovo
  await page.keyboard.press('Escape');
  await expect(disegna).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('toolbar', { name: 'Strumenti di disegno' })).toBeHidden();
  await trascina(page, await puntoLibero(page), 150, 0);
  await portale.attendi();
  expect(await centro(page)).not.toEqual(prima);
  // cambiando tappa il segno resta dov'era, sugli stessi luoghi
  await portale.successiva();
  expect(await segni(page)).toEqual([segno]);
});

test('evidenziatore, freccia, colori, «Annulla» (anche Ctrl+Z) e «Cancella tutto»', async ({ portale, page }) => {
  await apriEDisegna(portale);
  const strumenti = page.getByRole('toolbar', { name: 'Strumenti di disegno' });
  await strumenti.getByRole('button', { name: 'Evidenziatore' }).click();
  await strumenti.getByRole('button', { name: 'Colore giallo' }).click();
  await expect(strumenti.getByRole('button', { name: 'Colore giallo' })).toHaveAttribute('aria-pressed', 'true');
  await trascina(page, await puntoLibero(page), 140, 20);
  await expect.poll(async () => (await segni(page)).map((s) => s.properties)).toEqual([{ strumento: 'evidenziatore', colore: '#ffd60a' }]);

  // la freccia: un tratto dritto e la punta (due barbe intorno alla fine)
  await strumenti.getByRole('button', { name: 'Freccia' }).click();
  await trascina(page, await puntoLibero(page), 120, -40);
  await expect.poll(async () => (await segni(page)).length).toBe(2);
  const freccia = (await segni(page))[1];
  expect(freccia.properties.strumento).toBe('freccia');
  expect(freccia.geometry.coordinates.map((l) => l.length)).toEqual([2, 3]);
  expect(freccia.geometry.coordinates[1][1]).toEqual(freccia.geometry.coordinates[0][1]); // la punta sta sulla fine
  // un tocco senza trascinare non lascia una freccia
  const [x, y] = await puntoLibero(page);
  await page.mouse.click(x, y);
  await page.waitForTimeout(200);
  expect((await segni(page)).length).toBe(2);

  const annulla = strumenti.getByRole('button', { name: 'Annulla' }), cancella = strumenti.getByRole('button', { name: 'Cancella tutto' });
  await annulla.click();
  await expect.poll(async () => (await segni(page)).length).toBe(1);
  await cancella.click();
  await expect.poll(async () => (await segni(page)).length).toBe(0);
  await expect(cancella).toBeDisabled();
  // anche «Cancella tutto» si annulla, pure con Ctrl+Z
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await segni(page)).length).toBe(1);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await segni(page)).length).toBe(0);
  await expect(annulla).toBeDisabled();
});

test('mentre si disegna i segnaposto non aprono la scheda: il segno parte anche da lì', async ({ portale, page }) => {
  await apriEDisegna(portale);
  const pin = (await portale.segnaposto(0).locator('.pn').boundingBox())!;
  await trascina(page, [pin.x + pin.width / 2, pin.y + pin.height / 2], -120, -60);
  await expect.poll(async () => (await segni(page)).length).toBe(1);
  await expect(portale.scheda).toBeHidden();
  // finito di disegnare, il segnaposto torna ad aprire la scheda
  await page.getByRole('button', { name: 'Disegna' }).click();
  await portale.segnaposto(0).click();
  await expect(portale.scheda).toBeVisible();
});
