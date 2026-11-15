// Pubblicazione: dal database ai file che legge il portale (formato di condiviso/cammino.ts).
// Per ogni cammino una cartella in prototipo/cammini/<slug>/ con cammino.json, una cartina per epoca
// e le immagini delle schede in WebP; in prototipo/cammini/indice.json l'elenco dei cammini.
// Per ora il portale è quello di prova, sul PC: ci vanno anche i cammini in bozza (segnati nell'indice).
// Dal backoffice si passa sempre dall'anteprima: i file si scrivono prima in anteprima/cammini/, si guardano
// con la pagina del portale, e solo dopo «Pubblica» li copia al posto di prototipo/cammini/.
import { spawn } from 'node:child_process';
import { copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import {
  VERSIONE_FORMATO, type Cammino as CamminoPubblicato, type Cartina as CartinaPubblicata, type Coordinate, type Indice,
  type ImmagineTappa, type Stile as StilePubblicato,
} from '../../../../condiviso/cammino.ts';
import { elencaCammini, leggiCammino } from './cammini.ts';
import { CARTELLA_IMMAGINI } from './immagini.ts';
import { jsonLeggibile } from './json.ts';
import { registraErrore, registraModifica } from './registro.ts';

const RADICE = fileURLToPath(new URL('../../../../', import.meta.url));
export const CARTELLA_PORTALE = process.env.CAMMINI_PORTALE ?? join(RADICE, 'prototipo', 'cammini');
export const LARGHEZZA_IMMAGINI = 2400; // la scheda le apre anche a tutto schermo, con lo zoom
export const LARGHEZZA_MINIATURE = 400; // le miniature della galleria della scheda
const TOLLERANZA_KM = 5; // un tracciato deve partire e arrivare sulle tappe, a meno di qualche km

const km = ([a, b]: Coordinate, [c, d]: Coordinate) => {
  const R = Math.PI / 180;
  const s = Math.sin((d - b) * R / 2) ** 2 + Math.cos(b * R) * Math.cos(d * R) * Math.sin((c - a) * R / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
};
const opz = (valore: unknown) => (valore == null ? null : String(valore));

// file: relativo alla cartella del cammino; larghezza: la massima del WebP pubblicato
interface ImmagineDaPubblicare { originale: string; file: string; larghezza: number }

export interface CamminoComposto {
  slug: string;
  cammino: CamminoPubblicato;
  cartine: { file: string; dati: CartinaPubblicata }[];
  immagini: ImmagineDaPubblicare[];
  avvisi: string[];
}

export function componiCammino(db: DatabaseSync, id: number, generatoIl = new Date().toISOString()): CamminoComposto {
  const c = leggiCammino(db, id);
  if (!c) throw new Error(`Cammino ${id} non trovato`);
  const avvisi: string[] = [];
  const immagini: ImmagineDaPubblicare[] = [];
  const righe = db.prepare(`SELECT t.*, l.lng, l.lat
    FROM tappe t JOIN luoghi l ON l.id = t.luogo_id WHERE t.cammino_id = ? ORDER BY t.posizione`).all(id);
  const galleria = db.prepare(`SELECT i.sha256, i.file, i.alt, i.didascalia, i.crediti FROM tappe_immagini ti
    JOIN immagini i ON i.id = ti.immagine_id WHERE ti.tappa_id = ? ORDER BY ti.posizione`);
  const daPubblicare = (originale: string, file: string, larghezza: number) => {
    if (!immagini.some((i) => i.file === file)) immagini.push({ originale, file, larghezza });
  };
  const tappe = righe.map((r, i): CamminoPubblicato['tappe'][number] => {
    const coordinate: Coordinate = [Number(r.lng), Number(r.lat)];
    let tracciato = r.tracciato == null ? null : (JSON.parse(String(r.tracciato)) as Coordinate[]);
    if (i === 0) tracciato = null;
    else if (tracciato?.length) {
      // il tracciato va dalla tappa precedente a questa: se non è così (tappe spostate), linea dritta
      const prima: Coordinate = [Number(righe[i - 1].lng), Number(righe[i - 1].lat)];
      if (km(tracciato[0], prima) > TOLLERANZA_KM || km(tracciato.at(-1)!, coordinate) > TOLLERANZA_KM) {
        avvisi.push(`Tappa ${i + 1} (${r.nome}): il tracciato non parte dalla tappa precedente o non arriva qui: al suo posto una linea dritta.`);
        tracciato = null;
      }
    }
    const galleriaTappa = galleria.all(Number(r.id)).map((g): ImmagineTappa => {
      const nome = `immagini/${String(g.sha256).slice(0, 12)}`;
      daPubblicare(String(g.file), `${nome}.webp`, LARGHEZZA_IMMAGINI);
      daPubblicare(String(g.file), `${nome}-mini.webp`, LARGHEZZA_MINIATURE);
      if (!String(g.alt).trim() || !String(g.crediti ?? '').trim()) {
        avvisi.push(`Tappa ${i + 1} (${r.nome}): all'immagine «${String(g.alt).trim() || g.file}» mancano testo alternativo o crediti.`);
      }
      return { src: `${nome}.webp`, miniatura: `${nome}-mini.webp`, alt: String(g.alt), didascalia: opz(g.didascalia), crediti: String(g.crediti ?? '') };
    });
    return {
      nome: String(r.nome), breve: String(r.breve), ...(r.breve_oggi ? { breveOggi: String(r.breve_oggi) } : {}), coordinate, luogoAttuale: opz(r.luogo_attuale), riferimento: opz(r.riferimento),
      testo: String(r.testo), approfondimento: opz(r.approfondimento), immagini: galleriaTappa, tracciato,
      ...(r.secondaria ? { secondaria: true as const } : {}),
    };
  });
  if (!tappe.length) avvisi.push('Il cammino non ha ancora tappe.');

  // il ritorno dopo l'ultima tappa a una tappa precedente, con il suo tracciato se parte e arriva giusto
  const rr = db.prepare('SELECT ritorno_tappa_id, ritorno_tracciato FROM cammini WHERE id = ?').get(id)!;
  const verso = righe.findIndex((r) => Number(r.id) === Number(rr.ritorno_tappa_id));
  let ritorno: CamminoPubblicato['ritorno'];
  if (rr.ritorno_tappa_id != null && verso >= 0 && verso < tappe.length - 1) {
    let tracciato = rr.ritorno_tracciato == null ? null : (JSON.parse(String(rr.ritorno_tracciato)) as Coordinate[]);
    if (tracciato?.length && (km(tracciato[0], tappe.at(-1)!.coordinate) > TOLLERANZA_KM || km(tracciato.at(-1)!, tappe[verso].coordinate) > TOLLERANZA_KM)) {
      avvisi.push(`Ritorno a ${tappe[verso].nome}: il tracciato non parte dall'ultima tappa o non arriva lì: al suo posto una linea dritta.`);
      tracciato = null;
    }
    ritorno = { verso, tracciato };
  }
  if (!c.globoTesto.trim() || !c.panoramicaTesto.trim()) avvisi.push('Mancano il testo del globo o quello della panoramica.');

  const cartine = db.prepare('SELECT * FROM cartine WHERE cammino_id = ? ORDER BY anno').all(id).map((k) => ({
    file: `${k.epoca}.json`,
    epoca: { id: String(k.epoca), pulsante: String(k.pulsante), anno: Number(k.anno), cartina: `${k.epoca}.json` },
    dati: componiCartina(db, Number(k.id)),
  }));
  return {
    slug: c.slug,
    cammino: {
      versione: VERSIONE_FORMATO, generatoIl, id: c.slug, titolo: c.titolo, nome: c.nome, sottotitolo: c.sottotitolo,
      globo: { luogo: c.globoLuogo, testo: c.globoTesto }, panoramica: { testo: c.panoramicaTesto },
      tappe, ...(ritorno ? { ritorno } : {}), frecce: c.frecce, etichette: c.etichette, epoche: cartine.map((k) => k.epoca),
    },
    cartine: cartine.map(({ file, dati }) => ({ file, dati })),
    immagini,
    avvisi,
  };
}

export function componiCartina(db: DatabaseSync, id: number): CartinaPubblicata {
  const k = db.prepare('SELECT * FROM cartine WHERE id = ?').get(id)!;
  const j = (v: unknown) => (v == null ? null : JSON.parse(String(v)));
  const stili = db.prepare('SELECT * FROM stili WHERE cartina_id = ? ORDER BY posizione, id').all(id);
  const chiave = new Map(stili.map((s) => [Number(s.id), String(s.chiave)]));
  return {
    versione: VERSIONE_FORMATO,
    id: String(k.epoca),
    fonte: opz(k.fonte),
    stili: stili.map((s): StilePubblicato => {
      const base = { id: String(s.chiave), nome: String(s.nome), ...(s.legenda ? { legenda: String(s.legenda) } : {}) };
      if (s.tipo === 'area') {
        return { ...base, tipo: 'area', riempimento: String(s.colore), opacita: j(s.opacita) ?? 0.8, contorno: opz(s.contorno), spessore: j(s.spessore) ?? 1 };
      }
      if (s.tipo === 'linea') return { ...base, tipo: 'linea', colore: String(s.colore), spessore: j(s.spessore) ?? 1.5, tratteggio: j(s.tratteggio) };
      return { ...base, tipo: 'punto', colore: String(s.colore) };
    }),
    elementi: {
      type: 'FeatureCollection',
      features: db.prepare('SELECT * FROM elementi WHERE cartina_id = ? ORDER BY id').all(id).map((e) => ({
        type: 'Feature' as const,
        properties: { stile: chiave.get(Number(e.stile_id))!, nome: opz(e.nome), origine: String(e.origine) as 'importato' },
        geometry: JSON.parse(String(e.geometria)),
      })),
    },
    nomi: db.prepare('SELECT * FROM nomi WHERE cartina_id = ? ORDER BY posizione, id').all(id).map((n) => {
      const extra = {
        ...(n.angolo != null ? { angolo: Number(n.angolo) } : {}), ...(n.sotto != null ? { sotto: String(n.sotto) } : {}),
        ...(n.anche_oggi === 0 ? { oggi: false as const } : {}),
        ...(n.colore != null ? { colore: String(n.colore) } : {}), ...(n.corpo != null ? { corpo: Number(n.corpo) } : {}),
        ...(n.sempre === 1 ? { sempre: true as const } : {}),
      };
      const voce: CartinaPubblicata['nomi'][number] = [String(n.categoria), String(n.testo), Number(n.lng), Number(n.lat), Number(n.zoom)];
      if (Object.keys(extra).length) voce.push(extra);
      return voce;
    }),
    alone: JSON.parse(String(k.alone)),
  };
}

// --- Scrittura dei file ----------------------------------------------------------------------------

export interface EsitoPubblicazione {
  generatoIl: string;
  cammini: { slug: string; titolo: string; avvisi: string[] }[];
  immaginiGenerate: number;
  fileRimossi: number;
}

const esiste = (percorso: string) => stat(percorso).then(() => true, () => false);

// Una pubblicazione alla volta: due insieme scriverebbero gli stessi file.
let inCorso = false;

export async function pubblicaPortale(
  db: DatabaseSync,
  { destinazione = CARTELLA_PORTALE, cartellaImmagini = CARTELLA_IMMAGINI, registra = true } = {},
): Promise<EsitoPubblicazione> {
  if (inCorso) throw new Error("C'è già una pubblicazione in corso: attendi qualche secondo e riprova.");
  inCorso = true;
  try {
    await mkdir(destinazione, { recursive: true });
    const generatoIl = new Date().toISOString();
    const elenco = elencaCammini(db);
    let immaginiGenerate = 0;
    let fileRimossi = 0;
    const esito: EsitoPubblicazione['cammini'] = [];
    for (const voce of elenco) {
      const composto = componiCammino(db, voce.id, generatoIl);
      const cartella = join(destinazione, composto.slug);
      await mkdir(join(cartella, 'immagini'), { recursive: true });
      await writeFile(join(cartella, 'cammino.json'), jsonLeggibile(composto.cammino) + '\n');
      for (const k of composto.cartine) await writeFile(join(cartella, k.file), JSON.stringify(k.dati) + '\n');
      for (const i of composto.immagini) {
        const uscita = join(cartella, i.file);
        if (await esiste(uscita)) continue;
        await sharp(join(cartellaImmagini, i.originale)).rotate()
          .resize({ width: i.larghezza, withoutEnlargement: true }).webp({ quality: 82 }).toFile(uscita);
        immaginiGenerate++;
      }
      // Nella cartella del cammino restano solo i file appena pubblicati
      const validi = new Set(['cammino.json', ...composto.cartine.map((k) => k.file)]);
      for (const nome of await readdir(cartella)) {
        if (nome.endsWith('.json') && !validi.has(nome)) { await rm(join(cartella, nome)); fileRimossi++; }
      }
      const immaginiValide = new Set(composto.immagini.map((i) => i.file.replace(/^immagini\//, '')));
      for (const nome of await readdir(join(cartella, 'immagini'))) {
        if (!immaginiValide.has(nome)) { await rm(join(cartella, 'immagini', nome)); fileRimossi++; }
      }
      esito.push({ slug: composto.slug, titolo: voce.titolo, avvisi: composto.avvisi });
    }
    // le cartelle dei cammini che non ci sono più (eliminati) se ne vanno
    const cartelle = new Set(elenco.map((c) => c.slug));
    for (const voce of await readdir(destinazione, { withFileTypes: true })) {
      if (voce.isDirectory() && !cartelle.has(voce.name)) { await rm(join(destinazione, voce.name), { recursive: true }); fileRimossi++; }
    }
    const indice: Indice = {
      versione: VERSIONE_FORMATO,
      generatoIl,
      cammini: elenco.map((c) => {
        const cammino = leggiCammino(db, c.id)!;
        return { id: c.slug, titolo: c.titolo, sottotitolo: cammino.sottotitolo, ...(c.stato === 'bozza' ? { bozza: true as const } : {}) };
      }),
    };
    await writeFile(join(destinazione, 'indice.json'), jsonLeggibile(indice) + '\n');
    if (registra) {
      registraModifica(db, {
        azione: 'modifica', oggetto: 'pubblicazione', titolo: 'Portale',
        descrizione: `Portale aggiornato: ${elenco.length} ${elenco.length === 1 ? 'cammino' : 'cammini'}`,
      });
    }
    return { generatoIl, cammini: esito, immaginiGenerate, fileRimossi };
  } catch (errore) {
    registraErrore(db, {
      origine: 'pubblicazione', messaggio: errore instanceof Error ? errore.message : String(errore),
      dettagli: errore instanceof Error ? errore.stack ?? null : null,
    });
    throw errore;
  } finally {
    inCorso = false;
  }
}

// --- Anteprima, poi pubblicazione ----------------------------------------------------------------------

// L'anteprima è il portale com'è nel database, in una cartella a parte (anteprima/, accanto a prototipo/):
// la pagina del portale con una fascetta «Anteprima», i dati comuni e i cammini. Si apre con il server del
// progetto (py strumenti\server.py), come il portale. «Pubblica» copia proprio quei file al posto di
// prototipo/cammini/: nel portale va quello che si è visto, anche se nel frattempo il database è cambiato.
export const CARTELLA_ANTEPRIMA = process.env.CAMMINI_ANTEPRIMA ?? join(RADICE, 'anteprima');
export const INDIRIZZO_ANTEPRIMA = 'http://localhost:8000/anteprima/cammino.html';
const PROTOTIPO = join(RADICE, 'prototipo');
const DATI_COMUNI = ['mondo.js', 'confini.geojson', 'stati.geojson', 'fiumi.geojson']; // «Oggi»: uguali per tutti i cammini

const FASCETTA = `<div style="position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;pointer-events:none;
  background:#ffd166;color:#10213a;font:700 13px/1.2 system-ui,sans-serif;padding:5px 12px;border-radius:999px;
  box-shadow:0 2px 8px rgb(0 0 0 / .35)">Anteprima: non ancora pubblicata</div>`;

export interface EsitoAnteprima extends EsitoPubblicazione {
  differenze: DifferenzaCammino[];
}

export async function preparaAnteprima(
  db: DatabaseSync,
  { cartella = CARTELLA_ANTEPRIMA, portale = CARTELLA_PORTALE, cartellaImmagini = CARTELLA_IMMAGINI } = {},
): Promise<EsitoAnteprima> {
  const esito = await pubblicaPortale(db, { destinazione: join(cartella, 'cammini'), cartellaImmagini, registra: false });
  let pagina = await readFile(join(PROTOTIPO, 'cammino.html'), 'utf8');
  if (!pagina.includes('<body>')) throw new Error('Nella pagina del portale non trovo <body>: controlla prototipo/cammino.html.');
  pagina = pagina.replace('<body>', `<body>\n${FASCETTA}`)
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">');
  await writeFile(join(cartella, 'cammino.html'), pagina);
  await mkdir(join(cartella, 'dati'), { recursive: true });
  for (const f of DATI_COMUNI) await copyFile(join(PROTOTIPO, 'dati', f), join(cartella, 'dati', f));
  return { ...esito, differenze: await confrontaCammini(join(cartella, 'cammini'), portale) };
}

export interface StatoAnteprima {
  generatoIl: string;
  modificatiDopo: string[]; // cammini cambiati nel database dopo l'anteprima: nel portale non andrebbero
  differenze: DifferenzaCammino[]; // che cosa cambierebbe nel portale pubblicandola
}

export async function statoAnteprima(
  db: DatabaseSync, { cartella = CARTELLA_ANTEPRIMA, portale = CARTELLA_PORTALE } = {},
): Promise<StatoAnteprima | null> {
  const stato = await statoPubblicazione(db, join(cartella, 'cammini'));
  if (!stato.generatoIl) return null;
  return { generatoIl: stato.generatoIl, modificatiDopo: stato.modificatiDopo, differenze: await confrontaCammini(join(cartella, 'cammini'), portale) };
}

// Pubblica l'anteprima: la sua cartella dei cammini prende il posto di quella del portale. Si copia accanto e
// poi si scambia, così il portale non resta mai a metà.
export async function pubblicaAnteprima(
  db: DatabaseSync, { cartella = CARTELLA_ANTEPRIMA, portale = CARTELLA_PORTALE } = {},
): Promise<{ generatoIl: string; cammini: string[] }> {
  if (inCorso) throw new Error("C'è già una pubblicazione in corso: attendi qualche secondo e riprova.");
  inCorso = true;
  const nuova = `${portale}.nuova`, vecchia = `${portale}.vecchia`;
  try {
    let indice: Indice;
    try {
      indice = JSON.parse(await readFile(join(cartella, 'cammini', 'indice.json'), 'utf8')) as Indice;
    } catch {
      throw new Error("Non c'è un'anteprima da pubblicare: preparala prima.");
    }
    await rm(nuova, { recursive: true, force: true });
    await rm(vecchia, { recursive: true, force: true });
    await cp(join(cartella, 'cammini'), nuova, { recursive: true });
    if (await esiste(portale)) await rename(portale, vecchia);
    await rename(nuova, portale);
    await rm(vecchia, { recursive: true, force: true });
    const titoli = indice.cammini.map((c) => c.titolo);
    registraModifica(db, {
      azione: 'modifica', oggetto: 'pubblicazione', titolo: 'Portale',
      descrizione: `Portale aggiornato dall'anteprima: ${titoli.length} ${titoli.length === 1 ? 'cammino' : 'cammini'}`,
    });
    return { generatoIl: indice.generatoIl ?? '', cammini: titoli };
  } catch (errore) {
    registraErrore(db, {
      origine: 'pubblicazione', messaggio: errore instanceof Error ? errore.message : String(errore),
      dettagli: errore instanceof Error ? errore.stack ?? null : null,
    });
    throw errore;
  } finally {
    inCorso = false;
  }
}

// --- Che cosa cambia nel portale: confronto tra due cartelle di cammini pubblicati ---------------------

export interface DifferenzaCammino {
  slug: string;
  titolo: string;
  esito: 'nuovo' | 'tolto' | 'cambiato' | 'uguale';
  dettagli: string[];
}

const CAMPI_CAMMINO: Record<string, string> = {
  titolo: 'titolo', nome: 'nome in legenda', sottotitolo: 'sottotitolo', globo: 'testi del globo', panoramica: 'panoramica',
  ritorno: "ritorno dopo l'ultima tappa", frecce: 'frecce', etichette: 'nomi scritti a mano', epoche: 'epoche',
};
const CAMPI_TAPPA: Record<string, string> = {
  nome: 'nome', breve: 'nome breve', breveOggi: 'nome breve in «Oggi»', coordinate: 'posizione', luogoAttuale: '«Dove si trova oggi»',
  riferimento: 'riferimento', testo: 'testo del pannello', approfondimento: 'approfondimento', immagini: 'immagini', tracciato: 'tracciato',
  secondaria: 'nome solo da vicino',
};
const PARTI_CARTINA: Record<string, string> = { stili: 'stili', elementi: 'aree e linee', nomi: 'nomi', alone: 'alone', fonte: 'file di origine' };

const leggiSeEsiste = async <T>(percorso: string): Promise<T | null> => {
  try { return JSON.parse(await readFile(percorso, 'utf8')) as T; } catch { return null; }
};
const uguali = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const cambiati = (a: Record<string, unknown>, b: Record<string, unknown>, nomi: Record<string, string>) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => k in nomi && !uguali(a[k], b[k])).map((k) => nomi[k]);
const fileIn = (cartella: string) => readdir(cartella).catch(() => [] as string[]);

export async function confrontaCammini(nuova: string, attuale: string): Promise<DifferenzaCammino[]> {
  const indiceNuovo = await leggiSeEsiste<Indice>(join(nuova, 'indice.json'));
  const indiceAttuale = await leggiSeEsiste<Indice>(join(attuale, 'indice.json'));
  const voci = new Map<string, { nuovo?: Indice['cammini'][number]; attuale?: Indice['cammini'][number] }>();
  for (const c of indiceNuovo?.cammini ?? []) voci.set(c.id, { nuovo: c });
  for (const c of indiceAttuale?.cammini ?? []) voci.set(c.id, { ...voci.get(c.id), attuale: c });
  const esito: DifferenzaCammino[] = [];
  for (const [slug, { nuovo, attuale: prima }] of voci) {
    const titolo = (nuovo ?? prima)!.titolo;
    if (!prima) { esito.push({ slug, titolo, esito: 'nuovo', dettagli: [] }); continue; }
    if (!nuovo) { esito.push({ slug, titolo, esito: 'tolto', dettagli: [] }); continue; }
    const dettagli: string[] = [];
    if (!!nuovo.bozza !== !!prima.bozza) dettagli.push(nuovo.bozza ? 'torna in bozza' : 'da bozza diventa pubblicato');
    const a = await leggiSeEsiste<CamminoPubblicato>(join(attuale, slug, 'cammino.json'));
    const b = await leggiSeEsiste<CamminoPubblicato>(join(nuova, slug, 'cammino.json'));
    if (a && b) {
      const campi = cambiati(a as unknown as Record<string, unknown>, b as unknown as Record<string, unknown>, CAMPI_CAMMINO);
      if (campi.length) dettagli.push(`Cammino: ${campi.join(', ')}`);
      if (a.tappe.length !== b.tappe.length) dettagli.push(`Tappe: da ${a.tappe.length} a ${b.tappe.length}`);
      b.tappe.forEach((t, i) => {
        const vecchia = a.tappe[i];
        if (!vecchia) return;
        const diverse = cambiati(vecchia as unknown as Record<string, unknown>, t as unknown as Record<string, unknown>, CAMPI_TAPPA);
        if (diverse.length) dettagli.push(`Tappa ${i + 1} «${t.nome}»: ${diverse.join(', ')}`);
      });
      for (const epoca of b.epoche) {
        const ka = await leggiSeEsiste<CartinaPubblicata>(join(attuale, slug, epoca.cartina));
        const kb = await leggiSeEsiste<CartinaPubblicata>(join(nuova, slug, epoca.cartina));
        if (!ka) { dettagli.push(`Cartina ${epoca.pulsante}: nuova`); continue; }
        const parti = cambiati(ka as unknown as Record<string, unknown>, (kb ?? {}) as unknown as Record<string, unknown>, PARTI_CARTINA);
        if (parti.length) dettagli.push(`Cartina ${epoca.pulsante}: ${parti.join(', ')}`);
      }
      for (const epoca of a.epoche) if (!b.epoche.some((e) => e.cartina === epoca.cartina)) dettagli.push(`Cartina ${epoca.pulsante}: tolta`);
    }
    const immaginiPrima = new Set(await fileIn(join(attuale, slug, 'immagini')));
    const immaginiDopo = new Set(await fileIn(join(nuova, slug, 'immagini')));
    // ogni immagine è pubblicata due volte (grande e miniatura): si contano le grandi
    const grandi = (x: Set<string>, y: Set<string>) => [...x].filter((n) => !y.has(n) && !n.endsWith('-mini.webp')).length;
    const aggiunte = grandi(immaginiDopo, immaginiPrima), tolte = grandi(immaginiPrima, immaginiDopo);
    if (aggiunte) dettagli.push(aggiunte === 1 ? '1 immagine nuova' : `${aggiunte} immagini nuove`);
    if (tolte) dettagli.push(tolte === 1 ? '1 immagine tolta' : `${tolte} immagini tolte`);
    esito.push({ slug, titolo, esito: dettagli.length ? 'cambiato' : 'uguale', dettagli });
  }
  return esito;
}

// --- Demo da caricare su un server --------------------------------------------------------------------

// Una cartella con il portale pronto da caricare così com'è (per esempio con FileZilla) su qualunque
// server web: è un sito statico. La pagina diventa index.html, il satellite le sta accanto in bmng/.
// Contiene il portale com'è pubblicato (prototipo/cammini/), così la demo è uguale a quello che si vede sul PC.
export const CARTELLA_DEMO = process.env.CAMMINI_DEMO ?? join(RADICE, 'pubblicazione');
const SATELLITE = join(RADICE, 'bmng', 'bmng.pmtiles');

const LEGGIMI = `Cammini: demo del portale
=========================

Questa cartella è il portale pronto da caricare su un server web (è un sito statico: non serve altro).

Come pubblicarla con FileZilla
1. Collegati al server e apri (o crea) la cartella dove deve stare la demo, per esempio /cammini-demo/.
2. Trascina lì TUTTO il contenuto di questa cartella: index.html, robots.txt e le cartelle bmng, cammini, dati.
   Il file bmng/bmng.pmtiles (il satellite) pesa più di 100 MB: il caricamento richiede qualche minuto.
3. Apri nel browser l'indirizzo della cartella, per esempio https://www.esempio.it/cammini-demo/

Se il globo resta blu senza satellite, il server non permette di leggere i file «a pezzi» (richieste Range):
il resto del portale funziona lo stesso; va chiesto a chi gestisce il server.

La demo non compare nei motori di ricerca (robots.txt e un'indicazione nella pagina), ma chi conosce
l'indirizzo la può aprire. Contiene anche i cammini ancora in bozza.

Per aggiornarla: nel backoffice, pagina «Pubblicazione», «Prepara la demo», poi ricarica i file cambiati
(di solito basta la cartella cammini; bmng/bmng.pmtiles non cambia).
`;

export interface EsitoDemo {
  cartella: string;
  file: number;
  byte: number;
  satelliteCopiato: boolean;
  avvisi: string[];
}

export async function preparaDemo(db: DatabaseSync, destinazione = CARTELLA_DEMO): Promise<EsitoDemo> {
  const avvisi: string[] = [];
  const prototipo = PROTOTIPO;
  if (!(await esiste(join(CARTELLA_PORTALE, 'indice.json')))) throw new Error('Il portale non è ancora stato pubblicato: prepara l\'anteprima e pubblicala.');
  // la cartella si rifà da capo, tranne il satellite (113 MB) se è già quello giusto
  await mkdir(destinazione, { recursive: true });
  for (const voce of await readdir(destinazione)) if (voce !== 'bmng') await rm(join(destinazione, voce), { recursive: true, force: true });

  // la pagina: index.html, con il satellite accanto e fuori dai motori di ricerca
  let pagina = await readFile(join(prototipo, 'cammino.html'), 'utf8');
  if (!pagina.includes('"../bmng/bmng.pmtiles"')) throw new Error('Nella pagina non trovo il percorso del satellite: controlla prototipo/cammino.html.');
  pagina = pagina.replace('"../bmng/bmng.pmtiles"', '"bmng/bmng.pmtiles"')
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">');
  await writeFile(join(destinazione, 'index.html'), pagina);
  await writeFile(join(destinazione, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await writeFile(join(destinazione, 'LEGGIMI.txt'), LEGGIMI);
  await mkdir(join(destinazione, 'dati'), { recursive: true });
  for (const f of DATI_COMUNI) await copyFile(join(prototipo, 'dati', f), join(destinazione, 'dati', f));
  await cp(CARTELLA_PORTALE, join(destinazione, 'cammini'), { recursive: true });

  let satelliteCopiato = false;
  const dimensione = (p: string) => stat(p).then((s) => s.size, () => -1);
  const satellite = await dimensione(SATELLITE);
  if (satellite < 0) avvisi.push('Manca bmng/bmng.pmtiles: la demo non avrà il satellite (vedi bmng/LEGGIMI.md).');
  else if (satellite !== await dimensione(join(destinazione, 'bmng', 'bmng.pmtiles'))) {
    await mkdir(join(destinazione, 'bmng'), { recursive: true });
    await copyFile(SATELLITE, join(destinazione, 'bmng', 'bmng.pmtiles'));
    satelliteCopiato = true;
  }
  registraModifica(db, { azione: 'modifica', oggetto: 'pubblicazione', titolo: 'Demo', descrizione: `Demo preparata in ${destinazione}` });
  return { cartella: destinazione, ...(await misura(destinazione)), satelliteCopiato, avvisi };
}

async function misura(cartella: string): Promise<{ file: number; byte: number }> {
  let file = 0, byte = 0;
  for (const voce of await readdir(cartella, { recursive: true, withFileTypes: true })) {
    if (!voce.isFile()) continue;
    file++;
    byte += (await stat(join(voce.parentPath, voce.name))).size;
  }
  return { file, byte };
}

// Apre una cartella in Esplora file (o nel Finder), per trascinarne il contenuto in FileZilla
export function apriCartella(cartella: string): void {
  const comando = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(comando, [cartella], { detached: true, stdio: 'ignore' }).unref();
}

// --- Stato, per la pagina ---------------------------------------------------------------------------

export interface StatoPubblicazione {
  generatoIl: string | null;
  modificatiDopo: string[]; // titoli dei cammini cambiati dopo l'ultima pubblicazione
  cartella: string;
}

// Un cammino nel portale: non c'è, c'è ma è cambiato dopo l'ultima pubblicazione, o è aggiornato.
export async function statoNelPortale(db: DatabaseSync, id: number, destinazione = CARTELLA_PORTALE): Promise<'assente' | 'da-aggiornare' | 'aggiornato'> {
  const c = leggiCammino(db, id);
  let indice: Indice | null = null;
  try {
    indice = JSON.parse(await readFile(join(destinazione, 'indice.json'), 'utf8')) as Indice;
  } catch { /* mai pubblicato */ }
  if (!c || !indice?.cammini.some((x) => x.id === c.slug)) return 'assente';
  const soglia = (indice.generatoIl ?? '').replace(/\.\d+Z$/, 'Z');
  return c.modificatoIl > soglia ? 'da-aggiornare' : 'aggiornato';
}

export async function statoPubblicazione(db: DatabaseSync, destinazione = CARTELLA_PORTALE): Promise<StatoPubblicazione> {
  let generatoIl: string | null = null;
  try {
    generatoIl = (JSON.parse(await readFile(join(destinazione, 'indice.json'), 'utf8')) as Indice).generatoIl ?? null;
  } catch { /* mai pubblicato */ }
  const soglia = generatoIl?.replace(/\.\d+Z$/, 'Z');
  const modificatiDopo = db.prepare(`SELECT titolo FROM cammini WHERE ?1 IS NULL OR modificato_il > ?1 ORDER BY ordine, titolo`)
    .all(soglia ?? null).map((r) => String(r.titolo));
  return { generatoIl, modificatiDopo, cartella: destinazione };
}
