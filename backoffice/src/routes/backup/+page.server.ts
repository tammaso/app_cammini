import { fail } from '@sveltejs/kit';
import {
  backupRegistrato, controllaCartella, elencaCopie, impostaBackupAutomatico, leggiImpostazioniBackup, salvaCartellaBackup,
  scegliCartella,
} from '#lib/server/backup.ts';
import { db } from '#lib/server/db.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const impostazioni = leggiImpostazioniBackup(db);
  const problemaCartella = impostazioni.cartella ? await controllaCartella(impostazioni.cartella) : null;
  return {
    impostazioni,
    problemaCartella,
    copie: impostazioni.cartella && !problemaCartella ? await elencaCopie(impostazioni.cartella) : [],
  };
};

const messaggioDi = (errore: unknown) => (errore instanceof Error ? errore.message : String(errore));

async function usaCartella(cartella: string) {
  const problema = await controllaCartella(cartella);
  if (problema) return fail(400, { erroreCartella: problema, cartella });
  salvaCartellaBackup(db, cartella);
  return { cartellaSalvata: true };
}

export const actions = {
  // Finestra «Sfoglia per cartelle» di Windows, aperta sul PC dove gira il backoffice.
  scegli: async () => {
    try {
      const cartella = await scegliCartella();
      return cartella ? usaCartella(cartella) : { sceltaAnnullata: true };
    } catch (errore) {
      return fail(500, { erroreCartella: messaggioDi(errore) });
    }
  },

  cartella: async ({ request }) => usaCartella(String((await request.formData()).get('cartella') ?? '').trim()),

  automatico: async ({ request }) => {
    const attivo = (await request.formData()).get('attivo') === '1';
    if (attivo && !leggiImpostazioniBackup(db).cartella) return fail(400, { erroreAutomatico: 'Scegli prima la cartella.' });
    impostaBackupAutomatico(db, attivo);
    return { automaticoCambiato: attivo };
  },

  adesso: async () => {
    try {
      const { immaginiCopiate, copieEliminate } = await backupRegistrato(db);
      return { backupFatto: { immaginiCopiate, copieEliminate } };
    } catch (errore) {
      return fail(500, { erroreBackup: messaggioDi(errore) });
    }
  },
} satisfies Actions;
