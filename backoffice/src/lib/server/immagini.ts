// Archivio immagini: gli originali restano intatti in <cartella>/originali/<sha256>.<estensione>,
// le anteprime per il backoffice si generano al primo uso in <cartella>/anteprime/.
import { createHash } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import sharp, { type Metadata } from 'sharp';
import {
  campiMancanti, LARGHEZZE_ANTEPRIMA, type Immagine, type ImmagineScelta, type LarghezzaAnteprima, type MetadatiImmagine, type UsoImmagine,
} from '../immagini.ts';
import { registraModifica } from './registro.ts';

// Nel registro l'immagine si riconosce dal testo alternativo o, finché manca, dal nome del file.
const nomeImmagine = (i: { alt: string; nomeOriginale: string | null; id: number }) => i.alt || i.nomeOriginale || `Immagine ${i.id}`;

// Su Windows i file tenuti aperti dalla cache di sharp non si possono cancellare:
// senza cache, eliminare un'immagine dall'archivio rimuove davvero i suoi file.
sharp.cache({ files: 0 });

export const CARTELLA_IMMAGINI = process.env.CAMMINI_IMMAGINI
  ?? fileURLToPath(new URL('../../../dati/immagini/', import.meta.url));

const PESO_MASSIMO = 40 * 1024 * 1024;

// Formati accettati e relativa estensione dell'originale salvato.
function estensione(metadati: Metadata): string | null {
  switch (metadati.format) {
    case 'jpeg': return 'jpg';
    case 'png': return 'png';
    case 'webp': return 'webp';
    case 'tiff': return 'tif';
    case 'heif': return metadati.compression === 'av1' ? 'avif' : 'heic';
    default: return null;
  }
}

export type EsitoCaricamento =
  | { ok: true; id: number; giaPresente: boolean }
  | { ok: false; messaggio: string };

