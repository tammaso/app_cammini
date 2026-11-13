import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { CARTELLA_IMMAGINI, leggiImmagine, percorsoAnteprima } from '#lib/server/immagini.ts';
import { LARGHEZZE_ANTEPRIMA, type LarghezzaAnteprima } from '#lib/immagini.ts';
import type { RequestHandler } from './$types';

// Il browser tiene l'anteprima per un anno: l'indirizzo che si usa (urlAnteprima) porta l'impronta del file
// (?v=…), così non può mai indicare un'altra immagine, anche se l'id torna libero o un altro programma
// sulla stessa porta (il backoffice dell'Atlante) usa gli stessi indirizzi.
export const GET: RequestHandler = async ({ params }) => {
  const larghezza = Number(params.larghezza) as LarghezzaAnteprima;
  if (!LARGHEZZE_ANTEPRIMA.includes(larghezza)) error(404, 'Larghezza non disponibile');
  const immagine = leggiImmagine(db, Number(params.id));
  if (!immagine) error(404, 'Immagine non trovata');
  const contenuto = await readFile(await percorsoAnteprima(CARTELLA_IMMAGINI, immagine, larghezza));
  return new Response(contenuto, {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });
};
