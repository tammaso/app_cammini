import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { db } from '#lib/server/db.ts';
import { CARTELLA_CARTINE } from '#lib/server/importazione-svg.ts';
import type { RequestHandler } from './$types';

// Il file SVG della cartina, come l'ha consegnato il cartografo (per vederlo accanto alla classificazione)
export const GET: RequestHandler = async ({ params }) => {
  const r = db.prepare('SELECT svg FROM cartine WHERE id = ?').get(Number(params.id));
  if (!r?.svg) error(404, 'La cartina non ha ancora il file SVG');
  const contenuto = await readFile(join(CARTELLA_CARTINE, String(r.svg))).catch(() => error(404, 'File SVG non trovato'));
  return new Response(contenuto, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' } });
};
