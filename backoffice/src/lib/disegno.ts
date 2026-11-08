// Il disegno estratto da una cartina SVG e la sua classificazione: tipi e funzioni pure, usati sia
// dalle pagine sia dal server. Coordinate sul foglio, nelle unità del viewBox dell'SVG (y verso il basso).

export type Punto = [number, number];
export type Riquadro = [number, number, number, number]; // x0, y0, x1, y1

export interface Forma {
  parti: Punto[][]; // linee spezzate, una per sotto-tracciato (chiuse se la forma è riempita)
  riempimento: string | null; // #rrggbb
  opacita: number; // del riempimento, compresa quella dei gruppi che la contengono
  tratto: string | null; // colore della linea
  spessore: number; // della linea, in unità del foglio
  tratteggiato: boolean;
  box: Riquadro;
}

export interface Testo {
  testo: string;
  box: Riquadro;
  inizio: Punto; // inizio e fine della linea di base: servono a ricomporre le parole spezzate
  fine: Punto;
  angolo: number; // gradi, in senso orario sul foglio
  colore: string;
  dimensione: number; // corpo, in unità del foglio
}

export interface Disegno {
  cornice: Riquadro; // il fondo della cartina: tutto si ritaglia qui dentro
  forme: Forma[];
  testi: Testo[];
}

// --- Colori -----------------------------------------------------------------------------------------

// Simboli: forme riempite piccole (pallini delle città, triangoli delle vette, punte di freccia). Non
// sono aree: servono ad agganciare gli spilli, a mettere le città al loro posto e a trovare le frecce.
export const eSimbolo = (f: Forma) => f.riempimento !== null && f.box[2] - f.box[0] < 6 && f.box[3] - f.box[1] < 6;

// Una forma può avere riempimento e linea: ognuno ha la sua chiave di classificazione.
export const chiaveArea = (f: Forma) => `area|${f.riempimento}|${Math.round(f.opacita * 100) / 100}`;
export const chiaveLinea = (f: Forma) => `linea|${f.tratto}|${Math.round(f.spessore * 10) / 10}${f.tratteggiato ? '|tratteggiata' : ''}`;

export interface GruppoDiColore {
  chiave: string;
  tipo: 'area' | 'linea';
  colore: string;
  opacita: number;
  spessore: number;
  tratteggiato: boolean;
  forme: number; // quante forme
  estensione: number; // area del riquadro complessivo, per ordinare dal più grande
}

export function gruppiDiColore(d: Disegno): GruppoDiColore[] {
  const gruppi = new Map<string, GruppoDiColore>();
  const aggiungi = (chiave: string, tipo: 'area' | 'linea', f: Forma, colore: string) => {
    const g = gruppi.get(chiave) ?? { chiave, tipo, colore, opacita: f.opacita, spessore: f.spessore, tratteggiato: f.tratteggiato, forme: 0, estensione: 0 };
    g.forme++;
    g.estensione += (f.box[2] - f.box[0]) * (f.box[3] - f.box[1]);
    gruppi.set(chiave, g);
  };
  for (const f of d.forme) {
    if (f.riempimento && !eSimbolo(f)) aggiungi(chiaveArea(f), 'area', f, f.riempimento);
    if (f.tratto) aggiungi(chiaveLinea(f), 'linea', f, f.tratto);
  }
  return [...gruppi.values()].sort((a, b) => b.estensione - a.estensione);
}

// --- Testi --------------------------------------------------------------------------------------------

// Nelle cartine i nomi arrivano spezzati: lettere singole lungo una curva (C·A·N·A·A·N), pezzi di parola
// separati dalla crenatura. Si ricompongono i pezzi consecutivi dello stesso stile in cui uno comincia
// dove finisce il precedente. Le righe diverse dello stesso nome (REGNO / D'EGITTO) restano gruppi
// distinti: le unisce il redattore («riga successiva»).
export interface GruppoDiTesto {
  chiave: string; // testo e posizione: lega la classificazione al gruppo
  testo: string;
  pezzi: number[]; // indici in Disegno.testi
  box: Riquadro;
  colore: string;
  dimensione: number;
}

