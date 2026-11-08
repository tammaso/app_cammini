import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { CARTELLA_IMMAGINI, leggiImmagine, percorsoAnteprima } from '#lib/server/immagini.ts';
import { LARGHEZZE_ANTEPRIMA, type LarghezzaAnteprima } from '#lib/immagini.ts';
import type { RequestHandler } from './$types';

// Gli originali non vengono mai sostituiti: un'anteprima per id e larghezza non cambia più.
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
