import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import {
  CARTELLA_IMMAGINI, aggiornaMetadati, eliminaImmagine, leggiImmagine, usataInCamminiPubblicati, validaMetadati,
} from '#lib/server/immagini.ts';
import type { MetadatiImmagine } from '#lib/immagini.ts';
import type { Actions, PageServerLoad } from './$types';

function idValido(parametro: string): number {
  const id = Number(parametro);
  if (!Number.isInteger(id) || id <= 0 || !leggiImmagine(db, id)) error(404, 'Immagine non trovata');
  return id;
}

export const load: PageServerLoad = ({ params }) => ({ immagine: leggiImmagine(db, idValido(params.id))! });

export const actions = {
  salva: async ({ request, params }) => {
    const id = idValido(params.id);
    const esito = validaMetadati(await request.formData());
    if (!esito.ok) return fail(400, { errori: esito.errori, valori: esito.valori });
    if (!esito.dati.crediti && usataInCamminiPubblicati(db, id)) {
      const errori: Partial<Record<keyof MetadatiImmagine, string>> = {
        crediti: "L'immagine è in un cammino pubblicato: i crediti sono obbligatori.",
      };
      return fail(400, {
        errori,
        valori: { ...esito.dati, didascalia: esito.dati.didascalia ?? '', crediti: '', licenza: esito.dati.licenza ?? '' },
      });
    }
    aggiornaMetadati(db, id, esito.dati);
    return { salvata: true };
  },

  elimina: async ({ params }) => {
    const esito = await eliminaImmagine(db, CARTELLA_IMMAGINI, idValido(params.id));
    if (!esito.ok) return fail(409, { messaggio: esito.messaggio });
    redirect(303, '/immagini');
  },
} satisfies Actions;
