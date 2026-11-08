import { db } from '#lib/server/db.ts';
import { elencaCammini } from '#lib/server/cammini.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ cammini: elencaCammini(db) });
