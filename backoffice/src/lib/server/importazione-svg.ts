// Importazione di una cartina SVG nel backoffice.
// 1. Il file si carica e il browser ne estrae il disegno (src/lib/estrazione.ts): forme e testi con le
//    coordinate sul foglio. Qui si salvano il file e il disegno.
// 2. Classificazione: ogni colore diventa uno stile, il percorso del cammino o niente; ogni gruppo di
//    testo un nome (con la sua categoria), la riga successiva o il sottotitolo di un nome, o niente.
//    Il sistema propone; il redattore conferma o corregge. Le proposte riusano le scelte della cartina
//    attuale, se c'è, così una nuova versione dello stesso file si riclassifica da sola.
// 3. Generazione: con gli spilli (punti di controllo) il disegno va sulla carta. Le forme si importano
//    intere, anche la parte che la stampa taglia sulla cornice (l'arco della Mezzaluna); le aree si
//    ritagliano sulle terre emerse se lo stile lo chiede; un'area opaca disegnata sopra un'altra le
//    toglie la parte coperta; nomi al loro posto con la loro inclinazione, città e vette dove sono i
//    luoghi dell'anagrafe; tracciati delle tappe e frecce dal percorso; alone. Si sostituiscono solo
//    elementi e nomi «importati».
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { inTransazione } from '../../../db/connessione.ts';
import { slug } from '../../../db/slug.ts';
import {
  CATEGORIE_NOMI, NOMI_DI_LUOGHI, ZOOM_NOMI, chiaveArea, chiaveLinea, eSimbolo, gruppiDiColore, gruppiDiTesto, normale,
  type CategoriaNome, type Classificazione, type Disegno, type GruppoDiColore, type GruppoDiTesto, type Punto, type UsoColore,
  type UsoTesto,
} from '../disegno.ts';
import { adatta, trasforma, type Spillo } from '../georeferenziazione.ts';
import {
  buffer, inGeoJSON, piuGrande, poligono, semplifica, terreEmerse, unione, geometria, type Geometria,
} from './geometria.ts';
import { adesso } from './moduli.ts';
import { tracciaPercorso } from './percorso.ts';
import { registraModifica } from './registro.ts';

export const CARTELLA_CARTINE = process.env.CAMMINI_CARTINE ?? fileURLToPath(new URL('../../../dati/cartine/', import.meta.url));
const ALONE = Array.from({ length: 16 }, (_, i) => Math.round((0.6 + 0.35 * i) * 100) / 100); // da 0,6 a 5,85 gradi

// --- Lettura -----------------------------------------------------------------------------------------

interface DatiCartina {
  id: number;
  camminoId: number;
  pulsante: string;
  disegno: Disegno | null;
  classificazione: Classificazione;
}

function leggiDati(db: DatabaseSync, id: number): DatiCartina {
  const r = db.prepare('SELECT * FROM cartine WHERE id = ?').get(id);
  if (!r) throw new Error('Cartina non trovata.');
  const classificazione = JSON.parse(String(r.classificazione)) as Classificazione;
  return {
    id, camminoId: Number(r.cammino_id), pulsante: String(r.pulsante),
    disegno: r.disegno == null ? null : (JSON.parse(String(r.disegno)) as Disegno),
    classificazione: { colori: classificazione.colori ?? {}, testi: classificazione.testi ?? {} },
  };
}

interface LuogoBreve { id: number; nome: string; lng: number; lat: number; tipo: string; chiavi: string[] }

function luoghi(db: DatabaseSync): LuogoBreve[] {
  return db.prepare('SELECT id, nome, nome_antico, altri_nomi, lng, lat, tipo FROM luoghi').all().map((r) => ({
    id: Number(r.id), nome: String(r.nome), lng: Number(r.lng), lat: Number(r.lat), tipo: String(r.tipo),
    chiavi: [r.nome, r.nome_antico, ...(JSON.parse(String(r.altri_nomi)) as string[])].filter(Boolean).map((n) => normale(String(n))),
  }));
}
const trovaLuogo = (elenco: LuogoBreve[], ...nomi: string[]) =>
  elenco.find((l) => nomi.some((n) => n && l.chiavi.includes(normale(n.replace(/\n/g, ' '))))) ?? null;

// --- Salvataggio del file e del disegno ----------------------------------------------------------------

