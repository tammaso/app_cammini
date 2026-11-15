// Strumenti comuni alle prove del portale: apre la pagina, aspetta che la carta sia ferma e disegnata, raccoglie
// gli errori, legge i dati pubblicati (prototipo/cammini/) per sapere che cosa la pagina deve mostrare.
// Le prove non toccano cammino.html: la carta di MapLibre si raggiunge agganciandosi alla libreria mentre si carica.
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Cammino, Cartina, Indice, Stile } from '../condiviso/cammino.ts';

export { expect };

/* ---------- I dati pubblicati ---------- */
export const CARTELLA_CAMMINI = fileURLToPath(new URL('../prototipo/cammini/', import.meta.url));
export const leggiDati = <T>(percorso: string): T => JSON.parse(readFileSync(CARTELLA_CAMMINI + percorso, 'utf8')) as T;
export const indice = leggiDati<Indice>('indice.json');

export interface DatiCammino {
  cammino: Cammino;
  cartine: Record<string, Cartina>;
  // le epoche come le mostra la pagina: le storiche in ordine di anno, poi «Oggi»
  pulsanti: string[];
}
export function datiCammino(id = indice.cammini[0].id): DatiCammino {
  const cammino = leggiDati<Cammino>(`${id}/cammino.json`);
  const cartine = Object.fromEntries(cammino.epoche.map((e) => [e.id, leggiDati<Cartina>(`${id}/${e.cartina}`)]));
  const pulsanti = [...cammino.epoche].sort((a, b) => a.anno - b.anno).map((e) => e.pulsante);
  return { cammino, cartine, pulsanti: [...pulsanti, 'Oggi'] };
}
// la legenda di un'epoca storica: il cammino, poi gli stili con una voce di legenda (i simboli in fondo)
export function legendaStorica(dati: DatiCammino, epoca: string): string[] {
  const stili = dati.cartine[epoca].stili.filter((s: Stile) => s.legenda);
  stili.sort((a, b) => Number(a.tipo === 'punto') - Number(b.tipo === 'punto'));
  return [dati.cammino.nome, ...stili.map((s) => s.legenda!)];
}

/* ---------- La pagina ---------- */
// Prima di ogni script della pagina: quando MapLibre si registra (window.maplibregl), la sua carta si annota
// in window.__mappa la prima volta che la pagina le chiede un evento. Così le prove leggono livelli e filtri.
export function agganciaLaCarta() {
  let libreria: any;
  Object.defineProperty(window, 'maplibregl', {
    configurable: true,
    enumerable: true,
    get: () => libreria,
    set(valore) {
      libreria = valore;
      const on = valore.Map.prototype.on;
      valore.Map.prototype.on = function (this: unknown, ...argomenti: unknown[]) {
        (window as any).__mappa ??= this;
        return on.apply(this, argomenti);
      };
    }
  });
}

export interface Opzioni {
  cammino?: string; // id del cammino (cammino.html?cammino=…); senza, il primo dell'indice
  // per provare casi che i dati di oggi non hanno (una galleria di più immagini): si cambia il cammino.json
  // che arriva alla pagina, non il file
  cambiaDati?: (cammino: Cammino) => void;
}

export class Portale {
  readonly errori: string[] = [];
  dati!: DatiCammino;

