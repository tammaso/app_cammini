// Tipi dell'archivio immagini, usati sia dal server sia dalle pagine.

export interface Immagine {
  id: number;
  file: string;
  sha256: string;
  larghezza: number;
  altezza: number;
  alt: string;
  didascalia: string | null;
  crediti: string | null;
  licenza: string | null;
  nomeOriginale: string | null;
  dimensione: number | null;
  caricataIl: string | null;
  usi: number;
}

// Esito del caricamento di un singolo file.
export interface RisultatoCaricamento {
  nome: string;
  id?: number;
  giaPresente?: boolean;
  messaggio?: string;
}

export interface UsoImmagine {
  camminoId: number;
  tappaId: number;
  titolo: string; // del cammino
  tappa: string;
}

// Un'immagine come la mostra il selettore dell'archivio.
export interface ImmagineScelta {
  id: number;
  sha256: string; // per l'indirizzo dell'anteprima
  alt: string;
  nomeOriginale: string | null;
  didascalia: string | null;
  crediti: string | null;
  larghezza: number;
  altezza: number;
  completa: boolean;
}

export interface MetadatiImmagine {
  alt: string;
  didascalia: string | null;
  crediti: string | null;
  licenza: string | null;
}

export type CampoMetadati = keyof MetadatiImmagine;

// Un'immagine si può usare nei cammini pubblicati solo con questi campi compilati.
// La licenza è facoltativa: per le banche immagini autore e servizio stanno nei crediti.
export const CAMPI_OBBLIGATORI = ['alt', 'crediti'] as const satisfies readonly CampoMetadati[];

export function campiMancanti(immagine: Pick<MetadatiImmagine, 'alt' | 'crediti'>): CampoMetadati[] {
  return CAMPI_OBBLIGATORI.filter((campo) => !immagine[campo]?.trim());
}

export const NOMI_CAMPI: Record<CampoMetadati, string> = {
  alt: 'testo alternativo',
  didascalia: 'didascalia',
  crediti: 'crediti',
  licenza: 'licenza',
};

export const LICENZE_SUGGERITE = [
  'Licenza standard Shutterstock',
  'Licenza estesa Shutterstock',
  'Tutti i diritti riservati',
  'Su concessione del Ministero della Cultura',
  "Su concessione dell'ente proprietario",
  'CC BY 4.0',
  'CC BY-SA 4.0',
  'CC BY-NC 4.0',
  'CC0 1.0',
  'Pubblico dominio',
];

// Larghezze delle anteprime nel backoffice (il sito pubblico avrà le sue).
export const LARGHEZZE_ANTEPRIMA = [320, 800, 1600] as const;
export type LarghezzaAnteprima = (typeof LARGHEZZE_ANTEPRIMA)[number];

// L'indirizzo porta l'impronta del file (sha256): il browser tiene le anteprime per un anno senza
// richiederle, quindi un indirizzo deve indicare sempre la stessa immagine. Con il solo id non era così:
// il backoffice dell'Atlante, sulla stessa porta 5173, usa gli stessi indirizzi (al posto delle nostre
// immagini 1 e 2 comparivano le sue), e un id liberato da un'eliminazione può tornare a una foto nuova.
export const urlAnteprima = (immagine: { id: number; sha256: string }, larghezza: LarghezzaAnteprima) =>
  `/api/immagini/${immagine.id}/${larghezza}?v=${immagine.sha256.slice(0, 16)}`;

export const pesoLeggibile = (byte: number | null) =>
  byte === null ? '—'
    : byte < 1024 * 1024 ? `${Math.round(byte / 1024)} KB`
      : `${(byte / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
