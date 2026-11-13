// Tipi di cammini, tappe, luoghi e cartine, usati sia dal server sia dalle pagine.
import type { Coordinate, Etichetta, Freccia } from '../../../condiviso/cammino.ts';

export type Stato = 'bozza' | 'pubblicato';
export type Certezza = 'certa' | 'probabile' | 'ipotetica';
export const CERTEZZE: Certezza[] = ['certa', 'probabile', 'ipotetica'];
export const TIPI_LUOGO = { citta: 'Città', vetta: 'Vetta', regione: 'Regione', acque: 'Mare, lago o fiume', altro: 'Altro' } as const;
export type TipoLuogo = keyof typeof TIPI_LUOGO;

export interface CamminoInElenco {
  id: number;
  slug: string;
  titolo: string;
  stato: Stato;
  ordine: number;
  tappe: number;
  cartine: number;
  modificatoIl: string;
}

export interface Cammino {
  id: number;
  slug: string;
  titolo: string;
  nome: string;
  sottotitolo: string | null;
  globoLuogo: string | null;
  globoTesto: string;
  panoramicaTesto: string;
  etichette: Etichetta[];
  frecce: Freccia[];
  ritornoTappaId: number | null; // dopo l'ultima tappa si torna a questa (Abramo: a Bersabea)
  ordine: number;
  stato: Stato;
  modificatoIl: string;
}

export interface TappaInElenco {
  id: number;
  posizione: number;
  nome: string;
  breve: string;
  luogo: string;
  riferimento: string | null;
  puntiTracciato: number; // 0: linea dritta dalla tappa precedente
  immagini: number; // quante immagini ha la galleria della scheda
}

// Immagini nella galleria della scheda di una tappa, al massimo.
export const MAX_IMMAGINI_TAPPA = 12;

export interface Tappa {
  id: number;
  camminoId: number;
  posizione: number;
  nome: string;
  breve: string;
  breveOggi: string | null; // accanto al pin in «Oggi»: il nome moderno del luogo (vuoto: il nome breve)
  luogoId: number;
  luogoAttuale: string | null;
  riferimento: string | null;
  testo: string;
  approfondimento: string | null;
  immagini: number[]; // galleria della scheda: immagini dell'archivio, nell'ordine (la prima compare all'apertura)
  tracciato: Coordinate[] | null;
  secondaria: boolean;
}

export interface Luogo {
  id: number;
  nome: string;
  nomeAntico: string | null;
  nomeAttuale: string | null;
  altriNomi: string[];
  lat: number;
  lng: number;
  tipo: TipoLuogo;
  certezza: Certezza;
  nota: string | null;
}

export interface LuogoInElenco extends Luogo {
  usi: number; // tappe, nomi delle cartine e punti di controllo che lo usano
}

export interface UsoLuogo {
  dove: string; // «Tappa 2 del Cammino di Abramo», «Nome sulla cartina 1700 a.C.»…
  href: string;
}

export interface CartinaInElenco {
  id: number;
  epoca: string;
  pulsante: string;
  anno: number;
  elementi: number;
  nomi: number;
  punti: number;
}

export interface Stile {
  id: number;
  chiave: string;
  posizione: number;
  tipo: 'area' | 'linea' | 'punto';
  nome: string;
  legenda: string | null;
  colore: string;
  opacita: number | [number, number] | null;
  contorno: string | null;
  spessore: number | [number, number] | null;
  tratteggio: [number, number] | null;
  ritaglio: boolean; // aree: ritagliate sulle terre emerse
  elementi: number;
}

export interface PuntoControllo {
  id: number;
  nome: string;
  luogo: string | null;
  sx: number;
  sy: number;
  lng: number;
  lat: number;
  certezza: Certezza;
  stato: 'proposto' | 'confermato' | 'manuale';
}

export interface Cartina {
  id: number;
  camminoId: number;
  cammino: string;
  epoca: string;
  pulsante: string;
  anno: number;
  fonte: string | null;
  metodo: string;
  importataIl: string | null;
  stili: Stile[];
  elementi: { origine: string; n: number }[];
  nomi: { categoria: string; n: number }[];
  punti: PuntoControllo[];
}

export const NOMI_CATEGORIE: Record<string, string> = {
  regno: 'Regni e popoli', 'regione-antica': 'Regioni antiche', 'capitale-antica': 'Capitali', 'citta-antica': 'Città',
  regione: 'Regioni (geografia fisica)', mare: 'Mari e laghi', fiume: 'Fiumi', isola: 'Isole', vetta: 'Vette',
};

// Errori di un modulo, campo per campo, e valori da riproporre dopo un errore.
export type Errori<K extends string> = Partial<Record<K, string>>;
