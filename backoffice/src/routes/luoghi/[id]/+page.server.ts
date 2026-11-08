import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { aggiornaLuogo, creaLuogo, eliminaLuogo, leggiLuogo, usiDelLuogo, validaLuogo } from '#lib/server/luoghi.ts';
import type { Actions, PageServerLoad } from './$types';

function idDaParametro(parametro: string): number | null {
  if (parametro === 'nuovo') return null;
  const id = Number(parametro);
  if (!Number.isInteger(id) || id <= 0 || !leggiLuogo(db, id)) error(404, 'Luogo non trovato');
  return id;
}

export const load: PageServerLoad = ({ params }) => {
  const id = idDaParametro(params.id);
  return id === null ? { luogo: null, usi: [] } : { luogo: leggiLuogo(db, id)!, usi: usiDelLuogo(db, id) };
};

export const actions = {
  salva: async ({ request, params }) => {
    const id = idDaParametro(params.id);
    const modulo = await request.formData();
    const esito = validaLuogo(modulo);
    if (!esito.ok) return fail(400, { errori: esito.errori, valori: esito.valori });
    const valori = Object.fromEntries([...modulo.entries()].map(([k, v]) => [k, String(v)]));
    if (id === null) {
      const creato = creaLuogo(db, esito.dati);
      if (!creato.ok) return fail(400, { errori: creato.errori, valori });
      redirect(303, `/luoghi/${creato.id}`);
    }
    const aggiornato = aggiornaLuogo(db, id, esito.dati);
    if (!aggiornato.ok) return fail(400, { errori: aggiornato.errori, valori });
    return { salvato: true };
  },

  elimina: async ({ params }) => {
    const id = idDaParametro(params.id);
    if (id === null) error(404, 'Luogo non trovato');
    const esito = eliminaLuogo(db, id);
    if (!esito.ok) return fail(409, { messaggio: esito.messaggio });
    redirect(303, '/luoghi');
  },
} satisfies Actions;
