import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import {
  CARTELLA_DEMO, INDIRIZZO_ANTEPRIMA, apriCartella, preparaAnteprima, preparaDemo, pubblicaAnteprima, statoAnteprima, statoPubblicazione,
} from '#lib/server/pubblicazione.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
  stato: await statoPubblicazione(db),
  anteprima: await statoAnteprima(db),
  indirizzoAnteprima: INDIRIZZO_ANTEPRIMA,
  cartellaDemo: CARTELLA_DEMO,
});

const messaggio = (errore: unknown) => (errore instanceof Error ? errore.message : String(errore));

export const actions = {
  anteprima: async () => {
    try {
      const esito = await preparaAnteprima(db);
      return { anteprimaPronta: true, avvisi: esito.cammini.filter((c) => c.avvisi.length) };
    } catch (errore) {
      return fail(500, { errore: messaggio(errore) });
    }
  },

  pubblica: async () => {
    try {
      return { pubblicato: await pubblicaAnteprima(db) };
    } catch (errore) {
      return fail(500, { errore: messaggio(errore) });
    }
  },

  demo: async () => {
    try {
      return { demo: await preparaDemo(db) };
    } catch (errore) {
      return fail(500, { errore: messaggio(errore) });
    }
  },

  apri: async () => {
    apriCartella(CARTELLA_DEMO);
    return { aperta: true };
  },
} satisfies Actions;
