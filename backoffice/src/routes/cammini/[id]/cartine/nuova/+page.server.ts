import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { leggiCammino } from '#lib/server/cammini.ts';
import { creaCartina } from '#lib/server/importazione-svg.ts';
import { intero, testo } from '#lib/server/moduli.ts';
import type { Actions, PageServerLoad } from './$types';

function cammino(parametro: string) {
  const c = leggiCammino(db, Number(parametro));
  if (!c) error(404, 'Cammino non trovato');
  return c;
}

export const load: PageServerLoad = ({ params }) => {
  const c = cammino(params.id);
  return { cammino: { id: c.id, titolo: c.titolo } };
};

export const actions = {
  default: async ({ request, params }) => {
    const c = cammino(params.id);
    const modulo = await request.formData();
    const valori = { pulsante: testo(modulo, 'pulsante'), anno: testo(modulo, 'anno'), epoca: testo(modulo, 'epoca') };
    const errori: Record<string, string> = {};
    if (!valori.pulsante) errori.pulsante = 'Il testo del pulsante è obbligatorio: «1200 a.C.».';
    const anno = intero(modulo, 'anno');
    if (anno === null) errori.anno = 'Un numero intero, negativo prima di Cristo: -1200.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(valori.epoca)) errori.epoca = 'Lettere minuscole senza accenti, numeri e trattini: «1200ac».';
    else if (db.prepare('SELECT 1 FROM cartine WHERE cammino_id = ? AND epoca = ?').get(c.id, valori.epoca)) errori.epoca = 'Il cammino ha già una cartina con questo nome.';
    if (Object.keys(errori).length) return fail(400, { errori, valori });
    const id = creaCartina(db, c.id, { epoca: valori.epoca, pulsante: valori.pulsante, anno: anno! });
    redirect(303, `/cartine/${id}/importa`);
  },
} satisfies Actions;
