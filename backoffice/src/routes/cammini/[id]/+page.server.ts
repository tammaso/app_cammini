import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import {
  aggiornaCammino, creaCammino, elencaTappe, eliminaCammino, etichetteInTesto, impostaRitorno, leggiCammino, spostaTappa, validaCammino,
} from '#lib/server/cammini.ts';
import { elencaCartine } from '#lib/server/cartine.ts';
import { componiCammino } from '#lib/server/pubblicazione.ts';
import type { Actions, PageServerLoad } from './$types';

// '/cammini/nuovo' crea, '/cammini/3' modifica.
function idDaParametro(parametro: string): number | null {
  if (parametro === 'nuovo') return null;
  const id = Number(parametro);
  if (!Number.isInteger(id) || id <= 0 || !leggiCammino(db, id)) error(404, 'Cammino non trovato');
  return id;
}

export const load: PageServerLoad = ({ params }) => {
  const id = idDaParametro(params.id);
  if (id === null) return { cammino: null, etichette: '', tappe: [], cartine: [], avvisi: [] };
  const cammino = leggiCammino(db, id)!;
  return {
    cammino,
    etichette: etichetteInTesto(cammino.etichette),
    tappe: elencaTappe(db, id),
    cartine: elencaCartine(db, id),
    // ciò che la pubblicazione segnalerebbe: tracciati che non partono dalla tappa precedente, testi mancanti
    avvisi: componiCammino(db, id).avvisi,
  };
};

export const actions = {
  salva: async ({ request, params }) => {
    const id = idDaParametro(params.id);
    const modulo = await request.formData();
    const esito = validaCammino(modulo, id === null);
    if (!esito.ok) return fail(400, { errori: esito.errori, valori: esito.valori });
    if (id === null) {
      const creato = creaCammino(db, esito.dati);
      const valori = Object.fromEntries([...modulo.entries()].map(([k, v]) => [k, String(v)]));
      if (!creato.ok) return fail(400, { errori: creato.errori, valori });
      redirect(303, `/cammini/${creato.id}`);
    }
    aggiornaCammino(db, id, esito.dati);
    return { salvato: true };
  },

  ritorno: async ({ request, params }) => {
    const id = idDaParametro(params.id);
    if (id === null) error(404, 'Cammino non trovato');
    const scelta = Number((await request.formData()).get('ritorno'));
    impostaRitorno(db, id, Number.isInteger(scelta) && scelta > 0 ? scelta : null);
    return { ritornoSalvato: true };
  },

  sposta: async ({ request, params }) => {
    idDaParametro(params.id);
    const modulo = await request.formData();
    spostaTappa(db, Number(modulo.get('tappa')), modulo.get('verso') === 'su' ? -1 : 1);
    return { spostata: true };
  },

  elimina: async ({ params }) => {
    const id = idDaParametro(params.id);
    if (id === null) error(404, 'Cammino non trovato');
    eliminaCammino(db, id);
    redirect(303, '/cammini');
  },
} satisfies Actions;
