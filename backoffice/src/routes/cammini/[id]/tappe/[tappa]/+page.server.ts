import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import {
  aggiornaTappa, creaTappa, eliminaTappa, leggiCammino, leggiTappa, togliTracciato, validaTappa,
} from '#lib/server/cammini.ts';
import { immaginiScelte } from '#lib/server/immagini.ts';
import { elencaLuoghi } from '#lib/server/luoghi.ts';
import type { Actions, PageServerLoad } from './$types';

function parametri(params: { id: string; tappa: string }) {
  const camminoId = Number(params.id);
  const cammino = Number.isInteger(camminoId) ? leggiCammino(db, camminoId) : undefined;
  if (!cammino) error(404, 'Cammino non trovato');
  if (params.tappa === 'nuova') return { cammino, tappaId: null };
  const tappaId = Number(params.tappa);
  const tappa = Number.isInteger(tappaId) ? leggiTappa(db, tappaId) : undefined;
  if (!tappa || tappa.camminoId !== camminoId) error(404, 'Tappa non trovata');
  return { cammino, tappaId };
}

export const load: PageServerLoad = ({ params }) => {
  const { cammino, tappaId } = parametri(params);
  const tappa = tappaId === null ? null : leggiTappa(db, tappaId)!;
  return {
    cammino: { id: cammino.id, titolo: cammino.titolo },
    tappa,
    immagini: immaginiScelte(db, tappa?.immagini ?? []),
    luoghi: elencaLuoghi(db).map((l) => ({ id: l.id, nome: l.nome, lat: l.lat, lng: l.lng, certezza: l.certezza })),
  };
};

export const actions = {
  salva: async ({ request, params }) => {
    const { cammino, tappaId } = parametri(params);
    const esito = validaTappa(db, await request.formData());
    if (!esito.ok) return fail(400, { errori: esito.errori, valori: esito.valori });
    if (tappaId === null) {
      const id = creaTappa(db, cammino.id, esito.dati);
      redirect(303, `/cammini/${cammino.id}/tappe/${id}?salvata`);
    }
    aggiornaTappa(db, tappaId, esito.dati);
    return { salvata: true };
  },

  togliTracciato: async ({ params }) => {
    const { tappaId } = parametri(params);
    if (tappaId !== null) togliTracciato(db, tappaId);
    return { tracciatoTolto: true };
  },

  elimina: async ({ params }) => {
    const { cammino, tappaId } = parametri(params);
    if (tappaId !== null) eliminaTappa(db, tappaId);
    redirect(303, `/cammini/${cammino.id}`);
  },
} satisfies Actions;