export async function salvaSvg(db: DatabaseSync, cartinaId: number, nomeFile: string, testoSvg: string, disegno: Disegno): Promise<void> {
  if (!disegno?.cornice || !Array.isArray(disegno.forme) || !Array.isArray(disegno.testi)) throw new Error('Disegno non valido.');
  const sha256 = createHash('sha256').update(testoSvg).digest('hex');
  await mkdir(CARTELLA_CARTINE, { recursive: true });
  await writeFile(join(CARTELLA_CARTINE, `${sha256}.svg`), testoSvg);
  const r = db.prepare('SELECT cammino_id, pulsante FROM cartine WHERE id = ?').get(cartinaId)!;
  db.prepare('UPDATE cartine SET svg = ?, fonte = ?, disegno = ? WHERE id = ?').run(`${sha256}.svg`, nomeFile, JSON.stringify(disegno), cartinaId);
  registraModifica(db, {
    azione: 'modifica', oggetto: 'cartina', oggettoId: cartinaId, camminoId: Number(r.cammino_id), titolo: String(r.pulsante),
    descrizione: `File SVG caricato (${nomeFile}): ${disegno.forme.length} forme, ${disegno.testi.length} testi`,
  });
}

export function creaCartina(db: DatabaseSync, camminoId: number, d: { epoca: string; pulsante: string; anno: number }): number {
  const id = Number(db.prepare('INSERT INTO cartine (cammino_id, epoca, pulsante, anno) VALUES (?, ?, ?, ?)').run(camminoId, d.epoca, d.pulsante, d.anno).lastInsertRowid);
  registraModifica(db, { azione: 'creazione', oggetto: 'cartina', oggettoId: id, camminoId, titolo: d.pulsante, descrizione: 'Cartina creata' });
  return id;
}

// --- Classificazione: proposte ---------------------------------------------------------------------------

export interface RigaColore extends GruppoDiColore { uso: UsoColore; proposto: boolean }
export interface RigaTesto extends GruppoDiTesto { uso: UsoTesto; proposto: boolean; luogo: string | null }

function proponiColori(db: DatabaseSync, k: DatiCartina, disegno: Disegno): Record<string, UsoColore> {
  const stili = db.prepare('SELECT chiave, tipo, colore, contorno FROM stili WHERE cartina_id = ?').all(k.id);
  // Il percorso è la linea che ha punte di freccia dello stesso colore
  const coloriFrecce = new Map<string, number>();
  for (const f of disegno.forme) if (eSimbolo(f)) coloriFrecce.set(f.riempimento!, (coloriFrecce.get(f.riempimento!) ?? 0) + 1);
  const proposte: Record<string, UsoColore> = {};
  for (const g of gruppiDiColore(disegno)) {
    const stile = stili.find((s) => s.tipo === g.tipo && s.colore === g.colore);
    if (stile) proposte[g.chiave] = { uso: 'stile', stile: String(stile.chiave) };
    else if (g.tipo === 'linea' && (coloriFrecce.get(g.colore) ?? 0) >= 2 && g.colore !== '#ffffff') proposte[g.chiave] = { uso: 'percorso' };
    else proposte[g.chiave] = { uso: 'ignora' }; // anche il contorno di uno stile d'area: lo disegna lo stile
  }
  return proposte;
}

