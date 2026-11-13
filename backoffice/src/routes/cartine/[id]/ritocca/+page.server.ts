// Ritocca la cartina: la carta generata sul satellite, con i nomi e le tappe da spostare a mano.
import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { leggiCartina } from '#lib/server/cartine.ts';
import { generaCartina } from '#lib/server/importazione-svg.ts';
import { componiCartina, pubblicaPortale } from '#lib/server/pubblicazione.ts';
import { registraErrore } from '#lib/server/registro.ts';
import {
  eliminaNome, leggiNomi, leggiTappe, luogoDalNome, modificaNome, ripristinaNome, spostaNome, spostaTappa, validaNome,
} from '#lib/server/ritocchi.ts';
import type { Actions, PageServerLoad } from './$types';

function idValido(parametro: string): number {
  const id = Number(parametro);
  if (!Number.isInteger(id) || id <= 0 || !leggiCartina(db, id)) error(404, 'Cartina non trovata');
  return id;
}

export const load: PageServerLoad = ({ params }) => {
  const id = idValido(params.id);
  const k = leggiCartina(db, id)!;
  const pubblicata = componiCartina(db, id);
  const cammino = db.prepare('SELECT frecce FROM cammini WHERE id = ?').get(k.camminoId)!;
  return {
    cartina: { id, camminoId: k.camminoId, cammino: k.cammino, pulsante: k.pulsante, generata: k.importataIl, spilli: k.punti.length },
    stili: pubblicata.stili,
    elementi: pubblicata.elementi,
    nomi: leggiNomi(db, id),
    tappe: leggiTappe(db, k.camminoId),
    frecce: JSON.parse(String(cammino.frecce)) as { coordinate: [number, number]; rotazione: number }[],
  };
};

const numero = (modulo: FormData, k: string) => Number(modulo.get(k));

// esegue un ritocco; se serve, rigenera la cartina (tratti delle tappe, nomi riportati al disegno)
async function ritocco(id: number, opera: () => string | void, rigenera = false) {
  try {
    const messaggio = opera();
    const generata = rigenera ? await generaCartina(db, id) : null;
    return { fatto: true, messaggio: messaggio ?? null, avvisi: generata?.avvisi ?? [] };
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : String(errore);
    if (rigenera) registraErrore(db, { origine: 'importazione', messaggio, percorso: `/cartine/${id}/ritocca`, dettagli: errore instanceof Error ? errore.stack ?? null : null });
    return fail(400, { errore: messaggio });
  }
}

export const actions = {
  sposta: async ({ request, params }) => {
    const id = idValido(params.id), m = await request.formData();
    return ritocco(id, () => spostaNome(db, id, numero(m, 'nome'), numero(m, 'lng'), numero(m, 'lat')));
  },
  modifica: async ({ request, params }) => {
    const id = idValido(params.id), m = await request.formData();
    const esito = validaNome(m);
    if (!esito.ok) return fail(400, { errore: esito.errore });
    return ritocco(id, () => modificaNome(db, id, numero(m, 'nome'), esito.dati));
  },
  ripristina: async ({ request, params }) => {
    const id = idValido(params.id), m = await request.formData();
    return ritocco(id, () => ripristinaNome(db, id, numero(m, 'nome')), true);
  },
  elimina: async ({ request, params }) => {
    const id = idValido(params.id), m = await request.formData();
    return ritocco(id, () => eliminaNome(db, id, numero(m, 'nome')));
  },
  luogo: async ({ request, params }) => {
    const id = idValido(params.id), m = await request.formData();
    return ritocco(id, () => luogoDalNome(db, id, numero(m, 'nome')), true);
  },
  tappa: async ({ request, params }) => {
    const id = idValido(params.id), m = await request.formData();
    const k = leggiCartina(db, id)!;
    // senza spilli la cartina non si può rigenerare: il luogo si sposta comunque, i tratti alla prossima generazione
    return ritocco(id, () => { spostaTappa(db, k.camminoId, numero(m, 'tappa'), numero(m, 'lng'), numero(m, 'lat')); }, k.punti.length >= 3);
  },
  pubblica: async () => {
    try {
      const esito = await pubblicaPortale(db);
      return { pubblicato: true, avvisi: esito.cammini.flatMap((c) => c.avvisi) };
    } catch (errore) {
      return fail(500, { errore: errore instanceof Error ? errore.message : String(errore) });
    }
  },
} satisfies Actions;
