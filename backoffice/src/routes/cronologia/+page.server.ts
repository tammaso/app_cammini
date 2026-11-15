// Cronologia: le modifiche del backoffice e le copie di sicurezza per tornare indietro (prima erano due pagine,
// «Registro» e «Backup»). Errori e impostazioni del backup stanno in fondo, piegati.
import { fail } from '@sveltejs/kit';
import {
  backupRegistrato, controllaCartella, elencaCopie, impostaBackupAutomatico, leggiImpostazioniBackup, ripristinoRegistrato,
  salvaCartellaBackup, scegliCartella,
} from '#lib/server/backup.ts';
import { db } from '#lib/server/db.ts';
import { GIORNI_REGISTRO_ERRORI, GIORNI_REGISTRO_MODIFICHE, elencaErrori, elencaModifiche } from '#lib/server/registro.ts';
import { existsSync } from 'node:fs';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const impostazioni = leggiImpostazioniBackup(db);
  // la cartella di serie si crea al primo backup: finché non c'è non è un problema
  const daCreare = impostazioni.predefinita && !existsSync(impostazioni.cartella);
  const problemaCartella = daCreare ? null : await controllaCartella(impostazioni.cartella);
  // i cammini che esistono ancora: le loro righe del registro portano al cammino
  const esistenti = new Set(db.prepare('SELECT id FROM cammini').all().map((r) => Number(r.id)));
  return {
    impostazioni,
    problemaCartella,
    copie: problemaCartella || daCreare ? [] : await elencaCopie(impostazioni.cartella),
    modifiche: elencaModifiche(db).map((m) => ({ ...m, camminoEsiste: m.camminoId != null && esistenti.has(m.camminoId) })),
    errori: elencaErrori(db),
    giorni: { modifiche: GIORNI_REGISTRO_MODIFICHE, errori: GIORNI_REGISTRO_ERRORI },
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
    impostaBackupAutomatico(db, (await request.formData()).get('attivo') === '1');
    return { automaticoCambiato: true };
  },

  adesso: async () => {
    try {
      const { immaginiCopiate, copieEliminate } = await backupRegistrato(db);
      return { backupFatto: { immaginiCopiate, copieEliminate } };
    } catch (errore) {
      return fail(500, { erroreBackup: messaggioDi(errore) });
    }
  },

  // Il database torna com'era nella copia scelta; prima si salva lo stato di adesso tra le copie (vedi backup.ts).
  ripristina: async ({ request }) => {
    const nome = String((await request.formData()).get('nome') ?? '');
    try {
      return { ripristinoFatto: { nome, ...(await ripristinoRegistrato(db, nome)) } };
    } catch (errore) {
      return fail(500, { erroreRipristino: messaggioDi(errore) });
    }
  },
} satisfies Actions;