function proponiTesti(db: DatabaseSync, k: DatiCartina, gruppi: GruppoDiTesto[]): Record<string, UsoTesto> {
  const proposte: (UsoTesto | undefined)[] = new Array(gruppi.length);
  const esistenti = db.prepare("SELECT categoria, testo, sotto FROM nomi WHERE cartina_id = ? ORDER BY posizione, id").all(k.id)
    .map((n) => ({ categoria: String(n.categoria) as CategoriaNome, testo: String(n.testo), sotto: n.sotto == null ? null : String(n.sotto) }));
  // Una sequenza di gruppi liberi consecutivi il cui testo, unito, è quello cercato. Prima si cercano
  // gruppi scritti come la categoria vuole (regni e regioni in maiuscolo, città no): la città e la regione
  // di Babilonia hanno lo stesso nome.
  const maiuscolo = (g: GruppoDiTesto) => g.testo === g.testo.toUpperCase();
  const sequenza = (cercato: string, categoria?: CategoriaNome): [number, number] | null => {
    const bersaglio = normale(cercato);
    const vuoleMaiuscolo = categoria && ['regno', 'regione-antica', 'regione'].includes(categoria);
    for (const conCategoria of categoria ? [true, false] : [false]) {
      for (let i = 0; i < gruppi.length; i++) {
        if (conCategoria && maiuscolo(gruppi[i]) !== vuoleMaiuscolo) continue;
        let unito = '';
        for (let j = i; j < gruppi.length && !proposte[j]; j++) {
          unito += normale(gruppi[j].testo);
          if (!bersaglio.startsWith(unito)) break;
          if (unito === bersaglio) return [i, j];
        }
      }
    }
    return null;
  };
  // le righe del testo vanno ai gruppi, se sono tante quante i gruppi; se no tutto al primo
  const distribuisci = (testo: string, [i, j]: [number, number], primo: (t: string) => UsoTesto, altri: (t: string) => UsoTesto) => {
    const righe = testo.split('\n');
    const uguali = righe.length === j - i + 1;
    for (let n = i; n <= j; n++) proposte[n] = n === i ? primo(uguali ? righe[0] : testo) : altri(uguali ? righe[n - i] : '');
  };
  for (const n of esistenti) {
    const s = sequenza(n.testo, n.categoria);
    if (!s) continue;
    const testa = gruppi[s[0]].chiave;
    distribuisci(n.testo, s, (t) => ({ uso: 'nome', categoria: n.categoria, testo: t }), (t) => ({ uso: 'riga', testo: t, di: testa }));
    if (n.sotto) {
      const ss = sequenza(n.sotto);
      if (ss) distribuisci(n.sotto, ss, (t) => ({ uso: 'sotto', testo: t, di: testa }), (t) => ({ uso: 'sotto', testo: t, di: testa }));
    }
  }
  if (esistenti.length) return Object.fromEntries(gruppi.map((g, i) => [g.chiave, proposte[i] ?? { uso: 'ignora' }]));

  // Cartina nuova: si propone dai luoghi dell'anagrafe, dal colore, dalle maiuscole e dalla posizione
  const elenco = luoghi(db);
  const tappe = new Set(db.prepare('SELECT luogo_id FROM tappe WHERE cammino_id = ?').all(k.camminoId).map((r) => Number(r.luogo_id)));
  // Capitali: il simbolo più vicino al nome ha un colore diverso da quello più comune tra i simboli delle città
  const simboli = (k.disegno?.forme ?? []).filter(eSimbolo).map((f) => ({ colore: f.riempimento!, centro: [(f.box[0] + f.box[2]) / 2, (f.box[1] + f.box[3]) / 2] }));
  const frequenza = new Map<string, number>();
  for (const s of simboli) frequenza.set(s.colore, (frequenza.get(s.colore) ?? 0) + 1);
  const coloreCitta = [...frequenza].sort((a, b) => b[1] - a[1])[0]?.[0];
  const simboloVicino = (g: GruppoDiTesto) => {
    const c = [(g.box[0] + g.box[2]) / 2, (g.box[1] + g.box[3]) / 2];
    return simboli.reduce<(typeof simboli)[number] | null>((m, s) => (!m || Math.hypot(s.centro[0] - c[0], s.centro[1] - c[1]) < Math.hypot(m.centro[0] - c[0], m.centro[1] - c[1]) ? s : m), null);
  };
  // Una riga subito sotto un'altra dello stesso stile la continua; una riga più piccola subito sotto un
  // nome ne è il sottotitolo
  const sotto = (a: GruppoDiTesto, b: GruppoDiTesto) => b.box[1] >= a.box[3] - a.dimensione * 0.3 && b.box[1] <= a.box[3] + a.dimensione * 0.6
    && Math.min(a.box[2], b.box[2]) > Math.max(a.box[0], b.box[0]) && a.colore === b.colore;
  const usi: UsoTesto[] = [];
  let testa: string | null = null, gruppoTesta: GruppoDiTesto | null = null;
  gruppi.forEach((g, i) => {
    const maiuscolo = g.testo === g.testo.toUpperCase() && /[A-Z]/.test(g.testo);
    const prima = i > 0 ? gruppi[i - 1] : null;
    let uso: UsoTesto = { uso: 'ignora' };
    if (testa && prima && usi[i - 1].uso !== 'ignora' && sotto(prima, g)) {
      if (Math.abs(g.dimensione - prima.dimensione) < 0.5 && usi[i - 1].uso !== 'sotto') uso = { uso: 'riga', testo: maiuscolo ? g.testo.toLowerCase() : g.testo, di: testa };
      else if (g.dimensione < (gruppoTesta?.dimensione ?? 0) * 0.8) uso = { uso: 'sotto', testo: g.testo, di: testa };
    }
    if (uso.uso === 'ignora') {
      const luogo = maiuscolo ? null : trovaLuogo(elenco, g.testo); // una scritta in maiuscolo non è una città
      const acqua = /^#(0|1|2|3)[0-9a-f](6|7|8|9|a|b)[0-9a-f]{3}$/i.test(g.colore) || /^(mar|golfo|lago|mare)\b/i.test(g.testo);
      if (luogo) {
        const capitale = simboloVicino(g)?.colore !== coloreCitta && luogo.tipo !== 'vetta';
        uso = tappe.has(luogo.id) ? { uso: 'ignora' } : { uso: 'nome', categoria: luogo.tipo === 'vetta' ? 'vetta' : capitale ? 'capitale-antica' : 'citta-antica', testo: g.testo };
      } else if (acqua) uso = { uso: 'nome', categoria: /^(mar|golfo|lago|mare)\b/i.test(g.testo) ? 'mare' : 'fiume', testo: g.testo };
      else if (maiuscolo) uso = { uso: 'nome', categoria: g.dimensione >= 8.5 ? 'regno' : 'regione-antica', testo: g.testo.charAt(0) + g.testo.slice(1).toLowerCase() };
    }
    if (uso.uso === 'nome') { testa = g.chiave; gruppoTesta = g; }
    else if (uso.uso === 'ignora') { testa = null; gruppoTesta = null; }
    usi.push(uso);
  });
  return Object.fromEntries(gruppi.map((g, i) => [g.chiave, usi[i]]));
}

