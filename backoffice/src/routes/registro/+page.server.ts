import { db } from '#lib/server/db.ts';
import { GIORNI_REGISTRO_ERRORI, GIORNI_REGISTRO_MODIFICHE, elencaErrori, elencaModifiche } from '#lib/server/registro.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  // I cammini che esistono ancora: le loro righe del registro portano al cammino.
  const esistenti = new Set(db.prepare('SELECT id FROM cammini').all().map((r) => Number(r.id)));
  return {
    modifiche: elencaModifiche(db).map((m) => ({ ...m, camminoEsiste: m.camminoId != null && esistenti.has(m.camminoId) })),
    errori: elencaErrori(db),
    giorni: { modifiche: GIORNI_REGISTRO_MODIFICHE, errori: GIORNI_REGISTRO_ERRORI },
  };
};
