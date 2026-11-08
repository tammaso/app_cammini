import { db } from '#lib/server/db.ts';
import { elencaLuoghi } from '#lib/server/luoghi.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const ricerca = url.searchParams.get('q')?.trim() ?? '';
  return { ricerca, luoghi: elencaLuoghi(db, ricerca) };
};