// Le scelte del redattore e, dove mancano, le proposte
export function classificazioneEffettiva(db: DatabaseSync, id: number) {
  const k = leggiDati(db, id);
  if (!k.disegno) return null;
  const gruppiTesto = gruppiDiTesto(k.disegno);
  const proposteColori = proponiColori(db, k, k.disegno);
  const proposteTesti = proponiTesti(db, k, gruppiTesto);
  const elenco = luoghi(db);
  const colori: RigaColore[] = gruppiDiColore(k.disegno).map((g) => ({
    ...g, uso: k.classificazione.colori[g.chiave] ?? proposteColori[g.chiave], proposto: !k.classificazione.colori[g.chiave],
  }));
  const testi: RigaTesto[] = gruppiTesto.map((g) => {
    const uso = k.classificazione.testi[g.chiave] ?? proposteTesti[g.chiave];
    const luogo = uso.uso === 'nome' && NOMI_DI_LUOGHI.includes(uso.categoria) ? trovaLuogo(elenco, uso.testo, g.testo) : null;
    return { ...g, uso, proposto: !k.classificazione.testi[g.chiave], luogo: luogo?.nome ?? null };
  });
  return { disegno: k.disegno, colori, testi };
}

// --- Classificazione: salvataggio ---------------------------------------------------------------------

