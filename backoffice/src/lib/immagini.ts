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

export const urlAnteprima = (id: number, larghezza: LarghezzaAnteprima) => `/api/immagini/${id}/${larghezza}`;

export const pesoLeggibile = (byte: number | null) =>
  byte === null ? '—'
    : byte < 1024 * 1024 ? `${Math.round(byte / 1024)} KB`
      : `${(byte / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;
