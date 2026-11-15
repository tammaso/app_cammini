import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { eliminaTappa, leggiCammino, leggiTappa, salvaTappaDalModulo, togliTracciato } from '#lib/server/cammini.ts';
import { leggiCartina } from '#lib/server/cartine.ts';
import { generaCartina } from '#lib/server/importazione-svg.ts';
import { immaginiScelte } from '#lib/server/immagini.ts';
import { elencaLuoghi, usiDelLuogo } from '#lib/server/luoghi.ts';
import { registraErrore } from '#lib/server/registro.ts';
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
    // i luoghi dell'anagrafe, con le forme del nome per cercarli e gli altri usi (spostandone uno si spostano anche quelli)
    luoghi: elencaLuoghi(db).map((l) => ({
      id: l.id, nome: l.nome, nomeAntico: l.nomeAntico, nomeAttuale: l.nomeAttuale, altriNomi: l.altriNomi, lat: l.lat, lng: l.lng,
      certezza: l.certezza,
      altriUsi: l.usi ? usiDelLuogo(db, l.id).filter((u) => tappaId === null || u.href !== `/cammini/${cammino.id}/tappe/${tappaId}`).map((u) => u.dove) : [],
    })),
  };
};

// Dopo aver spostato un luogo, le cartine del cammino che si possono rigenerare (file SVG e almeno 3 spilli) si
// rigenerano, così i tratti del cammino si riagganciano alla tappa (come nella pagina «Ritocca»).
async function rigeneraCartine(camminoId: number): Promise<{ rigenerate: string[]; nonRigenerabili: string[] }> {
  const rigenerate: string[] = [], nonRigenerabili: string[] = [];
  for (const r of db.prepare('SELECT id, svg FROM cartine WHERE cammino_id = ? ORDER BY anno').all(camminoId)) {
    const k = leggiCartina(db, Number(r.id))!;
    if (r.svg == null || k.punti.length < 3) { nonRigenerabili.push(k.pulsante); continue; }
    try {
      await generaCartina(db, k.id);
      rigenerate.push(k.pulsante);
    } catch (errore) {
      registraErrore(db, { origine: 'importazione', messaggio: errore instanceof Error ? errore.message : String(errore), percorso: `/cartine/${k.id}` });
      nonRigenerabili.push(k.pulsante);
    }
  }
  return { rigenerate, nonRigenerabili };
}

export const actions = {
  salva: async ({ request, params }) => {
    const { cammino, tappaId } = parametri(params);
    const modulo = await request.formData();
    const esito = salvaTappaDalModulo(db, cammino.id, tappaId, modulo);
    if (!esito.ok) return fail(400, { errori: esito.errori, valori: Object.fromEntries([...modulo.entries()].map(([k, v]) => [k, String(v)])) });
    const cartine = esito.spostato ? await rigeneraCartine(cammino.id) : null;
    if (tappaId === null) redirect(303, `/cammini/${cammino.id}/tappe/${esito.id}?salvata`);
    return { salvata: true, cartine };
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