export function salvaClassificazione(db: DatabaseSync, id: number, modulo: FormData): { stiliNuovi: string[] } {
  const effettiva = classificazioneEffettiva(db, id);
  if (!effettiva) throw new Error('Prima carica il file SVG.');
  const k = leggiDati(db, id);
  return inTransazione(db, () => {
    const stiliNuovi: string[] = [];
    const esistenti = new Set(db.prepare('SELECT chiave FROM stili WHERE cartina_id = ?').all(id).map((r) => String(r.chiave)));
    const colori: Record<string, UsoColore> = {};
    for (const g of effettiva.colori) {
      const scelta = String(modulo.get(`colore:${g.chiave}`) ?? '');
      if (scelta === 'percorso') colori[g.chiave] = { uso: 'percorso' };
      else if (scelta.startsWith('stile:') && esistenti.has(scelta.slice(6))) colori[g.chiave] = { uso: 'stile', stile: scelta.slice(6) };
      else if (scelta === 'nuovo') {
        // uno stile nuovo, con il colore del disegno e i valori delle cartine del volume
        const nome = String(modulo.get(`nuovo:${g.chiave}`) ?? '').trim() || `${g.tipo === 'area' ? 'Area' : 'Linea'} ${g.colore}`;
        let chiave = slug(nome) || g.tipo;
        for (let n = 2; esistenti.has(chiave); n++) chiave = `${slug(nome) || g.tipo}-${n}`;
        const posizione = Number(db.prepare('SELECT coalesce(max(posizione) + 1, 0) AS n FROM stili WHERE cartina_id = ?').get(id)!.n);
        db.prepare(`INSERT INTO stili (cartina_id, chiave, posizione, tipo, nome, colore, opacita, contorno, spessore, tratteggio, ritaglio)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, chiave, posizione, g.tipo, nome, g.colore,
            g.tipo === 'area' ? JSON.stringify(g.opacita < 0.9 ? Math.round(g.opacita * 40) / 100 : [0.82, 0.66]) : null,
            g.tipo === 'area' ? '#5e6062' : null, JSON.stringify(g.tipo === 'area' ? [1.1, 1.8] : [1.6, 2.6]),
            g.tipo === 'linea' && g.tratteggiato ? JSON.stringify([0.1, 2]) : null, g.tipo === 'area' && g.opacita >= 0.9 ? 1 : 0);
        esistenti.add(chiave);
        stiliNuovi.push(nome);
        colori[g.chiave] = { uso: 'stile', stile: chiave };
      } else colori[g.chiave] = { uso: 'ignora' };
    }
    const testi: Record<string, UsoTesto> = {};
    let testa: string | null = null; // il nome a cui si attaccano righe e sottotitoli che seguono
    for (const g of effettiva.testi) {
      const uso = String(modulo.get(`uso:${g.chiave}`) ?? 'ignora');
      const testo = String(modulo.get(`testo:${g.chiave}`) ?? '').trim();
      const categoria = String(modulo.get(`categoria:${g.chiave}`) ?? '') as CategoriaNome;
      if (uso === 'nome' && CATEGORIE_NOMI.includes(categoria)) {
        testi[g.chiave] = { uso: 'nome', categoria, testo: testo || g.testo };
        testa = g.chiave;
      } else if ((uso === 'riga' || uso === 'sotto') && testa) testi[g.chiave] = { uso, testo, di: testa };
      else testi[g.chiave] = { uso: 'ignora' };
    }
    db.prepare('UPDATE cartine SET classificazione = ? WHERE id = ?').run(JSON.stringify({ colori, testi }), id);
    registraModifica(db, {
      azione: 'modifica', oggetto: 'cartina', oggettoId: id, camminoId: k.camminoId, titolo: k.pulsante,
      descrizione: 'Classificazione di colori e testi salvata' + (stiliNuovi.length ? `; stili nuovi: ${stiliNuovi.join(', ')}` : ''),
    });
    return { stiliNuovi };
  });
}

// --- Generazione --------------------------------------------------------------------------------------

export interface EsitoGenerazione {
  elementi: number;
  nomi: number;
  tracciati: number;
  frecce: number;
  avvisi: string[];
  secondi: number;
}

type Nome = [string, string, number, number, number, { angolo?: number; sotto?: string }?];

export async function generaCartina(db: DatabaseSync, id: number): Promise<EsitoGenerazione> {
  const inizio = Date.now();
  const k = leggiDati(db, id);
  const effettiva = classificazioneEffettiva(db, id);
  if (!k.disegno || !effettiva) throw new Error('Prima carica il file SVG.');
  const d = k.disegno;
  const avvisi: string[] = [];
  const spilli: Spillo[] = db.prepare('SELECT sx, sy, lng, lat, certezza FROM punti_controllo WHERE cartina_id = ? ORDER BY posizione').all(id)
    .map((p) => ({ sx: Number(p.sx), sy: Number(p.sy), lng: Number(p.lng), lat: Number(p.lat), certezza: String(p.certezza) as Spillo['certezza'] }));
  const modello = adatta(spilli, d.cornice);
  if (!modello) throw new Error('Servono almeno 3 punti di controllo: allinea prima la cartina.');
  const T = (p: Punto): Punto => trasforma(modello, p[0], p[1]);
  const usoColore = new Map(effettiva.colori.map((c) => [c.chiave, c.uso]));
  const stili = new Map(db.prepare('SELECT id, chiave, tipo, nome, ritaglio, opacita FROM stili WHERE cartina_id = ?').all(id)
    .map((s) => [String(s.chiave), {
      id: Number(s.id), tipo: String(s.tipo), nome: String(s.nome), ritaglio: Boolean(s.ritaglio),
      coprente: Math.max(...[s.opacita == null ? 1 : (JSON.parse(String(s.opacita)) as number | number[])].flat()) >= 0.5,
    }]));

  // 1. Aree, nell'ordine del disegno: ogni area coprente toglie la parte coperta alle aree disegnate prima
  // (Mari sopra l'impero babilonese), un velo no (l'arco della Mezzaluna). Conta l'opacità dello stile nel
  // portale, non quella del disegno: nelle cartine i veli sono spesso aree piene con sopra copie schiarite.
  const aree: { stile: string; g: Geometria; opaca: boolean }[] = [];
  for (const f of d.forme) {
    if (!f.riempimento || eSimbolo(f)) continue;
    const uso = usoColore.get(chiaveArea(f));
    if (uso?.uso !== 'stile' || stili.get(uso.stile)?.tipo !== 'area') continue;
    const g = unione(f.parti.map((p) => poligono(p.map(T))).filter((p): p is Geometria => p !== null));
    if (g) aree.push({ stile: uso.stile, g, opaca: stili.get(uso.stile)!.coprente });
  }
  for (let j = 0; j < aree.length; j++) {
    if (!aree[j].opaca) continue;
    for (let i = 0; i < j; i++) if (aree[i].g.intersects(aree[j].g)) aree[i].g = aree[i].g.difference(aree[j].g);
  }
  // ritaglio sulle terre emerse, per gli stili che lo chiedono (i mari sono spesso disegnati sopra i regni)
  const daRitagliare = aree.filter((a) => stili.get(a.stile)!.ritaglio);
  if (daRitagliare.length) {
    const inv = daRitagliare.map((a) => a.g.getEnvelopeInternal());
    const terre = await terreEmerse([Math.min(...inv.map((e) => e.getMinX())) - 1, Math.min(...inv.map((e) => e.getMinY())) - 1,
      Math.max(...inv.map((e) => e.getMaxX())) + 1, Math.max(...inv.map((e) => e.getMaxY())) + 1]);
    for (const a of daRitagliare) a.g = a.g.intersection(terre);
  }
  const perStile = new Map<string, Geometria[]>();
  for (const a of aree) perStile.set(a.stile, [...(perStile.get(a.stile) ?? []), a.g]);
  const elementi: { stile: string; nome: string; geometria: Geometria }[] = [];
  for (const [stile, geometrie] of perStile) {
    const g = unione(geometrie);
    if (g && !g.isEmpty()) elementi.push({ stile, nome: stili.get(stile)!.nome, geometria: semplifica(g, 0.005) });
  }

  // 2. Linee con il loro stile, e il percorso del cammino
  const lineePercorso: Punto[][] = [];
  const coloriPercorso = new Set<string>();
  const lineePerStile = new Map<string, Punto[][]>();
  for (const f of d.forme) {
    if (!f.tratto) continue;
    const uso = usoColore.get(chiaveLinea(f));
    if (!uso || uso.uso === 'ignora') continue;
    const pezzi = f.parti.map((p) => p.map(T));
    if (uso.uso === 'percorso') { lineePercorso.push(...pezzi); coloriPercorso.add(f.tratto); }
    else if (stili.get(uso.stile)?.tipo === 'linea') lineePerStile.set(uso.stile, [...(lineePerStile.get(uso.stile) ?? []), ...pezzi]);
  }
  for (const [stile, pezzi] of lineePerStile) {
    elementi.push({ stile, nome: stili.get(stile)!.nome, geometria: geometria({ type: 'MultiLineString', coordinates: pezzi }) });
  }

  // 3. Tracciati delle tappe (dalla tappa precedente) e frecce, se la cartina ha il percorso
  const tappe = db.prepare('SELECT t.id, l.lng, l.lat FROM tappe t JOIN luoghi l ON l.id = t.luogo_id WHERE t.cammino_id = ? ORDER BY t.posizione')
    .all(k.camminoId).map((r) => ({ id: Number(r.id), at: [Number(r.lng), Number(r.lat)] as Punto }));
  let tracciati: (Punto[] | null)[] | null = null;
  let frecce: { coordinate: Punto; rotazione: number }[] | null = null;
  if (lineePercorso.length && tappe.length > 1) {
    frecce = d.forme.filter((f) => eSimbolo(f) && coloriPercorso.has(f.riempimento!)).map((f) => freccia(f.parti[0], T));
    const esito = tracciaPercorso(lineePercorso, tappe.map((t) => t.at), frecce);
    tracciati = esito.tracciati;
    avvisi.push(...esito.avvisi);
  }

  // 4. Nomi
  const nomi = componiNomi(db, k, d, effettiva.testi, T, avvisi);

  // 5. Alone: veli sovrapposti, ognuno il mondo intero con un buco sempre più largo intorno ai dati
  const dati = unione([
    ...aree.map((a) => a.g),
    ...(tracciati ?? []).filter((t): t is Punto[] => !!t && t.length > 1).map((t) => geometria({ type: 'LineString', coordinates: t })),
    ...nomi.map((n) => buffer(geometria({ type: 'Point', coordinates: [n[2], n[3]] }), 0.3)),
  ]);
  const mondo = [[-180, -89.9], [180, -89.9], [180, 89.9], [-180, 89.9], [-180, -89.9]];
  const veli = dati ? ALONE.map((distanza) => {
    const buco = piuGrande(semplifica(buffer(semplifica(dati, 0.01), distanza, 16), 0.05));
    const anello = buco.getExteriorRing().getCoordinates().map((c) => [Math.round(c.x * 1000) / 1000, Math.round(c.y * 1000) / 1000]);
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mondo, anello] } };
  }) : [];

  // 6. Nel database: si sostituiscono solo elementi e nomi importati
  inTransazione(db, () => {
    db.prepare("DELETE FROM elementi WHERE cartina_id = ? AND origine = 'importato'").run(id);
    for (const e of elementi) {
      db.prepare("INSERT INTO elementi (cartina_id, stile_id, nome, geometria, origine) VALUES (?, ?, ?, ?, 'importato')")
        .run(id, stili.get(e.stile)!.id, e.nome, JSON.stringify(inGeoJSON(e.geometria)));
    }
    db.prepare("DELETE FROM nomi WHERE cartina_id = ? AND origine = 'importato'").run(id);
    const elencoLuoghi = luoghi(db);
    nomi.forEach(([categoria, testo, lng, lat, zoom, extra], posizione) => {
      const luogo = NOMI_DI_LUOGHI.includes(categoria as CategoriaNome) ? trovaLuogo(elencoLuoghi, testo) : null;
      db.prepare(`INSERT INTO nomi (cartina_id, posizione, categoria, testo, sotto, lng, lat, zoom, angolo, luogo_id, origine)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importato')`)
        .run(id, posizione, categoria, testo, extra?.sotto ?? null, lng, lat, zoom, extra?.angolo ?? null, luogo?.id ?? null);
    });
    db.prepare('UPDATE cartine SET alone = ?, generata_il = ?, importata_il = ? WHERE id = ?')
      .run(JSON.stringify({ type: 'FeatureCollection', features: veli }), adesso(), adesso(), id);
    if (tracciati) tracciati.forEach((t, i) => db.prepare('UPDATE tappe SET tracciato = ? WHERE id = ?').run(t ? JSON.stringify(t) : null, tappe[i + 1].id));
    if (frecce) db.prepare('UPDATE cammini SET frecce = ? WHERE id = ?').run(JSON.stringify(frecce), k.camminoId);
    db.prepare('UPDATE cammini SET modificato_il = ? WHERE id = ?').run(adesso(), k.camminoId);
    registraModifica(db, {
      azione: 'modifica', oggetto: 'cartina', oggettoId: id, camminoId: k.camminoId, titolo: k.pulsante,
      descrizione: `Cartina generata dal disegno: ${elementi.length} elementi, ${nomi.length} nomi`
        + (tracciati ? `, ${tracciati.filter(Boolean).length} tracciati, ${frecce!.length} frecce` : ''),
    });
  });
  return {
    elementi: elementi.length, nomi: nomi.length, tracciati: tracciati?.filter(Boolean).length ?? 0, frecce: frecce?.length ?? 0,
    avvisi, secondi: Math.round((Date.now() - inizio) / 100) / 10,
  };
}

// Una punta di freccia: posizione e direzione (gradi dal nord, in senso orario). Del triangolo si
// trovano i tre vertici (quelli che racchiudono l'area più grande); la punta è il vertice opposto al lato
// più corto.
function freccia(contorno: Punto[], T: (p: Punto) => Punto): { coordinate: Punto; rotazione: number } {
  const passo = Math.max(1, Math.floor(contorno.length / 40));
  const q = contorno.filter((_, i) => i % passo === 0);
  const area = (a: Punto, b: Punto, c: Punto) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));
  let v: Punto[] = [q[0], q[1], q[2]], migliore = -1;
  for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) for (let l = j + 1; l < q.length; l++) {
    const a = area(q[i], q[j], q[l]);
    if (a > migliore) { migliore = a; v = [q[i], q[j], q[l]]; }
  }
  const lati = [0, 1, 2].map((n) => Math.hypot(v[(n + 1) % 3][0] - v[n][0], v[(n + 1) % 3][1] - v[n][1]));
  const n = lati.indexOf(Math.min(...lati));
  const base: Punto = [(v[n][0] + v[(n + 1) % 3][0]) / 2, (v[n][1] + v[(n + 1) % 3][1]) / 2], punta = v[(n + 2) % 3];
  const centro: Punto = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3];
  const [c, b, p] = [T(centro), T(base), T(punta)];
  const dlng = (p[0] - b[0]) * Math.cos((c[1] * Math.PI) / 180);
  return {
    coordinate: [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4],
    rotazione: Math.round((Math.atan2(dlng, p[1] - b[1]) * 180) / Math.PI * 10) / 10,
  };
}

