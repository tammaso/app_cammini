import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import {
  aggiornaCartina, aggiornaStile, eliminaCartina, leggiCartina, validaCartina, validaStile, valoreInTesto,
} from '#lib/server/cartine.ts';
import type { Actions, PageServerLoad } from './$types';

function idValido(parametro: string): number {
  const id = Number(parametro);
  if (!Number.isInteger(id) || id <= 0 || !leggiCartina(db, id)) error(404, 'Cartina non trovata');
  return id;
}

export const load: PageServerLoad = ({ params }) => {
  const cartina = leggiCartina(db, idValido(params.id))!;
  return {
    cartina,
    // i valori degli stili come si scrivono nel modulo: «0,82 / 0,66»
    stili: cartina.stili.map((s) => ({
      ...s, testoOpacita: valoreInTesto(s.opacita), testoSpessore: valoreInTesto(s.spessore), testoTratteggio: valoreInTesto(s.tratteggio),
    })),
  };
};

export const actions = {
  salva: async ({ request, params }) => {
    const id = idValido(params.id);
    const esito = validaCartina(await request.formData());
    if (!esito.ok) return fail(400, { errori: esito.errori, valori: esito.valori });
    aggiornaCartina(db, id, esito.dati);
    return { salvata: true };
  },

  stile: async ({ request, params }) => {
    const id = idValido(params.id);
    const modulo = await request.formData();
    const stileId = Number(modulo.get('stile'));
    if (!leggiCartina(db, id)!.stili.some((s) => s.id === stileId)) error(404, 'Stile non trovato');
    const esito = validaStile(modulo);
    if (!esito.ok) return fail(400, { stile: stileId, erroriStile: esito.errori });
    aggiornaStile(db, stileId, esito.dati);
    return { stileSalvato: stileId };
  },

  elimina: async ({ params }) => {
    const id = idValido(params.id);
    const camminoId = leggiCartina(db, id)!.camminoId;
    eliminaCartina(db, id);
    redirect(303, `/cammini/${camminoId}`);
  },
} satisfies Actions;