export async function caricaImmagine(
  db: DatabaseSync,
  cartella: string,
  contenuto: Uint8Array,
  nomeOriginale: string,
): Promise<EsitoCaricamento> {
  if (contenuto.byteLength === 0) return { ok: false, messaggio: 'Il file è vuoto.' };
  if (contenuto.byteLength > PESO_MASSIMO) return { ok: false, messaggio: 'Il file supera i 40 MB.' };

  const sha256 = createHash('sha256').update(contenuto).digest('hex');
  const esistente = db.prepare('SELECT id FROM immagini WHERE sha256 = ?').get(sha256);
  if (esistente) return { ok: true, id: Number(esistente.id), giaPresente: true };

  let metadati: Metadata;
  try {
    metadati = await sharp(contenuto).metadata();
  } catch {
    return { ok: false, messaggio: 'Non è un file immagine leggibile.' };
  }
  const est = estensione(metadati);
  if (!est || !metadati.width || !metadati.height) {
    return { ok: false, messaggio: `Formato non accettato (${metadati.format ?? 'sconosciuto'}): usa JPEG, PNG, WebP, TIFF o AVIF.` };
  }
  // Le foto da telefono sono spesso salvate ruotate, con l'orientamento nei dati EXIF.
  const ruotata = (metadati.orientation ?? 1) >= 5;
  const larghezza = ruotata ? metadati.height : metadati.width;
  const altezza = ruotata ? metadati.width : metadati.height;

  const file = `originali/${sha256}.${est}`;
  await mkdir(join(cartella, 'originali'), { recursive: true });
  await writeFile(join(cartella, file), contenuto);
  try {
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO immagini (file, sha256, larghezza, altezza, alt, nome_originale, dimensione, caricata_il)
        VALUES (?, ?, ?, ?, '', ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`)
      .run(file, sha256, larghezza, altezza, nomeOriginale || null, contenuto.byteLength);
    const id = Number(lastInsertRowid);
    registraModifica(db, {
      azione: 'creazione', oggetto: 'immagine', oggettoId: id, titolo: nomeImmagine({ alt: '', nomeOriginale, id }),
      descrizione: "Immagine caricata nell'archivio",
    });
    return { ok: true, id, giaPresente: false };
  } catch (errore) {
    await rm(join(cartella, file), { force: true });
    throw errore;
  }
}

const CONTEGGIO_USI = `(SELECT count(*) FROM tappe_immagini u WHERE u.immagine_id = i.id)`;

function comeImmagine(riga: Record<string, unknown>): Immagine {
  const testo = (valore: unknown) => (valore == null ? null : String(valore));
  return {
    id: Number(riga.id),
    file: String(riga.file),
    sha256: String(riga.sha256),
    larghezza: Number(riga.larghezza),
    altezza: Number(riga.altezza),
    alt: String(riga.alt),
    didascalia: testo(riga.didascalia),
    crediti: testo(riga.crediti),
    licenza: testo(riga.licenza),
    nomeOriginale: testo(riga.nome_originale),
    dimensione: riga.dimensione == null ? null : Number(riga.dimensione),
    caricataIl: testo(riga.caricata_il),
    usi: Number(riga.usi ?? 0),
  };
}

// Stessa regola di campiMancanti(), in SQL: mancano testo alternativo o crediti.
export const IMMAGINE_INCOMPLETA = `trim(i.alt) = '' OR trim(coalesce(i.crediti, '')) = ''`;

// Immagini senza testo alternativo o crediti tra quelle indicate.
// Servono per impedire che finiscano in un cammino pubblicato.
export function immaginiIncomplete(db: DatabaseSync, ids: number[]): string[] {
  if (!ids.length) return [];
  return db
    .prepare(`SELECT coalesce(nullif(trim(i.alt), ''), i.nome_originale, 'immagine ' || i.id) AS nome FROM immagini i
      WHERE i.id IN (${ids.map(() => '?').join(', ')}) AND (${IMMAGINE_INCOMPLETA}) ORDER BY i.id`)
    .all(...ids)
    .map((riga) => String(riga.nome));
}

export function usataInCamminiPubblicati(db: DatabaseSync, immagineId: number): boolean {
  return Boolean(db.prepare(`SELECT 1 FROM tappe_immagini ti JOIN tappe t ON t.id = ti.tappa_id JOIN cammini c ON c.id = t.cammino_id
    WHERE c.stato = 'pubblicato' AND ti.immagine_id = ?`).get(immagineId));
}

export interface FiltriImmagini {
  testo?: string;
  daCompletare?: boolean;
}

export function elencaImmagini(db: DatabaseSync, filtri: FiltriImmagini = {}): Immagine[] {
  const condizioni: string[] = [];
  const parametri: string[] = [];
  if (filtri.testo) {
    const simile = `%${filtri.testo.replace(/[\\%_]/g, '\\$&')}%`;
    condizioni.push(`(${['alt', 'didascalia', 'crediti', 'nome_originale'].map((c) => `i.${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    parametri.push(simile, simile, simile, simile);
  }
  if (filtri.daCompletare) {
    condizioni.push(`(${IMMAGINE_INCOMPLETA})`);
  }
  return db
    .prepare(`SELECT i.*, ${CONTEGGIO_USI} AS usi FROM immagini i
      ${condizioni.length ? `WHERE ${condizioni.join(' AND ')}` : ''}
      ORDER BY i.caricata_il DESC, i.id DESC`)
    .all(...parametri)
    .map(comeImmagine);
}

export function leggiImmagine(db: DatabaseSync, id: number): (Immagine & { elencoUsi: UsoImmagine[] }) | undefined {
  const riga = db.prepare(`SELECT i.*, ${CONTEGGIO_USI} AS usi FROM immagini i WHERE i.id = ?`).get(id);
  if (!riga) return undefined;
  const elencoUsi = db
    .prepare(`SELECT c.id AS cammino_id, c.titolo, t.id AS tappa_id, t.nome AS tappa FROM tappe_immagini ti
      JOIN tappe t ON t.id = ti.tappa_id JOIN cammini c ON c.id = t.cammino_id WHERE ti.immagine_id = ? ORDER BY c.titolo, t.posizione`)
    .all(id)
    .map((u) => ({ camminoId: Number(u.cammino_id), tappaId: Number(u.tappa_id), titolo: String(u.titolo), tappa: String(u.tappa) }));
  return { ...comeImmagine(riga), elencoUsi };
}

// Un'immagine come la mostra il selettore (e la galleria della tappa).
export const comeScelta = (i: Immagine): ImmagineScelta => ({
  id: i.id, sha256: i.sha256, alt: i.alt, nomeOriginale: i.nomeOriginale, didascalia: i.didascalia, crediti: i.crediti,
  larghezza: i.larghezza, altezza: i.altezza, completa: campiMancanti(i).length === 0,
});

// Le immagini indicate, nello stesso ordine (quelle non più nell'archivio si saltano).
export function immaginiScelte(db: DatabaseSync, ids: number[]): ImmagineScelta[] {
  return ids.flatMap((id) => {
    const riga = db.prepare('SELECT i.*, 0 AS usi FROM immagini i WHERE i.id = ?').get(id);
    return riga ? [comeScelta(comeImmagine(riga))] : [];
  });
}

const LUNGHEZZE_MASSIME: Record<keyof MetadatiImmagine, number> = { alt: 300, didascalia: 1000, crediti: 300, licenza: 200 };

export type EsitoMetadati =
  | { ok: true; dati: MetadatiImmagine }
  | { ok: false; errori: Partial<Record<keyof MetadatiImmagine, string>>; valori: Record<keyof MetadatiImmagine, string> };

export function validaMetadati(modulo: FormData): EsitoMetadati {
  const valori = {
    alt: String(modulo.get('alt') ?? '').trim(),
    didascalia: String(modulo.get('didascalia') ?? '').trim(),
    crediti: String(modulo.get('crediti') ?? '').trim(),
    licenza: String(modulo.get('licenza') ?? '').trim(),
  };
  const errori: Partial<Record<keyof MetadatiImmagine, string>> = {};
  if (!valori.alt) errori.alt = "Il testo alternativo è obbligatorio: descrive l'immagine a chi non la vede.";
  for (const campo of Object.keys(LUNGHEZZE_MASSIME) as (keyof MetadatiImmagine)[]) {
    if (valori[campo].length > LUNGHEZZE_MASSIME[campo]) errori[campo] = `Al massimo ${LUNGHEZZE_MASSIME[campo]} caratteri.`;
  }
  if (Object.keys(errori).length) return { ok: false, errori, valori };
  return {
    ok: true,
    dati: { alt: valori.alt, didascalia: valori.didascalia || null, crediti: valori.crediti || null, licenza: valori.licenza || null },
  };
}

export function aggiornaMetadati(db: DatabaseSync, id: number, dati: MetadatiImmagine): void {
  const nomeOriginale = db.prepare('SELECT nome_originale FROM immagini WHERE id = ?').get(id)?.nome_originale;
  db.prepare('UPDATE immagini SET alt = ?, didascalia = ?, crediti = ?, licenza = ? WHERE id = ?')
    .run(dati.alt, dati.didascalia, dati.crediti, dati.licenza, id);
  registraModifica(db, {
    azione: 'modifica', oggetto: 'immagine', oggettoId: id,
    titolo: nomeImmagine({ alt: dati.alt, nomeOriginale: nomeOriginale == null ? null : String(nomeOriginale), id }),
    descrizione: 'Testo alternativo, didascalia, crediti o licenza modificati',
  });
}

export async function eliminaImmagine(
  db: DatabaseSync,
  cartella: string,
  id: number,
): Promise<{ ok: true } | { ok: false; messaggio: string }> {
  const immagine = leggiImmagine(db, id);
  if (!immagine) return { ok: true };
  if (immagine.usi > 0) {
    return { ok: false, messaggio: `L'immagine è usata in ${immagine.usi === 1 ? 'una tappa' : `${immagine.usi} tappe`}: toglila da lì prima di eliminarla.` };
  }
  db.prepare('DELETE FROM immagini WHERE id = ?').run(id);
  // Il file originale si cancella: nel registro restano solo i dati, per sapere che cosa c'era.
  registraModifica(db, {
    azione: 'eliminazione', oggetto: 'immagine', oggettoId: id, titolo: nomeImmagine(immagine),
    descrizione: "Immagine eliminata dall'archivio", datiPrecedenti: { ...immagine, elencoUsi: undefined },
  });
  await rm(join(cartella, immagine.file), { force: true });
  for (const larghezza of LARGHEZZE_ANTEPRIMA) {
    await rm(join(cartella, 'anteprime', `${immagine.sha256}-${larghezza}.webp`), { force: true });
  }
  return { ok: true };
}

// Anteprima WebP ruotata secondo l'EXIF e mai ingrandita; si genera una volta e poi si riusa.
export async function percorsoAnteprima(cartella: string, immagine: Pick<Immagine, 'file' | 'sha256'>, larghezza: LarghezzaAnteprima) {
  const percorso = join(cartella, 'anteprime', `${immagine.sha256}-${larghezza}.webp`);
  const esiste = await stat(percorso).then(() => true, () => false);
  if (!esiste) {
    await mkdir(join(cartella, 'anteprime'), { recursive: true });
    await sharp(join(cartella, immagine.file))
      .rotate()
      .resize({ width: larghezza, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(percorso);
  }
  return percorso;
}
