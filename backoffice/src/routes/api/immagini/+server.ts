import { db } from '#lib/server/db.ts';
import { comeScelta, elencaImmagini } from '#lib/server/immagini.ts';
import type { ImmagineScelta } from '#lib/immagini.ts';
import type { RequestHandler } from './$types';

// Elenco per il selettore di immagini delle tappe.
export const GET: RequestHandler = ({ url }) => {
  const immagini: ImmagineScelta[] = elencaImmagini(db, { testo: url.searchParams.get('q')?.trim() || undefined }).map(comeScelta);
  return Response.json(immagini);
};
