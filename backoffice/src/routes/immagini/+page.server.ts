import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { CARTELLA_IMMAGINI, caricaImmagine, elencaImmagini } from '#lib/server/immagini.ts';
import type { RisultatoCaricamento } from '#lib/immagini.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const testo = url.searchParams.get('testo')?.trim() || undefined;
  const daCompletare = url.searchParams.get('stato') === 'da-completare';
  return {
    immagini: elencaImmagini(db, { testo, daCompletare }),
    filtri: { testo, daCompletare },
    totale: elencaImmagini(db).length,
  };
};

export const actions = {
  carica: async ({ request }) => {
    const file = (await request.formData()).getAll('file').filter((voce): voce is File => voce instanceof File && voce.size > 0);
    if (!file.length) return fail(400, { risultati: [] as RisultatoCaricamento[], erroreCaricamento: 'Scegli almeno un file.' });
    const risultati: RisultatoCaricamento[] = [];
    for (const singolo of file) {
      const esito = await caricaImmagine(db, CARTELLA_IMMAGINI, new Uint8Array(await singolo.arrayBuffer()), singolo.name);
      risultati.push(esito.ok
        ? { nome: singolo.name, id: esito.id, giaPresente: esito.giaPresente }
        : { nome: singolo.name, messaggio: esito.messaggio });
    }
    return { risultati };
  },
} satisfies Actions;