  constructor(readonly page: Page) {
    page.on('pageerror', (e) => this.errori.push(`errore nella pagina: ${e.message}`));
    // «Failed to load resource» lo scrive il browser per ogni file mancante, compresa l'icona del sito (favicon.ico, che
    // il portale non ha): i file del progetto mancanti li controlla l'ascolto delle risposte, qui sotto
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) this.errori.push(`console: ${m.text()}`);
    });
    page.on('response', (r) => {
      // i file del progetto devono esserci tutti (le richieste a unpkg e Google non sono nostre)
      if (r.status() >= 400 && new URL(r.url()).hostname === 'localhost') this.errori.push(`${r.status()} ${r.url()}`);
    });
  }

  async apri({ cammino, cambiaDati }: Opzioni = {}) {
    this.dati = datiCammino(cammino);
    if (cambiaDati) {
      const dati = structuredClone(this.dati.cammino);
      cambiaDati(dati);
      this.dati = { ...this.dati, cammino: dati };
      await this.page.route(`**/cammini/${dati.id}/cammino.json`, (r) => r.fulfill({ json: dati }));
    }
    await this.page.addInitScript(agganciaLaCarta);
    await this.page.goto(cammino ? `cammino.html?cammino=${cammino}` : 'cammino.html');
    await this.page.waitForFunction(() => (window as any).__mappa?.loaded(), null, { timeout: 60_000 });
    await this.page.evaluate(() => document.fonts.ready);
    await this.attendi();
  }

  // la carta è ferma, con lo stile e i riquadri caricati, e i nomi sono stati disposti (due fotogrammi dopo)
  async attendi() {
    await this.page.waitForFunction(() => {
      const m = (window as any).__mappa;
      return m && m.loaded() && !m.isMoving() && m.areTilesLoaded();
    }, null, { timeout: 60_000, polling: 100 });
    await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }

  // dalla carta di MapLibre: se un livello si vede, il suo filtro, una proprietà di disegno
  visibilita(livello: string): Promise<string> {
    return this.page.evaluate((l) => (window as any).__mappa.getLayoutProperty(l, 'visibility') ?? 'visible', livello);
  }
  filtro(livello: string): Promise<unknown> {
    return this.page.evaluate((l) => (window as any).__mappa.getFilter(l), livello);
  }
  disegno(livello: string, proprieta: string): Promise<unknown> {
    return this.page.evaluate(([l, p]) => (window as any).__mappa.getPaintProperty(l, p), [livello, proprieta]);
  }
  async livelli(prefisso: string): Promise<string[]> {
    return this.page.evaluate((p) => (window as any).__mappa.getStyle().layers.map((l: any) => l.id).filter((id: string) => id.startsWith(p)), prefisso);
  }

  /* comandi del racconto, come li usa chi guarda */
  get pannello() { return this.page.locator('aside.panel'); }
  get legenda() { return this.page.locator('#polbox'); }
  get scheda() { return this.page.locator('#scheda'); }
  get fumetto() { return this.page.locator('.stop-pop'); }
  pulsanteEpoca(nome: string): Locator { return this.legenda.locator('.seg button', { hasText: nome }); }
  segnaposto(i: number): Locator { return this.page.locator('.pin').nth(i); }
  async vediCammino() { await this.page.locator('#vedi').click(); await this.attendi(); }
  async successiva() { await this.page.locator('#next').click(); await this.attendi(); }
  async precedente() { await this.page.locator('#prev').click(); await this.attendi(); }
  async tornaAlGlobo() { await this.page.locator('#globe').click(); await this.attendi(); }
  async epoca(nome: string) { await this.pulsanteEpoca(nome).click(); await this.attendi(); }
  async tappaDallElenco(i: number) { await this.page.locator('#stops button').nth(i).click(); await this.attendi(); }

  // i nomi sulla carta che si vedono, con le loro classi (country, capitale, regno, antico…)
  async nomiVisibili(): Promise<{ testo: string; classi: string[] }[]> {
    return this.page.locator('.livello-nomi .geo-label').evaluateAll((els) => els
      .filter((el) => !el.classList.contains('nascosta') && getComputedStyle(el).visibility === 'visible')
      .map((el) => ({ testo: (el.firstChild?.textContent ?? '').trim(), classi: [...el.classList] })));
  }
  // i nomi accanto ai segnaposto, nell'ordine delle tappe
  async nomiDeiSegnaposto(): Promise<string[]> {
    return this.page.locator('.pin .pl').allTextContents();
  }
  async vociDiLegenda(): Promise<string[]> {
    return this.legenda.locator('#leg li .testo').allTextContents();
  }
}

// ogni prova riceve il portale; alla fine non devono esserci errori nella pagina né file mancanti
export const test = base.extend<{ portale: Portale }>({
  portale: async ({ page }, usa) => {
    const portale = new Portale(page);
    await usa(portale);
    expect(portale.errori, 'errori nella pagina o file mancanti').toEqual([]);
  }
});

// il numero tondo di un segnaposto (dato il suo riquadro) tocca un rettangolo? Conta il cerchio, non il riquadro:
// un fumetto aperto in diagonale passa accanto al cerchio pur toccando l'angolo del riquadro
export const cerchioTocca = (r: { x: number; y: number; width: number; height: number }, c: typeof r) => {
  const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
  const px = Math.max(r.x, Math.min(cx, r.x + r.width)), py = Math.max(r.y, Math.min(cy, r.y + r.height));
  return Math.hypot(px - cx, py - cy) < c.width / 2;
};

// rettangoli che si toccano (con un margine in pixel)
export const siToccano = (a: DOMRect | { x: number; y: number; width: number; height: number }, b: typeof a, margine = 0) =>
  a.x < b.x + b.width + margine && b.x < a.x + a.width + margine && a.y < b.y + b.height + margine && b.y < a.y + a.height + margine;
