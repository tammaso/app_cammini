// La pagina si apre sul globo, in «Oggi», con il satellite e senza errori.
import { expect, test } from './portale.ts';

test('si apre sul globo, in «Oggi», con il testo del globo e senza nomi sulla carta', async ({ portale, page }) => {
  await portale.apri();
  const { cammino, pulsanti } = portale.dati;
  await expect(page).toHaveTitle(cammino.epoche.length ? `${cammino.nome}, allora e oggi` : cammino.nome);
  await expect(page.locator('#titolo-cammino')).toHaveText(cammino.titolo);
  await expect(page.locator('#text')).toHaveText(cammino.globo.testo);
  // le epoche: le storiche in ordine di anno, poi «Oggi»; sul globo vale sempre «Oggi»
  await expect(portale.legenda.locator('.seg button')).toHaveText(pulsanti);
  await expect(portale.pulsanteEpoca('Oggi')).toHaveAttribute('aria-pressed', 'true');
  // sul globo i segnaposto e il tracciato non si vedono, «Precedente» non c'è, il contatore è vuoto
  await expect(page.locator('#map')).toHaveClass(/hide-pins/);
  expect(await portale.visibilita('route-preview')).toBe('none');
  await expect(page.locator('#prev')).toBeDisabled();
  await expect(page.locator('#count')).toHaveText('');
  // l'elenco delle tappe c'è già, nell'ordine del viaggio
  await expect(page.locator('#stops button .n + span')).toHaveText(cammino.tappe.map((t) => t.nome));
  // i nomi compaiono solo avvicinandosi (da zoom 1,8)
  expect(await portale.nomiVisibili()).toEqual([]);
});

test('il satellite si legge a pezzi da bmng.pmtiles', async ({ portale, page }) => {
  const pezzi: number[] = [];
  page.on('response', (r) => { if (r.url().endsWith('/bmng/bmng.pmtiles')) pezzi.push(r.status()); });
  await portale.apri();
  expect(await page.evaluate(() => (window as any).__mappa.isSourceLoaded('bmng'))).toBe(true);
  // richieste «Range»: il server risponde 206 con il solo pezzo chiesto (un 200 vorrebbe dire tutti i 118 MB)
  expect(pezzi.length).toBeGreaterThan(1);
  expect(new Set(pezzi)).toEqual(new Set([206]));
});

test('un cammino che non esiste lo dice nel pannello', async ({ page }) => {
  await page.goto('cammino.html?cammino=non-esiste');
  await expect(page.locator('#titolo-cammino')).toHaveText('Cammino non trovato');
  await expect(page.locator('#text')).toContainText('Non riesco a leggere i dati del cammino');
});
