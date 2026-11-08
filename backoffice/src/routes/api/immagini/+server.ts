import { db } from '#lib/server/db.ts';
import { elencaImmagini } from '#lib/server/immagini.ts';
import { campiMancanti, type ImmagineScelta } from '#lib/immagini.ts';
import type { RequestHandler } from './$types';

// Elenco per il selettore di immagini delle tappe.
export const GET: RequestHandler = ({ url }) => {
  const immagini: ImmagineScelta[] = elencaImmagini(db, { testo: url.searchParams.get('q')?.trim() || undefined })
    .map((i) => ({
      id: i.id,
      alt: i.alt,
      nomeOriginale: i.nomeOriginale,
      didascalia: i.didascalia,
      crediti: i.crediti,
      larghezza: i.larghezza,
      altezza: i.altezza,
      completa: campiMancanti(i).length === 0,
    }));
  return Response.json(immagini);
};
