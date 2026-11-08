import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { leggiCartina } from '#lib/server/cartine.ts';
import { classificazioneEffettiva, generaCartina, salvaClassificazione, salvaSvg } from '#lib/server/importazione-svg.ts';
import { registraErrore } from '#lib/server/registro.ts';
import type { Disegno } from '#lib/disegno.ts';
import type { Actions, PageServerLoad } from './$types';

function idValido(parametro: string): number {
  const id = Number(parametro);
  if (!Number.isInteger(id) || id <= 0 || !leggiCartina(db, id)) error(404, 'Cartina non trovata');
  return id;
}

export const load: PageServerLoad = ({ params }) => {
  const id = idValido(params.id);
  const cartina = leggiCartina(db, id)!;
  const effettiva = classificazioneEffettiva(db, id);
  const r = db.prepare('SELECT svg, generata_il FROM cartine WHERE id = ?').get(id)!;
  return {
    cartina: { id, camminoId: cartina.camminoId, cammino: cartina.cammino, pulsante: cartina.pulsante, fonte: cartina.fonte, punti: cartina.punti.length },
    haSvg: r.svg != null,
    generataIl: r.generata_il == null ? null : String(r.generata_il),
    stili: cartina.stili.map((s) => ({ chiave: s.chiave, nome: s.nome, tipo: s.tipo })),
    colori: effettiva?.colori ?? [],
    testi: (effettiva?.testi ?? []).map(({ pezzi, ...t }) => ({ ...t, pezzi: pezzi.length })),
    cornice: effettiva?.disegno.cornice ?? null,
  };
};

export const actions = {
  svg: async ({ request, params }) => {
    const id = idValido(params.id);
    const modulo = await request.formData();
    try {
      const disegno = JSON.parse(String(modulo.get('disegno'))) as Disegno;
      await salvaSvg(db, id, String(modulo.get('nome') || 'cartina.svg'), String(modulo.get('svg')), disegno);
      return { svgCaricato: true };
    } catch (errore) {
      return fail(400, { errore: errore instanceof Error ? errore.message : String(errore) });
    }
  },

  classifica: async ({ request, params }) => {
    const id = idValido(params.id);
    const { stiliNuovi } = salvaClassificazione(db, id, await request.formData());
    return { classificata: true, stiliNuovi };
  },

  genera: async ({ request, params }) => {
    const id = idValido(params.id);
    const modulo = await request.formData();
    // si salva prima la classificazione com'è nella pagina, poi si genera
    if (modulo.has('salvaPrima')) salvaClassificazione(db, id, modulo);
    try {
      return { generata: await generaCartina(db, id) };
    } catch (errore) {
      const messaggio = errore instanceof Error ? errore.message : String(errore);
      registraErrore(db, { origine: 'importazione', messaggio, percorso: `/cartine/${id}/importa`, dettagli: errore instanceof Error ? errore.stack ?? null : null });
      return fail(400, { errore: messaggio });
    }
  },
} satisfies Actions;
