// Una sola epoca per vista (tabella EPOCHE di cammino.html): niente di moderno nell'epoca storica, niente di antico
// in «Oggi». In «Oggi» gli Stati toccati dal cammino sono gialli; «Cartina muta» toglie i nomi, solo in «Oggi».
import { expect, legendaStorica, test } from './portale.ts';

// i livelli e i nomi di «Oggi» (vedi EPOCHE.oggi) e le classi dei nomi di ciascuna epoca
const LIVELLI_OGGI = ['stati-fill', 'borders-band', 'borders', 'borders-contested'];
const MODERNI = ['country', 'capitale', 'citta'];
const ANTICHI = ['regno', 'regione-antica', 'capitale-antica', 'citta-antica'];
const conClasse = (nomi: { classi: string[] }[], classi: string[]) => nomi.filter((n) => n.classi.some((c) => classi.includes(c)));

test('«Oggi»: Stati e confini attuali, nomi moderni, nessuna cartina storica', async ({ portale }) => {
  await portale.apri();
  await portale.vediCammino();
  const { cammino } = portale.dati;
  for (const l of LIVELLI_OGGI) expect(await portale.visibilita(l), l).toBe('visible');
  for (const l of await portale.livelli('cartina-')) expect(await portale.visibilita(l), l).toBe('none');
  expect(await portale.vociDiLegenda()).toEqual([cammino.nome, 'Stati toccati dal cammino', 'Cartina muta']);
  expect(await portale.nomiDeiSegnaposto()).toEqual(cammino.tappe.map((t) => t.breveOggi ?? t.breve));
  const nomi = await portale.nomiVisibili();
  expect(conClasse(nomi, ['country']).length, 'nomi di Stati sulla carta').toBeGreaterThan(0);
  expect(conClasse(nomi, ANTICHI), 'nomi antichi in «Oggi»').toEqual([]);
});

test('epoche storiche: la cartina disegnata, i nomi antichi, nessun confine o nome di oggi', async ({ portale }) => {
  await portale.apri();
  await portale.vediCammino();
  const { cammino } = portale.dati;
  test.skip(!cammino.epoche.length, 'il cammino non ha epoche storiche');
  for (const epoca of cammino.epoche) {
    await test.step(epoca.pulsante, async () => {
      await portale.epoca(epoca.pulsante);
      await expect(portale.pulsanteEpoca(epoca.pulsante)).toHaveAttribute('aria-pressed', 'true');
      for (const l of LIVELLI_OGGI) expect(await portale.visibilita(l), l).toBe('none');
      const proprie = await portale.livelli(`cartina-${epoca.id}`);
      expect(proprie.length).toBeGreaterThan(0);
      for (const l of proprie) expect(await portale.visibilita(l), l).toBe('visible');
      // le cartine delle altre epoche non si vedono
      for (const l of (await portale.livelli('cartina-')).filter((id) => !proprie.includes(id))) expect(await portale.visibilita(l), l).toBe('none');
      expect(await portale.vociDiLegenda()).toEqual(legendaStorica(portale.dati, epoca.id));
      expect(await portale.nomiDeiSegnaposto()).toEqual(cammino.tappe.map((t) => t.breve));
      const nomi = await portale.nomiVisibili();
      expect(conClasse(nomi, MODERNI), 'nomi di oggi nell\'epoca storica').toEqual([]);
      expect(conClasse(nomi, ANTICHI).length, 'nomi della cartina sulla carta').toBeGreaterThan(0);
    });
  }
});

test('in «Oggi» gli Stati toccati dal cammino sono gialli', async ({ portale }) => {
  await portale.apri();
  // il colore degli Stati: [case, [in, nome, [literal, Stati del cammino]], giallo, colori dell'atlante]
  await expect.poll(async () => JSON.stringify(await portale.disegno('stati-fill', 'fill-color'))).toContain('#f7d154');
  const [, condizione, giallo] = (await portale.disegno('stati-fill', 'fill-color')) as [string, [string, unknown, [string, string[]]], string];
  expect(giallo).toBe('#f7d154');
  const stati = condizione[2][1];
  expect(stati.length).toBeGreaterThan(0);
  // per Abramo, gli Stati che la redazione si aspetta (non la Giordania)
  if (portale.dati.cammino.id === 'abramo') {
    expect([...stati].sort()).toEqual(['Egitto', 'Iraq', 'Israele', 'Libano', 'Palestina', 'Siria', 'Turchia']);
  }
});

test('«Cartina muta» toglie tutti i nomi, solo in «Oggi», e la scelta resta cambiando epoca', async ({ portale, page }) => {
  await portale.apri();
  await portale.vediCammino();
  const muta = portale.legenda.getByRole('switch', { name: /Cartina muta/ });
  expect((await portale.nomiVisibili()).length).toBeGreaterThan(0);
  await muta.click();
  await portale.attendi();
  await expect(muta).toHaveAttribute('aria-checked', 'true');
  expect(await portale.nomiVisibili()).toEqual([]);
  await expect(page.locator('.pin .pl').first()).toBeHidden();
  await expect(page.locator('.pin .pn').first()).toBeVisible(); // i numeri delle tappe restano
  const storica = portale.dati.pulsanti[0];
  if (storica !== 'Oggi') {
    // nell'epoca storica l'interruttore non c'è e i nomi tornano
    await portale.epoca(storica);
    await expect(muta).toHaveCount(0);
    expect((await portale.nomiVisibili()).length).toBeGreaterThan(0);
    await portale.epoca('Oggi');
    await expect(portale.legenda.getByRole('switch', { name: /Cartina muta/ })).toHaveAttribute('aria-checked', 'true');
    expect(await portale.nomiVisibili()).toEqual([]);
  }
});

test('un mare scritto a mano non compare dove la cartina storica dà un nome antico alle stesse acque', async ({ portale, page }) => {
  await portale.apri();
  const { cammino } = portale.dati;
  // Abramo: «Golfo Persico» sparisce nel 1800 a.C., dove c'è «Mare Inferiore»
  test.skip(cammino.id !== 'abramo', 'prova scritta sui nomi di Abramo');
  await portale.vediCammino();
  const golfo = page.locator('.geo-label.sea', { hasText: 'Golfo Persico' });
  await expect(golfo).not.toHaveClass(/nome-antico-altrove/);
  await portale.epoca('1800 a.C.');
  await expect(golfo).toHaveClass(/nome-antico-altrove/);
  await expect(golfo).toBeHidden();
  await portale.epoca('Oggi');
  await expect(golfo).not.toHaveClass(/nome-antico-altrove/);
});