const distanza = (a: Punto, b: Punto) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const differenzaAngoli = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
export const normale = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’‘]/g, "'").replace(/\s+/g, '').toUpperCase();

export function gruppiDiTesto(d: Disegno): GruppoDiTesto[] {
  const gruppi: GruppoDiTesto[] = [];
  let ultimo: Testo | null = null;
  d.testi.forEach((t, i) => {
    const g = gruppi.at(-1);
    const seguito = ultimo && g && t.colore === ultimo.colore && Math.abs(t.dimensione - ultimo.dimensione) < .6
      && differenzaAngoli(t.angolo, ultimo.angolo) <= 20 && distanza(ultimo.fine, t.inizio) < t.dimensione * .9;
    if (seguito && g && ultimo) {
      // uno spazio se tra i due pezzi c'è il posto per uno spazio (tra lettere singole serve di più:
      // le lettere lungo le curve sono spaziate)
      const lettere = ultimo.testo.length === 1 && t.testo.length === 1;
      const spazio = distanza(ultimo.fine, t.inizio) > t.dimensione * (lettere ? .6 : .15) && !g.testo.endsWith(' ') && !t.testo.startsWith(' ');
      g.testo += (spazio ? ' ' : '') + t.testo;
      g.pezzi.push(i);
      g.box = [Math.min(g.box[0], t.box[0]), Math.min(g.box[1], t.box[1]), Math.max(g.box[2], t.box[2]), Math.max(g.box[3], t.box[3])];
    } else {
      gruppi.push({ chiave: '', testo: t.testo, pezzi: [i], box: [...t.box], colore: t.colore, dimensione: t.dimensione });
    }
    ultimo = t;
  });
  for (const g of gruppi) {
    g.testo = g.testo.replace(/\s+/g, ' ').trim();
    g.chiave = `${normale(g.testo)}@${Math.round((g.box[0] + g.box[2]) / 2)},${Math.round((g.box[1] + g.box[3]) / 2)}`;
  }
  return gruppi;
}

// --- Classificazione ------------------------------------------------------------------------------------

export type UsoColore = { uso: 'ignora' } | { uso: 'stile'; stile: string } | { uso: 'percorso' };

export const CATEGORIE_NOMI = ['regno', 'regione-antica', 'capitale-antica', 'citta-antica', 'regione', 'mare', 'fiume', 'isola', 'vetta'] as const;
export type CategoriaNome = (typeof CATEGORIE_NOMI)[number];
// Città e vette si scrivono dove sta il luogo (dall'anagrafe), non dove sta il testo sulla cartina
export const NOMI_DI_LUOGHI: readonly CategoriaNome[] = ['capitale-antica', 'citta-antica', 'vetta'];

export type UsoTesto =
  | { uso: 'ignora' }
  | { uso: 'nome'; categoria: CategoriaNome; testo: string } // testo: come si scrive nel portale
  | { uso: 'riga'; testo: string; di: string } // riga successiva del nome `di` (la chiave del suo gruppo)
  | { uso: 'sotto'; testo: string; di: string }; // sottotitolo (o sua riga successiva) del nome `di`

export interface Classificazione {
  colori: Record<string, UsoColore>;
  testi: Record<string, UsoTesto>;
}

// Zoom da cui compaiono i nomi, per categoria (come per i nomi di oggi)
export const ZOOM_NOMI: Record<CategoriaNome, number> = {
  regno: 2.5, 'regione-antica': 3.4, 'capitale-antica': 3.2, 'citta-antica': 3.8, regione: 3.8, mare: 4.4, fiume: 3.4, isola: 3.2, vetta: 3.8,
};
