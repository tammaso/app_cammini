import { db } from '#lib/server/db.ts';
import { statoPubblicazione } from '#lib/server/pubblicazione.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const conta = (sql: string) => Number(db.prepare(sql).get()!.n);
  return {
    cammini: conta('SELECT count(*) AS n FROM cammini'),
    tappe: conta('SELECT count(*) AS n FROM tappe'),
    cartine: conta('SELECT count(*) AS n FROM cartine'),
    luoghi: conta('SELECT count(*) AS n FROM luoghi'),
    immagini: conta('SELECT count(*) AS n FROM immagini'),
    pubblicazione: await statoPubblicazione(db),
  };
};
