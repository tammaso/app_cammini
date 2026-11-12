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
  return id === null ? { luogo: null, usi: [], spilli: [] } : { luogo: leggiLuogo(db, id)!, usi: usiDelLuogo(db, id), spilli: spilliDelLuogo(id) };
};

// gli spilli legati al luogo, su tutte le cartine: per vederli sulla mappa accanto alla posizione dell'anagrafe
function spilliDelLuogo(id: number) {
  return db.prepare(`SELECT p.lng, p.lat, p.stato, k.id AS cartina_id, k.pulsante, c.titolo FROM punti_controllo p
      JOIN cartine k ON k.id = p.cartina_id JOIN cammini c ON c.id = k.cammino_id WHERE p.luogo_id = ? ORDER BY c.titolo, k.anno`).all(id)
    .map((r) => ({
      lng: Number(r.lng), lat: Number(r.lat), stato: String(r.stato) as 'proposto' | 'confermato' | 'manuale',
      cartinaId: Number(r.cartina_id), cartina: `${String(r.pulsante)} di «${String(r.titolo)}»`,
    }));
}

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
