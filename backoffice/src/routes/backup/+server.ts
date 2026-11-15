import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// «Backup» e «Registro» sono diventate una pagina sola, «Cronologia» (2026-11-15): i vecchi indirizzi portano lì.
export const GET: RequestHandler = () => redirect(308, '/cronologia');