// I nomi della cartina: posizione (centro del nome con il suo sottotitolo), inclinazione portata sulla
// carta, città e vette dove sono i luoghi dell'anagrafe. Nell'ordine dei nomi già importati, se c'erano
// (l'ordine conta quando due nomi si contendono lo spazio), poi nell'ordine del disegno.
function componiNomi(db: DatabaseSync, k: DatiCartina, d: Disegno, testi: RigaTesto[], T: (p: Punto) => Punto, avvisi: string[]): Nome[] {
  const elencoLuoghi = luoghi(db);
  const simboli = d.forme.filter(eSimbolo).map((f): Punto => [(f.box[0] + f.box[2]) / 2, (f.box[1] + f.box[3]) / 2]);
  const teste = new Map<string, { categoria: CategoriaNome; testo: string; pezzi: number[]; box: number[]; sotto: string[]; boxTotale: number[] }>();
  const unisci = (a: number[], b: number[]) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
  for (const g of testi) {
    const u = g.uso;
    if (u.uso === 'nome') teste.set(g.chiave, { categoria: u.categoria, testo: u.testo, pezzi: [...g.pezzi], box: [...g.box], sotto: [], boxTotale: [...g.box] });
    else if (u.uso === 'riga' || u.uso === 'sotto') {
      const t = teste.get(u.di);
      if (!t) continue;
      if (u.uso === 'riga') {
        if (u.testo) t.testo += `\n${u.testo}`;
        t.pezzi.push(...g.pezzi);
        t.box = unisci(t.box, g.box);
      } else if (u.testo) t.sotto.push(u.testo);
      t.boxTotale = unisci(t.boxTotale, g.box);
    }
  }
  const nomi: Nome[] = [];
  for (const t of teste.values()) {
    const extra: { angolo?: number; sotto?: string } = {};
    if (t.sotto.length) extra.sotto = t.sotto.join('\n');
    let lng: number, lat: number;
    const centro: Punto = [(t.boxTotale[0] + t.boxTotale[2]) / 2, (t.boxTotale[1] + t.boxTotale[3]) / 2];
    if (NOMI_DI_LUOGHI.includes(t.categoria)) {
      // città e vette: dove sta il luogo; se non è nell'anagrafe, dove sta il simbolo più vicino al nome
      const luogo = trovaLuogo(elencoLuoghi, t.testo, ...t.pezzi.map((i) => d.testi[i].testo));
      if (luogo) [lng, lat] = [luogo.lng, luogo.lat];
      else {
        avvisi.push(`«${t.testo}» non è nell'anagrafe dei luoghi: il nome va sul simbolo più vicino. Aggiungilo all'anagrafe.`);
        const vicino = simboli.reduce<Punto | null>((m, s) => (!m || Math.hypot(s[0] - centro[0], s[1] - centro[1]) < Math.hypot(m[0] - centro[0], m[1] - centro[1]) ? s : m), null);
        [lng, lat] = T(vicino ?? centro);
      }
    } else {
      [lng, lat] = T(centro);
      // inclinazione: quella dei pezzi, o la corda dal primo all'ultimo pezzo per le lettere lungo una curva
      const pezzi = t.pezzi.map((i) => d.testi[i]);
      const inclinati = pezzi.filter((p) => Math.abs(p.angolo) > 3);
      let angolo = 0;
      if (inclinati.length && pezzi.length === 1) angolo = pezzi[0].angolo;
      else if (inclinati.length) {
        const c = (b: number[]) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
        const [a, b] = [c(pezzi[0].box), c(pezzi.at(-1)!.box)];
        angolo = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      }
      if (Math.abs(angolo) > 3) {
        const r = (angolo * Math.PI) / 180;
        const [p, q] = [T(centro), T([centro[0] + 10 * Math.cos(r), centro[1] + 10 * Math.sin(r)])];
        const dx = (q[0] - p[0]) * Math.cos((((p[1] + q[1]) / 2) * Math.PI) / 180);
        extra.angolo = Math.round((Math.atan2(-(q[1] - p[1]), dx) * 180) / Math.PI * 10) / 10;
      }
    }
    const voce: Nome = [t.categoria, t.testo, Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000, ZOOM_NOMI[t.categoria]];
    if (Object.keys(extra).length) voce.push(extra);
    nomi.push(voce);
  }
  // l'ordine dei nomi già importati
  const prima = db.prepare('SELECT categoria, testo FROM nomi WHERE cartina_id = ? ORDER BY posizione, id').all(k.id).map((n) => `${n.categoria}|${n.testo}`);
  const posto = (n: Nome) => { const i = prima.indexOf(`${n[0]}|${n[1]}`); return i < 0 ? Infinity : i; };
  return nomi.map((n, i) => ({ n, i })).sort((a, b) => posto(a.n) - posto(b.n) || a.i - b.i).map(({ n }) => n);
}

