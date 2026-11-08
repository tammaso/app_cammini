import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { CARTELLA_DEMO, apriCartella, preparaDemo, pubblicaPortale, statoPubblicazione } from '#lib/server/pubblicazione.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ stato: await statoPubblicazione(db), cartellaDemo: CARTELLA_DEMO });

const messaggio = (errore: unknown) => (errore instanceof Error ? errore.message : String(errore));

export const actions = {
  pubblica: async () => {
    try {
      return { esito: await pubblicaPortale(db) };
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
