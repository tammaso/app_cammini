import { error, fail } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { leggiCartina, salvaPunti, type SpilloSalvato } from '#lib/server/cartine.ts';
import { generaCartina } from '#lib/server/importazione-svg.ts';
import { gruppiDiTesto, normale, type Disegno } from '#lib/disegno.ts';
import type { Actions, PageServerLoad } from './$types';

function idValido(parametro: string): number {
  const id = Number(parametro);
  if (!Number.isInteger(id) || id <= 0 || !leggiCartina(db, id)) error(404, 'Cartina non trovata');
  return id;
}

export const load: PageServerLoad = ({ params }) => {
  const id = idValido(params.id);
  const cartina = leggiCartina(db, id)!;
  const r = db.prepare('SELECT disegno FROM cartine WHERE id = ?').get(id)!;
  const disegno = r.disegno == null ? null : (JSON.parse(String(r.disegno)) as Disegno);
  const punti = db.prepare('SELECT p.*, l.nome AS luogo FROM punti_controllo p LEFT JOIN luoghi l ON l.id = p.luogo_id WHERE p.cartina_id = ? ORDER BY p.posizione')
    .all(id).map((p) => ({
      nome: String(p.nome), luogoId: p.luogo_id == null ? null : Number(p.luogo_id), luogo: p.luogo == null ? null : String(p.luogo),
      sx: Number(p.sx), sy: Number(p.sy), lng: Number(p.lng), lat: Number(p.lat),
      certezza: String(p.certezza) as SpilloSalvato['certezza'], stato: String(p.stato) as SpilloSalvato['stato'],
    }));
  // i luoghi dell'anagrafe, con tutte le forme del nome, per proporre gli spilli
  const luoghi = db.prepare('SELECT id, nome, nome_antico, altri_nomi, lat, lng, certezza, nota FROM luoghi').all().map((l) => ({
    id: Number(l.id), nome: String(l.nome), lat: Number(l.lat), lng: Number(l.lng), certezza: String(l.certezza) as SpilloSalvato['certezza'],
    nota: l.nota == null ? null : String(l.nota),
    chiavi: [l.nome, l.nome_antico, ...(JSON.parse(String(l.altri_nomi)) as string[])].filter(Boolean).map((n) => normale(String(n))),
  }));
  return {
    cartina: { id, camminoId: cartina.camminoId, cammino: cartina.cammino, pulsante: cartina.pulsante, fonte: cartina.fonte },
    disegno: disegno && {
      cornice: disegno.cornice,
      forme: disegno.forme,
      testi: gruppiDiTesto(disegno).map((g) => ({ testo: g.testo, box: g.box, colore: g.colore, dimensione: g.dimensione })),
    },
    punti,
    luoghi,
  };
};

async function leggiPunti(request: Request): Promise<SpilloSalvato[]> {
  const testo = String((await request.formData()).get('punti') ?? '[]');
  const punti = JSON.parse(testo) as SpilloSalvato[];
  if (!Array.isArray(punti)) throw new Error('Spilli non validi.');
  return punti;
}

export const actions = {
  salva: async ({ request, params }) => {
    const id = idValido(params.id);
    try {
      salvaPunti(db, id, await leggiPunti(request));
      return { salvati: true };
    } catch (errore) {
      return fail(400, { errore: errore instanceof Error ? errore.message : String(errore) });
    }
  },

  genera: async ({ request, params }) => {
    const id = idValido(params.id);
    try {
      salvaPunti(db, id, await leggiPunti(request));
      return { salvati: true, generata: await generaCartina(db, id) };
    } catch (errore) {
      return fail(400, { errore: errore instanceof Error ? errore.message : String(errore) });
    }
  },
} satisfies Actions;
